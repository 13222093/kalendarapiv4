# Best-of v4 - Ticket Backlog

> Format adapted from `../nasa-challenge-benchmark/docs/11-tiket-implementasi.md`: ID, priority, owner, estimate, dependencies, references, goal, work steps, verifiable acceptance, and output.
> Source of the NASA audit priorities: `../nasa-challenge-benchmark/docs/11-tiket-implementasi.md` and `docs/13-audit-produk.md`.
> Branch: `codex/best-of-kalenderapi`, created from v4 `main`.
> Work rule: implement sequentially on this branch; the user authorized a final commit and push after review.

## 0. Cara memakai

Progress by ticket: **15/17 Done (88%)**, 1 blocked (peat evidence gate), and 1 open (V4 validation rerun). “Done” means implementation or documentation is present; no fresh build or tests were run for this branch update.

- **P0** means needed for the local finding-first product; **P1** means supporting science work after P0.
- **Status** tracks this branch, not the status of the NASA challenge repository.
- Every displayed scientific number must come from the current bundle or a cited, versioned source file. Do not type computed findings into UI copy.
- "Done" requires the listed evidence to be present in code or documentation. A ticket does not claim tests or a fresh pipeline run unless one was actually executed.
- A clean first visit opens `#/home`; the record, story, and season routes remain directly reachable.

## Status tracker

| ID | Priority | Branch status | Reason / next action |
|---|---|---|---|
| LP-01 | P0 | Done | Create the standalone landing route, finding-first story structure, navigation, and primary links. |
| LP-02 | P0 | Done | Render the actual national raw/harmonized record and versioned validation results on the landing page. |
| LP-03 | P0 | Done | Add Sokrates-inspired reveal, chart-draw, and sticky-nav motion with reduced-motion and mobile support. |
| IN-01 | P0 | Done | Landing route and first-visit handoff are implemented by LP-01. |
| IN-02 | P0 | Done | v1.0 story and evidence sequence remain reachable. |
| IN-03 | P0 | Done | Day-by-day season pages use built 2015, 2019, and 2023 assets. |
| IN-04 | P0 | Done | FireMask scope and states are shown without hidden-fire estimates. |
| IN-05 | P0 | Done | v1.1 preregistration boundary is documented. |
| IN-06 | P0 | Done | Global Fire Harmony context is separate from the Indonesia M3 record. |
| FND-03 | P0 | Done | Finding-first record shows the sourced series, preliminary status, and key validation directly after the finding chart. |
| PG-01 | P0 | Done | README and project-page draft link the sourced result, method, validation, credits, and limitations. |
| FE-15 | P0 | Done | 2012 pass and 2022 failure are featured; the full decision ledger is expandable and its JSON is downloadable. |
| SUB-02 | P0 | Done | README includes routes, run steps, evidence, sources, limitations, licenses, and AI-use acknowledgement. |
| SUB-03 | P0 | Done | Method and limitation notes trace the current bundle and separate it from unrun or vendor-only analyses. |
| FND-04 | P1 | Done | Robustness audit records available windows and intervals, flags the raw slope interval spanning zero, and marks M1/M2 refits not run. |
| FND-05 | P1 | Blocked for app claims | Current integrated bundle says peat is unknown and V9 is not run. Keep peat results out of claims until the data gate passes. |
| VAL-05b | P1 | Open | Drift helper exists, but the main validation runner still reports V4 as not run. |

### Scope cuts

- **PG-02 (public deployment):** excluded; publishing is an external action and is not needed for local review.
- **PG-03 (release tag):** excluded; branch push is authorized, but a release tag is outside the requested action.
- Slides, video, final submission, interviews, and public project-page submission are outside this local implementation.
- AI agent, readiness calendar, predictive claims, peat headline, and transfer modules remain cut unless later evidence and scope justify them.

## Source coverage audit

The first 11-ticket list was a priority slice, not a complete best-of map. This register assigns a disposition to every NASA benchmark epic and the distinct v1/v1.1 contributions. Existing source work is mapped rather than duplicated.

| NASA source tickets | v4 disposition | Evidence / reason |
|---|---|---|
| SET-01–06 | Retain | Repo, licenses, preregistration, and design are recorded in project docs. |
| DAT-01–02, 04, 06–09 | Retain where evidenced | Ingest, cleaning, aggregation, AOIs, climate indices, and bundle export are documented in DATA.md. |
| DAT-03 | Partial / gated | Peat labels are unknown; three-year SiPongi values are descriptive, not the requested official-source validation. |
| DAT-05 | Partial / not run | The data-health pipeline output was not generated in this run. |
| DAT-11 | Deferred | CHIRPS/DC climate workflow was not run; DC also needs account access. |
| DAT-10 | Blocked / separate | CMG cloud inputs need external acquisition and pyhdf; not required for the limited FireMask visibility layer. |
| PHY-01–03 | Not run / deferred | DATA.md records pipeline.physics and drift_check as not run; do not claim diagnostic outputs. |
| PHY-04–05 | Cut | Sofiev operator and physics-prior calibration are unsupported by the reviewed run. |
| CAL-01–04 | Retain | M3 calibration, bootstrap bounds, sensor chain, and harmonized series are represented in the bundle. |
| CAL-05 | Defer | Arbitrary-AOI recalibration is not part of this product. |
| CAL-06 | Not run / deferred | The FRP-conditioned M4 branch is explicitly not run in DATA.md and validation_results.json. |
| TRI-01–03 | Supporting only | H_large, H_energy, and agreement remain non-headline measures. |
| TRI-04 | Retain with narrow coverage | FireMask visibility is integrated for nine listed Central Kalimantan months; others stay not computed. |
| ANO-01–02 | Retain | Monthly baseline and ENSO/IOD context remain supporting features. |
| ANO-03 | Cut | Readiness calendar is predictive decision tooling outside the validated finding. |
| VAL-01–04, VAL-06–07, VAL-10, VAL-12 | Retain and disclose | 94-row output includes pass, fail, descriptive, not-applicable, and not-run statuses. |
| VAL-05 | Open | V4 is not_run; wiring and regenerated results remain outstanding. |
| VAL-08, VAL-11, VAL-13 | Defer | Field, observability/triangulation, and coefficient checks are incomplete or not run. |
| VAL-09 | Gate closed | Peat labels are unknown; H1–H3 are not_run. |
| DEC-01–03 | Cut from headline | AOI prioritization and readiness outputs are outside the evidence-first product. |
| EXP-01 | Retain | Versioned JSON evidence bundle is present in app/public/ss-data/. |
| EXP-02 | Partial / deferred | The separate CSV aggregate export was not copied into the app bundle. |
| EXP-05 | Not run / deferred | Validation figure generation was not run; do not claim generated figures. |
| EXP-03–04 | Defer | Evidence ledger and hosted API need separate provenance and hosting decisions. |
| FE-01–09, FE-12, FE-15–18, FE-21 | Retain where present | Record, calendar, AOI, month summary, validation, JSON/Parquet file access, responsive layout, and theme are represented in app pages. |
| FE-10, FE-19–20 | Gate/defer | Peat and decision tools depend on outputs absent from this bundle. |
| FE-11, FE-13–14 | Defer | Satellite Gantt, lab, and extended explanations are secondary to the finding. |
| AI-01–05 | Deferred | Deterministic record arithmetic is not the proposed fact table, brief generator, anomaly explainer, or evaluation suite. |
| AI-06 | Cut | Natural-language filter query is not required for the evidence-first product. |
| EXT-01–02 | Cut | Amazon transfer and repeat-burn are separate questions without current inputs. |
| SUB-01, SUB-04–05, SUB-08–09 | External / paused | Interviews, slides, video, final submission, and pitch are team actions. |
| SUB-02–03, SUB-06–07 | Retain | README, method/limitations, project page, and cross-artifact QA belong in this backlog. |

### Unique contributions from the other builds

Every unique item listed in COMPARISON.md is either mapped to an implementation ticket or explicitly deferred/cut below.

| Source | Feature carried into v4 | Ticket |
|---|---|---|
| KalenderApi v1.0 | Story, multi-year daily seasons, NASA imagery, and limited FireMask observation gaps | IN-01–04 |
| KalenderApi v1.0 | SiPongi card — deferred: only three descriptive annual comparisons; no standalone card with adequate coverage | FND-04 boundary |
| KalenderApi v1.1 | Timestamped preregistration and no unregistered hidden-fire estimate | IN-05 |
| KalenderApi v1.1 | guard.py and tests — deferred; protocol linked, guard/tests not imported or run | IN-05 |
| KalenderApi v1.1 | Native 1 km MODIS grid and VNP14A1 path — deferred; absent from integrated bundle | IN-05 |
| KalenderApi v1.1 | #/zero and #/calendar consolidated into #/record and RecordCalendar | IN-01, IN-05 |
| Second Sight benchmark | M3 harmonization, uncertainty, finding, 94 validation rows | FND-03, FE-15, FND-04, VAL-05b |
| Fire Harmony | Global explorer as separate context | IN-06 |

---

## 1. Epic LP · Landing page

### LP-01 · Standalone landing structure and story

P0 · R4 (Frontend) + R5 (Product/story) · 1.5 hours · Depends on: existing v4 app shell, `#/record`, Second Sight bundle contract · References: Sokrates landing structure in `../Sokrates/Socrates/praxis-fe/src/app/page.tsx`; Sokrates reveal pattern in `../Sokrates/Socrates/praxis-fe/src/components/landing/Interactive.tsx`; product evidence in `INTEGRATION.md` and `app/src/pages/Record.tsx`.

- **Tujuan:** make a first-time visitor understand the Indonesia satellite-record question and find the full evidence without needing to know the app routes.
- **Kerjakan:**
  1. Add a standalone `#/home` route before the explorer shell, preserving direct access to `#/record`, `#/story`, and `#/season`.
  2. Send a clean first visit with no hash to `#/home`; keep explicit route hashes intact.
  3. Add a compact announcement strip, brand/header, section navigation, accessible mobile menu, and a primary CTA to the Indonesia record.
  4. Write the hero around the MODIS-to-VIIRS handoff and Indonesia. Explain that the product measures hotspot cell-days, not a count of fires or burned area.
  5. Build a long-form page sequence: question, observed sensor change, harmonization method, evidence/validation, observability limits, and final CTA/source footer.
  6. Treat the Sokrates page as a reference for hierarchy and interaction pacing only. Use KalenderApi's own palette, typography, data, imagery, and wording; do not copy its source or assets.
  7. Keep all links functional with keyboard navigation and visible focus; give every section a unique heading and a useful skip link.
- **Selesai jika:**
  - [ ] A fresh visit opens the landing page and the main CTA opens `#/record`.
  - [ ] Existing story, season, record, methods, and data routes remain directly addressable.
  - [ ] The first viewport names Indonesia, explains the MODIS/VIIRS record question, labels the finding preliminary, and offers a clear next action.
  - [ ] The page contains the required story sections and source/footer content, not only a hero mockup.
  - [ ] No claim attributes the trend to policy, land use, or a hidden-fire estimate.
  - [ ] Navigation, mobile menu, skip link, and CTAs work by keyboard and expose accessible names.
- **Output:** `app/index.html`, `app/src/App.tsx`, `app/src/pages/Landing.tsx`, `app/src/styles/landing.css`.

### LP-02 · Bundle-backed finding chart and validation evidence

P0 · R4 + R2 (Harmonization) + R3 (Validation) · 2 hours · Depends on: LP-01, `app/public/ss-data/index.json`, `finding.json`, and `validation_results.json` · References: `app/src/lib/record.ts`, `app/src/components/record/BeforeAfter.tsx`, `app/src/components/record/HowSure.tsx`, `INTEGRATION.md` §§1, 6.

- **Tujuan:** let a reviewer inspect the finding and its strongest relevant pass/fail evidence directly from the landing page, using the same bundle as the record page.
- **Kerjakan:**
  1. Load the national monthly series, finding metadata, and validation results through the existing `lib/record.ts` loaders; do not add a second data path or manually transcribe output values.
  2. Draw a responsive annual comparison of the naïvely stitched record and harmonized Aqua-equivalent series, indexed to the stated 2003–2011 baseline.
  3. Mark 2012 as the VIIRS handoff. Label the unit, period, baseline, data source, and the 90% harmonized band; describe the summed series only if shown and define why it double-counts overlap.
  4. Show the validation result for the 2012 MODIS-to-VIIRS seam and the 2022 seam from the validation bundle. Include the result, rule/status, and interval when present.
  5. Keep the preliminary finding status adjacent to the chart. If any source file is missing or fails to load, show a clear unavailable state and a link to the full record instead of substituting sample values.
  6. State that a passing 2012 seam does not erase the failed 2022 seam; avoid converting validation output into a causal or policy conclusion.
- **Selesai jika:**
  - [ ] Chart points and validation values are derived from the current bundle loaders.
  - [ ] Chart labels explain fire cell-days, each-series indexing, date range, 2012 seam, and uncertainty band.
  - [ ] Both the 2012 result and the 2022 failure remain visible when present in the bundle.
  - [ ] Missing data produces an honest fallback, not a chart with invented or stale values.
  - [ ] Preliminary status and the scope of the comparison are readable on desktop and mobile.
  - [ ] The chart has a screen-reader description or equivalent accessible summary.
- **Output:** `app/src/pages/Landing.tsx`, `app/src/styles/landing.css`; reuse `app/src/lib/record.ts` loaders.

### LP-03 · Landing interactions, motion, and responsive finish

P0 · R4 · 1.5 hours · Depends on: LP-01, LP-02 · References: Sokrates `Interactive.tsx` and `ProblemStory.tsx` for reveal/step pacing; KalenderApi motion tokens in `app/src/styles/brand.css`.

- **Tujuan:** carry the visitor through the evidence with restrained motion that remains understandable and usable on touch devices and with reduced-motion preferences.
- **Kerjakan:**
  1. Add one-time viewport reveals for sections/cards and a draw-in transition for the real data chart; content must remain readable if the observer API is unavailable.
  2. Animate the hero's satellite/scan motif with CSS or inline SVG. Mark it decorative or conceptual so it cannot be mistaken for a measured dataset.
  3. Make the sticky header change material after scrolling and keep anchor navigation from obscuring section headings.
  4. Keep the mobile menu usable with Escape, focus, and touch; close it after navigation.
  5. Honor `prefers-reduced-motion`: reveal content immediately, stop automatic loops, and remove smooth scrolling/chart draw transitions.
  6. Tune narrow layouts, large text, focus styles, contrast, chart overflow, and reduced viewport heights.
- **Selesai jika:**
  - [ ] Scroll reveals happen once and do not hide content when JavaScript motion APIs are unavailable.
  - [ ] Chart animation is tied to real chart paths and does not alter displayed values.
  - [ ] Decorative motion does not block pointer or keyboard interaction.
  - [ ] Reduced-motion mode has no looping or draw-in motion and preserves all content.
  - [ ] Landing page has no horizontal overflow at phone widths; nav and chart remain usable.
  - [ ] Focus is visible, section links land at visible headings, and the menu closes accessibly.
- **Output:** `app/src/pages/Landing.tsx`, `app/src/styles/landing.css`.

---

### IN-01 · First-visit landing and route handoff

P0 · R4 · 1 hour · Depends on: app shell and direct routes · References: v1.0 story; LP-01.
- **Tujuan:** introduce the integrated finding before the full app.
- **Kerjakan:** route an empty hash to landing; preserve record, story, season, methods, data, and explorer hashes; provide a record CTA.
- **Selesai jika:** empty hash opens landing; direct links remain addressable; CTA opens the Indonesia record.
- **Output:** app/index.html, app/src/App.tsx.

### IN-02 · Keep the v1.0 evidence story

P0 · R4 + R5 · 1 hour · Depends on: bundle-backed finding · References: v1.0 README and story.
- **Tujuan:** retain the “jump, fix, zero” narrative without synthetic evidence.
- **Kerjakan:** source values from the integrated bundle; name the unit; distinguish detections from visibility gaps; link to the record.
- **Selesai jika:** story opens directly; values have source and unit; no hidden-fire estimate is claimed.
- **Output:** app/src/pages/Story.tsx.

### IN-03 · Multi-year daily season playback

P0 · R4 · 1.5 hours · Depends on: season and visibility files · References: v1.0 Play the season.
- **Tujuan:** retain daily evidence for each year with built files.
- **Kerjakan:** load 2015, 2019, and 2023 from their own files; preserve date in URL; show not-built for missing assets; display image provenance.
- **Selesai jika:** available years open directly; image errors do not erase data; absent years are not implied available.
- **Output:** app/src/pages/Season.tsx, app/public/ka-data/.

### IN-04 · FireMask visibility with a strict claim boundary

P0 · R3 + R4 · 1 hour · Depends on: TRI-04 fields · References: v1.0 visibility, v1.1 zero/calendar, INTEGRATION.md.
- **Tujuan:** show clear-view gaps without estimating hidden-fire totals.
- **Kerjakan:** preserve clear, partial, unobserved, and not-computed; show AOI/month scope; separate visibility from harmonized counts; link supported months to playback.
- **Selesai jika:** not-computed differs from observed states; page says it does not estimate hidden fires; months trace to bundle fields.
- **Output:** RecordCalendar.tsx, ThisMonth.tsx, Season.tsx.

### IN-05 · Respect the v1.1 preregistration boundary

P0 · R2 + R3 · 0.5 hour · Depends on: timestamped preregistration · References: v1.1 prereg-v1; INTEGRATION.md.
- **Tujuan:** preserve the protocol without leaking unregistered statistics.
- **Kerjakan:** link the timestamped preregistration; state registered windows; document that no new statistic or hidden-fire estimate was computed for those windows; require a future guard and validation before display.
- **Selesai jika:** protocol and result are distinct; no unregistered statistic is shown; unavailable estimates remain unavailable.
- **Output:** INTEGRATION.md, record evidence note.

### IN-06 · Separate global context from the Indonesia record

P0 · R4 + R5 · 0.5 hour · Depends on: both source scales · References: Fire Harmony explorer and Second Sight bundle.
- **Tujuan:** prevent the global Fire Harmony scale from being mistaken for the Indonesia M3 series.
- **Kerjakan:** label explorer as global context; show source and unit on each chart; do not combine units; provide a route back to the record.
- **Selesai jika:** labels, source, unit, and return link are visible; no chart mixes products.
- **Output:** app/src/App.tsx, source labels.

## 2. Epic FND · Finding and evidence

### FND-03 · One “Before vs after” finding screen

P0 · R4 (Frontend) + R5 (Product/story) · 2–3 hours · Depends on: existing FND-01/FND-02 outputs, FE-06 data wiring, VAL-04 results · References: NASA audit addendum FND-03 in `../nasa-challenge-benchmark/docs/11-tiket-implementasi.md`; `../nasa-challenge-benchmark/docs/13-audit-produk.md` §§5–7; `app/src/pages/Record.tsx`; `app/src/components/record/BeforeAfter.tsx`; `app/src/components/record/HowSure.tsx`.

- **Tujuan:** make the first evidence screen answer one question: how does Indonesia’s apparent fire-cell-day record change when MODIS and VIIRS are compared on one scale?
- **Kerjakan:**
  1. Keep the naïve stitch, MODIS+VIIRS sum, and harmonized series together; explain that the sum double-counts sensors during overlap and is a diagnostic, not an alternate estimate.
  2. Put the finding statement before the calendar, month card, and season player. Use the source `finding.json` wording/values and retain its PRELIMINARY status.
  3. Attach the 2012 seam validation and the relevant later seam failure to the finding screen, with values/status/rule sourced from `validation_results.json`.
  4. State the comparison window and baseline for any percent-change sentence. Keep annual trend slope and period-to-period change distinct.
  5. Explain that 0.01° fire cell-days count cell-days with detected hotspots; they are neither unique fire events nor burned area.
  6. Keep the chart, finding sentence, status, source note, and validation proof in the same initial page flow at desktop and mobile widths.
  7. Preserve links to the supporting calendar, observability view, methods, and data downloads after the primary finding.
- **Selesai jika:**
  - [ ] First screen states the research question, Indonesia as the area, the sensor transition, and the current supported result.
  - [ ] Naïve, summed, and harmonized series are visible with consistent units, source, baseline, and uncertainty treatment.
  - [ ] Finding values come from the committed bundle and show its preliminary status.
  - [ ] 2012 seam result and failed 2022 seam result are not hidden behind a tab or tooltip.
  - [ ] Trend slope, comparison-window change, detected hotspot cell-days, fires, and burned area are not conflated.
  - [ ] No policy, land-use, or hidden-fire count is presented as an explanation or result.
  - [ ] Supporting sections remain reachable below the finding screen.
- **Output:** `app/src/pages/Record.tsx`, `app/src/components/record/BeforeAfter.tsx`, source-linked copy.

---

## 3. Epic PG · Project page and README narrative

### PG-01 · Finding-first README and project-page draft

P0 · R5 (Product/story) · 3 hours · Depends on: FND-03, current validation output, SUB-02, SUB-03 · References: NASA audit addendum PG-01 and project-page checklist in `../nasa-challenge-benchmark/docs/11-tiket-implementasi.md`; `../nasa-challenge-benchmark/docs/13-audit-produk.md` §§5, 7–8; `INTEGRATION.md`; `docs/DATA.md`.

- **Tujuan:** let a reviewer understand the question, supported finding, method, validation, and limits from the README and project-page draft without opening the app.
- **Kerjakan:**
  1. Open with one research question, the named area (Indonesia), the intended user/audience only where supported, and the finding status.
  2. Use a concise finding sentence that is generated from the current approved finding artifact; do not reuse the withdrawn F1 comparison or copy values from the sibling project.
  3. Name the exact NASA FIRMS MODIS/VIIRS products, harmonization source, time window, data version/run date, and units.
  4. Explain the pipeline in reviewer order: hotspot detections → 0.01° fire cell-days → sensor calibration → harmonized series/uncertainty → validation.
  5. Include a compact validation table with positive, failed, descriptive, not-applicable, and not-run outcomes represented honestly.
  6. State current limitations, including PRELIMINARY status, failed 2022 seam, failed regional transfer where relevant, approximate summed uncertainty band, and observability scope.
  7. Include citations, third-party credits/licence notes, AI-use acknowledgement, local run instructions, and pending placeholders for public demo/video links.
- **Selesai jika:**
  - [x] README has a one-sentence project summary, run commands, data/method, validation, limitations, citations, credits, and AI acknowledgement.
  - [x] Project-page draft includes the required fields in English and marks unavailable public URLs as pending.
  - [ ] Every number has an artifact/source and run/version trace.
  - [ ] Failed tests are placed beside positive validation, not omitted or relabeled as passes.
  - [ ] F1 withdrawn claim, unsupported causal claims, and unsupported estimates do not appear.
  - [ ] The documentation distinguishes cell-days, fire events, and burned area.
- **Output:** `README.md`, `docs/project_page_draft.md`, links to methodology/limitations and evidence artifacts.

---

## 4. Epic FE · Validation UI

### FE-15 · One concise validation panel

P0 · R4 (Frontend) + R3 (Validation) · 2.5 hours · Depends on: VAL-04, VAL-06, current validation bundle · References: NASA ticket FE-15 in `../nasa-challenge-benchmark/docs/11-tiket-implementasi.md`; audit addendum in `../nasa-challenge-benchmark/docs/13-audit-produk.md`; `app/src/components/record/HowSure.tsx`.

- **Tujuan:** show enough evidence for a reviewer to judge the selected harmonization while keeping the main story focused.
- **Kerjakan:**
  1. Lead with the chosen method's held-out-year error and 2012 seam result, including the comparison method where useful.
  2. Keep a compact table of decision-relevant checks with status, metric, rule, and concise note.
  3. Include every failed check relevant to the national headline, especially the 2022 seam; visually distinguish fail, pass, descriptive, and not run.
  4. State three practical limitations: post-calibration-era uncertainty/2022 seam, regional transfer failure, and the current observability/peat data boundary.
  5. Show official burned-area comparison only if an integrated compatible source, year, unit, and citation are present; otherwise omit it.
  6. Keep a link to the complete validation artifact for auditability.
- **Selesai jika:**
  - [ ] At least one out-of-sample metric and the 2012 seam check are visible.
  - [ ] Relevant failures remain visible and cannot be mistaken for a pass.
  - [ ] Status, rule, units, and source are legible without opening a tooltip.
  - [ ] Three limitations are stated in plain language.
  - [ ] No official comparison is shown without a source/year/unit.
  - [ ] Full validation output remains accessible from the panel.
- **Output:** `app/src/components/record/HowSure.tsx`, small supporting styles/data only if required.

---

## 5. Epic SUB · Submission documentation

### SUB-02 · README repository front page

P0 · R5 · 1.5 hours · Depends on: all P0 evidence/documentation tickets · References: NASA ticket SUB-02 in `../nasa-challenge-benchmark/docs/11-tiket-implementasi.md` §15; PG-01; `INTEGRATION.md`.

- **Tujuan:** make the repository front page runnable and auditable without implying an unreviewed public release.
- **Kerjakan:**
  1. State the project question and supported finding in the first paragraph; include location and status.
  2. Add local installation/run instructions that match the v4 app's actual package scripts and required data files.
  3. Link to data provenance, method, validation, limitations, project-page draft, and citations.
  4. Describe data sources, current bundle/run, main chart, unit, and the key validation failure.
  5. Add third-party attribution/licence and AI-use statement; mark demo/video as pending if no approved public URL exists.
- **Selesai jika:**
  - [x] First screen of README contains the question, location, supported result, and preliminary label.
  - [x] Run instructions match files and scripts present in this branch.
  - [ ] Data, method, validation (including failures), limitations, citations, credits, and AI-use are linked or summarized.
  - [ ] No broken local links or guessed public URLs are present.
  - [ ] README does not claim deployment, final submission, or a release tag.
- **Output:** `README.md`.

### SUB-03 · Metodologi dan keterbatasan

P0 · R2 (Harmonization) + R3 (Validation) · 2 hours · Depends on: VAL-04 and actual integrated bundle/run · References: NASA ticket SUB-03 in `../nasa-challenge-benchmark/docs/11-tiket-implementasi.md` §15; `docs/DATA.md`; `INTEGRATION.md`; `vendor/second-sight/docs/finding.md`; `vendor/second-sight/docs/trend_results.md`.

- **Tujuan:** document the production calculation and the boundaries of what this app can conclude from its current output.
- **Kerjakan:**
  1. Record input products, date coverage, preprocessing, grid/cell-day definition, sensor-specific series, and provenance/version hashes.
  2. Explain calibration window and M3 shrinkage method, the VIIRS-to-Aqua conversion, the 5th/95th bounds, and the province-ratio integration patch.
  3. Describe how the naïve, summed, and harmonized series are formed and indexed; define all comparison windows.
  4. Reproduce validation counts and key results from the integrated `validation_results.json`, including failed and not-run checks.
  5. Explain the current observation-gap fields: "unobserved" means no clear view for that cell-day; it does not estimate how many hidden fires occurred.
  6. Separate confirmed pipeline behavior from Second Sight's source documentation and mark any mismatch or rerun needed.
- **Selesai jika:**
  - [ ] `docs/methodology.md` describes the exact path and formulas used by this app's current bundle.
  - [ ] `docs/limitations.md` lists preliminary status, the 2022 seam failure, transfer failure, incomplete peat labels, and missing/partial observability coverage where relevant.
  - [x] Both documents distinguish hotspot cell-days from unique fire events and burned area.
  - [x] Bundle version, validation run, and finding run can be traced from the docs.
  - [ ] No value from the NASA sibling project's newer/different run is copied as if produced by this bundle.
- **Output:** `docs/methodology.md`, `docs/limitations.md`.

---

## 6. Epic FND · Robustness and gated supporting result

### FND-04 · Robustness audit of the headline trend

P1 · R2 (Harmonization) · 1.5 hours for audit/documentation; additional analysis time if source outputs are absent · Depends on: FND-01, FND-03, CAL-04, VAL-04 · References: NASA audit addendum FND-04 in `../nasa-challenge-benchmark/docs/11-tiket-implementasi.md`; `vendor/second-sight/docs/trend_results.md`; current `app/public/ss-data/finding.json`.

- **Tujuan:** determine and report which trend statements survive the registered method, period, and uncertainty checks.
- **Kerjakan:**
  1. Inventory existing artifacts for Theil–Sen, modified Mann–Kendall, interval estimates, alternate windows, and M1/M2/M3 sensitivity before calculating or editing any claim.
  2. Compare the registered full-period result with both registered early/late windows. Record the exact years, method, estimate, interval, and p-value when available.
  3. Compare calibration sensitivity only where outputs were produced under the approved method; label absent results `not run`.
  4. Check whether the naïve slope interval spans zero; if it does, say the raw positive slope is not statistically distinguishable from zero.
  5. Keep policy, moratorium, peat restoration, weather, and land-use causes out of the claim unless separately tested.
  6. Keep the integrated finding.json slope separate from vendor/second-sight/docs/trend_results.md; the latter is a distinct trend run.
  7. Retain PRELIMINARY until review and QA are complete; make no causal claim.
- **Selesai jika:**
  - [ ] Full-period and both registered-window results are traceable to artifacts.
  - [ ] Method and uncertainty are reported for each available result.
  - [ ] M1/M2/M3 sensitivity is reported or explicitly marked not run.
  - [ ] Naïve-slope significance is stated according to its interval.
  - [ ] No causal explanation is inferred from a descriptive trend.
  - [ ] The app uses no more specific claim than the updated source artifact supports.
- **Output:** trend/finding artifacts and `vendor/second-sight/docs/trend_results.md`; app copy only after the source output is updated.

### FND-05 · Peat result as a gated supporting finding

P1 · R3 (Validation) + R5 (Product/story) · 1 hour for claim integration after the data gate; data/validation rerun is separate · Depends on: DAT-03 peat join and VAL-09 run in the integrated bundle · References: NASA audit addendum FND-05 in `../nasa-challenge-benchmark/docs/11-tiket-implementasi.md`; `app/public/ss-data/index.json`; `app/public/ss-data/validation_results.json`; `INTEGRATION.md`.

- **Tujuan:** include a peat result only when this branch's joined peat labels and corresponding validation output support the preregistered hypothesis.
- **Kerjakan:**
  1. Check the integrated bundle's peat label values and V9 status before writing or displaying any peat result.
  2. If labels remain `unknown` or V9 is `not_run`, keep the result blocked and state only that no peat finding is available from this bundle.
  3. If a future valid run is integrated, report H1/H2/H3 individually as supported, rejected, or null under the registered rules.
  4. Include label provenance, resolution/mixed-cell limitation, sample-size limits, and the one-El Niño-year constraint where applicable.
  5. Never claim that MODIS missed more peat fires unless the specific hypothesis passes with appropriate uncertainty.
- **Selesai jika:**
  - [ ] Peat claims are gated on known labels and a completed validation result in the same integrated run.
  - [ ] H1, H2, and H3 outcomes are reported separately and match the registered rules.
  - [ ] Null/rejected outcomes and sample limits remain visible.
  - [ ] No peat result appears in the app while the current bundle reports unknown labels or V9 not run.
- **Output:** conditional supporting section in `docs/project_page_draft.md` and app only after the gate passes; otherwise document the block.

---

## 7. Epic VAL · Validation runner integration

### VAL-05b · Wire the physics drift result into validation

P1 · R3 (Validation) · 1 hour · Depends on: PHY-03, CAL-04, VAL-04 · References: NASA audit addendum VAL-05b in `../nasa-challenge-benchmark/docs/11-tiket-implementasi.md`; `vendor/second-sight/pipeline/run/drift_check.py`; `vendor/second-sight/pipeline/run/validate_all.py`.

- **Tujuan:** make the main validation command evaluate V4 from actual physics summary and held-out M3/M3x outputs under the preregistered rule.
- **Kerjakan:**
  1. Trace the helper's inputs, output schema, units, and preregistered thresholds before wiring it into the runner.
  2. Read `physics_summary.json` and M3/M3x held-out results from explicit pipeline paths; do not introduce a manually entered statistic.
  3. Emit one V4 row with value, interval if available, rule, status, note, and input provenance.
  4. Preserve the conditional/unverified marker for diurnal parameters; do not convert a conditional result into an unconditional pass.
  5. Return `not_run` with a reason if a required input is missing or malformed.
  6. Update validation docs and command documentation to identify how V4 is produced.
- **Selesai jika:**
  - [ ] A single documented validation command creates a V4 entry from source artifacts.
  - [ ] Entry contains the registered rule, value/status, provenance, and parameter caveat.
  - [ ] Missing input yields `not_run`, never pass or a fabricated zero.
  - [ ] Current results are regenerated before any V4 claim is shown.
  - [ ] Tests or a reproducible validation run are recorded only if actually executed.
- **Output:** `vendor/second-sight/pipeline/run/validate_all.py`, runner/helper integration, validation docs.

---

## 8. Execution log

- Existing v4 already contains portions of FND-03, FE-15, and the multi-season calendar; tickets require completing the remaining acceptance criteria rather than duplicating those features.
- Earlier branch edits are local and uncommitted. Landing tickets LP-01 to LP-03 are now the first planned implementation sequence.
- No commit or push is part of this work.
