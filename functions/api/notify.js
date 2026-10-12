// POST /api/notify { email, kind: "library" | "updates", lib: { name, url } }  -> { ok }
// Saves an email someone chose to give us: "tell me when my library's shelves are ready" (with that library's catalog link)
// or "send me updates". Nothing is sent from here. Each row gets a token for its one-click unsubscribe link (/api/unsubscribe).
import { json, randomId } from "../../lib/core.js";
import { readCatalogLink } from "../../public/catalog.js";

const MAX_ROWS = 50000;
const EMAIL = /^[^\s@<>()",;:]{1,64}@[a-z0-9.-]{1,253}\.[a-z]{2,24}$/i;
const clip = (v, n) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);

export async function onRequestPost({ request, env }) {
  let b = {};
  try { b = await request.json(); } catch {}
  if (b.website) return json({ ok: true });                          // the hidden field only robots fill in
  const email = clip(b.email, 254).toLowerCase();
  if (!EMAIL.test(email)) return json({ error: "That email doesn't look right. Check it and try again." }, { status: 400 });
  const kind = b.kind === "library" ? "library" : "updates";
  const cat = kind === "library" ? readCatalogLink(clip(b.lib?.url, 400)) : null;
  const { n } = await env.DB.prepare("SELECT count(*) n FROM emails").first();
  if (n >= MAX_ROWS) return json({ error: "Sign-ups are paused for a moment. Please try again later." }, { status: 503 });
  await env.DB.prepare(
    "INSERT INTO emails (email, kind, lib_host, lib_name, lib_url, system, token, created) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) " +
    "ON CONFLICT (email, kind, lib_host) DO NOTHING"
  ).bind(email, kind, cat?.host || "", clip(b.lib?.name, 120), cat?.url || "", cat?.system || "", randomId(18), Date.now()).run();
  return json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
