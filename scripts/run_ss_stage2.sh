#!/usr/bin/env bash
# Project 4 data run, stage 2: Second Sight manifest -> clean -> static mask -> cells -> aggregate -> labels ->
# 2026 NRT -> labels (NRT). Each step is timed; the first failure stops the chain.
# Run from the project 4 root:  bash scripts/run_ss_stage2.sh
# Environment: SS_DATA_DIR is set here to <root>/data-raw/ss (absolute, gitignored).
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

step manifest        "$PY" -m pipeline.data.manifest
step clean           "$PY" -m pipeline.data.clean
step static_mask     "$PY" -m pipeline.data.static_mask
step cells           "$PY" -m pipeline.data.cells
step aggregate       "$PY" -m pipeline.data.aggregate
step labels          "$PY" -m pipeline.data.labels
step nrt_2026        "$PY" -m pipeline.data.nrt
step labels_2026nrt  "$PY" -m pipeline.data.labels --input "$SS_DATA_DIR/derived/daily_cell_2026nrt.parquet" --suffix _2026nrt
echo "[$(date -u +%FT%TZ)] STAGE 2 COMPLETE"
