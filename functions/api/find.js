// POST /api/find { lib, items: [{ t, y }] }  -> { hits: [[row, ...], ...] }
// Looks up watchlist titles at a library, a few at a time to stay inside free limits.
import { gw, json, shape, SLUG_RE } from "../../lib/core.js";

const MAX = 6;
const key = t => String(t || "").toLowerCase().replace(/\s*[:(\[].*$/, "").replace(/&/g, " and ")
  .replace(/[^a-z0-9 ]+/g, " ").replace(/^(the|a|an)\s+/, "").replace(/\s+/g, " ").trim();

export async function onRequestPost(ctx) {
  const body = await ctx.request.json().catch(() => ({}));
  const lib = String(body.lib || "").toLowerCase();
  if (!SLUG_RE.test(lib)) return json({ error: "Pick a library first." }, { status: 400 });
  const items = (body.items || []).slice(0, MAX);
  const search = async (title, keys) => {
    const p = new URLSearchParams({ query: String(title).slice(0, 100), searchType: "title", f_FORMAT: "DVD|BLURAY", limit: "10" });
    const { ok, d } = await gw(ctx, `${lib}/bibs/search?${p}`, 21600);
    if (!ok) return [];
    const out = [];
    for (const [id, b] of Object.entries(d?.entities?.bibs || {})) {
      if (keys.includes(key(b.briefInfo?.title))) out.push(shape(lib, id, b));
    }
    return out;
  };
  const hits = await Promise.all(items.map(async it => {
    // Some libraries file foreign films under the original title ("Tonari no Totoro").
    const keys = [key(it.t), it.o && key(it.o)].filter(Boolean);
    let out = await search(it.t || "", keys);
    if (!out.length && it.o && key(it.o) !== key(it.t)) out = await search(it.o, keys);
    return out.sort((a, b) => (a.fmt === "Blu-ray" ? -1 : 1) - (b.fmt === "Blu-ray" ? -1 : 1)).slice(0, 4);
  }));
  return json({ hits });
}
