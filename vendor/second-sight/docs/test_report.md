# Second Sight: QA test report

- **Date/time:** Sat 14 Nov 2026. Run 1 at 09:32 WIB. Full run 2 (all 3 suites) at 09:37-09:39 WIB on `17a206b`. Quick run 3 (pytest + CLI, no E2E because there was no time) at 09:44-09:45 WIB on `65baa5b`
- **Commit tested:** `65baa5b` (final; branch `worktree-agent-ab49d31e714df52ce`, merged with `origin/main` at 09:44 WIB). The E2E numbers come from `17a206b`; `app/` was not re-tested after the last merge
- **Environment:** Windows 11, Git Bash, Python 3.12.10 (fresh venv from `requirements.txt` + `h5py`, `pytest-cov`; resolves to pandas 3.1.1, duckdb 2.0.0), Node 22.23.4, Vite 7 production build served by `vite preview`, Playwright 1.56.1 with Chromium
- **Data:** real derived data in `$SS_DATA_DIR = D:/Lomba/Hackathon/nasa/second-sight-data` (`derived/`, `bundle/`). No raw data was downloaded again.
- **How to reproduce:** `bash scripts/test_all.sh` (logs in `$SS_DATA_DIR/qa/logs/`, screenshots in `$SS_DATA_DIR/qa/screenshots/`)

## 1. Results

| Suite | Passed | Failed | Skipped / xfail |
|---|---:|---:|---:|
| pytest: team unit tests + QA white-box (`tests/`, minus `tests/blackbox/test_cli.py`), run 3 @ `65baa5b` | 179 | 4 | 1 xfail |
| CLI black-box (`tests/blackbox/test_cli.py`), run 3 @ `65baa5b` | 18 | 2 | 0 |
| Web E2E, Playwright (`tests/e2e/app.spec.ts`), run 2 @ `17a206b` | 16 | 0 | 1 (fixme FE-05) |

Run 2 @ `17a206b`: pytest 146 passed / 2 failed / 1 xfail. Run 3 counts the QA bundle test as passing: it failed once in run 3 because the bundle now includes 2026 NRT months, and after the test was changed to skip `flag_nrt` months it passes. Coverage total: 64 % (run 2), **66 %** (run 3, 4 986 statements, new `agent/` package included).

Failing tests and what they mean:

| Test | Cause | Bug |
|---|---|---|
| `tests/agent/test_eval.py::test_eval_rule_planner` (new in run 3) | rule planner accuracy 0.78 < 0.90 threshold | B9 |
| `tests/agent/test_tools.py::test_resolve_alias_and_typo` (new in run 3) | alias resolves to `prov-sumatera-selatan`, test expects `region-sumatra` | B9 |
| `tests/science/test_baseline_enso.py::test_parse_and_classify` | `iod_class` is `NaN` instead of `None` under pandas 3 | B3 |
| `tests/support/test_dat11_climate.py::test_read_tif_bytes_nodata` | `PIL` is not installed; Pillow is missing from every requirements file | B4 |
| `tests/blackbox/test_cli.py::test_pipeline_sh_help` | `scripts/pipeline.sh` is checked out with CRLF, so `set -o pipefail\r` fails | B2 |
| `tests/blackbox/test_cli.py::test_bundle_data_version_consistent` | `bundle/csv/detections_sample_riau_2019w36.csv` carries an older `data_version` than `bundle/index.json` | B5 |
| `tests/blackbox/test_invariants_real.py::test_national_equals_sum_of_provinces_and_labels_joined` (xfail) | province, regency, KHG and peat labels are NULL in real `daily_cell` | B1 |
| `tests/e2e/app.spec.ts` FE-05 five cell states (fixme) | cannot be checked on synthetic data; waits for FE-06 real data | B6 |

## 2. Coverage per module (pytest-cov, line coverage; module values from run 1, total from final run)

The total is **64 %** in both runs (final run: 3 868 statements, 1 396 missed). The `run.py` / `validate_all.py` drivers and the download scripts are run against real data, not by unit tests, which explains most of the gap.

| Module | Cover | Module | Cover |
|---|---:|---|---:|
| api/brief/__init__ | 100 % | pipeline/physics/diurnal | 98 % |
| api/brief/__main__ | 80 % | pipeline/physics/frp_floor | 100 % |
| api/brief/facts | 99 % | pipeline/physics/observability | 100 % |
| api/brief/fmt | 94 % | pipeline/physics/overpass | 95 % |
| api/brief/llm | 91 % | pipeline/physics/triangulate | 99 % |
| api/brief/render | 98 % | pipeline/physics/run | 0 % |
| api/brief/rules | 98 % | pipeline/science/baseline | 89 % |
| api/brief/verify | 92 % | pipeline/science/calibrate | 84 % |
| eval/brief_eval | 0 % (CLI run in black-box) | pipeline/science/chain | 96 % |
| pipeline/data/aggregate | 52 % | pipeline/science/common | 86 % |
| pipeline/data/cells | 52 % | pipeline/science/dynamic | 97 % |
| pipeline/data/clean | 66 % | pipeline/science/enso | 76 % |
| pipeline/data/config | 64 % | pipeline/science/peat | 95 % |
| pipeline/data/grid | 100 % | pipeline/science/series | 99 % |
| pipeline/data/ingest | 0 % (download) | pipeline/science/validate | 97 % |
| pipeline/data/manifest | 0 % | pipeline/science/run | 0 % |
| pipeline/data/nrt | 24 % | pipeline/support/_common | 37 % |
| pipeline/data/static_mask | 40 % | pipeline/support/boundaries | 67 % |
| pipeline/decision/alert_calendar | 100 % | pipeline/support/climate | 57 % |
| pipeline/decision/backtest | 100 % | pipeline/support/cloud | 65 % |
| pipeline/decision/priority | 100 % | pipeline/support/data_health | 77 % |
| pipeline/decision/run | 0 % | pipeline/support/peat | 65 % |
| pipeline/export/bundle | 72 % | pipeline/run/extras | 35 % |
| pipeline/export/csv_export | 78 % | pipeline/run/validate_all | 0 % |

The CLI black-box tests run in subprocesses, so they exercise `pipeline.data.aggregate`, `pipeline.export.*`, `api.brief.__main__` and `eval/brief_eval.py` without adding to these numbers.

## 3. Bugs found

| ID | Severity | Where | Problem | Repro |
|---|---|---|---|---|
| B1 | **High** (partly fixed in run 2) | `pipeline/data/cells.py:48-50`, `pipeline/data/labels.py` (new, merged 09:36), real `derived/*.parquet` | Run 1: `province`, `regency`, `khg_id` and `is_peat` were NULL for all 4 203 025 cell-days in `daily_cell.parquet`. After the merge of `pipeline/data/labels.py`, the labels exist only in the **separate** `daily_cell_labeled.parquet` / `monthly_*_labeled.parquet`: province 99.7 %, 34 provinces, and the national total equals the sum of provinces (✅ test passes). The canonical `daily_cell.parquet`, `monthly_stratum.parquet` and the bundle are still unlabelled, and **`khg_id` is NULL everywhere** (0 cells). So KHG ranking (DEC-01) and the app preset "KHG Sebangau" still have no real data. | `select count(khg_id) from 'derived/daily_cell_labeled.parquet'` gives 0 |
| B2 | Medium | `scripts/pipeline.sh` (no `.gitattributes` in the repo) | With Windows `core.autocrlf` the script is checked out with CRLF. `bash scripts/pipeline.sh help` exits 2 with `set: pipefail\r: invalid option name`, so the documented Make-free entry point fails on every Windows clone. Fix: add `*.sh text eol=lf` to `.gitattributes`. The same applies to `scripts/test_all.sh`. | `bash scripts/pipeline.sh help; echo $?` gives 2 |
| B3 | Medium | `pipeline/science/enso.py:81,85` (and the consumer at `:111`) | `out.loc[mask, col] = None` stores `NaN` on pandas 3.x, which `requirements.txt` (`pandas>=2.2`, no upper pin) installs today. Years with an incomplete season get `iod_class`/`enso_class = NaN` instead of `None`. At `:111` the check `cls is not None` then treats NaN as a real class, so the analog rank is computed against an empty peer set. Fix: pin `pandas<3` or use `.astype(object)` / `.where(..., None)`. | fresh venv, then `pytest tests/science/test_baseline_enso.py::test_parse_and_classify` |
| B4 | Low | `pipeline/support/climate.py:59`, `requirements*.txt` | `read_chirps_tif` imports `PIL`, but Pillow is not in any requirements file, so a clean install fails DAT-11 GeoTIFF reading and its test. | fresh venv, then `pytest tests/support/test_dat11_climate.py` |
| B5 | Low | `bundle/csv/detections_sample_riau_2019w36.csv` vs `bundle/index.json` (EXP-01/02) | The sample detection CSV was not regenerated with the bundle. Its header says `data_version 7f03b336…` while `index.json` and the monthly CSVs say `f2849b7b…`, which breaks the provenance promise of the CSV header. | `grep data_version bundle/csv/*.csv bundle/index.json` |
| B6 | **High (demo)** | `app/src/data.ts:40` (`loadMonthly(name = 'demo_monthly')`), `app/src/main.ts:163` | The app still loads only the synthetic `demo_monthly.json` ("Belum ada data satelit dimuat"). The real bundle exists but FE-06 is not wired, so every number on screen is synthetic. The data is correctly labelled "Data contoh". | open the app: the badge "Data contoh" is shown and the header says no satellite data is loaded |
| B7 | Low | `app/src/map.ts` (initial view), `app/src/main.ts` layout for tab `peta` | (a) In the calendar view the side-panel mini map shows mostly grey sea with a sliver of land rather than the selected AOI framed. (b) On the **Peta** tab the preset list spans the full width and pushes the map below the fold at 1366×850. The map has no fire/data layer yet, only the basemap (FE-02 scope). | screenshots `desktop-light-kalender.png`, `desktop-light-peta.png` |
| B9 | Medium | `tests/agent/test_eval.py`, `tests/agent/test_tools.py` (team package `agent/`, merged 09:44) | The newly merged agent package fails its own tests on `main`. The planner eval scores 0.78 against a 0.90 target, and an alias/typo for Sumatra resolves to the province `prov-sumatera-selatan` instead of `region-sumatra`. | `python -m pytest tests/agent -q` |
| B8 | Info | `pipeline/science/__init__.py:3` vs `pipeline/data` output | Schema mismatch between packages. `pipeline.data` writes `monthly_stratum` with `month` (date), `peat`, `n_cells`; `pipeline.science` expects `year`, `month` (int), `is_peat`, `cell_days`. The QA white-box tests use an adapter (`to_science_schema`). The `science/run.py` driver handles this, but nothing in the public API documents it. | compare `derived/monthly_stratum.parquet` columns with the science docstring |

No secrets were found in any bundle JSON/CSV, brief output or detection CSV (regex scan for MAP_KEY, API keys, bearer tokens and 32-hex keys).

## 4. Acceptance-criteria spot checks (tickets marked ✅)

| Ticket | Criterion | Result | Evidence |
|---|---|---|---|
| DAT-08 | No duplicate keys in daily_cell | ✅ pass | 4 203 025 rows, unique `(local_date, cell_id, satellite, daynight)` (`test_daily_cell_no_duplicate_keys`) |
| DAT-08/09 | monthly_stratum conserves daily_cell | ✅ pass | per-satellite `n_cells` sum equals daily_cell rows; `aggregate` CLI re-run on a copy gives `conservation.ok = true` |
| DAT-09 | National total = sum of **provinces** | ✅ on labelled files only | `monthly_province_labeled.parquet` Σ provinces = national per satellite (`test_national_equals_sum_of_provinces_labeled`); the canonical `daily_cell.parquet` is still unlabelled (xfail, B1). The bundle national total also equals the sum of the 5 island regions (`test_bundle_national_equals_sum_of_regions`) |
| DAT-09 | grid 0.05° file size recorded | ✅ pass | bundle export reports `grid_max_bytes` < 5 MB |
| CAL-01 | κ ∈ (0,1) | ✅ pass | all strata in `derived/strata_factors.json` lie in (0,1) with lo ≤ κ ≤ hi. A refit on real monthly_stratum also gives κ ∈ (0,1) |
| CAL-04 | Era boundaries | ✅ pass | `series_H_national.parquet`: Terra up to 2002-06, Aqua 2002-07 to 2021-12, SNPP from 2022-01; H_lo ≤ H ≤ H_hi; in the Aqua era H equals raw Aqua |
| AI-05 | Verifier: 0 untraceable numbers | ✅ pass | 3 formats × 2 locales × every Aug-Oct Kalimantan month 2003-2025 built from real bundle values; `eval/brief_eval.py` runs with exit 0 |
| EXP-02 | CSV header comments + `evidence_id` column | ✅ pass (B5 aside) | data_version, citation, license, filters, ai_acknowledgement present; monthly CSVs have `evidence_id` |
| FE-03 | URL state + shortcuts | ✅ pass | hash keeps tab, aoi, m, lang after reload; keys 1-7 switch tabs |
| FE-04 | 26×12 grid, full keyboard navigation, "DATA CONTOH" | ✅ pass | 312 cells 2001-01 to 2026-12; arrows, Home/End and Enter work with a roving tabindex; the badge shows; re-render < 500 ms |
| FE-02 | OSM attribution | ✅ pass | `.maplibregl-ctrl-attrib` contains "OpenStreetMap" |
| FE-01 | 7 tabs, no console errors | ✅ pass | |

## 5. UI anti-slop checklist (docs/10 §7), from screenshots

Screenshots are in `$SS_DATA_DIR/qa/screenshots/`: `desktop-{light,dark}-kalender.png`, `desktop-light-peta.png`, `mobile-{light,dark}-kalender.png`, `mobile-light-peta.png`.

| Item | Observation |
|---|---|
| First page = real-data calendar | ⚠️ The calendar is the first page, but its data is synthetic (B6) |
| Navigation ≤ 7 items, no onboarding | ✅ 7 tabs, no tour |
| No empty panels waiting for login / no API status | ✅ 5 tabs (Bulan ini, Lab, Seberapa yakin, Unduh, Metode) show only a "coming soon" note. They are not login walls, but they are near-empty panels |
| No gradients/glow/glass | ✅ flat panels, one light border, no glow |
| No purple/indigo; UI accent ≠ fire colour | ⚠️ The UI accent is dark blue, which is fine. The fire data ramp ends in dark purple (magma/inferno style) for the highest values. That is a sequential data ramp, not an accent, but a reviewer may read it as "purple" |
| Fonts | ✅ Plus Jakarta Sans + Source Sans 3 (E2E asserts no Inter/IBM Plex/Space Grotesk/JetBrains Mono) |
| No ALL-CAPS eyebrows, "→" buttons, 01/02/03 | ✅ none seen |
| Not everything a card / no card-in-card | ✅ two panels (aside, main), no nesting |
| Emoji / icon set | ✅ no emoji |
| Chart: title = finding, unit, source, legend | ✅ headline sentence ("…2015 adalah tahun terparah…"), unit line, source line, direct legend; ✅ Total + Peringkat columns |
| Zero / unobserved / provisional distinct | ✅ legend shows "Nol" (light grey), "Teramati sebagian" (hatched orange), "Tidak teramati" (grey hatch), "Sementara (NRT)" (dashed yellow), "Di atas persentil 90" (outline). ⚠️ The "Ada aktivitas" legend swatch is one red that does not match the multi-hue ramp |
| Numbers with units/context | ✅ "275 dari 311 sel-bulan teramati baik (88,4%)", Indonesian format (1.011, 1.248, 88,4%) |
| Copy: no "Unlock insights"/"Powered by AI" | ✅ |
| ID/EN parity | ✅ labels, months and number formats switch (E2E) |
| No NASA logo | ✅ (E2E) |
| OSM attribution | ✅ (E2E) |
| Mobile 375 px | ✅ no page-level horizontal scroll. ⚠️ The tab bar is cut off ("Seberapa ya…") and scrolls sideways. The calendar scrolls inside its panel and only Jan-Apr are visible, with no visible hint that more columns exist. ⚠️ The ID/EN toggle sits next to the brand rather than right-aligned |
| Dark theme | rendered: `desktop-dark-kalender.png` / `mobile-dark-kalender.png` |

## 6. QA assets added

- `tests/blackbox/test_invariants_real.py`: white-box invariants on real data (duplicates, conservation, national = Σ regions, era boundaries, κ ∈ (0,1), harmonized series on real data, brief verifier on real months, province labels as xfail).
- `tests/blackbox/test_cli.py`: black-box CLIs: `scripts/pipeline.sh`, `python -m api.brief` (id/en, md/html/wa, bad args), `pipeline.data.aggregate` on a copy, `pipeline.export.bundle --out tmp`, `pipeline.export.csv_export detections`, `eval/brief_eval.py`, bundle schema/CSV headers/data_version/secrets.
- `tests/e2e/` (Playwright, own `package.json`): shell, tabs, i18n, calendar grid + keyboard + render time, demo badge, URL state, map + OSM attribution, no NASA logo, fonts, screenshots.
- `scripts/test_all.sh`: runs all three suites and prints a summary.
