# VAL-09 · Peat hypotheses H1-H3: results

- **Run date:** 2026-11-14 09:30 WIB
- **Code commit:** `9298b06` (DAT-03 labelling, `pipeline/data/labels.py`) on top of main `d464207`;
  test code `pipeline/science/peat.py` unchanged from main.
- **Rules:** `docs/validation_plan.md` §2 (H1-H3), pre-registered, not changed.
- **Input:** `derived/monthly_stratum_labeled.parquet`, built by `python -m pipeline.data.labels`
  from `derived/daily_cell.parquet` (FIRMS archive, cleaned by `pipeline/data`).
- **Window / domain:** CAL_YEARS 2012-2021, island_region in {Sumatra, Kalimantan}.
- **Statistic:** ρ = Σ S-NPP fire cell-days / Σ Aqua fire cell-days (0.01° cells).
- **CI:** 90 %, year-block bootstrap, n_boot = 1000, seed 20261114 (H3: El Niño years and other
  years resampled separately).
- **ENSO classes:** `derived/enso_class.json` (ONI JAS ≥ +0.5 → El Niño). In 2012-2021 only **2015**
  is classed El Niño.

## Data sources for the labels

| Label | Source | Version / file | License |
|---|---|---|---|
| peat | GFW "Indonesia peat lands" (Kementan/BBSDLP-derived, Ritung et al. 2011), ArcGIS MapServer/10, 1524 polygons, generalised 0.002° | `support/peat/gfw_indonesia_peat_lands.geojson`, downloaded 2026-11-14T02:10:54Z, sha256 `00762888…5ebca17` | **UNVERIFIED** (GFW open data, CC BY 4.0 assumed; must be confirmed before freeze) |
| province / regency | geoBoundaries gbHumanitarian IDN ADM1 (34) / ADM2 (522), OCHA ROAP/HDX, BPS-derived, 2019 | `support/boundaries/geoBoundaries-IDN-ADM{1,2}-gbHumanitarian_simplified.geojson` | CC BY 3.0 IGO |

Labelling rule (per distinct 0.01° cell centroid, shapely STRtree): `peat` if the centroid is in a
peat polygon; `mineral` if it is inside a province polygon but not peat; `unknown` otherwise
(offshore / outside ADM1).

## Label coverage

| | value |
|---|---|
| distinct cells in daily_cell | 612 442 |
| cells with a peat/mineral label | 99.31 % |
| cells with province (and regency) | 99.30 % |
| cells on peat | 10.06 % |
| detections with label `unknown` | 0.27 % |
| detections on peat, all years, all satellites (of labelled) | 28.01 % |

Share of detections on peat by year (% of labelled detections, from `labels_report.json`):

| year | Aqua | Terra | S-NPP | NOAA-20 |
|---|---|---|---|---|
| 2002-2011 range | 12.6-27.1 | 25.3-48.8 | – | – |
| 2014 | 32.5 | 50.7 | 41.0 | – |
| **2015** | 25.8 | 37.8 | 38.0 | – |
| 2016 | 15.0 | 28.1 | 15.7 | – |
| 2017 | 9.8 | 18.1 | 7.3 | – |
| 2018 | 19.3 | 36.5 | 20.3 | 19.2 |
| **2019** | 34.0 | 49.4 | 37.8 | 38.1 |
| 2020 | 12.4 | 25.7 | 6.2 | 6.1 |
| 2021 | 14.7 | 32.8 | 9.8 | 10.0 |
| 2022 | 9.5 | 25.1 | 10.1 | 8.3 |
| 2023 | 16.3 | 30.6 | 18.1 | 17.7 |
| 2024 | 8.2 | 19.5 | 6.2 | 7.1 |
| 2025 | 8.7 | 19.2 | 7.6 | 7.6 |

Sanity check: the peat share in 2015 and 2019 (S-NPP 38 %, Aqua 26-34 %) is well above the
2016-2025 non-crisis years (S-NPP 6-20 %), as expected. 2013-2014 are also high (Riau peat fires).
2015 is not the yearly maximum of the share (2014 is higher); not investigated further.

The NRT 2026 file was labelled too (`*_2026nrt` outputs): 266 350 cells, 98.28 % labelled,
29.76 % of detections on peat.

## ρ per stratum (Sumatra + Kalimantan, 2012-2021)

| stratum | Aqua cell-days | S-NPP cell-days | ρ (VIIRS : Aqua) | 90 % CI |
|---|---|---|---|---|
| peat, day | 56 917 | 214 199 | 3.763 | [3.402, 4.002] |
| peat, night | 30 295 | 238 084 | 7.859 | [6.815, 8.862] |
| mineral, day | 164 315 | 620 238 | 3.775 | [3.627, 4.048] |
| mineral, night | 14 189 | 193 699 | 13.651 | [12.775, 15.811] |

(The per-stratum ρ CIs come from a separate bootstrap call with the same seed; the hypothesis CIs
below come from `peat_hypotheses()` itself.)

## Decisions

| hypothesis | statistic | estimate | 90 % CI | rule | decision |
|---|---|---|---|---|---|
| H1 day | log ρ_peat − log ρ_mineral (D) | −0.003 | [−0.147, 0.088] | CI > 0 | not > 0 |
| H1 night | log ρ_peat − log ρ_mineral (N) | −0.552 | [−0.722, −0.463] | CI > 0 | not > 0 (CI < 0) |
| **H1** | | | | CI > 0 day and night | **rejected** |
| **H2** | log ρ_night − log ρ_day (peat) | +0.736 | [0.663, 0.855] | CI > 0 and ρ CIs do not overlap (ρ_N [6.76, 8.78] vs ρ_D [3.38, 4.00]) | **accepted** |
| **H3** | log ρ_ElNiño − log ρ_other (peat, D+N pooled) | +0.285 | [0.226, 0.390] | CI < 0 | **rejected, opposite sign** |

Reading:
- **H1 rejected.** In the day VIIRS sees the same multiple of Aqua cell-days on peat and on mineral
  soil. At night VIIRS's advantage is *smaller* on peat than on mineral soil (ρ 7.9 vs 13.7),
  i.e. peat night fires are relatively more visible to MODIS (persistent smouldering fronts large
  enough for 1 km pixels), the opposite of the H1 premise.
- **H2 accepted.** On peat, ρ at night is about 2.1× ρ in the day.
- **H3 rejected, opposite sign.** In 2015 ρ on peat was higher than in other years (+33 %). Per
  the pre-registered wording, this points to smoke obscuration (which hurts MODIS more) dominating
  the fire-size effect. Caveat: only one El Niño year (2015) is in the window, so the CI only
  reflects the variability of the other years.

## Caveats / limitations

- Peat map license is unverified (see table); polygons are generalised to 0.002°, and labels are
  assigned at 0.01° cell centroids, so cells on peat edges can be misclassified.
- `unknown` (0.27 % of detections) is treated as not-peat by `standardize_monthly`; it is too small
  to affect the decisions.
- `pipeline/science/run.py` still reads `monthly_stratum.parquet` (unlabelled) by default; to get
  peat-stratified κ in the main run use `--input <derived>/monthly_stratum_labeled.parquet`.
- Raw results: `derived/val09_peat_results.json` (not committed; data dir).
