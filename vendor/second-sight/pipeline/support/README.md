# pipeline/support — supporting data

All downloads go to `${SS_DATA_DIR:-D:/Lomba/Hackathon/nasa/second-sight-data}/support/`, never into
the repo. Each downloaded file gets a `<file>.source.json` sidecar (URL, UTC download time, sha256,
bytes, license) that DAT-04 can merge into `data_manifest.json`.

Install: `pip install -r requirements-support.txt`. Tests: `python -m pytest tests/support`.

## DAT-03 · Supporting data

| Item | Module / file | Source | License | Status |
|---|---|---|---|---|
| Provinces (ADM1, 34) | `boundaries.py` | geoBoundaries **gbHumanitarian** IDN ADM1 (OCHA ROAP / HDX, BPS-derived, 2019) | CC BY 3.0 IGO (from API metadata) | downloaded |
| Regencies (ADM2, 522) | `boundaries.py` | geoBoundaries gbHumanitarian IDN ADM2 | CC BY 3.0 IGO | downloaded |
| Peat | `peat.py` | GFW "Indonesia peat lands" ArcGIS layer (Kementan/BBSDLP-derived) | **unverified**, see below | see `peat/*.source.json` |
| SiPongi burned area | `sipongi_burned_area.csv` | media / data portals citing SiPongi (KLHK) | facts; cited per row | national 2015-2024 |
| ONI / DMI | — | owned by `pipeline/science/enso.py` | — | not here |
| KHG | — | not yet available | — | TODO (see below) |

**Why not gbOpen:** `gbOpen/IDN/ADM1` comes from OpenStreetMap/Wambacher and is **ODbL 1.0**.
`download_boundaries()` checks the license field on every run and refuses ODbL.

Usage:
```python
from pipeline.support.boundaries import label_admin
from pipeline.support.peat import label_peat
prov = label_admin(lats, lons, "ADM1")   # list[str | None]
is_peat = label_peat(lats, lons)        # np.ndarray[bool]
```

### Peat map: sources and fallback
1. **Primary (used):** GFW "Indonesia peat lands", ArcGIS item `d52e0e67ad21401cbf3a2c002599cf58`,
   REST layer `https://gis-gfw.wri.org/arcgis/rest/services/country_data/asia/MapServer/10`
   (1524 polygons; paged GeoJSON query, generalised with `maxAllowableOffset=0.002°`).
   The item has no `licenseInfo`. GFW open data is generally CC BY 4.0, but this is **not verified**
   for this layer. Before freeze: confirm on https://data.globalforestwatch.org (dataset
   "Indonesia peat lands") and cite Ritung et al. 2011, Kementan/BBSDLP.
2. **Fallback:** PEATMAP (Xu, Morris, Liu & Holden 2018, *Catena* 160:134-140),
   University of Leicester data repository, doi:10.25392/leicester.data.7313270 (shapefiles per
   region; the SE Asia part derives from the same Indonesian national maps).
3. **Second fallback:** BRGM/Kementan "Peta Sebaran Lahan Gambut 2019 (1:50.000)" via
   https://tanahair.indonesia.go.id (Ina-Geoportal). Requires a manual download; check the license.

### KHG
No open KHG (Kesatuan Hidrologis Gambut) vector was found in the time available. Plan: check
SIPPEG/KLHK (https://pkgppkl.menlhk.go.id) and Ina-Geoportal. If neither works, use the peat
polygons dissolved per island as an *indicative* unit, labelled "indikatif, bukan KHG resmi".

### SiPongi burned area
`sipongi_burned_area.csv` columns: `year, province, burned_area_ha, source_url, accessed_date,
verification_status, notes`. `province = NATIONAL` for national totals.
`verification_status`: `verified_2_sources` (two independent citations of SiPongi/KLHK agree),
`single_secondary_source` (one secondary source citing SiPongi). No numbers are typed from memory.
TODO: cross-check on https://sipongi.menlhk.go.id/indikasi-luas-kebakaran (rekapitulasi per
province) and add province rows for 2015, 2019 and 2023.

## DAT-05 · Data health (`data_health.py`)
- `missing_data`: the FIRMS page loads its table from `/api/missing_data/?action=fetch_data`
  (JSON with HTML rows, no key needed). Parsed into `{date, satellite, data_type: SP|NRT}`.
- `data_availability`: `/api/data_availability/csv/{FIRMS_MAP_KEY}/ALL`, skipped if the env var is
  missing (status recorded in the JSON).
- Breaks: Pettitt test with binary segmentation on smoothed `log1p(daily count)` per satellite;
  zero-count runs reported as `gaps`. Each break/gap is matched to `KNOWN_EVENTS` (±45 days) or
  labelled `tak terjelaskan`. Event dates come from the task brief and still need checking.
- Run with counts from `pipeline/data`: `python -m pipeline.support.data_health --counts daily_counts.csv`
  (`date,satellite,count`). The schema is in the module docstring.

## DAT-11 · Climate (`climate.py`)
- CHIRPS v2.0 monthly GeoTIFFs moved to `https://data.chc.ucsb.edu/products/CHIRPS/v2.0/global_monthly/tifs/`
  (the old `/products/CHIRPS-2.0/` path returns 404). Each month is cropped to the Indonesia bbox and
  saved as `.npz`; the global file is thrown away. Read with Pillow, so no GDAL is needed.
- `python -m pipeline.support.climate --download-only --start 2001-01 --end 2026-09 --workers 6`, then
  `python -m pipeline.support.climate --start 2001-01 --end 2026-09` writes `climate_monthly.parquet`
  (provinces + NATIONAL, `precip_1m_mm_day`, `precip_3m_mm_day`).
- Not done: Drought Code (GEFF-ERA5) needs a CDS account. KHG aggregation works once KHG polygons
  exist (pass them as `units`).

## DAT-10 · Cloud observability (`cloud.py`)
- Access and layer names were checked against the MODIS C6/C6.1 Fire User's Guide v1.0 (§4.3, §5.4):
  SFTP `fuoco.geog.umd.edu`, login `fire` (the password is published in the guide), directory
  `data/MODIS/C6/Mx14CMQ`, files `M?D14CMQ.YYYYMM.006.VV.hdf` (HDF4, 0.25°, 1440×720), layers
  `CloudPix` and `TotalPix` (int32).
- Download is **manual** (an SFTP client is needed). Put the files in `${SS_DATA_DIR}/support/cloud/cmg_hdf/`
  and run `python -m pipeline.support.cloud`. HDF4 reading needs `pyhdf` or GDAL (neither is installed yet).
- Fallback: ERA5 monthly total cloud cover (CDS), flagged `source=ERA5`.
