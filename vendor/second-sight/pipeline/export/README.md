# pipeline/export (EXP-01, EXP-02)

Build outputs go to `$SS_DATA_DIR/bundle/` (default `D:/Lomba/Hackathon/nasa/second-sight-data/bundle/`), never into the repo.

```
python -m pipeline.export.bundle                       # EXP-01 static bundle
bash scripts/export.sh                                 # build + copy into app/public/data/
python -m pipeline.export.csv_export aggregate --aoi IDN            # EXP-02 aggregate CSV
python -m pipeline.export.csv_export detections --bbox 100 -1 102 1 \
       --start 2019-08-01 --end 2019-09-30 --out riau_2019.csv     # EXP-02 detection CSV
```

## Ignore rule for app/public/data (frontend owner: please add)

Generated bundle files copied by `scripts/export.sh` must not be committed. Add to `app/.gitignore`
(or the root `.gitignore`):

```
/public/data/*        # in app/.gitignore  (root form: app/public/data/*)
!/public/data/.gitkeep
```

`*.parquet` and `*.csv` are already ignored at the root, but the `monthly_*.json` and `index.json`
files are not, so the rule above is needed.

## Bundle layout

| File | Content |
|---|---|
| `index.json` | `data_version` (sha256 of `data_manifest.json`), `generated_at`, `calibration_window` [2012, 2021], `baseline_period` [2003, 2022], `harmonized` flag, AOI list with file names/sizes, grid file list |
| `monthly_<aoi_id>.json` | array of rows `{aoi_id, year, month, H, H_lo, H_hi, A_raw, T_raw, V_raw, N20_raw, sensor_used, baseline_median, pct_rank, obs_class, flag_nrt, flag_partial, agreement}` |
| `grid005/grid005_<year>.parquet` | monthly 0.05 deg grid for custom AOIs: `month` (1-12), `g_id`, `g_lat`, `g_lon` (cell centre), `satellite`, `n_cells` (fire cell-days), `sum_frp`; zstd, sorted by month/satellite/g_id |

AOIs now: `IDN` (national) and `region-sumatra`, `region-kalimantan`, `region-sulawesi`, `region-papua`,
`region-jnbm` (Jawa-Nusa Tenggara-Bali-Maluku), plus 34 provinces `prov-<slug>` (featured first: `prov-riau`,
`prov-kalimantan-tengah`, `prov-sumatera-selatan`, `prov-jambi`, `prov-kalimantan-barat`) from
`derived/monthly_province_labeled*.parquet`, harmonized with the parent island's kappa strata. Index AOI entries
carry `name_id`/`name_en`, `area_km2` (provinces, geoBoundaries ADM1, EPSG:6933), `provisional_months`, `partial_month`.

Raw columns: fire cell-days per satellite (`A`=Aqua, `T`=Terra, `V`=S-NPP, `N20`=NOAA-20).
`0` = sensor active, no fire; `null` = satellite outside its active window in the archive.
`flag_nrt` comes from `derived/*_2026nrt.parquet` (2026 rows replace the SP tail month; SP months are false).
`flag_partial` marks the current (incomplete) calendar month at export time (WIB).

### Harmonized fields

`H`, `H_lo`, `H_hi`, `sensor_used` come from `pipeline.science` (CAL-01 `fit_kappa`, CAL-03
`terra_to_aqua`/`noaa20_to_snpp`, CAL-04 `build_series`); `baseline_median` and `pct_rank` from ANO-01
(`compute_baseline`, `add_anomalies`: median per calendar month 2003-2022, percentile among earlier
years). `monthly_stratum` is mapped to the science schema by `to_science_schema` (season recomputed
from the calendar month with `SEASON_OF_MONTH`; `is_peat` = the `peat` label, currently `unknown`).
`H` is null where the era's sensor has no data in the archive. `obs_class` (TRI-04) and `agreement`
(TRI-03) are still null (listed in `index.json` `not_yet_filled`).

If `pipeline.science` is missing or the fit fails, all those fields are `null` and `index.json` has
`"harmonized": false` with a note. No harmonized value is ever produced inside `pipeline/export`.

The series ends at the last month in which at least two satellites report nationally (a lone
2026-01 SNPP month holding only UTC-31-Dec detections shifted to local 1 Jan is dropped).

## CSV (EXP-02, schema 08 §7.9.3)

Aggregate CSV: `#` comment header (app, data version, download date, filters, baseline, calibration
window, citation, license, AI acknowledgement), then the §7.9.3 columns plus `evidence_id`.
Columns not yet produced upstream are written empty: `kappa*`, `H_peat`, `H_mineral`, `H_day`,
`H_night`, `large_fire_index`, `anomaly_logratio`, `robust_z`, `enso_class`, `analog_rank`,
`analog_n`, `flag_missing_days`, `flag_high_cloud` (and `H*`, `baseline_median`, `pct_rank`,
`sensor_used` while `harmonized` is false). `flag_drift_era` = year >= 2022 (after the D-3
calibration window, Aqua drift era).

Detection CSV: cleaned detections (`derived/detections.parquet`) inside a lon/lat bbox and a
local-date range, same comment header.
