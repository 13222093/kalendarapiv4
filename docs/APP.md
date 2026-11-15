# Project 4: app work notes

The app side of project 4 (see `INTEGRATION.md`, "App plan"). Every file the app work changed is listed below, one
line each, in the style of `app/NOTICE.md`, so the integrator can carry them into the NOTICE. `app/NOTICE.md`,
`app/public/` and the other builds were not touched. `package.json` and `package-lock.json` are unchanged
(`npm ci` only).

## Files changed (14 November 2026)

- `src/lib/record.ts` (new): reads Second Sight's bundle in `public/ss-data/` (`index.json`, `monthly_<aoi>.json`, `validation_results.json`, `finding.json`) and tells a file that is not built yet (404, or the dev server's page in its place) from one that failed; computes "before and after" with Second Sight's definitions (`beforeafter.ts`: raw stitched as recorded, MODIS to 2011 and VIIRS from 2012; MODIS + VIIRS added together; harmonized `H` with the summed monthly 90% bounds; each indexed to its own 2003 to 2011 mean; change = mean 2019 to 2023 against 2003 to 2007), the 2012 jump (VIIRS S-NPP over MODIS Aqua fire cell-days on the months both report, over `calibration_window`), the month sentence (`bulan.ts`: ratio to the median of the same calendar month, rank), and the observability state of a month (`obs_class`, or "not computed" when it is null or not in `index.json` `obs_months`; never "unobserved").
- `src/lib/record.test.ts` (new): unit tests of those rules on a made-up fixture (never shown by the app).
- `src/pages/Record.tsx` (new): "Indonesia record" (`#/record?aoi=&m=&s=`), the main page: area picker from `index.json` (Central Kalimantan first, then Indonesia, the island regions, the featured and the other provinces), "Before and after", "Every month" (calendar) and "This month", "The zero, day by day" (Central Kalimantan: one card per season year, linking to Play the season when its files are built, with each month's observability and cloud share from the bundle), and "How sure"; every section has a unit line, a source line and loading, "not built yet" and failed states.
- `src/components/record/BeforeAfter.tsx` (new): the before and after chart (Observable Plot, house style), three stat tiles (raw change, harmonized change, the 2012 jump), a table view, and for Indonesia the national trend from `finding.json`.
- `src/components/record/RecordCalendar.tsx` (new): years x months calendar; colour = fire cell-days on one log scale for Raw and Harmonized (the ember tokens), Raw / Harmonized switch, light hatching for partly seen and heavy hatching for not seen, a teal dot for seen clearly, a small ring for "observability not computed", an inner line for provisional months, the 2012 seam, year totals, a readout, keyboard arrows, a table view.
- `src/components/record/ThisMonth.tsx` (new): one sentence for the picked month (harmonized count, its 90% range when it has one, ratio to the median month, rank, raw count), its observability (O, cloud and missing shares) or "not computed", and a link into Play the season for Aug to Oct of a built year.
- `src/components/record/HowSure.tsx` (new): error on held-out years, raw (M0) against the chosen method, from `validation_results.json` (log scale), the level change at the 2012 seam, and every test with a pass rule, failures first with their notes, passed, failed and not-run counts.
- `src/styles/record.css` (new): styles of the record page (theme tokens only, dark and light).
- `src/App.tsx`: route `#/record`; header links "Indonesia record" first and Fire Harmony's explorer named "Global context (Fire Harmony)"; Dashboard, Rankings and Haze moved into the page menu, whose button now shows at every width; brand links, footer tagline, data credit and links point to the record; `#/season?y=` mounts one season page per year.
- `index.html`: a first visit with no hash opens `#/record` (`#/` stays Fire Harmony's explorer); the page description names the record.
- `src/styles/brand.css`: the header's two-part explorer label, four header links without icons, the menu button at every width, a word-less Story pill and no data badge on narrow laptops; the Story's intro chart and its short phone source line.
- `src/pages/Story.tsx`: two new first beats, "the jump" and "the fix", with numbers computed from the bundle's national record (VIIRS against MODIS Aqua over the calibration window, raw and harmonized change) and a chart of Indonesia's yearly record over the map; the Central Kalimantan beats follow unchanged (same timings, offset by the intro); without the bundle the story is exactly as before; brand and "Skip story" go to the record, an "Indonesia record" button at the end.
- `src/pages/Season.tsx`: `#/season?y=2015|2019|2023` reads `ka-data/kalteng_Y_season.json`, `visibility_kalteng_Y.json` and `visY/` (2019 is the default, with the same files, links and addresses as before); a year whose files are not built says so; the header lists the built years and links to the record; days before 24 November 2015 use the NASA GIBS MODIS Terra true-colour photo (GIBS has VIIRS S-NPP true colour only from that day), and the foot says which.
- `src/styles/season.css`: the year links in the season header and the "not built yet" panel.
- `src/pages/Explorer.tsx`: the Central Kalimantan card links to `#/record?aoi=prov-kalimantan-tengah`.
- `src/components/BlindDistrictsCard.tsx`: a link to Central Kalimantan in the Indonesia record.
- `src/components/ReportedCard.tsx`: the detected row is labelled as Fire Harmony's harmonization (NOAA-20 scale), with a link to Central Kalimantan in the Indonesia record.

## Second round (after the data hand-over, `docs/DATA.md` section 8.1)

- `src/lib/record.ts`: `noInterval` (a month converted from VIIRS with `H_lo` = `H_hi` = `H`; Aqua-era months, which are Aqua's own count, are not flagged), `pooledRatio` (the single VIIRS-to-MODIS ratio behind them, median of `H / V_raw`), `YearPoint.noBand`, `blindShare` (`f_cloud`), and the validation status "not applicable" kept apart from "not run".
- `src/lib/record.test.ts`: tests of those rules (10 tests).
- `src/components/record/BeforeAfter.tsx`: no 90% band for the years with such months (a province from 2022), a rule and "no 90% range from 2022" at that year (the words only on wide charts), "no interval" in the table and the tooltip, a note naming the national ratio used (read from the data; before the data patch it was 0.193 Aqua MODIS fire cell-days per VIIRS one for Central Kalimantan), and the stat tile says it; Indonesia and the island regions keep their bands. Since the patch (third round) no month needs this.
- `src/components/record/RecordCalendar.tsx`: a computed month shows its blind share as a hatched strip along the foot of its cell (against a track of the full width) and in its label; under the calendar, each computed month with its blind share links to Play the season at its first day; "no 90% range" in the label of a month without an interval.
- `src/components/record/ThisMonth.tsx`: the month's observability class with its score and blind share to one decimal (worded "Seen clearly (O = 0.82). Still, 17.4% ..." until the fourth round, which replaced it: see below), and "no 90% range: converted with one national ratio" for such a month.
- `src/components/record/HowSure.tsx`: "not applicable" counted and labelled on its own (4 tests), with its notes.
- `src/pages/Record.tsx`: passes the pooled ratio and the season links; the season cards and the month-versus-day note give the blind share with one decimal.
- `src/styles/record.css`: the strip and its track, its legend key, the list of computed months, link colours.

## Third round (after the data patch cb0be2e, `docs/DATA.md` 9.1)

The re-exported province files have a 90% band from 2022 (island strata), so the app now draws the band there and says
nothing about a missing range: the second-round handling is driven by the data (`noInterval`) and found no such month.
- `src/lib/record.ts`: `noInterval` no longer flags months with no VIIRS fire (H = 0 converts to exactly 0; 37 province months, e.g. in Bali); it still guards against a converted month with fire and no interval.
- `src/lib/record.test.ts`: a test for that zero case.
- `src/pages/Record.tsx`: for a province, the source line says that its values from 2022 come from project 4's fix to the export (island-region ratios with a range) and differ from Second Sight's own export for those months.

## Fourth round (after the science review)

The review is `docs/research-v3/J2-science-judge.md` (one level up). What it marked down in the record page's claims,
and what changed, one line per file. Every number below is computed from `app/public/ss-data/` in the browser, or read
from it; the El Niño list is the only outside input.

- `app/src/lib/robust.ts` (new): the headline change and its robustness, from the yearly totals of the chart: the headline is the mean of 2017 to 2021 against 2003 to 2007 (`lib/windows.ts`, all Aqua MODIS's own count); a second reading across the 2022 seam (2019 to 2023); the headline without El Niño years; "Aqua MODIS alone" beside each; `reading` (does the direction hold, how far apart are the sizes); `lineMakeup` (checks that the harmonized yearly totals equal Aqua MODIS's own before 2022); `seamFails` (reads the 2022 seam check from the validation file); `elNinoYears` (applies the stored rule to the stored index values); `monthStatus` (the status label of a month from its `pct_rank` alone: under 0.25 below normal, under 0.75 near normal, under 0.90 above normal, else far above normal).
- `app/src/lib/robust.test.ts` (new): 23 unit tests of those rules on a made-up fixture, and of the stored El Niño file (its list equals its rule applied to its values; it names source, address, date and rule).
- `app/public/ka-data/enso_oni.json` (new): NOAA CPC Oceanic Niño Index, July to September values for 2000 to 2026, read 15 November 2026 from `https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt` (sha256 of the table in the file); rule: July to September ONI of +0.5 or more; years: 2002, 2004, 2009, 2015, 2023, 2026. September to November values are kept beside them, unused by the app, to show that the list depends on the season chosen.
- `app/src/components/record/BeforeAfter.tsx`: the harmonized series is named for what it is (Aqua MODIS's own count to 2021, VIIRS converted to the Aqua scale from 2022) in the stat tile, the legend, the table (two new columns: how each year's value was made, and Aqua MODIS alone), the tooltip, the subtitle and the source line; a dashed line marks 2022 on the chart next to the 2012 marker; the stat tiles and the title use the 2017 to 2021 headline; the robustness strip sits under the stat tiles with one sentence on what to read; the title says "detections", not "fire"; the absolute Theil-Sen slopes from `finding.json` are no longer shown (the raw series changes unit in 2012 and the file has no interval for them); English and Bahasa Indonesia.
- `app/src/components/record/HowSure.tsx`: evidence before counts: (1) held-out-year error, titled with the median over each year left out (434.7% uncorrected, 7.2% converted) instead of a mean of three rows; (2) the chosen method beside the simpler ones (M2 has 2.3% against M3's 7.2%; M3 fails the sunset rule against M1; the pre-written rule compared M3 with M1 only); (3) the seams, with "The 2022 seam check fails" said first and the 2012 pass described as in sample; (4) one decision per test, and the pass count explained (5 of 15 passes are one rank test that M0 also passes; 3 of 11 failures are M0); (5) the full list; pass and fail badges as a scoreboard removed; "we" instead of the source project's name; English and Bahasa Indonesia.
- `app/src/components/record/ThisMonth.tsx`: laid out as the top tile (the month and its provisional flag first, then the count against the median of the same month, then range, rank and raw); the class "good" reads "No cloud flag on most cell-days", with "thick smoke is not flagged as cloud" after the shares; "seen clearly", "no clear look" and "smoke may have obscured" removed; a status label next to the count ("below normal", "near normal", "above normal", "far above normal"), read only from the row's `pct_rank` (the share of the same month in earlier years that this month is above; checked against every row of the Indonesia and Central Kalimantan files), with the thresholds in a small line under it and ", provisional" when the row is flagged; no label when `pct_rank` is null, when the record has fewer than five earlier years for that month, or for Central Kalimantan from January to October 2019 (a registered test covers those months, so nothing new is shown for them, and the tile says so); the rank and the ratio to the median that this card has always shown are unchanged; English and Bahasa Indonesia.
- `app/src/styles/robust.css` (new): the strip, the evidence blocks of How sure and the top tile (theme tokens only).
- `docs/APP.md`: the stale "429% raw against 5.5% harmonized" corrected from the validation file; this section.
- `docs/methodology.md`, `docs/limitations.md`: what the harmonized line is, the headline window, the robustness results, the El Niño rule, and what the validation count does and does not show.

Numbers on screen (bundle de7fff88), raw / harmonized / Aqua MODIS alone:

| Comparison | Indonesia | Central Kalimantan |
|---|---|---|
| Headline: 2017 to 2021 against 2003 to 2007 | +94.7% / -64.4% / -64.4% | +19.2% / -73.6% / -73.6% |
| Across the 2022 seam: 2019 to 2023 against 2003 to 2007 | +98.5% / -62.8% / -62.9% | +35.2% / -70.8% / -70.2% |
| Headline without El Niño years (2004 left out) | +108.4% / -62.0% / -62.0% | +26.5% / -72.0% / -72.0% |

Not reproduced as the review wrote it: its "without El Niño years" figures (raw +25%, harmonized -80% for Indonesia;
raw -70% for Central Kalimantan) come from leaving out 2004, 2006, 2019 and 2023 from the 2019 to 2023 comparison. The
review states no rule; by the July to September rule fixed in the brief, 2006 (+0.33) and 2019 (+0.20) are not El Niño
years, so the page does not show those figures. They do reproduce from the data with the review's four years (raw
+25.1%, harmonized -79.5%; Central Kalimantan raw -69.8%, harmonized -92.7%); `docs/limitations.md` records them.

Checked (15 November 2026, about 19:55): `npx vitest run src/lib/robust.test.ts` 23 of 23 pass; `npx tsc -b` clean at
that time; `#/record` for Indonesia, Central Kalimantan and DKI Jakarta at 390x844 (dark and light) and Indonesia at
1440x900 (dark), English and Bahasa Indonesia: no sideways scroll, chart markers do not overlap, no console error from
these files (the dev server logged reload errors for files other agents were editing). Not checked: a production build
(`npm run build`), and the light theme at 1440.

## Checked

- `npm run build` passes; `tsc -b` clean; `src/lib/record.test.ts` 10 of 10 pass.
- With the real bundle (`ss-data` data version de7fff88, built 14 November 2026) in headless Chrome (software WebGL):
  `#/record` at 1440x900 and 390x844 in dark and light, Indonesia with Raw at 1440, `#/story` (jump, fix, Central
  Kalimantan beats) at 1440 and 390, `#/season?y=2015`, `#/season` (2019) and `#/season?y=2023`: no console errors, no
  sideways scroll. The header was measured without overlap at 900, 1024, 1280, 1440, 1600 and 1920 px.
- Numbers on screen, all from the bundle: Central Kalimantan raw +35%, harmonized -72%, VIIRS 4.8x MODIS Aqua
  (2012 to 2021); Indonesia raw +98%, harmonized -63%, 5.2x (both changes are 2019 to 2023 against 2003 to 2007, the
  headline until the fourth round); held-out error, median over each year of 2012 to 2021 left out in turn
  (`validation_results.json`, `meta.ablation`, `loyo_mdape`): 434.7% raw (M0) against 7.2% for the chosen method M3;
  2015 left out 442.9% against 0.8%, 2019 left out 409.2% against 8.4%. (This line used to read "429% raw against 5.5%
  harmonized": that was the mean of those three rows, which the chart title showed until the fourth round; it is not a
  number of the validation file.) 15 tests passed, 11 failed, 9 not run, 4 not applicable (55 descriptive). All nine
  Central Kalimantan months with observability (Aug to Oct 2015, 2019, 2023) are classed "good" (O 0.82 to 0.98; the
  class means no cloud flag on most cell-days, and thick smoke is not flagged; the page said "seen clearly" until the
  fourth round) with blind shares of 2.0% to 17.4% (October 2019): the calendar shows each share and links each month
  to its days in Play the season.
- After the data patch (cb0be2e): Central Kalimantan raw +35%, harmonized -71% (was -72% with the pooled ratio), its
  2022-on band drawn and no "no 90% range" text; September 2023 reads 1,743 (likely 1,657 to 1,800); Bali and Indonesia
  show no missing-range text either; the province source line appears for provinces only (checked at 1440 and 390).

## Known, not changed

- `src/lib/web.test.ts` (Fire Harmony's `prefetchFirstView`) has 3 failing tests, already failing in the scaffold
  snapshot (`web.ts` and its test are as committed in 3edd9bc): the test expects trend-map prefetches
  (`web/trend_l3.json`, `web/trend_l4.json`, a country's series) that `web.ts` does not make. Not touched here.
- Play the season wraps its 60 px date over two lines at 1440x900, as v1.0 does for 2019.
- The Browser pane often draws no frames while hidden, so charts (which wait for a ResizeObserver) and maps can look
  empty there; headless Chrome is the reliable check.


## Best-of landing and evidence update on branch codex/best-of-kalenderapi

- index.html: a clean first visit with no hash now opens #/home; explicit hashes still work, and #/ remains Fire Harmony’s global explorer.
- src/App.tsx: lazy-loads the landing page outside the global app shell.
- src/pages/Landing.tsx, src/pages/landing-data.ts, src/styles/landing.css: Sokrates-paced story structure and reveal/chart motion, using the integrated national bundle and reduced-motion support.
- src/pages/Record.tsx and src/components/record/HowSure.tsx: put compact 2012/2022 seam evidence next to the finding, retain the full decision ledger in an expandable table, and link the validation JSON.
- src/components/record/RecordCalendar.tsx, src/components/record/ThisMonth.tsx, src/lib/record.ts, and src/components/record/BeforeAfter.tsx: describe the observation mask as a limited no-clear-look layer rather than a hidden-fire estimate.
- src/styles/record.css: status styling for featured validation evidence and the expandable ledger.
- docs/BEST-OF-TICKETS.md, docs/methodology.md, docs/limitations.md, docs/project_page_draft.md, and README.md: coverage map and reviewer documentation.

These branch additions have not been followed by a new build or test run. Earlier checks above describe the earlier v4 snapshot only.
