# Credits and third-party code

Second Sight is MIT-licensed (see `LICENSE`). We build on public data, open-source libraries and ideas from other public repositories. All of them are listed here and in the References field of the Space Apps project page.

## Third-party repositories

License texts are stored in `THIRD_PARTY_LICENSES/`. We borrow infrastructure, UX patterns and test designs. The harmonization science (calibration, strata, uncertainty, validation) is our own implementation.

| Repository | License | What we borrow | License file |
|---|---|---|---|
| [portolan-mirrors/firms-catalog](https://github.com/portolan-mirrors/firms-catalog) | Apache-2.0 | GeoParquet mirror of the FIRMS archive, remote bbox queries with DuckDB (data access path, cross-checked against official FIRMS CSV) | `firms-catalog-LICENSE` |
| [Warren-530/fire-harmony](https://github.com/Warren-530/fire-harmony) | Apache-2.0 | Frontend architecture pattern: DuckDB-WASM reading Parquet over HTTP + MapLibre + deck.gl + Observable Plot; seam/placebo test design | `fire-harmony-LICENSE` |
| [squadronzero/project-shift](https://github.com/squadronzero/project-shift) | Apache-2.0 | Pre-registration of test rules before running; no-data mask pattern; frontend utilities (added by the frontend team) | `project-shift-LICENSE` |
| [tttamannaanand/burn-calendar](https://github.com/tttamannaanand/burn-calendar) | MIT | Calendar UX patterns (shareable URL state, keyboard navigation, light/dark theme); weekly quantile mapping as an ablation baseline | `burn-calendar-LICENSE` |
| [the-aris-club/flare-chronos](https://github.com/the-aris-club/flare-chronos) | MIT | Reference for pixel footprint from scan angle, day/night via solar zenith angle, observation-effort normalization; PDF brief with WeasyPrint | `flare-chronos-LICENSE` |

Neither Apache-2.0 repository ships a `NOTICE` file (checked 14 Nov 2026).

### Techniques cited as inspiration only (no license, no code copied)

| Repository | Idea re-implemented by us |
|---|---|
| Aalvee-Aarham/kiln-watch | MODIS-denial test design; day/night ratios with empirical Bayes shrinkage; calibration chain closure |
| EdisonShiny/eg-firetrack | Mapping response rules to Indonesian agencies (BPBD, Manggala Agni, BNPB) |
| Icarus (mdhabibullah) | Pre-registered experiment list and coverage rules |

### Method from a GPL-3.0 repository

The Sofiev & Kouznetsov (2026) MODIS/VIIRS detection operator is re-implemented from the published equations and cited. We do not use code from `fmidev/FRP_OOp` (GPL-3.0).

## Open-source libraries

Licenses are verified at install time; this list is updated as dependencies are added.

| Library | License | Used for |
|---|---|---|
| DuckDB / duckdb-wasm | MIT | Pipeline queries; in-browser Parquet queries |
| pandas, NumPy, SciPy | BSD-3 | Pipeline data processing and statistics |
| statsmodels | BSD-3 | Statistical models and tests |
| ruptures | BSD-2 | Change-point detection (seam tests) |
| pymannkendall | MIT | Trend tests |
| GeoPandas / Shapely | BSD-3 | Spatial joins (peat, KHG, admin boundaries) |
| MapLibre GL JS | BSD-3 | Web map |
| PMTiles | BSD-3 | Static vector tiles |
| deck.gl | MIT | Map overlays |
| Observable Plot / Apache ECharts | ISC / Apache-2.0 | Calendar and charts |
| Vite, TypeScript | MIT / Apache-2.0 | Frontend build |
| FastAPI | MIT | Thin optional backend |
| WeasyPrint | BSD-3 | PDF brief |

## Data

NASA data: FIRMS MODIS C6.1 (Terra, Aqua), FIRMS VIIRS 375 m C2 (S-NPP, NOAA-20, NOAA-21), MODIS Climate Modeling Grid (MOD14CMQ/MYD14CMQ), MCD64A1 burned area. Non-NASA data sources and versions are listed in `docs/data_provenance.md` (added by the data team).
