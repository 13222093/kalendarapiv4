# Project 4: data run (what was run, with what, and what came out)

Written by the data work of project 4 on 14 November 2026 (all times UTC). Everything below was measured on this
machine in this session; nothing is copied from another run. Paths are relative to the project 4 root.

## 1. Result in one table

| Item | Where | Status |
|---|---|---|
| Second Sight bundle (40 areas x 313 months, 2000-11 to 2026-11) | `app/public/ss-data/index.json`, `monthly_<aoi_id>.json`, `grid005/*.parquet` | built, `harmonized: true`; province series after 2021 use the one patch in 9.1 |
| Validation (94 entries, **1000 bootstrap resamples**) | `app/public/ss-data/validation_results.json` | 15 pass, 11 fail, 55 descriptive, 4 not applicable, 9 not run |
| Finding (n_boot 300, the script's own default) | `app/public/ss-data/finding.json` | built, marked PRELIMINARY by Second Sight |
| Central Kalimantan season files 2015, 2023 | `app/public/ka-data/kalteng_{2015,2023}_season.json` | built |
| Central Kalimantan visibility files 2015, 2023 | `app/public/ka-data/visibility_kalteng_{2015,2023}.json`, `vis2015/`, `vis2023/` (92 PNG each) | built |
| Monthly observability, `prov-kalimantan-tengah`, Aug-Oct 2015, 2019, 2023 | inside `monthly_prov-kalimantan-tengah.json`, listed in `index.json` `obs_months` | 9 months filled, all other months `obs_class: null` |
| 2019 season and visibility files | `app/public/ka-data/*2019*` | **not touched, not rerun** |
| **Added 15 November.** District records, 514 kabupaten/kota x 313 months | `app/public/ss-data/districts/` | built: a share-out of the province record, `approximate: true` (section 13) |
| **Added 15 November.** Season and visibility files, Aug to Oct 2014, 2016, 2017, 2018, 2020, 2021, 2022, 2024, 2026 and Jan to Mar 2023 | `app/public/ka-data/kalteng_<Y>_season.json`, `visibility_kalteng_<Y>.json`, `vis<Y>/`; the wet quarter as `kalteng_2023_janmar_season.json`, `visibility_kalteng_2023_janmar.json`, `vis2023janmar/` | built; 2026 is provisional (near-real-time points, FireMask incomplete after 15 October); **2025 not built**, no FireMask in the catalogue (section 14) |
| **Added 15 November.** District-days with no cloud-free look, 11 Aug to Oct seasons and the wet quarter, 2019 left out | `app/public/ka-data/blind_rule_kalteng.json` | built (section 14.5) |
| **Added 15 November.** Monthly observability, 23 more months | `monthly_prov-kalimantan-tengah.json`, `index.json` `obs_months` (32 months) | built; 2019 rows copied as published, not recomputed (section 14.4) |

`index.json` was written last (after every other file in `ss-data`). Its absence means an unfinished bundle.

## 2. Environment

- Windows 11, Git Bash for the shell scripts, Python 3.12.8 in `.venv/` (gitignored).
- `.venv` packages (pip freeze, the ones that matter): pandas 3.1.1, numpy 2.5.4, duckdb 2.0.0, pyarrow 26.0.1,
  scipy 1.18.1, statsmodels 0.15.0, ruptures 1.1.10, pymannkendall 1.4.3, shapely 2.2.0, requests 2.34.2,
  h5py 3.16.0, Pillow 13.0.0, pytest 9.2.0.
- Installed from `vendor/second-sight/requirements.txt` and `requirements-support.txt`. `requirements-agent.txt`
  (optional `anthropic` and `openai` clients) was not installed; `-brief`, `-physics` and `-science` only repeat packages
  that are already in the two files above.
- **Added by this run, not in Second Sight's requirements**: `tifffile 2026.11.12` (reads the MODIS FireMask GeoTIFFs in
  `build_visibility.py`), `geopandas 1.2.0` with `pyogrio 0.13.0` and `pyproj 3.8.0` (only to fill `area_km2` for the
  34 provinces in `index.json`; `bundle.province_areas()` silently returns `{}` without it).
- `SS_DATA_DIR` = absolute path of `data-raw/ss` (gitignored). Set inside `scripts/run_ss_stage2.sh` and
  `scripts/run_ss_stage3.sh`.
- Network access used, all public, no login or account: `firms.modaps.eosdis.nasa.gov` (country archive),
  `data.source.coop` (the CC0 FIRMS mirror, for 2026), `www.geoboundaries.org` + github raw (boundaries),
  `gis-gfw.wri.org` (peat polygons), `cpc.ncep.noaa.gov` + `psl.noaa.gov` (ONI and DMI, fetched by `validate_all`),
  `planetarycomputer.microsoft.com` (MODIS FireMask), the DuckDB extension host (httpfs, spatial).

## 3. Commands, in the order they ran

Second Sight code is `vendor/second-sight` (snapshot of `Inforable/nasa-challenge-benchmark` at `9fff725`), run from
that folder with the project 4 venv.

| # | Command | Time | Log (`data-raw/ss/logs/` unless noted) |
|---|---|---|---|
| 1 | `python -m venv .venv`; `pip install -r requirements.txt -r requirements-support.txt`; `pip install tifffile` | not timed | |
| 2 | `python -m pipeline.data.ingest` (everything: MODIS 2000-2025, S-NPP 2012-2025, NOAA-20 2018-2025, NOAA-21 2024-2025) | **5 min 37 s** (06:28:07 to 06:33:44) | `data-raw/ss/ingest.log` |
| 3 | `python -m pipeline.support.boundaries` (ADM1 + ADM2 gbHumanitarian), `python -m pipeline.support.peat` | 13.7 s + 36.4 s | `data-raw/ss/support_dl.log` |
| 4 | `python -m pipeline.data.manifest` | 1 s | `manifest.log` |
| 5 | `python -m pipeline.data.clean` | 16 s | `clean.log` |
| 6 | `python -m pipeline.data.static_mask` | 3 s | `static_mask.log` |
| 7 | `python -m pipeline.data.cells` | 11 s | `cells.log` |
| 8 | `python -m pipeline.data.aggregate` | 2 s | `aggregate.log` |
| 9 | `python -m pipeline.data.labels` (peat, province, regency labels; needed for the 34 provinces) | 70 s | `labels.log` |
| 10 | `python -m pipeline.data.nrt` (2026 from the CC0 FIRMS mirror; `finding.py` needs it, and it gives the 2026 months) | 195 s | `nrt_2026.log` |
| 11 | `python -m pipeline.data.labels --input <derived>/daily_cell_2026nrt.parquet --suffix _2026nrt` | 39 s | `labels_2026nrt.log` |
| 12 | `python -m pipeline.data.manifest` again (final: now also lists the 2026 raw files; its sha256 is the bundle's `data_version`) | 2 s | `manifest_final.log` |
| 13 | `python -m pytest -q -rs tests` (results in 6.1) | 61 s (stage 3 run) | `pytest.log`, `pytest_with_bundle.log`, `pytest_final.log` |
| 14 | `python -m pipeline.run.validate_all --n-boot 1000` | **19 s** | `validate_all.log` |
| 15 | `python -m pipeline.run.finding` (n_boot 300) | 20 s | `finding.log` |
| 16 | `python -m pipeline.export.bundle` (run once more, 22 s, after installing geopandas) | 29 s | `bundle.log` |
| 17 | `python -m pipeline.export.csv_export aggregate --aoi IDN` (one unit test needs `bundle/csv/`; not copied to the app) | not timed | |
| 18 | `bash scripts/publish_ss_data.sh` (copies bundle + `validation_results.json` + `finding.json`, **without** `index.json`) | not timed | |
| 19 | `python pipeline/visibility/monthly_observability.py --bundle-src data-raw/ss/bundle --out app/public/ss-data --ka-data app/public/ka-data --report data-raw/obs_months.json` (writes the Kalteng monthly file, then `index.json` last) | not timed | |
| 20 | `python -I pipeline/visibility/build_season.py data-raw/ss/raw_csv/viirs-snpp/viirs-snpp_<Y>_Indonesia.csv app/public/ka-data/kalteng_<Y>_season.json <download_utc> <Y>` for Y = 2015, 2023 | 17.5 s, 3.7 s | |
| 21 | `python -I pipeline/visibility/build_visibility.py data-raw app/public/ka-data data-raw/geoboundaries/geoBoundaries-IDN-ADM2_simplified.geojson <Y>` for Y = 2015, 2023 (each downloads 48 FireMask files) | 2 min 02 s, 2 min 11 s | `data-raw/vis2015.log`, `data-raw/vis2023.log` |
| 22 | **After the user approved the province-kappa patch (9.1):** step 16 again (`python -m pipeline.export.bundle`), then steps 18 and 19 again, then step 13 again. The bundle, the nine observability rows and `index.json` published before the patch (commit `7843238`) were replaced. | 13 s (bundle), 37 s (tests) | `bundle_patched.log`, `pytest_patched.log` |

Steps 4 to 11 are `bash scripts/run_ss_stage2.sh` (5 min 37 s in total). Steps 12 to 16 are
`bash scripts/run_ss_stage3.sh`. From scratch: steps 1 to 3, then the two stage scripts, then 17 to 21.
The full national ingest was far below the 90 minute limit, so no scope was cut. The first `validate_all` run (23 s)
used the manifest from before the 2026 files existed; step 14 overwrote it, so that `data_manifest_sha256` in
`validation_results.json` and the bundle's `data_version` point to the same manifest.

**Bootstrap count: 1000** for validation (`--n-boot 1000` took 19 s, so there was no reason to use 300).
`finding.py` was run as Second Sight documents it (its own default, **n_boot = 300**, the same as its `docs/finding.md`).
The bundle export fits kappa with 1000 draws (`science_meta.kappa.n_boot` in `index.json`).

## 4. Inputs and checksums

### 4.1 FIRMS standard-processing country archive (48 files, 6,355,534 rows)

`pipeline.data.manifest` recorded, per file, the URL, download time, size, row count and sha256. The manifest itself
(`data-raw/ss/data_manifest.json`, generated 2026-11-14T06:40:40Z) has sha256
`de7fff88ca8c969a483ed6985e78085b073b0fa33950fb2eb962657dadd80661`, which is `data_version` in `index.json`.
URL pattern: `https://firms.modaps.eosdis.nasa.gov/data/country/{source}/{year}/{source}_{year}_Indonesia.csv`.

Rows by source: MODIS 1,533,411 (26 files, 2000 to 2025); VIIRS S-NPP 3,514,520 (14 files, 2012 to 2025);
VIIRS NOAA-20 1,307,603 (8 files, 2018 to 2025). The table of every file is in section 12.

The S-NPP 2019 file has sha256 `1dd309b8ae9dd74464f6fce4e0b61c261b7f39326c2dde3f029db55e22fe1a82`, 34,617,768 bytes,
437,281 rows: **identical** to the copy KalenderApi v1.0 used for `kalteng_2019_season.json`.

### 4.2 2026 raw files (CC0 FIRMS mirror, `data.source.coop/portolan-mirrors/firms-catalog`)

| source | rows | SP / NRT rows | dates | sha256 (first 16) |
|---|---:|---|---|---|
| MODIS (Terra + Aqua) | 155,115 | 8,707 SP / 146,408 NRT | 2026-01-01 to 2026-11-13 | `61817a77f821a6f3` |
| VIIRS NOAA-20 | 748,399 | 37,377 / 711,022 | 2026-01-01 to 2026-11-13 | `a2662ea3663c4af6` |
| VIIRS NOAA-21 | 729,703 | 0 / 729,703 | 2026-01-01 to 2026-11-13 | `116b5074b40cb064` |
| VIIRS S-NPP | 691,444 | 29,561 / 661,883 | 2026-01-01 to 2026-11-02 | `a372343a2958edf7` |

2026 months carry `flag_nrt: true` where the data are NRT; the current month (2026-11) also carries `flag_partial: true`.

### 4.3 Supporting layers (`data-raw/ss/support/`, each with a `.source.json` sidecar)

| File | Source | sha256 |
|---|---|---|
| `boundaries/geoBoundaries-IDN-ADM1-gbHumanitarian_simplified.geojson` (34 units, CC BY 3.0 IGO) | geoBoundaries API, gbHumanitarian, boundary id IDN-ADM1-30024224 | `6a92013432cb64c03915a84fe53281fcacadd2b66cf69d502d8259fd6d23fb3e` |
| `boundaries/geoBoundaries-IDN-ADM2-gbHumanitarian_simplified.geojson` (522 units) | same, IDN-ADM2-37775238 | `d5242d59f3805558bf50964ae14361e3470cefc5a82e4162b33b933dff9fe9e3` |
| `peat/gfw_indonesia_peat_lands.geojson` (1,524 polygons, 14,655,424 bytes) | GFW ArcGIS layer; licence **unverified**, as Second Sight states | in its `.source.json` |

For the Central Kalimantan districts (`build_visibility.py`): `data-raw/geoboundaries/geoBoundaries-IDN-ADM2_simplified.geojson`
(gbOpen ADM2, copied read-only from `../kalenderapi/data-raw/geoboundaries/`), sha256
`146653d488331086ddc43d159a261b01ea6dd08c7ed422e34a9886c3c690430c`, the same value recorded in the v1.0 2019 file.

### 4.4 MODIS FireMask (Microsoft Planetary Computer, collection `modis-14A1-061`)

48 Cloud Optimized GeoTIFFs per season year (MOD14A1 and MYD14A1, tiles h29v08 and h29v09, 12 eight-day periods each).
2015: 26,031,424 bytes, read 2026-11-14T06:34:41Z. 2023: 27,522,621 bytes, read 2026-11-14T06:36:53Z. The id, file name,
size and sha256 of every file are inside `visibility_kalteng_<Y>.json` under `source.firemask.items`.

### 4.5 Files this run wrote that the app reads (sha256)

(State of 14 November. On 15 November `index.json` and `monthly_prov-kalimantan-tengah.json` were rewritten with more
observability months; their new sha256 values are in section 14.4. The other six files are unchanged.)

| File | sha256 |
|---|---|
| `app/public/ss-data/index.json` | `6a389dc0b2f717fd5c5b6a53d6cdebb01756d2219928b963886ef043e3ad867a` |
| `app/public/ss-data/validation_results.json` | `b3b90902a33d1c2847b191a712c857bd30038ee7c0344a063fd52b8f15f4adaf` |
| `app/public/ss-data/finding.json` | `e07af24bd7fef585d248121e43c4d5a137320458c8b6ae346d6b1db03cb2df8c` |
| `app/public/ss-data/monthly_prov-kalimantan-tengah.json` | `f59de969d5f5642e449b7e72e63c87c1f122f79489ef6517fc241c8033dc22c4` |
| `app/public/ka-data/kalteng_2015_season.json` | `dad60b028d1f39a56944d5c7831c8ec67ee342f5da31fc36217a55bdccb724c9` |
| `app/public/ka-data/kalteng_2023_season.json` | `54faf709b974f25a76eb9d4dd5ccc421acbed82842227ad0986364b87710f0ac` |
| `app/public/ka-data/visibility_kalteng_2015.json` | `de0577686d88cbeb6135e9893a109202ceef4810827dba82d6ffa475bc26be68` |
| `app/public/ka-data/visibility_kalteng_2023.json` | `e8e4424a9a13a2e6cbb48fbbcd722110e7afbfb60223de217d0cad958dbe713b` |

## 5. Row counts through the Second Sight pipeline

| Stage | Rows | Note |
|---|---:|---|
| Raw FIRMS (SP) | 6,355,534 | equals Second Sight's own "6.36 M detections" |
| `detections` after clean | 5,598,962 (88.096%) | dropped: 357,858 non-vegetation type (5.631%), 398,714 low confidence (6.273%), 0 unknown satellite, 0 Terra before 2000-11 |
| `daily_cell` (fire cell-days, 0.01 degree) | 4,203,025 | Aqua 893,928 / Terra 402,483 / S-NPP 2,104,504 / NOAA-20 802,110; 0 duplicate keys |
| `monthly_stratum` | **7,731** | equals Second Sight's own "7,731 monthly stratum rows"; mass conservation passed (846 month-satellite groups, 0 mismatch) |
| `monthly_grid005` | 1,494,710 | |
| Labels | 612,442 cells | 99.31% have a peat label, 10.06% are on peat, 99.3% have a province and regency (the same numbers Second Sight reports) |
| 2026 `detections_2026nrt` | 1,917,116 | 9.665% of the raw 2026 rows fall outside the country clip; 3.072% of NRT rows are masked as static sources |
| 2026 `daily_cell_2026nrt` | 1,242,009 | `monthly_stratum_2026nrt` 537 rows; conservation passed for SP and NRT |
| 2026 labels | 266,350 cells | 98.28% labelled |

Bundle (`app/public/ss-data/`): 40 `monthly_*.json` files (IDN, 5 regions, 34 provinces), each 313 rows (2000-11 to 2026-11),
`index.json`, `validation_results.json` and `finding.json` (43 JSON files, 3,546,392 bytes) and `grid005/` with 27 yearly
Parquet files (10,693,349 bytes). The app does not read `grid005/`; the root `.gitignore` rule `*.parquet` keeps those files
out of git, and `bash scripts/publish_ss_data.sh` re-creates them.

## 6. Second Sight outputs

### 6.1 Unit tests (`python -m pytest -q -rs tests`)

| Run | Result |
|---|---|
| empty scratch data dir (probe, before any data) | 169 passed, 37 skipped, 72 s |
| real data, no bundle yet (two runs) | 180 passed, 25 skipped, 1 xfailed, 59 to 65 s |
| real data, bundle present, no CSV export | 192 passed, **1 failed**, 12 skipped, 1 xfailed, 75 s. The failure is `tests/blackbox/test_cli.py::test_bundle_csv_header_comments_and_columns`: it expects `bundle/csv/*.csv`, which only the separate EXP-02 export creates (step 17). Not a pipeline defect. |
| after step 17 | 193 passed, 12 skipped, 1 xfailed, 64 s |
| after the province-kappa patch, bundle re-exported (**final run**) | **193 passed, 12 skipped, 1 xfailed, 37 s** (no test touches the patched branch) |
| the 12 skipped (`tests/agent/*`) with `SECOND_SIGHT_BUNDLE=data-raw/ss/bundle` | 10 passed, **2 failed**: `test_eval_rule_planner` (plan accuracy 0.78 < 0.90) and `test_resolve_alias_and_typo` ("sumatera selatan" resolves to `prov-sumatera-selatan`, the test expects `region-sumatra`). These are the same two failures Second Sight lists as bug B9 in its own `docs/test_report.md`; the agent package is not used by project 4. Same result before and after the patch. |

Without that environment variable the agent tests look for the bundle in a hard-coded Second Sight location and skip.

### 6.2 Validation (`validation_results.json`, 1000 bootstrap resamples)

94 entries: 15 pass, 11 fail, 55 descriptive, 4 not applicable, 9 not run. These counts, and the values of every
decision test, are the same as the ones Second Sight reports in its README (for example LOYO median absolute error
7.23%, LORO Kalimantan 20.34%, seam 2012-01 -0.057, seam 2022-01 +0.365, sunset KGE 0.889, flag agreement F1 0.842 and
Cohen's kappa 0.829). Pooled national kappa 0.19296. Failures stay in the file.
`peat_joined` is false (the unlabelled `monthly_stratum.parquet` is the input), so V9 (peat hypotheses H1 to H3) is
`not_run`, as in Second Sight's main run. Also `not_run` by design in the runner: V4, V8, V11, V13, V14, V15, V16, V17.

### 6.3 Finding (`finding.json`, PRELIMINARY)

Second Sight's headline, recomputed here: splicing MODIS (to 2011) with S-NPP (from 2012) gives a national trend of
**+1,739.5 cell-days per year** (Theil-Sen, 2001-2025); the harmonized Aqua-equivalent series gives
**-1,614.0 per year**. August to October 2023 over 2015, national: raw 0.290, harmonized 0.307 (calibration bounds
0.290 to 0.321). Kalimantan, same comparison: raw 0.239, harmonized 0.283. 2026 is NRT (provisional); year-to-date
months are Jan to Oct.

### 6.4 Central Kalimantan in the bundle (`monthly_prov-kalimantan-tengah.json`, `area_km2` 154,166)

Sensor used by era: Terra x factor (2000-11 to 2002-06), Aqua native (2002-07 to 2021-12), S-NPP x kappa (2022-01 on),
NOAA-20 for 2026-11 only. August to October sums of the harmonized series `H` (fire cell-days, Aqua-equivalent scale;
bands are the 5th to 95th percentile of the kappa bootstrap, summed over the months as `H_lo` and `H_hi`):

| Season | H | H_lo to H_hi | Raw Aqua | Raw S-NPP | Sensor |
|---|---:|---|---:|---:|---|
| Aug-Oct 2015 | 18,302 | no interval (Aqua native) | 18,302 | 103,976 | Aqua |
| Aug-Oct 2023 | 3,830.4 | 3,632.8 to 3,962.7 | 4,139 | 17,494 | S-NPP x island kappa (after the patch in 9.1) |

Before the province-kappa patch the 2023 value was 3,375.6 with no interval (S-NPP x the pooled national ratio, see 8.1).
After it, the S-NPP-era `H / V_raw` of this province runs from 0.147 to 0.273 over the 58 months (stratified kappa).

## 7. FireMask products for Central Kalimantan (1 Aug to 31 Oct)

Same box and rule as v1.0 (`build_visibility.py`; the rule text is stored in each file). 14 districts, 0.01 degree cells.

| | 2015 | 2023 |
|---|---:|---:|
| VIIRS S-NPP rows in the archive file / kept in the box | 875,824 / 238,528 | 253,388 / 47,045 |
| days with zero hotspots | 0 | 0 |
| busiest day | 2015-10-14 (11,842) | 2023-10-02 (2,559) |
| re-appeared points (rule stored in the file) | 36,946 | 8,900 |
| land cells | 123,979 | 123,987 |
| season F / T / U / N (cell-days) | 115,619 / 10,649,847 / 619,833 / 20,769 | 22,039 / 10,578,507 / 788,625 / 17,633 |
| blind share U / (T + U) | 5.5% | 6.9% |
| daily blind share, median (q1 to q3) | 0.7% (0.1 to 4.9) | 1.7% (0.2 to 6.0) |
| no-data share | 0.2% | 0.2% |
| fire cell-days seen only by VIIRS | 61.2% | 55.9% |

The water rule is applied per season, so the land mask differs by a few cells between years (v1.0 2019: 124,000).
`kalteng_districts.json` is shared and was not rewritten (the script writes it only for 2019 or when it is missing).

### 7.1 Monthly observability, Aug to Oct (Second Sight rule TRI-04, its own `observability` and `obs_class` functions)

`f_cloud = U / (T + U)`, `f_missing = N / (F + T + U + N)`, `O = (1 - f_cloud)(1 - f_missing)`; good if O >= 0.6,
partial if O >= 0.3, else unobserved. F, T, U, N are sums of the daily totals in the visibility files. The 2019 rows are
aggregated from the existing v1.0 file only. For every year the three months add up to that file's season totals
(an assertion in the script checks it).

| Month | F | T | U | N | f_cloud | f_missing | O | obs_class |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| 2015-08 | 20,026 | 3,739,250 | 76,789 | 7,284 | 0.0201 | 0.0019 | 0.9780 | good |
| 2015-09 | 49,866 | 3,550,140 | 111,778 | 7,586 | 0.0305 | 0.0020 | 0.9675 | good |
| 2015-10 | 45,727 | 3,360,457 | 431,266 | 5,899 | 0.1137 | 0.0015 | 0.8849 | good |
| 2019-08 | 6,583 | 3,477,057 | 353,868 | 6,492 | 0.0924 | 0.0017 | 0.9061 | good |
| 2019-09 | 33,498 | 3,444,690 | 235,205 | 6,607 | 0.0639 | 0.0018 | 0.9344 | good |
| 2019-10 | 5,183 | 3,166,097 | 667,531 | 5,189 | 0.1741 | 0.0014 | 0.8248 | good |
| 2023-08 | 3,200 | 3,622,242 | 211,363 | 6,792 | 0.0551 | 0.0018 | 0.9432 | good |
| 2023-09 | 9,496 | 3,488,519 | 215,813 | 5,782 | 0.0583 | 0.0016 | 0.9403 | good |
| 2023-10 | 9,343 | 3,467,746 | 361,449 | 5,059 | 0.0944 | 0.0013 | 0.9044 | good |

All nine months are `good`. The monthly index is a coarse filter: it says the month was mostly observable, not that the
daily blind zeros are small (October 2019: 17.4% of the no-fire cell-days were blind). `partial` and `unobserved` do not
occur in these nine months, so the data has no example of them. The file stores 6 decimals; the class was taken from the
unrounded O.

## 8. Caveats in what was produced

1. **Province series after 2021 differ from what Second Sight's own export writes (patched, 9.1).** Second Sight's
   `bundle._science_adapter` gave the province table `is_peat` values `peat` and `mineral`, while kappa is fitted on the
   unlabelled table (`is_peat` = `unknown`, checked: 100% of province rows had no matching stratum). Unmatched rows fell
   back to the pooled national ratio with no interval: in the first export, `prov-kalimantan-tengah` had `H / V_raw`
   exactly 0.192959 in all 58 S-NPP-era months and `H_lo = H_hi = H`. The export's own comment and `index.json`
   (`province_kappa`) say provinces use the parent island strata. With the patch they do. The patched bundle therefore
   **no longer equals what the Second Sight repository would write**; anyone comparing with Second Sight's published
   province numbers after 2021 must expect this difference. What changed, checked against the first export (commit
   `7843238`) for all 34 provinces: the S-NPP-era (2022 on) `H`, `H_lo`, `H_hi` (every such row now has a band, 0 without);
   and `baseline_median` in the earlier rows (the 2003-2022 baseline window contains 2022, whose `H` changed). `H`,
   `H_lo`, `H_hi`, `pct_rank` and the raw columns of the Aqua- and Terra-era rows are identical to before, and the
   national and island files are identical to before.
2. `index.json` has one key that Second Sight's bundle does not write, `obs_source_note`, besides the requested
   `obs_months`. Its `not_yet_filled` still lists `obs_class` as Second Sight wrote it; `obs_months` says which months are filled.
3. `validation_results.json` is Second Sight's file with one change: `meta.data_dir` held this machine's absolute path, so
   the published copy has `data-raw/ss` there, plus a `data_dir_note`. Its `meta.commit` is the project 4 git HEAD at run
   time (`3edd9bc`), not the Second Sight commit `9fff725`, because `validate_all.git_commit()` asks git in the folder it
   runs from.
4. `monthly_prov-kalimantan-tengah.json`: the nine filled rows carry the extra fields `f_cloud`, `f_missing`, `O`,
   `obs_source` (`firemask-terra-aqua`); all other rows have none, and `obs_class` is `null` there. `null` means "not
   computed", never "unobserved".
5. `app/pipeline/build_season.py` (an older copy of the v1.0 script inside the app folder) was left as it is; the working
   copies are in `pipeline/visibility/`.
6. FireMask is a daily composite and thick smoke can be classed as cloud (rule text in each visibility file); a trusted
   zero is not proof that nothing burned.

## 9. Changes to code

### 9.1 Patches to `vendor/second-sight/`: **one, made on the user's request ("Yes, patch it")**

`vendor/second-sight/pipeline/export/bundle.py`, `_science_adapter`, province branch, 7 lines added after
`pms["province"] = pt["province"].to_numpy()` (four comment lines and three lines of code):

```python
fit_peat = kappa.table["is_peat"].unique() if "is_peat" in kappa.table else []
if len(fit_peat) == 1:
    pms["is_peat"] = fit_peat[0]
```

It gives the province table the single `is_peat` key the kappa fit used, so province rows match the island x season x
day/night strata and get the bootstrap band. Nothing else in `vendor/` was touched (`git diff --stat -- vendor`: one file,
7 insertions). It is a method change, not a change needed to make the code run, which is why it waited for approval;
see 8.1 for the effect. Every other Second Sight module ran unmodified on Python 3.12.8 with pandas 3.1.1 and numpy 2.5.4
(newer than the lower bounds in its requirements; the 193 tests and the full run showed no incompatibility).

### 9.2 Project-owned code (not vendor)

- `pipeline/visibility/build_season.py`, `build_visibility.py`: the year is an optional last argument (default 2019, same
  output). For 2019 the filter text, re-appear rule and URL are identical to the strings in the existing v1.0
  `kalteng_2019_season.json` (compared as strings; 2019 itself was not rerun). For other years `source.built_by` names this
  copy. `kalteng_districts.json` is written only for 2019 or when it is missing.
- `pipeline/visibility/monthly_observability.py` (new): section 7.1.
- `scripts/run_ss_stage2.sh`, `scripts/run_ss_stage3.sh`, `scripts/publish_ss_data.sh` (new): the commands of section 3.
  `scripts/.gitattributes` (new) keeps `*.sh` at LF on checkout (the repo has `core.autocrlf=true`, which would break bash).

## 10. What failed, was skipped, or was not done

- **NOAA-21 country archive 2024 and 2025: HTTP 404** (the pipeline treats it as optional). NOAA-21 appears only in the
  2026 mirror data.
- **MODIS CMG cloud files (`MOD14CMQ`/`MYD14CMQ`, SFTP `fuoco.geog.umd.edu`) skipped:** they need an SFTP login. Not used;
  the FireMask route covers Central Kalimantan only. `pipeline.support.cloud` was not run.
- Not run (not part of the request): `pipeline.support.climate` (CHIRPS, so V8 stays `not_run`), `pipeline.support.data_health`,
  `pipeline.physics`, `pipeline.decision`, `pipeline.run.trend`, `drift_check`, `field_test`, the peat validation variant
  (`validate_all --input monthly_stratum_labeled.parquet --tag _peat`), the figure script `notebooks/validation_figures.py`
  (matplotlib is not installed; `validate.sh` treats it as non-fatal), the Playwright E2E tests, and `scripts/test_all.sh`.
- Drought Code (needs a Copernicus CDS account) and anything else behind a login: not touched.
- One unit test failed once for a missing optional export (6.1) and passed after the export; two agent tests fail with a
  province-inclusive bundle, as Second Sight already documents (6.1).
- Two `bash.exe.stackdump` files (a Git Bash crash dump) appeared in the project root and in `vendor/second-sight/` during
  the session; I deleted them. No pipeline step reported an error.
- No hidden-fire estimate and no re-appearance test were computed for any period.

## 11. Pre-registration hygiene

- For Central Kalimantan and Pulang Pisau between 1 January and 31 October 2019, this run computed nothing new except the
  monthly sums of the existing v1.0 visibility file (7.1). `build_season.py` and `build_visibility.py` were not run for
  2019 and no 2019 output was rewritten.
- `ss-data` contains Second Sight's own monthly counts for every province, including 2019 months, because the bundle
  export writes all 34. They come from the unmodified Second Sight export and were not analysed here. A read-back check
  after publishing printed some Central Kalimantan 2019 rows (and August to October sums) to confirm that the file had been
  written; nothing was derived from them and they are not reported.
- Second Sight's leave-one-year-out results (related to v1.1's H3) were already public in its repository.
- The province-kappa patch (9.1) re-exported all 34 provinces. In their pre-2022 rows only `baseline_median` changed (it uses
  2022); no 2019 `H`, `H_lo`, `H_hi`, `pct_rank` or raw value moved, and no new analysis of those months was made.

## 12. FIRMS raw files and checksums (as recorded by `pipeline.data.manifest`)

| source | year | rows | bytes | sha256 |
|---|---|---:|---:|---|
| modis | 2000 | 691 | 53,996 | `ffdedd9211fba5526064a26cd28735c354cacbbef7df6a2f388a0100bb045e69` |
| modis | 2001 | 15,078 | 1,179,929 | `9fcaeaf6515aaa6335c7d442d711425f33bd75ac7dc078c4f46ab14fcc97372d` |
| modis | 2002 | 123,327 | 9,595,460 | `8de9de871b0ecec11282cb351fdfe608473006f5ed7d97037bf7e2a1923a7a36` |
| modis | 2003 | 62,751 | 4,875,686 | `aa64834a096c7d8c73a2d77fb02ef599158d33563423ca67c431719dc41334d0` |
| modis | 2004 | 107,117 | 8,322,604 | `0e6a418dbed38654e13186897006409bb9508d6e9eb460acad35c913f8b8c576` |
| modis | 2005 | 74,797 | 5,798,891 | `d4f9134c67b220136d0d4de12434b675c6c8476fba9464bfe9531d76ec69188b` |
| modis | 2006 | 154,985 | 12,058,484 | `a94389d5be532e5c2f7048230f2c1d90a2187a4455f6c1674bafa2500db53133` |
| modis | 2007 | 43,224 | 3,346,298 | `61e8dabddc4043e194edb972c40d01c29dcb9471eebaa3682835feeac24de801` |
| modis | 2008 | 41,161 | 3,186,516 | `24fba3b1a40ea19b72e9d2830355af13029ea2650b031da9e808fe23003e2072` |
| modis | 2009 | 102,344 | 7,945,933 | `c45f4871fc9d3090fec52d5293d7475d3624472a8828abfcccd0979337b9fe47` |
| modis | 2010 | 20,792 | 1,604,037 | `12a3ac027fec3870c8a9caba4415d34ffa0a28e4960e121b2fdb7c1c55f1aa56` |
| modis | 2011 | 62,790 | 4,871,314 | `4a0cffe94dc448061fff1a9bb8120b714fb56e33f1bb6291968fd8d3d876295a` |
| modis | 2012 | 71,135 | 5,524,163 | `2c4e88d3b132f9ed94d75b24cfafccf347bac343f2a7c50cd6ba47b0f5bfacf5` |
| modis | 2013 | 53,852 | 4,178,716 | `c1287263311b2829411c586a5eb1fccbb8484f1b10356f0be847fea97eba3c9b` |
| modis | 2014 | 115,121 | 8,933,232 | `3c6c51a63ba857d81e30e8017864cf457e0736dcfe4971b7669be9ec6b40f32f` |
| modis | 2015 | 178,578 | 13,914,029 | `986e4a768333b229fbf48759f7ca7b019b9eb4192f85251946ea6ac3220199b0` |
| modis | 2016 | 24,061 | 1,861,699 | `47a08f058c57baa2ea725ec980e67a1089d7583eb3e2a042fc019cf35589d1a6` |
| modis | 2017 | 17,823 | 1,382,026 | `054a1cccca3da84fc35fee962d5f4167ea2a3ce221be3be7884d4c4b5aa89061` |
| modis | 2018 | 38,074 | 2,996,769 | `3e7b488cf08c3043fe0ebf0db447d10e57cc6c25aadf900ca8183eae73300a0e` |
| modis | 2019 | 90,475 | 7,142,482 | `049f010fb65375c1bd5020a0aeb00f0c0a93630585c8439e4979894bafee35ec` |
| modis | 2020 | 16,201 | 1,272,113 | `e00db019742905232b11f56bb5cfb9158d5d10479c3d895202376b1046baf19f` |
| modis | 2021 | 14,210 | 1,114,710 | `62d0c407f9e9ebbecdddeae1529cc405e254e0aaa4a01f7a427929a186e3d0a0` |
| modis | 2022 | 11,279 | 883,571 | `7ba203f76f72e96d73b03abb76a08613d59edb2c90fe17aaf580a18648f6fd33` |
| modis | 2023 | 52,156 | 4,151,442 | `9f9d79cc84eefab271fc82e63b7c49309547a1c31639bfd8590be91d1eea7f1e` |
| modis | 2024 | 23,542 | 1,865,779 | `ac90c680c1d0cd493b6997388ea5084037b2f1104c415a4570e4a05c6ef359d2` |
| modis | 2025 | 17,847 | 1,409,943 | `949bf85a132fe817d0778e164c92ec0378a6045c0f72e684a70b2d16a3c3a19a` |
| viirs-jpss1 | 2018 | 181,069 | 14,692,256 | `49ee29685f715227d651e5b2895f0a79c329bab493d2e1163935ad47a151162c` |
| viirs-jpss1 | 2019 | 437,645 | 35,526,723 | `4a895f42a8a58e8715691d02c5ec524bdeb85bfac19a54f66ad983c91c3998c5` |
| viirs-jpss1 | 2020 | 93,213 | 7,556,481 | `78f2c93862e9b2eb81b88ce0f1e3c6b9ac4dda8bb35057823e3f3224fb3141d6` |
| viirs-jpss1 | 2021 | 71,063 | 5,760,722 | `b9ce13a8a47ab46864c1dfbabf2c6e9ab2f3acc1b11f3f5ca63ade05700b87cf` |
| viirs-jpss1 | 2022 | 63,803 | 5,168,954 | `fdff1fa25cd0a271b9dfe094fbe0134ce9cc364746045663e3069e2447fa975b` |
| viirs-jpss1 | 2023 | 250,312 | 20,327,760 | `99969d975480ab57a129b02502b4b968ced195dc2c7fcaf947eb693ef7010fd7` |
| viirs-jpss1 | 2024 | 116,040 | 9,408,241 | `f978dc06ac3d14c3852ab3a0410422346678a4f221179d8f2f891695caeeaaad` |
| viirs-jpss1 | 2025 | 94,458 | 7,646,219 | `3034d45ce3b106e9a507be3936f445df0e762d9d6cf4318244bb44b30a794b8e` |
| viirs-snpp | 2012 | 318,613 | 25,193,408 | `be12c40c90faf9b9a5144f57f1e0ae917f44b65d5a1231b118b634652d892dec` |
| viirs-snpp | 2013 | 257,222 | 20,276,400 | `3883e4cc54b8b362c47edd7d0af4d87459d562f58257c3e1d2f9e88f4f3dd26b` |
| viirs-snpp | 2014 | 555,597 | 43,844,957 | `f774a04bb726c39157138a4bbdb17b737f5c8433fb076efcf2ea0afbc6f36938` |
| viirs-snpp | 2015 | 875,824 | 69,346,331 | `88ffeba70b181aedbf8601504e082a1d3e8cc690902f5e86979ae4716f240208` |
| viirs-snpp | 2016 | 117,250 | 9,242,773 | `5a9d7a854583476b6cc5444407db63ec6cad5c7a936f62231e304c87c31300da` |
| viirs-snpp | 2017 | 90,849 | 7,181,743 | `8ec126472021982aaaf9d71f99a975517e08f838527fa8ac6c94e08240e71073` |
| viirs-snpp | 2018 | 191,173 | 15,118,642 | `677dd2fcbb5d9445e372b0a79fc6553a2cc838862686ae4c4cd98fc89ebc4b44` |
| viirs-snpp | 2019 | 437,281 | 34,617,768 | `1dd309b8ae9dd74464f6fce4e0b61c261b7f39326c2dde3f029db55e22fe1a82` |
| viirs-snpp | 2020 | 91,536 | 7,235,719 | `39079f13921efeca4659e285515a2e3fb32d213a256a8d5499745c23a4bb67d0` |
| viirs-snpp | 2021 | 68,325 | 5,401,447 | `6d99f3fb49d154b5bb4eaaaa8a9da4f62ef930fa91ba0c4325835164a9a5a946` |
| viirs-snpp | 2022 | 57,220 | 4,521,004 | `06627b2f80bde393725e285e097cbc1bfd592c39bf0e3ef78774db2ac2981804` |
| viirs-snpp | 2023 | 253,388 | 20,067,598 | `2dba3b772b5a3a2cc0feed128af74637810021dd41dc34d584cb99b40411665a` |
| viirs-snpp | 2024 | 104,186 | 8,238,988 | `23be16b48fb6ac3a21fd2130e66149d305af71c62bbb39e76a6a0632a9dd69bd` |
| viirs-snpp | 2025 | 96,056 | 7,584,099 | `11abffff52dedfe985a8f03c59b8ebff55a903bd0de07d4897f76d734788d811` |

## 13. District records (kabupaten/kota), added 15 November 2026

A monthly record for 514 districts, written to `app/public/ss-data/districts/`. It is a **share-out of the province
record**, not a separate harmonization: `index.json` there carries `"approximate": true` and the method in two sentences.

### 13.1 Command and run time

```
.venv/Scripts/python.exe pipeline/districts/build_districts.py
```

Run from the project root with the venv of section 2 (pandas, pyarrow, shapely, geopandas; nothing was installed).
**17.7 s** wall clock (second and final run, 2026-11-15 12:29 UTC; the first run took 12.3 s). No network access.
The script deletes and rewrites `monthly_kab-*.json` in its own folder and writes `index.json` last.

### 13.2 Method

1. Each 0.05 degree grid cell of `ss-data/grid005` goes to the district whose polygon contains the cell centre
   (45,218 cells). A centre that falls outside every polygon but within 0.05 degree of one goes to the nearest district
   (3,938 cells, mostly coast). 114 cells are further away and are left out: 0.031% of all fire cell-days.
2. A district belongs to the province (gbHumanitarian ADM1, the layer of the bundle's province records) that it overlaps
   most. Every district overlaps its province by 99.5% or more of its area.
3. District value = district raw count of the sensor named in the province's `sensor_used` for that month x
   (province `H` / province raw count of that sensor); the same factor for `H_lo` and `H_hi`; 0 when the province raw
   count is 0. `H`, `H_lo`, `H_hi` are rounded to 2 decimals.
4. `baseline_median` (median of `H` over the same calendar month, 2003 to 2022) and `pct_rank` (rank among the same
   calendar month of earlier years, ties count half) follow `vendor/second-sight/pipeline/science/baseline.py`. The
   script applies its own implementation to the `H` series of 33 province files and gets their `baseline_median` and
   `pct_rank` back with a largest difference of 0.0 and the same null pattern (`definition_check` in `index.json`).
   For districts they are computed on the rounded `H`.
5. `flag_nrt` and `flag_partial` are copied from the province row; `obs_class` and `agreement` are null.

Three things differ from a plain copy of the province logic, all written into `index.json`:

- **Five units of the ADM2 layer are not districts and were left out:** `Danau`, `Danau Toba`, `Hutan`, `Waduk Cirata`,
  `Wadung Kedungombo` (lakes, reservoirs, one forest polygon). 519 units minus 5 gives 514, the number of kabupaten and kota.
- **Province-wide zero months.** The bundle writes `H: null` and `sensor_used: null` in 702 province rows where no
  active satellite saw fire anywhere in the province (all raw counts 0). In those months the district value is 0
  (the rule "province raw count 0 gives 0"), and `sensor_used` stays null as in the province row.
- **Locked months.** For the 14 districts of Kalimantan Tengah, the rows 2019-01 to 2019-10 have null `H`, `H_lo`,
  `H_hi`, raw counts, `baseline_median` and `pct_rank` (140 rows). Those grid rows are dropped before anything is
  summed, and the province is left out of the grid check for those ten months (section 11 explains the lock). Their
  baseline and ranks therefore leave 2019 out for January to October, and `mean_cell_days_per_year` uses 24 years.

`mean_cell_days_per_year` is the mean yearly sum of `H` over the complete years 2001 to 2025. `low_data` is true below 50:
378 of the 514 districts.

### 13.3 Inputs and checksums

| Input | sha256 |
|---|---|
| `data-raw/geoboundaries/geoBoundaries-IDN-ADM2_simplified.geojson` (gbOpen ADM2, boundary id IDN-ADM2-22746128, 519 units, 11,002,896 bytes) | `146653d488331086ddc43d159a261b01ea6dd08c7ed422e34a9886c3c690430c` |
| `data-raw/ss/support/boundaries/geoBoundaries-IDN-ADM1-gbHumanitarian_simplified.geojson` (34 provinces) | `6a92013432cb64c03915a84fe53281fcacadd2b66cf69d502d8259fd6d23fb3e` |
| `app/public/ss-data/index.json` (province list, baseline period) | `6a389dc0b2f717fd5c5b6a53d6cdebb01756d2219928b963886ef043e3ad867a` |
| `app/public/ss-data/monthly_IDN.json` (unit check) | `cb72f706837b4b4fe485acc584e878c86c60332c71c6bdeb1de9119768170e91` |
| `app/public/ss-data/grid005/grid005_2000.parquet` to `grid005_2026.parquet` (27 files, 10,693,349 bytes) | sha256 of the sorted list of `<name> <sha256>` lines: `b36610e4641ff0adaafed9f52c4630f92e2190b35bfdc21a69c1c652984bec89` |
| `app/public/ss-data/monthly_prov-*.json` (34 files, as they were at 12:29 UTC) | same kind of list hash: `bd20d97e264086b74ef1dca8a5a351d12b14c2ab41e92a1697e561b7bf9b49f3` |

Licence of the district layer: the geoBoundaries API (read 2026-11-15) gives **CC BY 3.0 IGO** for IDN ADM2 gbOpen
(source: BPS, World Food Programme, OCHA ROAP). The geoBoundaries database itself is CC BY 4.0. `index.json` records
CC BY 3.0 IGO with a note.

### 13.4 Grid check

**Unit.** National sums of grid `n_cells` against `monthly_IDN.json`, every month, each satellite: difference 0 in every
month (Aqua 968,940 cell-days over 293 months, Terra 453,184 over 313, S-NPP 2,458,771 over 179, NOAA-20 1,185,698
over 104). The grid and the province files use the same unit. NOAA-21 rows in the grid have no raw column in the bundle
and are not used.

**Per province and satellite** (34 x 4 = 136 pairs; the full list is `grid_check` in `districts/index.json`). Grid cells
summed through the districts against the province file's raw column:

| Measure | Result |
|---|---|
| difference of the sums over all months, median of the 136 absolute values | 0.42% |
| pairs within 1% / within 2% | 100 / 124 of 136 |
| pairs above 5% | 7: Daerah Istimewa Yogyakarta (Aqua +14.8%, S-NPP -9.2%, NOAA-20 -8.7%), DKI Jakarta (Aqua -12.5%, S-NPP -8.5%, NOAA-20 -10.9%), Kepulauan Riau (NOAA-20 +5.5%) |
| largest monthly difference, months with at least 100 province cell-days (`max_abs_pct_diff`; 120 pairs have such a month) | median 3.6%, largest 14.2% (Sulawesi Tengah, NOAA-20) |
| the main fire provinces, sums over all months | Riau -0.3% to +0.3%, Kalimantan Tengah -0.2%, Sumatera Selatan -0.2% to -0.1%, Kalimantan Barat +0.2% to +0.3%, Jambi +0.7% to +1.6%, Papua +0.5% to +1.7% |

The differences come from 0.05 degree cells that straddle a province border and from the two boundary layers (gbOpen
ADM2 here, gbHumanitarian ADM1 in the bundle). Districts add up to their province to within this difference, not
exactly. In 14 district-months a district has grid fire while its province's raw count is 0; the rule gives 0 there.

### 13.5 Output

| File | Content | Bytes |
|---|---|---:|
| `districts/index.json` | method, checks, 514 district entries | 452,114 |
| `districts/monthly_kab-<slug>.json` (514 files) | 313 rows each (2000-11 to 2026-11), 160,882 rows, the province row fields in the same order | 40,533,718 |
| `districts/districts.geojson` | 514 polygons, properties `aoi_id`, `name`, `province`; simplified with tolerance 0.002 degree, coordinates to 4 decimals | 2,763,787 |
| `districts/cells.json` | 49,156 grid cells with fire and the index of their district (`g_id = floor((lat + 90) / 0.05) * 7200 + floor((lon + 180) / 0.05)`) | 629,267 |

The folder holds 517 files, 44,378,886 bytes. sha256 at 12:29 UTC: `index.json` `b303bfbe7644a69e9ab552df24808a585263629e6c184764269b06fb2dc4d6ba`,
`districts.geojson` `f827cf1fbfc982249947d50b82d7120ca526a813b97132032de52bf870f63bf4`,
`cells.json` `e69e6e9946066034c63d6d36bb8859cb8ee79f332e5f95980f534742da39932d`.

## 14. More Central Kalimantan seasons and the district-day count, added 15 November 2026

Built today: Aug to Oct of 2014, 2016, 2017, 2018, 2020, 2021, 2022, 2024 and 2026, and the wet-season quarter Jan to Mar
2023. With 2015 and 2023 from 14 November that makes 11 Aug to Oct seasons and one wet quarter. **2019 was not rerun and
its files were not opened or rewritten.** **Aug to Oct 2025 could not be built** (14.2).

### 14.1 Commands and run times (all times UTC, 15 November)

Per season `<Y>`, with the venv python of section 2 (`build_visibility.py` needs numpy, Pillow, tifffile):

```
python -I pipeline/visibility/build_season.py data-raw/ss/raw_csv/viirs-snpp/viirs-snpp_<Y>_Indonesia.csv app/public/ka-data/kalteng_<Y>_season.json <download_utc from data_manifest.json> <Y>
python -I pipeline/visibility/build_visibility.py data-raw app/public/ka-data data-raw/geoboundaries/geoBoundaries-IDN-ADM2_simplified.geojson <Y>
```

Wet quarter (new optional window arguments; without them both scripts behave as before):

```
python -I pipeline/visibility/build_season.py data-raw/ss/raw_csv/viirs-snpp/viirs-snpp_2023_Indonesia.csv app/public/ka-data/kalteng_2023_janmar_season.json 2026-11-14T06:32:28Z 2023 01-01 03-31
python -I pipeline/visibility/build_visibility.py data-raw app/public/ka-data data-raw/geoboundaries/geoBoundaries-IDN-ADM2_simplified.geojson 2023 01-01 03-31 janmar
```

2026 (the points are not in the FIRMS country archive yet; they come from the near-real-time parquet of section 4.2):

```
python -I pipeline/visibility/nrt_parquet_to_csv.py data-raw/ss data-raw/kalteng_nrt/viirs-snpp_2026_from_nrt_mirror.csv 2026      (12 s)
python -I pipeline/visibility/build_season.py data-raw/kalteng_nrt/viirs-snpp_2026_from_nrt_mirror.csv app/public/ka-data/kalteng_2026_season.json 2026-11-14T06:38:17Z 2026
python -I pipeline/visibility/build_visibility.py data-raw app/public/ka-data data-raw/geoboundaries/geoBoundaries-IDN-ADM2_simplified.geojson 2026
```

Then:

```
python -I pipeline/visibility/build_blind_rule.py app/public/ka-data                                                     (under 1 s)
python pipeline/visibility/monthly_observability.py --bundle-src data-raw/ss/bundle --out app/public/ss-data --ka-data app/public/ka-data --years 2014 2015 2016 2017 2018 2020 2021 2022 2023 2024 2026 --files visibility_kalteng_2023_janmar.json --keep-published 2019 --report data-raw/obs_months.json      (3 s)
```

Season plus visibility, three seasons running side by side (most of the time is the FireMask download): Jan to Mar 2023
3 min 57 s, 2021 3 min 19 s, 2024 3 min 42 s, 2017 3 min 29 s, 2020 3 min 40 s, 2022 3 min 37 s, 2018 3 min 24 s, 2016
4 min 10 s, 2014 3 min 53 s, 2026 2 min 54 s. First start 12:32:17, last end 12:47:09: **about 15 minutes** for all ten.
Jan to Mar 2023, 2017, 2020, 2021, 2022 and 2024 were then run once more from the downloaded files (5 to 11 s each) after
`build_visibility.py` learned to record days without a sensor file (14.3); their counts did not change. Logs:
`data-raw/vis<Y>.log`, `data-raw/vis2023janmar.log`. The FireMask folder `data-raw/modis14a1` now holds 586 files.

### 14.2 What was not available

- **Aug to Oct 2025: not built.** The Planetary Computer catalogue (`modis-14A1-061`) returns 0 MOD14A1/MYD14A1 items
  over the box for 2025-08-01 to 2025-10-31 (it returns 94 for January to July 2025 and 114 for the whole year). NASA's
  own archive needs a login, which this run does not use. No 2025 season or visibility file is published: a first attempt
  wrote `kalteng_2025_season.json` and 92 images showing only "no data" before the visibility step stopped; both were
  removed, and `build_visibility.py` now stops before writing anything when the catalogue returns no file.
- **2026, 16 to 31 October:** the catalogue has no Aqua file for 16 to 23 October and, for 24 to 31 October, Terra only
  for the northern tile and Aqua only for the southern one (46 files instead of 48). The files are probably not
  published yet. Those 16 days are in the visibility file but marked (14.3).
- **Jan to Mar 2023:** the catalogue has no file of either sensor for 26 February to 5 March 2023 (period A2023057).
- Other days without a file of one sensor (a sensor that was off, or a gap in the catalogue; this run did not check
  which): Aqua 17 August to 2 September 2020, Terra 11 to 23 October 2022, Terra on 26 October 2014.

### 14.3 Seasons (same box, cells and rule as section 7; F, T, U, N in cell-days)

`no_file_days` is a new key in a visibility file, present only when the catalogue had no file of a sensor for part or all
of the box on some day. On such a day the class rests on the other sensor, so its blind share is not comparable.

| Season | FireMask files | bytes | VIIRS rows kept | zero days | busiest day | land cells | F | T | U | N | blind U/(T+U) | daily median (q1 to q3) | no data | days without a sensor file |
|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---|---:|---|
| 1 Aug to 31 Oct 2014 | 48 | 29,163,433 | 89,683 | 0 | 2014-10-02 (4,635) | 123,960 | 49,401 | 10,288,416 | 1,047,052 | 19,451 | 9.2% | 3.5% (0.4 to 12.9) | 0.2% | 1 (2014-10-26) |
| 1 Aug to 31 Oct 2016 | 52 | 37,087,959 | 10,699 | 7 | 2016-09-14 (1,472) | 123,798 | 3,277 | 8,960,987 | 2,413,872 | 11,280 | 21.2% | 12.6% (3.2 to 30.9) | 0.1% | none |
| 1 Aug to 31 Oct 2017 | 48 | 34,284,771 | 6,942 | 3 | 2017-09-23 (490) | 123,820 | 2,219 | 8,865,640 | 2,511,619 | 11,962 | 22.1% | 16.4% (4.6 to 31.4) | 0.1% | none |
| 1 Aug to 31 Oct 2018 | 48 | 29,378,731 | 28,485 | 1 | 2018-09-27 (1,289) | 123,937 | 11,491 | 9,847,468 | 1,526,974 | 16,271 | 13.4% | 4.5% (0.7 to 18.1) | 0.1% | none |
| 1 Aug to 31 Oct 2020 | 50 | 34,178,365 | 7,125 | 9 | 2020-09-18 (732) | 123,790 | 2,537 | 8,603,939 | 2,760,078 | 22,126 | 24.3% | 15.8% (5.3 to 38.5) | 0.2% | 17 (2020-08-17 to 2020-09-02) |
| 1 Aug to 31 Oct 2021 | 50 | 36,403,084 | 5,302 | 7 | 2021-09-23 (631) | 123,792 | 1,278 | 8,449,050 | 2,928,438 | 10,098 | 25.7% | 19.2% (4.5 to 38.9) | 0.1% | none |
| 1 Aug to 31 Oct 2022 | 46 | 33,946,780 | 3,785 | 21 | 2022-08-19 (521) | 123,729 | 856 | 7,981,422 | 3,389,178 | 11,612 | 29.8% | 17.6% (8.6 to 47.7) | 0.1% | 13 (2022-10-11 to 2022-10-23) |
| 1 Jan to 31 Mar 2023 | 48 | 37,202,615 | 393 | 36 | 2023-01-17 (43) | 123,571 | 184 | 5,950,284 | 4,179,328 | 991,594 | 41.3% | 43.1% (15.6 to 59.9) | 8.9% | 8 (2023-02-26 to 2023-03-05) |
| 1 Aug to 31 Oct 2024 | 54 | 35,129,216 | 11,989 | 4 | 2024-09-03 (907) | 123,766 | 4,133 | 9,773,983 | 1,595,225 | 13,131 | 14.0% | 7.2% (1.3 to 20.7) | 0.1% | none |
| 1 Aug to 31 Oct 2026 | 46 | 24,979,659 | 203,491 | 1 | 2026-10-22 (10,092) | 123,946 | 91,240 | 10,387,132 | 895,464 | 29,196 | 7.9% | 0.4% (0.0 to 3.3) | 0.3% | 16 (2026-10-16 to 2026-10-31) |

The season totals above include the days without a sensor file (the 8.9% no data of Jan to Mar 2023 is the eight days
with no file at all). Some catalogue searches return a file twice or a thirteenth period, hence 50 to 54 files.

**2026 is provisional.** All 203,491 points kept for Aug to Oct 2026 are near-real-time rows. They carry no `type`, so the
"presumed vegetation fire" test that the archive years get cannot be applied to them (the file's `filter_text` says so,
and `source.provisional` is true); the confidence filter and the box are the same. The season file records the mirror
URL, the parquet's sha256 (`a372343a…`, the value in `data_manifest.json`) and the converted CSV's sha256.

The season files hold, per point, the "re-appeared after a gap" marks that `build_season.py` writes for the page (the
unchanged v1.0 rule, as in the 2015 and 2023 files). No total, test or analysis of them was made or is reported here.

### 14.4 Monthly observability (rule of section 7.1)

A month is filled only when the file holds all of its days and none of them is a day without a sensor file. 23 months
were added; `obs_months` in `ss-data/index.json` now lists 32. The three 2019 months were **copied as published**
(`--keep-published 2019`: the 2019 file is not opened and nothing is recomputed); the six months of 2015 and 2023 were
recomputed from unchanged files and came out identical. A comparison of `monthly_prov-kalimantan-tengah.json` before and
after: 23 rows changed, all in the observability fields only; every 2019 row identical.

| Month | F | T | U | N | f_cloud | f_missing | O | obs_class |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| 2014-08 | 4,101 | 3,442,954 | 389,492 | 6,213 | 0.1016 | 0.0016 | 0.8969 | good |
| 2014-09 | 24,551 | 3,487,347 | 200,452 | 6,450 | 0.0544 | 0.0017 | 0.9440 | good |
| 2016-08 | 831 | 3,281,472 | 550,366 | 5,069 | 0.1436 | 0.0013 | 0.8552 | good |
| 2016-09 | 1,252 | 3,031,179 | 677,836 | 3,673 | 0.1828 | 0.0010 | 0.8164 | good |
| 2016-10 | 1,194 | 2,648,336 | 1,185,670 | 2,538 | 0.3093 | 0.0007 | 0.6903 | good |
| 2017-08 | 101 | 2,879,497 | 955,103 | 3,719 | 0.2491 | 0.0010 | 0.7502 | good |
| 2017-09 | 1,144 | 3,044,656 | 664,512 | 4,288 | 0.1792 | 0.0012 | 0.8199 | good |
| 2017-10 | 974 | 2,941,487 | 892,004 | 3,955 | 0.2327 | 0.0010 | 0.7665 | good |
| 2018-08 | 3,462 | 3,481,955 | 350,558 | 6,072 | 0.0915 | 0.0016 | 0.9071 | good |
| 2018-09 | 5,867 | 3,281,739 | 424,989 | 5,515 | 0.1147 | 0.0015 | 0.8840 | good |
| 2018-10 | 2,162 | 3,083,774 | 751,427 | 4,684 | 0.1959 | 0.0012 | 0.8031 | good |
| 2020-10 | 986 | 2,631,407 | 1,201,743 | 3,354 | 0.3135 | 0.0009 | 0.6859 | good |
| 2021-08 | 104 | 2,947,332 | 886,616 | 3,500 | 0.2313 | 0.0009 | 0.7680 | good |
| 2021-09 | 223 | 2,588,735 | 1,121,653 | 3,149 | 0.3023 | 0.0008 | 0.6971 | good |
| 2021-10 | 951 | 2,912,983 | 920,169 | 3,449 | 0.2401 | 0.0009 | 0.7593 | good |
| 2022-08 | 184 | 3,230,504 | 601,823 | 3,088 | 0.1570 | 0.0008 | 0.8423 | good |
| 2022-09 | 428 | 2,626,051 | 1,083,192 | 2,199 | 0.2920 | 0.0006 | 0.7076 | good |
| 2023-01 | 116 | 2,052,647 | 1,777,042 | 896 | 0.4640 | 0.0002 | 0.5359 | **partial** |
| 2024-08 | 235 | 3,284,172 | 547,766 | 4,573 | 0.1429 | 0.0012 | 0.8560 | good |
| 2024-09 | 2,714 | 3,349,114 | 356,292 | 4,860 | 0.0962 | 0.0013 | 0.9027 | good |
| 2024-10 | 1,184 | 3,140,697 | 691,167 | 3,698 | 0.1804 | 0.0010 | 0.8188 | good |
| 2026-08 | 19,436 | 3,809,448 | 5,439 | 8,003 | 0.0014 | 0.0021 | 0.9965 | good |
| 2026-09 | 37,195 | 3,546,566 | 127,542 | 7,077 | 0.0347 | 0.0019 | 0.9634 | good |

Skipped because of days without a sensor file: 2014-10, 2020-08, 2020-09, 2022-10, 2023-02, 2023-03, 2026-10.
January 2023 is the first month in the data that is not `good`. After this step: `ss-data/index.json` sha256
`70a2db763c4ba3634d8c42e76bbfc1e763fddb06196c0248dd29d79bd9f67ff8` (only `obs_months` differs from before),
`monthly_prov-kalimantan-tengah.json` `84615a320d1ad4333cdf054e0840b08ae037c0f65b0da3da67d1ea5bdb6f389b`. These replace the
two values in 4.5 and the two "as they were at 12:29 UTC" inputs of 13.3; the district records do not use the changed fields.

### 14.5 District-days with no cloud-free look (`app/public/ka-data/blind_rule_kalteng.json`)

Rule: a district-day counts when more than half of the district's no-fire cell-days of that day had no cloud-free look
from Terra or Aqua, U / (T + U) > 0.5. Input: the per-day, per-district T and U stored in each visibility file. Only
days with a file of both sensors are counted. 2019 is left out and its file is not opened. The file states that thick
smoke is not flagged as cloud by the MODIS FireMask, so the count is a lower bound.

| Season | days counted | district-days | above the threshold | share | day with the highest share of no-fire cell-days with no cloud-free look (share, fire cells that day) |
|---|---:|---:|---:|---:|---|
| 1 Aug to 31 Oct 2014 | 91 of 92 | 1,274 | 65 | 5.1% | 2014-10-15 (93.2%, 0) |
| 1 Aug to 31 Oct 2015 | 92 of 92 | 1,288 | 37 | 2.9% | 2015-10-29 (78.8%, 48) |
| 1 Aug to 31 Oct 2016 | 92 of 92 | 1,288 | 194 | 15.1% | 2016-10-20 (95.5%, 0) |
| 1 Aug to 31 Oct 2017 | 92 of 92 | 1,288 | 210 | 16.3% | 2017-08-17 (95.5%, 0) |
| 1 Aug to 31 Oct 2018 | 92 of 92 | 1,288 | 122 | 9.5% | 2018-08-01 (82.7%, 0) |
| 1 Aug to 31 Oct 2020 | 75 of 92 | 1,050 | 209 | 19.9% | 2020-10-17 (92.8%, 0) |
| 1 Aug to 31 Oct 2021 | 92 of 92 | 1,288 | 271 | 21.0% | 2021-08-28 (83.7%, 0) |
| 1 Aug to 31 Oct 2022 | 79 of 92 | 1,106 | 208 | 18.8% | 2022-09-05 (85.7%, 0) |
| 1 Aug to 31 Oct 2023 | 92 of 92 | 1,288 | 39 | 3.0% | 2023-10-18 (44.9%, 87) |
| 1 Aug to 31 Oct 2024 | 92 of 92 | 1,288 | 119 | 9.2% | 2024-10-17 (85.2%, 0) |
| 1 Aug to 31 Oct 2026 | 76 of 92 | 1,064 | 8 | 0.8% | 2026-09-09 (37.9%, 613) |
| **11 Aug to Oct seasons** (`total`) | | **13,510** | **1,482** | **11.0%** | |
| 1 Jan to 31 Mar 2023 (`wet_season_contrast`) | 82 of 90 | 1,148 | 442 | 38.5% | 2023-02-12 (99.8%, 0) |
| all 12 windows (`all_windows_total`) | | 14,658 | 1,924 | 13.1% | |

`total`, `districts` and `seasons` in the file hold the Aug to Oct seasons only, so the wet quarter is never added in
unnoticed. Per district, Aug to Oct seasons (965 district-days each) and the wet quarter (82 each):

| District | Aug to Oct, above the threshold | share | Jan to Mar 2023 | share |
|---|---:|---:|---:|---:|
| Barito Selatan | 77 | 8.0% | 36 | 43.9% |
| Barito Timur | 87 | 9.0% | 38 | 46.3% |
| Barito Utara | 81 | 8.4% | 25 | 30.5% |
| Gunung Mas | 125 | 13.0% | 32 | 39.0% |
| Kapuas | 80 | 8.3% | 31 | 37.8% |
| Katingan | 103 | 10.7% | 35 | 42.7% |
| Kota Palangka Raya | 100 | 10.4% | 25 | 30.5% |
| Kotawaringin Barat | 120 | 12.4% | 30 | 36.6% |
| Kotawaringin Timur | 112 | 11.6% | 34 | 41.5% |
| Lamandau | 136 | 14.1% | 29 | 35.4% |
| Murung Raya | 134 | 13.9% | 30 | 36.6% |
| Pulang Pisau | 80 | 8.3% | 35 | 42.7% |
| Seruyan | 120 | 12.4% | 30 | 36.6% |
| Sukamara | 127 | 13.2% | 32 | 39.0% |

No district-day had zero no-fire cells. sha256 of `blind_rule_kalteng.json` (40,958 bytes):
`b517f5e282972f18d43647ac777190c7bc88a6662e7495a9866f73bcbec4fc2f`.

### 14.6 New files in `app/public/ka-data/` (sha256)

| File | bytes | sha256 |
|---|---:|---|
| `kalteng_2014_season.json` | 2,151,481 | `559302be6e4571299ac0c3d56262b02b0a1a9dfc330201c6b5bc5241bf5d7db1` |
| `kalteng_2016_season.json` | 260,366 | `c6f93707aa4bf4af2fc8b812621a9599f8a05c7c7d7eaf4de8bcc6dd468a2fd1` |
| `kalteng_2017_season.json` | 170,347 | `69e7c364a7957f7b5492ee7e40fcf4f667ba2429386cd8033f0785ea70273c06` |
| `kalteng_2018_season.json` | 683,260 | `df58c2c7127a1c99d518fa877bd273dc394a09cee045c44f98a2af8afafef2c8` |
| `kalteng_2020_season.json` | 172,813 | `66a16452207c6788fe42bcc60e8f0db8a7757d40be2b5424b2d129cc8d0d9d92` |
| `kalteng_2021_season.json` | 130,970 | `6fa3035132bd1f6cc925fb1b782c30653e2c87de231b1169ae645e4f43f808fb` |
| `kalteng_2022_season.json` | 95,068 | `5b2c0c499c2b45e5db717a25a02a526834f8b8e4c0368366f526434aa8c05510` |
| `kalteng_2023_janmar_season.json` | 15,429 | `5274f3fb10e7cd46871d6c7c6fcfcd7b4518a4a1919bc19c0a8100e08d99b11b` |
| `kalteng_2024_season.json` | 291,218 | `0c54d3a8d281388ef0f00042468208f78d964d40eee09ffee8f63f1a68340759` |
| `kalteng_2026_season.json` | 4,782,617 | `8dc75e34ab0b1f217634b069ea797591391d89d6214f187fdf2a00b09c6cd865` |
| `visibility_kalteng_2014.json` | 37,707 | `fe80782a203964827e866cac4a3f6d970162a40a26eb69defbb74a1dd76f334b` |
| `visibility_kalteng_2016.json` | 38,708 | `6ea0bfe3e7b93937fa380d380c55f8c1962d610178e43fc9beee1a003cd41849` |
| `visibility_kalteng_2017.json` | 38,003 | `1b0814ac1e6512dde48705c38ca334981b4d802180a521d2b8735a2c03b024b5` |
| `visibility_kalteng_2018.json` | 37,464 | `98bed3210279062af6cdff6704885f069b888fbc2f20fd9dc2b7aa7b2a3ad071` |
| `visibility_kalteng_2020.json` | 39,190 | `7b7679e083e6c58d510b78155e5654fdf8a9f23dcdf306e9e21fa206e4095606` |
| `visibility_kalteng_2021.json` | 38,464 | `abeed716bca6c04bbeacbbc63568af1386a8a4595ce3ee4e623418ee41db685c` |
| `visibility_kalteng_2022.json` | 38,428 | `5b9f0696c5efc6d3885ba356cf10c403f6855d7577b318ff61968b5b3c36bc37` |
| `visibility_kalteng_2023_janmar.json` | 37,938 | `17cb8f5da5c80957eba13a5f098fb74721ae2b746db7e03424d5c0443fc778ad` |
| `visibility_kalteng_2024.json` | 38,879 | `6e80a556099c9cdba4539804466b301c1bd5ce54f1af0598ed6327984a138356` |
| `visibility_kalteng_2026.json` | 37,080 | `c5b4c4940331e14b3546ee4bcdc8b2a3a01bbc470f016324d31e24fcb7ff451f` |

Image folders (one PNG per day): `vis2014`, `vis2016`, `vis2017`, `vis2018`, `vis2020`, `vis2021`, `vis2022`, `vis2024`,
`vis2026` (92 each) and `vis2023janmar` (90), 215,445 to 484,422 bytes per folder. The 2015 and 2023 files of 14 November
were not rewritten (same sha256 as in 4.5). `app/public/ka-data` is 25 MB in total.

### 14.7 Code changed today (`pipeline/visibility/`, `pipeline/districts/`)

- `build_season.py`: optional `<start MM-DD> <end MM-DD>` after the year. A CSV with a `<csv>.source.json` beside it
  (written by `nrt_parquet_to_csv.py`) is treated as a converted near-real-time copy: rows without `type` are kept, and
  the source block records the mirror, the row counts by quality and `provisional: true`. Without these, output is as
  before: for 2015 and 2023 the filter text and the rule text were compared with the stored files and are identical.
- `build_visibility.py`: optional `<start MM-DD> <end MM-DD> <tag>` after the year (reads `kalteng_<Y>_<tag>_season.json`,
  writes `visibility_kalteng_<Y>_<tag>.json` and `vis<Y><tag>/`); stops when the catalogue returns no file; writes
  `no_file_days` when a sensor file is missing; checks that the season file covers the window.
- `monthly_observability.py`: months are taken from the days in each file; `--files` for other windows;
  `--keep-published` copies a year's published rows without recomputing; months with a day without a sensor file are skipped.
- New: `nrt_parquet_to_csv.py`, `build_blind_rule.py`, `pipeline/districts/build_districts.py`.

### 14.8 The 2019 lock, today

- Nothing was rerun, recomputed or written for Central Kalimantan or Pulang Pisau for 1 January to 31 October 2019.
  `build_season.py` and `build_visibility.py` were not run for 2019; `build_blind_rule.py` skips any file with 2019 in its
  name; `monthly_observability.py` copied the three published 2019 rows unchanged; the district records carry nulls for
  the 14 Central Kalimantan districts in those ten months and the grid check skips them (section 13.2).
- No re-appearance or hidden-fire statistic was computed for any period.
- Housekeeping: the one-line total that `build_season.py` prints about its re-appeared marks was removed from today's
  logs. The same clean-up command also passed over `data-raw/vis2015.log` and `data-raw/vis2023.log` of 14 November; they
  had no such line, so their content is unchanged and only their modification time moved.

## 15. Peat persistence index (persistence of fire activity on peat), added 15 November 2026

Exploratory. Written after looking at the data; **not the registered re-appearance test**, and a different rule from the
per-point "re-appeared" marks of `build_season.py` (those are not used here). The sentence in 14.8 about no re-appearance
statistic describes the work up to that point; this section adds a count of gaps for the seasons other than 2019.
**2019 was not read, computed or emitted**: the script lists the season files by name, skips 2019 without opening it, and
refuses any MODIS file dated 2019. Counts and classes only: no estimate of hidden fire, no statement that fire was present
during a gap, no forecast.

### 15.1 Commands and run time (14:04 UTC, venv python of section 2, nothing installed)

```
.venv/Scripts/python.exe -I pipeline/peat/build_peat_persistence.py data-raw app/public/ka-data data-raw/geoboundaries/geoBoundaries-IDN-ADM2_simplified.geojson data-raw/ss/support/peat/gfw_indonesia_peat_lands.geojson app/public/ss-data/districts/index.json     (30 s; 27 to 35 s over four runs)
.venv/Scripts/python.exe -I pipeline/peat/check_peat_persistence.py data-raw app/public/ka-data data-raw/geoboundaries/geoBoundaries-IDN-ADM2_simplified.geojson data-raw/ss/support/peat/gfw_indonesia_peat_lands.geojson     (5 s)
```

No network access. `build_peat_persistence.py` imports `pipeline/visibility/build_visibility.py` for the grid, the
sinusoidal index and the FireMask reader (that file was not edited).

### 15.2 Rule

- Cell: the 0.01 degree grid of the visibility layer (box 110.7 to 115.9 E, -3.6 to 0.9 N, 520 x 450). A hotspot goes to
  column floor((lon - 110.7) / 0.01), row floor((0.9 - lat) / 0.01), on whole thousandths of a degree.
- Peat: the cell centre lies inside a polygon of the GFW peat layer (source polygons, `make_valid` applied; 205 of the
  1,524 polygons touch the box). District: the cell centre lies inside one of the 14 outlines. 22,880 of the 125,293
  district cells are peat. Barito Utara, Gunung Mas and Murung Raya have no peat cell; Lamandau has 2.
- Gap: two or more days in a row with no VIIRS detection in the cell, between two detection days of the same season
  (1 Aug to 31 Oct). No upper limit on the length. Each gap is one come-back.
- **Persistent peat site: a peat cell detected on three or more days in the season, or detected again after at least one gap.**
- Look on a gap day, from the MODIS FireMask of the 1 km pixel at the cell centre, Terra and Aqua together: fire (7, 8, 9
  from either), else cloud-free look with no fire (5 from either), else cloud (4 from either), else no usable look.
- Gap classes: `modis_fire` when either sensor classed a gap day as fire (the gap exists only in the VIIRS record; this
  fourth class was added to the three asked for, so that those gaps are not called quiet or cloudy); else `seen_quiet`
  when at least one gap day had a cloud-free look with no fire; else `under_cloud` when every gap day was cloud; else `no_data`.
- No water or land mask is applied (a pixel classed water counts as no usable look).

### 15.3 Inputs and checksums

| Input | sha256 |
|---|---|
| `app/public/ka-data/kalteng_<Y>_season.json`, Y = 2014 to 2018, 2020 to 2024, 2026 (11 files, 653,074 hotspots; 57 exactly on the east or south edge of the box left out) | as in 4.5 and 14.6; each is recorded again in the output under `sources.per_season` |
| `app/public/ka-data/visibility_kalteng_<Y>.json`, same years (only for the list of FireMask files and the days without a sensor file) | same |
| `data-raw/modis14a1/*.FireMask.tif`, the 538 files those 11 lists name | each file was checked against the sha256 in its list before reading; all matched |
| `data-raw/ss/support/peat/gfw_indonesia_peat_lands.geojson` | `007628883194fcaac9f6ec4fc62c621a56da01e87699d8fd77817499f5ebca17` (equals its `.source.json`) |
| `data-raw/geoboundaries/geoBoundaries-IDN-ADM2_simplified.geojson` | `146653d488331086ddc43d159a261b01ea6dd08c7ed422e34a9886c3c690430c` |
| `app/public/ss-data/districts/index.json` (only `aoi_id`, name, province) | `b303bfbe7644a69e9ab552df24808a585263629e6c184764269b06fb2dc4d6ba` at 14:04 UTC |

Peat licence line, exactly as in `gfw_indonesia_peat_lands.geojson.source.json`:
`UNVERIFIED (GFW open data portal; CC BY 4.0 assumed; original: Kementan/BBSDLP peat map)`. It was not verified here either.

### 15.4 Totals (peat cells of the 14 districts)

| Season | peat cells with fire | persistent peat sites | come-backs | under cloud | seen quiet | no data | MODIS fire in the gap |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2014 | 4,874 | 2,922 | 4,964 | 3 | 4,010 | 0 | 951 |
| 2015 | 9,648 | 7,271 | 15,279 | 4 | 12,560 | 5 | 2,710 |
| 2016 | 180 | 31 | 29 | 0 | 27 | 0 | 2 |
| 2017 | 134 | 30 | 40 | 0 | 34 | 0 | 6 |
| 2018 | 1,426 | 626 | 678 | 0 | 522 | 0 | 156 |
| 2020 | 24 | 1 | 1 | 0 | 1 | 0 | 0 |
| 2021 | 36 | 1 | 1 | 0 | 1 | 0 | 0 |
| 2022 | 11 | 1 | 3 | 0 | 3 | 0 | 0 |
| 2023 | 2,598 | 1,358 | 1,833 | 1 | 1,451 | 0 | 381 |
| 2024 | 186 | 32 | 36 | 0 | 31 | 0 | 5 |
| 2026 (provisional) | 8,407 | 5,840 | 8,612 | 17 | 6,619 | 3 | 1,973 |
| **11 seasons** (site-seasons) | **27,524** | **18,113** | **31,476** | **25** | **25,259** | **8** | **6,184** |

**What the numbers say, plainly.** Gaps with no cloud-free look are rare in Aug to Oct: 25 of 31,476 come-backs (0.08%),
and all 17 of 2026 include a day on which only one MODIS sensor had a file. 80.2% of the come-backs were "seen quiet" and
19.6% had MODIS fire on a gap day. This agrees with the visibility layer, where 5.5% to 7.9% of the no-fire cell-days of
2015, 2023 and 2026 had no cloud-free look (the FireMask is a daily composite, so one clear pass is enough). So in the dry
season the cloud map explains very few of the gaps on peat; the larger caveat is smoke: thick smoke is usually not flagged
as cloud, so a "seen quiet" day can be a day under smoke.

Most recent season with a persistent peat site, per district (2026 for all eleven that have one, provisional):

| District | peat cells | persistent peat sites 2026 | come-backs | under cloud / seen quiet / no data / MODIS fire | sites in the file |
|---|---:|---:|---:|---|---:|
| Barito Selatan | 1,476 | 149 | 227 | 0 / 193 / 0 / 34 | 40 |
| Barito Timur | 289 | 6 | 9 | 0 / 7 / 0 / 2 | 6 |
| Kapuas | 3,384 | 881 | 1,276 | 1 / 956 / 0 / 319 | 40 |
| Katingan | 3,801 | 415 | 549 | 0 / 400 / 0 / 149 | 40 |
| Kota Palangka Raya | 914 | 320 | 803 | 0 / 633 / 0 / 170 | 40 |
| Kotawaringin Barat | 1,915 | 519 | 645 | 4 / 462 / 1 / 178 | 40 |
| Kotawaringin Timur | 2,610 | 896 | 1,393 | 1 / 1,074 / 0 / 318 | 40 |
| Lamandau | 2 | 1 | 0 | 0 / 0 / 0 / 0 | 1 |
| Pulang Pisau | 5,335 | 1,434 | 1,765 | 8 / 1,330 / 0 / 427 | 40 |
| Seruyan | 2,300 | 891 | 1,233 | 3 / 978 / 2 / 250 | 40 |
| Sukamara | 854 | 328 | 712 | 0 / 586 / 0 / 126 | 40 |

367 sites are listed (top 40 per district by days detected, then come-backs).

### 15.5 Checks (`check_peat_persistence.py`: no shapely, own cell arithmetic with Decimal, own MODIS pixel lookup; exit 0)

- District rows add up to each season row, the four classes add up to the come-backs, the seasons add up to the total.
- All 367 listed sites: are cell centres; lie inside their district outline and inside a peat polygon (even-odd ray cast on
  the raw GeoJSON rings); also all lie inside the drawn `peat_kalteng.geojson`; meet the rule; are in ranking order; and
  their days, first and last date, detections, night share and gaps equal a recount from the season file.
- Three sites by hand, 2026 (detections per day read from the season file, FireMask classes read per gap day):
  - Kotawaringin Barat, 111.575, -2.905: 11 days, 7 to 29 Oct, 14 of 19 detections at night (0.74). Gaps: 12 to 16 Oct
    `modis_fire` (Terra 8 on 13 Oct, 9 on 15 Oct); 19 to 20 Oct `seen_quiet` (Terra 5 on 19 Oct, no Aqua file);
    25 to 28 Oct `under_cloud` (Aqua 4 on all four days, no Terra file).
  - Barito Selatan, 114.685, -2.235: 17 days, 10 Aug to 14 Sep, 25 of 32 at night (0.78). Gaps: 20 to 21 Aug `modis_fire`
    (Aqua 8 on 21 Aug); 25 to 27 Aug and 30 Aug to 2 Sep `seen_quiet`; 6 to 13 Sep `modis_fire` (8 and 9 on 8 and 10 Sep).
  - Barito Selatan, 114.635, -2.415: 14 days, 7 to 23 Oct, 23 of 26 at night (0.88). One gap, 19 to 20 Oct, `modis_fire`
    (Terra 9 on 20 Oct, no Aqua file).
  All three agree with the file.

### 15.6 Files written (sha256)

| File | bytes | sha256 |
|---|---:|---|
| `app/public/ka-data/peat_persistence_kalteng.json` | 220,171 | `6032b083df8b5619a3958ef67542fa2d796b730bf6b1aa8fc99f9b75c720bca6` |
| `app/public/ka-data/peat_kalteng.geojson` (206 features; clipped to the box, simplified at 0.0005 degree, 4 decimals; the unsimplified clip was over 1.5 MB) | 327,182 | `f129d7ae1158f1be17e08ac8e04c5691dd113f8de2b97c7ebbd405e4fc420687` |
| `pipeline/peat/build_peat_persistence.py` | | `a9e72963a6fb459b7b8ba7940db82c569f1cbabff8c29fb6275154034a9fb9c9` |
| `pipeline/peat/check_peat_persistence.py` | | `5f3ddbdb416c59f08e7c18945cc8be4862249bd8d25a8fe6efae93bb10079d59` |

No existing season or visibility file was modified.

### 15.7 What was not done

- 2019 (locked), Aug to Oct 2025 (no season file) and the Jan to Mar 2023 wet quarter are not in the index.
- No upper limit on a gap, and nothing outside 1 Aug to 31 Oct is seen, so long gaps (re-burning weeks later) count the
  same as short ones; each listed site carries its gaps with their length, the totals do not split by length.
- No check on the ground and no comparison with burned-area or peat-depth data. The peat layer licence is unverified.
- Not wired into the app here, and no unit test was written (only the check script). No log file was kept.
- Seen while reading, not changed: `build_visibility.py` places a VIIRS hotspot with `int((lon - W) / STEP)` in floating
  point, which puts a hotspot lying exactly on a cell edge one cell off (113.42 gives column 271, not 272). It only
  decides which of two neighbouring cells is marked fire in the visibility layer; the peat index does not use that mark.
