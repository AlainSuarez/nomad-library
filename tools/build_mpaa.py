#!/usr/bin/env python3
"""US age ratings: public/ix/mpaa.json = {"<tconst digits>": "G"|"PG"|"PG-13"|"R"|"NC-17"}.
Source: Wikidata (CC0), property P1657 (MPA film rating) on items with an IMDb ID (P345).
Old labels fold into today's: X -> NC-17, GP / M / M/PG -> PG. A film rated twice keeps today's label."""
import csv, io, json, os, urllib.parse, urllib.request
Q = 'SELECT ?imdb ?rl WHERE { ?f wdt:P1657 ?r ; wdt:P345 ?imdb . ?r rdfs:label ?rl FILTER(LANG(?rl)="en") }'
url = "https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": Q})
req = urllib.request.Request(url, headers={"Accept": "text/csv", "User-Agent": "NomadLibrary/1.0 (library.nomadovernormal.com)"})
rows = csv.DictReader(io.StringIO(urllib.request.urlopen(req, timeout=120).read().decode()))
FOLD = {"G": "G", "PG": "PG", "PG-13": "PG-13", "R": "R", "NC-17": "NC-17", "X": "NC-17", "GP": "PG", "M": "PG", "M/PG": "PG"}
MODERN = {"G", "PG", "PG-13", "R", "NC-17"}
out, modern = {}, set()
for r in rows:
    t, l = r["imdb"], r["rl"]
    if not t.startswith("tt") or l not in FOLD: continue
    k = t[2:].lstrip("0")
    if k in modern: continue
    out[k] = FOLD[l]
    if l in MODERN: modern.add(k)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "ix", "mpaa.json")
json.dump(out, open(OUT, "w"), separators=(",", ":"))
print(len(out), "rated titles,", os.path.getsize(OUT) // 1024, "KB")
