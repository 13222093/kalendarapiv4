// KalenderApi (new file, not from Fire Harmony): "Play the season" (#/season), PRD section 6.7.
// Central Kalimantan, 1 Aug to 31 Oct 2019, one real day per frame: that day's NASA GIBS VIIRS true-colour photo and
// that day's NASA FIRMS VIIRS S-NPP hotspots (public/ka-data/kalteng_2019_season.json, built by
// kalenderapi/scripts/build_season.py). Honesty rules: a frame is exactly one day of data; nothing is interpolated or
// drawn between days (no arrows, no fire fronts); a day with no points shows zero; every number on screen is computed
// here from the data file. The faded dots are the real points of the previous 7 days, not an estimate.
// Wording: the hatched layer is "no cloud-free look" (cloud only, from the MODIS fire mask); the panel says once that
// thick smoke is not flagged, so the true unseen share is higher. English and Bahasa Indonesia (lib/lang.ts).
// Explore (15 Nov): the map zooms and pans (mouse, touch, keys) inside bounds, with "Reset view"; exploring pauses the
// play. A hotspot gives a card (hover or click); a district (a click on the map, or the list) gives the district card for
// the day on screen: its VIIRS hotspots (a point-in-polygon count of the loaded points), the share of its no-fire land
// under cloud all day (MODIS), the reporting rule when most of it was, and its own pages. The 2019 season counts the
// hotspots but shows no district cloud share and no rule: held for a registered test. Colours: the design tokens only.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Deck, MapView, WebMercatorViewport, type Layer, type PickingInfo } from '@deck.gl/core';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer, PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { fmtNumber, locale, monthName, useLang, useTr, type Lang, type Tr } from '../lib/lang';
import { LangToggle } from '../components/LangToggle';
import { DistrictCard, HotspotCard, HoverTip, type Cloud, type DistrictView, type Hotspot } from '../components/season/SeasonCards';
import { countByDay, districtAt, makeDistrict, type District } from '../lib/seasonGeo';
import { mix, readSeasonColors, type Rgb, type SeasonColors } from '../lib/seasonTheme';
import '../styles/season.css';

type Pt = [number, number, number, number];   // lon, lat, frp (MW), isNight (1 or 0)
interface Day { date: string; n: number; r: number; pts: Pt[]; re: number[] }
interface SeasonFile {
  source: {
    url: string; downloaded_utc: string; sha256: string; bytes: number; rows_total: number; rows_kept: number;
    filter_text: string; product: string;
  };
  bbox: [number, number, number, number];
  bbox_note?: string;
  reappear_rule: string;
  days: Day[];
}
/** What the page shows, all computed from the file. */
interface Season {
  file: SeasonFile;
  days: Day[];
  rePts: Pt[][];       // the re-appeared points of each day
  cumRe: number[];     // re-appeared points from the first day up to each day
  max: number;         // the largest daily count
  maxAt: number;       // its day
  kept: number;        // the sum of the daily counts (checked against source.rows_kept)
}

/** Where the satellites had a cloud-free look (public/ka-data/visibility_kalteng_<year>.json and vis<year>/<date>.png,
 *  built by kalenderapi/scripts/build_visibility.py from the NASA MODIS Terra and Aqua daily FireMask). Per day: cells
 *  with no fire detected that had a cloud-free look from Terra or Aqua (T) or none, only cloud (U); d = [T, U] per
 *  district. `blind` is U / (T + U) in %. The file's own `rule` text is not shown: the page states the rule itself. */
interface VisDay { date: string; F: number; T: number; U: number; N: number; blind: number | null; d: [number, number][] }
interface VisFile {
  rule: string;
  grid: { bbox: [number, number, number, number] };
  season: { T: number; U: number; blind: number | null };
  districts: { name: string; T: number; U: number; blind: number | null }[];
  days: VisDay[];
  source: { firemask: { product: string; access: string; read_utc: string }; districts: { name: string; license: string } };
}
interface Vis { file: VisFile; byDate: Map<string, VisDay>; rings: [number, number][][] }
// Project 4: one set of files per season year (2019 as before; 2015 and 2023 once the data work has built them)
const visUrl = (year: number) => `${import.meta.env.BASE_URL}ka-data/visibility_kalteng_${year}.json`;
const DISTRICTS_URL = `${import.meta.env.BASE_URL}ka-data/kalteng_districts.json`;
const visImgUrl = (year: number, date: string) => `${import.meta.env.BASE_URL}ka-data/vis${year}/${date}.png`;
/** A ka-data file that is not built yet: a 404, or (in development) the app's page served in its place. */
class NotBuilt extends Error {}
const NOT_BUILT = 'not-built';
async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (r.status === 404) throw new NotBuilt(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  if (!(r.headers.get('content-type') ?? '').includes('json')) throw new NotBuilt(url);
  return r.json() as Promise<T>;
}
/** The address of a day: 2019 keeps its old form ('#/season?d=2019-09-15'), other years name the year too. */
const dayHash = (year: number, date: string, debug: boolean) =>
  `#/season?${year === 2019 ? '' : `y=${year}&`}d=${date}${debug ? '&debug=1' : ''}`;
const BLIND_NOTE = 20;         // caption: point at the hatching when at least this % of today's no-fire land had no cloud-free look
const pct1 = (x: number, lang: Lang) => `${fmtNumber(x, lang, 1)}%`;
const KALTENG_AOI = 'prov-kalimantan-tengah';

const dataUrl = (year: number) => `${import.meta.env.BASE_URL}ka-data/kalteng_${year}_season.json`;
const SEASON_YEARS = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2026];
// Project 4: GIBS has the Suomi NPP VIIRS true-colour layer from 24 Nov 2015 (its WMTS capabilities); before that a day's
// photo is MODIS Terra true colour (every day since 2000), and the page says which satellite took it.
const VIIRS_PHOTO_FROM = '2015-11-24';
const photoId = (date: string) => (date < VIIRS_PHOTO_FROM ? 'MODIS_Terra_CorrectedReflectance_TrueColor' : 'VIIRS_SNPP_CorrectedReflectance_TrueColor');
const photoName = (date: string) => (date < VIIRS_PHOTO_FROM ? 'MODIS Terra' : 'VIIRS S-NPP');
const SPEEDS = [1, 3, 6] as const;   // days per second; the first is the default
// Explore: how far the camera may go. Zoom: a little wider than the fitted view, up to where a 375 m pixel is about 10 px.
const MAX_ZOOM = 11;
const ZOOM_OUT_ROOM = 0.6;
const PAN_ROOM = 0.8;          // degrees the camera's centre may leave the data box
const ZOOM_STEP = 0.75;        // the + and - buttons and keys
const PAN_PX = 90;             // Shift + arrow keys
/** 1 Jan to 31 Oct 2019 is locked for Central Kalimantan and Pulang Pisau (a registered test): no district cloud share. */
const LOCKED_YEAR = 2019;
const KALTENG_PROVINCE = 'Kalimantan Tengah';
const ZERO_DISTRICT = 'Pulang Pisau';   // the only district with the cell-by-cell page (#/zero)
const AOI_INDEX_URL = `${import.meta.env.BASE_URL}ss-data/districts/index.json`;
interface ViewS { longitude: number; latitude: number; zoom: number; pitch: number; bearing: number; minZoom: number; maxZoom: number }
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const TRAIL = 7;               // previous days drawn as a fading trail
// The clock waits this long (ms) for the next day's photo, then moves on without it: the frame still shows that day's
// hotspots over a dark ground, never another day's photo. GIBS sends its tiles with no-store and about 0.8 s each, so a
// longer wait only freezes the play.
const MAX_PHOTO_WAIT = 450;
const PREFETCH_S = 1.2;        // seconds of playback whose photos load ahead (hidden layers), at least 2 days
// Photo tiles load only around the data box (this many degrees beyond it): about 4 tiles a day instead of about 11 for
// the whole tilted screen, so the photos keep up with the play. Beyond it the vignette darkens the ground anyway.
const PHOTO_MARGIN = 1.5;
// A paused day whose photo has not come: its layer is pushed every PHOTO_KICK_MS, its tiles are fetched again after
// PHOTO_RETRY_MS (up to PHOTO_RETRIES times), then the page says the photo did not come. The photo never waits for
// this to be drawn: every tile shows as soon as it arrives.
const PHOTO_KICK_MS = 600;
const PHOTO_RETRY_MS = 5000;
const PHOTO_RETRIES = 2;
const LOW_SHARE = 0.2;         // caption: today below 20% of the largest of the previous 7 days
const PITCH = 35, BEARING = -10;
const BOX: [number, number, number, number] = [110.7, -3.6, 115.9, 0.9];   // the data box: west, south, east, north
const PTS_LAYER = /^pts-(\d{4}-\d{2}-\d{2})$/;   // the id of a day's hotspot layer
const PLACES = [
  { name: 'Palangka Raya', p: [113.914, -2.21] as [number, number] },
  { name: 'Sampit', p: [112.95, -2.533] as [number, number] },
  { name: 'Pangkalan Bun', p: [111.617, -2.683] as [number, number] },
  { name: 'Kuala Kapuas', p: [114.388, -3.001] as [number, number] },
  { name: 'Muara Teweh', p: [114.894, -0.95] as [number, number] },
];

function fmt(n: number, lang: Lang) { return fmtNumber(Math.round(n), lang); }
function reducedMotion() { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; }
function dateFromHash(hash: string): string | null {
  const q = hash.split('?')[1];
  const d = q ? new URLSearchParams(q).get('d') : null;
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}
function parts(date: string, lang: Lang) {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const weekday = new Intl.DateTimeFormat(locale(lang), { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
  return { month: monthName(m, lang, 'long'), year: y, weekday };
}

function prepare(file: SeasonFile): Season {
  const days = file.days;
  const rePts = days.map((d) => d.re.map((i) => d.pts[i]).filter((p): p is Pt => !!p));
  const cumRe: number[] = [];
  let run = 0, max = 0, maxAt = 0, kept = 0;
  days.forEach((d, i) => {
    run += rePts[i]?.length ?? 0;
    cumRe.push(run);
    kept += d.pts.length;
    if (d.pts.length > max) { max = d.pts.length; maxAt = i; }
  });
  return { file, days, rePts, cumRe, max, maxAt, kept };
}

// ------------------------------------------------------------------------------------------------ layers

function renderPhotoTile(props: Record<string, unknown> & { tile: unknown; data: unknown }) {
  const { boundingBox } = props.tile as { boundingBox: [[number, number], [number, number]] };
  return new BitmapLayer(props as never, {
    data: undefined, image: props.data as never, tintColor: [208, 212, 220],
    bounds: [boundingBox[0][0], boundingBox[0][1], boundingBox[1][0], boundingBox[1][1]],
  });
}
const DEBUG_MARK = 'season 2026-11-14 watchdog+debug+still';
// A browser that draws no frames at all (a page in a pane that is not on screen, a tab in the background) never runs
// the WebGL map: after NO_FRAME_MS without a frame, a plain still photo of the day stands in, said to be a still.
const NO_FRAME_MS = 3000;

/** One still NASA GIBS photo (WMS, plain lat/lon) of the box around the data, for the page that gets no frames. */
function stillUrl(date: string, [w, s, e, n]: [number, number, number, number]) {
  const width = 1024, height = Math.round((width * (n - s)) / (e - w));
  return `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${photoId(date)}`
    + `&STYLES=&FORMAT=image/jpeg&CRS=EPSG:4326&BBOX=${s},${w},${n},${e}&WIDTH=${width}&HEIGHT=${height}&TIME=${date}`;
}

/** Where the photo layer of a day stands, from deck.gl's own tile set (for the debug readout and the console). */
function tileReport(d: Deck<MapView> | null, date: string): string {
  type Tile = { isLoaded: boolean; isLoading: boolean; content: unknown };
  type L = { id: string; state?: { tileset?: { selectedTiles?: Tile[] | null } } };
  const lm = (d as unknown as { layerManager?: { getLayers(): L[] } } | null)?.layerManager;
  if (!lm) return 'deck.gl not started yet (no frame drawn)';
  const tiles = lm.getLayers().find((l) => l.id === `photo-${date}`)?.state?.tileset?.selectedTiles;
  if (!tiles) return 'no tiles chosen yet (the layer has not been updated in a frame)';
  const n = (f: (t: Tile) => boolean) => tiles.filter(f).length;
  return `${tiles.length} tiles chosen, ${n((t) => t.isLoading)} fetching, ${n((t) => t.isLoaded)} loaded, ${n((t) => !!t.content)} with an image`;
}

/** A push for the photo of the day shown, while it has not loaded (see the watchdog in Season). */
interface PhotoKick { nudge: number; retry: number }
const NO_KICK: PhotoKick = { nudge: 0, retry: 0 };

function photoLayer(date: string, opacity: number, onLoad: () => void, onError: (e: unknown) => void, zoomOffset: number,
  extent: [number, number, number, number], kick: PhotoKick = NO_KICK) {
  return new TileLayer({
    id: `photo-${date}`, opacity, visible: opacity > 0,   // a hidden layer still loads its tiles
    data: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${photoId(date)}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    minZoom: 0, maxZoom: 9, zoomOffset, tileSize: 256, extent,
    onViewportLoad: onLoad, onTileError: onError,
    renderSubLayers: renderPhotoTile as never,
    // Story sets new props on its photo layers every frame, so each frame re-runs their update. Season sets them once a
    // day; a new `nudge` re-runs that update (tiles cancelled on the way are asked again, the tiles' bitmaps are drawn
    // again) and a new `retry` fetches the day's tiles again.
    updateTriggers: { renderSubLayers: kick.nudge, getTileData: kick.retry },
  });
}

// additive blending: dense clusters glow; no depth test (the dots lie on the ground plane)
const ADDITIVE = {
  blend: true, blendColorOperation: 'add', blendColorSrcFactor: 'src-alpha', blendColorDstFactor: 'one',
  blendAlphaOperation: 'add', blendAlphaSrcFactor: 'one', blendAlphaDstFactor: 'one-minus-src-alpha',
  depthCompare: 'always', depthWriteEnabled: false,
} as const;
const FLAT = { depthCompare: 'always', depthWriteEnabled: false } as const;

const ptPos = (p: Pt) => [p[0], p[1]] as [number, number];
/** Pixel radius: grows mildly with fire radiative power. */
const ptRadius = (p: Pt) => Math.min(8, 2.1 + Math.sqrt(Math.max(0, p[2])) * 0.42);
const ringRadius = (p: Pt) => ptRadius(p) + 3.2;
type Rgba = [number, number, number, number];
const rgba = (c: Rgb, a: number): Rgba => [c[0], c[1], c[2], a];
/** Today's VIIRS hotspot: the VIIRS amber (token --ka-viirs); hotter (higher FRP) is paler. */
function emberToday(col: SeasonColors) {
  return (p: Pt): Rgba => {
    const t = Math.max(0, Math.min(1, Math.log10(Math.max(0, p[2]) + 1) / 2.4));
    return rgba(mix(col.viirs, col.text, t * 0.6), 215);
  };
}
/** Trail alpha: 1.0 the day before, down to 0.15 seven days before. */
function trailAlpha(age: number) { return 1 - ((age - 1) / (TRAIL - 1)) * 0.85; }

function dayLayer(day: Day, age: number, col: SeasonColors) {
  const today = age === 0;
  return new ScatterplotLayer<Pt>({
    id: `pts-${day.date}`, data: day.pts,
    getPosition: ptPos, getRadius: ptRadius, getFillColor: today ? emberToday(col) : rgba(mix(col.viirs, col.bg, 0.4), 140),
    radiusUnits: 'pixels', radiusScale: today ? 1 : 0.6, opacity: today ? 1 : trailAlpha(age),
    filled: true, stroked: false, antialiasing: true, parameters: ADDITIVE,
    pickable: today,   // only the day on screen answers the pointer
    updateTriggers: { getFillColor: today },
  });
}

// ------------------------------------------------------------------------------------------------ page

export function Season({ year = 2019 }: { year?: number }) {
  const tr = useTr();
  const lang = useLang();
  const root = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const deck = useRef<Deck<MapView> | null>(null);
  const reduced = useMemo(reducedMotion, []);
  const [season, setSeason] = useState<Season | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(SPEEDS[0]);
  const [, setLoadedTick] = useState(0);
  const loaded = useRef(new Set<string>());
  const onLoadFns = useRef(new Map<string, () => void>());
  const idxRef = useRef(0);
  idxRef.current = idx;
  const playingRef = useRef(false);
  playingRef.current = playing;
  const speedRef = useRef(1);
  speedRef.current = speed;
  const fade = useRef<{ from: string | null; start: number; dur: number }>({ from: null, start: 0, dur: 0 });
  const frameMs = 1000 / speed;   // speed is days per second

  // the page is a dark map page in either theme: the tokens of the dark theme apply while it is open (the visitor's
  // saved choice is not touched, and comes back when the page closes)
  useLayoutEffect(() => {
    const el = document.documentElement;
    const before = el.dataset.theme;
    el.dataset.theme = 'dark';
    return () => {
      if (before === undefined) delete el.dataset.theme; else el.dataset.theme = before;
      window.dispatchEvent(new Event('fh:theme'));
    };
  }, []);
  const colors = useRef<SeasonColors | null>(null);

  // ---- explore: the camera, what is selected, what the pointer is over
  const home = useRef<ViewS | null>(null);     // the fitted view ("Reset view")
  const view = useRef<ViewS | null>(null);     // where the camera is now
  const nonce = useRef(0);
  const [moved, setMoved] = useState(false);   // the camera left the fitted view
  const [selPt, setSelPt] = useState<{ date: string; p: Pt } | null>(null);
  const [selDist, setSelDist] = useState<number | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; date: string; p: Pt } | null>(null);
  const [districts, setDistricts] = useState<District[] | null>(null);
  const [aoiIds, setAoiIds] = useState<Map<string, string> | 'failed' | null>(null);
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const before = document.title;
    document.title = `${lang === 'id' ? 'Putar musim' : 'Play the season'} · KalenderApi`;
    return () => { document.title = before; };
  }, [lang]);

  // the data file
  const [notBuilt, setNotBuilt] = useState(false);
  useEffect(() => {
    let live = true;
    setError(null);
    getJson<SeasonFile>(dataUrl(year))
      .then((file) => {
        if (!live) return;
        if (!Array.isArray(file.days) || file.days.length === 0) throw new Error('the file has no days');
        const s = prepare(file);
        const want = dateFromHash(window.location.hash);
        const at = want ? s.days.findIndex((d) => d.date === want) : -1;
        setSeason(s);
        setIdx(at >= 0 ? at : 0);
        setPlaying(at < 0 && !reduced);   // a shared link to a day opens paused on it; reduced motion never autoplays
      })
      .catch((e: unknown) => {
        if (!live) return;
        if (e instanceof NotBuilt) setNotBuilt(true);
        else setError(e instanceof Error ? e.message : String(e));
      });
    return () => { live = false; };
  }, [attempt, reduced, year]);

  // the other season years that are built (the year switch in the header)
  const [years, setYears] = useState<number[]>([]);
  useEffect(() => {
    let live = true;
    Promise.all(SEASON_YEARS.map((y) => (y === year ? Promise.resolve(y)
      : fetch(dataUrl(y), { method: 'HEAD' }).then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? y : null)).catch(() => null))))
      .then((ys) => { if (live) setYears(ys.filter((y): y is number => y !== null)); });
    return () => { live = false; };
  }, [year]);

  // the observation-gap layer: its numbers, the district borders, and one small image per day (all 92 load at once, about
  // 0.5 MB). Without it the season still plays, and the foot says the layer is missing.
  const [vis, setVis] = useState<Vis | null>(null);
  const [visErr, setVisErr] = useState<string | null>(null);
  const [showBlind, setShowBlind] = useState(true);
  const visImgs = useRef(new Map<string, HTMLImageElement>());
  const [, setVisTick] = useState(0);
  useEffect(() => {
    let live = true;
    const get = (u: string) => getJson<unknown>(u);
    Promise.all([get(visUrl(year)), get(DISTRICTS_URL)])
      .then((res) => {
        if (!live) return;
        const [file, dist] = res as [VisFile, { districts: { rings: [number, number][][] }[] }];
        if (!Array.isArray(file.days) || !Array.isArray(dist.districts)) throw new Error('unexpected file');
        setVis({ file, byDate: new Map(file.days.map((d) => [d.date, d])), rings: dist.districts.flatMap((x) => x.rings) });
        for (const d of file.days) {
          const img = new Image();
          img.onload = () => { if (live) { visImgs.current.set(d.date, img); setVisTick((v) => v + 1); } };
          img.src = visImgUrl(year, d.date);
        }
      })
      .catch((e: unknown) => {
        if (live) setVisErr(e instanceof NotBuilt ? NOT_BUILT : e instanceof Error ? e.message : String(e));
      });
    return () => { live = false; };
  }, [year]);

  // the 14 district shapes (which district is this point in?) and the districts' ids in the record (the card's links)
  useEffect(() => {
    let live = true;
    getJson<{ districts: { name: string; rings: [number, number][][] }[] }>(DISTRICTS_URL)
      .then((f) => { if (live) setDistricts(f.districts.map((x) => makeDistrict(x.name, x.rings))); })
      .catch((e: unknown) => console.warn('Play the season: the district borders could not be loaded', e));
    getJson<{ districts: { aoi_id: string; name: string; province: string }[] }>(AOI_INDEX_URL)
      .then((f) => { if (live) setAoiIds(new Map(f.districts.filter((x) => x.province === KALTENG_PROVINCE).map((x) => [x.name, x.aoi_id]))); })
      .catch(() => { if (live) setAoiIds('failed'); });
    return () => { live = false; };
  }, []);

  // what the map does with the pointer: the Deck is created once, so it calls the page through this ref
  const act = useRef({ explore: () => {}, click: (_i: PickingInfo) => {}, hover: (_i: PickingInfo) => {} });
  const coarse = useMemo(() => window.matchMedia?.('(pointer: coarse)').matches ?? false, []);
  const lastClick = useRef<[number, number] | null>(null);
  const homeView = useCallback((): ViewS => {
    const f = fitView(root.current);
    return { ...f, minZoom: f.zoom - ZOOM_OUT_ROOM, maxZoom: MAX_ZOOM };
  }, []);
  /** Sends the camera somewhere (the buttons, the keys, "Reset view", the district list): a short glide, inside bounds. */
  const flyTo = useCallback((next: Partial<ViewS>, ms = 280) => {
    const d = deck.current, cur = view.current ?? home.current;
    if (!d || !cur) return;
    const v = boundView({ ...cur, ...next });
    view.current = v;
    nonce.current += 1;   // a new object every time, or deck.gl keeps the camera where it is
    d.setProps({ initialViewState: { ...v, transitionDuration: reduced ? 0 : ms, nonce: nonce.current } as never });
  }, [reduced]);
  const resetView = useCallback(() => {
    const h = homeView();
    home.current = h;
    flyTo(h, 400);
    setMoved(false);
  }, [flyTo, homeView]);
  const zoomBy = useCallback((dz: number) => {
    const cur = view.current;
    if (!cur) return;
    act.current.explore();
    flyTo({ zoom: cur.zoom + dz });
  }, [flyTo]);
  const panBy = useCallback((key: string) => {
    const cur = view.current;
    if (!cur) return;
    const deg = (PAN_PX * 360) / (512 * 2 ** cur.zoom);
    act.current.explore();
    flyTo({
      longitude: cur.longitude + (key === 'ArrowLeft' ? -deg : key === 'ArrowRight' ? deg : 0),
      latitude: cur.latitude + (key === 'ArrowUp' ? deg : key === 'ArrowDown' ? -deg : 0),
    }, 160);
  }, [flyTo]);
  const closeCard = useCallback(() => { setSelPt(null); setSelDist(null); }, []);
  /** The district list (the keyboard's way to a district card): the card opens and the camera goes to the district. */
  const pickDistrict = useCallback((k: number | null) => {
    setPlaying(false);
    setSelPt(null);
    setSelDist(k);
    const d = k === null ? null : districts?.[k];
    if (!d) return;
    const f = fitView(root.current, d.bbox, true);
    const h = home.current;
    flyTo({ longitude: f.longitude, latitude: f.latitude, zoom: h ? Math.min(f.zoom - 0.3, h.zoom + 2.2) : f.zoom }, 500);
    setMoved(true);
  }, [districts, flyTo]);

  // deck.gl, created once
  useEffect(() => {
    if (!box.current) return;
    const h = homeView();
    home.current = h; view.current = h;
    const d = new Deck<MapView>({
      parent: box.current, views: new MapView({ repeat: false }),
      // drag or one finger to pan, wheel, double click or pinch to zoom; no rotation (the tilt stays as set)
      controller: { dragRotate: false, touchRotate: false, keyboard: false, inertia: 250 },
      initialViewState: h, layers: [], style: { position: 'absolute', inset: '0' },
      pickingRadius: coarse ? 14 : 5,
      getCursor: ({ isDragging, isHovering }) => (isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab'),
      onViewStateChange: ({ viewState, interactionState }) => {
        const b = boundView(viewState as unknown as ViewS);
        view.current = b;
        if (interactionState.isDragging || interactionState.isZooming || interactionState.isPanning) act.current.explore();
        // the transition fields deck.gl put in the state stay, so a double click or a flick still glides
        return { ...viewState, longitude: b.longitude, latitude: b.latitude, zoom: b.zoom } as never;
      },
      onClick: (info) => act.current.click(info),
      onHover: (info) => act.current.hover(info),
    });
    deck.current = d;
    const onResize = () => {
      const hv = homeView();
      home.current = hv; view.current = hv;
      d.setProps({ initialViewState: hv });
      setMoved(false);
    };
    window.addEventListener('resize', onResize);
    // a browser may drop a page's WebGL context (for one, when too many maps were opened in one tab): say so plainly
    const host = box.current;
    const onLost = () => setGlLost(true);
    host.addEventListener('webglcontextlost', onLost, true);
    return () => {
      window.removeEventListener('resize', onResize); host.removeEventListener('webglcontextlost', onLost, true);
      d.finalize(); deck.current = null;
    };
  }, [coarse, homeView]);

  // the data arrived and the panel and the dock took their real size: fit the camera to the room left for the map once
  // (not on every day, so the camera never jumps while the season plays)
  useEffect(() => {
    if (!season) return;
    const raf = requestAnimationFrame(() => {
      const hv = homeView();
      home.current = hv; view.current = hv;
      deck.current?.setProps({ initialViewState: hv });
    });
    return () => cancelAnimationFrame(raf);
  }, [season, homeView]);

  // exploring (a drag, a zoom) pauses the play; a click picks the hotspot under it, or the district under it
  act.current.explore = () => {
    if (playingRef.current) setPlaying(false);
    setMoved(true);
    setHover(null);
  };
  act.current.click = (info) => {
    const date = PTS_LAYER.exec(info.layer?.id ?? '')?.[1];
    if (playingRef.current) setPlaying(false);
    setHover(null);
    const c = info.coordinate;
    if (date && info.object) {
      const p = info.object as Pt;
      lastClick.current = [p[0], p[1]];
      setSelPt({ date, p });
      const k = districts ? districtAt(districts, p[0], p[1]) : -1;
      setSelDist(k >= 0 ? k : null);
      return;
    }
    const k = c && districts ? districtAt(districts, c[0]!, c[1]!) : -1;
    lastClick.current = c && k >= 0 ? [c[0]!, c[1]!] : null;
    setSelPt(null);
    setSelDist(k >= 0 ? k : null);
  };
  act.current.hover = (info) => {
    if (coarse) return;   // a touch screen has no hover: a tap opens the card
    const date = PTS_LAYER.exec(info.layer?.id ?? '')?.[1];
    if (date && info.object) {
      const p = info.object as Pt;
      setHover((h) => (h && h.p === p && Math.abs(h.x - info.x) < 3 && Math.abs(h.y - info.y) < 3 ? h : { x: info.x, y: info.y, date, p }));
    } else setHover((h) => (h ? null : h));
  };

  const onPhotoLoad = useCallback((date: string) => {
    let fn = onLoadFns.current.get(date);
    if (!fn) {
      fn = () => { if (!loaded.current.has(date)) { loaded.current.add(date); setLoadedTick((v) => v + 1); } };
      onLoadFns.current.set(date, fn);
    }
    return fn;
  }, []);
  // a tile that fails is said once per day in the console (it then counts as loaded: that part of the ground stays dark)
  const onErrFns = useRef(new Map<string, (e: unknown) => void>());
  const onPhotoError = useCallback((date: string) => {
    let fn = onErrFns.current.get(date);
    if (!fn) {
      let told = false;
      fn = (e: unknown) => { if (!told) { told = true; console.warn(`Play the season: a NASA GIBS tile of ${date} failed`, e); } };
      onErrFns.current.set(date, fn);
    }
    return fn;
  }, []);
  const kick = useRef<PhotoKick & { date: string }>({ date: '', ...NO_KICK });
  const [photoFail, setPhotoFail] = useState<string | null>(null);
  const [glLost, setGlLost] = useState(false);
  // '#/season?d=2019-09-15&debug=1': a readout of where the photo of the day shown stands (for a browser where it fails)
  const debug = useMemo(() => /[?&]debug=1\b/.test(window.location.hash), []);
  const [dbg, setDbg] = useState('');

  /** Puts the layers of the current day on the map (and the photo of the day before, while it fades out). */
  const draw = useCallback(() => {
    const d = deck.current;
    if (!d || !season) return;
    const i = idxRef.current;
    const days = season.days;
    const day = days[i];
    if (!day) return;
    const f = fade.current;
    const p = f.from ? Math.min(1, (performance.now() - f.start) / Math.max(1, f.dur)) : 1;
    const col = (colors.current ??= readSeasonColors());
    const layers: Layer[] = [];
    // on a large screen, photo tiles one zoom level below the screen's: a quarter of the tiles, so a day's photo
    // arrives in time for the next frame
    const zo = window.innerWidth * window.innerHeight > 0.9e6 ? -1 : 0;
    // paused, the day shown loads alone first; the next two days follow once it is in
    const ahead = playingRef.current ? Math.max(2, Math.ceil(speedRef.current * PREFETCH_S))
      : loaded.current.has(day.date) ? 2 : 0;
    const [w, s, e, n] = season.file.bbox;
    const ext: [number, number, number, number] = [w - PHOTO_MARGIN, s - PHOTO_MARGIN, e + PHOTO_MARGIN, n + PHOTO_MARGIN];
    const lay = (date: string, opacity: number, k?: PhotoKick) => photoLayer(date, opacity, onPhotoLoad(date), onPhotoError(date), zo, ext, k);
    for (let k = ahead; k >= 1; k--) {
      const next = days[i + k];
      if (next && next.date !== f.from) layers.push(lay(next.date, 0));
    }
    layers.push(lay(day.date, 1, kick.current.date === day.date ? kick.current : NO_KICK));
    if (f.from && f.from !== day.date && p < 1) layers.push(lay(f.from, 1 - p));
    // the day's land with no cloud-free look (hatching) and no data (dots), only once that day's own image is in
    if (vis) {
      const img = visImgs.current.get(day.date);
      if (img) {
        layers.push(new BitmapLayer({
          id: 'blind', image: img, bounds: vis.file.grid.bbox, visible: showBlind, parameters: FLAT,
          tintColor: mix(col.modis, col.text, 0.35),   // the cloud map is MODIS: the MODIS blue (token --ka-modis)
          textureParameters: { minFilter: 'linear', magFilter: 'nearest' },
        }));
      }
      layers.push(new PathLayer<[number, number][]>({
        id: 'districts', data: vis.rings, getPath: (x) => x, getColor: rgba(col.text3, 120), getWidth: 1,
        widthUnits: 'pixels', parameters: FLAT,
      }));
    }
    const picked = selDist !== null ? districts?.[selDist] : undefined;
    if (picked) {
      layers.push(new PathLayer<[number, number][]>({
        id: 'district-picked', data: picked.rings, getPath: (x) => x, getColor: rgba(col.accent, 255), getWidth: 2.5,
        widthUnits: 'pixels', jointRounded: true, parameters: FLAT,
      }));
    }
    layers.push(new PathLayer<[number, number][]>({
      id: 'bbox', data: [[[w, s], [e, s], [e, n], [w, n], [w, s]]], getPath: (x) => x,
      getColor: rgba(col.text3, 70), getWidth: 1, widthUnits: 'pixels', parameters: FLAT,
    }));
    for (let age = TRAIL; age >= 1; age--) {
      const past = days[i - age];
      if (past && past.pts.length) layers.push(dayLayer(past, age, col));
    }
    layers.push(new ScatterplotLayer<Pt>({
      id: `halo-${day.date}`, data: day.pts, getPosition: ptPos, getRadius: ptRadius, getFillColor: rgba(col.viirs, 14),
      radiusUnits: 'pixels', radiusScale: 2.4, filled: true, stroked: false, parameters: ADDITIVE,
    }));
    layers.push(dayLayer(day, 0, col));
    layers.push(new ScatterplotLayer<Pt>({
      id: `re-${day.date}`, data: season.rePts[i] ?? [], getPosition: ptPos, getRadius: ringRadius,
      getLineColor: rgba(col.text, 235), radiusUnits: 'pixels', filled: false, stroked: true,
      lineWidthUnits: 'pixels', getLineWidth: 1.2, lineWidthMinPixels: 1, parameters: FLAT,
    }));
    if (selPt && selPt.date === day.date) {
      layers.push(new ScatterplotLayer<Pt>({
        id: 'picked-pt', data: [selPt.p], getPosition: ptPos, getRadius: (x) => ptRadius(x) + 7,
        getLineColor: rgba(col.accent, 255), radiusUnits: 'pixels', filled: false, stroked: true,
        lineWidthUnits: 'pixels', getLineWidth: 2.5, parameters: FLAT,
      }));
    }
    layers.push(new TextLayer<(typeof PLACES)[number]>({
      id: 'places', data: PLACES, getPosition: (x) => x.p, getText: (x) => x.name,
      getSize: 12, getColor: rgba(col.text, 215), getPixelOffset: [0, -12],
      fontFamily: 'Public Sans Variable, system-ui, sans-serif', fontWeight: 600,
      fontSettings: { sdf: true }, outlineWidth: 3, outlineColor: rgba(col.bg, 220), parameters: FLAT,
    }));
    layers.push(new ScatterplotLayer<(typeof PLACES)[number]>({
      id: 'place-dots', data: PLACES, getPosition: (x) => x.p, getRadius: 2.5, radiusUnits: 'pixels',
      getFillColor: rgba(col.text, 200), parameters: FLAT,
    }));
    d.setProps({ layers });
  }, [season, onPhotoLoad, onPhotoError, vis, showBlind, districts, selDist, selPt]);

  // a new day: start the crossfade of the photos (not under reduced motion), then draw
  const shown = useRef<string | null>(null);
  useEffect(() => {
    const day = season?.days[idx];
    if (!day) return;
    const prev = shown.current;
    shown.current = day.date;
    if (prev && prev !== day.date && !reduced) {
      fade.current = { from: prev, start: performance.now(), dur: playing ? Math.min(250, frameMs * 0.9) : 250 };
      let raf = 0;
      const tick = () => {
        draw();
        if (performance.now() - fade.current.start < fade.current.dur) raf = requestAnimationFrame(tick);
        else { fade.current.from = null; draw(); }
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
    fade.current.from = null;
    draw();
    return undefined;
  }, [idx, season, draw, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  // play or a new speed: widen (or narrow) the photos loaded ahead at once
  // (and once the day shown has its photo: the next days start loading)
  const curDate = season?.days[idx]?.date ?? null;
  const curReady = curDate ? loaded.current.has(curDate) : false;
  const curVis = curDate ? visImgs.current.has(curDate) : false;
  useEffect(() => { draw(); }, [playing, speed, draw, curReady, curVis]);

  // a hotspot belongs to its day: another day closes its card (the district card stays, and shows the new day)
  useEffect(() => {
    setHover(null);
    setSelPt((x) => (x && x.date !== curDate ? null : x));
  }, [curDate]);
  // the card opened over what was clicked (a phone's card covers the south of the map): slide the map so it shows
  useEffect(() => {
    const c = lastClick.current;
    lastClick.current = null;
    const el = cardRef.current, cur = view.current;
    if (!c || !el || !cur) return;   // (a click came from a drawn map, so deck.gl has its viewport by now)
    const vp = deck.current?.getViewports()[0];
    if (!vp) return;
    const [px, py] = vp.project(c) as [number, number];
    const r = el.getBoundingClientRect();
    if (px < r.left - 16 || px > r.right + 16 || py < r.top - 16 || py > r.bottom + 16) return;
    const wide = window.innerWidth >= 900;
    const hud = root.current?.querySelector('.ka-season-hud')?.getBoundingClientRect();
    const tx = wide ? ((hud?.right ?? 0) + r.left) / 2 : window.innerWidth / 2;
    const ty = wide ? py : ((hud?.bottom ?? 0) + r.top) / 2;
    const at = vp.unproject([tx, ty]) as [number, number];
    flyTo({ longitude: cur.longitude + (c[0] - at[0]), latitude: cur.latitude + (c[1] - at[1]) }, 320);
    setMoved(true);
  }, [selDist, selPt, flyTo]);

  // the watchdog: a day shown whose photo has not come (paused, or the clock gave up waiting) gets its layer pushed
  // every PHOTO_KICK_MS, its tiles fetched again after PHOTO_RETRY_MS, and after PHOTO_RETRIES a plain "did not come".
  // While the season plays, a day lasts less than PHOTO_KICK_MS, so none of this runs.
  useEffect(() => {
    if (!curDate || curReady) return;
    const start = performance.now();
    const iv = window.setInterval(() => {
      if (loaded.current.has(curDate)) { window.clearInterval(iv); return; }
      if (kick.current.date !== curDate) kick.current = { date: curDate, ...NO_KICK };
      const k = kick.current;
      const waited = performance.now() - start;
      k.nudge += 1;
      if (k.retry < PHOTO_RETRIES && waited > PHOTO_RETRY_MS * (k.retry + 1)) {
        k.retry += 1;
        console.warn(`Play the season: the photo of ${curDate} is not in after ${Math.round(waited / 1000)} s (${tileReport(deck.current, curDate)}); asking again`);
      }
      else if (k.retry >= PHOTO_RETRIES && waited > PHOTO_RETRY_MS * (PHOTO_RETRIES + 1)) {
        setPhotoFail(curDate);
        window.clearInterval(iv);
      }
      draw();
    }, PHOTO_KICK_MS);
    return () => window.clearInterval(iv);
  }, [curDate, curReady, draw]);

  // the debug readout (only with debug=1): frames the browser draws, the camera, and each stage of the day's photo
  useEffect(() => {
    if (!debug) return;
    let frames = 0, raf = 0;
    const count = () => { frames += 1; raf = requestAnimationFrame(count); };
    raf = requestAnimationFrame(count);
    const iv = window.setInterval(() => {
      const date = season?.days[idxRef.current]?.date ?? '-';
      const vp = deck.current?.getViewports()[0];
      const gibs = performance.getEntriesByType('resource').filter((r) => r.name.includes('gibs') && r.name.includes(`/${date}/`)).length;
      setDbg([
        `code ${DEBUG_MARK}`,
        `page ${window.innerWidth}x${window.innerHeight}, dpr ${window.devicePixelRatio}, hidden ${document.hidden}, frames/s ${frames}`,
        `camera zoom ${vp ? vp.zoom.toFixed(2) : '-'} (${vp ? `${vp.width}x${vp.height}` : 'no viewport yet'}), WebGL lost ${glLostRef.current}`,
        `photo ${date}: ${tileReport(deck.current, date)}`,
        `GIBS responses for ${date}: ${gibs}; ready flag ${loaded.current.has(date)}`,
      ].join('\n'));
      frames = 0;
    }, 1000);
    return () => { cancelAnimationFrame(raf); window.clearInterval(iv); };
  }, [debug, season]);
  const glLostRef = useRef(false);
  glLostRef.current = glLost;

  // frames: is the browser drawing this page at all? (see NO_FRAME_MS)
  const [noFrames, setNoFrames] = useState(false);
  useEffect(() => {
    let last = performance.now(), raf = 0;
    const tick = (t: number) => { last = t; raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    const iv = window.setInterval(() => {
      const stuck = performance.now() - last > NO_FRAME_MS;
      setNoFrames((v) => (v === stuck ? v : stuck));
    }, 1000);
    return () => { cancelAnimationFrame(raf); window.clearInterval(iv); };
  }, []);

  // the clock: one day per frame; it waits (up to MAX_PHOTO_WAIT) for the next day's photo
  useEffect(() => {
    if (!playing || !season) return;
    let raf = 0, waitFrom = 0;
    let last = performance.now() + (idxRef.current === 0 ? 500 : 0);
    const tick = (now: number) => {
      const cur = idxRef.current;
      if (cur >= season.days.length - 1) { setPlaying(false); return; }
      if (now - last >= frameMs) {
        const next = season.days[cur + 1]!.date;
        if (!loaded.current.has(next) && !waitFrom) waitFrom = now;
        if (loaded.current.has(next) || now - waitFrom > MAX_PHOTO_WAIT) {
          idxRef.current = cur + 1;
          setIdx(cur + 1);
          last = now; waitFrom = 0;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, season, frameMs]);

  // the address keeps the day while paused ('#/season?d=2019-09-15'); replaceState fires no hashchange
  useEffect(() => {
    const day = season?.days[idx];
    if (!day || playing) return;
    const want = dayHash(year, day.date, debug);
    if (window.location.hash !== want) window.history.replaceState(null, '', want);
  }, [idx, playing, season, debug, year]);
  useEffect(() => {
    if (!season) return;
    const onHash = () => {
      const d = dateFromHash(window.location.hash);
      const at = d ? season.days.findIndex((x) => x.date === d) : -1;
      if (at >= 0) { setPlaying(false); setIdx(at); }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [season]);

  const last = season ? season.days.length - 1 : 0;
  const go = useCallback((i: number) => { setPlaying(false); setIdx(Math.max(0, Math.min(last, i))); }, [last]);
  const toggle = useCallback(() => {
    if (!season) return;
    setPlaying((p) => {
      if (!p && idxRef.current >= last) setIdx(0);   // at the end: play again from the first day
      return !p;
    });
  }, [season, last]);

  // keys: Space plays or pauses (also on a focused button: Enter still presses it), arrows step one day
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (t?.closest('summary, a, input, textarea, select')) return;
      if (e.key === ' ') {
        e.preventDefault();
        if (e.type === 'keydown' && !e.repeat) toggle();
      } else if (e.type === 'keydown') {
        // the map: Shift + arrows pan, + and - zoom, 0 resets the view, Escape closes the card
        if (e.shiftKey && e.key.startsWith('Arrow')) { e.preventDefault(); panBy(e.key); }
        else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(ZOOM_STEP); }
        else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomBy(-ZOOM_STEP); }
        else if (e.key === '0') { e.preventDefault(); resetView(); }
        else if (e.key === 'Escape') closeCard();
        else if (e.key === 'ArrowLeft') { e.preventDefault(); go(idxRef.current - 1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); go(idxRef.current + 1); }
        else if (e.key === 'Home') { e.preventDefault(); go(0); }
        else if (e.key === 'End') { e.preventDefault(); go(last); }
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); };
  }, [toggle, go, last, panBy, zoomBy, resetView, closeCard]);

  const day = season?.days[idx];
  const n = day?.pts.length ?? 0;
  const rToday = season?.rePts[idx]?.length ?? 0;
  const rSoFar = season?.cumRe[idx] ?? 0;
  const when = day ? parts(day.date, lang) : null;
  const vd = vis && day ? vis.byDate.get(day.date) ?? null : null;
  const seasonBlind = vis?.file.season.blind ?? null;
  const lines = season && day ? captions(season, idx, vd, tr, lang) : [];
  const to = tr('to', 'sampai');
  const augOct = `${monthName(8, lang)} ${to} ${monthName(10, lang)}`;          // "Aug to Oct"
  const kalteng = tr('Central Kalimantan', 'Kalimantan Tengah');
  const seasonSpan = `1 ${monthName(8, lang)} ${to} 31 ${monthName(10, lang)} ${year}`;
  const noLook = tr('Under cloud all day', 'Tertutup awan seharian');
  const na = tr('n/a', 't.a.');
  const photoReady = day ? loaded.current.has(day.date) : false;
  const src = season?.file.source;

  // the cards: every number comes from the loaded files (the hotspots drawn, the MODIS cloud map's own district counts)
  const picked = selDist !== null ? districts?.[selDist] ?? null : null;
  const distCounts = useMemo(() => (season && picked ? countByDay(picked, season.days) : null), [season, picked]);
  let districtView: DistrictView | null = null;
  if (picked && day && distCounts) {
    const vk = vis ? vis.file.districts.findIndex((x) => x.name === picked.name) : -1;
    const c = vd && vk >= 0 ? vd.d[vk] : undefined;
    // 2019 is held for a registered test: the hotspots on screen are counted, the district's cloud share is not shown
    const cloud: Cloud = year === LOCKED_YEAR ? { kind: 'locked' }
      : !c ? { kind: 'missing' }
        : c[0] + c[1] > 0 ? { kind: 'share', pct: (100 * c[1]) / (c[0] + c[1]) } : { kind: 'nodata' };
    districtView = {
      name: picked.name, date: day.date, year, today: distCounts.day[idx] ?? 0, soFar: distCounts.soFar[idx] ?? 0, cloud,
      aoiId: aoiIds instanceof Map ? aoiIds.get(picked.name) ?? null : null,
      aoiFailed: aoiIds === 'failed' || (aoiIds instanceof Map && !aoiIds.has(picked.name)),
      zero: picked.name === ZERO_DISTRICT,
    };
  }
  const hot = selPt && day && selPt.date === day.date ? hotspotOf(selPt.p, day, districts, lang) : null;
  const tip = hover && day && hover.date === day.date && hover.p !== selPt?.p ? hotspotOf(hover.p, day, districts, lang) : null;
  const order = useMemo(() => (districts ?? []).map((d, k) => ({ k, name: d.name })).sort((a, b) => a.name.localeCompare(b.name)), [districts]);

  // narrow screens: the caption shows two lines, with "More" for the rest; the sources fold under one link
  // (season.css clamps them only below 900 px wide, so the map keeps most of a small screen)
  const [capOpen, setCapOpen] = useState(false);
  const [capMore, setCapMore] = useState(false);
  const [srcOpen, setSrcOpen] = useState(false);
  const capRef = useRef<HTMLDivElement>(null);
  const capKey = lines.join('\n');
  useLayoutEffect(() => {
    const el = capRef.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    // "More" also opens the table by district (narrow screens show it only then)
    const more = capOpen || !!vis || el.childElementCount > 1 || (!!first && first.scrollHeight > first.clientHeight + 1);
    setCapMore((v) => (v === more ? v : more));
  }, [capKey, capOpen, vis]);

  return (
    <div ref={root} className="ka-season">
      <div ref={box} className="ka-season-canvas" aria-hidden="true" />
      {noFrames && season && day ? (
        <img className="ka-season-still" src={stillUrl(day.date, [season.file.bbox[0] - PHOTO_MARGIN, season.file.bbox[1] - PHOTO_MARGIN,
          season.file.bbox[2] + PHOTO_MARGIN, season.file.bbox[3] + PHOTO_MARGIN])}
          alt={tr(`A still NASA ${photoName(day.date)} true-colour photo of Central Kalimantan on ${day.date}`,
            `Foto diam warna asli NASA ${photoName(day.date)} atas Kalimantan Tengah pada ${day.date}`)} />
      ) : null}
      <div className="ka-season-vignette" />
      {debug ? <pre className="ka-season-debug" aria-hidden="true">{dbg || 'debug: waiting for the first second'}</pre> : null}
      <header className="ka-season-top">
        <a className="ka-season-brand" href="#/home">KalenderApi</a>
        <span className="ka-season-tag">{tr('Play the season', 'Putar musim')} . {kalteng} . {seasonSpan}</span>
        <nav className="ka-season-links" aria-label={tr('Pages', 'Halaman')}>
          {/* the other season years that are built, then the record of Central Kalimantan, the story and the home page */}
          {years.length > 1 ? years.map((y) => (
            <a key={y} href={y === 2019 ? '#/season' : `#/season?y=${y}`} aria-current={y === year ? 'page' : undefined}
              className="ka-season-year">{y}</a>
          )) : null}
          <a href={`#/record?aoi=${KALTENG_AOI}&m=${year}-09`}>{tr('Record', 'Rekaman')}</a>
          <a href="#/story">{tr('Story', 'Cerita')}</a>
          <a href="#/home">{tr('Home', 'Beranda')}</a>
        </nav>
        <LangToggle className="ka-season-lang" />
      </header>

      <section className="ka-season-hud" aria-label={tr('The day shown', 'Hari yang ditampilkan')}>
        {notBuilt ? (
          <div className="ka-season-error" role="status">
            <p className="ka-season-kicker">{kalteng} . {seasonSpan}</p>
            <p>{tr(`The ${year} season is not built yet: its hotspot file is still being made by the data run.`,
              `Musim ${year} belum tersedia: berkas titik panasnya masih dibuat.`)}</p>
            <p>
              {years.filter((y) => y !== year).map((y) => (
                <a key={y} href={y === 2019 ? '#/season' : `#/season?y=${y}`} style={{ marginRight: 12 }}>{tr(`Play ${y} instead`, `Putar ${y} saja`)}</a>
              ))}
              <a href={`#/record?aoi=${KALTENG_AOI}`}>{tr('Central Kalimantan in the record', 'Kalimantan Tengah dalam rekaman')}</a>
            </p>
          </div>
        ) : error ? (
          <div className="ka-season-error" role="alert">
            <p>{tr('The season data file could not be loaded', 'Berkas data musim gagal dimuat')} ({error}).</p>
            <button type="button" className="ka-btn-ghost" onClick={() => setAttempt((a) => a + 1)}>{tr('Try again', 'Coba lagi')}</button>
          </div>
        ) : !season || !day || !when ? (
          <p className="ka-season-kicker" role="status">{tr('Loading the season\'s hotspots...', 'Memuat titik panas musim ini...')}</p>
        ) : (
          <>
            <p className="ka-season-kicker">{when.month} {when.year} . {tr(`day ${idx + 1} of ${season.days.length}`, `hari ${idx + 1} dari ${season.days.length}`)}</p>
            <h1 className="ka-season-date"><time dateTime={day.date}>{day.date}</time></h1>
            <p className="ka-season-weekday">{when.weekday}<span className="ka-season-short"> . {tr('one day of data', 'satu hari data')}</span> (UTC)</p>
            <dl className="ka-season-stats">
              <div className="ka-season-stat-fire">
                <dt>{tr('VIIRS hotspots', 'Titik panas VIIRS')}<span className="ka-season-wide"> {tr('this day', 'hari ini')}</span></dt>
                <dd>{fmt(n, lang)}</dd>
              </div>
              <div className="ka-season-stat-re">
                <dt>{tr('Re-appeared', 'Muncul lagi')}<span className="ka-season-wide"> {tr('after a gap', 'setelah jeda')}</span><span className="ka-season-narrow"> {tr('so far', 'sejauh ini')}</span></dt>
                <dd>{fmt(rSoFar, lang)} <small>{tr('season so far', 'sejak awal musim')}{rToday ? `, ${fmt(rToday, lang)} ${tr('today', 'hari ini')}` : ''}</small></dd>
              </div>
              {vd ? (
                <div className="ka-season-stat-blind">
                  <dt><span className="ka-sw ka-sw-blind" aria-hidden="true" />{noLook}</dt>
                  <dd>{vd.blind === null ? na : pct1(vd.blind, lang)} <small>{augOct} {seasonBlind === null ? na : pct1(seasonBlind, lang)}</small></dd>
                </div>
              ) : null}
            </dl>
            {/* the smoke note, said once, where the share is shown */}
            {vd ? (
              <p className="ka-season-note">
                {tr('Cloud map: MODIS (Terra and Aqua). Thick smoke is usually not flagged as cloud, so the true unseen share can be higher.',
                  'Peta awan: MODIS (Terra dan Aqua). Asap tebal biasanya tidak ditandai sebagai awan, jadi bagian yang sebenarnya tidak terlihat bisa lebih besar.')}
              </p>
            ) : null}
            <div className="ka-season-capwrap">
              <div ref={capRef} id="ka-season-caption" className={`ka-season-caption${capOpen ? ' is-open' : ''}`} aria-live={playing ? 'off' : 'polite'}>
                {lines.map((l) => <p key={l}>{l}</p>)}
              </div>
              <button type="button" className="ka-season-more" aria-expanded={capOpen} aria-controls="ka-season-caption"
                style={{ visibility: capMore ? 'visible' : 'hidden' }} onClick={() => setCapOpen((v) => !v)}>{capOpen ? tr('Less', 'Ringkas') : tr('More', 'Lainnya')}</button>
            </div>
            {vis ? (
              <details className="ka-season-dist">
                <summary>{tr('Under cloud all day, by district', 'Tertutup awan seharian, per kabupaten/kota')}</summary>
                <table>
                  <thead><tr><th scope="col">{tr('District', 'Kabupaten/kota')}</th><th scope="col">{day.date.slice(5)}</th><th scope="col">{augOct}</th></tr></thead>
                  <tbody>
                    {vis.file.districts.map((dd, k) => {
                      const c = vd?.d[k];
                      const z = c ? c[0] + c[1] : 0;
                      return (
                        <tr key={dd.name}>
                          <th scope="row">{dd.name}</th>
                          <td>{c && z ? pct1((100 * c[1]) / z, lang) : na}</td>
                          <td>{dd.blind === null ? na : pct1(dd.blind, lang)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row">{kalteng}</th>
                      <td>{vd?.blind == null ? na : pct1(vd.blind, lang)}</td>
                      <td>{seasonBlind === null ? na : pct1(seasonBlind, lang)}</td>
                    </tr>
                  </tfoot>
                </table>
                <p>{tr('Of each district\'s land with no fire detected, the share under cloud all day for both Terra and Aqua (MODIS). It does not estimate fire under cloud.',
                  'Dari lahan tanpa deteksi api di tiap kabupaten/kota, bagian yang tertutup awan seharian bagi Terra maupun Aqua (MODIS). Ini bukan perkiraan api di bawah awan.')}</p>
              </details>
            ) : null}
            <ul className="ka-season-legend">
              <li><span className="ka-sw ka-sw-today" aria-hidden="true" />{tr('VIIRS hotspot this day (Suomi NPP, 375 m; bigger: more radiative power)', 'Titik panas VIIRS hari ini (Suomi NPP, 375 m; lebih besar: daya lebih tinggi)')}</li>
              <li><span className="ka-sw ka-sw-ghost" aria-hidden="true" />{tr(`VIIRS hotspots of the previous ${TRAIL} days, fading`, `Titik panas VIIRS ${TRAIL} hari sebelumnya, memudar`)}</li>
              <li><span className="ka-sw ka-sw-ring" aria-hidden="true" />{tr('Re-appeared after a gap of 2 or more days', 'Muncul lagi setelah jeda 2 hari atau lebih')}</li>
              {vis ? (
                <>
                  <li><span className="ka-sw ka-sw-blind" aria-hidden="true" />{tr('Under cloud all day: the satellite could not see (MODIS Terra and Aqua)', 'Tertutup awan seharian: satelit tidak bisa melihat (MODIS Terra dan Aqua)')}</li>
                  <li><span className="ka-sw ka-sw-nodata" aria-hidden="true" />{tr('No data: no usable MODIS look (Terra or Aqua)', 'Tanpa data: MODIS (Terra dan Aqua) tidak dapat dipakai')}</li>
                </>
              ) : null}
              {districts ? <li><span className="ka-sw ka-sw-dist" aria-hidden="true" />{tr('District border: click inside for the district card', 'Batas kabupaten/kota: klik di dalamnya untuk kartu kabupaten/kota')}</li> : null}
              <li><span className="ka-sw ka-sw-box" aria-hidden="true" />{tr('Data area: a box, not the province border', 'Area data: sebuah kotak, bukan batas provinsi')}</li>
            </ul>
          </>
        )}
      </section>

      {season && day ? (
        <div className="ka-season-map">
          <div className="ka-season-tools">
            <div className="ka-season-zoom" role="group" aria-label={tr('Map view', 'Tampilan peta')}>
              <button type="button" aria-label={tr('Zoom out', 'Perkecil peta')} aria-keyshortcuts="-" onClick={() => zoomBy(-ZOOM_STEP)}>&minus;</button>
              <button type="button" aria-label={tr('Zoom in', 'Perbesar peta')} aria-keyshortcuts="+" onClick={() => zoomBy(ZOOM_STEP)}>+</button>
              <button type="button" className="ka-season-reset" aria-keyshortcuts="0" disabled={!moved} onClick={resetView}>{tr('Reset view', 'Atur ulang tampilan')}</button>
            </div>
            {districts ? (
              <label className="ka-season-pick">
                <span>{tr('District card', 'Kartu kabupaten/kota')}</span>
                <select value={selDist ?? ''} onChange={(e) => pickDistrict(e.target.value === '' ? null : Number(e.target.value))}>
                  <option value="">{tr('Choose a district', 'Pilih kabupaten/kota')}</option>
                  {order.map((o) => <option key={o.k} value={o.k}>{o.name}</option>)}
                </select>
              </label>
            ) : null}
            {!hot && !districtView ? (
              <p className="ka-season-tap">
                {playing ? tr('Pause, then click a hotspot or a district.', 'Jeda, lalu klik titik panas atau kabupaten/kota.')
                  : tr('Click a hotspot or a district. Drag to move the map, scroll or pinch to zoom.',
                    'Klik titik panas atau kabupaten/kota. Seret untuk menggeser peta, gulir atau cubit untuk memperbesar.')}
              </p>
            ) : null}
          </div>
          {hot || districtView ? (
            <aside ref={cardRef} className="ka-season-card" aria-label={tr('What you picked on the map', 'Yang Anda pilih di peta')} aria-live={playing ? 'off' : 'polite'}>
              <button type="button" className="ka-season-card-close" aria-label={tr('Close the card', 'Tutup kartu')} onClick={closeCard}>&times;</button>
              {hot ? <HotspotCard h={hot} tr={tr} lang={lang} /> : null}
              {districtView ? <DistrictCard d={districtView} tr={tr} lang={lang} /> : null}
            </aside>
          ) : null}
        </div>
      ) : null}
      {tip && hover ? <HoverTip x={hover.x} y={hover.y} h={tip} tr={tr} lang={lang} /> : null}

      <section className="ka-season-dock" aria-label={tr('Playback', 'Pemutaran')}>
        <div className="ka-season-controls">
          <button type="button" className="ka-season-step" aria-label={tr('Previous day', 'Hari sebelumnya')} disabled={!season || idx === 0} onClick={() => go(idx - 1)}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" className="ka-season-play" aria-label={playing ? tr('Pause', 'Jeda') : idx >= last && season ? tr('Play again from 1 August', 'Putar lagi dari 1 Agustus') : tr('Play', 'Putar')}
            aria-keyshortcuts="Space" disabled={!season} onClick={toggle}>
            {playing ? (
              <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="2.5" width="3" height="11" rx="0.8" /><rect x="9.5" y="2.5" width="3" height="11" rx="0.8" /></svg>
            ) : (
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.6v10.8a.6.6 0 0 0 .9.5l8.6-5.4a.6.6 0 0 0 0-1L5.4 2.1a.6.6 0 0 0-.9.5z" /></svg>
            )}
          </button>
          <button type="button" className="ka-season-step" aria-label={tr('Next day', 'Hari berikutnya')} disabled={!season || idx >= last} onClick={() => go(idx + 1)}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="ka-season-speed" role="group" aria-label={tr('Speed, in days per second', 'Kecepatan, dalam hari per detik')}>
            <span className="ka-season-speedlab" aria-hidden="true">
              <span className="ka-season-wide">{tr('Days per second', 'Hari per detik')}</span><span className="ka-season-narrow">{tr('days/s', 'hari/dtk')}</span>
            </span>
            {SPEEDS.map((s) => (
              <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)}
                aria-label={tr(`${s} ${s === 1 ? 'day' : 'days'} per second`, `${s} hari per detik`)}>{s}</button>
            ))}
          </div>
          {vis ? (
            <button type="button" className="ka-season-blindbtn" aria-pressed={showBlind} onClick={() => setShowBlind((v) => !v)}>
              <span className="ka-sw ka-sw-blind" aria-hidden="true" /><span className="ka-season-blindtxt">{noLook}</span>
            </button>
          ) : null}
          {glLost ? (
            <span className="ka-season-status" role="alert">{tr('The browser dropped this page\'s map graphics (WebGL), which happens after many maps in one tab. Reload the page.',
              'Peramban menghentikan grafik peta halaman ini (WebGL); ini terjadi setelah banyak peta dibuka dalam satu tab. Muat ulang halaman.')}</span>
          ) : noFrames && season && day ? (
            <span className="ka-season-status" role="status">{tr(`A still NASA photo of ${day.date}: the animated map is not being drawn right now, so the hotspots are not on it.`,
              `Foto diam NASA ${day.date}: peta animasi sedang tidak digambar, jadi titik panas tidak tampil di atasnya.`)}</span>
          ) : season && day && !photoReady ? (
            <span className="ka-season-status" role="status">
              {photoFail === day.date
                ? tr(`The NASA photo of ${day.date} did not come (asked ${PHOTO_RETRIES + 1} times); the hotspots are shown without it.`,
                  `Foto NASA ${day.date} tidak datang (diminta ${PHOTO_RETRIES + 1} kali); titik panas ditampilkan tanpa foto.`)
                : tr(`Loading the photo of ${day.date}...`, `Memuat foto ${day.date}...`)}
            </span>
          ) : null}
          <span className="ka-season-hint" aria-hidden="true"><kbd>{tr('Space', 'Spasi')}</kbd> {tr('play', 'putar')} . <kbd>&larr;</kbd><kbd>&rarr;</kbd> {tr('one day', 'satu hari')}<span className="ka-season-hint-more"> . <kbd>Shift</kbd>+<kbd>&larr;</kbd><kbd>&rarr;</kbd> {tr('move the map', 'geser peta')} . <kbd>+</kbd><kbd>&minus;</kbd> {tr('zoom', 'perbesar')}</span></span>
        </div>
        {season ? <Scrubber season={season} idx={idx} onPick={go} tr={tr} lang={lang} /> : <div className="ka-season-scrub ka-season-scrub-empty" />}
        <div className={`ka-season-foot${srcOpen ? ' is-open' : ''}`}>
          <span>{tr('Each frame is one day of satellite data.', 'Setiap bingkai adalah satu hari data satelit.')}<span className="ka-season-short"> {tr('Nothing is drawn between days.', 'Tidak ada yang digambar di antara hari.')}</span></span>{' '}
          <button type="button" className="ka-season-src" aria-expanded={srcOpen} aria-controls="ka-season-foot-body"
            onClick={() => setSrcOpen((v) => !v)}>{srcOpen ? tr('Hide sources', 'Sembunyikan sumber') : tr('Sources and method', 'Sumber dan metode')}</button>
          <div id="ka-season-foot-body" className="ka-season-foot-body">
            {tr('Hotspots: NASA FIRMS VIIRS S-NPP 375 m.', 'Titik panas: NASA FIRMS VIIRS S-NPP 375 m.')}{' '}
            {tr(`Imagery: NASA GIBS / Worldview (${photoName(season?.days[0]?.date ?? `${year}-08-01`)} true colour of the same day; black wedges are gaps between passes${year < 2016 ? '; GIBS has VIIRS true colour only from 24 November 2015' : ''}).`,
              `Citra: NASA GIBS / Worldview (warna asli ${photoName(season?.days[0]?.date ?? `${year}-08-01`)} pada hari yang sama; baji hitam adalah celah antar lintasan${year < 2016 ? '; GIBS baru memiliki warna asli VIIRS sejak 24 November 2015' : ''}).`)}
            {vis ? (
              <> {tr(`Cloud map (under cloud all day): NASA MODIS Terra and Aqua daily fire mask (MOD14A1, MYD14A1 C6.1) via Microsoft Planetary Computer, read ${vis.file.source.firemask.read_utc.slice(0, 10)}. Districts: geoBoundaries (BPS, WFP, OCHA ROAP), ${vis.file.source.districts.license}.`,
                `Peta awan (tertutup awan seharian): masker api harian NASA MODIS Terra dan Aqua (MOD14A1, MYD14A1 C6.1) melalui Microsoft Planetary Computer, dibaca ${vis.file.source.firemask.read_utc.slice(0, 10)}. Kabupaten/kota: geoBoundaries (BPS, WFP, OCHA ROAP), ${vis.file.source.districts.license}.`)}</>
            ) : visErr ? (
              <> {tr('The cloud layer could not be loaded', 'Lapisan awan gagal dimuat')} ({visErr === NOT_BUILT ? tr(`not built yet for ${year}`, `belum tersedia untuk ${year}`) : visErr}).</>
            ) : null}
            {src ? (
              <> {tr(`Data file: ${fmt(season?.kept ?? 0, lang)} hotspots kept of ${fmt(src.rows_total, lang)} rows in the FIRMS ${year} Indonesia archive${season && season.kept !== src.rows_kept ? ' (the file\'s own count differs)' : ''}.`,
                `Berkas data: ${fmt(season?.kept ?? 0, lang)} titik panas dipakai dari ${fmt(src.rows_total, lang)} baris arsip FIRMS Indonesia ${year}${season && season.kept !== src.rows_kept ? ' (hitungan berkas itu sendiri berbeda)' : ''}.`)}</>
            ) : null}
            {season ? (
              <details className="ka-season-rule">
                <summary>{tr('How "re-appeared after a gap" is counted', 'Cara menghitung "muncul lagi setelah jeda"')}</summary>
                {lang === 'id' ? <span>Sebuah titik panas dihitung muncul lagi bila titik terdekat sebelumnya di sekitarnya terlihat beberapa hari lebih awal, tanpa titik di antaranya. Ini menandai jeda dalam rekaman, bukan sebabnya. Aturan lengkap dari berkas data (bahasa Inggris): </span> : null}
                <span lang="en">{season.file.reappear_rule}</span> <span lang="en">Filter: {season.file.source.filter_text}</span>
              </details>
            ) : null}
            {vis ? (
              <details className="ka-season-rule">
                <summary>{tr('How "under cloud all day" is counted', 'Cara menghitung "tertutup awan seharian"')}</summary>
                <span>{tr(
                  'Each cell is 0.01 degree (about 1.1 km) and takes the class of the MODIS 1 km pixel at its centre. A cell with no fire detected that day (no MODIS fire class, and no VIIRS hotspot shown on the map) has a cloud-free look when Terra or Aqua classed it as cloud-free land at least once that day, and no cloud-free look when neither did and at least one classed it as cloud. No data: neither had a usable look. The fire mask is a daily composite of every pass, day and night, so one cloud-free pass is enough. Share = cells with no cloud-free look out of all no-fire cells with either class. Only cells inside the 14 districts are counted; cells that are mostly water are left out. The mask is MODIS only: it says nothing about what VIIRS could see, and a cloud-free look is not proof that nothing burned.',
                  'Setiap sel berukuran 0,01 derajat (sekitar 1,1 km) dan mengambil kelas piksel MODIS 1 km di pusatnya. Sel tanpa deteksi api pada hari itu (tanpa kelas api MODIS, dan tanpa titik panas VIIRS yang tampil di peta) punya pandangan bebas awan bila Terra atau Aqua mengelaskannya sebagai daratan bebas awan setidaknya sekali pada hari itu, dan tanpa pandangan bebas awan bila keduanya tidak, sementara setidaknya satu mengelaskannya sebagai awan. Tanpa data: keduanya tidak punya pengamatan yang dapat dipakai. Masker api adalah komposit harian dari semua lintasan, siang dan malam, sehingga satu lintasan bebas awan sudah cukup. Bagian = sel tanpa pandangan bebas awan dari semua sel tanpa api yang punya salah satu kelas itu. Hanya sel di dalam 14 kabupaten/kota yang dihitung; sel yang sebagian besar berupa air tidak diikutkan. Masker ini hanya MODIS: tidak menyatakan apa pun tentang yang dapat dilihat VIIRS, dan pandangan bebas awan bukan bukti bahwa tidak ada yang terbakar.')}</span>
              </details>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

/** The captions of a day, from the data only. */
function captions(s: Season, i: number, v: VisDay | null, tr: Tr, lang: Lang): string[] {
  const day = s.days[i]!;
  const n = day.pts.length;
  const r = s.rePts[i]?.length ?? 0;
  const prev = s.days.slice(Math.max(0, i - TRAIL), i).map((d) => d.pts.length);
  const peak = prev.length ? Math.max(...prev) : 0;
  const out: string[] = [];
  // the share of the land with no fire detected that had no cloud-free look from Terra or Aqua (cloud only). A low
  // share never reads as "the view was clear": on a day full of smoke it is near zero, and the caption says why.
  const blind = v?.blind ?? null;
  if (v && blind !== null) {
    out.push(blind >= BLIND_NOTE
      ? tr(`${pct1(blind, lang)} of the land with no fire detected was under cloud all day (hatched): the satellite could not see it. This is not an estimate of fire under cloud.`,
        `${pct1(blind, lang)} lahan tanpa deteksi api tertutup awan seharian (berarsir): satelit tidak bisa melihatnya. Ini bukan perkiraan api di bawah awan.`)
      : tr(`${pct1(blind, lang)} of the land with no fire detected was under cloud all day. Smoke is not part of this count.`,
        `${pct1(blind, lang)} lahan tanpa deteksi api tertutup awan seharian. Asap tidak termasuk dalam hitungan ini.`));
  }
  if (prev.length && n < LOW_SHARE * peak) {
    out.push(tr(`Hotspots detected: ${fmt(n, lang)} (${fmt(peak, lang)} on the busiest of the ${TRAIL} days before).`,
      `Titik panas terdeteksi: ${fmt(n, lang)} (${fmt(peak, lang)} pada hari tersibuk dari ${TRAIL} hari sebelumnya).`)
      + (blind === null ? tr(' Look at the photo: where cloud or smoke covers the ground, a low count may only mean the ground was not seen.',
        ' Lihat fotonya: di lahan yang tertutup awan atau asap, hitungan rendah bisa hanya berarti daratan tidak terlihat.') : ''));
  }
  if (r > 0) {
    out.push(tr(`${fmt(r, lang)} hotspots re-appeared near where they were last detected, after 2 or more days with none.`,
      `${fmt(r, lang)} titik panas muncul lagi di dekat lokasi deteksi terakhirnya, setelah 2 hari atau lebih tanpa deteksi.`));
  }
  if (!out.length) {
    const w = parts(day.date, lang);
    out.push(tr(`${w.month} ${w.year} in Central Kalimantan: ${fmt(n, lang)} hotspots detected this day.`,
      `${w.month} ${w.year} di Kalimantan Tengah: ${fmt(n, lang)} titik panas terdeteksi hari ini.`));
  }
  return out;
}

/** The camera: the data box fills the room the page leaves for the map, measured from the page itself: right of the
 *  panel and above the dock on wide screens, between the panel and the dock on narrow ones. */
function fitView(page: HTMLElement | null, bounds: [number, number, number, number] = BOX, forCard = false) {
  const width = Math.max(320, window.innerWidth), height = Math.max(320, window.innerHeight);
  const wide = width >= 900;
  const rect = (sel: string) => page?.querySelector(sel)?.getBoundingClientRect() ?? null;
  const top = rect('.ka-season-top'), hud = rect('.ka-season-hud'), dock = rect('.ka-season-dock');
  const dockH = dock ? height - dock.top : height * (wide ? 0.26 : 0.3);
  const padding = wide
    ? { top: (top?.bottom ?? 60) + 12, bottom: dockH + 12, left: (hud?.right ?? Math.min(400, width * 0.3)) + 24, right: 40 }
    : { top: (hud?.bottom ?? height * 0.3) + 8, bottom: dockH + 8, left: 12, right: 12 };
  // a short window: never ask for less than 140 px of map (the dots then run under the panels' edges)
  // a district picked from the list: leave room for its card (right of the map on wide screens, over its foot on narrow)
  if (forCard) { if (wide) padding.right += 350; else padding.bottom += Math.round(height * 0.36); }
  const spareH = height - padding.top - padding.bottom - 140;
  if (spareH < 0) { padding.top = Math.max(8, padding.top + spareH / 2); padding.bottom = Math.max(8, padding.bottom + spareH / 2); }
  const spareW = width - padding.left - padding.right - 160;
  if (spareW < 0) padding.left = Math.max(12, padding.left + spareW);
  const [w, s, e, n] = bounds;
  const fit = new WebMercatorViewport({ width, height }).fitBounds([[w, s], [e, n]], { padding });
  // the tilt pushes the north edge away: pull back a little so the whole box stays in view (in proportion to its height)
  const tilt = (0.25 * (n - s)) / (BOX[3] - BOX[1]);
  return { longitude: fit.longitude, latitude: fit.latitude - tilt, zoom: fit.zoom - 0.12, pitch: PITCH, bearing: BEARING };
}
/** The camera stays near the data box and inside its zoom range. */
function boundView(v: ViewS): ViewS {
  return {
    longitude: clamp(v.longitude, BOX[0] - PAN_ROOM, BOX[2] + PAN_ROOM), latitude: clamp(v.latitude, BOX[1] - PAN_ROOM, BOX[3] + PAN_ROOM),
    zoom: clamp(v.zoom, v.minZoom, v.maxZoom), pitch: v.pitch, bearing: v.bearing, minZoom: v.minZoom, maxZoom: v.maxZoom,
  };
}
/** What the hotspot card says about a point of the day on screen. */
function hotspotOf(p: Pt, day: Day, districts: District[] | null, lang: Lang): Hotspot {
  const lower = day.pts.reduce((a, q) => a + (q[2] < p[2] ? 1 : 0), 0);
  const k = districts ? districtAt(districts, p[0], p[1]) : -1;
  return {
    date: day.date, weekday: parts(day.date, lang).weekday, lon: p[0], lat: p[1], frp: p[2], night: p[3] === 1,
    below: day.pts.length > 1 ? Math.round((100 * lower) / day.pts.length) : null, nDay: day.pts.length,
    district: districts ? (k >= 0 ? districts[k]!.name : null) : undefined,
  };
}

// ------------------------------------------------------------------------------------------------ scrubber

/** Bars of the daily counts for every day (clickable, draggable); the current day stands out. */
function Scrubber({ season, idx, onPick, tr, lang }: { season: Season; idx: number; onPick: (i: number) => void; tr: Tr; lang: Lang }) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [hover, setHover] = useState<number | null>(null);
  const days = season.days;
  const W = 4, G = 1.4, H = 48;
  const width = days.length * (W + G) - G;
  const at = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || r.width <= 0) return 0;
    return Math.max(0, Math.min(days.length - 1, Math.floor(((clientX - r.left) / r.width) * days.length)));
  };
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    onPick(at(e.clientX));
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const i = at(e.clientX);
    setHover(i);
    if (dragging.current) onPick(i);
  };
  const up = () => { dragging.current = false; };
  const months = days.map((d, i) => ({ d, i })).filter(({ d }) => d.date.endsWith('-01'));
  const peak = days[season.maxAt]!;
  const show = hover ?? idx;
  const shownDay = days[show]!;
  return (
    <div className="ka-season-scrubwrap">
      <div className="ka-season-scrub-read" aria-hidden="true">
        <span><b>{shownDay.date}</b> {fmt(shownDay.pts.length, lang)} {tr('hotspots', 'titik panas')}{season.rePts[show]?.length ? `, ${fmt(season.rePts[show]!.length, lang)} ${tr('re-appeared', 'muncul lagi')}` : ''}</span>
        <span>{tr(`Largest day: ${fmt(season.max, lang)} on ${peak.date}`, `Hari terbesar: ${fmt(season.max, lang)} pada ${peak.date}`)}</span>
      </div>
      <div ref={ref} className="ka-season-scrub" role="slider" tabIndex={0} aria-label={tr('Day of the season', 'Hari dalam musim')}
        aria-valuemin={1} aria-valuemax={days.length} aria-valuenow={idx + 1}
        aria-valuetext={`${days[idx]!.date}: ${fmt(days[idx]!.pts.length, lang)} ${tr('hotspots', 'titik panas')}`}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${width} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" x2={width} y1={H - 0.5} y2={H - 0.5} className="ka-season-base" />
          {days.map((d, i) => {
            const h = d.pts.length > 0 ? Math.max(1, (d.pts.length / season.max) * (H - 2)) : 0;
            return <rect key={d.date} x={i * (W + G)} y={H - h} width={W} height={h}
              className={i === idx ? 'is-cur' : i < idx ? 'is-past' : 'is-next'} />;
          })}
          <rect x={idx * (W + G) - 0.7} y="0" width={W + 1.4} height={H} className="ka-season-head" />
        </svg>
      </div>
      <div className="ka-season-axis" aria-hidden="true">
        {months.map(({ d, i }) => (
          <span key={d.date} style={{ left: `${(i / days.length) * 100}%` }}>{monthName(Number(d.date.slice(5, 7)), lang)}</span>
        ))}
      </div>
    </div>
  );
}
