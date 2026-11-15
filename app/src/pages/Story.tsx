// KalenderApi (new file, not from Fire Harmony): the cinematic story "Under the Smoke" (#/story), and the app's home
// (its final frame, '#/story?hub=1').
// Real data only: NASA FIRMS VIIRS 375 m hotspots (the same file as "Play the season") as points in the day-by-day
// beats and counted per hexagon in the opening and the final frame (lib/storyHex.ts, a picture only: no number from
// that count is printed); the land with no cloud-free look on one day as hatching on a 0.01 degree grid (NASA MODIS
// Terra and Aqua daily FireMask, built by kalenderapi/scripts/build_visibility.py); the 14 district borders; and NASA
// GIBS Suomi NPP VIIRS true-colour photos of the days shown, one pre-sized image per scene
// (public/ka-data/story/story_photos.json). Nothing is interpolated or invented.
// Two beats come first, "the jump" and "one scale", with numbers computed from the harmonized bundle (public/ss-data/,
// lib/record.ts) for the windows of lib/windows.ts, and a chart of Indonesia's yearly record over the map. Without the
// bundle (not built yet, or a file that failed) the story starts at Central Kalimantan.
// Wording: the hatched layer is "no cloud-free look" and counts cloud only (the MODIS fire mask does not flag thick
// smoke); the story says so where the layer first appears. English and Bahasa Indonesia side by side (lib/lang.ts).
// '#/story?t=12' opens the story paused at second 12; '#/story?hub=1' opens on the final frame without playing.
// Smoothness: React state changes only at the cues of the timeline (never per frame); the camera, the fades and the
// rise of the hexagons are deck.gl transitions; the progress bar and August's date are written straight to the page.
import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Deck, LinearInterpolator, MapView, WebMercatorViewport, type Layer } from '@deck.gl/core';
import { H3HexagonLayer, TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer, PathLayer, ScatterplotLayer } from '@deck.gl/layers';
import { NATIONAL, SEAM_YEAR, beforeAfter, isViirs, loadIndex, loadMonthly, sensorRatio, type BeforeAfter, type MonthRow } from '../lib/record';
import { fmtNumber, monthName, useLang, useTr } from '../lib/lang';
import { storyHexes, type StoryHex } from '../lib/storyHex';
import { WINDOW_EARLY, WINDOW_RECENT } from '../lib/windows';
import { LangToggle } from '../components/LangToggle';

// The product panel of the final frame (search, quick regions, a stat card, a trend chart): its own component with its
// own CSS, loaded only when the final frame shows, and held in a boundary so a failure there never breaks the Story.
const HubPanel = lazy(() => import('../components/HubPanel').then((m) => ({ default: m.HubPanel })));
// The sections under the final frame (the 2001 to 2026 calendar, MODIS and VIIRS by year, the challenge table, the
// globe): pages/Home.tsx, loaded when the final frame shows. The final frame is the first screen; the page scrolls on.
const HomeSections = lazy(() => import('./Home').then((m) => ({ default: m.Home })));
class Quiet extends Component<{ children: ReactNode }, { broken: boolean }> {
  state = { broken: false };
  static getDerivedStateFromError() { return { broken: true }; }
  componentDidCatch() { /* the panel is an extra: the Story goes on without it */ }
  render() { return this.state.broken ? null : this.props.children; }
}

const BASE = import.meta.env.BASE_URL;
const SEASON_URL = `${BASE}ka-data/kalteng_2019_season.json`;
const VIS_URL = `${BASE}ka-data/visibility_kalteng_2019.json`;
const DISTRICTS_URL = `${BASE}ka-data/kalteng_districts.json`;
const PHOTOS_URL = `${BASE}ka-data/story/story_photos.json`;
const visImgUrl = (date: string) => `${BASE}ka-data/vis2019/${date}.png`;
const KALTENG_AOI = 'prov-kalimantan-tengah';

const CLEAR_DAY = '2019-08-12';
const SMOKY_DAY = '2019-09-15';
// Until the visibility file is in, the day with the highest share when the file was built; once it is in, the page
// takes the day with the highest share from the file itself.
const BLIND_FALLBACK = '2019-10-15';
const PITCH = 30, BEARING = -8;
const PHOTO_LAYER = 'VIIRS_SNPP_CorrectedReflectance_TrueColor';
const TINT: [number, number, number] = [205, 214, 212];

type Pt = [number, number, number, number];   // lon, lat, frp (MW), isNight
type Box = [number, number, number, number];
interface SeasonDay { date: string; n: number; pts: Pt[] }
interface SeasonFile { bbox: Box; source: { rows_kept: number }; days: SeasonDay[] }
interface VisDay { date: string; T: number; U: number }
interface VisFile { grid: { bbox: Box }; days: VisDay[] }
interface Data {
  bbox: Box; days: SeasonDay[];
  aug: SeasonDay[]; augFlat: Pt[]; augDay: Uint8Array;   // August's points, and the day (0 = 1 August) of each
  byDate: Map<string, SeasonDay>; kept: number;
}
/** Shares (%, one decimal) of the no-fire land with no cloud-free look: the season, September, October, the smoky day
 *  and the day with the highest share. */
interface Vis {
  gridBbox: Box; blindDay: string; rings: [number, number][][];
  season: number; sep: number; oct: number; smoky: number; top: number;
}
/** The jump and the one scale, for Indonesia as a whole: % change of the mean of WINDOW_RECENT over WINDOW_EARLY. */
interface Intro {
  ba: BeforeAfter; ratio: number; from: number; to: number;
  naive: number; harm: number;
  aquaTo: number | null; viirsFrom: number | null;   // the one-scale line: Aqua's own count to, VIIRS converted from
}
/** One pre-sized NASA photo of a scene day (wide view or near view), decoded before the story starts. */
interface Photo { date: string; view: string; bbox: Box; image: ImageBitmap | string }
type Photos = Map<string, Photo[]>;
interface View { longitude: number; latitude: number; zoom: number; pitch: number; bearing: number }
interface Seg { t0: number; t1: number; from: View; to: View; ease: (u: number) => number }

const ADDITIVE = {
  blend: true, blendColorOperation: 'add', blendColorSrcFactor: 'src-alpha', blendColorDstFactor: 'one',
  blendAlphaOperation: 'add', blendAlphaSrcFactor: 'one', blendAlphaDstFactor: 'one-minus-src-alpha',
  depthCompare: 'always', depthWriteEnabled: false,
} as const;
const FLAT = { depthCompare: 'always', depthWriteEnabled: false } as const;

// How long each fade takes (ms): deck.gl moves the value itself, frame by frame, with no work on the page.
const NONE: Record<string, number> = {};
const T_PHOTO = { opacity: 1200 };
const T_DOTS = { opacity: 700 };
const T_LINES = { opacity: 1000 };
const T_HEX = { opacity: 900, elevationScale: 1600 };
const CAMERA = new LinearInterpolator(['longitude', 'latitude', 'zoom', 'pitch', 'bearing']);
const LINEAR = (u: number) => u;
const SMOOTH = (u: number) => u * u * (3 - 2 * u);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const ptPos = (p: Pt) => [p[0], p[1]] as [number, number];
const ptRadius = (p: Pt) => Math.min(7, 1.8 + Math.sqrt(Math.max(0, p[2])) * 0.38);
/** Hotter (higher fire radiative power) is paler, as on the Season page. */
function ember(p: Pt): [number, number, number, number] {
  const t = Math.max(0, Math.min(1, Math.log10(Math.max(0, p[2]) + 1) / 2.4));
  return [Math.round(236 + 19 * t), Math.round(92 + 132 * t), Math.round(32 + 118 * t), 210];
}
const GHOST: [number, number, number, number] = [190, 70, 30, 96];
const ringPath = (x: [number, number][]) => x;
const hexId = (x: StoryHex) => x.h3;
const hexElev = (x: StoryHex) => x.elev;
const hexColor = (x: StoryHex) => x.color;

/** Only if a scene's pre-sized image is missing: that day's NASA GIBS tiles, kept few (no finer than level 7). */
function tilePhoto(date: string, opacity: number, visible: boolean, transitions: Record<string, number>) {
  return new TileLayer({
    id: `photo-${date}-tiles`, opacity, visible, transitions,
    data: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${PHOTO_LAYER}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    minZoom: 0, maxZoom: 7, tileSize: 256, refinementStrategy: 'no-overlap',
    renderSubLayers: (props) => {
      const { boundingBox } = props.tile as unknown as { boundingBox: [[number, number], [number, number]] };
      return new BitmapLayer(props, {
        data: undefined, image: props.data as never, tintColor: TINT, parameters: FLAT,
        bounds: [boundingBox[0][0], boundingBox[0][1], boundingBox[1][0], boundingBox[1][1]],
      });
    },
  });
}

/** The photo of one day: its wide image under its near image (two rectangles), or tiles if neither is there. */
function photoLayers(date: string, opacity: number, visible: boolean, photos: Photos | null, transitions: Record<string, number>): Layer[] {
  const list = photos?.get(date);
  if (!list?.length) return [tilePhoto(date, opacity, visible, transitions)];
  return list.map((p) => new BitmapLayer({
    id: `photo-${date}-${p.view}`, image: p.image as never, bounds: p.bbox, opacity, visible, tintColor: TINT,
    parameters: FLAT, transitions,
  }));
}

/** The list of pre-sized photos, each decoded once so a scene change uploads a ready image. Null if the list is not there. */
async function loadPhotos(): Promise<Photos | null> {
  try {
    const r = await fetch(PHOTOS_URL);
    if (!r.ok) return null;
    const file = await r.json() as { photos: { file: string; date: string; view: string; bbox: Box }[] };
    const out: Photos = new Map();
    await Promise.all(file.photos.map(async (p) => {
      const url = `${BASE}ka-data/story/${p.file}`;
      let image: ImageBitmap | string = url;
      try {
        const res = await fetch(url);
        if (res.ok) image = await createImageBitmap(await res.blob());
      } catch { /* the layer loads it by its address instead */ }
      out.set(p.date, [...(out.get(p.date) ?? []), { date: p.date, view: p.view, bbox: p.bbox, image }]);
    }));
    for (const list of out.values()) list.sort((a, b) => (a.view === 'wide' ? 0 : 1) - (b.view === 'wide' ? 0 : 1));
    return out;
  } catch {
    return null;
  }
}

/** A share in %, one decimal, rounded as the Season page rounds it. */
const share = (part: number, whole: number) => Math.round((1000 * part) / whole) / 10;

// When each beat starts (s), and how long August takes to play, one real day per step. With the bundle in, the two
// intro beats come first and every later beat starts INTRO seconds later. The whole story: 28.6 s (19 s without the
// bundle), under the 30 s of the demo video.
const T_AUG = 2.6, AUG_DUR = 3.4, T_SMOKE = 6.4, T_BLIND = 10.8, T_END_BEAT = 14.8;
const END = 19;
const T_FIX = 4.8, INTRO = 9.6;
// Inside the beats: a photo is put in place PRE seconds before its beat, starts to fade in LEAD seconds before it, and
// the photo under it is taken away HOLD seconds into the beat (so two photos are drawn only during a crossfade).
const PRE = 0.8, LEAD = 0.3, HOLD = 1.0;
const T_HEX_UP = 0.12, T_HEX_DOWN = T_AUG - 0.5, T_HEX_BACK = T_END_BEAT + 0.3, T_FLY = 0.3, HOME_FLY = 2.6;

/** Every second at which the picture or the words change. React state changes at these and at nothing else. */
function cueTimes(off: number): number[] {
  const rel = [0, T_FLY, T_HEX_DOWN, T_AUG, T_SMOKE - PRE, T_SMOKE - LEAD, T_SMOKE, T_SMOKE + HOLD,
    T_BLIND - PRE, T_BLIND - LEAD, T_BLIND, T_BLIND + HOLD, T_END_BEAT - PRE, T_END_BEAT - LEAD, T_END_BEAT,
    T_HEX_BACK, T_END_BEAT + HOLD, END].map((x) => x + off);
  const abs = off > 0 ? [0, T_HEX_UP, T_FIX, INTRO - 0.7] : [0, T_HEX_UP];
  return [...new Set([...abs, ...rel].map((x) => Math.round(x * 1000) / 1000))].sort((a, b) => a - b);
}
function cueIndex(cues: number[], t: number): number {
  let k = 0;
  for (let i = 0; i < cues.length; i++) if (t >= cues[i]!) k = i;
  return k;
}

interface Scene {
  top: string; under: string | null; topOn: boolean;        // the photo, and the one under it during a crossfade
  hexElev: number; hexOp: number; hexVisible: boolean;
  aug: number; augVisible: boolean; smoky: number; smokyVisible: boolean; blind: number; blindVisible: boolean;
  borders: number;
}
/** What is drawn at second t (a step function: it changes only at the cue times). */
function sceneAt(t: number, off: number, blindDay: string): Scene {
  const tl = t - off;
  const photo = tl < T_SMOKE - PRE ? { top: CLEAR_DAY, under: null, topOn: true }
    : tl < T_SMOKE - LEAD ? { top: SMOKY_DAY, under: CLEAR_DAY, topOn: false }
    : tl < T_SMOKE + HOLD ? { top: SMOKY_DAY, under: CLEAR_DAY, topOn: true }
    : tl < T_BLIND - PRE ? { top: SMOKY_DAY, under: null, topOn: true }
    : tl < T_BLIND - LEAD ? { top: blindDay, under: SMOKY_DAY, topOn: false }
    : tl < T_BLIND + HOLD ? { top: blindDay, under: SMOKY_DAY, topOn: true }
    : tl < T_END_BEAT - PRE ? { top: blindDay, under: null, topOn: true }
    : tl < T_END_BEAT - LEAD ? { top: CLEAR_DAY, under: blindDay, topOn: false }
    : tl < T_END_BEAT + HOLD ? { top: CLEAR_DAY, under: blindDay, topOn: true }
    : { top: CLEAR_DAY, under: null, topOn: true };
  // the hexagons: tall in the opening and the final frame, flat and faint under August's and September's dots, gone
  // on the cloud day (so the hatching reads on its own)
  const [hexElev, hexOp] = t < T_HEX_UP ? [0, 0] : tl < T_HEX_DOWN ? [1, 0.82] : tl < T_SMOKE - LEAD ? [0.03, 0.16]
    : tl < T_BLIND - LEAD ? [0.03, 0.09] : tl < T_HEX_BACK ? [0.03, 0] : [1, 0.82];
  return {
    ...photo, hexElev: hexElev!, hexOp: hexOp!,
    hexVisible: !(tl >= T_BLIND + HOLD && tl < T_END_BEAT - PRE),
    aug: tl >= T_AUG && tl < T_SMOKE - LEAD ? 1 : 0, augVisible: tl >= T_HEX_DOWN && tl < T_SMOKE + HOLD,
    smoky: tl >= T_SMOKE - LEAD && tl < T_BLIND - LEAD ? 1 : 0, smokyVisible: tl >= T_SMOKE - PRE && tl < T_BLIND + HOLD,
    blind: tl >= T_BLIND - LEAD && tl < T_END_BEAT - LEAD ? 1 : 0, blindVisible: tl >= T_BLIND - PRE && tl < T_END_BEAT + HOLD,
    borders: tl >= T_HEX_DOWN && tl < T_END_BEAT - LEAD ? 1 : 0,
  };
}
/** August, one real day per step: which day (0 = 1 August) is "today" at second tl of the Central Kalimantan beats. */
const augDayAt = (tl: number, days: number) => Math.max(0, Math.min(days - 1, Math.floor(((tl - T_AUG) / AUG_DUR) * days)));

interface Beat { t: number; title: string; body: string }

function prepare(file: SeasonFile): Data {
  const aug = file.days.filter((d) => d.date.startsWith('2019-08'));
  const augFlat: Pt[] = []; const dayOf: number[] = [];
  aug.forEach((d, i) => { for (const p of d.pts) { augFlat.push(p); dayOf.push(i); } });
  return {
    bbox: file.bbox, days: file.days, aug, augFlat, augDay: Uint8Array.from(dayOf),
    byDate: new Map(file.days.map((d) => [d.date, d])), kept: file.source.rows_kept,
  };
}

function visNumbers(file: VisFile): Omit<Vis, 'rings'> | null {
  const days = file.days;
  const sum = (keep: (d: string) => boolean) => days.filter((d) => keep(d.date)).reduce((s, d) => [s[0]! + d.T, s[1]! + d.U], [0, 0]);
  const of = ([t, u]: number[]) => share(u!, t! + u!);
  const smoky = sum((d) => d === SMOKY_DAY);
  let best: VisDay | null = null;
  for (const d of days) if (d.T + d.U > 0 && (!best || d.U / (d.T + d.U) > best.U / (best.T + best.U))) best = d;
  if (!best || smoky[0]! + smoky[1]! === 0) return null;
  return {
    gridBbox: file.grid.bbox, blindDay: best.date,
    season: of(sum(() => true)), sep: of(sum((d) => d.startsWith('2019-09'))), oct: of(sum((d) => d.startsWith('2019-10'))),
    smoky: of(smoky), top: share(best.U, best.T + best.U),
  };
}

/** % change of the mean of the recent window over the early one, from the yearly totals; null unless every year of
 *  both windows is in the record. */
function windowChange(ba: BeforeAfter, key: 'rawNaive' | 'rawH'): number | null {
  const mean = ([a, b]: readonly [number, number]) => {
    const xs = ba.points.filter((p) => p.year >= a && p.year <= b).map((p) => p[key]);
    return xs.length === b - a + 1 ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN;
  };
  const c = (mean(WINDOW_RECENT) / mean(WINDOW_EARLY) - 1) * 100;
  return Number.isFinite(c) ? c : null;
}

/** The intro's numbers from Indonesia's monthly record, or null when the record cannot say them. */
function introNumbers(rows: MonthRow[], window_: [number, number]): Intro | null {
  const ba = beforeAfter(rows);
  const r = sensorRatio(rows, window_);
  if (!ba || !r) return null;
  const naive = windowChange(ba, 'rawNaive'), harm = windowChange(ba, 'rawH');
  if (naive == null || harm == null) return null;
  const viirsYears = rows.filter((x) => isViirs(x.sensor_used)).map((x) => x.year);
  const aquaYears = rows.filter((x) => x.sensor_used === 'Aqua').map((x) => x.year);
  const viirsFrom = viirsYears.length ? Math.min(...viirsYears) : null;
  const aquaTo = aquaYears.length ? Math.max(...aquaYears) : null;
  // the label holds only when the two do not overlap (Aqua's own count up to a year, VIIRS converted after it)
  const clean = viirsFrom != null && aquaTo != null && aquaTo < viirsFrom;
  return { ba, ratio: r.ratio, from: r.from, to: r.to, naive, harm, aquaTo: clean ? aquaTo : null, viirsFrom: clean ? viirsFrom : null };
}

/** The final frame's slow turn: degrees to each side, and the seconds one full to-and-fro takes. */
const HUB_SWAY = 6, HUB_SWAY_SECONDS = 40;
/** The camera's path: a slow push over the wide shot (the hexagon field left of the chart), into Central Kalimantan
 *  for the day-by-day beats with a slow turn, then out to the tilted final frame. Each leg is one deck.gl transition. */
function cameraPath(bbox: Box, off: number): Seg[] {
  const w = window.innerWidth, h = window.innerHeight;
  const wide = w >= 900;
  const fit = (padding: { left: number; right: number; top: number; bottom: number }, dz: number, pitch: number, bearing: number): View => {
    try {
      const v = new WebMercatorViewport({ width: w, height: h }).fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding });
      return { longitude: v.longitude, latitude: v.latitude, zoom: v.zoom + dz, pitch, bearing };
    } catch {
      return { longitude: 113.3, latitude: -1.35, zoom: 6 + dz, pitch, bearing };
    }
  };
  // the room the caption leaves: right of it on wide screens, above it on narrow ones
  const near = fit(wide ? { left: Math.min(600, w * 0.42), right: 40, top: 90, bottom: 70 }
    : { left: 16, right: 16, top: 80, bottom: Math.round(h * 0.45) }, -0.1, PITCH, BEARING);
  const openB = fit(wide ? { left: 40, right: Math.round(w * 0.5), top: 110, bottom: Math.round(h * 0.46) }
    : { left: 16, right: 16, top: Math.round(h * 0.3), bottom: Math.round(h * 0.4) }, wide ? -0.9 : -0.5, 36, -4);
  const openA = off > 0 ? { ...openB, zoom: openB.zoom - 0.4, pitch: 0, bearing: 0 } : openB;
  const turned = { ...near, bearing: BEARING + (T_END_BEAT - T_AUG) * 0.9 };
  const home = fit(wide ? { left: Math.min(560, w * 0.4), right: w >= 1200 ? 220 : 40, top: 110, bottom: 60 }
    : { left: 16, right: 16, top: 64, bottom: Math.round(h * 0.58) }, -0.25, 52, -14);
  return [
    { t0: 0, t1: off + T_FLY, from: openA, to: openB, ease: LINEAR },
    { t0: off + T_FLY, t1: off + T_AUG, from: openB, to: near, ease: SMOOTH },
    { t0: off + T_AUG, t1: off + T_END_BEAT, from: near, to: turned, ease: LINEAR },
    { t0: off + T_END_BEAT, t1: off + T_END_BEAT + HOME_FLY, from: turned, to: home, ease: SMOOTH },
  ];
}
function mixView(a: View, b: View, u: number): View {
  const m = (x: number, y: number) => x + (y - x) * u;
  return { longitude: m(a.longitude, b.longitude), latitude: m(a.latitude, b.latitude), zoom: m(a.zoom, b.zoom), pitch: m(a.pitch, b.pitch), bearing: m(a.bearing, b.bearing) };
}

const hashParams = () => new URLSearchParams(window.location.hash.split('?')[1] ?? '');
/** '#/story?t=12': the second to open on, paused; null when the address names none. */
function startSecond(): number | null {
  const v = hashParams().get('t');
  const n = v == null || v === '' ? NaN : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
/** '#/story?hub=1': open on the final frame (the app's home) without playing. */
const isHub = () => hashParams().get('hub') === '1' || /^#\/home(\?|$)/.test(window.location.hash); // '#/home' is the same frame

export function Story() {
  const tr = useTr();
  const lang = useLang();
  const box = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const stampEl = useRef<HTMLSpanElement>(null);
  const deck = useRef<Deck<MapView> | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [vis, setVis] = useState<Vis | null>(null);
  // the jump and the one scale: undefined while the bundle is asked for, null when it is not there (the story then
  // starts at Central Kalimantan)
  const [intro, setIntro] = useState<Intro | null | undefined>(undefined);
  // the pre-sized photos: undefined while they load, null when the list is not there (tiles are drawn instead)
  const [photos, setPhotos] = useState<Photos | null | undefined>(undefined);
  const startAt = useMemo(startSecond, []);
  const reduced = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, []);
  // straight to the final frame: asked for by the address, or reduced motion
  const toEnd = useMemo(() => startAt == null && (isHub() || reduced), [startAt, reduced]);
  // the clock lives in a ref and is read by the animation frame; `mark` is the last cue passed (or the second jumped
  // to) and the only thing about time that React sees
  const now = useRef(toEnd ? Infinity : startAt ?? 0);
  const [mark, setMark] = useState({ t: now.current, seek: 0 });
  const [playing, setPlaying] = useState(startAt == null && !toEnd);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [size, setSize] = useState(0);
  // true once the first picture has been drawn: the clock waits for it, so the cost of the first draw is not in the story
  const [warm, setWarm] = useState(false);

  // the VIIRS hotspots of Central Kalimantan, Aug to Oct 2019
  useEffect(() => {
    let live = true;
    fetch(SEASON_URL)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<SeasonFile>; })
      .then((f) => { if (live) setData(prepare(f)); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);

  // where Terra and Aqua had no cloud-free look, and the district borders; without them the beats keep their plain text
  useEffect(() => {
    let live = true;
    const get = <T,>(u: string) => fetch(u).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<T>; });
    Promise.all([get<VisFile>(VIS_URL), get<{ districts: { rings: [number, number][][] }[] }>(DISTRICTS_URL)])
      .then(([file, dist]) => {
        const n = visNumbers(file);
        if (live && n) setVis({ ...n, rings: dist.districts.flatMap((x) => x.rings) });
      })
      .catch(() => { /* the beats fall back to their plain text */ });
    return () => { live = false; };
  }, []);

  // Indonesia's record from the harmonized bundle (the jump and the one scale)
  useEffect(() => {
    let live = true;
    loadIndex()
      .then(async (idx) => {
        const nat = idx.aois.find((a) => a.aoi_id === NATIONAL) ?? idx.aois.find((a) => a.level === 'national');
        if (!nat) return null;
        return introNumbers(await loadMonthly(nat), idx.calibration_window ?? [2012, 2021]);
      })
      .then((x) => { if (live) setIntro(x); })
      .catch(() => { if (live) setIntro(null); });   // not built yet, or failed: the story starts at Central Kalimantan
    return () => { live = false; };
  }, []);

  // the NASA photos of the scene days, one image each (no tiles at run time)
  useEffect(() => {
    let live = true;
    loadPhotos().then((p) => { if (live) setPhotos(p); });
    return () => { live = false; };
  }, []);

  const blindDay = vis?.blindDay ?? BLIND_FALLBACK;
  const off = intro ? INTRO : 0;          // every beat after the intro starts this much later
  const end = END + off;
  const ready = !!data && intro !== undefined && photos !== undefined;
  const cues = useMemo(() => cueTimes(off), [off]);
  // hotspots per hexagon, counted once from the days already loaded
  const hexes = useMemo(() => (data ? storyHexes(data.days) : []), [data]);
  const segs = useMemo(() => (data ? cameraPath(data.bbox, off) : null), [data, off, size]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Go to a second of the story, playing or not (replay, skip, the final frame). */
  const jumpTo = (time: number, play: boolean) => {
    now.current = time;
    setMark((m) => ({ t: time, seek: m.seek + 1 }));
    setPlaying(play);
  };
  const endRef = useRef(end);
  endRef.current = end;

  // straight to the final frame once the data is in (the address asked for it, or reduced motion)
  useEffect(() => {
    if (ready && toEnd) jumpTo(end, false);
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // a hidden tab pauses the story; a new window size or the address '?hub=1' re-places the picture
  useEffect(() => {
    const again = () => setMark((m) => ({ t: now.current, seek: m.seek + 1 }));
    const onVis = () => { setHidden(document.hidden); if (!document.hidden) again(); };
    const onSize = () => { setSize((s) => s + 1); again(); };
    const onHash = () => { if (isHub()) jumpTo(endRef.current, false); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('resize', onSize);
    window.addEventListener('hashchange', onHash);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', onSize);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  // deck.gl, created once: one device pixel per CSS pixel at most, and a controller that takes no input (it is there
  // only to run the camera's transitions)
  useEffect(() => {
    if (!box.current) return;
    const d = new Deck<MapView>({
      parent: box.current, views: new MapView({ repeat: false }),
      controller: { dragPan: false, dragRotate: false, scrollZoom: false, touchZoom: false, touchRotate: false, doubleClickZoom: false, keyboard: false },
      initialViewState: { longitude: 113.3, latitude: -1.35, zoom: 4.6, pitch: 0, bearing: 0 }, layers: [],
      useDevicePixels: 1,
      style: { position: 'absolute', inset: '0' },
    });
    deck.current = d;
    return () => { d.finalize(); deck.current = null; };
  }, []);

  // ---------------------------------------------------------------------------------------------- words
  const num = (n: number, digits = 0) => fmtNumber(n, lang, digits);
  const pct = (x: number) => `${num(x, 1)}%`;
  const mon = (m: number) => monthName(m, lang, 'long');
  const dayMonth = (date: string) => { const [, m, d] = date.split('-').map(Number) as [number, number, number]; return `${d} ${mon(m)}`; };
  const longDate = (date: string) => `${dayMonth(date)} ${date.slice(0, 4)}`;
  const to = tr('to', 'sampai');
  /** The stamp's first line while August plays: written by the clock as each day passes, and by React at the cues. */
  const augLabel = (day: number) => `${tr('Hotspots', 'Titik panas')} 1 ${mon(8)} ${to} ${longDate(data?.aug[day]?.date ?? CLEAR_DAY)}`;
  const augLabelRef = useRef(augLabel);
  augLabelRef.current = augLabel;

  // ---------------------------------------------------------------------------------------------- the picture
  const draw = useRef<(() => void) | null>(null);
  const layerSeek = useRef(-1);
  const warmAsked = useRef(false);
  useEffect(() => {
    const d = deck.current;
    if (!d || !data || !ready) return;
    const jumped = layerSeek.current !== mark.seek;
    layerSeek.current = mark.seek;
    const sc = sceneAt(Math.min(mark.t, end), off, blindDay);
    const smokyPts = data.byDate.get(SMOKY_DAY)?.pts ?? [];
    const blindPts = data.byDate.get(blindDay)?.pts ?? [];
    // snap: a jump (or a paused story) places everything at once; otherwise each change fades
    const build = (snap: boolean) => {
      const fade = (x: Record<string, number>) => (snap ? NONE : x);
      const day = augDayAt(Math.min(now.current, end) - off, data.aug.length);
      const layers: Layer[] = [];
      // the three scene days keep their images on the graphics card from the start (no upload in mid-story); only
      // the photo in view is drawn, and the one under it during a crossfade
      for (const date of new Set([CLEAR_DAY, SMOKY_DAY, blindDay])) {
        if (date !== sc.top && date !== sc.under) layers.push(...photoLayers(date, 0, false, photos ?? null, NONE));
      }
      if (sc.under) layers.push(...photoLayers(sc.under, 1, true, photos ?? null, NONE));
      layers.push(...photoLayers(sc.top, sc.topOn ? 1 : 0, true, photos ?? null, fade(T_PHOTO)));
      if (vis) {
        layers.push(new BitmapLayer({
          id: 'blind', image: visImgUrl(vis.blindDay), bounds: vis.gridBbox, opacity: sc.blind, parameters: FLAT,
          textureParameters: { minFilter: 'linear', magFilter: 'nearest' }, transitions: fade(T_PHOTO),
        }));
        layers.push(new PathLayer<[number, number][]>({
          id: 'districts', data: vis.rings, getPath: ringPath, getColor: [214, 228, 224, 90], getWidth: 1,
          widthUnits: 'pixels', opacity: sc.borders, parameters: FLAT, transitions: fade(T_LINES),
        }));
      }
      // hotspots per hexagon, Aug to Oct 2019: no outline, one soft light, height moved by a single number
      layers.push(new H3HexagonLayer<StoryHex>({
        id: 'hex', data: hexes, getHexagon: hexId, getElevation: hexElev, getFillColor: hexColor,
        extruded: true, wireframe: false, stroked: false, pickable: false, highPrecision: false, coverage: 0.86,
        elevationScale: sc.hexElev, opacity: sc.hexOp, visible: sc.hexVisible,
        material: { ambient: 0.68, diffuse: 0.5, shininess: 1, specularColor: [0, 0, 0] },
        transitions: fade(T_HEX),
      }));
      const dots = (id: string, pts: Pt[], opacity: number, visible: boolean) => new ScatterplotLayer<Pt>({
        id, data: pts, getPosition: ptPos, getRadius: ptRadius, getFillColor: ember,
        radiusUnits: 'pixels', opacity, visible, filled: true, stroked: false, antialiasing: true,
        parameters: ADDITIVE, transitions: fade(T_DOTS),
      });
      layers.push(
        // August in one layer: the days before today small and dim, today at full size, later days not drawn
        new ScatterplotLayer<Pt>({
          id: 'aug', data: data.augFlat, getPosition: ptPos,
          getRadius: (p, { index }) => { const k = data.augDay[index]!; return k > day ? 0 : k === day ? ptRadius(p) : ptRadius(p) * 0.6; },
          getFillColor: (p, { index }) => (data.augDay[index] === day ? ember(p) : GHOST),
          updateTriggers: { getRadius: day, getFillColor: day },
          radiusUnits: 'pixels', opacity: sc.aug, visible: sc.augVisible, filled: true, stroked: false, antialiasing: true,
          parameters: ADDITIVE, transitions: fade(T_DOTS),
        }),
        dots('smoky-day', smokyPts, sc.smoky, sc.smokyVisible),
        dots('blind-day', blindPts, sc.blind, sc.blindVisible),
      );
      d.setProps({ layers });
    };
    draw.current = () => build(false);
    build(jumped || !playing);
    if (!warmAsked.current) {
      warmAsked.current = true;
      const go = () => setWarm(true);
      requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(go)));
      window.setTimeout(go, 1500);
    }
    if (bar.current) bar.current.style.transform = `scaleX(${clamp01(Math.min(now.current, end) / end)})`;
  }, [mark, data, vis, photos, hexes, blindDay, ready, off, end, playing]);

  // the camera: one transition per leg of its path, started when the clock enters the leg; a jump places it at once
  const camSeek = useRef(-1), camSeg = useRef(-1), camTimer = useRef(0), camWarm = useRef(false);
  useEffect(() => {
    const d = deck.current;
    if (!d || !segs || !ready) return;
    const time = Math.min(now.current, end);
    let i = 0;
    segs.forEach((s, k) => { if (time >= s.t0) i = k; });
    const seg = segs[i]!;
    const go = (from: number) => d.setProps({
      initialViewState: {
        ...seg.to, transitionDuration: Math.max(0, (seg.t1 - from) * 1000), transitionInterpolator: CAMERA,
        transitionEasing: from > seg.t0 + 0.05 ? LINEAR : seg.ease,
      },
    });
    if (camSeek.current !== mark.seek || camWarm.current !== warm) {
      camSeek.current = mark.seek; camSeg.current = i; camWarm.current = warm;
      window.clearTimeout(camTimer.current);
      const u = clamp01((time - seg.t0) / (seg.t1 - seg.t0));
      d.setProps({ initialViewState: mixView(seg.from, seg.to, seg.ease(u)) });
      if (playing && warm && !hidden && u < 1) camTimer.current = window.setTimeout(() => go(Math.min(now.current, seg.t1)), 80);
    } else if (playing && i !== camSeg.current) {
      camSeg.current = i;
      go(time);
    }
  }, [mark, segs, ready, playing, hidden, end, warm]);
  useEffect(() => () => window.clearTimeout(camTimer.current), []);

  // The final frame is not a still: once the story has ended the camera turns a few degrees to and fro, slowly, around
  // where the story left it. It rests while the tab is hidden, while the page is scrolled past the first screen (the
  // home sections are below), and for a visitor who asked for reduced motion.
  const atEnd = mark.t >= end;
  useEffect(() => {
    const d = deck.current;
    const home = segs?.[segs.length - 1]?.to;
    if (!d || !home || !ready || !atEnd || playing || hidden || reduced) return;
    let raf = 0;
    const t0 = performance.now();
    const turn = (stamp: number) => {
      raf = requestAnimationFrame(turn);
      if (window.scrollY > window.innerHeight * 0.85) return; // the map is out of sight
      const s = (stamp - t0) / 1000;
      const sway = HUB_SWAY * Math.min(1, s / 3) * Math.sin((2 * Math.PI * s) / HUB_SWAY_SECONDS); // starts from rest
      d.setProps({ initialViewState: { ...home, bearing: home.bearing + sway } });
    };
    raf = requestAnimationFrame(turn);
    return () => cancelAnimationFrame(raf);
  }, [segs, ready, atEnd, playing, hidden, reduced]);

  // the clock (it starts once the data is in, so the beats never shift; a hidden tab stops it). Each frame it moves
  // the progress bar; it tells React only when a cue is passed, and redraws August's dots only when the day changes.
  useEffect(() => {
    if (!playing || !ready || !warm || hidden) return;
    let raf = 0;
    const start = performance.now() - now.current * 1000;
    let k = cueIndex(cues, now.current);
    let day = -1;
    const tick = (stamp: number) => {
      const s = Math.min((stamp - start) / 1000, end);
      now.current = s;
      if (bar.current) bar.current.style.transform = `scaleX(${s / end})`;
      const k2 = cueIndex(cues, s);
      if (k2 !== k) { k = k2; const at = cues[k2]!; setMark((m) => ({ t: at, seek: m.seek })); }
      const tl = s - off;
      if (data && tl >= T_AUG && tl < T_SMOKE) {
        const d2 = augDayAt(tl, data.aug.length);
        if (d2 !== day) {
          day = d2;
          draw.current?.();
          const text = stampEl.current?.firstChild;
          if (text) text.nodeValue = augLabelRef.current(d2);
        }
      }
      if (s < end) raf = requestAnimationFrame(tick); else setPlaying(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, ready, warm, hidden, cues, end, off, data]);

  // ---------------------------------------------------------------------------------------------- the beats
  const [e0, e1] = WINDOW_EARLY, [r0, r1] = WINDOW_RECENT;
  /** What the one-scale line is, from the record's own sensor column. */
  const oneScale = intro?.aquaTo != null && intro.viirsFrom != null
    ? tr(`Aqua MODIS's own count to ${intro.aquaTo}, VIIRS converted from ${intro.viirsFrom}`,
      `hitungan Aqua MODIS sendiri sampai ${intro.aquaTo}, VIIRS dikonversi mulai ${intro.viirsFrom}`)
    : tr('both satellites on the Aqua MODIS scale', 'kedua satelit pada skala Aqua MODIS');

  const introBeats: Beat[] = [];
  if (intro) {
    const verb = (x: number) => (x >= 0 ? tr('rises', 'naik') : tr('falls', 'turun'));
    const sizeOf = (x: number) => `${num(Math.abs(x))}%`;
    const n = intro.naive, h = intro.harm;
    // Plain words for a first-time reader: what changed in 2012, and what it does to the count. Each caption has about
    // four seconds on screen, so it stays short; the exact definition of each line is in the chart caption and footer.
    const seems = n >= 0 ? tr('rise', 'naik') : tr('fall', 'turun');
    const k = num(intro.ratio, 1);
    introBeats.push(
      {
        t: 0,
        title: tr('2012: sharper VIIRS joins older MODIS, and the fire count jumps.', '2012: VIIRS yang lebih tajam menyusul MODIS, dan jumlah api melonjak.'),
        body: tr(
          `MODIS has counted Indonesia's fires since 2000. VIIRS, a newer sensor, sees smaller fires, so it counts about ${k} times as many. Joined end to end, the two records make fires seem to ${seems} ${sizeOf(n)} (${r0}-${r1} against ${e0}-${e1}).`,
          `MODIS menghitung kebakaran Indonesia sejak 2000. VIIRS, sensor yang lebih baru, bisa melihat api yang lebih kecil, sehingga hitungannya sekitar ${k} kali lebih banyak. Jika dua rekaman itu disambung begitu saja, kebakaran tampak ${seems} ${sizeOf(n)} (${r0}-${r1} dibanding ${e0}-${e1}).`),
      },
      {
        t: T_FIX,
        title: n > 0 && h <= 0
          ? tr('MODIS and VIIRS on one scale: the rise disappears.', 'MODIS dan VIIRS pada satu skala: kenaikan itu hilang.')
          : tr('MODIS and VIIRS on one scale: the picture changes.', 'MODIS dan VIIRS pada satu skala: gambarannya berubah.'),
        body: tr(
          `We harmonize the two sensors, so every year is counted the same way. On that one scale, Indonesia's fire count ${verb(h)} ${sizeOf(h)} over the same years.`,
          `Kami mengharmonisasi kedua sensor, sehingga setiap tahun dihitung dengan cara yang sama. Pada satu skala itu, jumlah kebakaran Indonesia ${verb(h)} ${sizeOf(h)} pada tahun-tahun yang sama.`),
      },
    );
  }

  const augTotal = data ? num(data.aug.reduce((s, x) => s + x.n, 0)) : '';
  const smokyN = data ? num(data.byDate.get(SMOKY_DAY)?.n ?? 0) : '';
  const beats: Beat[] = [
    ...introBeats,
    {
      t: off,
      title: tr('Now look closely: Central Kalimantan, 2019.', 'Sekarang lihat dari dekat: Kalimantan Tengah, 2019.'),
      body: tr(
        `Real satellite photos and real fire detections, one day at a time, ${mon(8)} to ${mon(10)}.`,
        `Foto satelit asli dan deteksi api asli, hari demi hari, ${mon(8)} sampai ${mon(10)}.`),
    },
    {
      t: off + T_AUG,
      title: tr(`${mon(8)}: clear sky. The satellite sees the fires.`, `${mon(8)}: langit cerah. Satelit melihat api.`),
      body: tr(
        `Each dot is a hotspot: a spot where the VIIRS sensor detected fire. ${augTotal} of them in ${mon(8)}.`,
        `Setiap titik adalah titik panas: lokasi tempat sensor VIIRS mendeteksi api. Ada ${augTotal} titik pada bulan ${mon(8)}.`),
    },
    {
      // the cloud map is introduced here, on a day full of smoke: it knows cloud only, and says so once
      t: off + T_SMOKE,
      title: tr(`${mon(9)}: smoke fills the sky.`, `${mon(9)}: asap memenuhi langit.`),
      body: vis
        ? tr(
          `${smokyN} hotspots on ${dayMonth(SMOKY_DAY)}. Our map of hidden land shows only ${pct(vis.smoky)} that day, because it knows cloud, not smoke. The land truly hidden from the satellite is larger.`,
          `${smokyN} titik panas pada ${dayMonth(SMOKY_DAY)}. Peta lahan tersembunyi kami hanya menunjukkan ${pct(vis.smoky)} hari itu, karena peta ini mengenali awan, bukan asap. Lahan yang sebenarnya tersembunyi dari satelit lebih luas.`)
        : tr(
          `${smokyN} hotspots on ${dayMonth(SMOKY_DAY)}, and the photo is grey with smoke. Where cloud covers the ground, zero hotspots does not mean no fire.`,
          `${smokyN} titik panas pada ${dayMonth(SMOKY_DAY)}, dan fotonya kelabu oleh asap. Di lahan yang tertutup awan, nol titik panas bukan berarti tidak ada api.`),
    },
    {
      t: off + T_BLIND,
      title: tr(`${longDate(blindDay)}: cloud covers the province.`, `${longDate(blindDay)}: awan menutupi provinsi ini.`),
      body: vis
        ? tr(
          `Striped land reported zero hotspots, but cloud hid it every time the MODIS satellites passed: ${pct(vis.top)} of the land with no fire detected. Zero there means “could not see”.`,
          `Lahan bergaris melaporkan nol titik panas, tapi tertutup awan setiap kali satelit MODIS melintas: ${pct(vis.top)} dari lahan tanpa deteksi api. Nol di sana berarti “tidak terlihat”.`)
        : tr(
          'Under cloud, a satellite reports zero hotspots because it cannot see the ground. Zero there means “could not see”.',
          'Di bawah awan, satelit melaporkan nol titik panas karena tidak bisa melihat tanah. Nol di sana berarti “tidak terlihat”.'),
    },
    {
      t: off + T_END_BEAT,
      title: tr('Under cloud, zero hotspots means no information.', 'Di bawah awan, nol titik panas berarti tidak ada informasi.'),
      body: vis
        ? tr(
          `In this season, ${pct(vis.season)} of Central Kalimantan's “no fire” readings came from land under cloud. KalenderApi marks which ones, for every day and every district. We do not guess how much fire was hidden.`,
          `Pada musim ini, ${pct(vis.season)} catatan “tidak ada api” di Kalimantan Tengah berasal dari lahan yang tertutup awan. KalenderApi menandai yang mana, untuk setiap hari dan setiap kabupaten. Kami tidak menebak berapa api yang tersembunyi.`)
        : tr(
          'Under cloud, a satellite cannot see the ground, so zero hotspots can mean nothing could be seen. KalenderApi shows each day\'s satellite photo with that day\'s hotspots, so you can tell which areas were hidden.',
          'Di bawah awan, satelit tidak bisa melihat tanah, jadi nol titik panas bisa berarti tidak ada yang terlihat. KalenderApi menampilkan foto satelit tiap hari bersama titik panas hari itu, sehingga terlihat daerah mana yang tertutup.'),
    },
  ];

  // ---------------------------------------------------------------------------------------------- this cue's page
  const done = mark.t >= end;                 // the final frame: the app's home
  const tc = Math.min(mark.t, end);
  const tl = tc - off;                        // the time of the Central Kalimantan beats
  const inIntro = !!intro && tc < INTRO;
  const beat = [...beats].reverse().find((b) => tc >= b.t) ?? beats[0]!;
  const byDay = !!data && !inIntro && tl >= T_AUG && tl < T_END_BEAT - LEAD;   // the dots of one day are on
  const dotsCredit = !inIntro && tl >= T_HEX_DOWN && tl < T_END_BEAT - LEAD;
  const stampHot = !data ? '' : tl < T_SMOKE ? augLabel(augDayAt(Math.min(now.current, end) - off, data.aug.length))
    : `${tr('Hotspots', 'Titik panas')} ${longDate(tl < T_BLIND ? SMOKY_DAY : blindDay)}`;
  const photoDay = tl < T_SMOKE ? longDate(CLEAR_DAY) : tl < T_BLIND ? longDate(SMOKY_DAY) : longDate(blindDay);
  const loadingText = failed ? tr('The hotspot file did not load.', 'Berkas titik panas gagal dimuat.')
    : !ready ? tr('Loading satellite data...', 'Memuat data satelit...') : null;
  const noLook = tr('under cloud: the satellite could not see', 'tertutup awan: satelit tidak bisa melihat');
  // The home frame is read by people who have never heard of a hotspot: say what a hotspot is, who reports the zero,
  // what could not be seen, and what this app shows.
  const title = done ? tr('Zero hotspots is not always zero fire.', 'Nol titik panas belum tentu nol api.') : beat.title;
  const body = done
    ? tr(
      'NASA satellites record a hotspot wherever they detect fire. But under cloud a satellite cannot see the ground, so “zero hotspots” can mean nothing could be seen, not that nothing burned. KalenderApi shows, for every day, which areas the satellite could see and which were hidden under cloud.',
      'Satelit NASA mencatat titik panas di setiap lokasi yang terdeteksi terbakar. Tapi di bawah awan satelit tidak bisa melihat tanah, jadi “nol titik panas” bisa berarti tidak terlihat, bukan tidak ada api. KalenderApi menunjukkan, untuk setiap hari, daerah mana yang terlihat satelit dan mana yang tertutup awan.')
    : loadingText ?? beat.body;

  return (
    <>
    <div className={'ka-story' + (done ? ' is-home' : '')}>
      <div ref={box} className="ka-story-canvas" aria-hidden="true" />
      <div className="ka-story-vignette" />
      {intro && inIntro && !done ? (
        <IntroChart intro={intro} fix={tc >= T_FIX} leaving={tc >= INTRO - 0.7} still={!playing} oneScale={oneScale} />
      ) : null}
      <header className="ka-story-top">
        <a className="ka-story-brand" href="#/story?hub=1">KalenderApi</a>
        <span className="ka-story-tag">{tr('Indonesian for "fire calendar" . NASA Space Apps 2026', 'Kalender api . NASA Space Apps 2026')}</span>
        <nav className="ka-story-tools" aria-label={tr('Story controls', 'Kontrol cerita')}>
          {!done ? (
            <button type="button" className="ka-story-skip" onClick={() => jumpTo(end, false)}>{tr('Skip story', 'Lewati cerita')}</button>
          ) : null}
          <LangToggle className="ka-story-lang" />
          <a className="ka-story-method" href="#/method">{tr('Method', 'Metode')}</a>
        </nav>
      </header>
      {byDay && (
        <div className="ka-story-stamp" aria-hidden="true">
          <span ref={stampEl}>{stampHot}</span>
          <span>{`${tr('Photo', 'Foto')} ${photoDay}`}</span>
          {tl >= T_BLIND && vis ? <span><i className="ka-story-hatch" /> {noLook}</span> : null}
        </div>
      )}
      <section className="ka-story-copy" aria-live="polite">
        <p className="ka-story-kicker">{done ? tr('Can you trust a report of “zero hotspots”?', 'Bisakah laporan “nol titik panas” dipercaya?') : `${beats.indexOf(beat) + 1} / ${beats.length}`}</p>
        <h1 key={title}>{title}</h1>
        <p key={body} className="ka-story-body">{body}</p>
        {done && (
          <div className="ka-story-cta">
            <a className="ka-btn-primary" href="#/season">{tr('Play a fire season, day by day', 'Putar satu musim kebakaran, hari demi hari')}</a>
            <a className="ka-btn-ghost" href="#/now">{tr("Check today's hotspots in your district", 'Cek titik panas hari ini di daerah Anda')}</a>
            <a className="ka-btn-ghost" href="#/zero">{tr('Inspect one day, cell by cell', 'Periksa satu hari, petak demi petak')}</a>
            <a className="ka-btn-ghost" href="#/record">{tr('Open your area\'s fire calendar', 'Buka kalender api daerah Anda')}</a>
            <a className="ka-btn-ghost" href={`#/brief?aoi=${KALTENG_AOI}`}>{tr('One-page district brief', 'Ringkasan satu halaman per kabupaten')}</a>
            <button type="button" className="ka-btn-ghost" onClick={() => jumpTo(0, !reduced)}>{tr('Replay the story', 'Putar ulang cerita')}</button>
          </div>
        )}
      </section>
      {done ? (
        <aside className="ka-story-hub">
          <div className="ka-story-hub-in">
            <Quiet><Suspense fallback={null}><HubPanel /></Suspense></Quiet>
          </div>
        </aside>
      ) : null}
      <footer className="ka-story-foot">
        {inIntro ? (
          <>
            <span className="ka-story-foot-long">
              {tr(
                `Lines: fire cell-days over Indonesia a year (a 0.01 degree cell with a detection on a local date, counted per satellite and per day or night pass), each indexed to its own 2003 to 2011 mean. As recorded: NASA FIRMS MODIS C6.1 to 2011, VIIRS 375 m from 2012. One scale: our harmonization (${oneScale}); band = 90% range. Detections, not burned area. Hexagons: NASA VIIRS hotspots per hexagon, Central Kalimantan, ${monthName(8, lang)} to ${monthName(10, lang)} 2019 (FIRMS). Photo: NASA GIBS / Worldview, Suomi NPP VIIRS true colour, ${longDate(CLEAR_DAY)}.`,
                `Garis: sel-hari api di Indonesia per tahun (sel 0,01 derajat dengan deteksi pada satu tanggal lokal, dihitung per satelit dan per lintasan siang atau malam), masing-masing diindeks ke rata-rata 2003-2011 miliknya. Apa adanya: NASA FIRMS MODIS C6.1 sampai 2011, VIIRS 375 m mulai 2012. Satu skala: harmonisasi kami (${oneScale}); pita = rentang 90%. Deteksi, bukan luas terbakar. Heksagon: titik panas NASA VIIRS per heksagon, Kalimantan Tengah, ${monthName(8, lang)} sampai ${monthName(10, lang)} 2019 (FIRMS). Foto: NASA GIBS / Worldview, warna asli VIIRS Suomi NPP, ${longDate(CLEAR_DAY)}.`)}
            </span>
            <span className="ka-story-foot-short">
              {tr(
                `NASA FIRMS MODIS and VIIRS on one scale (our harmonization). Detections, not burned area. Hexagons: VIIRS hotspots per hexagon. Photo: NASA GIBS, ${longDate(CLEAR_DAY)}.`,
                `NASA FIRMS MODIS dan VIIRS pada satu skala (harmonisasi kami). Deteksi, bukan luas terbakar. Heksagon: titik panas VIIRS per heksagon. Foto: NASA GIBS, ${longDate(CLEAR_DAY)}.`)}
            </span>
          </>
        ) : dotsCredit ? (
          <>
            <span className="ka-story-foot-long">
              {tr(
                `Dots: NASA FIRMS VIIRS S-NPP 375 m hotspots${data ? ` (${num(data.kept)} in the Central Kalimantan box, ${monthName(8, lang)} to ${monthName(10, lang)} 2019)` : ''}. Hatching: land with no fire detected and no cloud-free look from Terra or Aqua that day, cloud only (NASA MODIS MOD14A1 and MYD14A1 C6.1 daily FireMask, 0.01 degree grid). Lines: district borders (geoBoundaries, CC BY 3.0 IGO). Imagery: NASA GIBS / Worldview, Suomi NPP VIIRS true colour.`,
                `Titik: titik panas NASA FIRMS VIIRS S-NPP 375 m${data ? ` (${num(data.kept)} di dalam kotak Kalimantan Tengah, ${monthName(8, lang)} sampai ${monthName(10, lang)} 2019)` : ''}. Arsir: lahan tanpa deteksi api dan tanpa pandangan bebas awan dari Terra maupun Aqua hari itu, hanya awan (NASA MODIS MOD14A1 dan MYD14A1 C6.1, FireMask harian, grid 0,01 derajat). Garis: batas kabupaten/kota (geoBoundaries, CC BY 3.0 IGO). Citra: NASA GIBS / Worldview, warna asli VIIRS Suomi NPP.`)}
            </span>
            <span className="ka-story-foot-short">
              {tr(
                'Dots: NASA FIRMS VIIRS hotspots. Hatching: no cloud-free look, cloud only (NASA MODIS FireMask). Photo: NASA GIBS.',
                'Titik: titik panas NASA FIRMS VIIRS. Arsir: tanpa pandangan bebas awan, hanya awan (NASA MODIS FireMask). Foto: NASA GIBS.')}
            </span>
          </>
        ) : (
          <>
            <span className="ka-story-foot-long">
              {tr(
                `Hexagons: NASA VIIRS hotspots per hexagon, ${mon(8)} to ${mon(10)} 2019 (FIRMS, Suomi NPP 375 m), Central Kalimantan; taller and paler where there are more. Detections, not burned area. Imagery: NASA GIBS / Worldview, Suomi NPP VIIRS true colour, ${longDate(CLEAR_DAY)}.`,
                `Heksagon: titik panas NASA VIIRS per heksagon, ${mon(8)} sampai ${mon(10)} 2019 (FIRMS, Suomi NPP 375 m), Kalimantan Tengah; lebih tinggi dan lebih pucat jika lebih banyak. Deteksi, bukan luas terbakar. Citra: NASA GIBS / Worldview, warna asli VIIRS Suomi NPP, ${longDate(CLEAR_DAY)}.`)}
            </span>
            <span className="ka-story-foot-short">
              {tr(
                `Hexagons: NASA VIIRS hotspots per hexagon, ${monthName(8, lang)} to ${monthName(10, lang)} 2019 (FIRMS). Imagery: NASA GIBS, ${longDate(CLEAR_DAY)}.`,
                `Heksagon: titik panas NASA VIIRS per heksagon, ${monthName(8, lang)} sampai ${monthName(10, lang)} 2019 (FIRMS). Citra: NASA GIBS, ${longDate(CLEAR_DAY)}.`)}
            </span>
          </>
        )}
      </footer>
      {done ? (
        <button type="button" className="ka-story-more"
          onClick={() => window.scrollTo({ top: window.innerHeight, behavior: reduced ? 'auto' : 'smooth' })}>
          <span>{tr('Scroll for the MODIS and VIIRS calendar and the globe', 'Gulir untuk kalender MODIS dan VIIRS serta bola dunia')}</span>
          <i aria-hidden="true">↓</i>
        </button>
      ) : null}
      <div ref={bar} className="ka-story-progress" />
    </div>
    {done ? <Quiet><Suspense fallback={null}><HomeSections embedded /></Suspense></Quiet> : null}
    </>
  );
}

// ------------------------------------------------------------------------------------------------ the intro chart

const CW = 560, CH = 300, PAD = { l: 48, r: 140, t: 24, b: 30 };

/** Indonesia's yearly record over the map during the intro: the record joined as recorded drawn first (the jump), then
 *  the one-scale line and its 90% band. Each line indexed to its own 2003-2011 mean, as on the record page. The lines
 *  are drawn by CSS (brand.css): `fix` starts the one-scale line, `leaving` fades the chart, `still` shows it finished. */
function IntroChart({ intro, fix, leaving, still, oneScale }: { intro: Intro; fix: boolean; leaving: boolean; still: boolean; oneScale: string }) {
  const tr = useTr();
  const pts = useMemo(() => intro.ba.points.filter((p) => !p.provisional), [intro]);
  const geo = useMemo(() => {
    const x0 = pts[0]?.year ?? 2003, x1 = pts[pts.length - 1]?.year ?? 2025;
    const yMax = Math.max(120, ...pts.map((p) => Math.max(p.naive, p.hi))) * 1.05;
    const x = (y: number) => PAD.l + ((y - x0) / Math.max(1, x1 - x0)) * (CW - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - v / yMax) * (CH - PAD.t - PAD.b);
    const line = (k: 'naive' | 'H') => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.year).toFixed(1)},${y(p[k]).toFixed(1)}`).join('');
    const band = `${pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.year).toFixed(1)},${y(p.hi).toFixed(1)}`).join('')}`
      + `${[...pts].reverse().map((p) => `L${x(p.year).toFixed(1)},${y(p.lo).toFixed(1)}`).join('')}Z`;
    // about five round steps (100, 200, 250, 500...) up to the top of the data
    const rough = yMax / 5, mag = Math.pow(10, Math.floor(Math.log10(rough)));
    const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= rough) ?? 10) * mag;
    const ticks = Array.from({ length: Math.floor(yMax / step) + 1 }, (_, i) => i * step);
    const last = pts[pts.length - 1];
    return { x, y, raw: line('naive'), harm: line('H'), band, ticks, x0, x1, last };
  }, [pts]);
  const { x, y, last } = geo;
  return (
    <figure className={'ka-story-chart' + (fix ? ' is-fix' : '') + (leaving ? ' is-leaving' : '') + (still ? ' is-still' : '')} aria-hidden="true">
      <ul className="ka-sc-key">
        <li className="is-modis"><i />MODIS</li>
        <li className="is-viirs"><i />VIIRS</li>
        <li className="is-harm"><i />{tr('One scale (MODIS + VIIRS, harmonized)', 'Satu skala (MODIS + VIIRS, terharmonisasi)')}</li>
      </ul>
      <svg viewBox={`0 0 ${CW} ${CH}`} role="presentation">
        {geo.ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={CW - PAD.r} y1={y(v)} y2={y(v)} className={v === 100 ? 'ka-sc-base' : 'ka-sc-grid'} />
            <text x={PAD.l - 8} y={y(v) + 4} className="ka-sc-tick" textAnchor="end">{v}</text>
          </g>
        ))}
        {[geo.x0, SEAM_YEAR, geo.x1].map((yr) => <text key={yr} x={x(yr)} y={CH - 8} className="ka-sc-tick" textAnchor="middle">{yr}</text>)}
        <line x1={x(SEAM_YEAR)} x2={x(SEAM_YEAR)} y1={PAD.t - 6} y2={CH - PAD.b} className="ka-sc-seam" />
        <text x={x(SEAM_YEAR) + 6} y={PAD.t + 4} className="ka-sc-seamtext">{tr(`${SEAM_YEAR}: VIIRS joins`, `${SEAM_YEAR}: VIIRS masuk`)}</text>
        <path d={geo.band} className="ka-sc-band" />
        {/* the record as recorded: the same path twice, MODIS blue up to 2011 and VIIRS amber after it */}
        <clipPath id="ka-sc-clip-m"><rect x={0} y={0} width={Math.max(0, x(SEAM_YEAR - 1))} height={CH} /></clipPath>
        <clipPath id="ka-sc-clip-v"><rect x={Math.max(0, x(SEAM_YEAR - 1))} y={0} width={CW} height={CH} /></clipPath>
        <g clipPath="url(#ka-sc-clip-v)"><path d={geo.raw} className="ka-sc-raw" pathLength={1} /></g>
        <path d={geo.harm} className="ka-sc-harm" pathLength={1} />
        {/* on top: up to 2011 the one-scale line is the same MODIS count, so the blue stays visible as its core */}
        <g clipPath="url(#ka-sc-clip-m)"><path d={geo.raw} className="ka-sc-raw is-modis" pathLength={1} /></g>
        {last ? (
          <>
            <text x={x(last.year) + 8} y={y(last.naive) + 4} className="ka-sc-lab ka-sc-lab-raw">{tr('As recorded', 'Apa adanya')}</text>
            <text x={x(last.year) + 8} y={y(last.H) + 4} className="ka-sc-lab ka-sc-lab-harm">{tr('One scale', 'Satu skala')}</text>
          </>
        ) : null}
      </svg>
      <figcaption>
        {tr(
          `Indonesia, fire cell-days a year, 2003 to 2011 = 100. One scale: ${oneScale}.`,
          `Indonesia, sel-hari api per tahun, 2003-2011 = 100. Satu skala: ${oneScale}.`)}
      </figcaption>
    </figure>
  );
}
