#!/bin/bash
# Maintainer only. Publishes exactly what's on GitHub's main (never uncommitted local files) plus the IMDb-built data
# files, to the Cloudflare Pages project nomad-library (Sondor account).
set -euo pipefail
cd "$(dirname "$0")/.."
git fetch -q origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "Local main and GitHub main differ: pull or push first." >&2; exit 1; }
git diff --quiet HEAD -- || { echo "Uncommitted changes: commit or stash them first." >&2; exit 1; }
[ -s public/ix/00.json ] && [ -s public/shelf.json ] || { echo "Data files missing: run tools/fetch_data.sh" >&2; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
git archive HEAD | tar -x -C "$T"
cp -R public/ix public/shelf.json "$T/public/"
cd "$T" && npm ci --silent --omit=dev
echo "deploying $(git -C "$OLDPWD" rev-parse --short HEAD)"
CLOUDFLARE_ACCOUNT_ID=b2e213e3c7454d17fdfaf60ecde63e27 npx --yes wrangler@4.45.0 pages deploy public \
  --project-name nomad-library --branch main --commit-hash "$(git -C "$OLDPWD" rev-parse HEAD)" --commit-dirty=false
