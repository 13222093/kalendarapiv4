# Physics, triangulation and decision results (real data)

- Run date: 2026-11-14, 02:27 UTC (09:27 WIB)
- Code commit used for the run: `ca7e3b1874e00605edd27085b175d16f78afae0e`
- Data manifest: `data_manifest.json` sha256 `f2849b7bd063a6f3399cd47241714ed9597fc87bf37db0d12c83959fe8dbf981`
- Commands: `python -m pipeline.physics.run` then `python -m pipeline.decision.run`
- Inputs: `derived/detections.parquet` (5,598,962 rows), `derived/daily_cell.parquet` (4,203,025 rows), cached ONI/DMI in `external/`
- Outputs (not in git): `derived/physics/{overpass_time.parquet, f_star.json, frp_ratio_curve.parquet, monthly_H.parquet, triangulation.parquet, drift_ratio.parquet, physics_summary.json, alert_calendar.json, backtest.parquet, decision_summary.json}`; figures `figures/phy02_overpass_lst.png`, `figures/phy01_frp_ratio_curve.png`, `figures/phy03_drift_ratio.png`

Every number below is copied from `physics_summary.json` / `decision_summary.json` of this run.

## PHY-02 effective overpass time

Median local solar time (LST) of detections per satellite x month x day/night, 2003-2025, groups with at least 30 detections.

Day overpass, annual median of monthly medians (h, LST):

| Year | Aqua | Terra | SNPP | NOAA-20 |
|---|---|---|---|---|
| 2003-2012 (typical) | 13.47-13.60 | 10.51-10.56 | - | - |
| 2021 | 13.510 | 10.497 | 13.479 | 13.462 |
| 2022 | 13.569 | 10.355 | 13.496 | 13.515 |
| 2023 | 13.757 | 10.104 | 13.534 | 13.528 |
| 2024 | 14.139 | 9.774 | 13.482 | 13.463 |
| 2025 | 14.675 | 9.320 | 13.514 | 13.496 |

Drift is visible in the data and starts in 2022:

- Aqua day: 2025 median 14.675 h vs 13.520 h baseline (2003-2012 median) = about +69 min. Median over all 2023-2025 months vs 2003-2012: +37 min (day), +38 min (night).
- Terra day: 2025 median 9.320 h vs 10.541 h baseline = about -73 min. 2023-2025 vs 2003-2012: -38 min (day), -42 min (night).
- SNPP and NOAA-20 stay within about 1 min (2023-2025 vs their early years), as expected for maintained JPSS orbits.

LST = UTC + lon/15 (no equation-of-time correction, up to about 16 min seasonal wobble; it cancels in year-to-year comparisons).

## PHY-01 FRP floor F*

R(F) = number of SNPP (cell 0.01 deg, local date, day/night) sums with sum FRP >= F, divided by number of Aqua pixels with FRP >= F and A_pix <= 2 km2, 2012-2021. Rule (pre-registered in the module): smallest F where |R - 1| < 0.15 for it and the next 3 grid points, n_modis >= 30.

**Result: no F* qualified, day or night.** R(F) falls from 5.8 (day) / 10.5 (night) at 1 MW to a plateau and never approaches 1:

- Day: minimum R = 2.56 near 15 MW; plateau median (F >= 20 MW) = 2.71.
- Night: minimum R = 2.72 near 13-17 MW; plateau median = 3.10.

Interpretation (not tested): the plateau is a sampling ratio, not a detection floor. VIIRS sums are counted at all scan angles while MODIS is restricted to near-nadir pixels (A_pix <= 2 km2), so the two counts cover different swath fractions. A footprint-matched comparison (same cells and same overpass days for both sensors) is needed before the pre-registered rule can yield an F*.

Sensitivity, NOT pre-registered: R normalised by its plateau with the same rule gives F*_day = 7.67 MW, F*_night = 5.11 MW. These values are used for H_large below only so that TRI-03 can run; they are labelled as sensitivity in `f_star.json` (`f_star_sensitivity_NOT_PREREGISTERED`).

## TRI-01/02/03 triangulation

- H: harmonised count from `pipeline.science` (EB kappa fit 2012-2021, Terra->Aqua and NOAA20->SNPP chain factors, 200 bootstrap draws), built from daily_cell cell-days with season per validation_plan (wet Dec-Mar, transition Apr-Jul, dry Aug-Nov) and `is_peat = unknown`.
- H_large: Aqua-only cell-days with sum FRP >= sensitivity F* (constant constellation).
- H_energy: monthly sum FRP, light per-satellite ratio calibration to Aqua over 2012-2021 (energy proxy, not emissions).
- Classes: percentile vs same AOI and calendar month, baseline 2003-2022 leave-self-out; low < p10, high > p90. A = all three agree, B = two agree, C = all differ.

Agreement shares per era (months 2003-2025; national = all of Indonesia, island = 5 island-region boxes pooled):

| Scope | Era | n months | A | B | C |
|---|---|---|---|---|---|
| National | 2003-2011 | 108 | 0.917 | 0.083 | 0.000 |
| National | 2012-2021 | 120 | 0.942 | 0.058 | 0.000 |
| National | 2022+ | 49 | 0.816 | 0.184 | 0.000 |
| Island | 2003-2011 | 540 | 0.854 | 0.144 | 0.002 |
| Island | 2012-2021 | 600 | 0.853 | 0.147 | 0.000 |
| Island | 2022+ | 241 | 0.776 | 0.224 | 0.000 |

V14 rule (share_C(post-2021) <= share_C(overlap) + 5 pp): passes (0.000 vs 0.000), but the test is weak: C needs low, normal and high at once and almost never happens. The informative signal is the drop of A and rise of B after 2021 (national 94% -> 82% A; islands 85% -> 78% A), which coincides with the Aqua/Terra drift and the switch of H to SNPP x kappa. The pre-2012 era here starts at 2003 (baseline period), so the Terra-only era 2000-2002 is not included.

## PHY-03 drift ratio

R_pred = f(LST_Aqua) / f(LST_SNPP) from the PHY-02 day table with the diurnal placeholder parameters h = 14.5 h, s = 2.5 h, b = 0.05 **[UNVERIFIED]** (not fitted). R_obs = Aqua day cell-days / (SNPP day cell-days x kappa), national, 2022-2025, months with H >= 50: n = 48 months.

- Linear fit R_obs ~ R_pred: slope = 5.78, intercept = -5.08; Pearson r = 0.525, p = 1.3e-4.
- R_pred range 0.983-1.089; R_obs median 0.954 (IQR 0.815-1.076).

Caveats: with the placeholder peak at 14.5 h, the drift of Aqua toward 14.7 h predicts R > 1 (Aqua closer to the peak), while the observed median is below 1. Both series carry a seasonal cycle (the monthly Aqua LST varies), so the correlation may be partly seasonal; no de-seasonalised test was run. The H5/V4 decision also needs the M3x vs M3 LOYO comparison, which is owned by `pipeline/run` and was not run here. Treat the slope/r as descriptive only.

## DEC-02 alert calendar

P(H > p90 | ENSO class) per AOI and calendar month, Laplace estimator (k+1)/(n+2), baseline 2003-2022. ENSO classes from ONI JAS (+/-0.5): El Nino 2004, 2009, 2015, 2023 within 2003-2025 (plus 2002, which has data, so n = 5 El Nino Sep/Oct months); La Nina 2007, 2010, 2011, 2022; others neutral. Sep/Oct probabilities:

| AOI | Sep El Nino | Oct El Nino | Sep neutral | Oct neutral |
|---|---|---|---|---|
| Indonesia | 0.29 (k=1/5) | 0.43 (2/5) | 0.11 | 0.11 |
| Jawa-NusaTenggara-Bali-Maluku | 0.57 (3/5) | 0.43 (2/5) | 0.17 | 0.11 |
| Kalimantan | 0.43 (2/5) | 0.43 (2/5) | 0.06 | 0.11 |
| Papua | 0.43 (2/5) | 0.43 (2/5) | 0.11 | 0.06 |
| Sulawesi | 0.43 (2/5) | 0.57 (3/5) | 0.11 | 0.06 |
| Sumatra | 0.29 (1/5) | 0.29 (1/5) | 0.11 | 0.11 |

La Nina months never exceeded p90 (k = 0/4 everywhere, p = 0.17). Note: n counts all years with data in the ENSO class (2000-11 to 2025), while the p90 threshold uses 2003-2022 only.

## DEC-03 leave-one-year-out backtest (V11, descriptive)

Rule: alert for an AOI in year y if y is El Nino (ONI JAS) and max P(H > p90 | El Nino, Sep or Oct) >= 0.5 computed without year y; event = H > p90 in Sep or Oct of y. Test years 2003-2025.

| AOI | hits | misses | false alarms | correct negatives |
|---|---|---|---|---|
| Indonesia | 1 | 2 | 3 | 17 |
| Jawa-NusaTenggara-Bali-Maluku | 2 | 3 | 2 | 16 |
| Kalimantan | 1 | 3 | 2 | 17 |
| Papua | 2 | 1 | 2 | 18 |
| Sulawesi | 2 | 1 | 2 | 18 |
| Sumatra | 0 | 3 | 0 | 20 |
| 5 islands pooled | 7 | 11 | 8 | 89 |

Pooled hit rate 0.39, false-alarm ratio 0.53. Hits are mostly 2015 (4 of 5 islands) and 2004 (Papua, Sulawesi). Misses cluster in 2006 and 2019, both ENSO-neutral by ONI JAS but strong positive IOD years, and in Sumatra 2015 where the leave-out probability fell to 0.33. False alarms are El Nino years without a p90 exceedance (2004, 2009, 2023). Adding the IOD class to the rule is the obvious next test; it was not run.

## DEC-01 priority

Not run. `pipeline.science.series.build_series` returns only H_lo/H_hi, not per-replicate bootstrap series, so `priority.rank_probability` has no replicate input. Exposing the replicate matrix from `build_series` is needed first.

## Caveats

- Diurnal parameters are placeholders [UNVERIFIED]; PHY-03 numbers depend on them.
- F* from the pre-registered rule does not exist on this data; H_large uses a non-pre-registered plateau-normalised F*.
- Island regions are approximate boxes from `pipeline/data`, not administrative boundaries.
- No peat labels yet (`is_peat` is null in daily_cell), so kappa is stratified by island x season x day/night only and no peat split is reported.
- kappa ranges 0.14-0.28 (day) and 0.02-0.12 (night) across island x season strata (`physics_summary.json` -> `kappa_table`).
- H here is rebuilt from daily_cell inside the runner (cell_days = rows per satellite x day/night x month); it may differ slightly from the `pipeline/run` validation outputs if those use `monthly_stratum`.
