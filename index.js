/**
 * lesbancs - the official client for the lesbancs.fr API.
 *
 * Zero dependencies, ESM, Node 18 or newer (it uses the global fetch). No key
 * and no account: the data is public and the API asks for nothing.
 *
 * The shape of this file is shared with the other clients of the fleet
 * (auregistre, titelia, quivad), because the four APIs answer by one
 * convention: absolute addresses, an envelope naming the source and the
 * service, refusals as RFC 9457 problem documents, and long collections cut by
 * limit/offset with a page block that says where the rest is.
 */

/** Where the API answers. */
export const BASE_URL = 'https://lesbancs.fr';

/**
 * A refusal the API described, rather than a bare HTTP status.
 *
 * Every error of this API is an `application/problem+json` document
 * (RFC 9457): `type` is a documentation anchor that opens in a browser,
 * `title` and `detail` say what happened. A 503 also carries how long to
 * wait, which is why `retryAfterSeconds` is read out here rather than left in
 * the headers: a caller that backs off needs one number, not a document.
 */
export class ApiError extends Error {
	constructor(problem, status, retryAfter = null) {
		const said = [problem.title, problem.detail].filter(Boolean).join(': ');
		super(said || `HTTP ${status}`);
		this.name = 'ApiError';
		this.type = problem.type ?? null;
		this.title = problem.title ?? null;
		this.status = problem.status ?? status;
		this.detail = problem.detail ?? null;
		this.instance = problem.instance ?? null;
		this.retryAfterSeconds = retryAfter;
	}
}

/** Options every call accepts. */
function ask(options = {}) {
	return {
		baseUrl: options.baseUrl ?? BASE_URL,
		fetch: options.fetch ?? globalThis.fetch,
		signal: options.signal
	};
}

function address(base, path, params = {}) {
	const url = new URL(path, base);
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== null && value !== '') {
			url.searchParams.set(key, String(value));
		}
	}
	return url.toString();
}

/**
 * One call, and the only place an error is turned into an exception.
 *
 * A body is read as a problem document whenever the status refuses, whatever
 * the media type: the API always answers JSON, and a caller that gets HTML has
 * met something else - a proxy, a captive portal - which deserves to be said
 * rather than to surface as a parse error.
 */
async function call(url, options) {
	const { fetch: doFetch, signal } = ask(options);
	const response = await doFetch(url, { headers: { accept: 'application/json' }, signal });
	if (!response.ok) {
		let problem = {};
		try {
			problem = await response.json();
		} catch {
			problem = { title: `HTTP ${response.status}`, status: response.status };
		}
		const wait = Number(response.headers?.get?.('retry-after'));
		throw new ApiError(problem, response.status, Number.isFinite(wait) && wait > 0 ? wait : null);
	}
	return response;
}

async function json(url, options) {
	return (await call(url, options)).json();
}

/** A UAI as the education directory writes it: seven digits and a capital letter. */
const uaiOf = (uai) => String(uai).trim().toUpperCase();
/** An INSEE code: five characters, upper case for Corsica (2A, 2B). */
const inseeOf = (insee) => String(insee).trim().toUpperCase();

/**
 * What one address opens: the catchment school, middle school and high
 * school, level by level, with what each one rests on.
 *
 * The address is given in plain words, as on an envelope: "60 rue Pasteur,
 * Vitry-sur-Seine". The API resolves it at the Base Adresse Nationale and
 * answers with the address it read, so a caller sees whether the right street
 * was found. Nothing is guessed: a level whose `sector_basis` is null has no
 * published sector, and `sector_note` says who decides instead.
 *
 * A municipality typed alone (`address.type === 'municipality'`) has no
 * sector: `levels` is null, and `municipality.api_url` serves the commune.
 */
export async function catchment(query, options) {
	const q = String(query).trim();
	return json(address(ask(options).baseUrl, '/api/address', { q }), options);
}

/**
 * The whole record of one establishment, by its UAI: identity, contact, IPS
 * beside its averages, enrolment, results by exam over four sessions beside
 * the department and France averages, the score out of 10 and its ranks,
 * particularities (the ONISEP lines say ODbL), Parcoursup courses, the
 * municipalities its sector covers, and the nearest establishments.
 *
 * A school (nursery, primary) has no result and no score: France publishes
 * none per school, and the API invents none.
 */
export async function school(uai, options) {
	return json(address(ask(options).baseUrl, `/api/school/${uaiOf(uai)}`), options);
}

/**
 * The establishments of one commune, by its INSEE code, with whether its
 * school map is published and the addresses of its rankings.
 *
 * Paris, Lyon and Marseille answer with their arrondissements' establishments
 * and list the arrondissements. An INSEE code is not a postal code: 49007 is
 * Angers, 49000 is not a commune.
 */
export async function commune(insee, options) {
	return json(address(ask(options).baseUrl, `/api/commune/${inseeOf(insee)}`), options);
}

/** The three rankings the site publishes. */
export const RANKINGS = ['colleges', 'lycees', 'lycees-professionnels'];

/**
 * One page of a ranking: `colleges`, `lycees` or `lycees-professionnels`,
 * for France, one department (`dep`) or one commune (`insee`).
 *
 * The rows are ordered by the site's score out of 10 by default (`sort:
 * 'score'`), or by `pass-rate` or `value-added`; `sector` keeps `all`,
 * `public` or `private`; `criteria` narrows to particularities the site's own
 * ranking page proposes (an unknown one is ignored, and the answer says which
 * ones served). A page holds 1000 rows by default and 12000 at most: the
 * `page` block says the total and where the next page is.
 */
export async function ranking(type, options = {}) {
	if (!RANKINGS.includes(type)) {
		throw new RangeError(`"${type}" is not a ranking. The three are ${RANKINGS.join(', ')}.`);
	}
	const criteria = Array.isArray(options.criteria) ? options.criteria.join(',') : options.criteria;
	return json(
		address(ask(options).baseUrl, `/api/ranking/${type}`, {
			dep: options.dep,
			insee: options.insee,
			sector: options.sector,
			sort: options.sort,
			criteria,
			limit: options.limit,
			offset: options.offset
		}),
		options
	);
}

/**
 * Every row of a ranking, page after page.
 *
 * The API hands back the address of the next page rather than describing it,
 * so this follows `page.next` instead of assembling anything: a client that
 * builds the address itself gets it slightly wrong once, and the bug then looks
 * like missing data rather than a broken loop.
 */
export async function* rankingRows(type, options = {}) {
	let answer = await ranking(type, options);
	for (;;) {
		for (const row of answer.rows ?? []) yield row;
		const next = answer.page?.next ?? null;
		if (!next) return;
		answer = await json(next, options);
	}
}

/** The four levels whose sectors are drawn. */
export const SECTOR_LEVELS = ['middle-school', 'high-school', 'primary-school', 'nursery-school'];

/**
 * The drawn sectors of one department and one level, as a GeoJSON
 * FeatureCollection: one feature per sector, its establishments in the
 * properties, the envelope as foreign members.
 *
 * A department whose map of that level is not published is a 404 whose `type`
 * ends in `sectors-not-published`: it is not an error of yours, and the
 * `commune` and `catchment` answers say who decides the sector there.
 */
export async function sectors(dep, level, options) {
	if (!SECTOR_LEVELS.includes(level)) {
		throw new RangeError(`"${level}" is not a level. The four are ${SECTOR_LEVELS.join(', ')}.`);
	}
	const code = String(dep).trim().toUpperCase();
	return json(address(ask(options).baseUrl, `/api/sectors/${code}/${level}`), options);
}

/** The machine-readable contract this client was written against. */
export async function openapi(options) {
	return json(address(ask(options).baseUrl, '/api/openapi.json'), options);
}
