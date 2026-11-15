# Methodology and current production path

This note describes the committed app bundle, not every method proposed in the source projects. Full ingestion and provenance logs are in DATA.md; the app reads the versioned files in app/public/ss-data/.

## Inputs and unit

The current bundle contains 40 areas and 313 monthly rows from November 2000 through November 2026. Its manifest and data version are de7fff88ca8c969a483ed6985e78085b073b0fa33950fb2eb962657dadd80661, generated 14 November 2026 at 11:02:40 UTC. The base detection unit is a 0.01° grid cell × local date × satellite × day/night. Filters, source-file hashes, and ingest steps are listed in DATA.md sections 3–5.

## Production series

1. The source pipeline filters and deduplicates NASA FIRMS active-fire detections, then aggregates them to monthly cell-days by sensor, area, and stratum.
2. The raw stitch uses Aqua MODIS through 2011 and VIIRS S-NPP from 2012 onward. The sensor-summed series adds Aqua and S-NPP detections during overlap and is shown only as a diagnostic because it double counts detections.
3. The harmonized series uses the Aqua MODIS scale. During the Aqua era it uses Aqua counts; after December 2021 it converts VIIRS S-NPP with the fitted M3 multiplier. Separate ratios chain Terra to Aqua and NOAA-20 to S-NPP.
4. M3 estimates the VIIRS-to-Aqua ratio over the 2012–2021 calibration window with a stratified empirical-Bayes gamma–Poisson model. Strata are island region × season × day/night × peat class. Sparse or missing strata fall back first to the parent island-region × day/night estimate, then to day/night. The current province patch carries the fitted is_peat=unknown label into province rows so they use that parent estimate; this does not produce peat-specific estimates.
5. The app reports bootstrap 5th and 95th percentile bounds for the calibrated multiplier, with 1,000 draws and seed 20261114. Monthly bounds are summed for annual display using the source pipeline’s comonotone approximation. This is a calibration range, not uncertainty over every possible source of error.

The app’s before/after chart indexes each annual series to its own 2003–2011 mean (=100). Its period comparison is the 2019–2023 mean against the 2003–2007 mean. These summaries are separate and are not interchangeable.

## Observation-gap layer

The app reads the v1.0 Terra/Aqua daily FireMask aggregation for August–October in 2015, 2019, and 2023 in Central Kalimantan: nine monthly rows. O, f_cloud, and f_missing describe observation conditions for those rows. Elsewhere null is shown as “not computed.” An unobserved no-fire cell-day indicates no clear observation in the input mask; the app does not infer the fire that may have gone unseen.

## Validation and finding provenance

- validation_results.json: run 14 November 2026 at 06:41:46 UTC, 1,000 bootstrap draws, 94 entries (15 pass, 11 fail, 55 descriptive, 4 not applicable, 9 not run).
- finding.json: run 14 November 2026 at 06:42:19 UTC, 300 draws, marked PRELIMINARY; it shares the bundle manifest hash. Its 2001–2025 national Theil–Sen slopes are +1,739.5 raw and −1,614 harmonized cell-days/year. No slope confidence interval was generated in this integrated finding run.
- The registered M3 switch variant passes the 2012 seam check (Δ −0.0569); the production M3/main series fails the 2022 seam check (Δ +0.365). Exact intervals and rules are in the JSON ledger.

vendor/second-sight/docs/trend_results.md is a separate vendor trend analysis, not generated from the integrated finding.json run. It reports percentage-scale Theil–Sen estimates and modified Mann–Kendall results, including a raw interval that spans zero; it skips M1/M2 refits. Do not merge its estimates or uncertainty into the integrated finding without a new traceable run.
