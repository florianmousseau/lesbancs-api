import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	ApiError,
	BASE_URL,
	RANKINGS,
	SECTOR_LEVELS,
	catchment,
	commune,
	ranking,
	rankingRows,
	school,
	sectors
} from '../index.js';

/*
 * The client is a thin layer, so what is worth testing is the thin layer: the
 * address it builds, and what it does with a refusal. Both are checked against
 * a fake fetch rather than against the live API - a test suite that calls a
 * foreign web server is a build dependency on somebody else's uptime.
 */

/** A fetch that records what it was asked for and answers what it is told. */
function fakeFetch(answer, status = 200, headers = {}) {
	const calls = [];
	const doFetch = async (url) => {
		calls.push(url);
		const body = typeof answer === 'function' ? answer(url) : answer;
		return new Response(JSON.stringify(body), {
			status,
			headers: { 'content-type': 'application/json', ...headers }
		});
	};
	return { doFetch, calls };
}

test('the base address is the production one', () => {
	assert.equal(BASE_URL, 'https://lesbancs.fr');
});

test('an address travels as typed, in the query', async () => {
	const { doFetch, calls } = fakeFetch({ query: '60 rue Pasteur, Vitry-sur-Seine' });
	await catchment('  60 rue Pasteur, Vitry-sur-Seine ', { fetch: doFetch });
	assert.deepEqual(calls, [
		'https://lesbancs.fr/api/address?q=60+rue+Pasteur%2C+Vitry-sur-Seine'
	]);
});

test('another origin can be aimed at, for a preview', async () => {
	const { doFetch, calls } = fakeFetch({ uai: '0942434K' });
	await school('0942434K', { fetch: doFetch, baseUrl: 'http://localhost:8811' });
	assert.equal(calls[0], 'http://localhost:8811/api/school/0942434K');
});

test('a UAI and an INSEE code are written the way the directories write them', async () => {
	const { doFetch, calls } = fakeFetch({});
	await school(' 0942434k ', { fetch: doFetch });
	await commune('2a004', { fetch: doFetch });
	assert.deepEqual(calls, [
		'https://lesbancs.fr/api/school/0942434K',
		'https://lesbancs.fr/api/commune/2A004'
	]);
});

test('a ranking carries only the options that were given', async () => {
	const { doFetch, calls } = fakeFetch({ rows: [] });
	await ranking('colleges', { fetch: doFetch });
	await ranking('lycees', { dep: '49', sector: 'public', sort: 'pass-rate', fetch: doFetch });
	await ranking('colleges', {
		insee: '49007',
		criteria: ['internat', 'segpa'],
		limit: 50,
		offset: 100,
		fetch: doFetch
	});
	assert.deepEqual(calls, [
		'https://lesbancs.fr/api/ranking/colleges',
		'https://lesbancs.fr/api/ranking/lycees?dep=49&sector=public&sort=pass-rate',
		'https://lesbancs.fr/api/ranking/colleges?insee=49007&criteria=internat%2Csegpa&limit=50&offset=100'
	]);
});

test('a ranking that does not exist is refused here, before the wire', async () => {
	const { doFetch, calls } = fakeFetch({ rows: [] });
	await assert.rejects(
		() => ranking('prepas', { fetch: doFetch }),
		(error) => error instanceof RangeError && /not a ranking/.test(error.message)
	);
	assert.deepEqual(calls, []);
	assert.deepEqual(RANKINGS, ['colleges', 'lycees', 'lycees-professionnels']);
});

test('the rows of a ranking follow page.next, and stop when there is none', async () => {
	const pages = {
		'https://lesbancs.fr/api/ranking/colleges?dep=49&limit=2': {
			rows: [{ rank: 1 }, { rank: 2 }],
			page: { next: 'https://lesbancs.fr/api/ranking/colleges?dep=49&limit=2&offset=2' }
		},
		'https://lesbancs.fr/api/ranking/colleges?dep=49&limit=2&offset=2': {
			rows: [{ rank: 3 }],
			page: { next: null }
		}
	};
	const { doFetch, calls } = fakeFetch((url) => pages[url]);
	const ranks = [];
	for await (const row of rankingRows('colleges', { dep: '49', limit: 2, fetch: doFetch })) {
		ranks.push(row.rank);
	}
	assert.deepEqual(ranks, [1, 2, 3]);
	assert.equal(calls.length, 2);
});

test('the sectors take a department and one of the four levels', async () => {
	const { doFetch, calls } = fakeFetch({ type: 'FeatureCollection' });
	await sectors('2b', 'middle-school', { fetch: doFetch });
	assert.deepEqual(calls, ['https://lesbancs.fr/api/sectors/2B/middle-school']);
	await assert.rejects(
		() => sectors('49', 'colleges', { fetch: doFetch }),
		(error) => error instanceof RangeError && /not a level/.test(error.message)
	);
	assert.equal(SECTOR_LEVELS.length, 4);
});

test('a refusal becomes an ApiError carrying the problem document', async () => {
	const problem = {
		type: 'https://lesbancs.fr/api#school-not-found',
		title: 'School not found',
		status: 404,
		detail: 'No open establishment carries UAI 0000000A.',
		instance: '/api/school/0000000A'
	};
	const { doFetch } = fakeFetch(problem, 404);
	await assert.rejects(
		() => school('0000000A', { fetch: doFetch }),
		(error) => {
			assert.ok(error instanceof ApiError);
			assert.equal(error.status, 404);
			assert.equal(error.title, 'School not found');
			assert.equal(error.type, problem.type);
			assert.equal(error.instance, '/api/school/0000000A');
			// The message is what a log line shows, so it says both halves.
			assert.match(error.message, /School not found: No open establishment/);
			assert.equal(error.retryAfterSeconds, null);
			return true;
		}
	);
});

test('a 503 says how long to wait, read from the header', async () => {
	const { doFetch } = fakeFetch(
		{ type: 'https://lesbancs.fr/api#database-unavailable', title: 'Database unavailable', status: 503 },
		503,
		{ 'retry-after': '60' }
	);
	await assert.rejects(
		() => commune('49007', { fetch: doFetch }),
		(error) => error instanceof ApiError && error.status === 503 && error.retryAfterSeconds === 60
	);
});

test('a refusal that is not a problem document still says the status', async () => {
	// A proxy, a captive portal, anything that is not the API: the caller gets a
	// status rather than a parse error from deep inside the client.
	const doFetch = async () => new Response('<html>gateway</html>', { status: 502 });
	await assert.rejects(
		() => catchment('60 rue Pasteur', { fetch: doFetch }),
		(error) => error instanceof ApiError && error.status === 502
	);
});
