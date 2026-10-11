#!/usr/bin/env python3
"""Builds public/directory.json: every US public library system (federal IMLS survey, FY2022) for the
find-your-library search, with the BiblioCommons slug filled in where we already know it.
Entry: [name, city, state, population served, slug or 0]. Sorted biggest first.
usage: tools/build_directory.py   (downloads the survey itself; nothing else needed)"""
import csv, io, json, os, re, sys, urllib.request, zipfile
URL = "https://imls.gov/sites/default/files/2024-06/pls_fy2022_csv.zip"
ROOT = os.path.join(os.path.dirname(__file__), "..", "public")
raw = urllib.request.urlopen(URL, timeout=120).read()
z = zipfile.ZipFile(io.BytesIO(raw))
name = next(n for n in z.namelist() if n.endswith(".csv") and "AE_" in n)
rows = list(csv.DictReader(io.TextIOWrapper(z.open(name), encoding="latin-1")))

SMALL = {"of", "the", "and", "for", "at", "in", "a", "an", "de", "la", "du", "des"}
def pretty(t):
    t = re.sub(r"\s+", " ", t.strip().lower())
    return " ".join(w if (i and w in SMALL) else (w[:1].upper() + w[1:]) for i, w in enumerate(t.split(" "))).replace("Mc ", "Mc").replace("'S", "'s")
def key(t):
    t = re.sub(r"[^a-z0-9 ]+", " ", t.lower())
    return " ".join(w for w in t.split() if w not in ("the", "public", "library", "libraries", "system", "district", "free", "of", "and"))

libs = []
for r in rows:
    n, c, st = (r.get("LIBNAME") or "").strip(), (r.get("CITY") or "").strip(), (r.get("STABR") or "").strip()
    if not n or not st: continue
    try: pop = max(0, int(r.get("POPU_LSA") or 0))
    except ValueError: pop = 0
    libs.append([pretty(n), pretty(c), st, pop, 0])

# known BiblioCommons libraries -> attach the slug to the matching survey entry
known = json.load(open(os.path.join(ROOT, "libraries.json")))
extra = os.path.join(os.path.dirname(__file__), "known_slugs.json")      # hand-checked matches: {slug: [name fragment, state]}
hand = json.load(open(extra)) if os.path.exists(extra) else {}
by_key = {}
for i, l in enumerate(libs): by_key.setdefault(key(l[0]), []).append(i)
CANADA = {"aurora", "barrie", "brucecounty", "burlington", "burnaby", "calgary", "coqlibrary", "epl", "fvrl", "guelphpl", "halifax", "hpl", "mississauga", "nvcl", "opl", "orl", "spl", "surrey", "vpl", "wellington", "whistler"}
unmatched = []
for k in known:
    slug, nm = k["slug"], k["name"]
    if slug in hand:
        frag, st = hand[slug]
        hit = [i for i, l in enumerate(libs) if l[2] == st and frag.lower() in l[0].lower()]
    else:
        hit = by_key.get(key(nm), [])
    if len(hit) == 1: libs[hit[0]][4] = slug
    else:
        # not in the US survey (Canada) or ambiguous: add as its own entry so it is still findable by name
        region = "NZ" if slug == "christchurch" else "CA" if slug in CANADA else ""
        libs.append([nm, "", region, 0, slug]); unmatched.append((slug, nm, len(hit), region))
libs.sort(key=lambda l: -l[3])
out = os.path.join(ROOT, "directory.json")
json.dump({"v": 1, "libs": libs}, open(out, "w"), separators=(",", ":"), ensure_ascii=False)
conn = sum(1 for l in libs if l[4])
print(f"{len(libs)} libraries, {conn} connected, {os.path.getsize(out)/1e3:.0f} KB; unmatched known libraries: {len(unmatched)}")
for u in unmatched: print("  ", u)
