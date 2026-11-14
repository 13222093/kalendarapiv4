# Second Sight: pre-registered validation plan (S0 / SET-05)

This plan is committed **before** any validation result is computed. Its commit hash and timestamp are the reference: any later change to a rule must be recorded in the change log at the bottom, with the reason, and the original rule stays reported next to the changed one.

Sources: `08-blueprint-ide-dan-opsi-konsep.md` §3C, §3D, §7.6, §7.7; `09-second-sight-v2-upgrade-pipeline-dan-posisi.md` §2 (U1), §3, §5.1.

## 1. Fixed parameters

| Parameter | Value | Note |
|---|---|---|
| Unit of count | fire cell-day: unique (local_date, 0.01° cell, satellite, daynight) | grid 0.01° |
| Calibration window (κ, VIIRS S-NPP → Aqua) | 2012-01 .. 2021-12 | M3x variant: 2012-01 .. 2025-12 (drift test only) |
| Baseline window | 2003-01 .. 2022-12, median per calendar month | computed inside the fold in every cross-validation |
| Strata | island_region × season × daynight × is_peat | parent: (island_region, daynight); grandparent: (daynight) |
| Seasons | wet Dec-Mar, transition Apr-Jul, dry Aug-Nov | |
| Shrinkage | empirical-Bayes gamma-Poisson, (a, b) by method of moments over children of each parent | |
| Bootstrap | year-block, 1000 resamples, seed 20261114, percentiles 5/95 (90% interval) | same resampled years used for every stratum |
| Chain Terra → Aqua | overlap 2002-07 .. 2005-12, ratio of sums per (island_region, daynight, season) | |
| Chain NOAA-20 → S-NPP | overlap 2018-04 .. 2026-10, ratio of sums per (island_region, daynight) | expected ≈ 1 |
| ENSO class | El Niño if mean ONI Jul-Sep ≥ +0.5; La Niña if ≤ −0.5; else neutral | ONI from NOAA CPC |
| IOD class | IOD+ if mean DMI Sep-Nov ≥ +0.4; IOD− if ≤ −0.4; else neutral | DMI (HadISST) from NOAA PSL |
| Static-source mask | 0.01° cell with type ∈ {1,2,3} on ≥ N = 10 days (2012-2025) | sensitivity N = 5, 20 |
| Confidence filter | MODIS confidence ≥ 30; VIIRS nominal + high | sensitivity: all; high only |
| FRP floor F\* | smallest F in 1..200 MW (log grid) with \|R(F) − 1\| < 0.15 for F and the next two grid points, day and night separately | if none, H_large is dropped |
| Robust z shown only if | baseline median ≥ 5 cell-days | |
| Significance | α = 0.10 (90% intervals) unless stated | |

## 2. Hypotheses (directional, stated before the data are seen)

Notation: ρ = ΣV / ΣA (VIIRS S-NPP cell-days per Aqua cell-day, = 1/κ), computed 2012-2021, Sumatra + Kalimantan, CI from year bootstrap.

- **H1 (peat).** ρ is higher on peat than on mineral soil. *Accepted* if the 90% CI of `log ρ_peat − log ρ_mineral` is > 0 in **both** day and night. *Partially accepted* if > 0 in only one; *rejected* otherwise.
- **H2 (night).** On peat, ρ at night is higher than ρ in the day. *Accepted* if the 90% CI of `log ρ_night − log ρ_day` (peat) is > 0 **and** the two 90% CIs of ρ do not overlap. *Rejected* if the CI of the difference contains 0 or is < 0.
- **H3 (smoke / El Niño years).** In El Niño years (ONI JAS ≥ +0.5) fires are larger, so a larger share is seen by MODIS: ρ is lower than in other years. *Accepted* if the 90% CI of `log ρ_ElNiño − log ρ_other` (peat, both day/night pooled) is < 0. If the CI is > 0 we report "rejected, opposite sign" (smoke obscuration dominates).
- **H4 (FRP-conditioned κ, U1).** In `log E[A] = log V + β0_s + β1·logit(φ_t) + β2·η_t`, **β1 > 0**. *Accepted* if the 90% bootstrap CI of β1 is > 0. Sign of β2 is reported, no prior direction.
- **H5 (drift).** Aqua orbit drift after 2021 lowers A relative to V·κ: the observed ratio `A / (V·κ̂)` in 2022-2026 is below 1 and follows the physics prediction. *Accepted* if the slope of `R_obs ~ R_pred` (2022-2026 monthly) is > 0 with p < 0.10 **and** M3x (calibration 2012-2025) has a worse LOYO MdAPE on 2012-2021 than M3.

Null results are reported in the app (Science Lab) with the same prominence as positive results.

## 3. Tests V1-V17: metric and pass/fail rule

All tests write one entry per (test, method) to `validation_results.json`: `test_id, metric, value, ci, rule, passed, notes`. `passed` is `null` for descriptive tests.

| ID | Test | Metric | Pass rule (concrete) |
|---|---|---|---|
| V1 | LOYO 2012-2021: calibrate on 9 years, predict the held-out year's Aqua total from S-NPP | annual MdAPE, Spearman ρ over 10 years, median bias | Pass if MdAPE(M3) ≤ MdAPE(M1) **and** MdAPE(M3) ≤ 25% **and** Spearman ≥ 0.8. M4 adopted for the main series only if MdAPE(M4) ≤ MdAPE(M3). 2015 and 2019 APE reported separately. |
| V2 | LORO: hold out one island_region, κ taken from parent/grandparent only | same as V1 per region | Pass if, for every region, MdAPE(LORO) ≤ 2 × MdAPE(V1, M3) and ≤ 40%. |
| V3 | Seam test on `z_t = log(H_t+1) − log(R_t+1)`, R = Aqua-only reference (MCD64A1 if available), seams 2002-07, 2012-01, 2018-04, 2022-01, 2026-11 | Δ_seam = mean(z) 12 months after − 12 months before, CI by block bootstrap (block 3 months); Pettitt p; PELT breakpoints | Pass per seam if Δ_seam lies within the central 90% of the placebo distribution (same Δ at all months ≥ 12 months away from any sensor event). Pettitt p < 0.10 at a seam (±3 months) is reported as a failure note. Required: M3 passes the 2012-01 and 2022-01 seams; M0 is expected to fail. |
| V4 | Physics drift (U5) | slope, Pearson r of R_obs ~ R_pred 2022-2026, 90% CI | Pass if r > 0 with p < 0.10 and M3x LOYO MdAPE > M3 LOYO MdAPE (see H5). |
| V5 | MODIS sunset backtest: calibrate 2012-2016, reconstruct 2017-2021 monthly Aqua from S-NPP | KGE (monthly, national) | Pass if KGE(M3) ≥ 0.7 **and** KGE(M3) > KGE(M1). M4 must have KGE(M4) > KGE(M1). |
| V6 | SiPongi burned area (annual, national + provinces, ~2015-2025) | Spearman ρ | Pass if ρ(H) ≥ ρ(raw concatenated counts), national. |
| V7 | Sensitivity (confidence filter, grid 0.01° vs 0.05°, strata set, shrinkage n0 ×0.5/×2, mask N 5/20) | anomaly class of 2026 months (below p10 / normal / above p90) | Pass if the 2026 anomaly class of the latest complete month is unchanged in ≥ 80% of variants. |
| V8 | Field 2016 physical test: Aug-Oct fire activity vs dry-season rainfall, fitted 2003-2011 and 2012-2025 | slope of log activity on rainfall per period, 90% CI | Pass if the CIs of the two slopes overlap for H **and** do not overlap for raw counts (or the raw difference is larger). |
| V9 | Peat hypotheses H1-H3 | log-ratio differences + CI | Decisions exactly as in §2. |
| V10 | Anomaly flag agreement ≥ p90, Aqua native vs S-NPP·κ, 2012-2021 monthly | F1, Cohen's κ | Pass if Cohen's κ ≥ 0.6 and F1 ≥ 0.7. |
| V11 | Readiness calendar backtest (U6) before September | hits, misses, false alarms | Descriptive, no pass rule. |
| V12 | Ranking of extreme years (annual totals) Aqua vs H over 2012-2021 | Spearman of annual ranks; top-3 years identical | Pass if Spearman ≥ 0.9 and the top 3 years are the same set. |
| V13 | Observability (U4) | Spearman of H vs burned area for high-O vs low-O cell-months | Pass if ρ(O ≥ 0.6) > ρ(O < 0.3). |
| V14 | Triangulation per era (U3) | share of C (disagreement) cells: pre-2012, overlap 2012-2021, post-2021 | Pass if share_C(post-2021) ≤ share_C(overlap) + 5 percentage points. |
| V15 | Physics coefficients (U1) | sign and 90% CI of β1, β2 | Reported; "as predicted" if β1 CI > 0 (H4). |
| V16 | Physics prior vs empirical (U2) | m_s vs κ_s per stratum, Spearman and median ratio | Descriptive. |
| V17 | Global transfer (U10, Amazon west) | V1, V3, V5 rerun unchanged | Reported side by side; same rules as V1/V3/V5. |

## 4. Methods compared (ablation, 09 §5.2)

M0 raw concatenation; M1 single global ratio; M2 ratio per region × season; M3 strata + peat + day/night + EB (main, v1); M3x M3 calibrated 2012-2025; M4 FRP-conditioned κ (U1); M6 H_large; M7 H_energy. M2b, M5, M8 only if time allows; otherwise marked "not run".

## 5. Reporting rules

- Every test result is reported, failed or not. No test is dropped after seeing its result.
- Results computed on synthetic fixtures (unit tests) are never reported as results.
- The main series uses M3 unless the M4 rule in V1 is met.

## 6. Change log

| Date | Change | Reason |
|---|---|---|
| 2026-11-14 | Initial version | — |
