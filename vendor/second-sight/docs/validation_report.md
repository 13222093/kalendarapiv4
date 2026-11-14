# Second Sight: validation report (VAL-12 run)

All numbers below are copied from `${SS_DATA_DIR}/derived/validation_results.json` produced by
`scripts/validate.sh --n-boot 1000` (`python -m pipeline.run.validate_all`). Rules are those of
`docs/validation_plan.md`. No rule was changed after seeing results.

| Item | Value |
|---|---|
| Run (UTC) | 2026-11-14T02:26:43+00:00 |
| Code commit | `ac08070400d5d452dc433675893422c5d2cf4094` |
| `data_manifest.json` SHA-256 | `f2849b7bd063a6f3399cd47241714ed9597fc87bf37db0d12c83959fe8dbf981` |
| `monthly_stratum.parquet` SHA-256 | `7d9c698ec8b37801ac579707c846d02b4c162837cc3c28784d99d34beb6ab8b4` |
| Input | 7,731 monthly_stratum rows, 2000-11 .. 2026-01 (6.36 M FIRMS detections) |
| Bootstrap | 1000 year-block resamples, seed 20261114 |
| Totals | 94 entries: 15 pass, 11 fail, 55 descriptive, 4 not applicable, 9 not run |

## 1. Calibration (CAL-01..04)

Pooled κ = ΣAqua / ΣS-NPP cell-days, 2012-2021 (stratum EB values range in brackets):

| Region | Day | Night |
|---|---|---|
| Sumatra | 0.256 [0.230, 0.267] | 0.108 [0.102, 0.123] |
| Kalimantan | 0.273 [0.230, 0.276] | 0.097 [0.055, 0.103] |
| Papua | 0.227 [0.199, 0.243] | 0.071 [0.061, 0.111] |
| Sulawesi | 0.178 [0.138, 0.186] | 0.035 [0.035, 0.036] |
| Jawa-NT-Bali-Maluku | 0.143 [0.138, 0.162] | 0.030 [0.021, 0.033] |

National pooled κ = 0.193 (30 strata, all 0 < κ < 1). Chain factors: Terra→Aqua 2.578
(2002-07..2005-12), NOAA-20→S-NPP 0.971 (2018-04..2026-10). ENSO: 6 El Niño years in
2000-2026 (2002, 2004, 2009, 2015, 2023, 2026).

## 2. Pre-registered tests

| Test | Result | Rule | Verdict |
|---|---|---|---|
| V1 LOYO | MdAPE M3 = 7.23% (M1 8.40%, M2 2.32%, M3x 7.32%, M0 434.7%); Spearman M3 = 1.000; APE 2015 = 0.80%, 2019 = 8.36% | MdAPE(M3) ≤ MdAPE(M1), ≤ 25%, Spearman ≥ 0.8 | **PASS** |
| V2 LORO (M3) | Papua 5.85%, Sumatra 13.40%, Kalimantan 20.34%, Sulawesi 42.40%, JNBM 88.99% | each ≤ 2 × 7.23% and ≤ 40% | **FAIL** (Kalimantan, Sulawesi, JNBM) |
| V3 seam 2012-01 (switch-at-2012 series) | M3 Δ = −0.057 [−0.117, 0.041], placebo90 [−0.240, 0.181], Pettitt p = 0.351; M0 Δ = 1.519 [1.452, 1.625], Pettitt p ≈ 0 | Δ inside placebo 90% | M3 **PASS**, M0 FAIL (as expected) |
| V3 seam 2022-01 (main series) | M3 Δ = 0.365 [0.110, 0.555], placebo90 [−0.240, 0.047], Pettitt p = 0.001 (failure note); M0 Δ = 2.006 | Δ inside placebo 90% | M3 **FAIL**, M0 FAIL |
| V3 decision | M3 must pass 2012-01 and 2022-01 | | **FAIL** (2022-01) |
| V5 sunset (cal 2012-16, test 2017-21) | KGE M3 = 0.889, M1 = 0.900, M2 = 0.938, M3x = 0.883, M0 = −4.854 | KGE(M3) ≥ 0.7 and > KGE(M1) | **FAIL** (second clause: 0.889 < 0.900) |
| V9 peat H1-H3 | not run | | peat labels not joined (`peat = unknown` for all rows; DAT-03) |
| V10 flag agreement ≥ p90 | F1 = 0.842, Cohen's κ = 0.829 (n = 120, TP 8, FP 2, FN 1) | κ ≥ 0.6 and F1 ≥ 0.7 | **PASS** |
| V12 extreme years | Spearman = 1.000; top-3 Aqua = top-3 S-NPP·κ = {2014, 2015, 2019} | ≥ 0.9 and same top-3 | **PASS** |
| V6 SiPongi | verified national years only (2015, 2019, 2023; n = 3): ρ(H) = 1.0, ρ(raw concat) = −0.5 | ρ(H) ≥ ρ(raw) | descriptive only (n = 3) |
| V7 sensitivity (partial) | 2026-01 class = below_p10 in 6/6 strata/shrinkage variants (100%) | ≥ 80% unchanged over the full variant set | descriptive (partial set) |
| V4/H5 drift | component: LOYO MdAPE M3x 7.32% > M3 7.23% | needs physics slope too | V4 not run |
| V8, V11, V13-V17 | not run | | see reasons in JSON |

## 3. Ablation (VAL-04)

Calibration 2012-2021 (M3x: 2012-2025). Overlap KGE = in-sample monthly national 2012-2021;
Δ_seam and Pettitt p on the switch-at-2012 series (±24 months).

| Method | Overlap KGE | LOYO MdAPE | APE 2015 | APE 2019 | Sunset KGE | Δ_seam 2012 | Pettitt p |
|---|---|---|---|---|---|---|---|
| M0 raw concat | −4.920 | 434.68% | 442.94% | 409.17% | −4.854 | 1.519 | 4.4e-08 |
| M1 global ratio | 0.989 | 8.40% | 6.60% | 2.03% | 0.900 | −0.125 | 0.664 |
| M2 region × season | 0.963 | 2.32% | 12.79% | 3.22% | 0.938 | −0.135 | 0.549 |
| M3 strata + EB | 0.957 | 7.23% | 0.80% | 8.36% | 0.889 | −0.057 | 0.351 |
| M3x (2012-2025) | 0.952 | 7.32% | 1.32% | 8.70% | 0.883 | −0.057 | 0.393 |

Reading: every κ method removes the 2012 seam that raw concatenation creates (Δ 1.52 log units,
i.e. VIIRS counts ≈ 4.6× Aqua). M3 gives the smallest seam step and the best 2015 APE, but on
national annual / monthly totals the simpler M2 has lower LOYO MdAPE and higher sunset KGE.
With peat unlabelled, M3 strata are region × season × day/night only, so the M3 advantage the
plan expected from peat strata could not be tested.

## 4. Caveats

1. **Seam reference.** MCD64A1 is not available, so R = Aqua native. In the main series H = Aqua
   until 2021-12, so seams 2012-01 and 2018-04 have z ≡ 0 and are recorded `not_applicable`; the
   2012-01 seam is tested on a series that switches to S-NPP·κ in 2012-01. The 2022-01 failure
   compares S-NPP·κ to a drifting Aqua (orbit drift after 2021 lowers A), which is the effect H5
   predicts; it does not separate κ error from reference drift. The 2002-07 and 2026-11 seams
   have no data on one side (Aqua starts 2002-07; data end 2026-01).
2. **Season definition mismatch (data layer).** `pipeline/data/aggregate.py` writes 2 seasons
   (dry Jun-Oct / wet). The runner recomputes the pre-registered 3 seasons from the month.
3. **No peat labels.** All rows have `peat = unknown`; V9 (H1-H3) not run, and `is_peat` is a
   single stratum in M3.
4. **`series.build_series` needs full-strata fits.** M0/M1/M2 and reduced-strata fits are
   broadcast to the full strata in `pipeline/run/extras.py::expand_fit` (workaround, no draws).
5. **V10** uses in-sample κ (2012-2021) and the Aqua p90 per calendar month (2003-2022) as the
   common threshold. **V7** covers only strata/shrinkage variants; confidence filters, 0.01° vs
   0.05° grid and static-mask N need the data layer re-run. Latest month 2026-01 may be partial.
6. **V6** uses only rows marked `verified_*` (3 years); single-source rows are excluded.

Figures (EXP-05, not committed): `${SS_DATA_DIR}/figures/national_raw_vs_harmonized`,
`seam_plot`, `ablation` (.png, .svg).

## V8 — Field (2016) physical test (VAL-08, appended)

Runner: `python -m pipeline.run.field_test` → `${SS_DATA_DIR}/derived/validation_results_v8.json`
(separate file; `validation_results.json` unchanged). Activity = Aug-Oct sum of cell-days;
rain = Aug-Oct mean CHIRPS `precip_1m_mm_day` (national AOI; regions = unweighted mean of
their provinces). Model log(activity) = a + b·rain, fitted per period; 90% CI = percentile
year bootstrap (n = 2000) within each period. Both series switch sensor at 2012-01
(raw = M0 concatenation Aqua→raw S-NPP; H = M3 Aqua→S-NPP·κ, κ fitted 2012-2021, no κ
draws), so the 2003-2011 fit is Aqua in both. n = 9 years (2003-2011) and 14 (2012-2025).

| region | series | b 2003-2011 [90% CI] | b 2012-2025 [90% CI] | abs diff |
|---|---|---|---|---|
| national | raw | -0.321 [-0.361, -0.268] | -0.397 [-0.440, -0.342] | 0.076 |
| national | H | -0.321 [-0.361, -0.268] | -0.384 [-0.436, -0.325] | 0.063 |
| Kalimantan | raw | -0.382 [-0.448, -0.335] | -0.414 [-0.472, -0.344] | 0.032 |
| Kalimantan | H | -0.382 [-0.448, -0.335] | -0.371 [-0.429, -0.304] | 0.010 |
| Sumatra | raw | -0.221 [-0.300, -0.103] | -0.487 [-0.599, -0.362] | 0.266 |
| Sumatra | H | -0.221 [-0.300, -0.103] | -0.455 [-0.563, -0.335] | 0.234 |

**Decision (pre-registered rule, national = decision unit): PASS.** H slope CIs overlap; raw
CIs also overlap, so the pass comes from the second clause (|raw diff| 0.076 > |H diff| 0.063).
Kalimantan: PASS (same clause, 0.032 > 0.010). Sumatra: FAIL (H CIs do not overlap; the
2012-2025 slope is steeper with or without κ).

Caveats: (1) a slope of log activity is invariant to a single multiplicative factor, so the test
only sees κ through the change of stratum mix (region × season × day/night); the raw-vs-H gap is
therefore small by construction and this is weak evidence for κ. The level shift (intercept)
is not part of the pre-registered rule and is not reported here. (2) Sumatra's change in
rainfall sensitivity across periods is a physical or detection-regime change that κ does not
remove; it is reported, not explained. (3) No peat split (labels not joined, see limitation 3).

Follow-ups (appended): limitation 4 is fixed in CAL-04 (`build_series` accepts coarse fits;
`expand_fit` now lives in `pipeline/science/series.py` and keeps bootstrap draws). CAL-05
(`python -m pipeline.science.aoi`): 0.05° cell sets summed per region (5 regions), per province
(Riau, Kalimantan Tengah) and sum-of-provinces (Sumatra, Kalimantan) reproduce the direct
M3 series with relative error 0 (max monthly 2e-16), within the 1% tolerance.
## FND-06: rerun with peat strata (appended)

Command: `python -m pipeline.run.validate_all --input monthly_stratum_labeled.parquet --tag _peat --skip-enso`
(outputs `derived/*_peat.*`; the original `validation_results.json` is untouched). `--skip-enso`
was used, so the ENSO descriptive row is absent (93 vs 94 entries). The labelled file has
peat = peat / mineral / unknown (2,227 of 13,670 rows still `unknown`); the runner's `is_peat`
is `peat == "peat"`, so **mineral and unknown are pooled as non-peat** in κ strata, and V9
(H1-H3) is still reported not run (its gate requires no `unknown`).

Raw calibration ratio Aqua/SNPP cell-days 2012-2021 by label (descriptive, not EB-shrunk):

| Region | D mineral | D peat | N mineral | N peat |
|---|---|---|---|---|
| Sumatra | 0.249 | 0.273 | 0.074 | 0.131 |
| Kalimantan | 0.278 | 0.257 | 0.073 | 0.122 |
| Papua | 0.229 | 0.211 | 0.072 | 0.068 |
| Sulawesi | 0.179 | n/a | 0.036 | n/a |
| JNBM | 0.144 | n/a | 0.031 | n/a |

Night κ on peat is ~1.7× mineral in Sumatra and Kalimantan; day κ differs by under 10%.
`unknown` rows have much lower ratios (0.004-0.16), so pooling them with mineral is a caveat.

Pass/fail versus the unlabelled run (no decision changed):

| Test | Unlabelled | Peat strata | Decision |
|---|---|---|---|
| V1 LOYO MdAPE M3 (M1 8.40%) | 7.23% | 7.44% | PASS → PASS |
| V1 LOYO MdAPE M3x | 7.32% | 6.92% | descriptive |
| V2 LORO M3 (Papua, Sumatra, Kalimantan, Sulawesi, JNBM) | 5.85, 13.40, 20.34, 42.40, 88.99% | 6.90, 8.84, 18.12, 36.69, 83.84% | FAIL → FAIL |
| V3 seam 2012-01 / 2022-01 (M3, switch2012) | −0.057 / 0.262 | −0.068 / 0.258 | FAIL → FAIL |
| V5 sunset KGE M3 vs M1 0.900 | 0.889 | 0.888 | FAIL → FAIL |
| Totals pass / fail / not run | 15 / 11 / 9 | 15 / 11 / 9 | |

Pooled κ per region × day/night is identical (sums unchanged); only the within-region strata move.

## V4 drift (VAL-05b, appended)

`python -m pipeline.run.drift_check` reads `derived/physics/physics_summary.json` (phy03_drift)
and V1 from `derived/validation_results.json`; writes `derived/validation_results_v4.json`.
Rule (validation_plan.md V4/H5): r > 0 with p < 0.10 **and** LOYO MdAPE(M3x) > MdAPE(M3).

| Component | Value |
|---|---|
| R_obs ~ R_pred, 2022-2026, n = 48 months (H ≥ 50) | slope 5.78, r = 0.525, p = 1.3e-4, r 90% CI (Fisher z) [0.326, 0.680] |
| R_pred range / R_obs median | 0.983-1.089 / 0.954 |
| LOYO MdAPE M3x vs M3 (unlabelled run) | 7.32% vs 7.23% (+0.09 pp) |
| Decision | **PASS (conditional)** |

Caveats: (1) the diurnal-cycle parameters behind R_pred (h = 14.5, s = 2.5, b = 0.05) are
placeholders **[UNVERIFIED]**, so the physics clause holds only under them. (2) The M3x clause
margin is 0.09 pp, and it **reverses under peat strata** (FND-06 run: M3x 6.92% < M3 7.44%),
so with `validation_results_peat.json` as input V4 would FAIL. (3) No slope CI is in the physics
output; only the r CI is reported. (4) The slope (5.78) is far from 1, so R_pred tracks the
direction of R_obs but not its magnitude.
