#!/usr/bin/env bash
# QA: run every test suite (pytest + coverage, CLI black-box, Playwright E2E) and print a summary.
# Usage: bash scripts/test_all.sh            (env: SS_DATA_DIR, PY=<python>, SKIP_E2E=1)
# Does not stop on the first failing suite; exit code = number of failing suites.
set -u
cd "$(dirname "$0")/.."
ROOT=$(pwd)
export SS_DATA_DIR="${SS_DATA_DIR:-D:/Lomba/Hackathon/nasa/second-sight-data}"
OUT="${QA_OUT:-$SS_DATA_DIR/qa/logs}"
mkdir -p "$OUT"
export COVERAGE_FILE="$OUT/.coverage"

if [ -z "${PY:-}" ]; then
  for c in .venv/Scripts/python .venv/bin/python ../../../.venv/Scripts/python python3 python; do
    if [ -x "$c" ] || command -v "$c" >/dev/null 2>&1; then PY="$c"; break; fi
  done
fi
echo "python: $PY  data: $SS_DATA_DIR  commit: $(git rev-parse --short HEAD 2>/dev/null)"
"$PY" -c "import pytest_cov" 2>/dev/null || "$PY" -m pip install -q pytest-cov

declare -A RES
fails=0
ESC=$(printf '\033')

summ() { # file -> "passed failed skipped"
  sed "s/${ESC}\[[0-9;]*[A-Za-z]//g" "$1" | grep -E "[0-9]+ (passed|failed|skipped)" | tail -3 | tr '\n' ' ' | awk '{
    p=0; f=0; s=0
    for (i=2;i<=NF;i++) { w=$i; gsub(/[^a-z]/,"",w); n=$(i-1)+0
      if (w=="passed") p=n; else if (w=="failed"||w=="error"||w=="errors") f+=n; else if (w=="skipped"||w=="xfailed") s+=n }
    printf "%d %d %d", p, f, s }'
}

echo "== 1/3 pytest (unit + white-box) with coverage =="
"$PY" -m pytest -q -p no:cacheprovider tests --ignore=tests/blackbox/test_cli.py --ignore=tests/e2e \
  --cov=pipeline --cov=api --cov=eval --cov-report=term --cov-report=json:"$OUT/coverage.json" \
  > "$OUT/pytest.txt" 2>&1 || fails=$((fails+1))
tail -n 3 "$OUT/pytest.txt"; RES[pytest]=$(summ "$OUT/pytest.txt")
grep -E "^TOTAL" "$OUT/pytest.txt"

echo "== 2/3 CLI black-box =="
"$PY" -m pytest -q -p no:cacheprovider tests/blackbox/test_cli.py -rf > "$OUT/cli.txt" 2>&1 || fails=$((fails+1))
grep -E "^FAILED" "$OUT/cli.txt"; tail -n 1 "$OUT/cli.txt"; RES[cli]=$(summ "$OUT/cli.txt")

echo "== 3/3 Playwright E2E =="
if [ "${SKIP_E2E:-0}" = "1" ]; then
  RES[e2e]="0 0 all"; echo "skipped (SKIP_E2E=1)"
else
  ( cd app && { [ -d node_modules ] || npm ci --no-audit --no-fund; } && npm run build ) > "$OUT/build.txt" 2>&1 || { echo "app build FAILED"; fails=$((fails+1)); }
  ( cd tests/e2e && { [ -d node_modules ] || npm install --no-audit --no-fund; } && npx playwright install chromium >/dev/null 2>&1; npx playwright test --reporter=line ) > "$OUT/e2e.txt" 2>&1 || fails=$((fails+1))
  RES[e2e]=$(summ "$OUT/e2e.txt")
  grep -E "^\s+[0-9]+\) " "$OUT/e2e.txt" | head -20
fi

echo
echo "================ SUMMARY ================"
printf "%-10s %8s %8s %8s\n" suite passed failed skipped
for s in pytest cli e2e; do read -r p f k <<<"${RES[$s]}"; printf "%-10s %8s %8s %8s\n" "$s" "$p" "$f" "$k"; done
echo "logs: $OUT   screenshots: $SS_DATA_DIR/qa/screenshots"
exit $fails
