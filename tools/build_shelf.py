#!/usr/bin/env python3
"""Builds public/shelf.json: one nationwide movie shelf, merged from the library catalogs we have already copied,
for visitors whose own library we cannot read yet. Same row format as a library copy; availability is left out.
Row: [id, title, sub, fmt, discYear, cover, onShelf, holds, genres, tv, platform, rating, votes, imdb, filmYear]
usage: tools/build_shelf.py"""
import gzip, json, os, urllib.request, urllib.parse
BASE = "https://nomad-library-copies.pages.dev/snap/"
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "shelf.json")
MIN_VOTES = 2000
def get(p): return urllib.request.urlopen(urllib.request.Request(BASE + p, headers={"User-Agent": "nomad-library-build"}), timeout=120).read()
index = json.loads(get("index.json"))
best = {}                                              # imdb id -> row
for slug in sorted(index):
    raw = get(slug + ".json.gz"); d = json.loads(gzip.decompress(raw) if raw[:2] == b"\x1f\x8b" else raw)
    sc = d.get("sc", "")
    for r in d["rows"]:
        if r[3] == "g" or r[9] or not r[13] or (r[12] or 0) < MIN_VOTES or not r[1]: continue   # films only, rated, well known
        cover = r[5]
        if cover.startswith("~"):                      # compact Syndetics address -> full address
            _, isbn, upc, oclc = cover.split("~")
            cover = f"https://secure.syndetics.com/index.aspx?isbn={isbn}/MC.GIF&client={urllib.parse.quote(sc)}&type=xw12&oclc={oclc}&upc={upc}" if sc else ""
        cur = best.get(r[13])
        if cur is None:
            best[r[13]] = [r[13], r[1], "", "d", r[4] or r[14], cover, 0, 0, r[8], 0, "", r[11], r[12], r[13], r[14]]
        else:
            if not cur[5] and cover: cur[5] = cover
            if r[8] and len(r[8]) > len(cur[8]): cur[8] = r[8]
rows = sorted(best.values(), key=lambda x: -x[12])
body = json.dumps({"ver": 1, "finished": 1791750000000, "total": len(rows), "sc": "", "rows": rows}, separators=(",", ":"), ensure_ascii=False)
open(OUT, "w").write(body)
nocover = sum(1 for r in rows if not r[5])
print(f"{len(rows)} films from {len(index)} libraries, {len(body)/1e6:.1f} MB raw, {len(gzip.compress(body.encode()))/1e6:.2f} MB gz, {nocover} without a cover")
print("top:", [r[1] for r in rows[:5]])
