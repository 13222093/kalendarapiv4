# NASA Space Apps project-page draft

## Project title
KalenderApi: Indonesia’s MODIS–VIIRS fire record, on one scale

## Challenge
Harmonization of MODIS and VIIRS Hot Spots

## Project summary
Indonesia’s satellite hotspot record changes sensors when VIIRS joins MODIS. This project compares the raw stitched series with an Aqua MODIS-equivalent M3 series and exposes the validation failures and observation limits alongside the result. The finding is preliminary.

## Problem
VIIRS detects smaller hotspots than MODIS. A raw splice can therefore create an apparent jump when the sensor changes, even if underlying fire activity did not change by the same amount. Users need to distinguish measurement changes from changes in detected cell-days and inspect where the observations are incomplete.

## Approach
NASA FIRMS MODIS Collection 6.1 and VIIRS 375 m active-fire detections are filtered, deduplicated, and aggregated to 0.01° cell-days. Second Sight’s stratified M3 calibration maps the later VIIRS series to the Aqua MODIS scale. The app presents the raw stitch, a sensor-sum diagnostic, the harmonized series and its bootstrap range, the 94-row validation ledger, and a limited FireMask observation-gap view. A timestamped v1.1 preregistration is linked, but no unregistered hidden-fire estimate is shown.

## Current evidence
Data bundle de7fff88, generated 14 November 2026; full manifest hash and run provenance are linked in DATA.md. For the 2019–2023 mean compared with 2003–2007, the raw stitched national series is +98% and the harmonized series is −63%. The integrated finding artifact reports national 2001–2025 slopes of +1,739.5 raw and −1,614 harmonized cell-days per year. The result remains preliminary: the production 2022 seam test fails and regional transfer errors are high in several regions.

The app does not claim these observed trends were caused by a particular policy, land-use change, peat condition, or weather pattern.

## Validation snapshot

| Check | Current evidence |
|---|---|
| Registered M3 switch test at 2012 | Pass, Δ −0.0569 |
| Production M3/main seam at 2022 | Fail, Δ +0.365 |
| Validation ledger | 15 pass, 11 fail, 55 descriptive, 4 not applicable, 9 not run |
| Leave-one-region-out transfer | 20.34% Kalimantan; 42.40% Sulawesi; 88.99% Java–Nusa Tenggara–Bali–Maluku |
| Peat hypotheses | Not run; labels are unknown |
| Observation visibility | Nine Central Kalimantan months only |

## What is new
The interface brings a finding-first Indonesian record together with daily season playback and a bounded observation-gap layer, while keeping the separate Fire Harmony global explorer clearly labelled. It preserves failed and unrun checks in the same product as the headline.

## Who can use it
Researchers, educators, and reviewers can inspect the data, methods, and checks in the browser or download source files. This draft does not claim a field-tested operational decision service.

## Demo and media
- Public demo: pending
- Video: pending
- Presentation: pending

## Data, code, and credits
- Data provenance and hashes: docs/DATA.md
- Methodology: docs/methodology.md
- Limitations: docs/limitations.md
- Validation: app/public/ss-data/validation_results.json
- Finding: app/public/ss-data/finding.json
- Second Sight science core: MIT, see vendor/second-sight/LICENSE
- KalenderApi/Fire Harmony application and assets: see app/NOTICE.md and included Apache-2.0 license
- AI-use acknowledgement: AI_USE.md

## Claim boundary
A fire cell-day is not a unique fire event, burned area, emissions, or a hidden-fire estimate. The 90% calibration range does not capture every uncertainty. Public deployment and final submission are not yet complete.
