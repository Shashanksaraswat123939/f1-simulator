#!/usr/bin/env bash
# Build the game and publish dist/ to the gh-pages branch (served by GitHub Pages).
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
remote=$(git remote get-url origin)
tmp=$(mktemp -d)
cp -r dist/. "$tmp"
touch "$tmp/.nojekyll"
cd "$tmp"
git init -q -b gh-pages
git add -A
git commit -q -m "Deploy"
git push -q -f "$remote" gh-pages
echo "Deployed. Site: https://shashanksaraswat123939.github.io/f1-simulator/"
