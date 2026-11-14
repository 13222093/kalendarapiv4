#!/usr/bin/env bash
# Project 4: copy the Second Sight bundle, validation_results.json and finding.json into app/public/ss-data/,
# WITHOUT index.json. index.json is written last by pipeline/visibility/monthly_observability.py, so that its presence
# means the bundle is complete.
# Run from the project 4 root:  bash scripts/publish_ss_data.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SS="$ROOT/data-raw/ss"
DEST="$ROOT/app/public/ss-data"

for f in "$SS/bundle/index.json" "$SS/derived/validation_results.json" "$SS/derived/finding.json"; do
  [ -f "$f" ] || { echo "missing $f - run the pipeline first" >&2; exit 1; }
done
mkdir -p "$DEST"
rm -f "$DEST/index.json"                       # a stale index must not announce a half-written bundle
tar -C "$SS/bundle" --exclude=./index.json -cf - . | tar -C "$DEST" -xf -
cp "$SS/derived/validation_results.json" "$SS/derived/finding.json" "$DEST/"
# The only deviation from Second Sight's own output: validation_results.json meta.data_dir holds this machine's
# absolute data path (it would be published with the app); rewrite that one value to the relative path.
"$ROOT/.venv/Scripts/python" - "$DEST/validation_results.json" "$SS" <<'PY'
import json, sys
p, ss = sys.argv[1], sys.argv[2]
d = json.load(open(p, encoding='utf-8'))
old = d['meta'].get('data_dir')
d['meta']['data_dir'] = 'data-raw/ss'
d['meta']['data_dir_note'] = 'absolute path on the build machine replaced by the project-relative path when published'
json.dump(d, open(p, 'w', encoding='utf-8'), indent=2, default=str)
print('validation_results.json meta.data_dir rewritten:', bool(old))
PY
if grep -rl "Ari Azis" "$DEST" --include=*.json 2>/dev/null; then echo "WARNING: a local path is still in the files above" >&2; exit 1; fi
echo "copied the bundle (without index.json), validation_results.json and finding.json to $DEST"
ls -l "$DEST" | head -60
