# Space Apps project page draft (SUB-06)

Field-by-field text for the NASA Space Apps 2026 project page (fields from `docs/08-blueprint-ide-dan-opsi-konsep.md` §8.3). English. Every number is copied from repo docs; the source is in an HTML comment next to it. Placeholders are marked `[...]`. Target award category: **Best Use of Science** (PRD amendment, `docs/08` §7 "Amandemen PRD pasca-audit"); avoid the words platform / monitoring / predict in headlines.

---

## Project Name

Second Sight

## High-Level Summary (≤200 words)

How much of Indonesia's apparent rise in satellite fire detections since 2012 is real, and how much comes from NASA switching from MODIS to the more sensitive VIIRS sensor? Fire managers at BPBD, peat-unit (KHG/BRGM) offices and Manggala Agni compare this season with past seasons, but the record jumps at every satellite change. Raw concatenation makes VIIRS-era counts about 4.6 times the Aqua MODIS level for the same fires. <!-- docs/validation_report.md §3 reading --> Second Sight puts 25 years of NASA FIRMS detections on one Aqua-MODIS-equivalent scale for Indonesia, focusing on the peatlands of Kalimantan and Sumatra. We calibrate VIIRS to MODIS on the 2012-2021 overlap, stopping before the measured Aqua/Terra orbit drift, by region, season and day/night, with empirical Bayes shrinkage and bootstrap intervals. After calibration the 2012 seam disappears (step −0.057 log units, 90% interval −0.117 to 0.041). <!-- docs/validation_report.md §2 V3 --> We report our failures too: the model does not transfer well to three regions and fails a 2022 seam test. [FINDING — from docs/finding.md: one-sentence headline]. On peat, VIIRS's night-time advantage over MODIS is smaller than on mineral soil (7.86 vs 13.65 times as many fire cell-days), the opposite of what we expected. <!-- docs/peat_results.md --> Second Sight describes the past and current record; it is not a forecast.

## Link to Project Demo

[30-second video URL — pending]

## Link to Final Project

[App URL — pending] · Repository: https://github.com/Inforable/nasa-challenge-benchmark

## Detailed Description

### The question

What share of Indonesia's apparent fire increase is an artefact of changing satellites? We look at the whole country and focus on the Kalimantan and Sumatra peatlands, where Indonesia's worst fire years (2015, 2019) burn. <!-- top-3 years 2014/2015/2019: docs/validation_report.md §2 V12 -->

### What we found

[FINDING — from docs/finding.md]

Supporting finding on peat (Sumatra + Kalimantan, 2012-2021; ρ = S-NPP : Aqua fire cell-days, 90% year-block bootstrap CI, pre-registered rules): <!-- docs/peat_results.md "ρ per stratum" and "Decisions" -->
- H1 (VIIRS gains most on peat) **rejected**: at night ρ = 7.86 [6.82, 8.86] on peat vs 13.65 [12.78, 15.81] on mineral soil; in the day 3.76 vs 3.78.
- H2 (night ratio higher than day on peat) **accepted**: 7.86 vs 3.76, about 2x.
- H3 (El Niño lowers ρ on peat) **rejected with opposite sign**: log difference +0.285 [0.226, 0.390]. Only one El Niño year (2015) is in the window.

### How it works

1. FIRMS MODIS C6.1 and VIIRS 375 m C2 detections are cleaned (static-source mask, local time, day/night) and reduced to cell-days: one count per grid cell per day per sensor.
2. Calibration factor κ = ΣAqua / ΣS-NPP cell-days on the 2012-2021 overlap. We stop in 2021 because the Aqua and Terra orbits drift afterwards: 2023-2025 overpass times vs 2003-2012 shifted +37 min (Aqua day), +38 min (Aqua night), −38 min (Terra day), −42 min (Terra night). <!-- docs/physics_results.md PHY-02 lines 29-30 -->
3. κ is estimated per stratum: region × season × day/night (peat tested separately, H1-H3), shrunk toward the pooled value with empirical Bayes, with 1000 year-block bootstrap resamples. <!-- docs/validation_report.md header -->
4. Chain factors keep one scale: NOAA-20 → S-NPP 0.971 (2018-04 onwards), Terra → Aqua 2.578 (2002-07 to 2005-12). <!-- docs/validation_report.md §1 -->
5. Harmonized monthly series: Aqua until 2021-12, S-NPP × κ afterwards. Anomalies are measured against the 2003-2022 median per calendar month and against El Niño analog years (6 in 2000-2026). <!-- docs/validation_report.md §1 -->

National pooled κ = 0.193 (30 strata). By region, day κ is 0.143-0.273 and night κ is 0.030-0.108. <!-- docs/validation_report.md §1 -->

### Validation (rules pre-registered in `docs/validation_plan.md`)

94 entries: 15 pass, 11 fail, 55 descriptive, 4 not applicable, 9 not run. <!-- docs/validation_report.md header -->

| Test | Result | Verdict |
|---|---|---|
| Leave-one-year-out | median APE 7.23%, Spearman 1.000; 2015 0.80%, 2019 8.36% | Pass |
| Leave-one-region-out | Papua 5.85%, Sumatra 13.40%, Kalimantan 20.34%, Sulawesi 42.40%, Jawa-NT-Bali-Maluku 88.99% | Fail (3 regions) |
| Seam 2012-01 | Δ −0.057 [−0.117, 0.041] vs raw 1.519 | Pass |
| Seam 2022-01 | Δ 0.365 [0.110, 0.555], outside placebo | Fail |
| Sunset clause (fit 2012-16, test 2017-21) | KGE 0.889 vs global ratio 0.900 | Fail |
| Extreme years | top-3 {2014, 2015, 2019} on both scales | Pass |
| Anomaly flag agreement | F1 0.842, Cohen's κ 0.829 | Pass |
| Peat hypotheses H1-H3 (separate run) | H1 rejected, H2 accepted, H3 rejected (opposite sign) | Reported as found |

<!-- rows: docs/validation_report.md §2; peat row: docs/peat_results.md -->

On national totals the simpler region × season ratio has lower year-out error (2.32%) and higher sunset KGE (0.938) than our stratified model; our model gives the smallest 2012 seam step. <!-- docs/validation_report.md §3 -->

### Limitations

- Hotspots are detections, not fire events or burned area; underground peat fires can be missed by both sensors.
- The calibration does not transfer well to Kalimantan, Sulawesi and Jawa-NT-Bali-Maluku, and fails the 2022 seam test, which overlaps with Aqua orbit drift.
- Peat labels were joined after the main validation run, so the national κ does not yet use a peat stratum; the peat map license is unverified and H3 rests on one El Niño year.
- 2026 data are NRT and provisional. Only 3 verified SiPongi years exist for comparison.
- Few El Niño analog years, so analog rankings are uncertain.

### Benefits for users

BPBD, KHG/BRGM peat units and Manggala Agni can compare a month with the 2003-2022 baseline and with past El Niño years on one scale, with an uncertainty interval, instead of reading a sensor change as a fire trend.

### Tools and languages

Python (DuckDB, pandas, NumPy, SciPy, statsmodels, ruptures, pymannkendall, GeoPandas); TypeScript web app (Vite, DuckDB-WASM, MapLibre GL JS, deck.gl, Observable Plot). <!-- docs/credits.md -->

## NASA Data

- **FIRMS MODIS Collection 6.1 active fires (MCD14ML, Terra and Aqua), Standard Processing.** The reference scale (Aqua) and the only record before 2012. Matters because Aqua is the longest consistent afternoon record.
- **FIRMS VIIRS 375 m Collection 2 active fires: VNP14IMG (Suomi NPP), VJ114IMG (NOAA-20), VJ214IMG (NOAA-21), SP + NRT.** The post-2012 record, calibrated to the Aqua scale; NRT covers 2026. Matters because VIIRS detects many more small fires, which creates the artefact we measure.
- Input to the validation run: 6.36 M detections, 2000-11 to 2026-01. <!-- docs/validation_report.md header -->

[MODIS CMG MOD14CMQ/MYD14CMQ and MCD64A1: list only if used in the final run; MCD64A1 was not available for the validation run, per docs/validation_report.md §4.]

## Space Agency Partner Data & Other References

Non-NASA data:
- ONI (NOAA CPC) and DMI (NOAA PSL, HadISST): El Niño / IOD year classes.
- CHIRPS v2.0 monthly rainfall (UCSB Climate Hazards Center).
- geoBoundaries gbHumanitarian IDN ADM1/ADM2, 2019 (CC BY 3.0 IGO).
- Global Forest Watch "Indonesia peat lands" (Kementan/BBSDLP-derived; Ritung et al. 2011). License not stated on the item; CC BY 4.0 assumed, not verified.
- SiPongi (KLHK) burned area, used only for rank comparison.

References:
- Giglio, L., Schroeder, W., Justice, C.O. (2016). The collection 6 MODIS active fire detection algorithm and fire products. *Remote Sensing of Environment* 178:31-41.
- Csiszar, I. et al. (2014). Active fires from the Suomi NPP VIIRS: product status and first evaluation results. *JGR-Atmospheres* 119:803.
- Giglio, L. (2007). Characterization of the tropical diurnal fire cycle. *Remote Sensing of Environment* 108:407.
- Sofiev & Kouznetsov (2026), MODIS/VIIRS detection operator, re-implemented from published equations.

Open-source repositories (ideas or code reused, licenses in `THIRD_PARTY_LICENSES/`): portolan-mirrors/firms-catalog (Apache-2.0), Warren-530/fire-harmony (Apache-2.0), squadronzero/project-shift (Apache-2.0), tttamannaanand/burn-calendar (MIT), the-aris-club/flare-chronos (MIT). Full list: `docs/credits.md`.

## Use of SI (AI)

We used AI assistants for background research (literature, NASA data documentation, earlier public repositories), for organizing our research into a concept and requirements document (confirmed with the local Space Apps contact point before the event), and for drafting parts of code and documentation during the hackathon. Each AI-assisted file carries an `AI-assisted:` header and is reviewed, run and tested by a team member. All numbers come from our deterministic pipeline on NASA data; AI did not generate, estimate or fill in any result. [Images, video, voice: to be filled.] Log: `docs/ai_acknowledgement.md`.
