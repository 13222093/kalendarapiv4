#!/usr/bin/env bash
# EXP-01: build the static bundle into $SS_DATA_DIR/bundle and copy it to app/public/data/.
# Usage: bash scripts/export.sh [--no-build]
# Generated files in app/public/data/ must stay out of git (see pipeline/export/README.md).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -x .venv/Scripts/python ]; then PY=.venv/Scripts/python; else PY=.venv/bin/python; fi
DATA_DIR="${SS_DATA_DIR:-D:/Lomba/Hackathon/nasa/second-sight-data}"
BUNDLE="$DATA_DIR/bundle"
DEST="app/public/data"

if [ "${1:-}" != "--no-build" ]; then
  "$PY" -m pipeline.export.bundle --out "$BUNDLE"
fi

mkdir -p "$DEST"
cp -r "$BUNDLE"/. "$DEST"/
echo "copied $(du -sh "$BUNDLE" | cut -f1) from $BUNDLE to $DEST"
