# Decisions (locked at kickoff, 14 Nov 2026)

Decisions below are locked for the hackathon. Changing one needs agreement from the whole team and a new dated entry in the change log at the bottom.

| # | Decision | Value |
|---|---|---|
| 1 | Project name | **Second Sight** (two words; repo/URL slug `second-sight`) |
| 2 | Tagline (EN) | *"Seeing the fires MODIS missed."* |
| 3 | Tagline (ID) | *"Melihat api yang luput dari satelit."* |
| 4 | Primary users | BPBD (provincial/district disaster agencies: alert-status decisions), KHG managers / BRGM (peat rewetting priorities), Manggala Agni (fire crew deployment) |
| 5 | Secondary users | Researchers and data agencies (BRIN, BMKG, universities), data journalists, global users of the region-free pipeline |
| 6 | Focus regions | **Kalimantan Tengah** and **Riau** (Indonesia) |
| 7 | Transfer region | **Western Amazon** (test that the method works outside Indonesia) |
| 8 | Video science moment | (a) the false **2012 jump** at the MODIS-to-VIIRS seam **disappears** after harmonization; (b) the **peat night** fires that MODIS missed become visible |
| 9 | Calibration window | **2012-2021** (MODIS-VIIRS overlap, before Terra/Aqua orbit drift) |
| 10 | Baseline period | **2003-2022** (historical median for anomalies; ENSO-conditional baseline uses the same period) |
| 11 | Reference scale | Aqua-MODIS equivalent, calibrated separately for peat vs mineral soil and day vs night |
| 12 | Repo license | MIT (no GPL code used; Sofiev 2026 operator re-implemented from equations) |
| 13 | Language | App: Indonesian default, full English. Submission materials (README, slides, video, project page): English |

## Roles

| Role | Area | Owner |
|---|---|---|
| R1 | Data engineer (ingest, cleaning, cells, environment) | _TBD_ |
| R2 | Harmonization scientist (strata, calibration, shrinkage, chain) | _TBD_ |
| R3 | Physics and validation scientist (FRP floor, drift, pre-registration, seam tests, LOYO/LORO, SiPongi) | _TBD_ |
| R4 | Frontend / UI | _TBD_ |
| R5 | Product and story (README, licenses, slides, video, project page, submission) | _TBD_ |
| R6 | AI and transfer, optional (brief, verifier, eval set, transfer region) | _TBD_ |

## Communication

- Main channel: _TBD_ (team chat). Repo issues/PRs reference ticket IDs from `docs/11-tiket-implementasi.md`.

## 30-second test (08 §6.3)

Each member answers in one sentence: what it is, for whom, and what proof we show. Answers must match before coding starts. Status: _pending_.

## Change log

| Date/time (WIB) | Change | Agreed by |
|---|---|---|
| 14 Nov 2026 | Initial decisions recorded | Team |
