# Headline finding (VAL-04) — PRELIMINARY

Computed by `pipeline/run/finding.py` from the pipeline itself (not copied from the audit
draft). Output: `${SS_DATA_DIR}/derived/finding.json`.

## Finding

**The audit candidate F1 ("El Niño 2023 looks 1.7x bigger than 2015 in the raw record") is
NOT supported by the pipeline numbers and must not be used.** In both the raw-concat record
and the harmonized series, 2023 is about one third of 2015 (raw 0.31x, harmonized 0.33x),
because 2015 and 2023 both fall after the 2012 MODIS->VIIRS switch in the raw record, so a
naive user compares S-NPP with S-NPP.

What the data does show is a trend artefact:

- EN: Naively splicing MODIS (to 2011) with VIIRS S-NPP (from 2012) produces an upward
  2001-2025 trend in Indonesian hotspot activity (+1,740 cell-days/yr, Theil-Sen), while on
  the harmonized Aqua-equivalent scale the trend is downward (-1,614 cell-days/yr): the
  apparent rise is entirely a sensor artefact (PRELIMINARY).
- ID: Penyambungan langsung MODIS (hingga 2011) dengan VIIRS S-NPP (sejak 2012) menghasilkan
  tren naik aktivitas titik panas Indonesia 2001-2025 (+1.740 sel-hari/tahun, Theil-Sen),
  sedangkan pada skala harmonis setara-Aqua trennya turun (-1.614 sel-hari/tahun): kenaikan
  yang tampak sepenuhnya artefak sensor (PRELIMINER).

## Computation

- Unit: cell-days (`n_cells` in `derived/monthly_stratum.parquet`), summed over strata.
- Raw concat (M0): Terra/Aqua counts to 2011-12, S-NPP counts from 2012-01, kappa = 1
  (`build_series(..., kappa_one, aqua_end=(2011,12))`; Terra months use raw Terra counts).
- Harmonized H (M3): `fit_kappa(ms, CAL_YEARS, n_boot=300)` + `terra_to_aqua`, then
  `build_series(..., aqua_end=(2021,12))`: Terra*r (to 2002-06), Aqua native (2002-07..2021-12),
  S-NPP*kappa_s (2022-01..2026-10). Grouped by `island_region`.
- 2026: `derived/monthly_stratum_2026nrt.parquet` (NRT, provisional), Jan-Oct (last S-NPP-era
  month; 2026-11 is NOAA-20 era and excluded). Year-to-date comparisons use Jan-Oct of every year.
- Intervals: 5/95 percentiles of the kappa bootstrap per month, summed over months
  (comonotone approximation; kappa draws are shared across months). 2015 and 2019 are in the
  Aqua era with no calibration uncertainty, so ratio bounds are H_lo/H_2015 and H_hi/H_2015.
- Trend: Theil-Sen slope of annual totals 2001-2025. Artefact share = 1 - slope_H/slope_raw
  (> 1 means the sign flips).
- SiPongi: national burned area 2015, 2019, 2023 (`pipeline/support/sipongi_burned_area.csv`,
  all three `verified_2_sources`); rank comparison only, n = 3.

## Numbers (national unless stated; cell-days)

| window | year | raw | H [5-95] |
|---|---|---|---|
| annual | 2015 | 496,510 | 91,448 |
| annual | 2019 | 242,791 | 47,684 |
| annual | 2023 | 155,333 | 30,197 [28,565-31,610] |
| Aug-Oct | 2015 | 408,625 | 75,436 |
| Aug-Oct | 2019 | 186,259 | 38,340 |
| Aug-Oct | 2023 | 118,569 | 23,164 [21,906-24,247] |
| Aug-Oct | 2026 (prov.) | 319,050 | 54,652 [50,931-57,398] |
| Jan-Oct | 2026 (prov.) | 352,333 | 60,878 [56,776-63,934] |

Ratios to 2015 (raw / H [5-95]):

| region | window | 2019/2015 | 2023/2015 | 2026/2015 (prov.) |
|---|---|---|---|---|
| national | annual | 0.49 / 0.52 | 0.31 / 0.33 [0.31-0.35] | - |
| national | Aug-Oct | 0.46 / 0.51 | 0.29 / 0.31 [0.29-0.32] | 0.78 / 0.72 [0.68-0.76] |
| national | Jan-Oct | 0.46 / 0.50 | 0.30 / 0.32 [0.30-0.34] | 0.76 / 0.71 [0.66-0.74] |
| Kalimantan | annual | 0.46 / 0.52 | 0.27 / 0.32 [0.31-0.33] | - |
| Kalimantan | Aug-Oct | 0.43 / 0.50 | 0.24 / 0.28 [0.27-0.29] | 0.83 / 0.79 [0.74-0.82] |
| Sumatra | annual | 0.47 / 0.58 | 0.21 / 0.25 [0.23-0.26] | - |
| Sumatra | Aug-Oct | 0.47 / 0.61 | 0.21 / 0.25 [0.24-0.27] | 0.36 / 0.40 [0.37-0.43] |

Trend 2001-2025 (Theil-Sen, cell-days/yr):

| region | raw | H | artefact share |
|---|---|---|---|
| national | +1,740 | -1,614 | 1.93 (sign flip) |
| Kalimantan | +420 | -688 | 2.64 (sign flip) |
| Sumatra | +34 | -699 | 21.8 (raw ~flat; not meaningful as a share) |

The slopes of the summed H_lo/H_hi series (national -1,655 / -1,702) are not a confidence
interval for the slope; no slope CI was computed (no bootstrap over years). The sign of the
H slope is the same in both bound series.

SiPongi (descriptive): burned area ratios 2019/2015 = 0.63, 2023/2015 = 0.44. Rank order
2015 > 2019 > 2023 in burned area, raw and H (Spearman 1.0 for both; n = 3, so this does
not discriminate raw from H). H ratios are slightly closer to the burned-area ratios than raw
(2023/2015: H 0.33, raw 0.31, BA 0.44), but hotspot cell-days and burned area are different
quantities; no claim of agreement is made.

## Caveats

- PRELIMINARY. Peat labels pending: `peat` is `unknown` in every row, so the peat/mineral
  stratum is not active in kappa.
- Island regions are approximate boxes, not official boundaries.
- 2026 is NRT, provisional, Jan-Oct only (season may not be complete; NRT may be revised).
- **2023 and 2026 rely on the S-NPP*kappa era, whose seam test FAILED.** V3 seam 2022-01
  (M3/main): Delta_seam = 0.365 [0.110-0.555], outside the placebo 90% range [-0.240, 0.047],
  Pettitt p = 0.001 (`derived/validation_results.json`). A level shift at the switch from
  Aqua to S-NPP*kappa means the 2023/2015 and 2026/2015 H ratios may carry a bias that the
  kappa bootstrap intervals do NOT include. The intervals above are calibration-sampling
  intervals only. The 2019/2015 ratio and the 2001-2021 part of the trend are Aqua-native and
  unaffected; the trend sign flip is driven by the 2012 splice in the raw series, which the
  2012-01 seam test fails for the raw splice (M0/switch2012: Delta = 1.519 [1.452, 1.625],
  Pettitt p < 0.001) and passes once kappa is applied (M3/switch2012: Delta = -0.057
  [-0.117, 0.041]), which is the independent evidence that the raw rise is a splice artefact.
- Hotspot cell-days are an index of fire activity, not burned area or emissions.

## Run metadata

- code commit (main merged): 40550a2d760581df7183ec06ed236b5484160918
- data_manifest.json sha256: f2849b7bd063a6f3399cd47241714ed9597fc87bf37db0d12c83959fe8dbf981
- monthly_stratum.parquet sha256: 7d9c698ec8b37801ac579707c846d02b4c162837cc3c28784d99d34beb6ab8b4
- monthly_stratum_2026nrt.parquet sha256: b53988d5c56324700303f05ce9f885dcfc99b9dbb7b59460c300790db7ad0adc
- run 2026-11-14T02:35:39Z, n_boot = 300
- reproduce: `SS_DATA_DIR=<data> python -m pipeline.run.finding`
