// lesbancs - A French address: its catchment schools, and each school's results.
// npm install lesbancs, then: node examples/node.mjs

import { catchment, commune, ranking, rankingRows, school, sectors, ApiError } from 'lesbancs';

// One address, in plain words. The answer says what each sector rests on:
// a published map, the only public school of the commune, or nothing published.
const home = await catchment('60 rue Pasteur, Vitry-sur-Seine');
console.log('read as:', home.address.label);
for (const [level, at] of Object.entries(home.levels)) {
	if (level === 'higher_education') continue;
	const names = at.sector.map((s) => s.name).join(' / ') || '(no published sector)';
	console.log(`${level}: ${names} [${at.sector_basis ?? 'not published'}]`);
	// Who decides where nothing is published, and where to ask.
	if (at.sector_note) console.log('  ', at.sector_note.text, at.sector_note.url ?? '');
}

// The whole record of the catchment middle school: results over four sessions
// beside the department and France averages, the score out of 10 and its ranks.
const [college] = home.levels.middle_school.sector;
const record = await school(college.uai);
const brevet = record.results.brevet;
console.log(record.name, record.ips, 'IPS;', brevet?.pass_rate, '% at the brevet', brevet?.session);
console.log('score', brevet?.score?.value, 'rank in France', brevet?.score?.rank_in_france);

// A commune, by its INSEE code (49007 is Angers; a postal code is not an INSEE code).
const angers = await commune('49007');
console.log(angers.name, angers.counts_by_level, 'map published:', angers.school_map);

// The first page of a ranking, then every row of a smaller one, page after page.
const top = await ranking('colleges', { dep: '49', limit: 5 });
for (const row of top.rows) console.log(row.rank, row.school.name, row.score?.value ?? row.exam.pass_rate);
let counted = 0;
for await (const row of rankingRows('lycees', { insee: '49007', sector: 'public' })) counted += row.rank > 0 ? 1 : 0;
console.log(counted, 'public lycees ranked in Angers');

// The drawn sectors of a department as GeoJSON.
const maineEtLoire = await sectors('49', 'middle-school');
console.log(maineEtLoire.features.length, 'sectors drawn in Maine-et-Loire');

// A department whose map is not published (the Charente-Maritime keeps its
// sectors in an academy tool) answers a problem document, which the client
// raises as an ApiError: not an error of yours, and catchment() says who decides.
try {
	await sectors('17', 'middle-school');
} catch (error) {
	if (error instanceof ApiError) console.log(error.status, error.title, '-', error.detail);
	else throw error;
}

// What the data does not say travels with it.
console.log(home.notice);
