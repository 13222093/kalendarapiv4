// From KalenderApi v1.1 (the team's own build): the zero inspector (#/zero), ported into the main build.
// One district, one day: every 1 km cell as fire detected (F), trusted zero (T), untrusted zero (U) or no data (N),
// from the NASA daily FireMask, drawn over that day's NASA GIBS true-colour photo, with a strip of days.
// The rule (v1.1 pipeline, kapi/states.py and kapi/firemask.py), per cell and day, over the satellites that have data:
//   F: at least one satellite's daily FireMask is a fire class (7, 8, 9), or a FIRMS point falls in the cell;
//   T: not F, and at least k satellites are clear land (class 5);
//   U: not F, no satellite is clear land, and at least one is cloud (class 4). Cloud flags only: there is no smoke test;
//   N: everything else. W: static water, left out of every count.
// Every number on screen comes from the data files (public/ka-data/states), copied as they are.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Deck, MapView, WebMercatorViewport, type Layer } from '@deck.gl/core';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer, PathLayer } from '@deck.gl/layers';
import { LangToggle } from '../components/LangToggle.tsx';
import { fmtNumber, locale, monthName, useLang, useTr, type Lang } from '../lib/lang.ts';
import '../styles/zero.css';

const BASE = `${import.meta.env.BASE_URL}ka-data/states/d/pulang-pisau/`;
const PHOTO = 'VIIRS_SNPP_CorrectedReflectance_TrueColor';
// MODIS/VIIRS sinusoidal grid (the grid of MOD14A1, MYD14A1, VNP14A1)
const R = 6371007.181, TILE = 1111950.5197665, X0 = -20015109.354, Y0 = 10007554.677, SIZE = TILE / 1200;
const DEG_PER_PX = 0.0012;     // canvas resolution of the state layer (a cell is about 7 px wide)
const SENSOR_NAMES: Record<string, string> = { terra_modis: 'Terra (MODIS)', aqua_modis: 'Aqua (MODIS)', snpp_viirs: 'Suomi NPP (VIIRS)' };
// A registered test covers this district for 1 January to 31 October 2019. The data files leave those days out; this
// page also refuses to show them if a file ever held one.
const HELD_FROM = '2019-01-01', HELD_TO = '2019-10-31';
const isHeld = (date: string) => date >= HELD_FROM && date <= HELD_TO;

type Letter = 'F' | 'T' | 'U' | 'N' | 'W';
interface Counts { F: number; T: number; U: number; N: number; W: number }
interface SensorInfo { id: string; has_data: boolean; reason?: string }
interface DayRow {
  date: string; k: number; cells: Counts; cells_k2: Counts; blind_share: number | null; firms_only_fire: number;
  states: string; sensors: SensorInfo[];
}
interface MonthFile { district: string; month: string; days: DayRow[] }
interface GridFile { district: string; tile: [number, number]; n_cells: number; cells: [number, number, number, number][] }
interface IndexFile {
  district: string; start: string; end: string; k: number; months: string[];
  registered_release: { tag: string; published_at: string; url?: string } | null; note: string | null;
}
interface Boundary { features: { geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown } }[] }
interface Data { index: IndexFile; grid: GridFile; days: DayRow[]; corners: Float64Array; bbox: [number, number, number, number]; outline: [number, number][][] }

/** The four corners (lon, lat) of every cell, 8 numbers per cell, and their box. */
function cellCorners(grid: GridFile): { corners: Float64Array; bbox: [number, number, number, number] } {
  const [h, v] = grid.tile;
  const out = new Float64Array(grid.cells.length * 8);
  let w = 180, s = 90, e = -180, n = -90;
  const ll = (row: number, col: number): [number, number] => {
    const x = X0 + h * TILE + col * SIZE;
    const y = Y0 - v * TILE - row * SIZE;
    const lat = y / R;
    return [((x / (R * Math.cos(lat))) * 180) / Math.PI, (lat * 180) / Math.PI];
  };
  grid.cells.forEach(([row, col], i) => {
    const pts = [ll(row, col), ll(row, col + 1), ll(row + 1, col + 1), ll(row + 1, col)];
    pts.forEach(([lo, la], k) => {
      out[i * 8 + k * 2] = lo;
      out[i * 8 + k * 2 + 1] = la;
      w = Math.min(w, lo); e = Math.max(e, lo); s = Math.min(s, la); n = Math.max(n, la);
    });
  });
  return { corners: out, bbox: [w, s, e, n] };
}

function outlineOf(b: Boundary): [number, number][][] {
  const g = b.features[0]?.geometry;
  if (!g) return [];
  const polys = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as [number, number][][][];
  return polys.flatMap((p) => p);
}

function pattern(draw: (c: CanvasRenderingContext2D, size: number) => void, size: number): CanvasPattern | null {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  draw(ctx, size);
  return ctx.createPattern(c, 'repeat');
}

/** The day's states drawn on a canvas in plain lon/lat over the cells' box. */
function drawStates(d: Data, states: string): HTMLCanvasElement {
  const [w, s, e, n] = d.bbox;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil((e - w) / DEG_PER_PX);
  cv.height = Math.ceil((n - s) / DEG_PER_PX);
  const ctx = cv.getContext('2d');
  if (!ctx) return cv;
  const hatch = pattern((c, p) => {
    c.fillStyle = 'rgba(16, 24, 32, 0.58)';
    c.fillRect(0, 0, p, p);
    c.strokeStyle = 'rgba(236, 242, 246, 0.95)';
    c.lineWidth = 1.6;
    c.beginPath();
    for (const o of [-p, 0, p]) { c.moveTo(o, p); c.lineTo(o + p, 0); }
    c.stroke();
  }, 7);
  const dots = pattern((c) => {
    c.fillStyle = 'rgba(210, 214, 218, 0.8)';
    c.beginPath();
    c.arc(3, 3, 1, 0, Math.PI * 2);
    c.fill();
  }, 6);
  const style: Partial<Record<Letter, string | CanvasPattern | null>> = {
    F: '#ff7a2f', T: 'rgba(255, 255, 255, 0.14)', U: hatch, N: dots,
  };
  for (const letter of ['T', 'N', 'U', 'F'] as const) {
    const fill = style[letter];
    if (!fill) continue;
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let i = 0; i < states.length; i++) {
      if (states[i] !== letter) continue;
      for (let k = 0; k < 4; k++) {
        const x = (d.corners[i * 8 + k * 2]! - w) / DEG_PER_PX;
        const y = (n - d.corners[i * 8 + k * 2 + 1]!) / DEG_PER_PX;
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    ctx.fill();
  }
  return cv;
}

function renderPhotoTile(props: Record<string, unknown> & { tile: unknown; data: unknown }) {
  const { boundingBox } = props.tile as { boundingBox: [[number, number], [number, number]] };
  return new BitmapLayer(props as never, {
    data: undefined, image: props.data as never, tintColor: [205, 214, 212],
    bounds: [boundingBox[0][0], boundingBox[0][1], boundingBox[1][0], boundingBox[1][1]],
  });
}

function dayFromHash(): string | null {
  const q = window.location.hash.split('?')[1];
  const d = q ? new URLSearchParams(q).get('d') : null;
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

/** "2018-09-14" as "14 September 2018". */
function longDate(date: string, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`));
}

/** "2018-09" as "September 2018". */
function longMonth(ym: string, lang: Lang): string {
  return `${monthName(Number(ym.slice(5, 7)), lang, 'long')} ${ym.slice(0, 4)}`;
}

/** Room left for the district on the map: beside the panel on a wide screen, under it on a narrow one. */
function fitPadding(width: number, height: number) {
  if (width > 700) return { top: 40, bottom: 130, left: Math.min(400, width * 0.45), right: 40 };
  const top = Math.round(height * 0.46) + 28;
  return height - top - 130 >= 120 ? { top, bottom: 130, left: 16, right: 16 } : { top: 16, bottom: 16, left: 16, right: 16 };
}

export function Zero() {
  const tr = useTr();
  const lang = useLang();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [showPhoto, setShowPhoto] = useState(true);
  const [showStates, setShowStates] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const deck = useRef<Deck<MapView> | null>(null);

  const num = (n: number) => fmtNumber(Math.round(n), lang);
  const pct = (x: number | null) => (x === null ? tr('n/a', 'tidak ada') : `${fmtNumber(100 * x, lang, 1)}%`);

  useEffect(() => {
    let live = true;
    (async () => {
      const index = await getJson<IndexFile>('index.json');
      const [grid, boundary, ...months] = await Promise.all([
        getJson<GridFile>('grid.json'), getJson<Boundary>('boundary.geojson'),
        ...index.months.map((m) => getJson<MonthFile>(`m/${m}.json`)),
      ]) as [GridFile, Boundary, ...MonthFile[]];
      const { corners, bbox } = cellCorners(grid);
      const days = months.flatMap((m) => m.days).filter((d) => !isHeld(d.date));
      if (!live) return;
      setData({ index, grid, days, corners, bbox, outline: outlineOf(boundary) });
      const want = dayFromHash();
      const at = want ? days.findIndex((d) => d.date === want) : -1;
      setIdx(at >= 0 ? at : 0);
    })().catch((e: unknown) => { if (live) setError(String(e instanceof Error ? e.message : e)); });
    return () => { live = false; };
  }, []);

  // the map, fitted to the district once the data is in
  useEffect(() => {
    if (!data || !box.current) return;
    const el = box.current;
    const [w, s, e, n] = data.bbox;
    const width = el.clientWidth || 800, height = el.clientHeight || 600;
    const vp = new WebMercatorViewport({ width, height }).fitBounds([[w, s], [e, n]], { padding: fitPadding(width, height) });
    const d = new Deck<MapView>({
      parent: el, views: new MapView({ repeat: false }), controller: true,
      initialViewState: { longitude: vp.longitude, latitude: vp.latitude, zoom: vp.zoom, pitch: 0, bearing: 0 },
      layers: [],
    });
    deck.current = d;
    return () => { d.finalize(); deck.current = null; };
  }, [data]);

  const day = data?.days[idx] ?? null;
  const statesCanvas = useMemo(() => (data && day ? drawStates(data, day.states) : null), [data, day]);

  useEffect(() => {
    const d = deck.current;
    if (!d || !data || !day) return;
    const [w, s, e, n] = data.bbox;
    const layers: Layer[] = [];
    layers.push(new TileLayer({
      id: `photo-${day.date}`, visible: showPhoto,
      data: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${PHOTO}/default/${day.date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
      minZoom: 0, maxZoom: 9, tileSize: 256, extent: [w - 0.5, s - 0.5, e + 0.5, n + 0.5],
      renderSubLayers: renderPhotoTile as never,
    }));
    if (statesCanvas) {
      layers.push(new BitmapLayer({
        id: `states-${day.date}`, image: statesCanvas, bounds: [w, s, e, n], visible: showStates,
        textureParameters: { minFilter: 'linear', magFilter: 'nearest' },
      }));
    }
    layers.push(new PathLayer<[number, number][]>({
      id: 'outline', data: data.outline, getPath: (x) => x, getColor: [143, 227, 208, 220], getWidth: 1.5,
      widthUnits: 'pixels',
    }));
    d.setProps({ layers });
  }, [data, day, statesCanvas, showPhoto, showStates]);

  const go = useCallback((i: number) => {
    if (!data) return;
    const j = Math.max(0, Math.min(data.days.length - 1, i));
    setIdx(j);
    const date = data.days[j]?.date;
    if (date) window.history.replaceState(null, '', `#/zero?d=${date}`);
  }, [data]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, idx]);

  const dev = data ? !data.index.registered_release : false;
  const c = day?.cells;
  const c2 = day?.cells_k2;
  const k2Share = c2 && c2.T + c2.U ? c2.U / (c2.T + c2.U) : null;
  // what the files hold: a satellite with no file on any day, and fire cells that come only from a FIRMS point
  const anyViirs = data?.days.some((d) => d.sensors.some((s) => s.id === 'snpp_viirs' && s.has_data)) ?? false;
  const anyFirmsOnly = data?.days.some((d) => d.firms_only_fire > 0) ?? false;
  const first = data?.days[0]?.date, last = data?.days[data.days.length - 1]?.date;
  const period = first && last
    ? (first.slice(0, 7) === last.slice(0, 7)
      ? longMonth(first.slice(0, 7), lang)
      : tr(`${longMonth(first.slice(0, 7), lang)} to ${longMonth(last.slice(0, 7), lang)}`, `${longMonth(first.slice(0, 7), lang)} sampai ${longMonth(last.slice(0, 7), lang)}`))
    : '';

  return (
    <div className="ka-zero">
      <div ref={box} className="ka-zero-canvas" aria-hidden="true" />
      <section className="ka-zero-panel" aria-label={tr('The day shown', 'Hari yang ditampilkan')}>
        <nav className="ka-zero-top" aria-label={tr('Pages', 'Halaman')}>
          <div className="ka-zero-head">
            <a className="ka-zero-brand" href="#/home">KalenderApi</a>
            <LangToggle className="ka-zero-lang" />
          </div>
          <div className="ka-zero-links">
            <a href="#/home">{tr('Home', 'Beranda')}</a>
            <a href="#/record">{tr('Indonesia record', 'Rekaman Indonesia')}</a>
            <a href="#/season?y=2015">{tr('Play the season', 'Putar musim')}</a>
            <a href="#/calendar">{tr('District calendar', 'Kalender kabupaten')}</a>
          </div>
        </nav>
        {dev ? (
          <p className="ka-zero-ribbon" role="note">
            <b>{tr('Development data, not a result.', 'Data pengembangan, bukan hasil.')}</b>
            {tr(
              `${period} is outside the season of the test we registered in advance (August to October 2019). The results of that test are not shown here.`,
              `${period} berada di luar musim uji yang kami daftarkan lebih dulu (Agustus sampai Oktober 2019). Hasil uji itu tidak ditampilkan di sini.`)}
          </p>
        ) : null}
        {error ? <p className="ka-zero-error" role="alert">{tr(`The data could not be loaded (${error}).`, `Data tidak dapat dimuat (${error}).`)}</p> : null}
        {!data || !day || !c ? (!error ? <p className="ka-zero-kicker" role="status">{tr('Loading the cells…', 'Memuat sel…')}</p> : null) : (
          <>
            <p className="ka-zero-kicker">{tr(`Zero inspector · ${data.index.district} district`, `Pemeriksa nol · Kabupaten ${data.index.district}`)}</p>
            <h1 className="ka-zero-title"><time dateTime={day.date}>{longDate(day.date, lang)}</time></h1>
            <p className="ka-zero-q">
              {tr(`What could the satellites see that day? ${num(data.grid.n_cells)} cells of about 1 km.`,
                `Apa yang dapat dilihat satelit pada hari itu? ${num(data.grid.n_cells)} sel berukuran sekitar 1 km.`)}
            </p>
            <ul className="ka-zero-states">
              <li>
                <span className="ka-zero-sw ka-zero-sw-F" aria-hidden="true" />
                <span>{tr('Fire detected', 'Api terdeteksi')}
                  <small>{anyFirmsOnly
                    ? tr('at least one satellite\'s daily fire mask marks a hotspot here, or a FIRMS hotspot falls in the cell',
                      'masker api harian setidaknya satu satelit menandai titik panas di sini, atau ada titik panas FIRMS di dalam sel')
                    : tr('at least one satellite\'s daily fire mask marks a hotspot here',
                      'masker api harian setidaknya satu satelit menandai titik panas di sini')}</small>
                </span>
                <span className="num">{num(c.F)}</span>
              </li>
              <li>
                <span className="ka-zero-sw ka-zero-sw-T" aria-hidden="true" />
                <span>{tr('Trusted zero', 'Nol tepercaya')}
                  <small>{day.k === 1
                    ? tr('no hotspot, and at least one satellite had a cloud-free look (its mask says clear land)',
                      'tanpa titik panas, dan setidaknya satu satelit punya pandangan bebas awan (maskernya menyatakan daratan bebas awan)')
                    : tr(`no hotspot, and at least ${day.k} satellites had a cloud-free look (their masks say clear land)`,
                      `tanpa titik panas, dan setidaknya ${day.k} satelit punya pandangan bebas awan (maskernya menyatakan daratan bebas awan)`)}</small>
                </span>
                <span className="num">{num(c.T)}</span>
              </li>
              <li>
                <span className="ka-zero-sw ka-zero-sw-U" aria-hidden="true" />
                <span>{tr('Untrusted zero', 'Nol tak tepercaya')}
                  <small>{tr('no hotspot and no cloud-free look: no satellite\'s mask says clear land, and at least one says cloud',
                    'tanpa titik panas dan tanpa pandangan bebas awan: tidak ada masker satelit yang menyatakan daratan bebas awan, dan setidaknya satu menyatakan awan')}</small>
                </span>
                <span className="num">{num(c.U)}</span>
              </li>
              <li>
                <span className="ka-zero-sw ka-zero-sw-N" aria-hidden="true" />
                <span>{tr('No data', 'Tanpa data')}
                  <small>{tr('none of the three above: no mask has a fire, clear-land or cloud class for this cell',
                    'bukan ketiganya: tidak ada masker yang punya kelas api, daratan bebas awan, atau awan untuk sel ini')}</small>
                </span>
                <span className="num">{num(c.N)}</span>
              </li>
            </ul>
            <div className="ka-zero-blind">
              {tr('Zeros with no cloud-free look:', 'Nol tanpa pandangan bebas awan:')} <span className="big">{pct(day.blind_share)}</span>
              <small>{tr('untrusted zeros ÷ (trusted + untrusted zeros)', 'nol tak tepercaya ÷ (nol tepercaya + nol tak tepercaya)')}</small>
              <small>{tr(`if two satellites must have a cloud-free look: ${pct(k2Share)}`, `bila dua satelit harus punya pandangan bebas awan: ${pct(k2Share)}`)}</small>
              <small>{tr(`${num(c.W)} water cells left out`, `${num(c.W)} sel air tidak diikutkan`)}</small>
            </div>
            <p className="ka-zero-note">
              {tr('This page looks at one district on the sensors\' own 1 km grid, satellite by satellite, while the province maps elsewhere in this app use a 0.01-degree grid, so the two shares are not the same number.',
                'Halaman ini melihat satu kabupaten pada grid 1 km milik sensor, satelit demi satelit, sedangkan peta provinsi di bagian lain aplikasi ini memakai grid 0,01 derajat, sehingga kedua persentase itu bukan angka yang sama.')}
            </p>
            <ul className="ka-zero-sensors" aria-label={tr('Satellites on this day', 'Satelit pada hari ini')}>
              {day.sensors.map((s) => (
                <li key={s.id} className={s.has_data ? '' : 'off'}>
                  {s.has_data ? tr('Has data', 'Ada data') : tr('No data', 'Tanpa data')}: {SENSOR_NAMES[s.id] ?? s.id}
                  {!s.has_data && s.id === 'snpp_viirs' ? tr(' (we have not downloaded the VIIRS file)', ' (berkas VIIRS belum kami unduh)') : ''}
                </li>
              ))}
            </ul>
            <div className="ka-zero-toggles">
              <button type="button" aria-pressed={showStates} onClick={() => setShowStates((v) => !v)}>{tr('Cell states', 'Status sel')}</button>
              <button type="button" aria-pressed={showPhoto} onClick={() => setShowPhoto((v) => !v)}>{tr('NASA photo', 'Foto NASA')}</button>
            </div>
            <p className="ka-zero-src">
              {tr('Cell states: NASA MOD14A1 (Terra) and MYD14A1 (Aqua) v6.1 daily FireMask, from the public copy on Microsoft Planetary Computer',
                'Status sel: FireMask harian NASA MOD14A1 (Terra) dan MYD14A1 (Aqua) v6.1, dari salinan publik di Microsoft Planetary Computer')}
              {anyViirs
                ? tr(', with VNP14A1 (Suomi NPP) on the days we have its file. ', ', dengan VNP14A1 (Suomi NPP) pada hari yang berkasnya kami miliki. ')
                : tr('. Suomi NPP (VNP14A1) is not in this data. ', '. Suomi NPP (VNP14A1) tidak ada dalam data ini. ')}
              {tr('A daily mask keeps the highest class of all passes, night included, so one cloud-free pass is enough for a cloud-free look. Cloud is the cloud class of the fire mask itself; we run no smoke test. Photo: NASA GIBS, VIIRS (Suomi NPP) true colour of the same day. Boundary: geoBoundaries (BPS, WFP, OCHA ROAP), CC BY 3.0 IGO.',
                'Masker harian menyimpan kelas tertinggi dari semua lintasan, termasuk malam, sehingga satu lintasan bebas awan sudah cukup untuk pandangan bebas awan. Awan adalah kelas awan pada masker api itu sendiri; kami tidak melakukan uji asap. Foto: NASA GIBS, warna asli VIIRS (Suomi NPP) pada hari yang sama. Batas: geoBoundaries (BPS, WFP, OCHA ROAP), CC BY 3.0 IGO.')}
            </p>
          </>
        )}
      </section>

      {data ? (
        <section className="ka-zero-dock" aria-label={tr('Days', 'Hari')}>
          <div className="ka-zero-dock-head">
            <span>{tr('Each bar is one day: fire, trusted zero, untrusted zero, no data', 'Setiap batang adalah satu hari: api, nol tepercaya, nol tak tepercaya, tanpa data')}</span>
            <span className="ka-zero-keys">{tr('Left and right arrows: one day', 'Panah kiri dan kanan: satu hari')}</span>
          </div>
          <div className="ka-zero-strip">
            {data.days.map((d, i) => {
              const k = d.cells;
              const total = k.F + k.T + k.U + k.N || 1;
              return (
                <button key={d.date} type="button" className="ka-zero-bar" aria-current={i === idx ? 'date' : undefined}
                  aria-label={tr(`${longDate(d.date, lang)}: ${pct(d.blind_share)} of zeros with no cloud-free look`,
                    `${longDate(d.date, lang)}: ${pct(d.blind_share)} nol tanpa pandangan bebas awan`)}
                  onClick={() => go(i)}>
                  {(['F', 'T', 'U', 'N'] as const).map((L) => (
                    <span key={L} className={L} style={{ height: `${(100 * k[L]) / total}%` }} />
                  ))}
                </button>
              );
            })}
          </div>
          <div className="ka-zero-axis">
            <span>{first ? longDate(first, lang) : ''}</span>
            <span>{last ? longDate(last, lang) : ''}</span>
          </div>
        </section>
      ) : null}
    </div>
  );
}
