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
- `src/components/record/BeforeAfter.tsx`: no 90% band for the years with such months (a province from 2022), a rule and "no 90% range from 2022" at that year (the words only on wide charts), "no interval" in the table and the tooltip, a note naming the national ratio used (read from the data: 0.193 Aqua MODIS fire cell-days per VIIRS one for Central Kalimantan), and the stat tile says it; Indonesia and the island regions keep their bands.
- `src/components/record/RecordCalendar.tsx`: a computed month shows its blind share as a hatched strip along the foot of its cell (against a track of the full width) and in its label; under the calendar, each computed month with its blind share links to Play the season at its first day; "no 90% range" in the label of a month without an interval.
- `src/components/record/ThisMonth.tsx`: "Seen clearly (O = 0.82). Still, 17.4% of the no-fire cell-days were blind zeros..." (one decimal), and "no 90% range: converted with one national ratio" for such a month.
- `src/components/record/HowSure.tsx`: "not applicable" counted and labelled on its own (4 tests), with its notes.
- `src/pages/Record.tsx`: passes the pooled ratio and the season links; the season cards and the month-versus-day note give the blind share with one decimal.
- `src/styles/record.css`: the strip and its track, its legend key, the list of computed months, link colours.

## Checked

- `npm run build` passes; `tsc -b` clean; `src/lib/record.test.ts` 10 of 10 pass.
- With the real bundle (`ss-data` data version de7fff88, built 14 November 2026) in headless Chrome (software WebGL):
  `#/record` at 1440x900 and 390x844 in dark and light, Indonesia with Raw at 1440, `#/story` (jump, fix, Central
  Kalimantan beats) at 1440 and 390, `#/season?y=2015`, `#/season` (2019) and `#/season?y=2023`: no console errors, no
  sideways scroll. The header was measured without overlap at 900, 1024, 1280, 1440, 1600 and 1920 px.
- Numbers on screen, all from the bundle: Central Kalimantan raw +35%, harmonized -72%, VIIRS 4.8x MODIS Aqua
  (2012 to 2021); Indonesia raw +98%, harmonized -63%, 5.2x; held-out error 429% raw against 5.5% harmonized; 15 tests
  passed, 11 failed, 9 not run, 4 not applicable (55 descriptive). All nine Central Kalimantan months with
  observability (Aug to Oct 2015, 2019, 2023) are "seen clearly" (O 0.82 to 0.98) with blind shares of 2.0% to 17.4%
  (October 2019): the calendar shows each share and links each month to its days in Play the season.
- Central Kalimantan from 2022 is drawn without a band and says so (58 S-NPP months with H / V_raw = 0.192959);
  Indonesia keeps its band (checked at 1440 light).

## Known, not changed

- `src/lib/web.test.ts` (Fire Harmony's `prefetchFirstView`) has 3 failing tests, already failing in the scaffold
  snapshot (`web.ts` and its test are as committed in 3edd9bc): the test expects trend-map prefetches
  (`web/trend_l3.json`, `web/trend_l4.json`, a country's series) that `web.ts` does not make. Not touched here.
- Play the season wraps its 60 px date over two lines at 1440x900, as v1.0 does for 2019.
- The Browser pane often draws no frames while hidden, so charts (which wait for a ResizeObserver) and maps can look
  empty there; headless Chrome is the reliable check.
