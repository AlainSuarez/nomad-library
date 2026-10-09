// GET /api/library?q=<catalog link or code>  -> { slug, name } if it's a BiblioCommons library
import { json, slugFrom, libraryInfo } from "../../lib/core.js";

export async function onRequestGet(ctx) {
  const q = new URL(ctx.request.url).searchParams.get("q");
  const slug = slugFrom(q);
  if (!slug) return json({ error: "Paste your library's catalog link. It usually looks like yourlibrary.bibliocommons.com." }, { status: 400 });
  const info = await libraryInfo(ctx, slug);
  if (!info) return json({ error: "That library doesn't use BiblioCommons, so it isn't supported yet." }, { status: 404 });
  return json(info, { headers: { "cache-control": "public, max-age=86400" } });
}
