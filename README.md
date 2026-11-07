# Nomad Library

Your public library's DVDs, Blu-rays and games on one shelf you can actually browse, with ratings, trailers, filters and a watchlist. Free, no ads.

**Live:** https://library.nomadovernormal.com
**Made by** [Nomad Over Normal](https://www.youtube.com/@NomadOverNormal)

## Help make it better

- **Something broken, or your library doesn't work?** [Open an issue](https://github.com/Chrisgpresents/nomad-library/issues/new/choose), or use the Feedback button on the site. Problems sent through the site get posted here (without names or emails), so this is one list.
- **Want to fix something?** Read [CONTRIBUTING.md](CONTRIBUTING.md). Issues labeled [`good first issue`](https://github.com/Chrisgpresents/nomad-library/labels/good%20first%20issue) are a good place to start, and [`library-request`](https://github.com/Chrisgpresents/nomad-library/labels/library-request) lists the catalog systems people are waiting on.
- **Found a security problem?** Please [report it privately](https://github.com/Chrisgpresents/nomad-library/security/advisories/new), not in a public issue.

The library copier (the part that copies catalogs so shelves open instantly) lives in [nomad-library-data](https://github.com/Chrisgpresents/nomad-library-data). New catalog systems are added there as readers.

## Run it on your computer

```sh
git clone https://github.com/Chrisgpresents/nomad-library && cd nomad-library
npm install
npm run data          # downloads the ratings files from the live site (about 1,260 small files)
cp .dev.vars.example .dev.vars
npm run db            # creates a local database
npm run dev           # http://localhost:8788
npm test              # needs Google Chrome; the network is mocked
```

## How it works

- Hosting: Cloudflare Pages. pages.dev forwards to the custom domain from a script in the page. Functions only run on /api/* and /t (public/_routes.json), so static files never count against the request limit.

- `functions/api/search.js` relays the library's public gateway (no key). Shelves are subject/tag queries that work at every library.
- Ratings: `tools/build_index.py` turns IMDb's free datasets into `public/ix/*.json` shards; the browser matches them (Workers Free allows only 10 ms CPU, so matching never runs on the server). The disc year is a ceiling, most-voted wins, subtitles must match.
- Accounts: passkeys + a backup code (`functions/api/auth/[action].js`), D1 `nomad-library`, signed cookie sessions. No email. Secret AUTH_SECRET (locally from `.dev.vars`).
- Trailers: `/t?q=` finds the top YouTube result on first tap and caches it 120 days.
- Deploy (maintainer only): `tools/deploy.sh` publishes a clean export of `main`. Retry on upload timeouts.
- Passkeys are tied to the domain. Move to the custom domain BEFORE launch, or pages.dev passkeys stop working there (backup codes still work).

## Library copies (since 10.11.26)
- A library opens from a static file `snap/<slug>.json.gz` on Cloudflare Pages (https://nomad-library-copies.pages.dev/snap/, project nomad-library-copies; GitHub Pages capped at 1 GB), made by the copier in the `nomad-library-data` repo on GitHub Actions. No Worker serves catalog data. The browser keeps its own copy in IndexedDB (6 libraries, used at once whatever its age, refreshed in the background).
- A library with no copy browses live (`/api/search`). The first visitor's browser sends one `POST /api/want` (once per device per day); the copier reads `GET /api/want` and copies requested libraries, oldest request first.
- `functions/api/snap.js` is the OLD path. The `nomad-library-crawler` Worker was deleted and the D1 `chunks` data cleared on 10.11.26 (SQL backups in ~/nomad-library-backups/). Rollback: deploy tag `pre-static-copies`; every library then browses live, because the old copies are gone.
- Tests: `node test/browser.mjs` (real Chrome, whole network mocked; set FIXTURE_DIR to a folder of catalog files for the large-catalog runs). The copier has its own: `node test/e2e.mjs` in nomad-library-data.
- Limits checked against official docs 10.11.26: Workers Free 100,000 requests/day and 10 ms CPU per request; static files are free and unlimited; GitHub Pages 1 GB site, 100 GB/month soft bandwidth, 10 builds/hour soft.

## Any other catalog (since 10.11.26 night)
- `public/catalog.js` (used by the page and by `functions/api/library.js`) reads a catalog link, names its system (Aspen, Vega, Encore, Polaris, SirsiDynix Enterprise, Evergreen, Koha, Sierra, CARL, Spydus, Apollo, Atriuum) and builds a title-search link. A catalog it doesn't know still works if the pasted link is a search (its `q=`/`searchterm=` value becomes the title).
- A non-BiblioCommons library opens the nationwide shelf (`lib=shelf`, `public/shelf.json`), and "Check at <library>" opens that catalog's search in the visitor's own browser, so catalogs that block programs still work. Never a web search.
- A library website (not the catalog) is read for its catalog. If nothing is found, the page asks for the catalog link; "Skip" still opens movies.
- Catalog links given for libraries in the directory are stored in D1 `catalogs` and served by `/api/catalogs`, so the next visitor from that library goes straight to movies. Hand-added ones: `public/catalogs.json` ("Name|ST": link).

## Other catalog systems we copy ourselves (since 11.1.26)
- Vega (*.iiivega.com, and libraries' own domains that run Vega), Polaris PowerPAC, SirsiDynix Enterprise and CARL / LS2 PAC are copied by readers in `nomad-library-data/readers/<system>.mjs`. Library ids are `<system>.<host>[_<scope>]` (e.g. `vega.sdpl.na5.iiivega.com`, `polaris.catalog.slcolibrary.org_1-1033-0-0-1`); BiblioCommons slugs never have a dot, which is how everything tells them apart (`isReaderLib`, `readerId` in `public/catalog.js`, mirrored from each reader's `libFromUrl`).
- Paste flow: a readable catalog with a copy opens like any library (hold buttons link to the record at the library; no live shelf check, so the copy's shelf status stands and reader copies refresh every 2 days). Without a copy yet: `POST /api/want {lib, name, url}` (D1 `libs.url` keeps the link the copier needs), the visitor browses the popular shelf with Check at, and the page switches to the library's own shelf by itself once the copy exists (`upgradeGuest`). A catalog the copier gives up on (bot wall) stops promising (`guest.noCopy`).
- Custom-domain Vega (catalog.dclibrary.org): `/api/library` asks the site's `/lookup` + `config.js` for the real `<code>.<region>.iiivega.com`.
- Genres: these catalogs rarely carry genre headings, so the copier adds IMDb's genres to every matched title (`public/ix/genres.json`, `tools/build_genres.py`).
- Not readable (measured 11.1.26): Aspen Discovery (Cloudflare blocks or an Anubis proof-of-work wall on every host tried), Great River's Enterprise (Cloudflare challenge).

## License and name

The code is free software under the [GNU AGPL v3](LICENSE): you can use it, change it and run your own copy, and if you run a changed copy as a public website you have to share your changes under the same license. The Nomad Library name and logo aren't covered by that license, see [BRAND.md](BRAND.md). Ratings come from IMDb's datasets (personal and non-commercial use), which is why those files aren't in this repo.

Thanks to everyone who has [contributed](https://github.com/Chrisgpresents/nomad-library/graphs/contributors). See [CREDITS.md](CREDITS.md).
