# Project 4: the integrated build (plan and data contract)

The team's fourth parallel build, made to be **compared** with KalenderApi v1.0, KalenderApi v1.1 and Second Sight
(see `COMPARISON.md`). It is built from snapshots and never writes into the other three.

## Sources (snapshots, 14 November 2026)

| Here | From | Licence |
|---|---|---|
| `app/` | KalenderApi v1.0, `kalenderapi/app` commit `5c9b5cc` (itself a Fire Harmony fork) | Apache-2.0 (Fire Harmony) + team code |
| `vendor/second-sight/` | github.com/Inforable/nasa-challenge-benchmark commit `9fff725` | MIT (Second Sight team) |
| `pipeline/visibility/` | KalenderApi v1.0 `kalenderapi/scripts/build_season.py`, `build_visibility.py` | team code |

Read-only references (never edit): `../kalenderapi/`, `../kalenderapi-v1.1/` (its `src/pages/Calendar.tsx`,
`src/pages/Zero.tsx`, `pipeline/kapi/`), `../ref-competitors/`.

## Thesis

The satellite fire record tells two lies. **The jump:** the switch from MODIS to VIIRS in 2012 makes fire look like it
rose. **The blind zero:** where cloud hid the ground, "no fire detected" is not a measurement. Second Sight fixes the
jump with its own validated harmonization. KalenderApi shows the blind zero. Both use the same unit: a fire
**cell-day on a 0.01 degree grid**.

Demo order: the jump -> the fix -> the zero -> (the proof: the hidden-fire test, which belongs to v1.1 and is not run here).

## Units and scales

- **Indonesia record:** Second Sight's harmonized fire cell-days on the Aqua-MODIS-equivalent scale (`H`, `H_lo`,
  `H_hi`). This is the main record of project 4.
- **Visibility:** NASA MODIS MOD14A1 (Terra) and MYD14A1 (Aqua) C6.1 FireMask per 0.01 degree cell-day, states F, T,
  U, N exactly as `pipeline/visibility/build_visibility.py` defines them (rule text in its output file).
- **Monthly observability** per AOI-month, with Second Sight's own pre-written rule TRI-04
  (`vendor/second-sight/pipeline/physics/observability.py`): `f_cloud = U / (T + U)`,
  `f_missing = N / (F + T + U + N)`, `O = (1 - f_cloud) * (1 - f_missing)`, `obs_class` = good if O >= 0.6, partial if
  O >= 0.3, else unobserved. Use their function, do not re-implement thresholds.
- **Fire Harmony's NOAA-20 VIIRS hotspot scale** appears only in the global explorer, labelled
  "Global context (Fire Harmony)". Every chart says its unit.

## Data contract

`app/public/ss-data/` (written by the data work, read by the app):

- The Second Sight bundle exactly as `python -m pipeline.export.bundle` writes it: `index.json` and
  `monthly_<aoi_id>.json` (schema: `vendor/second-sight/pipeline/export/README.md`, "Bundle layout").
- `validation_results.json` and `finding.json` from Second Sight's validation and finding runs.
- For `prov-kalimantan-tengah`, months with FireMask visibility get `obs_class` filled and these added fields:
  `f_cloud`, `f_missing`, `O` (numbers), `obs_source: "firemask-terra-aqua"`. Every other month keeps `obs_class: null`.
  `index.json` gets `obs_months: {"prov-kalimantan-tengah": ["2015-08", ...]}` so the app can tell "not computed"
  from "unobserved".
- `index.json` is written **last**. Its presence means the bundle is complete.

`app/public/ka-data/` (v1.0 files are kept as they are), plus for each new season year Y (2015, 2023):
`kalteng_Y_season.json`, `visibility_kalteng_Y.json`, `visY/<date>.png`, same formats as the 2019 files.

## Pre-registration hygiene (v1.1)

v1.1's `PREREGISTRATION.md` registers Pulang Pisau, 1 August to 31 October 2019 (and 1 January to 31 March 2019 in its
section 5.5). Project 4:

- computes **no new statistic** for Central Kalimantan or Pulang Pisau between 1 January and 31 October 2019. The 2019
  monthly observability for August to October is aggregated from the v1.0 file that already exists (disclosed in
  v1.1 section 9), and nothing else for 2019;
- does **not** run a hidden-fire estimate or a re-appearance test (v1.1's H2 and H4) on any period;
- notes that Second Sight's leave-one-year-out results (related to v1.1's H3) were already public in its repository.

## Who does what

| Work | Owns (writes only here) |
|---|---|
| Data | `pipeline/`, `scripts/`, `vendor/second-sight/` (minimal patches, each listed in `docs/DATA.md`), `app/public/ss-data/`, new files in `app/public/ka-data/`, `docs/DATA.md`, `.venv/`, `data-raw/` |
| App | `app/src/`, `app/index.html`, `app/package.json`, `app/package-lock.json`, `docs/APP.md` |
| Integrator | `README.md`, `COMPARISON.md`, `INTEGRATION.md`, `AI_USE.md`, `app/NOTICE.md`, `app/README.md` |

Both data and app list every change they make (data: `docs/DATA.md`; app: `docs/APP.md`, one line per file, in the
style of `app/NOTICE.md`) so the integrator can update the NOTICE. Commit to this folder's git only. Never push.

## App plan

1. `#/record`, "Indonesia record", the new main page. AOI picker from `ss-data/index.json` (Central Kalimantan first,
   then Indonesia, the regions and the featured provinces). Sections:
   - **Before and after:** raw spliced vs harmonized (with the 90% band) vs "added together (wrong)", with the same
     definitions as `vendor/second-sight/app/src/beforeafter.ts`.
   - **Calendar:** years x months, colour = `H`, Raw / Harmonized toggle, hatching for `obs_class` partial and
     unobserved, and a separate mark for "not computed" (never drawn as unobserved). Patterns from
     `vendor/second-sight/app/src/calendar.ts` and v1.1 `src/pages/Calendar.tsx`.
   - **How sure:** the PASS / FAIL list from `validation_results.json`, failures included
     (`vendor/second-sight/app/src/yakin.ts`).
   - **This month:** one sentence for the chosen month (`vendor/second-sight/app/src/bulan.ts`).
   - For Central Kalimantan: links to Play the season for each season year that exists.
2. `#/story`: the jump and the fix as the first beats (numbers from the bundle), then the existing zero beats.
3. `#/season?y=2015|2019|2023`: reads the per-year files when they exist.
4. Header: "Indonesia record" first; the Fire Harmony explorer labelled "Global context (Fire Harmony)".
5. Every chart has a unit line and a source line, and states for loading, error and "not built yet". **Never** show
   Second Sight's synthetic `demo_monthly.json` or any invented number.
6. `npm run build` passes; checked at 1440 and 390 px, dark and light.

## Data plan

1. `.venv` in this folder; install `vendor/second-sight/requirements*.txt` as needed. `SS_DATA_DIR=data-raw/ss`
   (absolute path, outside git).
2. Run Second Sight's pipeline as its README says (ingest FIRMS country archives, cells, aggregate, tests, validation,
   finding, export). Record the bootstrap count used, the run times and row counts.
3. Season files and FireMask visibility for Central Kalimantan, 1 August to 31 October of 2015 and 2023 (the v1.0
   scripts, made to take the year as an argument). The VIIRS hotspots come from the FIRMS archive the pipeline has
   already downloaded. 2019 is not rerun.
4. Monthly observability for Central Kalimantan (August to October of 2015, 2019 and 2023), written into the bundle as
   above, then `index.json` last.
5. `docs/DATA.md`: commands, versions, row counts, checksums, run times, every patch to vendor code, and what failed.
