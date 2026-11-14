// KalenderApi (new file, not from Fire Harmony): the cinematic landing "Under the Smoke".
// Real data only, at the size the satellites measure it: NASA FIRMS VIIRS 375 m hotspots as points (the same file as
// "Play the season"), the blind zeros of one day as hatching on a 0.01 degree grid (NASA MODIS Terra and Aqua daily
// FireMask, built by kalenderapi/scripts/build_visibility.py), the 14 district borders, and NASA GIBS Suomi NPP VIIRS
// true-colour photos of the days shown. No hexagons here: a level 4 hexagon is about 1,800 km2, larger than many
// sub-districts, and its height counted hotspots, which read as burned area. Nothing is interpolated or invented.
// Project 4 (modification): two beats come first, "the jump" and "the fix", with numbers computed from Second Sight's
// harmonized bundle (public/ss-data/, lib/record.ts) and a chart of Indonesia's yearly record over the map. Without the
// bundle (not built yet, or a file that failed) the story starts at Central Kalimantan exactly as before.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Deck, FlyToInterpolator, MapView, WebMercatorViewport, type Layer } from '@deck.gl/core';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer, PathLayer, ScatterplotLayer } from '@deck.gl/layers';
import { NATIONAL, SEAM_YEAR, beforeAfter, fmt1, loadIndex, loadMonthly, sensorRatio, type BeforeAfter } from '../lib/record';

const BASE = import.meta.env.BASE_URL;
const SEASON_URL = `${BASE}ka-data/kalteng_2019_season.json`;
const VIS_URL = `${BASE}ka-data/visibility_kalteng_2019.json`;
const DISTRICTS_URL = `${BASE}ka-data/kalteng_districts.json`;
const visImgUrl = (date: string) => `${BASE}ka-data/vis2019/${date}.png`;

const CLEAR_DAY = '2019-08-12';
const SMOKY_DAY = '2019-09-15';
// Until the blind-zero file is in, the blindest day when the file was built (62.3% on 15 Oct 2019); once it is in,
// the page takes the day with the highest blind share from the file itself.
const BLIND_FALLBACK = '2019-10-15';
const FAR = { longitude: 116, latitude: -1, zoom: 3.4, pitch: 0, bearing: 0 };
const PITCH = 30, BEARING = -8;
const PHOTO_LAYER = 'VIIRS_SNPP_CorrectedReflectance_TrueColor';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type Pt = [number, number, number, number];   // lon, lat, frp (MW), isNight
interface SeasonDay { date: string; n: number; pts: Pt[] }
interface SeasonFile { bbox: [number, number, number, number]; source: { rows_kept: number }; days: SeasonDay[] }
interface VisDay { date: string; T: number; U: number }
interface VisFile { grid: { bbox: [number, number, number, number] }; days: VisDay[] }
interface Data {
  bbox: [number, number, number, number];
  aug: SeasonDay[]; augFlat: Pt[]; augCum: number[];
  byDate: Map<string, SeasonDay>; kept: number;
}
interface Vis { gridBbox: [number, number, number, number]; blindDay: string; rings: [number, number][][]; n: Record<string, string> }
/** The jump and the fix, for Indonesia as a whole (Second Sight's national record). */
interface Intro { ba: BeforeAfter; ratio: number; from: number; to: number; n: Record<string, string> }

const ADDITIVE = {
  blend: true, blendColorOperation: 'add', blendColorSrcFactor: 'src-alpha', blendColorDstFactor: 'one',
  blendAlphaOperation: 'add', blendAlphaSrcFactor: 'one', blendAlphaDstFactor: 'one-minus-src-alpha',
  depthCompare: 'always', depthWriteEnabled: false,
} as const;
const FLAT = { depthCompare: 'always', depthWriteEnabled: false } as const;

const ptPos = (p: Pt) => [p[0], p[1]] as [number, number];
const ptRadius = (p: Pt) => Math.min(7, 1.8 + Math.sqrt(Math.max(0, p[2])) * 0.38);
/** Hotter (higher fire radiative power) is paler, as on the Season page. */
function ember(p: Pt): [number, number, number, number] {
  const t = Math.max(0, Math.min(1, Math.log10(Math.max(0, p[2]) + 1) / 2.4));
  return [Math.round(236 + 19 * t), Math.round(92 + 132 * t), Math.round(32 + 118 * t), 210];
}

function gibs(date: string, id: string, opacity: number) {
  return new TileLayer({
    id, opacity,
    data: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${PHOTO_LAYER}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    minZoom: 0, maxZoom: 9, tileSize: 256,
    renderSubLayers: (props) => {
      const { boundingBox } = props.tile as unknown as { boundingBox: [[number, number], [number, number]] };
      return new BitmapLayer(props, {
        data: undefined, image: props.data as never, tintColor: [205, 214, 212],
        bounds: [boundingBox[0][0], boundingBox[0][1], boundingBox[1][0], boundingBox[1][1]],
      });
    },
  });
}

function longDate(date: string) {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1] ?? ''} ${y}`;
}
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
/** A share in %, one decimal: blind shares round as the Season page does; a clear share rounds down (99.96 is
 *  "99.9%", never "100.0%"). */
const pctRound = (part: number, whole: number) => `${(Math.round((1000 * part) / whole) / 10).toFixed(1)}%`;
const pctDown = (part: number, whole: number) => `${(Math.floor((1000 * part) / whole) / 10).toFixed(1)}%`;

// When each beat starts (s), and how long August takes to play, one real day per step. With the bundle in, the two
// intro beats come first and every later beat starts INTRO seconds later.
const T_AUG = 3.2, AUG_DUR = 4, T_SMOKE = 7.6, T_BLIND = 11.6, T_END_BEAT = 15.4;
const END = 18;
const T_FIX = 5.2, INTRO = 10.8;

interface Beat { t: number; title: string; body: string; alt?: string }
const INTRO_BEATS: Beat[] = [
  { t: 0, title: '2012. A sharper satellite, and fire seems to jump.',
    body: 'When VIIRS joined MODIS, it counted {k}× as many fire cell-days over Indonesia in the same months ({from} to {to}). Stitched together as recorded, Indonesia\'s fire record {nv} {nc} (mean of 2019 to 2023 against 2003 to 2007).' },
  { t: T_FIX, title: 'The fix: one scale for both satellites.',
    body: 'Second Sight puts VIIRS on the Aqua MODIS scale, with a 90% range. On that one scale, fire {hv} {hc} over the same years.{why}' },
];
const BEATS: Beat[] = [
  { t: 0, title: 'Central Kalimantan, Indonesia.', body: 'Peat country on Borneo. August to October 2019, one real day at a time, from NASA satellites.' },
  { t: T_AUG, title: 'August 2019. The satellites see the fires.', body: '{a} VIIRS hotspots in August. Each dot is a 375 m pixel that was burning when Suomi NPP passed over.' },
  { t: T_SMOKE, title: 'September 2019. Smoke fills the sky.',
    body: '{s} hotspots on 15 September. Smoke covers the photo, yet Terra and Aqua saw clear ground on {c} of the land where no fire was detected: smoke that thin does not count as cloud.',
    alt: '{s} hotspots on 15 September. The photo shows smoke over much of the peat: where the ground is hidden, a low count does not mean nothing burned.' },
  { t: T_BLIND, title: '{B}. Cloud hides the ground.',
    body: 'Hatched land had no fire detected, but Terra and Aqua never saw the ground there. That was {y} of the no-fire land that day. Those zeros are blind.',
    alt: 'Under cloud, a satellite sees no fire because it sees no ground. A zero there is not a measurement.' },
  { t: T_END_BEAT, title: 'A zero is not always a zero.',
    body: 'From August to October 2019, Terra and Aqua never saw clear ground on {x} of Central Kalimantan\'s no-fire cell-days ({sep} in September, {oct} in October). KalenderApi shows which zeros those were, day by day and district by district.',
    alt: 'Under smoke or cloud, a zero can mean the ground was hidden. KalenderApi puts each day\'s NASA photo under that day\'s hotspots, so you can see where.' },
];

function prepare(file: SeasonFile): Data {
  const aug = file.days.filter((d) => d.date.startsWith('2019-08'));
  const augFlat: Pt[] = []; const augCum: number[] = [];
  for (const d of aug) { augFlat.push(...d.pts); augCum.push(augFlat.length); }
  return { bbox: file.bbox, aug, augFlat, augCum, byDate: new Map(file.days.map((d) => [d.date, d])), kept: file.source.rows_kept };
}

function visNumbers(file: VisFile): Omit<Vis, 'rings'> | null {
  const days = file.days;
  const sum = (keep: (d: string) => boolean) => days.filter((d) => keep(d.date)).reduce((s, d) => [s[0]! + d.T, s[1]! + d.U], [0, 0]);
  const share = ([t, u]: number[]) => pctRound(u!, t! + u!);
  const smoky = sum((d) => d === SMOKY_DAY);
  let best: VisDay | null = null;
  for (const d of days) if (d.T + d.U > 0 && (!best || d.U / (d.T + d.U) > best.U / (best.T + best.U))) best = d;
  if (!best || smoky[0]! + smoky[1]! === 0) return null;
  return {
    gridBbox: file.grid.bbox, blindDay: best.date,
    n: {
      x: share(sum(() => true)), sep: share(sum((d) => d.startsWith('2019-09'))), oct: share(sum((d) => d.startsWith('2019-10'))),
      c: pctDown(smoky[0]!, smoky[0]! + smoky[1]!), y: pctRound(best.U, best.T + best.U),
    },
  };
}

/** The intro's numbers from Indonesia's monthly record, or null when the record cannot say them. */
function introNumbers(rows: Parameters<typeof beforeAfter>[0], window_: [number, number]): Intro | null {
  const ba = beforeAfter(rows);
  const r = sensorRatio(rows, window_);
  if (!ba || ba.changeNaive == null || ba.changeH == null || !r) return null;
  const n = ba.changeNaive, h = ba.changeH;
  const why = n > 0 && h <= 0 ? ' The rise came from the change of satellite, not from more fire.'
    : n > 0 && h < n / 2 ? ' Most of the rise came from the change of satellite.' : '';
  return {
    ba, ratio: r.ratio, from: r.from, to: r.to,
    n: {
      k: fmt1(r.ratio), from: String(r.from), to: String(r.to),
      nv: n >= 0 ? 'rises' : 'falls', nc: `${fmt(Math.abs(n))}%`, hv: h >= 0 ? 'rises' : 'falls', hc: `${fmt(Math.abs(h))}%`, why,
    },
  };
}

/** The camera that fits the data box into the room the caption leaves (right of it on wide screens, above it on narrow). */
function nearView(bbox: [number, number, number, number]) {
  const w = window.innerWidth, h = window.innerHeight;
  const wide = w >= 900;
  const padding = wide
    ? { left: Math.min(600, w * 0.42), right: 40, top: 90, bottom: 70 }
    : { left: 16, right: 16, top: 80, bottom: Math.round(h * 0.45) };
  try {
    const v = new WebMercatorViewport({ width: w, height: h }).fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding });
    return { longitude: v.longitude, latitude: v.latitude, zoom: v.zoom - 0.1, pitch: PITCH, bearing: BEARING };
  } catch {
    return { longitude: 113.3, latitude: -1.35, zoom: 6, pitch: PITCH, bearing: BEARING };
  }
}

export function Story() {
  const box = useRef<HTMLDivElement>(null);
  const deck = useRef<Deck<MapView> | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [vis, setVis] = useState<Vis | null>(null);
  // the jump and the fix: undefined while the bundle is asked for, null when it is not there (the story then starts at
  // Central Kalimantan, as before)
  const [intro, setIntro] = useState<Intro | null | undefined>(undefined);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const reduced = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, []);

  // the VIIRS hotspots of Central Kalimantan, Aug to Oct 2019
  useEffect(() => {
    let live = true;
    fetch(SEASON_URL)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<SeasonFile>; })
      .then((f) => { if (live) setData(prepare(f)); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);

  // what Terra and Aqua could see (blind zeros) and the district borders; without them the beats keep their "alt"
  useEffect(() => {
    let live = true;
    const get = <T,>(u: string) => fetch(u).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<T>; });
    Promise.all([get<VisFile>(VIS_URL), get<{ districts: { rings: [number, number][][] }[] }>(DISTRICTS_URL)])
      .then(([file, dist]) => {
        const n = visNumbers(file);
        if (live && n) setVis({ ...n, rings: dist.districts.flatMap((x) => x.rings) });
      })
      .catch(() => { /* the beats fall back to their "alt" text */ });
    return () => { live = false; };
  }, []);

  // project 4: Indonesia's record from the Second Sight bundle (the jump and the fix)
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

  const blindDay = vis?.blindDay ?? BLIND_FALLBACK;
  const off = intro ? INTRO : 0;          // every beat after the intro starts this much later
  const end = END + off;
  const tl = t - off;                      // the time of the Central Kalimantan beats
  const ready = !!data && intro !== undefined;

  // the clock (it starts once the hotspots are in and the bundle has answered, so the beats never shift)
  useEffect(() => {
    if (reduced) { if (ready) setT(end); return; }
    if (!playing || !ready) return;
    let raf = 0; const start = performance.now() - t * 1000;
    const tick = (now: number) => {
      const s = (now - start) / 1000;
      setT(Math.min(s, end));
      if (s < end) raf = requestAnimationFrame(tick); else setPlaying(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, ready, reduced, end]); // eslint-disable-line react-hooks/exhaustive-deps

  // deck.gl, created once
  useEffect(() => {
    if (!box.current) return;
    const d = new Deck<MapView>({
      parent: box.current, views: new MapView({ repeat: false }), controller: false,
      initialViewState: FAR, layers: [],
      style: { position: 'absolute', inset: '0' },
    });
    deck.current = d;
    return () => { d.finalize(); deck.current = null; };
  }, []);

  // camera: fly in 0.4 s into Central Kalimantan's first beat, then a slow turn
  const near = useMemo(() => data ? nearView(data.bbox) : null, [data]);
  const flown = useRef(false);
  useEffect(() => {
    const d = deck.current;
    if (!d || !near) return;
    if (reduced) { d.setProps({ initialViewState: near }); return; }
    if (tl > 0.4 && !flown.current) {
      flown.current = true;
      d.setProps({ initialViewState: { ...near, transitionDuration: 2800, transitionInterpolator: new FlyToInterpolator({ speed: 1.4 }) } });
    }
    if (tl >= 3.4) d.setProps({ initialViewState: { ...near, bearing: BEARING + (tl - 3.4) * 0.9 } });
  }, [tl, near, reduced]);

  // August, one real day per step
  const augIdx = data ? Math.max(0, Math.min(data.aug.length - 1, Math.floor(((tl - T_AUG) / AUG_DUR) * data.aug.length))) : 0;
  const augPast = useMemo(() => data ? data.augFlat.slice(0, augIdx > 0 ? data.augCum[augIdx - 1] : 0) : [], [data, augIdx]);

  // layers for the current time
  useEffect(() => {
    const d = deck.current;
    if (!d || !data) return;
    const grow = (from: number, dur: number) => Math.max(0, Math.min(1, (tl - from) / dur));
    const augOn = grow(T_AUG, 0.4) * (1 - grow(T_SMOKE - 0.3, 0.8));
    const smoke = grow(T_SMOKE - 0.3, 1.2);
    const blind = grow(T_BLIND - 0.3, 1.2);
    const smokyPts = data.byDate.get(SMOKY_DAY)?.pts ?? [];
    const blindPts = data.byDate.get(blindDay)?.pts ?? [];
    const layers: Layer[] = [
      gibs(CLEAR_DAY, 'clear', 1 - smoke * 0.999),
      gibs(SMOKY_DAY, 'smoky', smoke * (1 - blind * 0.999)),
      gibs(blindDay, 'blindphoto', blind),
    ];
    if (vis) {
      layers.push(new BitmapLayer({
        id: 'blind', image: visImgUrl(vis.blindDay), bounds: vis.gridBbox, opacity: blind, parameters: FLAT,
        textureParameters: { minFilter: 'linear', magFilter: 'nearest' },
      }));
      layers.push(new PathLayer<[number, number][]>({
        id: 'districts', data: vis.rings, getPath: (x) => x, getColor: [214, 228, 224, 90], getWidth: 1,
        widthUnits: 'pixels', opacity: Math.max(grow(T_AUG, 1), blind), parameters: FLAT,
      }));
    }
    const dots = (id: string, pts: Pt[], opacity: number, ghost = false) => new ScatterplotLayer<Pt>({
      id, data: pts, getPosition: ptPos, getRadius: ptRadius,
      getFillColor: ghost ? [190, 70, 30, 120] : ember,
      radiusUnits: 'pixels', radiusScale: ghost ? 0.6 : 1, opacity, visible: opacity > 0.001,
      filled: true, stroked: false, antialiasing: true, parameters: ADDITIVE,
    });
    layers.push(
      dots('aug-past', augPast, augOn * 0.8, true),
      dots('aug-today', data.aug[augIdx]?.pts ?? [], augOn),
      dots('smoky-day', smokyPts, smoke * (1 - blind)),
      dots('blind-day', blindPts, blind),
    );
    d.setProps({ layers });
  }, [tl, data, vis, blindDay, augIdx, augPast]);

  const inIntro = !!intro && t < INTRO;
  const all: Beat[] = intro ? [...INTRO_BEATS, ...BEATS.map((b) => ({ ...b, t: b.t + INTRO }))] : BEATS;
  const beat = [...all].reverse().find((b) => t >= b.t) ?? all[0]!;
  const text = !vis && beat.alt ? beat.alt : beat.body;
  const subs: Record<string, string> = {
    ...(vis?.n ?? {}),
    ...(intro?.n ?? {}),
    a: data ? fmt(data.aug.reduce((s, x) => s + x.n, 0)) : '',
    s: data ? fmt(data.byDate.get(SMOKY_DAY)?.n ?? 0) : '',
    B: longDate(blindDay),
  };
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (m, k: string) => subs[k] ?? m);
  const title = fill(beat.title);
  const body = fill(text);
  const done = t >= end;
  const stamp = !data || inIntro ? '' : tl < T_AUG ? '' : tl < T_SMOKE ? `1 August to ${longDate(data.aug[augIdx]?.date ?? CLEAR_DAY)}`
    : tl < T_BLIND ? longDate(SMOKY_DAY) : longDate(blindDay);
  const photoDay = !data ? '' : tl < T_SMOKE ? longDate(CLEAR_DAY) : tl < T_BLIND ? longDate(SMOKY_DAY) : longDate(blindDay);
  const loadingText = failed ? 'The hotspot file did not load.' : !ready ? 'Loading real satellite data...' : null;

  return (
    <div className="ka-story">
      <div ref={box} className="ka-story-canvas" aria-hidden="true" />
      <div className="ka-story-vignette" />
      {intro ? <IntroChart intro={intro} t={t} /> : null}
      <header className="ka-story-top">
        <a className="ka-story-brand" href="#/record">KalenderApi</a>
        <span className="ka-story-tag">Indonesian for "fire calendar" . NASA Space Apps 2026</span>
        <a className="ka-story-skip" href="#/record">Skip story</a>
      </header>
      {stamp && (
        <div className="ka-story-stamp" aria-hidden="true">
          <span>Hotspots {stamp}</span>
          <span>Photo {photoDay}</span>
          {tl >= T_BLIND && vis ? <span><i className="ka-story-hatch" /> blind zero</span> : null}
        </div>
      )}
      <section className="ka-story-copy" aria-live="polite">
        <p className="ka-story-kicker">{done ? 'How much can you trust a zero?' : `${all.indexOf(beat) + 1} / ${all.length}`}</p>
        <h1 key={title}>{title}</h1>
        <p key={body} className="ka-story-body">{loadingText ?? body}</p>
        {done && (
          <div className="ka-story-cta">
            <a className="ka-btn-primary" href="#/season">Play the season</a>
            <a className="ka-btn-ghost" style={{ textDecoration: 'none' }} href="#/record?aoi=prov-kalimantan-tengah">Indonesia record</a>
            <a className="ka-btn-ghost" style={{ textDecoration: 'none' }} href="#/?area=state:IDN-1931&month=201909">Blind zeros by district</a>
            <button type="button" className="ka-btn-ghost" onClick={() => { flown.current = false; deck.current?.setProps({ initialViewState: FAR }); setT(0); setPlaying(true); }}>Replay</button>
          </div>
        )}
      </section>
      <footer className="ka-story-foot">
        {inIntro ? (
          <>
            <span className="ka-story-foot-long">Lines: fire cell-days over Indonesia a year (0.01 degree cells with a hotspot on a local date), each indexed to its
              own 2003 to 2011 mean. Raw: NASA FIRMS MODIS C6.1 to 2011, VIIRS 375 m from 2012. Harmonized: Second Sight (MIT),
              Aqua MODIS scale, band = 90% range. Photo: NASA GIBS / Worldview, Suomi NPP VIIRS true colour, {longDate(CLEAR_DAY)}.</span>
            <span className="ka-story-foot-short">NASA FIRMS MODIS and VIIRS, harmonized by Second Sight (MIT). Photo: NASA GIBS, {longDate(CLEAR_DAY)}.</span>
          </>
        ) : (
          <>Dots: NASA FIRMS VIIRS S-NPP 375 m hotspots{data ? ` (${fmt(data.kept)} in the Central Kalimantan box, Aug to Oct 2019)` : ''}.
            Hatching: blind zeros, land with no fire detected that Terra and Aqua saw only under cloud (NASA MODIS MOD14A1 and MYD14A1 C6.1 daily FireMask, 0.01 degree grid).
            Lines: district borders (geoBoundaries, CC BY 3.0 IGO). Imagery: NASA GIBS / Worldview, Suomi NPP VIIRS true colour.</>
        )}
      </footer>
      <div className="ka-story-progress" style={{ width: `${(t / end) * 100}%` }} />
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ the intro chart

const CW = 560, CH = 300, PAD = { l: 48, r: 140, t: 24, b: 30 };

/** Indonesia's yearly record over the map during the intro: the raw record drawn first (the jump), then the
 *  harmonized line and its 90% band (the fix). Each line indexed to its own 2003-2011 mean, as on the record page. */
function IntroChart({ intro, t }: { intro: Intro; t: number }) {
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
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const drawRaw = clamp((t - 0.6) / 3.2);
  const drawHarm = clamp((t - T_FIX - 0.3) / 3);
  const rawDim = 1 - 0.55 * clamp((t - T_FIX) / 0.8);
  const shown = clamp(t / 0.5) * (1 - clamp((t - INTRO + 0.7) / 0.6));
  if (shown <= 0) return null;
  const { x, y, last } = geo;
  return (
    <figure className="ka-story-chart" style={{ opacity: shown }} aria-hidden="true">
      <svg viewBox={`0 0 ${CW} ${CH}`} role="presentation">
        {geo.ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={CW - PAD.r} y1={y(v)} y2={y(v)} className={v === 100 ? 'ka-sc-base' : 'ka-sc-grid'} />
            <text x={PAD.l - 8} y={y(v) + 4} className="ka-sc-tick" textAnchor="end">{v}</text>
          </g>
        ))}
        {[geo.x0, SEAM_YEAR, geo.x1].map((yr) => <text key={yr} x={x(yr)} y={CH - 8} className="ka-sc-tick" textAnchor="middle">{yr}</text>)}
        <line x1={x(SEAM_YEAR)} x2={x(SEAM_YEAR)} y1={PAD.t - 6} y2={CH - PAD.b} className="ka-sc-seam" />
        <text x={x(SEAM_YEAR) + 6} y={PAD.t + 4} className="ka-sc-seamtext">2012: VIIRS joins</text>
        <path d={geo.band} className="ka-sc-band" style={{ opacity: drawHarm }} />
        <path d={geo.raw} className="ka-sc-raw" pathLength={1} style={{ strokeDasharray: 1, strokeDashoffset: 1 - drawRaw, opacity: rawDim }} />
        <path d={geo.harm} className="ka-sc-harm" pathLength={1} style={{ strokeDasharray: 1, strokeDashoffset: 1 - drawHarm }} />
        {last ? (
          <>
            <text x={x(last.year) + 8} y={y(last.naive) + 4} className="ka-sc-lab ka-sc-lab-raw" style={{ opacity: drawRaw >= 1 ? rawDim : 0 }}>Raw, stitched</text>
            <text x={x(last.year) + 8} y={y(last.H) + 4} className="ka-sc-lab ka-sc-lab-harm" style={{ opacity: drawHarm >= 1 ? 1 : 0 }}>Harmonized</text>
          </>
        ) : null}
      </svg>
      <figcaption>Indonesia, fire cell-days a year, 2003 to 2011 = 100</figcaption>
    </figure>
  );
}
