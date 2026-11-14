# kalendarapiv1: KalenderApi

KalenderApi ("fire calendar" in Indonesian) for NASA Space Apps 2026, challenge *Harmonization of MODIS and VIIRS Hot Spots*.

**A zero is not always a zero.** A satellite fire record shows "no fire" both where the ground was seen clear and where
cloud hid it. KalenderApi separates the two for Central Kalimantan, August to October 2019, day by day and district by
district, from the NASA MODIS Terra and Aqua daily FireMask.

## What is in the app

- `#/story`: the opening scene. Real VIIRS 375 m hotspots, the smoky photo of 15 September 2019, and the blind zeros of
  the blindest day of the season, hatched.
- `#/season`: "Play the season", Central Kalimantan 1 Aug to 31 Oct 2019, one real day per frame: that day's NASA photo,
  its VIIRS hotspots, and its blind zeros by district.
- Explorer (`#/`): the 26-year harmonized record of Fire Harmony; for Central Kalimantan also "Blind zeros by district"
  and "Detected and reported" (official SiPongi burned area next to detected hotspots).

## Run

```bash
npm ci
cp .env.example .env.local
npm run dev
```

## Data

- Built into `public/ka-data/` by the scripts in `pipeline/`:
  `build_season.py` (NASA FIRMS VIIRS S-NPP 2019 Indonesia archive) and `build_visibility.py`
  (NASA MODIS MOD14A1 and MYD14A1 C6.1 FireMask from Microsoft Planetary Computer, geoBoundaries IDN ADM2).
  Each output file records its sources, download time and checksums. Raw downloads are not in this repository.
- Read at run time: the Fire Harmony dataset v1.0 (CC BY 4.0) and NASA GIBS imagery.

## Credits

This app is a modified version of [Fire Harmony](https://github.com/Warren-530/fire-harmony) (Apache License 2.0).
The license is in `LICENSE-fire-harmony-Apache-2.0.txt`, and every change is listed in `NOTICE.md`.
(`NOTICE.md` and code comments name the build scripts by their working-tree path `kalenderapi/scripts/`; in this
repository they are in `pipeline/`.)
