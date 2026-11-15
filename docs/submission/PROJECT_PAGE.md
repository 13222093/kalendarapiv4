# Space Apps project page: text to paste

Draft of 15 November 2026, 19:40. English, as the event rules require. Lines marked **[FILL]** wait for tonight's final
numbers and links; do not submit with a [FILL] left in.

## Project name

KalenderApi: zero hotspots is not always zero fire

## Summary (high-level)

KalenderApi is a web app for Indonesia's fire agencies. It puts 25 years of NASA MODIS and VIIRS hotspots on one scale,
so a district officer can see when their area usually burns and whether this month is unusual. Then it answers a
question other fire calendars leave as a footnote: when the record says zero, could the satellite see the ground at
all? For Central Kalimantan we map, for every district and every day of the fire season, where a zero means "no fire
seen" and where it means "no cloud-free look". On 29 October 2015, 79% of the province's no-fire readings had no
cloud-free look. We wrote our validation tests before running them and we publish the ones that failed. The app is in
English and Bahasa Indonesia, with a one-page printable brief for each area.

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

A BPBD district officer deciding how to report a quiet day; a Manggala Agni planner placing patrols by month; a peat
restoration team choosing where to rewet before the dry season; researchers who need a fire history that does not jump
with the sensor. We have not yet tested it with an agency. That is the next step.

### Limits

Hotspots are heat detections, not burned area. Values from 2022 rest on a seam that fails its test. District values
are approximate. The zero layer covers one province and measures cloud only. KalenderApi is not an official product
and does not forecast.

### Tools

Python (pandas, DuckDB) for the pipeline; TypeScript, React, Vite, deck.gl, MapLibre and Observable Plot for the app;
Vercel for hosting. Code: https://github.com/13222093/kalendarapiv4

### Use of AI

We built KalenderApi with AI assistance and disclose it in full in `AI_USE.md` in the repository. Claude (Anthropic)
helped write the pipeline scripts, the web app, tests and documents, and helped review results; the team chose the
challenge, the question and the method, and checked every published number against the data files. **[FILL if used:
The narration in the demo video is an AI voice made with ElevenLabs from a script we wrote.]** No AI-generated images
or numbers appear in the app: the pictures are NASA imagery and every number is computed from NASA data by code that
can be rerun. No NASA logos appear in AI-made content.

## NASA data

- NASA FIRMS active fire data: MODIS Collection 6.1 (Terra, Aqua) and VIIRS 375 m (S-NPP, NOAA-20), Indonesia
- MODIS Thermal Anomalies and Fire Daily (MOD14A1, MYD14A1) fire mask, Collection 6.1
- NASA GIBS true-colour imagery (MODIS Terra, VIIRS S-NPP)

## Space agency partner and other data

- geoBoundaries gbOpen, Indonesia district boundaries (ADM2; CC BY 3.0 IGO, as the geoBoundaries API states)
- Microsoft Planetary Computer (hosting of the MOD14A1 and MYD14A1 files)
- SiPongi (Indonesia's Ministry of Forestry): official burned area, for comparison only
- NOAA Climate Prediction Center, Oceanic Nino Index (to pick the El Nino years in the robustness check)
- Fire Harmony (github.com/Warren-530/fire-harmony, Apache-2.0): open-source app code we built on; see NOTICE
- Claude (Anthropic): AI assistant for code, tests and documents **[add ElevenLabs if used]**
- Open-source libraries: React, Vite, deck.gl, MapLibre GL JS, Observable Plot, DuckDB

## 30-second video: narration and shots (final, 15 November 20:35)

The video must be 30 seconds or less (Space Apps submission guide, as quoted in search results; a longer video is not
eligible for global judging). It is one screen recording of the Story at https://kalenderapi.vercel.app/#/story in
English, which plays for 28.6 seconds and then rests on the home frame. The Story already shows its own captions, so
no subtitles are burned in.

Narration, one line per scene, so each line can be placed at its scene's start:

| Scene | Starts at | Narration (English) |
|---|---|---|
| 1. The 2012 jump | 0.0 s | "In 2012 a sharper satellite arrived, and Indonesia's fires seemed to nearly double." |
| 2. One scale | 4.8 s | "Counted the same way, the rise disappears." |
| 3. Central Kalimantan | 9.6 s | "Look closer: Central Kalimantan, 2019." |
| 4. August | 12.2 s | "August. Clear sky. The satellite sees the fires." |
| 5. September | 16.0 s | "September. Smoke fills the sky." |
| 6. 15 October | 20.4 s | "October. Cloud moves in, and the striped land reports zero." |
| 7. Closing, then home | 24.4 s | "But zero under cloud does not mean no fire. It means the satellite could not see." |

64 words. Checked against the app: raw joined +95% ("nearly double"), one scale -64%, 15 October 2019 the day with the
largest share under cloud (62.3%).

For ElevenLabs: paste the seven lines with a blank line between them, so the pauses can be found and each line placed
at its scene. Voice and settings are in `nasa/docs/research-v3/E1-elevenlabs-recipe.md`. Say in the video description,
and in the file's metadata, that the voice is AI-generated.
