#!/usr/bin/env python3
"""IMDb genres for the copier: public/ix/genres.json = {"<tconst digits>": "<letters>"}.
Used for catalogs whose records carry no genre headings (Vega, Polaris, ...). Same title pool as build_index.py.
Letters: h horror, c comedy, a action/adventure, t thriller, k crime/mystery, d drama, n animation, f family,
y fantasy, r romance, o documentary, w western, x war, m musical, b biography, i history, s sports, S sci-fi."""
import gzip, json, os, sys
SRC = os.path.expanduser(sys.argv[1] if len(sys.argv) > 1 else "~/library-movies/imdb")
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "ix", "genres.json")
L = {"Horror": "h", "Comedy": "c", "Action": "a", "Adventure": "a", "Thriller": "t", "Crime": "k", "Mystery": "k", "Drama": "d",
     "Animation": "n", "Family": "f", "Fantasy": "y", "Romance": "r", "Documentary": "o", "Western": "w", "War": "x",
     "Musical": "m", "Biography": "b", "History": "i", "Sport": "s", "Sci-Fi": "S"}
R = set()
with gzip.open(f"{SRC}/ratings.tsv.gz", "rt") as f:
    next(f)
    for line in f:
        a = line.split("\t")
        if a[2].strip().isdigit() and int(a[2]) >= 300: R.add(a[0])
out = {}
with gzip.open(f"{SRC}/basics.tsv.gz", "rt") as f:
    next(f)
    for line in f:
        a = line.rstrip("\n").split("\t")
        if len(a) < 9 or a[0] not in R or a[1] not in ("movie", "tvMovie", "video", "tvSeries", "tvMiniSeries"): continue
        g = "".join(dict.fromkeys(L[x] for x in a[8].split(",") if x in L))
        if g: out[a[0][2:].lstrip("0")] = g
json.dump(out, open(OUT, "w"), separators=(",", ":"))
print(len(out), "titles,", os.path.getsize(OUT) // 1024, "KB")
