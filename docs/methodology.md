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

The app’s before/after chart indexes each annual series to its own 2003–2011 mean (=100). Since the fourth round its headline period comparison is the 2017–2021 mean against the 2003–2007 mean (`app/src/lib/windows.ts`, computed in `app/src/lib/robust.ts`); the 2019–2023 mean against 2003–2007, which was the headline before, is shown as a second reading because it crosses the 2022 seam. These summaries are separate and are not interchangeable.

## What the harmonized line is

- From July 2002 to December 2021 the harmonized value of every month is Aqua MODIS’s own count: `sensor_used` is "Aqua" and `H` equals `A_raw` in all 40 areas. No conversion is involved. (Checked on 15 November 2026: 8,855 area-months have `sensor_used` "Aqua", all of them in that span and all with `H` = `A_raw`; another 505 area-months in that span, all in province files, have no harmonized value at all and add nothing to either yearly total.)
- From January 2022 it is VIIRS S-NPP converted to the Aqua MODIS scale with the M3 multiplier (NOAA-20 for November 2026). Before July 2002 it is Terra converted to the Aqua scale.
- The app checks the first statement in the browser for the area shown (harmonized yearly total equal to Aqua’s for every year before 2022) and only then labels the line "Aqua MODIS’s own count to 2021, VIIRS converted to the Aqua MODIS scale from 2022"; 2022 is marked on the chart.
- Consequence: a long-run change measured to 2021 says that stitching raw MODIS to raw VIIRS misleads. It does not test the conversion. The conversion is tested by the held-out-year errors and the seam checks only.
- After 2021 the harmonized yearly total can be compared with Aqua MODIS’s own (still recorded, on a drifting orbit). National ratio harmonized / Aqua: 1.17 (2022), 0.98 (2023), 0.92 (2024), 1.16 (2025), 0.84 (2026 to date).

## Robustness of the headline change

Computed in the browser from the yearly totals of the same monthly rows (`app/src/lib/robust.ts`, tests in `robust.test.ts`). Each cell is raw stitched / harmonized / Aqua MODIS alone; each change is the mean of the late years against the mean of the early years.

| Comparison | Indonesia | Central Kalimantan |
|---|---|---|
| Headline: 2017–2021 against 2003–2007 | +94.7% / −64.4% / −64.4% | +19.2% / −73.6% / −73.6% |
| Across the 2022 seam: 2019–2023 against 2003–2007 | +98.5% / −62.8% / −62.9% | +35.2% / −70.8% / −70.2% |
| Headline without El Niño years (2004 left out; 2017–2021 has none) | +108.4% / −62.0% / −62.0% | +26.5% / −72.0% / −72.0% |

What to read: in all three the harmonized change is a fall; its direction does not depend on these choices, its size does. The page writes that sentence from the numbers of the area shown, and says so when the direction does not hold for an area.

El Niño years come from NOAA Climate Prediction Center’s Oceanic Niño Index (`https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt`, read 15 November 2026, stored with its address, date, rule and file hash in `app/public/ka-data/enso_oni.json`). Rule: a year counts when its July–September ONI is +0.5 or more. For 2000–2026 that gives 2002, 2004, 2009, 2015, 2023 and 2026. The rule was fixed before the numbers were computed. A window left with fewer than two years gives no number.

## Observation-gap layer

The app reads the v1.0 Terra/Aqua daily FireMask aggregation for August–October in 2015, 2019, and 2023 in Central Kalimantan: nine monthly rows. O, f_cloud, and f_missing describe observation conditions for those rows. Elsewhere null is shown as “not computed.” An unobserved no-fire cell-day indicates no clear observation in the input mask; the app does not infer the fire that may have gone unseen.

## Validation and finding provenance

- validation_results.json: run 14 November 2026 at 06:41:46 UTC, 1,000 bootstrap draws, 94 entries (15 pass, 11 fail, 55 descriptive, 4 not applicable, 9 not run).
- finding.json: run 14 November 2026 at 06:42:19 UTC, 300 draws, marked PRELIMINARY; it shares the bundle manifest hash. Its 2001–2025 national Theil–Sen slopes are +1,739.5 raw and −1,614 harmonized cell-days/year. No slope confidence interval was generated in this integrated finding run. Since the fourth round the record page no longer shows these slopes: the raw series changes unit in 2012, so a raw slope in cell-days per year is not comparable with the harmonized one, and neither has an interval.
- The registered M3 switch variant passes the 2012 seam check (Δ −0.0569); the production M3/main series fails the 2022 seam check (Δ +0.365). Exact intervals and rules are in the JSON ledger.
- The 2012 pass is in sample: the multiplier is fitted on 2012–2021 and the check uses Aqua MODIS itself as the reference. The only test on years the fit did not see is the held-out-year error (V1): median over each year of 2012–2021 left out in turn, 434.7% for raw VIIRS (M0) and 7.2% for M3; 0.8% for 2015 and 8.4% for 2019.
- On that test the chosen method is not the best: M2 (one ratio per region and season) has 2.3%, M1 (one ratio) 8.4%, M3 7.2%, M3x 7.3%. On the sunset test M3 scores KGE 0.889 against 0.900 for M1 and 0.938 for M2, and fails its rule. M3 was kept because the rule written before the run (V1) compares it with M1 only, and it passes that rule.
- Five of the 15 passes are one rank test (V1, Spearman ≥ 0.8) on five methods, including raw M0, which passes with the same value; three of the 11 failures are M0 failing. The page therefore leads with the errors and the seam results, not the counts.

vendor/second-sight/docs/trend_results.md is a separate vendor trend analysis, not generated from the integrated finding.json run. It reports percentage-scale Theil–Sen estimates and modified Mann–Kendall results, including a raw interval that spans zero; it skips M1/M2 refits. Do not merge its estimates or uncertainty into the integrated finding without a new traceable run.
