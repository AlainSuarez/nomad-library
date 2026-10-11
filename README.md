# Nomad Library

Any BiblioCommons library's DVDs and Blu-rays on one browsable shelf. Live: https://library.nomadovernormal.com (pages.dev forwards there from a script in the page; Functions only run on /api/* and /t via public/_routes.json, so static files never count against the free request limit)

- `functions/api/search.js` relays the library's public gateway (no key). Shelves are subject/tag queries that work at every library.
- Ratings: `tools/build_index.py` turns IMDb's free datasets into `public/ix/*.json` shards; the browser matches them (Workers Free allows only 10 ms CPU, so matching never runs on the server). The disc year is a ceiling, most-voted wins, subtitles must match.
- Accounts: passkeys + a backup code (`functions/api/auth/[action].js`), D1 `nomad-library`, signed cookie sessions. No email. Secret AUTH_SECRET in `~/.config/nomad-library/secrets.env`.
- Trailers: `/t?q=` finds the top YouTube result on first tap and caches it 120 days.
- Deploy: `CLOUDFLARE_ACCOUNT_ID=b2e213e3c7454d17fdfaf60ecde63e27 npx wrangler pages deploy --project-name nomad-library --branch main` (Sondor account). Retry on upload timeouts.
- Passkeys are tied to the domain. Move to the custom domain BEFORE launch, or pages.dev passkeys stop working there (backup codes still work).

## Library copies (since 10.11.26)
- A library opens from a static file `snap/<slug>.json.gz` on GitHub Pages (https://chrisgpresents.github.io/nomad-library-data/snap/), made by the copier in the `nomad-library-data` repo on GitHub Actions. No Worker serves catalog data. The browser keeps its own copy in IndexedDB (6 libraries, used at once whatever its age, refreshed in the background).
- A library with no copy browses live (`/api/search`). The first visitor's browser sends one `POST /api/want` (once per device per day); the copier reads `GET /api/want` and copies requested libraries, oldest request first.
- `functions/api/snap.js` and the D1 `chunks` data are the OLD path, kept only as a rollback route until cleanup. Rollback: `git archive pre-static-copies`, then deploy that export with the command above.
- Tests: `node test/browser.mjs` (real Chrome, whole network mocked; set FIXTURE_DIR to a folder of catalog files for the large-catalog runs). The copier has its own: `node test/e2e.mjs` in nomad-library-data.
- Limits checked against official docs 10.11.26: Workers Free 100,000 requests/day and 10 ms CPU per request; static files are free and unlimited; GitHub Pages 1 GB site, 100 GB/month soft bandwidth, 10 builds/hour soft.
