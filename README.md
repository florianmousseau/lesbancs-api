# lesbancs

**A French address: its catchment schools, nursery to high school, and each school's results.**

In France a pupil goes to the public school, middle school (collège) or high
school (lycée) of the sector their home address falls in. The maps that say
which one are published by the ministry (middle schools, nationally), by the
academies (high schools, some of them) and by the communes (schools, a few
hundred of them). This API reads them all for one address and says, level by
level, what the answer **rests on**: a published map, the only public school of
the commune, or nothing published, in which case it says who decides instead.

Around that one answer: the **record** of every establishment (enrolment,
social position index, results at the brevet and the baccalauréat over four
sessions beside the department and France averages, a score out of 10 with its
ranks, particularities, Parcoursup courses), the establishments of a
**commune**, the **rankings** of middle schools and high schools, and the drawn
**sectors** of a department as GeoJSON.

Nothing is guessed: a sector that is not published is served as not published.
No score exists for a school, because France publishes no result per school.

No API key, no account, no quota to apply for. Every figure was published by a
public source; whoever republishes it should say so, and every answer carries
the sentence to do it with.

- **The API**: `https://lesbancs.fr`
- **Human documentation** (French): https://lesbancs.fr/api
- **The contract**: [`openapi.json`](openapi.json), also served live at `https://lesbancs.fr/api/openapi.json`
- **The MCP server**: `https://lesbancs.fr/mcp` (four read-only tools, same data)
- **The site**: https://lesbancs.fr

## Install

```sh
npm install lesbancs
```

```js
import { catchment, school, commune, ranking, rankingRows, sectors, ApiError } from 'lesbancs';

const home = await catchment('60 rue Pasteur, Vitry-sur-Seine');
const [college] = home.levels.middle_school.sector;
const record = await school(college.uai);
```

Zero dependencies, ESM, Node 18 or newer. The client is a thin layer: it builds
the addresses, reads refusals as problem documents, and follows pages. Nothing
stops you from calling the API with `curl`.

## Endpoints

| Address | Answers |
| --- | --- |
| `GET /api/address?q={address}` | The catchment establishments of an address, level by level, with what each one rests on, the nearest public ones, the nearby Parcoursup courses and the private schools under contract |
| `GET /api/school/{uai}` | The whole record of one establishment |
| `GET /api/commune/{insee}` | The establishments of one commune, whether its school map is published, the addresses of its rankings |
| `GET /api/ranking/{colleges,lycees,lycees-professionnels}` | A ranking for France, a department (`dep`) or a commune (`insee`), by score, pass rate or value added, paged |
| `GET /api/sectors/{dep}/{level}` | The drawn sectors of a department as GeoJSON: `middle-school`, `high-school`, `primary-school`, `nursery-school` |
| `GET /api/openapi.json` | The contract, generated from the constants the code serves |
| `GET /api` | The human documentation, with one anchor per refusal code |

Identifiers are the ones France already uses: an **UAI** (seven digits and a
letter) names an establishment in the ministry's directory, an **INSEE code**
(five characters) names a commune. A postal code is not an INSEE code.

## The conventions, which are the same across the fleet

This API answers by the same convention as its three siblings
([auregistre](https://github.com/auregistre/api),
[titelia](https://github.com/titelia/api),
[quivad](https://github.com/quivad/api)). What holds for one holds for the four.

- **No version in the address, and none in the body.** The promise that replaces
  it is written in `x-stability` of the contract: a field may be **added**, none
  is removed or renamed under a caller, and an address does not move.
- **Refusals are RFC 9457 problem documents**, served as
  `application/problem+json`. `type` is a documentation anchor that opens in a
  browser; `title`, `status` and `detail` say the rest. An error is never an
  HTML page.
- **Long collections are cut by `limit` and `offset`**, never silently. The
  `page` block carries `total`, `more`, and the absolute address of the next
  and previous pages; the same two links travel in the `Link` header. An
  unreadable parameter falls back to the default rather than refusing, and an
  offset past the end is an empty list, not an error.
- **Every address in an answer is absolute**, and every object names its HTML
  page (`url`) beside its machine address (`api_url`).
- **`source` and `served_by` answer two different questions**: who PRODUCED
  the figures, and who ANSWERED.
- **Every answer carries a weak `ETag`** and honours `If-None-Match`: hand it
  back and get a `304` with no body.
- **Discovery links on every answer** (RFC 8631): `service-desc` points at the
  contract, `service-doc` at the human documentation.
- **No rate limit**: the site reads its own base and keeps every answer a day
  at the edge. A `503` carries `retry-after`; the client reads it into
  `ApiError.retryAfterSeconds`.

## What the data does not say

- **A sector is never guessed.** `sector_basis` says what the answer rests on:
  `published_map`, `map_by_number`, `map_by_street`, `map_of_municipality`,
  `drawn_zone`, `only_public_school_in_municipality`, or `null` when nothing is
  published. In that last case `sector_note` names who decides (the
  departmental council, the town hall, the academy) and where to ask.
  `map_by_street_number_needed` means the street is split between
  establishments and the number was missing.
- **A school has no score and no result.** France publishes results per middle
  school and high school, none per nursery or primary school. `main_exam` and
  `score` are null on a school, and no ranking of schools exists.
- **The score out of 10 is the site's, not the ministry's.** It combines the
  results, the DEPP value added and the pathway over three sessions; its method
  is at https://lesbancs.fr/classement/methode, and `value_added_points` beside
  it is the ministry's own figure. Quote the method with the score.
- **The middle-school map is the 2025 national file.** In case of doubt the
  departmental council or the town hall decides; the answer's `notice` says so.
- **Particularities from the ONISEP are under ODbL**, the rest under Licence
  Ouverte 2.0. Each particularity line carries its `licence` and its `date`.

## Examples

Runnable, in [`examples/`](examples): [`curl.sh`](examples/curl.sh),
[`node.mjs`](examples/node.mjs), [`python.py`](examples/python.py).

## Licence

The client code in this repository is MIT (see [LICENSE](LICENSE)).

**The data is not covered by that licence**: Licence Ouverte 2.0 (Etalab) for
the ministry, academy, commune, Parcoursup and Base Adresse Nationale data,
ODbL for the ONISEP particularities. Cite the source when you republish it:
every answer carries the sentence to do it with.

## Reporting something wrong

A wrong line is worth an issue: <https://github.com/florianmousseau/lesbancs-api/issues>.
Name the address you called and what you expected; the answer carries
`served_by`, which is what says the figure came from here rather than from the
ministry itself.
