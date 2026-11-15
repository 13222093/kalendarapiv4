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
- Second and third rounds: `src/lib/record.ts`, `src/lib/record.test.ts`, `src/components/record/*`, `src/pages/Record.tsx`, `src/styles/record.css`: the blind share of each month with FireMask observability, "not applicable" tests counted apart, and province months from 2022 drawn with the 90% band of the patched export (source lines name the patch).
- `vendor/second-sight/pipeline/export/bundle.py` (Second Sight, MIT): one 7-line patch, approved by the team, so province rows use their parent island kappa strata (see `docs/DATA.md` 9.1); `public/ss-data/` re-exported with it.
- `public/ka-data/` (new, built by `pipeline/visibility/` with the year as an argument): Central Kalimantan 2015 and 2023 season and visibility files, same rules as 2019.

## Submission build (15 November 2026)

Live at https://kalenderapi.vercel.app (Vercel, static files plus two serverless functions).

### Other people's work used in this build

- **FireLens** (github.com/abubokkor-cse/firelens, MIT License, Copyright (c) 2026 Team Aquila; licence text in
  `LICENSE-firelens-MIT.txt`). Used in `src/pages/Home.tsx`, the globe under "Indonesia this month". One line is
  copied as written (it collapses MapLibre's compact attribution when the map loads). Adapted, not copied: a
  transparent background layer under a globe-projection raster style, `dragRotate: false` with `maxPitch: 0`, a zoom
  control without a compass, stopping the slow turn when the visitor touches the globe, the frame loop with `jumpTo`,
  and `flyTo` with `essential: true`. FireLens's "condition right now" view was also the model for our
  "Today in my district" page; that page's code is our own.
- **PeatForge** (another team's project; no licence, so no code or assets were taken). Its use case, a message to
  residents, the district disaster office and the village, shaped what "Today in my district" offers.
- **OpenAI API**: `public/api/advise.js` sends the numbers shown on "Today in my district" to an OpenAI model
  (`gpt-6-luna`, with smaller models as a fallback) and returns a draft of advice. The key is read from the host's
  environment (`OPENAI_API_KEY`); it is not in the repository.
- **Fonts**: Fraunces, Public Sans and Geist Mono (SIL Open Font License 1.1), bundled through the `@fontsource-variable`
  packages.

### Data added in this build

- **NASA FIRMS near-real-time files** (VIIRS NOAA-20, VIIRS NOAA-21 and MODIS Collection 6.1; South-East Asia; last
  24 hours and last 7 days), read when "Today in my district" opens, through `public/api/live.js`.
- **NASA GIBS imagery**: VIIRS NOAA-20 true colour (the map on "Today in my district") and Blue Marble shaded relief and
  bathymetry (the globe).
- **geoBoundaries gbOpen, Indonesia ADM2** (CC BY 3.0 IGO, as the geoBoundaries API states): outlines of the 514 districts
  and cities in `public/ss-data/districts/`.
- **Indonesia peat lands** from the Global Forest Watch open data portal (original: Ministry of Agriculture, BBSDLP):
  `public/ka-data/peat_kalteng.geojson` and the peat cells behind `peat_persistence_kalteng.json`. **Its licence is not
  verified.** The source file's own note reads "UNVERIFIED (GFW open data portal; CC BY 4.0 assumed)".
- **NOAA Climate Prediction Center, Oceanic Nino Index** (US government work): `public/ka-data/enso_oni.json`, used to
  name the El Nino years in the robustness check.
- **MODIS MOD14A1 and MYD14A1 FireMask** from Microsoft Planetary Computer, as before, now for the fire seasons of
  2014 to 2024 and 2026 and one wet-season quarter (`docs/DATA.md` section 14).

### Changes to the app (by file)

- `src/pages/Now.tsx`, `src/lib/now.ts` (+ tests), `src/styles/now.css`, `public/api/live.js`, `public/api/advise.js`,
  `public/vercel.json` (all new): "Today in my district" (`#/now?aoi=`): hotspots of the last 24 hours and 7 days per
  district, this month against normal, a level by a rule shown on the page, three template messages with a WhatsApp
  link, peat sites to re-check, and the optional AI draft.
- `pipeline/peat/` (new) and `public/ka-data/peat_persistence_kalteng.json`: the exploratory peat persistence index
  (`docs/DATA.md` section 15). The 2019 season is not read.
- `pipeline/districts/` (new) and `public/ss-data/districts/`: monthly records for 514 districts, shared out from their
  province's conversion and marked approximate (`docs/DATA.md` section 13).
- `pipeline/visibility/build_blind_rule.py` (new) and `public/ka-data/blind_rule_kalteng.json`: the count of
  district-days when most of a district had no cloud-free look.
- `src/pages/Home.tsx`, `src/components/home/FireRibbon.tsx`, `src/lib/home.ts` (+ tests), `src/styles/home.css`
  (new): the home sections (the 2001 to 2026 calendar, MODIS and VIIRS by year, the challenge table, the globe, peat).
  `src/pages/Story.tsx` renders them under its final frame, so a first visit plays the Story and then scrolls on.
- `src/pages/Story.tsx`, `src/lib/storyHex.ts`: the 3D hexagon Story again, on our own VIIRS points and bundled NASA
  photos (`public/ka-data/story/`), with plain-language captions that name MODIS and VIIRS.
- `src/pages/Season.tsx`, `src/components/season/`, `src/lib/seasonGeo.ts`, `src/lib/seasonTheme.ts`: zoom and pan,
  a card for a hotspot and for a district, three speeds.
- `src/pages/Record.tsx`, `src/components/record/` (`RangePanel`, `DownloadPanel`, `AreaSearch`, `DownloadFigures`),
  `src/lib/download.ts`, `src/lib/robust.ts` (+ tests): a date range, CSV and PNG downloads, a hotspot CSV, search by
  name or by latitude and longitude, the robustness strip.
- `src/pages/Brief.tsx`, `src/lib/brief.ts` (+ tests): the printable one-page brief.
- `src/pages/Method.tsx`, `src/pages/Zero.tsx`, `src/pages/DistrictCalendar.tsx`: about and method, the zero inspector
  and the district calendar (the last two from KalenderApi v1.1).
- `src/lib/lang.ts`, `src/components/LangToggle.tsx`: English and Bahasa Indonesia on every page of ours.
- `src/styles/brand.css`: the "peat night" palette (warm near-black, bone text, one ember accent; MODIS blue, VIIRS
  gold), replacing the two themes named above.

### The demo video

The picture is a frame-by-frame render of the Story on the live site (headless Chrome, 1920 x 1080, 30 frames a
second); nothing in it is generated imagery. If the video carries a narration, the voice is an AI voice made with
ElevenLabs from a script the team wrote.
