# Project 4: data run (what was run, with what, and what came out)

Written by the data work of project 4 on 14 November 2026 (all times UTC). Everything below was measured on this
machine in this session; nothing is copied from another run. Paths are relative to the project 4 root.

## 1. Result in one table

| Item | Where | Status |
|---|---|---|
| Second Sight bundle (40 areas x 313 months, 2000-11 to 2026-11) | `app/public/ss-data/index.json`, `monthly_<aoi_id>.json`, `grid005/*.parquet` | built, `harmonized: true` |
| Validation (94 entries, **1000 bootstrap resamples**) | `app/public/ss-data/validation_results.json` | 15 pass, 11 fail, 55 descriptive, 4 not applicable, 9 not run |
| Finding (n_boot 300, the script's own default) | `app/public/ss-data/finding.json` | built, marked PRELIMINARY by Second Sight |
| Central Kalimantan season files 2015, 2023 | `app/public/ka-data/kalteng_{2015,2023}_season.json` | built |
| Central Kalimantan visibility files 2015, 2023 | `app/public/ka-data/visibility_kalteng_{2015,2023}.json`, `vis2015/`, `vis2023/` (92 PNG each) | built |
| Monthly observability, `prov-kalimantan-tengah`, Aug-Oct 2015, 2019, 2023 | inside `monthly_prov-kalimantan-tengah.json`, listed in `index.json` `obs_months` | 9 months filled, all other months `obs_class: null` |
| 2019 season and visibility files | `app/public/ka-data/*2019*` | **not touched, not rerun** |

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

| File | sha256 |
|---|---|
| `app/public/ss-data/index.json` | `8589edc39ce8777bc30fb5f2dbaae9bc6f261d0c0077887c989cb1ce9b4f13f0` |
| `app/public/ss-data/validation_results.json` | `b3b90902a33d1c2847b191a712c857bd30038ee7c0344a063fd52b8f15f4adaf` |
| `app/public/ss-data/finding.json` | `e07af24bd7fef585d248121e43c4d5a137320458c8b6ae346d6b1db03cb2df8c` |
| `app/public/ss-data/monthly_prov-kalimantan-tengah.json` | `459827b22e45684d105f46487d6b934a902c7e5fb42c1a1495da8e4fd31e5a3c` |
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
`index.json`, `validation_results.json` and `finding.json` (43 JSON files, 3,541,183 bytes) and `grid005/` with 27 yearly
Parquet files (10,693,349 bytes). The app does not read `grid005/`; the root `.gitignore` rule `*.parquet` keeps those files
out of git, and `bash scripts/publish_ss_data.sh` re-creates them.

## 6. Second Sight outputs

### 6.1 Unit tests (`python -m pytest -q -rs tests`)

| Run | Result |
|---|---|
| empty scratch data dir (probe, before any data) | 169 passed, 37 skipped, 72 s |
| real data, no bundle yet (two runs) | 180 passed, 25 skipped, 1 xfailed, 59 to 65 s |
| real data, bundle present, no CSV export | 192 passed, **1 failed**, 12 skipped, 1 xfailed, 75 s. The failure is `tests/blackbox/test_cli.py::test_bundle_csv_header_comments_and_columns`: it expects `bundle/csv/*.csv`, which only the separate EXP-02 export creates (step 17). Not a pipeline defect. |
| after step 17 (**final run**) | **193 passed, 12 skipped, 1 xfailed, 64 s** |
| the 12 skipped (`tests/agent/*`) with `SECOND_SIGHT_BUNDLE=data-raw/ss/bundle` | 10 passed, **2 failed**: `test_eval_rule_planner` (plan accuracy 0.78 < 0.90) and `test_resolve_alias_and_typo` ("sumatera selatan" resolves to `prov-sumatera-selatan`, the test expects `region-sumatra`). These are the same two failures Second Sight lists as bug B9 in its own `docs/test_report.md`; the agent package is not used by project 4. |

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
NOAA-20 for 2026-11 only. August to October sums of the harmonized series `H` (fire cell-days, Aqua-equivalent scale):

| Season | H | Raw Aqua | Raw S-NPP | Sensor |
|---|---:|---:|---:|---|
| Aug-Oct 2015 | 18,302 | 18,302 | 103,976 | Aqua (no calibration uncertainty) |
| Aug-Oct 2023 | 3,375.6 | 4,139 | 17,494 | S-NPP x pooled kappa, **no interval** (see 8.1) |

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

1. **Province series after 2021 use the pooled national kappa and have no interval.** In Second Sight's own
   `bundle._science_adapter`, the province table carries `is_peat` values `peat` and `mineral`, but kappa is fitted on the
   unlabelled table (`is_peat` = `unknown`). The strata keys then do not match, and `series._lookup` falls back to the
   pooled ratio. Checked on `prov-kalimantan-tengah`: in all 58 S-NPP-era months `H / V_raw` is exactly 0.192959 (the
   pooled national kappa) and `H_lo = H_hi = H`; the code path is the same for every province. The national and island
   series use stratified kappa (ratios 0.15 to 0.27) and do have bands. The documented design ("provinces use the parent
   island_region kappa strata") is not what the export does. **Not patched** (it changes the method; it is not needed to
   make anything run). It does not touch 2015 and 2019 (Aqua era, `H = A_raw`); it does touch Central Kalimantan 2023
   and 2026. The app should not draw a band for a province after 2021 and should say those values use the national ratio.
   A likely fix is in `bundle.to_science_schema` (give the province table the `is_peat` value used in the fit); not tried.
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

### 9.1 Patches to `vendor/second-sight/`: **none**

`git diff -- vendor` is empty. Every Second Sight module ran unmodified on Python 3.12.8 with pandas 3.1.1 and numpy 2.5.4
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
