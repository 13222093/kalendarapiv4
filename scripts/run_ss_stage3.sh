#!/usr/bin/env bash
# Project 4 data run, stage 3: final manifest (now also covering the 2026 NRT raw files) -> unit tests ->
# validation (n_boot 1000) -> finding (n_boot 300, the script's own default) -> bundle export.
# Each step is timed; the first failure stops the chain. Run from the project 4 root after run_ss_stage2.sh:
#   bash scripts/run_ss_stage3.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export SS_DATA_DIR="$ROOT/data-raw/ss"
PY="$ROOT/.venv/Scripts/python"
LOGS="$SS_DATA_DIR/logs"
mkdir -p "$LOGS"
cd "$ROOT/vendor/second-sight"

step() { # name, command...
  local name="$1"; shift
  local t0; t0=$(date +%s)
  echo "[$(date -u +%FT%TZ)] START $name"
  "$@" > "$LOGS/$name.log" 2>&1 || { echo "[$(date -u +%FT%TZ)] FAIL  $name (see $LOGS/$name.log)"; tail -25 "$LOGS/$name.log"; exit 1; }
  echo "[$(date -u +%FT%TZ)] DONE  $name in $(( $(date +%s) - t0 )) s"
}

step manifest_final  "$PY" -m pipeline.data.manifest
step pytest          "$PY" -m pytest -q -rs -p no:cacheprovider tests
step validate_all    "$PY" -u -m pipeline.run.validate_all --n-boot 1000
step finding         "$PY" -u -m pipeline.run.finding
step bundle          "$PY" -u -m pipeline.export.bundle
echo "[$(date -u +%FT%TZ)] STAGE 3 COMPLETE"
