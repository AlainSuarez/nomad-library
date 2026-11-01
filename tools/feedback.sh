#!/bin/zsh
# Read what people sent with the Feedback button (newest first). usage: tools/feedback.sh [N=50]
export CLOUDFLARE_ACCOUNT_ID=b2e213e3c7454d17fdfaf60ecde63e27
cd "${0:A:h}/.." || exit 1
npx --yes wrangler@latest d1 execute nomad-library --remote --json --command \
  "SELECT id, datetime(created/1000,'unixepoch') AS at, status, lib, page, email, uid IS NOT NULL AS signed_in, substr(device,1,60) AS device, message FROM feedback ORDER BY id DESC LIMIT ${1:-50}" 2>/dev/null |
python3 -c "
import sys,json
t=sys.stdin.read(); r=json.loads(t[t.find('['):])[0]['results']
print(len(r),'messages (newest first)\n')
for x in r: print(f\"#{x['id']} {x['at']} UTC  [{x['status']}]  lib={x['lib'] or '-'}  page={x['page'] or '-'}  email={x['email'] or '-'}  signed_in={x['signed_in']}\n   {x['device']}\n   {x['message']}\n\")"
