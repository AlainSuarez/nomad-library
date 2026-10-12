// GET /api/unsubscribe?t=<token> -> removes that email address from every list, right away. Linked from every email we send.
const page = (msg) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Nomad Library</title>
<body style="font:16px/1.5 system-ui,sans-serif;max-width:520px;margin:15vh auto;padding:0 20px;color:#10232B;background:#F2E7CD">
<h1 style="font-size:22px">${msg}</h1><p><a href="https://library.nomadovernormal.com/" style="color:inherit">Back to Nomad Library</a></p></body>`,
  { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

export async function onRequestGet({ request, env }) {
  const t = new URL(request.url).searchParams.get("t") || "";
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(t)) return page("That unsubscribe link isn't complete. Please use the whole link from the email.");
  const row = await env.DB.prepare("SELECT email FROM emails WHERE token = ?").bind(t).first();
  if (row) await env.DB.prepare("DELETE FROM emails WHERE email = ?").bind(row.email).run();
  return page("You're unsubscribed. We've deleted your email address.");
}
