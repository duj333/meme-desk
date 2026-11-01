#!/bin/bash
# One-shot: create the public GitHub repo, push this folder, enable GitHub Pages, and verify. Needs `gh auth status` OK.
set -euo pipefail
cd "$(dirname "$0")"
OWNER=duj333; REPO=meme-desk
gh auth status -h github.com >/dev/null
./build.sh
git init -q -b main 2>/dev/null || true
git config user.name "$OWNER"; git config user.email "351084904+$OWNER@users.noreply.github.com"
git add -A && (git diff --cached --quiet || git commit -q -m "Meme Desk PWA $(date +%F\ %H:%M)")
if ! gh repo view "$OWNER/$REPO" >/dev/null 2>&1; then
  gh repo create "$OWNER/$REPO" --public --description "Meme Desk: paper-trading desk viewer (PWA)" --source . --remote origin --push
else
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$OWNER/$REPO.git"
  gh auth setup-git >/dev/null 2>&1 || true
  git push -u origin main
fi
gh api -X POST "repos/$OWNER/$REPO/pages" -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1 || \
gh api -X PUT "repos/$OWNER/$REPO/pages" -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1 || true
gh api "repos/$OWNER/$REPO/pages" --jq '{url: .html_url, status: .status}'
URL="https://$OWNER.github.io/$REPO/"
for i in $(seq 1 40); do c=$(curl -s -o /dev/null -w '%{http_code}' "$URL"); [ "$c" = 200 ] && break; sleep 10; done
for p in "" manifest.webmanifest sw.js app.js config.js icons/icon-512.png; do curl -s -o /dev/null -w "$URL$p %{http_code} %{content_type}\n" "$URL$p"; done
