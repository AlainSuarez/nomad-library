# Nomad Library: notes for AI coding tools

Read README.md (architecture) and CONTRIBUTING.md (house rules) first. The short version:

- Plain HTML/CSS/JS in `public/`, Cloudflare Pages Functions in `functions/api/`, D1 schema in `schema.sql`. No framework, no build step.
- Every outbound link carries `rel="noopener noreferrer"` (BiblioCommons answers 403 to visitors referred from this site).
- Site copy: short, plain, contractions, digits for numbers, no em dashes. Look: Poppins, 4px corners, nothing decorative.
- Heavy work runs in the browser or in the copier (`nomad-library-data`), never in a Function.
- `public/ix/` and `public/shelf.json` are built from IMDb data and are not in git. `tools/fetch_data.sh` downloads them.
- Tests: `node --test test/resolver.mjs` and `node test/browser.mjs` (real Chrome, mocked network; `FIXTURE_DIR` with `chipublib.json.gz` for the large-catalog cases). A headless check of a `*.pages.dev` preview silently loads production (a script forwards to the custom domain), so strip that script or test after deploy.

## Maintainer workflow (repo owner only)

**Reviewing pull requests** ("check the pull requests"):
1. `gh pr list -R Chrisgpresents/nomad-library`, then for each: `gh pr view N`, `gh pr diff N`, `gh pr checks N`.
2. Read the whole diff. Look for: secrets or keys, new outside services or trackers, outbound links without noreferrer, server-side work that could blow Cloudflare CPU limits, faster or blocked access to library catalogs, changes to auth/passkeys/accounts, copy that breaks the house style, and anything that sends user data anywhere.
3. Check it out (`gh pr checkout N`) and run both test suites. For anything visible, screenshot it at phone and desktop width.
4. Report to the owner in plain words: what it does, whether it works, risks, and a recommendation (merge / ask for changes / close). Never merge without the owner's OK.
5. On OK: `gh pr merge N --squash`, add the contributor to CREDITS.md (newest first, with what they did), pull, `tools/deploy.sh`, check the live site, and leave a thank-you comment on the PR saying it's live. If declined: a kind comment with the reason and what would make it acceptable.

**Feedback from the site**: messages stay private in D1 `feedback`. `tools/feedback.sh N` reads them. Group new ones (status `new`) into issue drafts with no names, emails, device strings or identifying quotes, then `tools/feedback_issues.py drafts.json` (dry run) and `--post`. Posted rows get status `issue #N`.

**Deploy**: only `tools/deploy.sh` (clean export of GitHub main + local data files). Never deploy the working copy.
