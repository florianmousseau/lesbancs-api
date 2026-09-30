#!/usr/bin/env bash
# lesbancs - A French address: its catchment schools, and each school's results.
# No key, no account. Run any line on its own.
set -euo pipefail

# One address, in plain words. Each level says what its sector rests on
# (sector_basis): a published map, the only public school of the commune, or
# null when nothing is published, with sector_note saying who decides instead.
curl -s 'https://lesbancs.fr/api/address?q=60+rue+Pasteur,+Vitry-sur-Seine' | jq '.levels | with_entries(select(.key != "higher_education") | .value |= {basis: .sector_basis, sector: [.sector[].name]})'

# The whole record of the catchment middle school: results over four sessions
# beside the department and France averages, the score out of 10 and its ranks.
curl -s 'https://lesbancs.fr/api/school/0942434K' | jq '{name, ips: .ips.value, brevet: .results.brevet | {session, pass_rate, department_average, score: .score.value, rank: .score.rank_in_france}}'

# A commune by its INSEE code (49007 is Angers; a postal code is not an INSEE code):
# its establishments, whether its school map is published, its rankings.
curl -s 'https://lesbancs.fr/api/commune/49007' | jq '{name, counts_by_level, school_map, rankings: [.rankings[].api_url]}'

# A ranking, paged: the page block says the total and where the next page is.
curl -s 'https://lesbancs.fr/api/ranking/colleges?dep=49&limit=5' | jq '{sort, minimum_candidates, page, rows: [.rows[] | {rank, name: .school.name, score: .score.value}]}'

# The drawn sectors of a department, as GeoJSON: one feature per sector.
curl -s 'https://lesbancs.fr/api/sectors/49/middle-school' | jq '{level, sectors: (.features | length), first: .features[0].properties | {uai, name, schools: [.schools[].name]}}'

# Conditional: hand back the validator and get a 304 with no body.
etag=$(curl -sI 'https://lesbancs.fr/api/commune/49007' | tr -d '\r' | awk 'tolower($1)=="etag:"{print $2}')
curl -s -o /dev/null -w '%{http_code}\n' -H "if-none-match: $etag" 'https://lesbancs.fr/api/commune/49007'

# A refusal is a problem document, not a page: the type is an anchor of the
# documentation, https://lesbancs.fr/api#sectors-not-published here, because
# the Charente-Maritime publishes no map of its middle schools.
curl -s 'https://lesbancs.fr/api/sectors/17/middle-school' | jq '{type, title, status, detail}'
