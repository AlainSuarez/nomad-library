#!/usr/bin/env python3
"""People search index: public/ix/people/<xx>.json = {"<name words>": [<tconst digits>, ...]}.
Directors plus the first 6 billed actors (actors with 2+ titles in the pool) of every title in public/ix/genres.json (the same title pool as the copier).
A name is filed under the first 2 letters of EACH of its words, so "spielberg" and "steven" both find Steven Spielberg.
Usage: build_people.py <dir with title.principals.tsv.gz and name.basics.tsv.gz>"""
import gzip, json, os, sys, unicodedata, re, collections
SRC = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
POOL = set(json.load(open(os.path.join(HERE, "..", "public", "ix", "genres.json"))))
OUT = os.path.join(HERE, "..", "public", "ix", "people")
def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", s)).strip()
films = collections.defaultdict(list)   # nconst -> [tconst digits]
directors = set()
with gzip.open(f"{SRC}/title.principals.tsv.gz", "rt") as f:
    next(f)
    for line in f:
        a = line.split("\t", 4)
        t = a[0][2:].lstrip("0")
        if t not in POOL: continue
        cat = a[3]
        if cat == "director": directors.add(a[2])
        if cat == "director" or (cat in ("actor", "actress", "self") and int(a[1]) <= 6):
            films[a[2]].append(int(t))
names = {}
with gzip.open(f"{SRC}/name.basics.tsv.gz", "rt") as f:
    next(f)
    for line in f:
        a = line.split("\t", 2)
        if a[0] in films: names[a[0]] = norm(a[1])
shards = collections.defaultdict(dict)
for n, ts in films.items():
    if len(set(ts)) < 2 and n not in directors: continue     # one-off bit parts make the files twice as big
    nm = names.get(n)
    if not nm or len(nm) < 3: continue
    ts = sorted(set(ts))
    for w in set(nm.split()):
        if len(w) < 2: continue
        d = shards[w[:2]]
        d[nm] = sorted(set(d.get(nm, [])) | set(ts)) if nm in d else ts   # two people sharing a name merge
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
total = 0
for k, d in shards.items():
    p = os.path.join(OUT, k + ".json")
    json.dump(d, open(p, "w"), separators=(",", ":")); total += os.path.getsize(p)
print(len(names), "people,", len(shards), "shards,", total // 1024, "KB; biggest",
      max((os.path.getsize(os.path.join(OUT, k + '.json')) // 1024, k) for k in shards))
