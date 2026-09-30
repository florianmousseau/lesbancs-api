"""A French address: its catchment schools, and each school's results."""

import json
import sys
import urllib.parse
import urllib.request

# School names carry French accents: print them as UTF-8 even on a Windows
# console, which is not UTF-8 by default.
sys.stdout.reconfigure(encoding="utf-8")

BASE = "https://lesbancs.fr/api"

# Say who you are. The API asks for no key and no account, but a request that
# carries no User-Agent at all can be turned away at the edge before it reaches
# it. urllib sends no usable one by default.
AGENT = "lesbancs-example/1.0 (+https://github.com/florianmousseau/lesbancs-api)"


def get(path):
    ask = urllib.request.Request(f"{BASE}{path}", headers={"user-agent": AGENT})
    with urllib.request.urlopen(ask) as answer:
        return json.load(answer)


# One address, in plain words. Each level says what its sector rests on.
home = get("/address?q=" + urllib.parse.quote("60 rue Pasteur, Vitry-sur-Seine"))
print("read as:", home["address"]["label"])
for level, at in home["levels"].items():
    if level == "higher_education":
        continue
    names = " / ".join(s["name"] for s in at["sector"]) or "(no published sector)"
    print(f"{level}: {names} [{at['sector_basis'] or 'not published'}]")
    # Who decides where nothing is published, and where to ask.
    if at["sector_note"]:
        print("  ", at["sector_note"]["text"], at["sector_note"]["url"] or "")

# The whole record of the catchment middle school.
college = home["levels"]["middle_school"]["sector"][0]
record = get(f"/school/{college['uai']}")
brevet = record["results"]["brevet"]
print(record["name"], record["ips"]["value"], "IPS;", brevet["pass_rate"], "% at the brevet", brevet["session"])
if brevet["score"]:
    print("score", brevet["score"]["value"], "rank in France", brevet["score"]["rank_in_france"])

# A ranking, page after page: follow page.next rather than assembling offsets.
url = "/ranking/lycees?insee=49007&limit=5"
while url:
    page = get(url)
    for row in page["rows"]:
        print(row["rank"], row["school"]["name"], row["score"]["value"] if row["score"] else row["exam"]["pass_rate"])
    url = page["page"]["next"].removeprefix("https://lesbancs.fr/api") if page["page"]["next"] else None

# A refusal is a problem document, not a page.
try:
    get("/sectors/17/middle-school")
except urllib.error.HTTPError as refusal:
    problem = json.load(refusal)
    print(refusal.code, problem["type"], "-", problem["detail"])

# What the data does not say travels with it.
print(home["notice"])
