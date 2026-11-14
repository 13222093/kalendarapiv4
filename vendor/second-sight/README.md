# Second Sight

Indonesia's satellite fire record jumps every time NASA changes satellites, so fire managers at BPBD, peat-unit (KHG/BRGM) offices and Manggala Agni cannot tell a real increase from a sensor artefact; Second Sight asks **what share of Indonesia's apparent fire increase since 2012 is an artefact of switching from MODIS to VIIRS**, with a focus on the peatlands of Kalimantan and Sumatra.

> NASA Space Apps 2026 (14-15 Nov, Bandung). Challenge: *Harmonization of MODIS and VIIRS Hot Spots*. Second Sight puts all detections on one Aqua-MODIS-equivalent scale. It describes past and current activity only; it is not a forecast. MODIS and VIIRS counts are never added together.

## What we found

[FINDING — from docs/finding.md]

Supporting result from validation: concatenating raw MODIS and VIIRS creates a step of 1.52 log units at January 2012, i.e. VIIRS counts about 4.6x Aqua for the same fires; after calibration the step is −0.057 log units with a 90% interval of [−0.117, 0.041] (Pettitt p = 0.351). <!-- source: docs/validation_report.md §2 V3 seam 2012-01, §3 reading -->

Supporting finding on peat (Sumatra + Kalimantan, 2012-2021; ρ = S-NPP : Aqua fire cell-days, 90% year-block bootstrap CI): <!-- source: docs/peat_results.md "ρ per stratum" and "Decisions" -->

- **H1 rejected.** We expected VIIRS to gain most over MODIS on peat. At night the opposite holds: ρ is 7.86 [6.82, 8.86] on peat vs 13.65 [12.78, 15.81] on mineral soil; in the day they are equal (3.76 vs 3.78).
- **H2 accepted.** On peat, ρ at night is about 2x the day value (7.86 vs 3.76).
- **H3 rejected, opposite sign.** In the El Niño year 2015 ρ on peat was higher than in other years (log difference +0.285 [0.226, 0.390]), not lower. Only one El Niño year (2015) falls in the window, so this is weak evidence.

## Data

| Product | Use |
|---|---|
| NASA FIRMS MODIS Collection 6.1 (MCD14ML, Terra + Aqua), Standard Processing | Reference scale (Aqua) and pre-2012 record, 2000-11 onwards |
| NASA FIRMS VIIRS 375 m Collection 2: VNP14IMG (S-NPP), VJ114IMG (NOAA-20), VJ214IMG (NOAA-21), SP + NRT | Post-2012 record; NRT for 2026 (provisional) |
| ENSO indices: ONI (NOAA CPC), DMI (NOAA PSL, HadISST) | El Niño / IOD year classes and analog years |
| CHIRPS v2.0 monthly rainfall (UCSB CHC) | Rainfall context |
| geoBoundaries gbHumanitarian IDN ADM1 (34) and ADM2 (522), 2019 | Region and regency labels (CC BY 3.0 IGO) |
| Global Forest Watch "Indonesia peat lands" (Kementan/BBSDLP-derived, Ritung et al. 2011) | Peat labels at 0.01° cell centroids (99.31% of cells labelled, 10.06% on peat). License not stated on the item; CC BY 4.0 assumed, **not verified** <!-- docs/peat_results.md label coverage --> |

Input to the validation run: 6.36 M FIRMS detections, 7,731 monthly stratum rows, 2000-11 to 2026-01. <!-- source: docs/validation_report.md header table -->
Sources, versions and hashes: `docs/data/data_manifest.json`, `pipeline/support/README.md`.

## Method

```
FIRMS detections (MODIS C6.1 + VIIRS C2)
  -> clean: static-source mask, local time, day/night
  -> cell-days: one count per grid cell per day per sensor (not raw pixels)
  -> overlap calibration 2012-2021: kappa = sum(Aqua) / sum(S-NPP) cell-days
       why stop at 2021: Aqua/Terra orbits drift after 2021
       (2023-25 vs 2003-12 overpass: Aqua +37 min day / +38 min night,
        Terra -38 min day / -42 min night)
  -> strata: region x season x day/night (peat tested separately, H1-H3)
       empirical Bayes shrinkage of stratum kappa toward the pooled value
       year-block bootstrap (1000 resamples) for intervals
  -> chain: NOAA-20 -> S-NPP factor 0.971 for post-S-NPP continuity
            Terra -> Aqua factor 2.578 for 2000-2002
  -> harmonized monthly series (Aqua until 2021-12, S-NPP x kappa after)
  -> baseline: 2003-2022 median per calendar month + El Nino analog years
```
<!-- drift: docs/physics_results.md PHY-02 lines 29-30; chain factors, bootstrap: docs/validation_report.md §1 and header -->

National pooled kappa = 0.193 (30 strata, all between 0 and 1). Day kappa ranges 0.143-0.273, night 0.030-0.108 by region. <!-- source: docs/validation_report.md §1 -->
Code map and formulas: [`docs/methodology.md`](docs/methodology.md). Physics diagnostics: [`docs/physics_results.md`](docs/physics_results.md).

## How sure are we

Rules were written before the run (`docs/validation_plan.md`) and not changed afterwards. Of 94 entries: 15 pass, 11 fail, 55 descriptive, 4 not applicable, 9 not run. <!-- source: docs/validation_report.md header -->

| Test | Result | Verdict |
|---|---|---|
| Leave-one-year-out (LOYO) | median abs. % error 7.23%, Spearman 1.000; 2015 error 0.80%, 2019 error 8.36% | PASS |
| Leave-one-region-out (LORO) | Papua 5.85%, Sumatra 13.40%, Kalimantan 20.34%, Sulawesi 42.40%, Jawa-NT-Bali-Maluku 88.99% | **FAIL** (Kalimantan, Sulawesi, JNBM) |
| Seam 2012-01 | Δ −0.057 [−0.117, 0.041], inside placebo band | PASS |
| Seam 2022-01 | Δ 0.365 [0.110, 0.555], outside placebo [−0.240, 0.047] | **FAIL** (likely Aqua drift in the reference; not separable from kappa error) |
| Sunset clause (calibrate 2012-16, test 2017-21) | KGE 0.889 vs simple global ratio 0.900 | **FAIL** (second clause) |
| Extreme years | same top-3 years {2014, 2015, 2019} on both scales | PASS |
| Anomaly flag agreement (≥ p90) | F1 0.842, Cohen's kappa 0.829 (n = 120) | PASS |
| Peat hypotheses H1-H3 (VAL-09, separate run) | H1 rejected, H2 accepted, H3 rejected with opposite sign | see What we found |

<!-- source: docs/validation_report.md §2; peat row: docs/peat_results.md -->

Honest reading: on national totals the simpler region × season ratio (M2) has lower LOYO error (2.32%) and higher sunset KGE (0.938) than our stratified model (M3). M3 gives the smallest 2012 seam step and the best 2015 error. <!-- source: docs/validation_report.md §3 -->
Full report: [`docs/validation_report.md`](docs/validation_report.md).

## Limitations

1. Hotspots are detections, not fire events and not burned area.
2. Peat fires underground or under thick smoke can be missed by both sensors.
3. Kappa is assumed stationary within each stratum; LORO shows it does not transfer well to Kalimantan, Sulawesi and Jawa-NT-Bali-Maluku.
4. The calibration fails the 2022-01 seam test; post-2021 values carry extra uncertainty from Aqua orbit drift.
5. Peat labels were joined after the main validation run: the national κ and the table above do not yet use a peat stratum; H1-H3 rest on one El Niño year and a peat map with unverified license, labelled at 0.01° cell centroids (edge cells can be misclassified).
6. No backcast: the pre-2012 series lacks small fires only VIIRS can see.
7. 2026 data are FIRMS NRT and provisional; 2026-01 may be partial.
8. Official burned area (SiPongi) uses different methods; only 3 verified years were compared (descriptive).
9. Few El Niño analog years (6 in 2000-2026), so analog rankings are uncertain. <!-- source: docs/validation_report.md §1 -->

Full list: [`docs/limitations.md`](docs/limitations.md).

## Reproduce

Requires Python 3 and Git Bash (Windows) or any POSIX shell; raw data are kept outside git in `SS_DATA_DIR`.

```bash
bash scripts/pipeline.sh venv        # create .venv and install requirements
bash scripts/pipeline.sh data        # ingest FIRMS + write data manifest
bash scripts/pipeline.sh cells       # clean, static-source mask, cell-days
bash scripts/pipeline.sh aggregate   # monthly stratum table
bash scripts/pipeline.sh test        # unit tests
SS_DATA_DIR=/path/to/data bash scripts/validate.sh --n-boot 1000   # validation + figures

cd app && npm install && npm run dev # web app
```

## AI use statement

AI assistants were used for background research, organizing the concept and requirements (confirmed with the local Space Apps contact point), and drafting parts of code and documentation during the hackathon; AI-assisted files carry an `AI-assisted:` header. All numbers come from the deterministic pipeline on NASA data; AI did not generate or estimate any result. Details: [`docs/ai_acknowledgement.md`](docs/ai_acknowledgement.md).

## Credits and licenses

- Code: [MIT](LICENSE) © 2026 Second Sight team.
- Third-party repositories (Apache-2.0 / MIT, license texts in [`THIRD_PARTY_LICENSES/`](THIRD_PARTY_LICENSES/)), libraries and data: [`docs/credits.md`](docs/credits.md).
- Data: NASA FIRMS (LANCE / EOSDIS); NOAA CPC and PSL; UCSB CHC (CHIRPS); geoBoundaries (CC BY 3.0 IGO); Global Forest Watch / Kementan BBSDLP peat (license unverified).
- Key references: Giglio, Schroeder & Justice (2016) *RSE* 178:31-41 (MODIS C6); Csiszar et al. (2014) *JGR-Atmospheres* 119:803 (VIIRS); Giglio (2007) *RSE* 108:407 (diurnal cycle).
