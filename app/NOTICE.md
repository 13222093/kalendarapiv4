# NOTICE

KalenderApi web app (NASA Space Apps 2026) is a modified version of **Fire Harmony**
(https://github.com/Warren-530/fire-harmony, commit 986906c, 2026-11-13),
Copyright 2026 Team Kopi and Cosmos, licensed under the Apache License, Version 2.0.
The license text is in `LICENSE-fire-harmony-Apache-2.0.txt`.

Data read at run time: Fire Harmony dataset v1.0 (CC BY 4.0), NASA FIRMS (MODIS C6.1, VIIRS 375 m),
NASA GIBS / Worldview imagery. Built into files in `public/ka-data`: NASA MODIS MOD14A1 and MYD14A1 C6.1 FireMask
(read from Microsoft Planetary Computer), geoBoundaries gbOpen IDN ADM2 (CC BY 3.0 IGO; BPS, WFP, OCHA ROAP).

## Modifications by the KalenderApi team (2026-11-14)

- `index.html`, `src/App.tsx`, `src/lib/i18n.ts`: product name and titles changed to KalenderApi; source and footer
  lines credit Fire Harmony.
- `src/styles/brand.css` (new) and `src/main.tsx`: new fonts (Fraunces, Public Sans, Geist Mono) and two colour
  themes (dark "Mission control", light "Field ledger") layered over the original tokens.
- `src/components/MapView.tsx`: new optional `photoDate` prop that draws a NASA GIBS true-colour photo of
  one day under the hexagons (MODIS Terra before 20 Jan 2012, Suomi NPP VIIRS until 1 Nov 2026, NOAA-20 VIIRS after).
- `src/pages/Explorer.tsx`: new "What could satellites see?" control (photo toggle and day picker).
- `.env.local`: data URLs point at the hosted Fire Harmony data during development.
- `src/pages/Story.tsx` (new) and `src/App.tsx`: full-screen cinematic landing at `#/story` (deck.gl, real level 4 hexagons, NASA GIBS VIIRS true colour). `App` now wraps the original shell (`Shell`).
- `src/components/ReportedCard.tsx` and `src/styles/reported.css` (new), `public/ka-data/reported_kalteng.json` (new), `src/pages/Explorer.tsx` (Overview tab, Central Kalimantan only): "Detected and reported" card, harmonized hotspots per year next to the official burned area from SiPongi+ (Kementerian Kehutanan, "SIPONGI KEMENHUT", read 2026-11-14), 2015 to 2025.
- `src/pages/Season.tsx` and `src/styles/season.css` (new), `public/ka-data/kalteng_2019_season.json` (new, built by `kalenderapi/scripts/build_season.py` from the FIRMS VIIRS S-NPP 2019 Indonesia archive), `src/App.tsx` (route `#/season`), `src/pages/Story.tsx` ("Play the season" button): "Play the season", Central Kalimantan 1 Aug to 31 Oct 2019, one real day per frame (NASA GIBS VIIRS true colour plus that day's VIIRS hotspots, 7-day fading trail, "re-appeared after a gap" rings).
- `src/pages/Season.tsx`: photo tiles load only around the data box (about 4 a day instead of about 11), the play waits at most 450 ms for a day's photo and then goes on without it, a paused day's photo loads before the next days' and, if it has not come, is pushed every 600 ms and fetched again twice before the page says it did not come (failed tiles are logged in the console), a lost WebGL context is said on screen, a browser that draws no frames for 3 s gets a still NASA GIBS (WMS) photo of the day, labelled as a still without the hotspots, `&debug=1` in the address shows a readout of frames per second and each stage of the day's photo, and the camera fits the room the panel and the dock leave; under 900 px wide the caption shows two lines with "More" and the sources fold under "Sources and method".
- `src/styles/season.css`: "Play the season" laid out as a grid (header, the day's panel as a left column that scrolls inside itself, the playback dock across the bottom), tighter at laptop heights; under 900 px wide a compact top band and a slim dock leave the map at least about 60% of the height (65% at 800x593, 61% at 390x844).
- `src/styles/brand.css`: the "What could satellites see?" photo control moved above the map's zoom rail, where the panel and the phone sheet never cover it; styles for the header "Story" link and the Central Kalimantan season card.
- `src/App.tsx`: a "Story" link (`#/story`) in the header tools, a plain link outside the typed page nav.
- `src/pages/Explorer.tsx`: for Central Kalimantan, a "Play the 2019 fire season" card (`#/season`) and a "Watch the story" link (`#/story`) at the top of the panel.
- `src/pages/Story.tsx`: the September and last beats no longer claim what the app cannot show (a per-district list of the zeros satellites saw, peat "never seen"); they now say a zero can mean the ground was hidden and point to the day-by-day photos.
- `src/pages/Explorer.tsx`: the NASA photo note now says fires could have gone unseen under the haze that day, instead of "a zero there was never seen".
- `public/ka-data/visibility_kalteng_2019.json`, `public/ka-data/vis2019/` (92 images) and `public/ka-data/kalteng_districts.json` (new, built by `kalenderapi/scripts/build_visibility.py`): blind zeros for Central Kalimantan, 1 Aug to 31 Oct 2019, per day and per district (land with no fire detected that Terra and Aqua saw only under cloud, from the NASA MODIS daily FireMask), with the 14 district borders.
- `src/pages/Season.tsx`: the day's blind zeros hatched on the map (no data dotted) with the district borders, a "Blind zeros" number (today and Aug to Oct), a table by district (today and Aug to Oct), a toggle in the playback bar, captions that say what share of the no-fire land Terra and Aqua saw clear, and the sources and counting rule in the foot.
- `src/styles/season.css`: styles for the blind-zero number, table, toggle and key; on wide screens the three numbers sit side by side and, below 900 px tall, the caption shows its first paragraph with "More"; on narrow screens short labels and the table open with "More" (the map keeps 63% at 390x844 and 800x593).
- `src/pages/Story.tsx`: the September and last beats now carry numbers computed from the blind-zero file (the share of land seen clear on 15 September; the blind share for Aug to Oct, September and October) and again say the app shows which zeros were blind, day by day and district by district; without the file they keep the plain text.
- `src/pages/Explorer.tsx`: the Central Kalimantan season card mentions the blind zeros by district.
- `src/pages/Story.tsx`: the landing no longer draws 3D hexagon columns; it shows the data at the size the satellites
  measure it: August 2019 VIIRS 375 m hotspots as dots, one real day per step, the hotspots of 15 September under that
  day's smoky photo, then the blindest day of the season (taken from the blind-zero file) with its blind zeros hatched
  on the 0.01 degree grid and the 14 district borders; a stamp says which day the dots and the photo show.
- `src/components/BlindDistrictsCard.tsx` (new), `src/styles/reported.css`, `src/pages/Explorer.tsx` (Overview tab,
  Central Kalimantan only): "Blind zeros by district", a map of the 14 districts shaded by their share of blind zeros
  (Aug to Oct 2019) and a ranked list, from `visibility_kalteng_2019.json` and `kalteng_districts.json`.
- `src/components/Legend.tsx`, `src/styles/brand.css`: a note under the map legend saying how large one hexagon is,
  that its colour counts hotspots and not burned area, and that its edges do not follow district borders.

## Project 4 (integrated build, 14 November 2026)

Project 4 adds the Indonesia record, built on **Second Sight** (github.com/Inforable/nasa-challenge-benchmark, commit
9fff725, MIT License, copyright 2026 Second Sight team; snapshot in `vendor/second-sight/`, its `LICENSE` kept). Data the
app reads from it: `public/ss-data/` (Second Sight bundle, validation and finding, built from NASA FIRMS by its
unchanged pipeline; see `docs/DATA.md`). Changes to the app (full notes in `docs/APP.md`):

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
- Second round: `src/lib/record.ts`, `src/lib/record.test.ts`, `src/components/record/*`, `src/pages/Record.tsx`, `src/styles/record.css`: no 90% band for province months converted with one national ratio (from 2022), the blind share of each month with FireMask observability, and "not applicable" tests counted apart.
- `public/ka-data/` (new, built by `pipeline/visibility/` with the year as an argument): Central Kalimantan 2015 and 2023 season and visibility files, same rules as 2019.
