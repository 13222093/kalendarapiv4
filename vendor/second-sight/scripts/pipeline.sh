#!/usr/bin/env bash
# Make-free equivalent of the Makefile targets (Git Bash on Windows, or any POSIX shell).
# Usage: bash scripts/pipeline.sh {help|venv|data|clean-data|mask|cells|aggregate|test}
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -x .venv/Scripts/python ]; then PY=.venv/Scripts/python; else PY=.venv/bin/python; fi

case "${1:-help}" in
  venv)       python -m venv .venv && "$PY" -m pip install -r requirements.txt ;;
  data)       "$PY" -m pipeline.data.ingest && "$PY" -m pipeline.data.manifest ;;
  clean-data) "$PY" -m pipeline.data.clean ;;
  mask)       "$PY" -m pipeline.data.static_mask ;;
  cells)      "$PY" -m pipeline.data.clean && "$PY" -m pipeline.data.static_mask && "$PY" -m pipeline.data.cells ;;
  aggregate)  "$PY" -m pipeline.data.aggregate ;;
  test)       "$PY" -m pytest -q tests ;;
  *) sed -n '2,3p' "$0" ;;
esac
