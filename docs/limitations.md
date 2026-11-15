# Limitations and claim boundaries

The integrated finding is PRELIMINARY. It describes satellite active-fire detections after sensor harmonization. It does not establish a policy, land-use, weather, restoration, or enforcement cause.

## What the headline does and does not show (fourth round, after the science review)

- **The harmonized line is Aqua MODIS’s own count through 2021.** Only from January 2022 is it VIIRS converted to the Aqua scale. The headline change (2017–2021 against 2003–2007: Indonesia raw +94.7%, harmonized −64.4%; Central Kalimantan raw +19.2%, harmonized −73.6%) therefore involves no conversion at all. It shows that a raw splice misleads; it does not show that the calibration works.
- **Values from 2022 sit on a seam check that fails** (Δ +0.365, 90% interval +0.110 to +0.555, placebo range −0.240 to +0.047). The second reading, 2019–2023 against 2003–2007 (Indonesia +98.5% / −62.8%; Central Kalimantan +35.2% / −70.8%), has two converted years out of five and was the headline before this round.
- **The size depends on the years compared; the direction of the harmonized change does not**, in the comparisons the page shows (Indonesia −62.0% to −64.4%; Central Kalimantan −70.8% to −73.6%). The raw change moves more (Indonesia +94.7% to +108.4%; Central Kalimantan +19.2% to +35.2%).
- **The El Niño list depends on the rule.** The page uses July–September ONI of +0.5 or more (NOAA CPC), which removes 2004 from the early window and nothing from 2017–2021. The science review left out 2004, 2006, 2019 and 2023 from the 2019–2023 comparison without stating a rule (September–November ONI of +0.5 or more gives those four). With its years the data give Indonesia raw +25.1% and harmonized −79.5%, and Central Kalimantan raw −69.8% and harmonized −92.7%: the raw sign flips for Central Kalimantan, the harmonized sign does not. Stopping the 2019–2023 window at 2021 gives Indonesia +112.6% / −61.0% and Central Kalimantan +59.7% / −65.9%. None of these is on the page; they are here so the choice is visible.
- These are counts of detections on the Aqua scale. They are not burned area, and they say nothing about cause.

## Validation and transfer

- The production M3/main 2022 seam test fails: Δ = +0.365 with a 90% interval of approximately +0.110 to +0.555. The 2012 switch-variant pass is a different test case and does not cancel this failure.
- The 94-row validation output contains 15 passes, 11 failures, 55 descriptive results, 4 not-applicable rows, and 9 not-run rows. Keep all categories visible.
- The pass count is not a score. Five of the 15 passes are one rank test (V1, Spearman ≥ 0.8) on five methods including raw M0, which passes with the same value because a rank test does not see a change of scale; three of the 11 failures are M0 failing as expected. For the chosen method the decisions are: pass V1 (a year left out), V10 (high-fire month flags) and V12 (rank of the years, also a rank test); fail V2 (a region left out), V3 (seams) and V5 (sunset).
- The chosen method does worse on held-out years than a simpler one: median error 7.2% for M3 against 2.3% for M2 (one ratio per region and season) and 8.4% for M1 (one ratio). M3 was kept because the pre-written rule compares it with M1 only. On the sunset test M3 (KGE 0.889) is below M1 (0.900) and M2 (0.938).
- The 2012 seam pass is in sample (fitted on 2012–2021, reference Aqua MODIS itself). No independent reference such as burned area was used (MCD64A1 was not available in the run).
- Leave-one-region-out transfer errors are 20.34% for Kalimantan, 42.40% for Sulawesi, and 88.99% for Java–Nusa Tenggara–Bali–Maluku. National calibration should not be presented as equally reliable everywhere.
- The integrated finding run reports Theil–Sen slopes but no slope confidence interval. A separate vendor trend report has its own percentage estimates and intervals; it is not the same run. Its M1/M2 calibration refits were not run.

## Coverage and missing analyses

- FireMask observability is available for nine Central Kalimantan months only. Other months and areas are not computed, not assumed clear.
- A month classed "good" has O = (1 − cloud share) × (1 − missing share) of 0.6 or more (`pipeline/visibility/monthly_observability.py`): no cloud flag on most cell-days. It does not mean the ground was seen. As the science review points out, the MODIS fire mask does not flag thick smoke as cloud, and one cloud-free look in a day counts as clear, so the class is an upper bound on real observation. All nine months are "good" (O 0.82 to 0.98), including October 2015. The page says "no cloud flag on most cell-days" and "no cloud-free look", and states that thick smoke is not flagged; it no longer says "seen clearly".
- Peat labels are unknown; peat hypotheses H1–H3 (V9) were not run. No peat-specific result is supported.
- The current workflow did not run CMG cloud, CHIRPS/DC climate, data-health, physics/M4 FRP, decision, integrated trend, drift-check, field-test, or validation-figure pipelines. These are not results of this build.
- The separate CSV aggregate export was not copied into the app. Validation figures were not generated in the integrated run.
- Terra-to-Aqua and VIIRS-to-Aqua ratios assume their calibration relationship remains applicable within the stated strata. Post-2021 production values face the observed 2022 seam failure.

## Measurement boundaries

A 0.01° fire cell-day records a cell with at least one detected hotspot on a local date. It is not a count of unique fire events, burned area, emissions, or an estimate of hidden fires. Clouds, smoke, sensor resolution, orbit, and smouldering fires can affect detection. A “no clear look” value says what the observation mask reports; it does not recover the unobserved fire state.

The displayed 90% range is based on calibration bootstrap percentiles and summed monthly bounds with a comonotone approximation. It does not include every source of model, measurement, or coverage uncertainty. Months marked provisional may change.

The v1.1 artificial-cloud protocol is linked from the app, but its guard/test execution and hidden-fire estimate are not included. No public deployment, final submission, or project-page publication is claimed.
