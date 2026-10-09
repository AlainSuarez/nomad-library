#!/usr/bin/env python3
"""Probe guessed BiblioCommons codes and keep the real ones -> public/libraries.json (slug, name, movie count)."""
import json, urllib.request, concurrent.futures as cf, os, sys
UA = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
G = "https://gateway.bibliocommons.com/v2/libraries"
cands = set(open(sys.argv[1]).read().split())
def probe(s):
    try:
        d = json.load(urllib.request.urlopen(urllib.request.Request(f"{G}/{s}", headers=UA), timeout=15))
        L = list(d["entities"]["libraries"].values())[0]
        if L.get("domain", s) != s: return None
        q = urllib.request.Request(f"{G}/{s}/bibs/search?query=*&searchType=bl&f_FORMAT=DVD|BLURAY&limit=1", headers=UA)
        n = json.load(urllib.request.urlopen(q, timeout=20))["catalogSearch"]["pagination"]["count"]
        return {"slug": s, "name": L.get("longName") or s, "movies": n}
    except Exception:
        return None
with cf.ThreadPoolExecutor(16) as ex:
    found = [r for r in ex.map(probe, sorted(cands)) if r]
out = os.path.join(os.path.dirname(__file__), "..", "public", "libraries.json")
old = {x["slug"]: x for x in (json.load(open(out)) if os.path.exists(out) else [])}
for r in found: old[r["slug"]] = r
lst = sorted((x for x in old.values() if x["movies"] > 0), key=lambda x: x["name"])
json.dump(lst, open(out, "w"), separators=(",", ":"))
print(f"probed {len(cands)}, found {len(found)}, list now {len(lst)}")
