# Limitations and claim boundaries

The integrated finding is PRELIMINARY. It describes satellite active-fire detections after sensor harmonization. It does not establish a policy, land-use, weather, restoration, or enforcement cause.

## Validation and transfer

- The production M3/main 2022 seam test fails: Δ = +0.365 with a 90% interval of approximately +0.110 to +0.555. The 2012 switch-variant pass is a different test case and does not cancel this failure.
- The 94-row validation output contains 15 passes, 11 failures, 55 descriptive results, 4 not-applicable rows, and 9 not-run rows. Keep all categories visible.
- Leave-one-region-out transfer errors are 20.34% for Kalimantan, 42.40% for Sulawesi, and 88.99% for Java–Nusa Tenggara–Bali–Maluku. National calibration should not be presented as equally reliable everywhere.
- The integrated finding run reports Theil–Sen slopes but no slope confidence interval. A separate vendor trend report has its own percentage estimates and intervals; it is not the same run. Its M1/M2 calibration refits were not run.

## Coverage and missing analyses

- FireMask observability is available for nine Central Kalimantan months only. Other months and areas are not computed, not assumed clear.
- Peat labels are unknown; peat hypotheses H1–H3 (V9) were not run. No peat-specific result is supported.
- The current workflow did not run CMG cloud, CHIRPS/DC climate, data-health, physics/M4 FRP, decision, integrated trend, drift-check, field-test, or validation-figure pipelines. These are not results of this build.
- The separate CSV aggregate export was not copied into the app. Validation figures were not generated in the integrated run.
- Terra-to-Aqua and VIIRS-to-Aqua ratios assume their calibration relationship remains applicable within the stated strata. Post-2021 production values face the observed 2022 seam failure.

## Measurement boundaries

A 0.01° fire cell-day records a cell with at least one detected hotspot on a local date. It is not a count of unique fire events, burned area, emissions, or an estimate of hidden fires. Clouds, smoke, sensor resolution, orbit, and smouldering fires can affect detection. A “no clear look” value says what the observation mask reports; it does not recover the unobserved fire state.

The displayed 90% range is based on calibration bootstrap percentiles and summed monthly bounds with a comonotone approximation. It does not include every source of model, measurement, or coverage uncertainty. Months marked provisional may change.

The v1.1 artificial-cloud protocol is linked from the app, but its guard/test execution and hidden-fire estimate are not included. No public deployment, final submission, or project-page publication is claimed.
