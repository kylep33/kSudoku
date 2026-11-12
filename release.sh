#!/bin/sh
# Release ksudoku: ./release.sh 1.2.3 "what changed"
# Bumps the version in all three places, runs the tests, packs the .kpkg into the KPM repo
# (../kile-kpm-repo, or $KPM_REPO), lists it in the repo manifest, commits and pushes.
set -e
V=$1; MSG=$2
HERE=$(cd "$(dirname "$0")" && pwd); REPO=${KPM_REPO:-$HERE/../kile-kpm-repo}
echo "$V" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' && [ -n "$MSG" ] || { echo 'usage: release.sh X.Y.Z "what changed"'; exit 1; }
OUT=$REPO/packages/ksudoku/artifacts/ksudoku_${V}_kindleany.kpkg
[ ! -e "$OUT" ] || { echo "$OUT already exists"; exit 1; }
[ -z "$(git -C "$REPO" status --porcelain)" ] || { echo "$REPO has uncommitted changes"; exit 1; }

cd "$HERE"
sed -i -E "s/\"version\": \[[0-9, ]+\]/\"version\": [$(echo "$V" | sed 's/\./, /g')]/" manifest.json
sed -i -E "s/(<widget [^>]*version=\")[0-9.]+\"/\1$V\"/" app/config.xml
sed -i -E "s/var VERSION = '[0-9.]+'/var VERSION = '$V'/" app/index.html
node test.js  # also checks the three versions agree

# A .kpkg is a gzipped tar with the package files at its root.
tar czf "$OUT" --exclude=release.sh *

python3 - "$REPO/manifest.json" "$V" <<'EOF'
import json, sys
path, v = sys.argv[1], sys.argv[2]
m = json.load(open(path))
m["packages"]["ksudoku"]["artifacts"].append({"url": f"packages/ksudoku/artifacts/ksudoku_{v}_kindleany.kpkg",
    "version": [int(x) for x in v.split(".")], "dependencies": [], "supported_platforms": None})
open(path, "w").write(json.dumps(m))
EOF

cd "$REPO"
git add manifest.json "$OUT"
git commit -q -m "ksudoku $V: $MSG"
git push -q
gh workflow run publish.yml -R "$(git remote get-url origin | sed -E 's#.*github.com[:/]##; s#\.git$##')"  # pushes have not been triggering the deploy
echo "released ksudoku $V"
