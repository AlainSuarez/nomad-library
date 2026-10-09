#!/bin/zsh
# Delete ONE account by id. Never run a bare DELETE on the users table: real people live there.
# usage: tools/delete_account.sh <uid> [<uid> ...]
set -e
export CLOUDFLARE_ACCOUNT_ID=b2e213e3c7454d17fdfaf60ecde63e27
for u in "$@"; do
  [[ "$u" =~ ^[A-Za-z0-9_-]{12,24}$ ]] || { echo "bad id: $u"; exit 1; }
  npx wrangler d1 execute nomad-library --remote --command "DELETE FROM creds WHERE uid = '$u'; DELETE FROM users WHERE id = '$u';" >/dev/null
  echo "deleted $u"
done
