# Project 4: KalenderApi x Second Sight (integrated build)

The fourth of the team's parallel builds for NASA Space Apps 2026 (*Harmonization of MODIS and VIIRS Hot Spots*),
made to be compared with KalenderApi v1.0, KalenderApi v1.1 and Second Sight.

- **Comparison of the builds:** `COMPARISON.md`
- **Plan and data contract:** `INTEGRATION.md`
- **Work notes:** `docs/DATA.md` (data), `docs/APP.md` (app)
- **App:** `app/` (from KalenderApi v1.0, a modified version of Fire Harmony, Apache-2.0; see `app/NOTICE.md`)
- **Science core:** `vendor/second-sight/` (Second Sight, MIT, snapshot of commit 9fff725; see its `LICENSE`)

- **AI use:** `AI_USE.md`

Status (14 November 2026): runs with real data. Second Sight bundle, validation and finding in `app/public/ss-data/`;
Central Kalimantan 2015, 2019 and 2023 seasons in `app/public/ka-data/`. Run: `cd app && npm ci && npm run dev`, then
open `#/record`.
