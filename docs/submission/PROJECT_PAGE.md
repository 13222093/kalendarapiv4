# Space Apps project page: text to paste

Draft of 15 November 2026, 21:30. English, as the event rules require. Lines marked **[FILL]** wait for tonight's
video link; do not submit with a [FILL] left in.

## Project name

KalenderApi: zero hotspots is not always zero fire

## Summary (high-level)

(199 words; the form suggests 50 to 200.)

KalenderApi ("fire calendar" in Indonesian) answers a question a district fire officer in Central Kalimantan faces
every morning: can I trust a report of zero hotspots?

First we harmonize NASA's MODIS and VIIRS hotspots since 2000 onto one scale, as a burning calendar for 34 provinces
and 514 districts. Joined as recorded, fires seem to rise 95% between 2003-2007 and 2017-2021; on one scale they fall
64%. The rise was the sharper sensor.

Then we go where harmonization stops. Under cloud a satellite cannot see, so a zero can mean "not seen". From NASA's MODIS fire masks we map this by district and day over eleven fire seasons: on 1,482 of 13,510 district-days,
most of the district had no cloud-free look.

"Today in my district" gives the disaster office (BPBD) live NASA hotspots, whether the month is
unusual, and a level set by a published rule. One tap puts a ready-made message, in Bahasa Indonesia, into WhatsApp
for the village head. The Manggala Agni fire crew gets coordinates of the newest hotspots and of peat sites where fire
keeps coming back: 18,113 on Central Kalimantan's peat.

We wrote our validation tests first, and we show the ones that failed.

## Project demonstration

**[FILL: public link to the 30-second video]**

## Project (final project link)

https://kalenderapi.vercel.app

## Project details

### The problem

Indonesia's hotspot record changes satellites in 2012, when VIIRS joins MODIS. VIIRS sees smaller fires, so a raw
splice shows a surge that is mostly the sensor. A provincial disaster agency (BPBD) that asks "is this year unusual?"
gets the wrong answer from the raw record. There is a second problem that harmonization does not fix. A day with zero
hotspots is read as a quiet day. Under cloud, it is a day the satellite could not look.

### What KalenderApi does

- **A burning calendar on one scale**, November 2000 to November 2026, for Indonesia, its island regions, its provinces
  and 514 districts: one row per year, one column per month. Find a district by name or by latitude and longitude.
- **This month against the median** of the same month, with its rank, for the area you pick.
- **A date range you choose**, compared with the same months in every other year, with CSV and PNG downloads, and a CSV
  of the hotspots themselves for the seasons we hold.
- **The zero, day by day**: for Central Kalimantan's 14 districts, a map for each day of the fire season showing where
  there was no cloud-free look, over that day's NASA photo and its hotspots. Twelve fire seasons are built (August to
  October of 2014 to 2024 and 2026; 2025 has no fire mask yet), plus one wet-season quarter for contrast.
- **A zero inspector** for one district, Pulang Pisau: every 1 km cell on one day as fire, a zero with a cloud-free
  look, a zero without one, or no data.
- **A reporting rule** the map supports: do not report "no hotspots" for a district on a day when most of it had no
  cloud-free look. Over eleven fire seasons that was 1,482 of 13,510 district-days (11%); in the wet-season quarter,
  442 of 1,148 (39%).
- **Today in my district**: for any of the 514 districts, the hotspots NASA detected in the last 24 hours and 7 days
  (VIIRS on NOAA-20 and NOAA-21, and MODIS, from the FIRMS near-real-time files, read when the page opens), whether
  this month is above normal on the one-scale record, and a level (calm, watch or high) set by a rule shown on the
  page. It is our own rule, not an official status. The page writes three messages ready to send, for residents and
  the village, for the district disaster office (BPBD) and for the Manggala Agni fire crew, each with a WhatsApp
  button. If today's data cannot be read, no level is set: the page never calls a district calm without data.
- **What to do now, for the disaster office**: beside the map, the level and the actions it calls for (check the newest
  hotspot on the ground, re-check the peat sites where fire came back, tell the village, report "not observed" on a
  clouded day), each with the fact from the page that triggers it. They are suggestions from the page's own rules, not
  an official procedure.
- **A resident's report**: "Seen fire or smoke? Report it" writes a report (district, time, the phone's location if
  the resident adds it) and opens it in WhatsApp for the local post.
- **The alert loop, as a demo of the next step**: the office approves an alert, a phone in the village receives it,
  the resident confirms or reports fire, and the office sees the reply. Tonight it runs inside the page and sends
  nothing; the real way to send is the WhatsApp button.
- **Peat sites where fire comes back**, for Central Kalimantan: a peat cell of about 1 km is a persistent site when
  VIIRS detects fire there on three or more days of a season, or again after a gap of two days or more. Over eleven
  fire seasons that is 18,113 persistent sites and 31,476 come-backs. For each gap we read the MODIS fire mask: in
  25,259 the satellite had a cloud-free look and saw no fire, in 6,184 MODIS saw fire while VIIRS did not, 25 were
  under cloud throughout and 8 had no data. The Today page lists the top sites of the district with coordinates, as
  places to re-check on the ground. It does not say fire kept burning in the gap.
- **A printable one-page brief** per area, in Bahasa Indonesia or English.
- **A story** that walks through the jump, the fix and the zero in under a minute, and a day-by-day player of a whole
  fire season.

### How the one scale is made

We count fire cell-days: one 0.01-degree cell on one day with at least one detection (vegetation fires only, low
confidence removed). Counting cells instead of hotspots removes most of the difference between VIIRS's 375 m pixels and
MODIS's 1 km pixels. The scale is Aqua MODIS. Through 2021 the record is Aqua's own count. From 2022, when Aqua's orbit
drifts, it is VIIRS converted to the Aqua scale with factors by island region, season, day or night and peat,
calibrated on 2012 to 2021, with a 90% range from 1,000 bootstrap draws. District values share their province's monthly
conversion and are marked approximate.

### What we found

- Between 2003-2007 and 2017-2021, Indonesia's raw spliced record rises 95%; on one scale it falls 64%. The two
  readings point in opposite directions. The direction of the one-scale change does not depend on whether El Nino
  years are included (it is -62% without them), or on whether the comparison crosses the 2022 seam (-63%).
- October 2026, still provisional, stands at 4.1 times the median October for Indonesia.
- In October 2019, 17.4% of Central Kalimantan's no-fire readings had no cloud-free look, although the month as a whole
  counts as well observed. On the worst day we hold, 29 October 2015, the share was 79%.

### What we checked, and what failed

We wrote the validation tests before the run and show every result in the app. On years held out of the calibration,
the one-scale record misses by 7.2%; the raw splice misses by 435%. The 2012 switch test passes. The 2022 seam test fails, so values from 2022
are less certain than the range suggests. A simpler method does better than our chosen one on held-out years, and
several regions transfer poorly. 15 tests pass, 11 fail, 9 were not run. We would rather show this than hide it.

### What the zero layer is, and is not

It is the share of no-fire cell-days with no cloud-free look by MODIS (MOD14A1 and MYD14A1 fire masks). It is not a
count of hidden fires. Thick smoke is not flagged as cloud, so the true unseen share is higher. It looks back in time;
it is not an early warning.

### Who it is for

A BPBD district officer who opens "Today in my district" in the morning, sees what the satellites detected and how
far to trust a zero, and forwards a message to the village; a Manggala Agni crew that gets coordinates of the newest
hotspots and of peat sites to re-check; a planner placing patrols by month; researchers who need a fire history that
does not jump with the sensor. We have not yet tested it with an agency. That is the next step.

### Limits

Hotspots are heat detections, not burned area. Values from 2022 rest on a seam that fails its test. District values
are approximate. The zero layer and the peat sites cover one province, and the zero layer measures cloud only. The
peat index is exploratory: we wrote its rule after looking at the data. The level on the Today page is our own rule.
KalenderApi is not an official product and does not forecast.

### Tools

Python (pandas, DuckDB) for the pipeline; TypeScript, React, Vite, deck.gl, MapLibre and Observable Plot for the app;
Vercel for hosting, with two small serverless functions (one reads NASA's near-real-time hotspot files, one drafts
advice with an AI model). Code: https://github.com/13222093/kalendarapiv4

### Use of AI

We built KalenderApi with AI assistance and disclose it in full in `AI_USE.md` in the repository. Claude (Anthropic)
helped write the pipeline scripts, the web app, tests and documents, and helped review results; the team chose the
challenge, the question and the method, and checked every published number against the data files. On the "Today in
my district" page, one optional button asks an OpenAI model (gpt-6-luna) to draft advice from numbers the app has
already computed. The model is told to add no numbers of its own, the draft is labelled as written by AI, and it must
be checked before it is sent. The three standard messages on that page are fixed templates, not AI. **[FILL if used:
The narration in the demo video is an AI voice made with ElevenLabs from a script we wrote.]** No AI-generated images
or numbers appear in the app: the pictures are NASA imagery and every number is computed from NASA data by code that
can be rerun. No NASA logos appear in AI-made content.

## NASA data

- NASA FIRMS active fire data: MODIS Collection 6.1 (Terra, Aqua) and VIIRS 375 m (S-NPP, NOAA-20), Indonesia
- NASA FIRMS near-real-time files, last 24 hours and last 7 days, South-East Asia: VIIRS NOAA-20, VIIRS NOAA-21, MODIS
- MODIS Thermal Anomalies and Fire Daily (MOD14A1, MYD14A1) fire mask, Collection 6.1
- NASA GIBS true-colour imagery (MODIS Terra, VIIRS S-NPP, VIIRS NOAA-20)

## Space agency partner and other data

- geoBoundaries gbOpen, Indonesia district boundaries (ADM2; CC BY 3.0 IGO, as the geoBoundaries API states)
- Microsoft Planetary Computer (hosting of the MOD14A1 and MYD14A1 files)
- SiPongi (Indonesia's Ministry of Forestry): official burned area, for comparison only
- NOAA Climate Prediction Center, Oceanic Nino Index (to pick the El Nino years in the robustness check)
- Fire Harmony (github.com/Warren-530/fire-harmony, Apache-2.0): open-source app code we built on; see NOTICE
- Global Forest Watch, Indonesia peat lands map (original: Indonesian Ministry of Agriculture, BBSDLP)
- Claude (Anthropic): AI assistant for code, tests and documents; OpenAI API (gpt-6-luna): the optional advice draft
  **[add ElevenLabs if used]**
- Open-source libraries: React, Vite, deck.gl, MapLibre GL JS, Observable Plot, DuckDB

## References

The submission form asks for every outside resource (code, text, images), even open ones. Paste this list in the
References field; it repeats the two lists above so nothing is missed.

Data and imagery
- NASA FIRMS active fire data, MODIS Collection 6.1 and VIIRS 375 m: https://firms.modaps.eosdis.nasa.gov
- NASA FIRMS near-real-time active fire files (VIIRS NOAA-20, VIIRS NOAA-21, MODIS), South-East Asia
- NASA MODIS Thermal Anomalies and Fire Daily, MOD14A1 and MYD14A1, Collection 6.1 (NASA LP DAAC), read through
  Microsoft Planetary Computer: https://planetarycomputer.microsoft.com
- NASA GIBS / Worldview imagery (MODIS Terra and VIIRS true colour, Blue Marble): https://earthdata.nasa.gov/gibs
- geoBoundaries gbOpen, Indonesia ADM2 (CC BY 3.0 IGO): https://www.geoboundaries.org
- Global Forest Watch open data, Indonesia peat lands (original map: Ministry of Agriculture, BBSDLP); licence not
  verified by us
- SiPongi, Ministry of Forestry of Indonesia: official burned area, for comparison only
- NOAA Climate Prediction Center, Oceanic Nino Index

Code
- Fire Harmony (Apache-2.0), the open-source web app our app is built on: https://github.com/Warren-530/fire-harmony
- FireLens (MIT, Team Aquila), a few lines of the globe's setup: https://github.com/abubokkor-cse/firelens
- Open-source libraries: React, Vite, TypeScript, deck.gl, MapLibre GL JS, Observable Plot, h3-js, DuckDB, pandas
- Fonts: Fraunces, Public Sans, Geist Mono (SIL Open Font License)

Ideas, no code taken
- PeatForge (another team's project): the idea of a message for residents, the disaster office and the village

AI tools
- Claude (Anthropic), in Claude Code: code, tests, documents and review
- OpenAI API (gpt-6-luna): the optional advice draft inside the app
- ElevenLabs: the narration voice in the demo video and in the app's Story **[delete this line if no narration is used]**

## 30-second video: narration and shots (final, 15 November 20:35)

The video must be 30 seconds or less (Space Apps submission guide, as quoted in search results; a longer video is not
eligible for global judging). The picture is the Story at https://kalenderapi.vercel.app/#/story in English, rendered
frame by frame (1920 x 1080, 30 frames a second, 29.6 seconds): the Story plays for 28.6 seconds and then rests on
the home frame. The file is `docs/submission/video/story_silent_1080p.mp4` (not in the repository). The Story already
shows its own captions, so no subtitles are burned in.

The script runs to about 27 seconds at a normal reading pace, which is tight. Ask for a slightly faster voice (speed
1.1 in ElevenLabs). When the lines are placed, a line may start up to 0.7 seconds before its scene, and all lines are
sped up by a few percent if they still do not fit.

Narration, one line per scene, so each line can be placed at its scene's start:

| Scene | Starts at | Narration (English) |
|---|---|---|
| 1. The 2012 jump | 0.0 s | "In 2012, sharper VIIRS joined older MODIS, and Indonesia's fires seemed to nearly double." |
| 2. One scale | 4.8 s | "Harmonized onto one scale, the rise disappears." |
| 3. Central Kalimantan | 9.6 s | "Look closer: Central Kalimantan, 2019." |
| 4. August | 12.2 s | "August. Clear sky. VIIRS sees the fires." |
| 5. September | 16.0 s | "September. Smoke fills the sky." |
| 6. 15 October | 20.4 s | "October. Cloud moves in, and the striped land reports zero." |
| 7. Closing, then home | 24.4 s | "But zero under cloud does not mean no fire. It means the satellite could not see." |

64 words. Checked against the app: raw joined +95% ("nearly double"), one scale -64%, 15 October 2019 the day with the
largest share under cloud (62.3%). These seven lines are also the narration of the Story inside the app (the Sound
button), as `app/public/ka-data/story/narration_en.mp3`.

### The submitted cut: the story, then the app (22:15)

The Story alone does not show the app in use, so the demo video is a cut: about 15 seconds of the Story, then about
14 seconds of the app, each app clip with a caption on screen. File: `docs/submission/video/demo_cut_silent.mp4`
(1920 x 1080, 30 frames a second, 29.6 seconds), and with the voice `demo_cut.mp4`.

| In the video | From | Narration |
|---|---|---|
| 0.0 to 9.2 s | Story 0.0 to 9.2 s: the 2012 jump, then one scale | lines 1 and 2 above |
| 9.2 to 15.4 s | Story 20.2 to 26.4 s: 15 October under cloud, the closing caption | line 7 above |
| 15.4 to 19.0 s | The home calendar: as recorded, then on one scale | "KalenderApi puts MODIS and VIIRS on one fire calendar." |
| 19.0 to 22.4 s | Today in my district: counts and the map | "It shows today's hotspots in your district," |
| 22.4 to 25.8 s | The level and the three messages | "and writes the message for the village, the disaster office and the fire crew." |
| 25.8 to 28.0 s | The AI draft | (the line above runs on) |
| 28.0 to 29.6 s | The final frame with the address | (silence) |

For ElevenLabs: ten lines, each as its own file, `01.mp3` to `10.mp3` (lines 1 to 7 above, then the three app lines).
Voice and settings are in `nasa/docs/research-v3/E1-elevenlabs-recipe.md`; speed 1.1. Say in the video description,
and in the file's metadata, that the voice is AI-generated.
