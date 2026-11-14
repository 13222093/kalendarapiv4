#!/usr/bin/env bash
# VAL-12: run the full validation suite on the real derived data, then the figures (EXP-05).
# Usage: SS_DATA_DIR=/path/to/second-sight-data scripts/validate.sh [--n-boot 1000]
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${PYTHON:-python}"
"$PY" -m pipeline.run.validate_all "$@"
"$PY" notebooks/validation_figures.py || echo "figures failed (non-fatal)"
