#!/usr/bin/env python3
"""Build the IMDb ratings index the site matches against. Free public datasets, no API key.
Output: public/ix/<shard>.json, shard = first 2 characters of the normalised title (space as _).
Each entry: normtitle -> [[tconst, rating, votes, year, type], ...] most-voted first."""
import gzip, json, re, os, collections, sys
SRC = os.path.expanduser(sys.argv[1] if len(sys.argv) > 1 else "~/library-movies/imdb")
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "ix")
ART = re.compile(r'^(the|a|an|le|la|les|el|los|il)\s+', re.I)
def norm(t):
    t = (t or "").lower().strip()
    t = re.sub(r'\s*[:(\[].*$', '', t)
    t = re.sub(r"&", " and ", t)
    t = re.sub(r"[^a-z0-9 ]+", " ", t)
    t = ART.sub("", t)
    return re.sub(r"\s+", " ", t).strip()
def norm_full(t):
    t = (t or "").lower()
    t = re.sub(r"\(.*?\)|\[.*?\]", " ", t)
    t = re.sub(r"&", " and ", t)
    t = re.sub(r"[^a-z0-9 ]+", " ", t)
    t = ART.sub("", t)
    return re.sub(r"\s+", " ", t).strip()
R = {}
with gzip.open(f"{SRC}/ratings.tsv.gz", "rt") as f:
    next(f)
    for line in f:
        a = line.rstrip("\n").split("\t")
        try:
            v = int(a[2])
            if v >= 300: R[a[0]] = (float(a[1]), v)
        except: pass
TYPES = {"movie": "m", "tvMovie": "m", "video": "m", "tvSeries": "s", "tvMiniSeries": "s"}
idx = collections.defaultdict(dict)
with gzip.open(f"{SRC}/basics.tsv.gz", "rt") as f:
    next(f)
    for line in f:
        a = line.rstrip("\n").split("\t")
        if len(a) < 9 or a[1] not in TYPES: continue
        rt = R.get(a[0])
        if not rt: continue
        yr = int(a[5]) if a[5].isdigit() else 0
        for t in {a[2], a[3]}:
            for k in {norm(t), norm_full(t)}:
                if k: idx[k][a[0]] = [a[0], rt[0], rt[1], yr, TYPES[a[1]]]
shards = collections.defaultdict(dict)
for k, d in idx.items():
    shards[(k+"_")[:2].replace(" ","_")][k] = sorted(d.values(), key=lambda r: -r[2])[:5]
os.makedirs(OUT, exist_ok=True)
tot = 0
for s, d in shards.items():
    with open(os.path.join(OUT, f"{s}.json"), "w") as f: json.dump(d, f, separators=(",", ":"))
    tot += os.path.getsize(os.path.join(OUT, f"{s}.json"))
print(f"{len(idx):,} titles in {len(shards)} shards, {tot/1e6:.1f} MB")
