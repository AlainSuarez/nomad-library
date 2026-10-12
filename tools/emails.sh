#!/bin/zsh
# Writes everyone who signed up for emails to a CSV on this Mac (never committed), for sending by hand or a mailer later.
# usage: tools/emails.sh [library|updates]   -> ~/nomad-library-backups/emails-<kind>-<date>.csv
export CLOUDFLARE_ACCOUNT_ID=b2e213e3c7454d17fdfaf60ecde63e27
cd "${0:A:h}/.." || exit 1
kind=${1:-updates}
[[ $kind == library || $kind == updates ]] || { echo "kind must be library or updates"; exit 1; }
out=~/nomad-library-backups/emails-$kind-$(date +%Y-%m-%d).csv
mkdir -p ~/nomad-library-backups
npx --yes wrangler@latest d1 execute nomad-library --remote --json --command "SELECT email, lib_name, lib_host, lib_url, system, token, created FROM emails WHERE kind = '$kind' ORDER BY created" 2>/dev/null | python3 -c "
import sys, json, csv
t = sys.stdin.read(); rows = json.loads(t[t.find('['):])[0]['results']
w = csv.writer(open('$out', 'w', newline=''))
w.writerow(['email', 'library', 'catalog host', 'catalog link', 'system', 'unsubscribe link', 'signed up'])
for r in rows: w.writerow([r['email'], r['lib_name'], r['lib_host'], r['lib_url'], r['system'], 'https://library.nomadovernormal.com/api/unsubscribe?t=' + r['token'], r['created']])
print(len(rows), 'people ->', '$out')"
