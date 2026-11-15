# KalenderApi × Second Sight: Indonesia’s MODIS–VIIRS fire record

## Submission build (15 November 2026)

**Live: https://kalenderapi.vercel.app** · NASA Space Apps 2026, "Harmonization of MODIS and VIIRS Hot Spots".

A first visit plays a 29-second Story and rests on the home page; scroll for the 2001 to 2026 calendar, MODIS and VIIRS by year, a table of what the challenge asks for and where it is in the app, and a globe of this month by province.

| Page | What it answers |
|---|---|
| `#/now` Today in my district | What did the satellites detect in the last 24 hours and 7 days, is it normal, and what should I tell the village, the district disaster office and the fire crew? |
| `#/record` Indonesia record | When does my area usually burn, and is this month unusual, on one scale for MODIS and VIIRS? (34 provinces, 514 districts, a date range, downloads) |
| `#/season` Play the season | Day by day in Central Kalimantan: where was a zero a day under cloud, when the satellite could not see? |
| `#/zero` Zero inspector | One district, one day, cell by cell |
| `#/brief` District brief | One printable page per area, in English or Bahasa Indonesia |
| `#/method` About and method | What we count, how the one scale is made, what we checked and what failed |

Credits and licences: [app/NOTICE.md](app/NOTICE.md). AI use, including the two AI features in the app: [AI_USE.md](AI_USE.md). Data provenance: [docs/DATA.md](docs/DATA.md). Project page text: [docs/submission/PROJECT_PAGE.md](docs/submission/PROJECT_PAGE.md).

## Research question

How much of Indonesia’s apparent change in satellite fire detections reflects the MODIS-to-VIIRS sensor handoff, and what remains uncertain after harmonization?

**Current finding: preliminary.** For the 2017–2021 mean compared with 2003–2007, the raw stitched record is **+95%**; the M3 harmonized record is **−64%** on the Aqua MODIS scale. Across the 2022 seam (2019–2023 against 2003–2007) the two are **+98%** and **−63%**. The production validation passes the registered 2012 switch test but fails the later 2022 seam check. These results describe detected hotspot cell-days; they do not explain why fire activity changed.

A 0.01° fire cell-day is a grid cell with at least one detected hotspot on a local date. It is not a unique fire event, burned area, or emissions estimate.

## What this build combines

- **Second Sight:** Indonesia-wide MODIS/VIIRS harmonization, bootstrap ranges, finding artifacts, and a 94-row validation ledger.
- **KalenderApi v1.0:** satellite story, daily Central Kalimantan season playback, NASA imagery, and a limited observation-gap layer.
- **KalenderApi v1.1:** timestamped preregistration and a boundary against showing an unregistered hidden-fire estimate. Its guard code, tests, native-grid output, and VNP14A1 path are not integrated.
- **Fire Harmony:** a separate worldwide explorer, labelled as global context rather than mixed into the Indonesia result.

A first visit opens the Story, which ends on the home page. Direct routes #/record, #/story, #/season and the others in the table above remain available. The record keeps the raw stitch, diagnostic sensor sum, and harmonized series separate.

## Evidence at a glance

| Evidence | Current result |
|---|---|
| Data bundle | Version de7fff88, generated 14 November 2026; full SHA and manifest in DATA.md |
| Comparison window | 2017–2021 mean against 2003–2007 mean (headline, all Aqua's own count); 2019–2023 against 2003–2007 as the check across the 2022 seam |
| Sensor seam | Registered M3 switch test passes for 2012; production M3/main 2022 seam fails |
| Validation ledger | 15 pass, 11 fail, 55 descriptive, 4 not applicable, 9 not run |
| Regional transfer | Leave-one-region-out error: Kalimantan 20.34%, Sulawesi 42.40%, Java–Nusa Tenggara–Bali–Maluku 88.99% |
| Observation gaps | FireMask visibility for Central Kalimantan: the fire seasons (August to October) of 2014 to 2024 and 2026, and one wet-season quarter; cloud only; no hidden-fire total is estimated |
| Peat hypotheses | The registered peat hypotheses are not run. Separately, an exploratory index counts where fire comes back on Central Kalimantan peat (DATA.md section 15); the 2019 season is not read |

The integrated finding artifact reports 2001–2025 Theil–Sen slopes of +1,739.5 raw and −1,614 harmonized cell-days per year. It does not include a slope confidence interval. A separate vendor trend report contains different percentage-scale estimates and is kept distinct from this bundle.

## Run locally

Requirements: Node.js and npm. The committed app bundle is included; no science pipeline rerun is needed to view it.

    cd app
    npm ci
    npm run dev

Open the local URL printed by Vite. See APP.md, INTEGRATION.md, and DATA.md for app routes, integration, and data provenance.

## Review the method and limits

- [Methodology and production formulas](docs/methodology.md)
- [Limitations and unrun analyses](docs/limitations.md)
- [NASA-style implementation tickets and coverage map](docs/BEST-OF-TICKETS.md)
- [Finding artifact](app/public/ss-data/finding.json) and [validation ledger](app/public/ss-data/validation_results.json)
- [FND-04 trend source report](vendor/second-sight/docs/trend_results.md), separate from the integrated bundle

## Credits and status

NASA FIRMS MODIS Collection 6.1 and VIIRS 375 m active-fire archives supply hotspot detections. The integrated science bundle is adapted from Second Sight (MIT; see vendor/second-sight/LICENSE). The inherited KalenderApi/Fire Harmony application and assets are attributed in app/NOTICE.md and its included Apache-2.0 license. Source acknowledgements and hashes are in DATA.md.

AI-use acknowledgement: AI_USE.md. Public demo: https://kalenderapi.vercel.app. The demo video is linked from the Space Apps project page.
