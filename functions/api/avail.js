// GET /api/avail?lib=bclsnj&ids=S1,S2  -> live shelf status for a few titles (the movie page).
import { gw, json, SLUG_RE } from "../../lib/core.js";

export async function onRequestGet(ctx) {
  const u = new URL(ctx.request.url);
  const lib = (u.searchParams.get("lib") || "").toLowerCase();
  const ids = (u.searchParams.get("ids") || "").split(",").filter(id => /^[A-Za-z0-9]{4,40}$/.test(id)).slice(0, 6);
  if (!SLUG_RE.test(lib) || !ids.length) return json({ error: "Bad request" }, { status: 400 });
  const out = {};
  await Promise.all(ids.map(async id => {
    const { ok, d } = await gw(ctx, `${lib}/bibs/${id}/availability`, 120);
    const a = ok && d?.entities?.availabilities?.[id];
    if (a) out[id] = { avail: a.status === "AVAILABLE" || (a.availableCopies || 0) > 0, copies: a.availableCopies || 0, total: a.totalCopies || 0, holds: a.heldCopies || 0 };
  }));
  return json(out, { headers: { "cache-control": "public, max-age=60" } });
}
