// GET /api/search?lib=bclsnj&fmt=all|br|dvd&shelf=horror&q=&sort=&page=1
// Live from the library's own catalog. Ratings are matched in the browser.
import { gw, json, shape, SLUG_RE } from "../../lib/core.js";

// Shelves are catalog queries that work the same at every BiblioCommons library.
export const SHELVES = {
  all:       { q: "*", st: "bl" },
  new:       { q: "*", st: "bl", sort: "newly_acquired" },
  mustsee:   { q: "*", st: "bl", f: "f_TAG_ABOUT=1001 movies you must see before you die" },
  oscar:     { q: "*", st: "bl", f: "f_TAG_GENRE=oscar winner" },
  registry:  { q: "*", st: "bl", f: "f_TAG_ABOUT=national film registry" },
  criterion: { q: "criterion collection", st: "keyword" },
  ghibli:    { q: "studio ghibli", st: "keyword" },
  horror:    { q: "horror films", st: "subject" },
  comedy:    { q: "comedy films", st: "subject" },
  romcom:    { q: "romantic comedy films", st: "subject" },
  scifi:     { q: "science fiction films", st: "subject" },
  action:    { q: "action and adventure films", st: "subject" },
  suspense:  { q: "suspense", st: "subject" },
  animation: { q: "animated films", st: "subject" },
  family:    { q: "children's films", st: "subject" },
  documentary: { q: "documentary films", st: "subject" },
  foreign:   { q: "foreign films", st: "subject" },
  western:   { q: "western films", st: "subject" },
  war:       { q: "war films", st: "subject" },
  musical:   { q: "musical films", st: "subject" },
  tv:        { q: "television programs", st: "subject" },
};
const FMT = { all: "DVD|BLURAY", br: "BLURAY", dvd: "DVD" };
const SORTS = { new: "newly_acquired", title: "title", year: "published_date" };

function path(lib, s, fmt, page, sort) {
  const p = new URLSearchParams({ query: s.q, searchType: s.st, f_FORMAT: FMT[fmt] || FMT.all, limit: "25", page: String(page) });
  if (s.f) { const [k, v] = s.f.split("="); p.set(k, v); }
  const so = sort || s.sort;
  if (so) p.set("sort", so);
  return `${lib}/bibs/search?${p}`;
}

function rowsOf(lib, d) {
  const bibs = d?.entities?.bibs || {};
  const order = d?.catalogSearch?.results?.map(r => r.representative) || Object.keys(bibs);
  const out = [];
  for (const id of order) if (bibs[id]) out.push({ id, b: bibs[id] });
  return out;
}


export async function onRequestGet(ctx) {
  const { request, env } = ctx;
  const u = new URL(request.url);
  const lib = (u.searchParams.get("lib") || "").toLowerCase();
  if (!SLUG_RE.test(lib)) return json({ error: "Pick a library first." }, { status: 400 });
  const fmt = FMT[u.searchParams.get("fmt")] ? u.searchParams.get("fmt") : "all";
  const q = (u.searchParams.get("q") || "").trim().slice(0, 120);
  const shelfKey = SHELVES[u.searchParams.get("shelf")] ? u.searchParams.get("shelf") : "all";
  const shelf = q ? { q, st: "keyword" } : SHELVES[shelfKey];
  const sortKey = u.searchParams.get("sort") || "";
  const page = Math.max(1, Math.min(400, +u.searchParams.get("page") || 1));

  const { ok, status, d } = await gw(ctx, path(lib, shelf, fmt, page, SORTS[sortKey]), 1800);
  if (!ok) return json({ error: status === 404 ? "That library wasn't found." : "The library's catalog didn't answer. Try again in a minute." }, { status: 502 });
  const pg = d.catalogSearch?.pagination || {};
  const rows = rowsOf(lib, d).map(({ id, b }) => shape(lib, id, b));
  return json({ total: pg.count || 0, page, pages: pg.pages || 1, rows },
    { headers: { "cache-control": "public, max-age=300" } });
}

