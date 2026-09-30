/**
 * lesbancs - a French address, its catchment schools, and each school's results.
 *
 * The types describe what the API SERVES. A field may be added under this
 * shape; none is removed or renamed, which is the promise that replaces a
 * version number. Values stay as the sources publish them, in French: a
 * school name, the label of a kind of establishment, the wording of a note.
 */

/** Where the API answers. */
export declare const BASE_URL: 'https://lesbancs.fr';

/** Options every call accepts. */
export interface Options {
	/** Another origin, for a preview. Defaults to `BASE_URL`. */
	baseUrl?: string;
	/** A fetch of your own: a proxy, a retry policy, a test double. */
	fetch?: typeof globalThis.fetch;
	signal?: AbortSignal;
}

/** A refusal the API described, in the shape of RFC 9457. */
export declare class ApiError extends Error {
	name: 'ApiError';
	/** A documentation anchor that opens in a browser: `https://lesbancs.fr/api#<code>`. */
	type: string | null;
	title: string | null;
	status: number;
	detail: string | null;
	/** The path that was requested. */
	instance: string | null;
	/** Present on a 503: how long to wait before asking again. */
	retryAfterSeconds: number | null;
}

/** The five fields every answer of this API carries. */
export interface Envelope {
	/** Who PRODUCED the figures: the sentence a citation copies. */
	source: string;
	/** Who ANSWERED, as opposed to the data. */
	served_by: { name: string; url: string };
	terms: string;
	documentation: string;
	/** What the data does and does not say. */
	notice: string;
}

/** The six levels of the French school system, as this API names them. */
export type Level =
	| 'nursery_school'
	| 'primary_school'
	| 'middle_school'
	| 'high_school'
	| 'vocational_high_school'
	| 'higher_education';

/** The exam that sums up an establishment. */
export type Exam = 'brevet' | 'bac' | 'bac-pro';

/** A rank among a number of establishments; two equal scores share a rank. */
export interface Rank {
	rank: number;
	of: number;
}

/** The exam that sums up an establishment, on its last session. Null for a school. */
export interface MainExam {
	exam: Exam;
	session: string;
	candidates: number | null;
	/** In percent. */
	pass_rate: number | null;
	/** In percent. */
	honours_rate: number | null;
	/** The DEPP value added of the pass rate, in points. */
	value_added_points: number | null;
	/** The site's score, two decimals; null under 30 candidates. */
	score_out_of_10: number | null;
	rank_in_france: Rank | null;
}

/** An establishment in a few lines, as a list shows it. */
export interface School {
	uai: string;
	name: string;
	level: Level;
	/** What it is, in French: "Collège", "École maternelle", "Lycée polyvalent". */
	kind: string;
	status: 'public' | 'private';
	/** For a private establishment: "sous contrat" or "hors contrat". */
	contract: string | null;
	/** Priority education label (REP, REP+), or null. */
	priority_education: string | null;
	address: string | null;
	postal_code: string | null;
	insee: string;
	city: string | null;
	lat: number | null;
	lon: number | null;
	/** Present when the answer measured it: from the address, or from another establishment. */
	distance_km?: number;
	students: number | null;
	/** Social position index. */
	ips: number | null;
	main_exam: MainExam | null;
	/** The HTML page of the establishment. */
	url: string;
	api_url: string;
}

/** What a sector rests on. Never guessed: null means no published sector. */
export type SectorBasis =
	| 'published_map'
	| 'only_public_school_in_municipality'
	| 'map_by_number'
	| 'map_by_street'
	| 'map_by_street_number_needed'
	| 'map_of_municipality'
	| 'drawn_zone';

/** Who decides the sector where none is published, and where to ask. */
export interface SectorNote {
	text: string;
	url: string | null;
}

/** One level of an address, the same shape from nursery to vocational high school. */
export interface LevelAtAddress {
	/** The catchment establishment(s). Several when the map names them together. */
	sector: School[];
	sector_basis: SectorBasis | null;
	/** The year of the commune's document, for a school sector. */
	map_year: string | null;
	/** Names the commune wrote for a shared sector, as written. */
	shared_between: string[];
	/** Whether a map covers the commune; null when the base cannot say. */
	map_published: boolean | null;
	sector_note: SectorNote | null;
	nearby: School[];
}

export interface NearbyCourse {
	name: string;
	track: string;
	selective: boolean;
	school: { uai: string; name: string; url: string | null; api_url: string | null };
	distance_km: number;
	/** Parcoursup access rate, in percent. */
	access_rate: number | null;
	session: string | null;
	url: string | null;
}

export interface HigherEducationAtAddress {
	academies: { code: string; name: string | null }[];
	/** Non-selective degrees that give priority to the academy of residence. */
	non_selective_degrees_with_priority: number;
	nearest_parcoursup_courses: NearbyCourse[];
}

export interface MunicipalityLink {
	insee: string;
	name: string;
	url: string;
	api_url: string;
}

export interface Catchment extends Envelope {
	query: string;
	/** The address the Base Adresse Nationale read. */
	address: {
		label: string;
		/** `housenumber`, `street`, `locality` or `municipality`. */
		type: string;
		insee: string;
		city: string;
		street: string | null;
		number: number | null;
		lat: number;
		lon: number;
		score: number;
	};
	municipality: MunicipalityLink;
	/** Null when a municipality was typed: a commune has no sector. */
	levels: {
		nursery_school: LevelAtAddress;
		primary_school: LevelAtAddress;
		middle_school: LevelAtAddress;
		high_school: LevelAtAddress;
		vocational_high_school: LevelAtAddress;
		higher_education: HigherEducationAtAddress;
	} | null;
	private_under_contract_nearby: School[] | null;
	url: string;
	api_url: string;
}

/** The score out of 10 and its three parts. */
export interface Score {
	value: number;
	results: number | null;
	progress: number | null;
	pathway: number | null;
	rank_in_france: Rank;
	rank_in_department: Rank | null;
	rank_among_same_status: Rank | null;
	/** Points gained or lost in one year, or null. */
	trend_one_year: number | null;
}

export interface Rates {
	candidates: number | null;
	pass_rate: number | null;
	honours_rate: number | null;
}

export interface ExamSession extends Rates {
	session: string;
	department_average: Rates | null;
	france_average: Rates | null;
}

export interface ExamRecord extends ExamSession {
	value_added_points: number | null;
	/** Brevet only: the average written mark. */
	written_average_out_of_20: number | null;
	/** Share of pupils who reach the exam in the establishment, in percent. */
	access_rate: number | null;
	score: Score | null;
	/** Earlier sessions, most recent first. */
	history: ExamSession[];
}

export interface Particularity {
	family: string;
	label: string;
	detail: string | null;
	source: string;
	date: string | null;
	licence: string;
}

export interface Course {
	id: string;
	name: string;
	track: string;
	selective: boolean;
	places: number | null;
	applications: number | null;
	admitted: number | null;
	access_rate: number | null;
	admitted_from_same_academy_share: number | null;
	admitted_scholarship_holders_share: number | null;
	/** Honours of the admitted, weighted, in percent of the maximum; null under ten admitted. */
	admitted_honours_index: number | null;
	admitted_very_good_honours_share: number | null;
	session: string | null;
	url: string | null;
}

export interface SchoolRecord extends School, Envelope {
	academy: { code: string | null; name: string | null };
	department: { code: string; name: string | null };
	contact: {
		phone: string | null;
		website: string | null;
		email: string | null;
		onisep_url: string | null;
	};
	/** The directory's flags, as written: "internat", "ulis", "segpa"... */
	flags: string[];
	ips: {
		value: number | null;
		school_year: string;
		general_technological: number | null;
		vocational: number | null;
		averages_among: 'public' | 'private';
		national: number | null;
		academic: number | null;
		departmental: number | null;
	} | null;
	enrolment: {
		school_year: string;
		students: number | null;
		classes: number | null;
		nursery_students: number | null;
		elementary_students: number | null;
		ulis_students: number | null;
		segpa_students: number | null;
		sixth_grade_students: number | null;
	} | null;
	results: {
		brevet: ExamRecord | null;
		bac_general_technological: ExamRecord | null;
		bac_professional: ExamRecord | null;
	};
	particularities: Particularity[];
	parcoursup_courses: Course[];
	/** The communes the school map attaches to this establishment, 90 at most. */
	sector_municipalities: MunicipalityLink[];
	nearby: School[];
}

export interface Commune extends Envelope {
	insee: string;
	name: string;
	department: { code: string; name: string | null };
	parent_insee: string | null;
	population: number | null;
	postal_code: string | null;
	lat: number | null;
	lon: number | null;
	arrondissements: MunicipalityLink[];
	counts_by_level: Record<Level, number>;
	school_map: { middle_school: boolean; high_school: boolean };
	schools: School[];
	parcoursup_courses_count: number;
	url: string;
	school_map_url: string | null;
	rankings: { type: RankingType; url: string; api_url: string }[];
	api_url: string;
}

export type RankingType = 'colleges' | 'lycees' | 'lycees-professionnels';
export type RankingSort = 'score' | 'pass-rate' | 'value-added';
export type RankingSector = 'all' | 'public' | 'private';

export interface RankingRow {
	rank: number;
	school: School;
	exam: {
		session: string;
		candidates: number | null;
		pass_rate: number | null;
		honours_rate: number | null;
		value_added_points: number | null;
	};
	score: Score | null;
}

/** Where the rest of a cut collection is. */
export interface Page {
	total: number;
	limit: number;
	offset: number;
	more: boolean;
	next: string | null;
	previous: string | null;
}

export interface Ranking extends Envelope {
	ranking: RankingType;
	exam: Exam;
	scope: {
		kind: 'france' | 'department' | 'municipality';
		department: { code: string; name: string } | null;
		municipality: { insee: string; name: string } | null;
	};
	/** The sort APPLIED, which is `pass-rate` when the base carries no score. */
	sort: RankingSort;
	sector: RankingSector;
	criteria: string[];
	minimum_candidates: number;
	session: string | null;
	rows: RankingRow[];
	page: Page;
	url: string;
	api_url: string;
}

export type SectorLevel = 'middle-school' | 'high-school' | 'primary-school' | 'nursery-school';

export interface SectorFeature {
	type: 'Feature';
	properties: {
		level: Level;
		/** One UAI, or several joined by `+` for a shared sector. */
		uai: string;
		name: string | null;
		map_date: string | null;
		schools: {
			uai: string;
			name: string;
			url: string;
			api_url: string;
			lat: number | null;
			lon: number | null;
			score_out_of_10: number | null;
		}[];
		url: string | null;
	};
	geometry: { type: 'MultiPolygon'; coordinates: number[][][][] };
}

export interface Sectors extends Envelope {
	type: 'FeatureCollection';
	department: { code: string; name: string };
	level: Level;
	features: SectorFeature[];
}

/**
 * What one address opens, level by level. The address is given in plain
 * words; a municipality typed alone has `levels: null`.
 */
export declare function catchment(query: string, options?: Options): Promise<Catchment>;

/** The whole record of one establishment, by its UAI (seven digits and a letter). */
export declare function school(uai: string, options?: Options): Promise<SchoolRecord>;

/** The establishments of one commune, by its INSEE code (not a postal code). */
export declare function commune(insee: string, options?: Options): Promise<Commune>;

export declare const RANKINGS: readonly RankingType[];

export interface RankingOptions extends Options {
	/** A department code: `49`, `2A`, `974`. */
	dep?: string;
	/** A commune INSEE code; arrondissements count with their city. */
	insee?: string;
	sector?: RankingSector;
	sort?: RankingSort;
	/** Particularity keys the site's ranking page proposes: `internat`, `segpa`, `ulis`... */
	criteria?: string | readonly string[];
	/** Rows per page, 1000 by default, 12000 at most. */
	limit?: number;
	offset?: number;
}

/**
 * One page of a ranking, for France, a department or a commune.
 *
 * @throws RangeError for a type that is not one of the three rankings.
 */
export declare function ranking(type: RankingType, options?: RankingOptions): Promise<Ranking>;

/** Every row of a ranking, page after page, following `page.next`. */
export declare function rankingRows(
	type: RankingType,
	options?: RankingOptions
): AsyncGenerator<RankingRow, void, undefined>;

export declare const SECTOR_LEVELS: readonly SectorLevel[];

/**
 * The drawn sectors of one department and one level, as GeoJSON.
 *
 * @throws RangeError for a level that is not one of the four.
 */
export declare function sectors(dep: string, level: SectorLevel, options?: Options): Promise<Sectors>;

/** The machine-readable contract this client was written against. */
export declare function openapi(options?: Options): Promise<Record<string, unknown>>;
