#!/usr/bin/env python3
"""Maintainer only. Posts reviewed feedback drafts as GitHub issues and marks those feedback rows in D1.

The Feedback button saves messages privately (D1 `feedback`). They are never posted word for word: they're grouped and
rewritten without names, emails or device details into a drafts file, reviewed, then posted with this tool.

  tools/feedback.sh 500 > feedback.txt                 # read what's new (status 'new')
  # write drafts.json: {"issues":[{"title","body","labels":[...],"feedback_ids":[...],"reports":n}]}
  tools/feedback_issues.py drafts.json                 # dry run: prints what would be posted
  tools/feedback_issues.py drafts.json --post          # posts, then sets feedback.status = 'issue #N'
"""
import json, os, re, subprocess, sys

REPO = "Chrisgpresents/nomad-library"
ACCOUNT = "b2e213e3c7454d17fdfaf60ecde63e27"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PII = [re.compile(p, re.I) for p in (r"[\w.+-]+@[\w-]+\.[\w.]+", r"\b\d{3}[ .-]?\d{3}[ .-]?\d{4}\b", r"\b\d{12,14}\b", r"Mozilla/5\.0")]
COLORS = {"bug": "d73a4a", "library-request": "0e8a16", "feature": "a2eeef", "question": "d876e3", "from-feedback": "ededed", "good first issue": "7057ff", "help wanted": "008672"}

def sh(*a, inp=None):
    return subprocess.run(a, input=inp, capture_output=True, text=True, check=True).stdout

def d1(sql):
    subprocess.run(["npx", "--yes", "wrangler@4.45.0", "d1", "execute", "nomad-library", "--remote", "--command", sql],
                   cwd=ROOT, env={**os.environ, "CLOUDFLARE_ACCOUNT_ID": ACCOUNT}, capture_output=True, text=True, check=True)

def main():
    if len(sys.argv) < 2: sys.exit(__doc__)
    issues = json.load(open(sys.argv[1]))["issues"]
    post = "--post" in sys.argv
    issues = [i for i in issues if not i.get("likely_fixed") and not i.get("posted")]
    for i in issues:
        text = i["title"] + "\n" + i["body"]
        hit = [p.pattern for p in PII if p.search(text)]
        if hit: sys.exit(f"refusing: possible personal details in '{i['title']}' ({hit})")
    if not post:
        for i in issues: print(f"[{','.join(i['labels'])}] {i['title']}  ({i.get('reports', 1)} reports, ids {i['feedback_ids']})")
        print(f"\n{len(issues)} issues would be posted. Add --post to post them."); return
    have = {l["name"] for l in json.loads(sh("gh", "label", "list", "-R", REPO, "--limit", "200", "--json", "name"))}
    for i in issues:
        for l in i["labels"] + ["from-feedback"]:
            if l not in have:
                sh("gh", "label", "create", l, "-R", REPO, "--color", COLORS.get(l, "c5def5" if l.startswith("catalog:") else "ededed")); have.add(l)
        n = i.get("reports", len(i["feedback_ids"]))
        body = i["body"].rstrip() + f"\n\n---\n_Reported {n} {'time' if n == 1 else 'times'} through the Feedback button on the site._"
        url = sh("gh", "issue", "create", "-R", REPO, "--title", i["title"], "--body-file", "-",
                 *sum([["--label", l] for l in i["labels"] + ["from-feedback"]], []), inp=body).strip()
        num = url.rsplit("/", 1)[-1]
        ids = ",".join(str(int(x)) for x in i["feedback_ids"])
        if ids: d1(f"UPDATE feedback SET status = 'issue #{num}', note = '{url}' WHERE id IN ({ids})")
        i["posted"] = url; print(url, i["title"])
    json.dump({"issues": issues}, open(sys.argv[1] + ".posted.json", "w"), indent=1)

main()
