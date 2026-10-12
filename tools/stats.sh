#!/bin/zsh
# How many people use Nomad Library. Counts only: no names, no IDs. usage: tools/stats.sh
export CLOUDFLARE_ACCOUNT_ID=b2e213e3c7454d17fdfaf60ecde63e27
cd "${0:A:h}/.." || exit 1
q() { npx --yes wrangler@latest d1 execute nomad-library --remote --json --command "$1" 2>/dev/null | python3 -c "
import sys,json
t=sys.stdin.read(); r=json.loads(t[t.find('['):])[0]['results']
for x in r: print('  ', *[f'{k}={v}' for k,v in x.items()])"; }
echo "Accounts:"; q "SELECT count(*) total, sum(created > (strftime('%s','now')-86400)*1000) last_24h, sum(created > (strftime('%s','now')-7*86400)*1000) last_7d FROM users"
echo "Devices that opened the site, per day (new = first time ever):"; q "SELECT day, devices, new_devices AS new FROM visits ORDER BY day DESC LIMIT 14"
echo "Libraries people asked for:"; q "SELECT count(*) requested FROM libs WHERE wanted = 1"
echo "Libraries people asked for that we can't show yet (most asked first):"; q "SELECT name, city, st, host, vendor, n FROM requests ORDER BY n DESC, last DESC LIMIT 20"
echo "Which catalog systems those requests use (blank = unknown):"; q "SELECT vendor, sum(n) AS requests FROM requests GROUP BY vendor ORDER BY requests DESC"
echo "Email sign-ups:"; q "SELECT kind, count(*) people FROM emails GROUP BY kind"
echo "People waiting for their library, by catalog system (most first):"; q "SELECT system, count(*) people, count(DISTINCT lib_host) libraries FROM emails WHERE kind = 'library' GROUP BY system ORDER BY people DESC"
echo "Libraries people are waiting for (most first):"; q "SELECT lib_name, lib_host, system, count(*) people FROM emails WHERE kind = 'library' GROUP BY lib_host ORDER BY people DESC LIMIT 20"
