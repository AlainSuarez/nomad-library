# Nomad Library

Any BiblioCommons library's DVDs and Blu-rays on one browsable shelf. Live: https://nomad-library.pages.dev

- `functions/api/search.js` relays the library's public gateway (no key). Shelves are subject/tag queries that work at every library.
- Ratings: `tools/build_index.py` turns IMDb's free datasets into `public/ix/*.json` shards; the browser matches them (Workers Free allows only 10 ms CPU, so matching never runs on the server). The disc year is a ceiling, most-voted wins, subtitles must match.
- Accounts: passkeys + a backup code (`functions/api/auth/[action].js`), D1 `nomad-library`, signed cookie sessions. No email. Secret AUTH_SECRET in `~/.config/nomad-library/secrets.env`.
- Trailers: `/t?q=` finds the top YouTube result on first tap and caches it 120 days.
- Deploy: `CLOUDFLARE_ACCOUNT_ID=b2e213e3c7454d17fdfaf60ecde63e27 npx wrangler pages deploy --project-name nomad-library --branch main` (Sondor account). Retry on upload timeouts.
- Passkeys are tied to the domain. Move to the custom domain BEFORE launch, or pages.dev passkeys stop working there (backup codes still work).
