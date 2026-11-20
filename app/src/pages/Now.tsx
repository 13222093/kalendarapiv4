// KalenderApi (new file): "Today in my district" (#/now?aoi=<district aoi_id>, default Pulang Pisau).
// For a district disaster office (BPBD) officer or a Manggala Agni crew leader: what the satellites recorded in the
// district in the last 24 hours and 7 days (NASA FIRMS near real time, through /api/live), over today's NASA photo so
// cloud can be seen; whether this month is normal on the one-scale record; whether a zero can be believed; peat sites
// to re-check; a level from stated rules; and three ready-to-send messages. The page sends nothing by itself.
// Every number comes from /api/live, the district's monthly record, blind_rule_kalteng.json or
// peat_persistence_kalteng.json. Nothing is forecast. No statistic is made for the months a registered test covers.
// Two views draw this page from one model (useNowModel, below): the classic page here (Now), and the three-panel
// command view (#/command, pages/CommandConsole.tsx), which also uses the map, the AI draft and the resident's report
// exported from this file. Which view '#/now' opens is one value in lib/todayview.ts.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { saveText } from '../lib/download.ts';
import { fmtNumber, monthName as monthOnly, useLang, useTr, type Lang } from '../lib/lang.ts';
import {
  HIGH_24H, LEVEL_NAME, SENSORS, SENSOR_LABEL, STATUS_NAME, asLive, buildMessages, countLive, districtTitle, filesUpdatedMs,
  levelOf, padBox, peatCsv, peatFor, pointMs, waLink, wib,
  type Level, type LivePoint, type LiveReply, type MonthFact, type PeatSite,
} from '../lib/now.ts';
import {
  aoiName, dateOnly, districtAt, getJson, loadBlindRule, loadDistrictShapes, loadDistricts, loadMonthly, lockedMonths, monthName,
  pointInGeometry, searchDistricts, settle, ym,
  type AoiEntry, type BlindRule, type DistrictIndex, type DistrictShapes, type Load, type MonthRow,
} from '../lib/record.ts';
import { MIN_EARLIER_YEARS, STATUS_CUTS, monthStatus } from '../lib/robust.ts';
import { SiteHeader } from '../components/SiteHeader.tsx';
import { AlertLoop } from '../components/now/AlertLoop.tsx';
import { AskAssistant, type AskFacts } from '../components/now/AskAssistant.tsx';
import { classicHref, consoleHref } from '../lib/todayview.ts';
import '../styles/now.css';

maplibregl.setWorkerUrl(workerUrl);

const DEFAULT_AOI = 'kab-pulang-pisau';
const BASE = import.meta.env.BASE_URL;
const KALTENG_PROVINCE = 'Kalimantan Tengah';
const MAP_PAD = 0.25;            // degrees of neighbouring land the map and the live request include
export const TABLE_ROWS = 8;     // newest hotspots listed under the map
export const SITE_ROWS = 10;     // peat sites listed (the CSV has all of them)
const PHOTO_LAYER = 'VIIRS_NOAA20_CorrectedReflectance_TrueColor';
const photoTiles = (date: string) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${PHOTO_LAYER}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;

export type Box = [number, number, number, number];
type Geometry = DistrictShapes['features'][number]['geometry'];
export type LiveState = { state: 'loading' } | { state: 'ok'; data: LiveReply } | { state: 'unavailable'; why: 'no-function' | 'failed'; detail: string };
type BlindFile = BlindRule & { districts?: { name: string; district_days_above: number; district_days: number; share_pct: number }[] };

function subscribeHash(fn: () => void): () => void {
  window.addEventListener('hashchange', fn);
  return () => window.removeEventListener('hashchange', fn);
}
const readHash = () => window.location.hash;
const aoiOf = (hash: string) => new URLSearchParams(hash.split('?')[1] ?? '').get('aoi');

/** The live-data address. In development only, localStorage "ka_live_api" may point at a local copy of the function. */
function liveUrl(box: Box): string {
  let base = `${BASE}api/live`;
  if (import.meta.env.DEV) {
    try { base = window.localStorage.getItem('ka_live_api') || base; } catch { /* private mode */ }
  }
  return `${base}?range=7d&bbox=${box.join(',')}`;
}

async function readLive(box: Box): Promise<LiveState> {
  try {
    const r = await fetch(liveUrl(box));
    const type = r.headers.get('content-type') ?? '';
    // a static host or the dev server answers with a page or the function's source text: there is no live function here
    if (!type.includes('json')) return { state: 'unavailable', why: 'no-function', detail: r.ok ? 'no JSON reply' : `HTTP ${r.status}` };
    const live = asLive(await r.json());
    if (!live) return { state: 'unavailable', why: 'failed', detail: `HTTP ${r.status}` };
    if (live.sources.length > 0 && live.failed.length === live.sources.length) return { state: 'unavailable', why: 'failed', detail: live.sources.map((s) => `${s.sensor}: ${s.error}`).join('; ') };
    return { state: 'ok', data: live };
  } catch (e) {
    return { state: 'unavailable', why: 'failed', detail: e instanceof Error ? e.message : String(e) };
  }
}

/** The newest day (UTC) with a NASA GIBS VIIRS NOAA-20 true-colour photo over a point: today, else yesterday, else the
 *  day before. A day whose tile is missing, or mostly black (the pass has not arrived yet), is skipped. */
async function newestPhotoDate(lon: number, lat: number, nowMs: number): Promise<string | null> {
  const z = 8, n = 2 ** z, rad = (lat * Math.PI) / 180;
  const x = Math.floor(((lon + 180) / 360) * n), y = Math.floor(((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2) * n);
  for (let back = 0; back <= 2; back++) {
    const date = new Date(nowMs - back * 86400_000).toISOString().slice(0, 10);
    try {
      const r = await fetch(photoTiles(date).replace('{z}', String(z)).replace('{y}', String(y)).replace('{x}', String(x)));
      if (!r.ok || !(r.headers.get('content-type') ?? '').startsWith('image')) continue;
      const bmp = await createImageBitmap(await r.blob());
      const cv = document.createElement('canvas');
      cv.width = cv.height = 32;
      const ctx = cv.getContext('2d');
      if (!ctx) return date;
      ctx.drawImage(bmp, 0, 0, 32, 32);
      const px = ctx.getImageData(0, 0, 32, 32).data;
      let lit = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i]! + px[i + 1]! + px[i + 2]! > 30) lit++;
      if (lit >= (32 * 32) / 2) return date;
    } catch { /* try the day before */ }
  }
  return null;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  }
}

// ------------------------------------------------------------------------------------------------ a draft by AI (optional)
// An extra, asked for by the team: POST /api/advise (a Vercel function that calls an AI model with a key held in the
// site's environment; the reply names the model). It is called only when the button is pressed, with numbers this page
// already shows. The three template messages stay the default and the fallback.

const AI_NAME = /^[\p{L}\p{M} .,'()-]{1,60}$/u;
export interface AiFacts {
  district: string; province: string; as_of: string | null;
  hotspots_24h: number | null; hotspots_7d: number | null; viirs_24h: number | null; modis_24h: number | null;
  month: string; month_count: number | null; month_median: number | null; month_ratio: number | null; month_provisional: boolean;
  level: Level; cloud_days_above: number | null; cloud_days_total: number | null; peat_sites: number | null;
}
type AiState = { s: 'idle' | 'working' | 'failed' | 'busy' | 'off' | 'unavailable' } | { s: 'ok'; text: string; model: string | null; at: string | null; truncated: boolean };

export function AiDraft({ facts, lang }: { facts: AiFacts; lang: Lang }) {
  const tr = useTr();
  const [st, setSt] = useState<AiState>({ s: 'idle' });
  const [copied, setCopied] = useState<boolean | null>(null);
  const run = async () => {
    setSt({ s: 'working' });
    setCopied(null);
    const ctl = new AbortController();
    const timer = window.setTimeout(() => ctl.abort(), 35_000);
    try {
      const r = await fetch(`${BASE}api/advise`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang, facts }), signal: ctl.signal,
      });
      if (r.status === 429) { setSt({ s: 'busy' }); return; }
      if (!(r.headers.get('content-type') ?? '').includes('json')) { setSt({ s: 'unavailable' }); return; }
      const body = await r.json() as { ok?: boolean; text?: unknown; model?: unknown; truncated?: unknown; generated_at?: unknown; error?: unknown };
      if (r.status === 503 && body.error === 'not_configured') { setSt({ s: 'off' }); return; }
      if (r.ok && body.ok === true && typeof body.text === 'string' && body.text.trim()) {
        setSt({ s: 'ok', text: body.text.trim(), model: typeof body.model === 'string' ? body.model : null,
          at: typeof body.generated_at === 'string' && !Number.isNaN(Date.parse(body.generated_at)) ? body.generated_at : null, truncated: body.truncated === true });
      } else if (r.ok && body.ok === false) setSt({ s: 'failed' });
      else setSt({ s: 'unavailable' });
    } catch {
      setSt({ s: 'failed' });   // no reply at all (network, or the time limit): the button stays, to try again
    } finally {
      window.clearTimeout(timer);
    }
  };
  if (st.s === 'off') return null;   // the site owner has not switched AI on: no button, nothing else
  return (
    <div className="now-ai">
      {st.s !== 'unavailable' ? (
        <>
          <button type="button" className="now-btn" onClick={() => { void run(); }} disabled={st.s === 'working'} aria-busy={st.s === 'working'}>
            {st.s === 'working' ? tr('Drafting… (up to 20 seconds)', 'Menyusun… (hingga 20 detik)') : tr('Draft advice with AI', 'Susun saran dengan AI')}
          </button>
          <p className="now-small">
            {tr('Optional. Sends the numbers on this page (district, counts, level; nothing about you) to an AI model through this site, only when you press the button. The three template messages above stay as they are.',
              'Opsional. Mengirim angka di halaman ini (kabupaten, jumlah, tingkat; tidak ada data tentang Anda) ke sebuah model AI melalui situs ini, hanya saat Anda menekan tombol. Tiga pesan templat di atas tetap seperti adanya.')}
          </p>
        </>
      ) : null}
      <div role="status">
        {st.s === 'failed' ? <p className="now-note">{tr('The AI could not draft this. You can try again; the template messages above are complete and ready to use.', 'AI tidak dapat menyusun saran ini. Anda dapat mencoba lagi; pesan templat di atas sudah lengkap dan siap dipakai.')}</p> : null}
        {st.s === 'busy' ? <p className="now-note">{tr('The AI is busy; try again in a minute.', 'AI sedang sibuk; coba lagi sebentar lagi.')}</p> : null}
        {st.s === 'unavailable' ? <p className="now-small">{tr('AI drafting is not available on this copy of the site. The template messages above are complete.', 'Penyusunan dengan AI tidak tersedia di salinan situs ini. Pesan templat di atas sudah lengkap.')}</p> : null}
      </div>
      {st.s === 'ok' ? (
        <article className="now-ai-card" aria-label={tr('Advice drafted by AI', 'Saran yang disusun AI')}>
          <p className="now-ai-label">{tr(`Drafted by AI${st.model ? ` (${st.model})` : ''} from the numbers above. Check it before you send it.`, `Disusun AI${st.model ? ` (${st.model})` : ''} dari angka di atas. Periksa sebelum dikirim.`)}</p>
          <p className="now-msg-text" lang={lang}>{st.text}</p>
          <p className="now-small">
            {st.model ? tr(`Model: ${st.model}.`, `Model: ${st.model}.`) : tr('Model: not stated in the reply.', 'Model: tidak disebutkan dalam balasan.')}{st.at ? ' ' + tr(`Drafted ${wib(Date.parse(st.at), lang)}.`, `Disusun ${wib(Date.parse(st.at), lang)}.`) : ''}
            {st.truncated ? ' ' + tr('The draft was cut short.', 'Draf ini terpotong.') : ''}
          </p>
          <div className="now-msg-actions">
            <button type="button" className="now-btn" onClick={() => { void copyText(st.text).then(setCopied); }}>{tr('Copy', 'Salin')}</button>
            <a className="now-btn now-btn-primary" href={waLink(st.text)} target="_blank" rel="noopener noreferrer">{tr('Share on WhatsApp', 'Bagikan ke WhatsApp')}</a>
            <span className="now-small" role="status">{copied === true ? tr('Copied.', 'Tersalin.') : copied === false ? tr('Could not copy; select the text instead.', 'Tidak dapat menyalin; pilih teksnya secara manual.') : ''}</span>
          </div>
        </article>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ the map

/** A design token (styles/brand.css) as the page resolves it, for the WebGL layers: the map and the page's CSS use one
 *  palette. A token that cannot be read falls back to plain white, never to a made-up hue (as lib/seasonTheme.ts). */
const token = (el: Element, name: string) => getComputedStyle(el).getPropertyValue(name).trim() || 'white';

type GeoData = maplibregl.GeoJSONSourceSpecification['data'];
const fc = (features: unknown[]): GeoData => ({ type: 'FeatureCollection', features } as unknown as GeoData);
const LAYERS = ['focus', 'focus-case', 'hot', 'sites', 'district-line', 'district-case', 'peat-line', 'photo'];
const SOURCES = ['focus', 'hot', 'sites', 'district', 'peat', 'photo'];

/** A point the command view asks the map to show ("Show on map" in a queue row): the map moves there and rings it.
 *  A new object on every ask, so asking for the same point twice moves the map twice. */
export interface MapFocus { lon: number; lat: number }

interface MapProps {
  box: Box; outline: Geometry; points: { p: LivePoint; inside: boolean }[] | null;
  photoDate: string | null; sites: PeatSite[]; peat: unknown; label: string;
  /** the command view only: the point to show, and whether the wheel zooms the map (its panels scroll, not the page) */
  focus?: MapFocus | null; freeWheel?: boolean;
}

export function NowMap({ box, outline, points, photoDate, sites, peat, label, focus, freeWheel }: MapProps) {
  const tr = useTr();
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [w, s, e, n] = box;

  useEffect(() => {
    const host = el.current;
    if (!host) return undefined;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: host,
        style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': token(host, '--surface-2') } }] },
        bounds: [[w, s], [e, n]], fitBoundsOptions: { padding: 28 }, minZoom: 4, maxZoom: 12,
        maxBounds: [[w - 2, s - 2], [e + 2, n + 2]],
        attributionControl: { compact: true, customAttribution: 'Imagery: NASA GIBS (VIIRS NOAA-20 true colour). Boundaries: geoBoundaries' },
        dragRotate: false, pitchWithRotate: false, maxPitch: 0,
        cooperativeGestures: true,   // the wheel scrolls the page; Ctrl or Cmd + wheel zooms the map
      });
    } catch {
      setFailed(true);
      return undefined;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.touchZoomRotate.disableRotation();
    map.on('load', () => {
      // the credit starts folded (its "i" button opens it), so it does not cover a small map
      host.querySelectorAll('.maplibregl-ctrl-attrib.maplibregl-compact-show').forEach((x) => x.classList.remove('maplibregl-compact-show'));
      setReady(true);
    });
    return () => { mapRef.current = null; setReady(false); map.remove(); };
  }, [w, s, e, n]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().setAttribute('aria-label', label);
  }, [label, ready]);

  useEffect(() => {
    const map = mapRef.current, host = el.current;
    if (!ready || !map || !host) return;
    const css = (name: string) => token(host, name);
    for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id);
    for (const id of SOURCES) if (map.getSource(id)) map.removeSource(id);
    if (photoDate) {
      map.addSource('photo', { type: 'raster', tiles: [photoTiles(photoDate)], tileSize: 256, maxzoom: 9 });
      map.addLayer({ id: 'photo', type: 'raster', source: 'photo' });
    }
    if (peat && typeof peat === 'object') {
      map.addSource('peat', { type: 'geojson', data: peat as GeoData });
      map.addLayer({ id: 'peat-line', type: 'line', source: 'peat', paint: { 'line-color': css('--text-3'), 'line-width': 1, 'line-dasharray': [3, 2], 'line-opacity': 0.9 } });
    }
    if (outline) {
      map.addSource('district', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: outline } as unknown as GeoData });
      map.addLayer({ id: 'district-case', type: 'line', source: 'district', paint: { 'line-color': css('--bg'), 'line-width': 4.5, 'line-opacity': 0.7 } });
      map.addLayer({ id: 'district-line', type: 'line', source: 'district', paint: { 'line-color': css('--text'), 'line-width': 1.8 } });
    }
    if (sites.length) {
      map.addSource('sites', { type: 'geojson', data: fc(sites.map((x) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [x.lon, x.lat] } }))) });
      map.addLayer({ id: 'sites', type: 'circle', source: 'sites', paint: {
        // a ring: the fill takes the ring's colour at zero opacity
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 4, 10, 8], 'circle-color': css('--ka-harm'), 'circle-opacity': 0,
        'circle-stroke-color': css('--ka-harm'), 'circle-stroke-width': 2,
      } });
    }
    if (points?.length) {
      map.addSource('hot', { type: 'geojson', data: fc(points.map(({ p, inside }) => ({ type: 'Feature', properties: { k: p[4] === 'MODIS' ? 'm' : 'v', i: inside ? 1 : 0 }, geometry: { type: 'Point', coordinates: [p[0], p[1]] } }))) });
      map.addLayer({ id: 'hot', type: 'circle', source: 'hot', paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 3.5, 10, 6.5],
        'circle-color': ['match', ['get', 'k'], 'm', css('--ka-modis'), css('--ka-viirs')],
        'circle-opacity': ['case', ['==', ['get', 'i'], 1], 0.95, 0.4],
        'circle-stroke-color': css('--bg'), 'circle-stroke-width': 1, 'circle-stroke-opacity': ['case', ['==', ['get', 'i'], 1], 0.9, 0.4],
      } });
    }
    if (focus) {
      // the point a queue row asked for: a wide ring in the text colour over a dark one, so it reads on cloud and on land
      map.addSource('focus', { type: 'geojson', data: fc([{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [focus.lon, focus.lat] } }]) });
      map.addLayer({ id: 'focus-case', type: 'circle', source: 'focus', paint: { 'circle-radius': 15, 'circle-color': css('--bg'), 'circle-opacity': 0, 'circle-stroke-color': css('--bg'), 'circle-stroke-width': 6, 'circle-stroke-opacity': 0.7 } });
      map.addLayer({ id: 'focus', type: 'circle', source: 'focus', paint: { 'circle-radius': 15, 'circle-color': css('--text'), 'circle-opacity': 0, 'circle-stroke-color': css('--text'), 'circle-stroke-width': 2.5 } });
    }
  }, [ready, photoDate, peat, outline, sites, points, focus]);

  // the command view: move to the asked point (at once when the reader asked for less motion)
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !focus) return;
    const to = { center: [focus.lon, focus.lat] as [number, number], zoom: Math.max(map.getZoom(), 9.5) };
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) map.jumpTo(to);
    else map.easeTo({ ...to, duration: 700 });
  }, [ready, focus]);

  // the command view: the wheel zooms the map where the page itself does not scroll (the map starts as on the classic
  // page, where the wheel scrolls the page, and is switched once it has loaded)
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || freeWheel === undefined) return;
    if (freeWheel) map.cooperativeGestures.disable(); else map.cooperativeGestures.enable();
  }, [ready, freeWheel]);

  if (failed) {
    return (
      <p className="now-note" role="note">
        {tr('The interactive map could not start in this browser (WebGL is not available). The numbers and the table below are the same data.',
          'Peta interaktif tidak dapat dijalankan di peramban ini (WebGL tidak tersedia). Angka dan tabel di bawah memuat data yang sama.')}
      </p>
    );
  }
  return <div ref={el} className="now-map" role="region" aria-label={label} />;
}

// ------------------------------------------------------------------------------------------------ the page

function useLoad<T>(make: (() => Promise<T>) | null, key: string): Load<T> {
  const [got, setGot] = useState<{ key: string; load: Load<T> }>({ key, load: { state: 'loading' } });
  useEffect(() => {
    if (!make) return undefined;
    let alive = true;
    settle(make(), (load) => { if (alive) setGot({ key, load }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return got.key === key ? got.load : { state: 'loading' };
}

/** A phone number as wa.me wants it: digits only, an Indonesian leading 0 written as 62. Empty when too short. */
export function waNumber(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('0')) d = `62${d.slice(1)}`;
  return d.length >= 9 && d.length <= 15 ? d : '';
}

type LocState = { s: 'idle' | 'asking' | 'denied' | 'unavailable' } | { s: 'ok'; lat: number; lon: number };

/** The way back from a resident to the disaster office: a report written for WhatsApp. No backend: this composes a
 *  text and a wa.me link, nothing more. The location is asked for only on the button, lives only in this component's
 *  state, and goes nowhere but into the text the resident sees before sending.
 *  `variant`: 'card' is the classic page's card; 'console' is the same report without the card frame, for the command
 *  view's village panel (styles/nowconsole.css). */
export function ReportBack({ place, msgLang, phone, variant = 'card' }: { place: string; msgLang: Lang; phone: string; variant?: 'card' | 'console' }) {
  const tr = useTr();
  const [kind, setKind] = useState<'fire' | 'smoke'>('fire');
  const [loc, setLoc] = useState<LocState>({ s: 'idle' });
  const [at, setAt] = useState(() => Date.now());
  const [copied, setCopied] = useState<boolean | null>(null);
  useEffect(() => {
    const id = window.setInterval(() => setAt(Date.now()), 60_000);   // the time in the text is the time of the report
    return () => window.clearInterval(id);
  }, []);
  const addLocation = () => {
    setAt(Date.now());
    if (!('geolocation' in navigator)) { setLoc({ s: 'unavailable' }); return; }
    setLoc({ s: 'asking' });
    navigator.geolocation.getCurrentPosition(
      (pos) => setLoc({ s: 'ok', lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => setLoc({ s: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  };
  const where = loc.s === 'ok' ? `${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}` : null;
  const text = msgLang === 'id'
    ? ['Laporan warga lewat KalenderApi', `Saya melihat ${kind === 'fire' ? 'api' : 'asap'} di ${place}.`, `Waktu: ${wib(at, 'id')}`,
      `Lokasi: ${where ?? '(tulis nama desa atau patokan)'}`, 'Mohon dicek.'].join('\n')
    : ['Resident report through KalenderApi', `I see ${kind === 'fire' ? 'fire' : 'smoke'} in ${place}.`, `Time: ${wib(at, 'en')}`,
      `Location: ${where ?? '(write the village name or a landmark)'}`, 'Please check.'].join('\n');
  const number = waNumber(phone);
  const href = number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : waLink(text);
  return (
    <section className={variant === 'console' ? 'cmd-report' : 'now-card now-report'} aria-labelledby="now-h-report">
      <p className="now-kicker">{tr('For residents', 'Untuk warga')}</p>
      <h2 id="now-h-report">{tr('Seen fire or smoke? Report it', 'Melihat api atau asap? Laporkan')}</h2>
      <p>{tr('This opens WhatsApp with a report already written. Nothing is sent until you press send in WhatsApp.',
        'Ini membuka WhatsApp dengan laporan yang sudah ditulis. Tidak ada yang terkirim sampai Anda menekan kirim di WhatsApp.')}</p>
      <div className="now-report-row">
        <div className="now-seg" role="group" aria-label={tr('What you see', 'Apa yang Anda lihat')}>
          <button type="button" aria-pressed={kind === 'fire'} onClick={() => { setKind('fire'); setAt(Date.now()); }}>{tr('Fire', 'Api')}</button>
          <button type="button" aria-pressed={kind === 'smoke'} onClick={() => { setKind('smoke'); setAt(Date.now()); }}>{tr('Smoke', 'Asap')}</button>
        </div>
        {loc.s === 'ok'
          ? <button type="button" className="now-btn now-btn-quiet" onClick={() => setLoc({ s: 'idle' })}>{tr('Remove my location', 'Hapus lokasi saya')}</button>
          : <button type="button" className="now-btn now-btn-quiet" onClick={addLocation} disabled={loc.s === 'asking'}>{loc.s === 'asking' ? tr('Asking your phone…', 'Meminta ke ponsel Anda…') : tr('Add my location', 'Tambahkan lokasi saya')}</button>}
        <span className="now-small" role="status">
          {loc.s === 'ok' ? tr(`Location added: ${where}. It goes only into this text; this page does not store or send it.`, `Lokasi ditambahkan: ${where}. Lokasi hanya masuk ke teks ini; halaman ini tidak menyimpan atau mengirimnya.`)
            : loc.s === 'denied' ? tr('Location was not allowed. Write the village name or a landmark in the message instead.', 'Lokasi tidak diizinkan. Tulis nama desa atau patokan di pesan sebagai gantinya.')
              : loc.s === 'unavailable' ? tr('Location is not available on this device. Write the village name or a landmark in the message instead.', 'Lokasi tidak tersedia di perangkat ini. Tulis nama desa atau patokan di pesan sebagai gantinya.') : ''}
        </span>
      </div>
      <p className="now-msg-text now-report-text" lang={msgLang}>{text}</p>
      <div className="now-report-row">
        <a className="now-btn now-btn-primary now-btn-wa" href={href} target="_blank" rel="noopener noreferrer">{tr('Report on WhatsApp', 'Laporkan lewat WhatsApp')}</a>
        <button type="button" className="now-btn now-btn-quiet" onClick={() => { void copyText(text).then(setCopied); }}>{tr('Copy', 'Salin')}</button>
        <span className="now-small" role="status">{copied === true ? tr('Copied.', 'Tersalin.') : copied === false ? tr('Could not copy; select the text instead.', 'Tidak dapat menyalin; pilih teksnya secara manual.') : ''}</span>
      </div>
      <p className="now-small">
        {number ? (variant === 'console'
          ? tr('It opens a chat with the local post number typed with the messages above.', 'Ini membuka percakapan dengan nomor posko setempat yang diketik bersama pesan di atas.')
          : tr('It opens a chat with the local post number typed in the message cards above.', 'Ini membuka percakapan dengan nomor posko setempat yang diketik pada kartu pesan di atas.'))
          : tr('No local post number is typed above, so WhatsApp asks you to pick the contact.', 'Belum ada nomor posko setempat yang diketik di atas, sehingga WhatsApp meminta Anda memilih kontak.')}
        {' '}{tr('This is not an emergency line. In danger, call your local emergency number.', 'Ini bukan saluran darurat. Dalam bahaya, hubungi nomor darurat setempat.')}
      </p>
    </section>
  );
}

/** Small drawn icons for the three people this page serves: the office, the village, the fire crew. */
function NowIcon({ kind }: { kind: 'bpbd' | 'residents' | 'crew' }) {
  const d = kind === 'bpbd' ? 'M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5M9 11h.01M15 11h.01M12 4V2h3'
    : kind === 'residents' ? 'M3 11l9-7 9 7M5 10v10h14V10M10 20v-5h4v5'
      : 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9zM4 21h16';
  return (
    <svg className="now-icon" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={d} /></svg>
  );
}

/** Everything "Today in my district" knows about the district named in the address: the files it loads, the live
 *  hotspots, the level, the three messages, the district picker and the page's own sentences. Two views draw it and
 *  neither loads data of its own: the classic page (Now, below) and the command view (pages/CommandConsole.tsx).
 *  `hrefFor`: the address a view goes to when another district is picked. */
export function useNowModel(view: { hrefFor: (aoiId: string) => string }) {
  const tr = useTr();
  const lang = useLang();
  const hash = useSyncExternalStore(subscribeHash, readHash);
  const asked = aoiOf(hash);

  const districts = useLoad<DistrictIndex>(loadDistricts, 'districts');
  const shapes = useLoad<DistrictShapes>(loadDistrictShapes, 'shapes');
  const list = districts.state === 'ok' ? districts.data.districts : null;
  const aoi: AoiEntry | null = useMemo(
    () => (list ? list.find((d) => d.aoi_id === asked) ?? list.find((d) => d.aoi_id === DEFAULT_AOI) ?? list[0] ?? null : null),
    [list, asked]);
  const unknownAsked = !!list && !!asked && aoi?.aoi_id !== asked;
  const aoiId = aoi?.aoi_id ?? '';
  const name = aoi ? aoiName(aoi, lang) : '';
  const box: Box | null = useMemo(() => {
    const b = aoi?.bbox;
    return b && b.length === 4 ? padBox(b as Box, MAP_PAD) : null;
  }, [aoi]);
  const outline: Geometry = useMemo(
    () => (shapes.state === 'ok' ? shapes.data.features.find((f) => f.properties?.aoi_id === aoiId)?.geometry ?? null : null),
    [shapes, aoiId]);

  const rows = useLoad<MonthRow[]>(aoi ? () => loadMonthly(aoi) : null, `rows:${aoiId}`);

  // ---- live hotspots
  const [tick, setTick] = useState(0);
  const [live, setLive] = useState<{ key: string; s: LiveState }>({ key: '', s: { state: 'loading' } });
  const liveKey = box ? `${aoiId}:${tick}` : '';
  useEffect(() => {
    if (!box) return undefined;
    let alive = true;
    void readLive(box).then((s) => { if (alive) setLive({ key: liveKey, s }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveKey]);
  const liveState: LiveState = live.key === liveKey && liveKey ? live.s : { state: 'loading' };
  const liveData = liveState.state === 'ok' ? liveState.data : null;
  const [clock] = useState(() => Date.now());
  const nowMs = liveData ? Date.parse(liveData.fetched_at) : clock;

  const marked = useMemo(() => {
    if (!liveData || !aoi?.bbox) return null;
    const [w, s, e, n] = aoi.bbox as Box;
    return liveData.points
      .filter((p) => pointMs(p) >= nowMs - 168 * 3600_000)
      .map((p) => ({ p, inside: outline ? pointInGeometry(p[0], p[1], outline) : p[0] >= w && p[0] <= e && p[1] >= s && p[1] <= n }));
  }, [liveData, aoi, outline, nowMs]);
  const counts = useMemo(() => (marked ? countLive(marked.filter((x) => x.inside).map((x) => x.p), nowMs) : null), [marked, nowMs]);
  const updatedMs = liveData ? filesUpdatedMs(liveData.sources) : null;
  const byBox = !!marked && !outline;

  // ---- today's photo
  const [photo, setPhoto] = useState<{ key: string; date: string | null }>({ key: '', date: null });
  const cx = aoi?.centroid?.[0], cy = aoi?.centroid?.[1];
  useEffect(() => {
    if (cx == null || cy == null) return undefined;
    let alive = true;
    void newestPhotoDate(cx, cy, Date.now()).then((date) => { if (alive) setPhoto({ key: aoiId, date }); });
    return () => { alive = false; };
  }, [aoiId, cx, cy]);
  const photoKnown = photo.key === aoiId;
  const photoDate = photoKnown ? photo.date : null;

  // ---- this month on the one-scale record
  const locked = useMemo(() => (aoi ? lockedMonths(aoi) : new Set<string>()), [aoi]);
  const monthRow = useMemo(() => {
    if (rows.state !== 'ok') return null;
    for (let i = rows.data.length - 1; i >= 0; i--) {
      const r = rows.data[i]!;
      if (r.H != null && !locked.has(ym(r.year, r.month))) return r;
    }
    return null;
  }, [rows, locked]);
  const earlierYears = useMemo(
    () => (rows.state === 'ok' && monthRow ? rows.data.filter((r) => r.month === monthRow.month && r.year < monthRow.year && r.H != null).length : 0),
    [rows, monthRow]);
  const status = monthRow && earlierYears >= MIN_EARLIER_YEARS ? monthStatus(monthRow.pct_rank) : null;
  const monthFact = (l: Lang): MonthFact | null => (monthRow ? {
    label: monthName(ym(monthRow.year, monthRow.month), l), monthOnly: monthOnly(monthRow.month, l, 'long'),
    H: monthRow.H!, median: monthRow.baseline_median,
    higherPct: monthRow.pct_rank != null && earlierYears >= MIN_EARLIER_YEARS ? Math.round(monthRow.pct_rank * 100) : null,
    status, partial: !!monthRow.flag_partial,
  } : null);
  const mf = monthFact(lang);
  const recordDate = districts.state === 'ok' ? dateOnly(districts.data.generated_at, lang) : null;
  const baseline = districts.state === 'ok' ? districts.data.baseline_period : undefined;

  // ---- cloud history (Central Kalimantan only) and peat sites
  const inKalteng = aoi?.province === KALTENG_PROVINCE;
  const blind = useLoad<BlindRule>(inKalteng ? loadBlindRule : null, `blind:${inKalteng}`);
  const blindRow = blind.state === 'ok' && aoi ? (blind.data as BlindFile).districts?.find((d) => d.name === aoi.name) ?? null : null;
  const blindSeasons = blind.state === 'ok' ? (blind.data.seasons ?? []).filter((x) => x.aug_oct !== false).map((x) => x.year) : [];
  const peatFile = useLoad<unknown>(inKalteng ? () => getJson<unknown>(`${BASE}ka-data/peat_persistence_kalteng.json`) : null, `peat:${inKalteng}`);
  const peatGeo = useLoad<unknown>(inKalteng ? () => getJson<unknown>(`${BASE}ka-data/peat_kalteng.geojson`).catch(async () => {
    // a static host may serve .geojson with a type that is not JSON: read it as text
    const r = await fetch(`${BASE}ka-data/peat_kalteng.geojson`);
    const text = await r.text();
    if (!r.ok || !text.trimStart().startsWith('{')) throw new Error('peat_kalteng.geojson: not found');
    return JSON.parse(text) as unknown;
  }) : null, `peatgeo:${inKalteng}`);
  const peat = useMemo(() => (peatFile.state === 'ok' && aoiId ? peatFor(peatFile.data, aoiId) : null), [peatFile, aoiId]);
  const sites = useMemo(() => peat?.sites ?? [], [peat]);
  const peatOutline = peat && peatGeo.state === 'ok' ? peatGeo.data : null;

  // ---- the level and the messages
  const result = levelOf({ live24: counts?.total24 ?? null, live7: counts?.total7 ?? null, status });
  const [msgLang, setMsgLang] = useState<Lang>('id');
  const [phones, setPhones] = useState({ residents: '', bpbd: '', crew: '' });
  const [copied, setCopied] = useState<string | null>(null);
  const message = (kind: 'residents' | 'bpbd' | 'crew') => buildMessages({
    lang: msgLang, district: aoi ? aoiName(aoi, msgLang) : '', nowMs, level: result.level,
    live: counts && liveData ? { counts, updatedMs, failed: liveData.failed.map((f) => (f === 'N20' || f === 'N21' || f === 'MODIS' ? SENSOR_LABEL[f] : f)) } : null,
    month: monthFact(msgLang), sites, sitesSeason: peat?.season ?? null, phone: phones[kind],
  })[kind];

  // the facts for the optional AI draft: only numbers this page shows; null for what it does not have
  const aiFacts: AiFacts | null = aoi && result.level && monthRow && AI_NAME.test(aoi.name ?? '') && AI_NAME.test(aoi.province ?? '') ? {
    district: aoi.name ?? '', province: aoi.province ?? '', as_of: liveData?.fetched_at ?? null,
    hotspots_24h: counts?.total24 ?? null, hotspots_7d: counts?.total7 ?? null,
    viirs_24h: counts ? counts.by24.N20 + counts.by24.N21 : null, modis_24h: counts?.by24.MODIS ?? null,
    month: ym(monthRow.year, monthRow.month), month_count: monthRow.H, month_median: monthRow.baseline_median, month_ratio: null,
    month_provisional: !!monthRow.flag_nrt || !!monthRow.flag_partial, level: result.level,
    cloud_days_above: blindRow?.district_days_above ?? null, cloud_days_total: blindRow?.district_days ?? null,
    peat_sites: peat?.persistentSites ?? null,
  } : null;
  // the same facts for the AI assistant, plus the only places it may name: the newest hotspot and the peat sites this
  // page lists (public/api/ask.js checks every field again)
  const newestMs = counts?.newest ? pointMs(counts.newest) : NaN;
  const askFacts: AskFacts | null = aiFacts ? {
    ...aiFacts,
    newest: counts?.newest && Number.isFinite(newestMs)
      ? { lat: counts.newest[1], lon: counts.newest[0], time: new Date(newestMs).toISOString(), sensor: counts.newest[4] } : null,
    peat_list: sites.slice(0, 5).map((s) => ({ lat: s.lat, lon: s.lon, days: s.days, come_backs: s.comeBacks })),
    peat_season: peat?.season ?? null,
    level_why: result.why,
  } : null;

  // ---- the picker
  const [q, setQ] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [coordNote, setCoordNote] = useState<string | null>(null);
  const groups = useMemo(() => (list && q.trim().length >= 2 ? searchDistricts(list, q, 12) : []), [list, q]);
  const go = (id: string) => { setQ(''); setCoordNote(null); window.location.hash = view.hrefFor(id); };
  const findByCoord = (ev: FormEvent) => {
    ev.preventDefault();
    const la = Number(lat.replace(',', '.')), lo = Number(lon.replace(',', '.'));
    if (!lat.trim() || !lon.trim() || !Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) {
      setCoordNote(tr('Type a latitude (for example -2.72) and a longitude (for example 113.95).', 'Ketik lintang (misalnya -2.72) dan bujur (misalnya 113.95).'));
      return;
    }
    if (shapes.state !== 'ok') { setCoordNote(tr('The district outlines have not loaded yet.', 'Batas kabupaten belum termuat.')); return; }
    const id = districtAt(lo, la, shapes.data);
    if (!id) { setCoordNote(tr('No district at that point (at sea, or outside Indonesia).', 'Tidak ada kabupaten di titik itu (di laut, atau di luar Indonesia).')); return; }
    go(id);
  };

  useEffect(() => {
    document.title = name ? `${tr('Today', 'Hari ini')}: ${name} · KalenderApi` : `${tr('Today in my district', 'Hari ini di daerah saya')} · KalenderApi`;
  }, [name, tr]);

  const num = (v: number, digits = 0) => fmtNumber(v, lang, digits);
  const place = aoi ? districtTitle(name, lang) : '';
  const levelName = (l: Level) => LEVEL_NAME[l][lang];
  const cut = (i: 0 | 1 | 2) => num(STATUS_CUTS[i] * 100);
  const whyText: Record<typeof result.why, string> = {
    'h24-high': tr(`${num(counts?.total24 ?? 0)} hotspots in the last 24 hours (the rule: ${HIGH_24H} or more).`, `${num(counts?.total24 ?? 0)} titik panas dalam 24 jam terakhir (aturan: ${HIGH_24H} atau lebih).`),
    'month-far-above': tr('This month is far above normal on the one-scale record.', 'Bulan ini jauh di atas normal pada catatan satu skala.'),
    'h24-some': tr(`${num(counts?.total24 ?? 0)} hotspot${counts?.total24 === 1 ? '' : 's'} in the last 24 hours (fewer than ${HIGH_24H}).`, `${num(counts?.total24 ?? 0)} titik panas dalam 24 jam terakhir (kurang dari ${HIGH_24H}).`),
    'd7-some': tr(`No hotspot in the last 24 hours, but ${num(counts?.total7 ?? 0)} in the last 7 days.`, `Tidak ada titik panas dalam 24 jam terakhir, tetapi ada ${num(counts?.total7 ?? 0)} dalam 7 hari terakhir.`),
    'month-above': tr('This month is above normal on the one-scale record.', 'Bulan ini di atas normal pada catatan satu skala.'),
    quiet: tr('No hotspot in the last 7 days, and this month is not above normal.', 'Tidak ada titik panas dalam 7 hari terakhir, dan bulan ini tidak di atas normal.'),
    'no-live': tr('Today\'s hotspots could not be read, so no level is set: "Calm" needs to know them.', 'Titik panas hari ini tidak dapat dibaca, sehingga tingkat tidak ditentukan: "Tenang" memerlukan data itu.'),
  };
  const rules: { level: Level; text: string }[] = [
    { level: 'high', text: tr(`${HIGH_24H} or more hotspots in the district in the last 24 hours, or this month is far above normal on the one-scale record (higher than ${cut(2)}% of the same month in earlier years).`,
      `${HIGH_24H} titik panas atau lebih di kabupaten dalam 24 jam terakhir, atau bulan ini jauh di atas normal pada catatan satu skala (lebih tinggi dari ${cut(2)}% bulan yang sama pada tahun-tahun sebelumnya).`) },
    { level: 'watch', text: tr(`1 to ${HIGH_24H - 1} hotspots in the last 24 hours, or any hotspot in the last 7 days, or this month is above normal (higher than ${cut(1)}% of the same month in earlier years).`,
      `1 sampai ${HIGH_24H - 1} titik panas dalam 24 jam terakhir, atau ada titik panas dalam 7 hari terakhir, atau bulan ini di atas normal (lebih tinggi dari ${cut(1)}% bulan yang sama pada tahun-tahun sebelumnya).`) },
    { level: 'calm', text: tr('No hotspot in the last 7 days, and this month is not above normal. Never set when today\'s hotspots could not be read.',
      'Tidak ada titik panas dalam 7 hari terakhir, dan bulan ini tidak di atas normal. Tidak pernah ditetapkan bila titik panas hari ini tidak dapat dibaca.') },
  ];
  const photoDay = photoDate ? dateOnly(`${photoDate}T00:00:00Z`, lang) : null;
  const liveSource = tr('NASA FIRMS near real time (VIIRS NOAA-20, VIIRS NOAA-21, MODIS)', 'NASA FIRMS waktu hampir nyata (VIIRS NOAA-20, VIIRS NOAA-21, MODIS)');
  const cards: { kind: 'residents' | 'bpbd' | 'crew'; title: string }[] = [
    { kind: 'residents', title: tr('For residents and the village', 'Untuk warga dan desa') },
    { kind: 'bpbd', title: tr('For the district disaster office (BPBD)', 'Untuk BPBD kabupaten') },
    { kind: 'crew', title: tr('For the Manggala Agni crew', 'Untuk regu Manggala Agni') },
  ];

  return {
    tr, lang, hash, asked, districts, aoi, unknownAsked, aoiId, name, box, outline, rows,
    setTick, liveState, liveData, nowMs, marked, counts, updatedMs, byBox, photoKnown, photoDate, photoDay,
    monthRow, earlierYears, mf, recordDate, baseline, blindRow, blindSeasons, peat, sites, peatOutline,
    result, msgLang, setMsgLang, phones, setPhones, copied, setCopied, message, aiFacts, askFacts,
    q, setQ, lat, setLat, lon, setLon, coordNote, groups, go, findByCoord,
    num, place, levelName, cut, whyText, rules, liveSource, cards,
  };
}
export type NowModel = ReturnType<typeof useNowModel>;

/** The classic page: one long page of cards (the address '#/now', lib/todayview.ts). */
export function Now() {
  const {
    tr, lang, asked, districts, aoi, unknownAsked, aoiId, name, box, outline, rows,
    setTick, liveState, liveData, nowMs, marked, counts, updatedMs, byBox, photoKnown, photoDate, photoDay,
    monthRow, earlierYears, mf, recordDate, baseline, blindRow, blindSeasons, peat, sites, peatOutline,
    result, msgLang, setMsgLang, phones, setPhones, copied, setCopied, message, aiFacts, askFacts,
    q, setQ, lat, setLat, lon, setLon, coordNote, groups, go, findByCoord,
    num, place, levelName, cut, whyText, rules, liveSource, cards,
  } = useNowModel({ hrefFor: classicHref });
  // in-page jumps scroll; a "#id" link would change the hash this app routes on
  const jumpTo = (id: string) => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  return (
    <div className="now-page">
      {/* the same top bar as the home sections and the record (components/SiteHeader.tsx) */}
      <SiteHeader current="now" />

      <main className="now-main" id="now-main">
        {/* ---- the title row: where, the level, and a compact district search */}
        <div className="now-titlebar">
          <div className="now-titles">
            <p className="now-kicker">{tr('Today in my district', 'Hari ini di daerah saya')}</p>
            <div className="now-titlerow">
              <h1 className="now-title">{aoi ? place : tr('Loading the districts…', 'Memuat daftar kabupaten…')}</h1>
              {aoi ? (
                <button type="button" className={`now-badge now-badge-${result.level ?? 'none'}`} onClick={() => jumpTo('now-h-act')}>
                  <span>{tr('Level', 'Tingkat')}</span>
                  <b>{liveState.state === 'loading' ? '…' : result.level ? levelName(result.level) : tr('Not set', 'Belum ditentukan')}</b>
                </button>
              ) : null}
            </div>
            {aoi ? (
              <p className="now-sub">{aoi.province}{' · '}{tr('where the hotspots are, how many, and who to tell', 'di mana titik panasnya, berapa banyak, dan siapa yang dikabari')}
                {/* the same district in the three-panel command view (pages/CommandConsole.tsx) */}
                {' · '}<a className="now-viewlink" href={consoleHref(aoiId)}>{tr('Command view', 'Tampilan komando')}</a></p>
            ) : null}
          </div>
          <div className="now-find" role="search" aria-label={tr('Pick the district', 'Pilih kabupaten')}>
            <label htmlFor="now-q">{tr('Change district (514 districts and cities)', 'Ganti kabupaten (514 kabupaten dan kota)')}</label>
            <input id="now-q" type="search" value={q} onChange={(ev) => setQ(ev.target.value)} autoComplete="off"
              placeholder={tr('Search a district, for example Kapuas', 'Cari kabupaten, misalnya Kapuas')} />
            {q.trim().length >= 2 ? (
              groups.length ? (
                <ul className="now-results" aria-label={tr('Matching districts', 'Kabupaten yang cocok')}>
                  {groups.flatMap((g) => g.items.map((d) => (
                    <li key={d.aoi_id}>
                      <button type="button" onClick={() => go(d.aoi_id)}>{aoiName(d, lang)} <small>{g.province}</small></button>
                    </li>
                  )))}
                </ul>
              ) : <p className="now-small" role="status">{tr('No district matches.', 'Tidak ada kabupaten yang cocok.')}</p>
            ) : null}
            <details className="now-more">
              <summary>{tr('Or find by latitude and longitude', 'Atau cari dengan lintang dan bujur')}</summary>
              <form onSubmit={findByCoord} className="now-coord" aria-label={tr('Find the district of a point', 'Cari kabupaten dari satu titik')}>
                <div><label htmlFor="now-lat">{tr('Latitude', 'Lintang')}</label><input id="now-lat" inputMode="decimal" value={lat} onChange={(ev) => setLat(ev.target.value)} placeholder="-2.72" /></div>
                <div><label htmlFor="now-lon">{tr('Longitude', 'Bujur')}</label><input id="now-lon" inputMode="decimal" value={lon} onChange={(ev) => setLon(ev.target.value)} placeholder="113.95" /></div>
                <button type="submit" className="now-btn">{tr('Find the district', 'Cari kabupaten')}</button>
                {coordNote ? <p className="now-small now-coord-note" role="status">{coordNote}</p> : null}
              </form>
            </details>
          </div>
        </div>
        {districts.state === 'error' || districts.state === 'missing' ? (
          <p className="now-alert" role="alert">{tr('The district list could not be loaded, so this page cannot show a district.', 'Daftar kabupaten tidak dapat dimuat, sehingga halaman ini tidak dapat menampilkan kabupaten.')}</p>
        ) : null}
        {unknownAsked ? <p className="now-note" role="note">{tr(`No district "${asked}" in the record; showing ${name}.`, `Tidak ada kabupaten "${asked}" dalam catatan; menampilkan ${name}.`)}</p> : null}

        {aoi && box ? (
          <>
            {/* ---- right now */}
            <section className="now-card now-hero" aria-labelledby="now-h-now">
              <div className="now-hero-grid">
              {/* LEFT: what to do now, for the disaster office. Rows chosen by the level and by what the page holds. */}
              <div className="now-act" role="group" aria-labelledby="now-h-act">
                <p className="now-kicker">{tr('For the disaster office (BPBD)', 'Untuk BPBD kabupaten')}</p>
                <h2 id="now-h-act">{tr('What to do now', 'Yang dilakukan sekarang')}</h2>
                <div className={`now-level now-level-${result.level ?? 'none'}`}>
                  <p className="now-level-label">{tr('Level', 'Tingkat')}</p>
                  <p className="now-level-name">{liveState.state === 'loading' ? '…' : result.level ? levelName(result.level) : tr('Not set', 'Belum ditentukan')}</p>
                  <p className="now-level-why">{liveState.state === 'loading' ? tr('Reading the hotspots…', 'Membaca titik panas…') : whyText[result.why]}</p>
                </div>
                <ol className="now-todo">
                  {liveState.state === 'unavailable' ? (
                    <li>
                      <b>{tr('Read the hotspots again', 'Baca ulang titik panas')}</b>
                      <span>{tr('Live hotspots could not be read, so no level is set.', 'Titik panas langsung tidak dapat dibaca, sehingga tingkat belum ditentukan.')}</span>
                      <button type="button" className="now-btn now-btn-quiet" onClick={() => setTick((t) => t + 1)}>{tr('Read again', 'Baca ulang')}</button>
                    </li>
                  ) : null}
                  {counts?.newest ? (
                    <li>
                      <b>{tr('Check the newest hotspot on the ground', 'Cek titik panas terbaru di lapangan')}</b>
                      <span className="now-todo-fact">{counts.newest[1].toFixed(4)}, {counts.newest[0].toFixed(4)} · {wib(pointMs(counts.newest), lang)} · {SENSOR_LABEL[counts.newest[4]]}</span>
                      <button type="button" className="now-btn now-btn-quiet"
                        onClick={() => { const n = counts.newest; if (n) void copyText(`${n[1].toFixed(4)}, ${n[0].toFixed(4)}`).then((ok) => setCopied(ok ? 'coord' : 'fail-coord')); }}>
                        {copied === 'coord' ? tr('Copied', 'Tersalin') : tr('Copy coordinates', 'Salin koordinat')}
                      </button>
                    </li>
                  ) : null}
                  {sites[0] ? (
                    <li>
                      <b>{tr('Re-check peat where fire came back', 'Cek ulang gambut tempat api muncul lagi')}</b>
                      <span className="now-todo-fact">{sites[0].lat.toFixed(3)}, {sites[0].lon.toFixed(3)} · {tr(`detected on ${num(sites[0].days)} days, came back ${num(sites[0].comeBacks)} time${sites[0].comeBacks === 1 ? '' : 's'}`, `terdeteksi ${num(sites[0].days)} hari, muncul lagi ${num(sites[0].comeBacks)} kali`)}</span>
                      <button type="button" className="now-btn now-btn-quiet" onClick={() => jumpTo('now-h-peat')}>{tr('See the peat list', 'Lihat daftar gambut')}</button>
                    </li>
                  ) : null}
                  {result.level === 'calm' ? (
                    <li><b>{tr('No alert needed today; keep the routine patrol', 'Hari ini tidak perlu peringatan; lanjutkan patroli rutin')}</b></li>
                  ) : result.level ? (
                    <li>
                      <b>{tr('Tell the village', 'Kabari desa')}</b>
                      <span>{whyText[result.why]}</span>
                      <button type="button" className="now-btn now-btn-primary now-btn-quiet" onClick={() => jumpTo('now-alert-loop')}>{tr('Open the alert', 'Buka peringatan')}</button>
                    </li>
                  ) : null}
                  <li>
                    <b>{tr('On a clouded day, report "not observed", not "no hotspots"', 'Pada hari berawan, laporkan "tidak teramati", bukan "tidak ada titik panas"')}</b>
                    <span>{blindRow
                      ? tr(`Cloud hid most of this district on ${num(blindRow.district_days_above)} of ${num(blindRow.district_days)} district-days (${num(blindRow.share_pct, 1)}%) of past August to October seasons.`, `Awan menutupi sebagian besar kabupaten ini pada ${num(blindRow.district_days_above)} dari ${num(blindRow.district_days)} hari-kabupaten (${num(blindRow.share_pct, 1)}%) pada musim Agustus sampai Oktober yang lalu.`)
                      : tr('Under cloud a satellite cannot see the ground.', 'Di bawah awan satelit tidak dapat melihat permukaan tanah.')}</span>
                  </li>
                </ol>
                <p className="now-small">{tr('These are KalenderApi\'s suggestions from the rules on this page, not an official procedure.', 'Ini saran KalenderApi dari aturan di halaman ini, bukan prosedur resmi.')}</p>
              </div>
              <div className="now-figs">
              <div className="now-head">
                <h2 id="now-h-now" className="now-eyebrow">{tr('The evidence', 'Buktinya')}</h2>
                <button type="button" className="now-btn now-btn-quiet" onClick={() => setTick((t) => t + 1)} disabled={liveState.state === 'loading'}>
                  {liveState.state === 'loading' ? tr('Reading…', 'Membaca…') : tr('Read again', 'Baca ulang')}
                </button>
              </div>
              {liveState.state === 'loading' ? <p role="status">{tr('Reading the newest NASA hotspot files…', 'Membaca berkas titik panas NASA terbaru…')}</p> : null}
              {liveState.state === 'unavailable' ? (
                <div className="now-alert" role="alert">
                  <p><b>{tr('Live hotspots could not be read.', 'Titik panas langsung tidak dapat dibaca.')}</b>{' '}
                    {liveState.why === 'no-function'
                      ? tr('This copy of the site runs without the live-data function (/api/live), so it cannot read NASA\'s near-real-time files.', 'Salinan situs ini berjalan tanpa fungsi data langsung (/api/live), sehingga tidak dapat membaca berkas waktu hampir nyata NASA.')
                      : tr(`NASA's near-real-time files did not answer (${liveState.detail}).`, `Berkas waktu hampir nyata NASA tidak menjawab (${liveState.detail}).`)}
                    {' '}{tr('The map below has no hotspots because the data did not load, not because there is no fire.', 'Peta di bawah tidak memuat titik panas karena datanya tidak termuat, bukan karena tidak ada api.')}
                  </p>
                  {mf ? (
                    <p>{tr(`Shown instead, the newest month of our own record: ${mf.label}${mf.partial ? ' (still running)' : ''}, ${num(mf.H, 1)} fire cell-days in ${place} on the one MODIS and VIIRS scale${recordDate ? `; record built ${recordDate}` : ''}.`,
                      `Sebagai gantinya, bulan terbaru dari catatan kami sendiri: ${mf.label}${mf.partial ? ' (masih berjalan)' : ''}, ${num(mf.H, 1)} sel-hari api di ${place} pada satu skala MODIS dan VIIRS${recordDate ? `; catatan dibuat ${recordDate}` : ''}.`)}</p>
                  ) : null}
                </div>
              ) : null}
              {counts && liveData ? (
                <>
                  <div className="now-stats">
                    {([['24', counts.total24, counts.by24], ['7', counts.total7, counts.by7]] as const).map(([k, total, by]) => (
                      <div className="now-stat" key={k}>
                        <p className="now-stat-label">{k === '24' ? tr('Hotspots, last 24 hours', 'Titik panas, 24 jam terakhir') : tr('Hotspots, last 7 days', 'Titik panas, 7 hari terakhir')}</p>
                        <p className="now-stat-value">{num(total)}</p>
                        <ul className="now-by">
                          {SENSORS.map((sn) => (
                            <li key={sn}><i className={`now-dot ${sn === 'MODIS' ? 'now-dot-modis' : 'now-dot-viirs'}`} aria-hidden="true" />{SENSOR_LABEL[sn]}: <b>{num(by[sn])}</b>
                              {liveData.failed.includes(sn) ? <em> {tr('(file not read)', '(berkas tidak terbaca)')}</em> : null}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    <div className="now-stat">
                      <p className="now-stat-label">{tr('Newest detection in the district', 'Deteksi terbaru di kabupaten')}</p>
                      <p className="now-stat-value now-stat-time">{counts.newest ? wib(pointMs(counts.newest), lang) : tr('none in 7 days', 'tidak ada dalam 7 hari')}</p>
                      {counts.newest ? <p className="now-small">{SENSOR_LABEL[counts.newest[4]]}{counts.newest[2] != null ? `, ${num(counts.newest[2], 1)} MW` : ''}</p> : null}
                      <p className="now-stat-label now-stat-label-2">{tr('NASA files last updated', 'Berkas NASA terakhir diperbarui')}</p>
                      <p className="now-small"><b>{updatedMs != null ? wib(updatedMs, lang) : tr('not stated', 'tidak disebutkan')}</b></p>
                    </div>
                  </div>
                  <p className="now-src">
                    {tr(`NASA FIRMS, read ${wib(nowMs, lang)}.`, `NASA FIRMS, dibaca ${wib(nowMs, lang)}.`)}
                    {liveData.failed.length ? ' ' + tr(`Not read this time: ${liveData.failed.join(', ')}; its count is unknown, not zero.`, `Tidak terbaca kali ini: ${liveData.failed.join(', ')}; jumlahnya tidak diketahui, bukan nol.`) : ''}
                  </p>
                  <details className="now-more">
                    <summary>{tr('How this is counted', 'Cara menghitungnya')}</summary>
                    <p className="now-src">
                      {tr(`Unit: hotspots (one satellite detection of heat; not a fire count and not burned area). Source: ${liveSource}; VIIRS confidence nominal or high, MODIS confidence 30 or more. Read ${wib(nowMs, lang)}; counted by detection time in the 24 hours and the 7 days before that, inside the ${byBox ? 'bounding box of the district (the outline did not load)' : 'district outline'}.`,
                        `Satuan: titik panas (satu deteksi panas oleh satelit; bukan jumlah kebakaran dan bukan luas terbakar). Sumber: ${liveSource}; keyakinan VIIRS nominal atau tinggi, keyakinan MODIS 30 atau lebih. Dibaca ${wib(nowMs, lang)}; dihitung menurut waktu deteksi dalam 24 jam dan 7 hari sebelumnya, di dalam ${byBox ? 'kotak batas kabupaten (garis batas tidak termuat)' : 'garis batas kabupaten'}.`)}
                    </p>
                  </details>
                </>
              ) : null}
              {/* the science, as tiles: this month on one scale, whether a zero can be trusted, peat */}
              <div className="now-stats now-tiles">
                {mf ? (
                  <div className="now-stat">
                    <p className="now-stat-label">{tr('This month on one scale (MODIS + VIIRS)', 'Bulan ini pada satu skala (MODIS + VIIRS)')}</p>
                    <p className="now-stat-value now-stat-mid">{num(mf.H, 1)} {mf.status ? <span className={`now-chip now-chip-${mf.status}`}>{STATUS_NAME[mf.status][lang]}</span> : null}</p>
                    <p className="now-small">{tr(`fire cell-days, ${mf.label}${mf.partial ? ' so far' : ''}`, `sel-hari api, ${mf.label}${mf.partial ? ' sejauh ini' : ''}`)}{mf.median != null ? tr(`; the usual ${mf.monthOnly}: ${num(mf.median, mf.median % 1 ? 1 : 0)}`, `; ${mf.monthOnly} biasanya: ${num(mf.median, mf.median % 1 ? 1 : 0)}`) : ''}</p>
                  </div>
                ) : null}
                <div className="now-stat">
                  <p className="now-stat-label">{tr('Can a zero be trusted here?', 'Apakah nol bisa dipercaya di sini?')}</p>
                  {blindRow ? (
                    <>
                      <p className="now-stat-value now-stat-mid">{num(blindRow.share_pct, 1)}%</p>
                      <p className="now-small">{tr(`of past Aug to Oct district-days were mostly under cloud (${num(blindRow.district_days_above)} of ${num(blindRow.district_days)})`, `hari-kabupaten Agu sampai Okt yang lalu sebagian besar tertutup awan (${num(blindRow.district_days_above)} dari ${num(blindRow.district_days)})`)}</p>
                    </>
                  ) : <p className="now-small">{tr('No cloud history layer for this district. Judge cloud from the photo on the map.', 'Belum ada lapisan riwayat awan untuk kabupaten ini. Nilai awan dari foto pada peta.')}</p>}
                </div>
                {peat ? (
                  <div className="now-stat">
                    <p className="now-stat-label">{tr('Peat', 'Gambut')}</p>
                    <p className="now-stat-value now-stat-mid">{peat.persistentSites != null ? num(peat.persistentSites) : num(peat.sites.length)}</p>
                    <p className="now-small">
                      {tr(`persistent peat sites, Aug to Oct ${peat.season ?? ''}${peat.provisional ? ' (provisional)' : ''}`, `lokasi gambut persisten, Agu sampai Okt ${peat.season ?? ''}${peat.provisional ? ' (sementara)' : ''}`)}
                      {peat.comeBacks ? tr(`; fire detected again after a gap ${num(peat.comeBacks.total)} times`, `; api terdeteksi lagi setelah jeda ${num(peat.comeBacks.total)} kali`) : ''}
                    </p>
                    <button type="button" className="now-btn now-btn-quiet" onClick={() => jumpTo('now-h-peat')}>{tr('See the peat list', 'Lihat daftar gambut')}</button>
                  </div>
                ) : null}
              </div>
              </div>

              <div className="now-mapside">
              <div className="now-mapwrap">
                <NowMap key={aoiId} box={box} outline={outline} points={marked} photoDate={photoDate} sites={sites} peat={peatOutline}
                  label={tr(`Map of ${place}: hotspots of the last 7 days over NASA's newest photo`, `Peta ${place}: titik panas 7 hari terakhir di atas foto NASA terbaru`)} />
                {liveState.state === 'unavailable' ? (
                  <p className="now-map-flag">{tr('No live hotspot data: an empty map here does not mean no fire.', 'Tidak ada data titik panas langsung: peta kosong di sini tidak berarti tidak ada api.')}</p>
                ) : null}
              </div>
              <ul className="now-legend" aria-label={tr('Legend', 'Legenda')}>
                <li><i className="now-dot now-dot-viirs" aria-hidden="true" />VIIRS (NOAA-20, NOAA-21)</li>
                <li><i className="now-dot now-dot-modis" aria-hidden="true" />MODIS</li>
                <li><i className="now-dot now-dot-viirs now-dot-out" aria-hidden="true" />{tr('faint: outside the district (not counted)', 'pudar: di luar kabupaten (tidak dihitung)')}</li>
                <li><i className="now-line" aria-hidden="true" />{tr('district outline', 'batas kabupaten')}</li>
                {peatOutline ? <li><i className="now-line now-line-peat" aria-hidden="true" />{tr('peat outline', 'batas gambut')}</li> : null}
                {sites.length ? <li><i className="now-ring" aria-hidden="true" />{tr('peat site to re-check', 'lokasi gambut untuk dicek ulang')}</li> : null}
              </ul>
              </div>
              </div>
              <details className="now-more">
                <summary>{tr('About the photo and the map', 'Tentang foto dan peta')}</summary>
              <p className="now-src">
                {!photoKnown ? tr('Looking for NASA\'s newest photo…', 'Mencari foto NASA terbaru…')
                  : photoDay ? tr(`Photo: VIIRS NOAA-20 true colour of ${photoDay} (UTC day), the early-afternoon pass, from NASA GIBS. White is cloud; black wedges are gaps between passes. Hotspots are of the last 7 days, so some are older than the photo.`,
                    `Foto: warna asli VIIRS NOAA-20 tanggal ${photoDay} (hari UTC), lintasan awal siang, dari NASA GIBS. Putih adalah awan; baji hitam adalah celah antar lintasan. Titik panas berasal dari 7 hari terakhir, jadi sebagian lebih lama daripada foto.`)
                    : tr('NASA\'s photo of today and of the two days before could not be loaded, so the map has no photo. Cloud cannot be judged here.', 'Foto NASA hari ini dan dua hari sebelumnya tidak dapat dimuat, sehingga peta tidak memuat foto. Awan tidak dapat dinilai di sini.')}
                {' '}{tr('Zoom with the + and − buttons, or Ctrl + wheel; drag to move (two fingers on a phone); with the keyboard, focus the map and use the arrow, + and − keys. Imagery: NASA GIBS. District boundary: geoBoundaries (BPS, WFP, OCHA ROAP), CC BY 3.0 IGO.', 'Perbesar dengan tombol + dan −, atau Ctrl + roda; seret untuk menggeser (dua jari di ponsel); dengan papan ketik, fokuskan peta lalu pakai tombol panah, + dan −. Citra: NASA GIBS. Batas kabupaten: geoBoundaries (BPS, WFP, OCHA ROAP), CC BY 3.0 IGO.')}
              </p>
              </details>


              {counts && counts.recent.length ? (
                <div className="now-scroll" tabIndex={0} role="region" aria-label={tr('Newest hotspots in the district', 'Titik panas terbaru di kabupaten')}>
                  <table className="now-table">
                    <caption>{tr(`Newest hotspots in the district (${Math.min(TABLE_ROWS, counts.recent.length)} of ${counts.recent.length} in 7 days)`, `Titik panas terbaru di kabupaten (${Math.min(TABLE_ROWS, counts.recent.length)} dari ${counts.recent.length} dalam 7 hari)`)}</caption>
                    <thead><tr>
                      <th scope="col">{tr('Detected (WIB)', 'Terdeteksi (WIB)')}</th><th scope="col">{tr('Satellite', 'Satelit')}</th>
                      <th scope="col">{tr('Latitude', 'Lintang')}</th><th scope="col">{tr('Longitude', 'Bujur')}</th>
                      <th scope="col">{tr('Fire power (MW)', 'Daya api (MW)')}</th><th scope="col">{tr('Day or night', 'Siang atau malam')}</th>
                    </tr></thead>
                    <tbody>
                      {counts.recent.slice(0, TABLE_ROWS).map((p, i) => (
                        <tr key={i}>
                          <td>{wib(pointMs(p), lang).replace(' WIB', '')}</td><td>{SENSOR_LABEL[p[4]]}</td>
                          <td className="num">{p[1].toFixed(4)}</td><td className="num">{p[0].toFixed(4)}</td>
                          <td className="num">{p[2] != null ? num(p[2], 1) : '–'}</td><td>{p[3] === 'N' ? tr('night', 'malam') : tr('day', 'siang')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>

            {/* ---- is this normal? */}
            <section className="now-card" aria-labelledby="now-h-normal">
              <h2 id="now-h-normal">{tr('Is this normal?', 'Apakah ini normal?')}</h2>
              {rows.state === 'loading' ? <p role="status">{tr('Loading the district record…', 'Memuat catatan kabupaten…')}</p> : null}
              {rows.state === 'error' || rows.state === 'missing' ? <p className="now-note" role="note">{tr('The district\'s monthly record could not be loaded.', 'Catatan bulanan kabupaten tidak dapat dimuat.')}</p> : null}
              {mf ? (
                <>
                  <p className="now-verdict">
                    {mf.status ? <span className={`now-chip now-chip-${mf.status}`}>{STATUS_NAME[mf.status][lang]}</span> : <span className="now-chip">{tr('no label', 'tanpa label')}</span>}
                    <span>
                      {tr(`${mf.label}${mf.partial ? ' so far' : ''}: ${num(mf.H, 1)} fire cell-days in ${place} on the one-scale record.`,
                        `${mf.label}${mf.partial ? ' sejauh ini' : ''}: ${num(mf.H, 1)} sel-hari api di ${place} pada catatan satu skala.`)}
                    </span>
                  </p>
                  <details className="now-more">
                    <summary>{tr('How this is counted', 'Cara menghitungnya')}</summary>
                  <p>
                    {mf.median != null ? tr(`The median ${mf.monthOnly}${baseline ? ` (${baseline[0]} to ${baseline[1]})` : ''} has ${num(mf.median, mf.median % 1 ? 1 : 0)}. `, `Median ${mf.monthOnly}${baseline ? ` (${baseline[0]} sampai ${baseline[1]})` : ''} adalah ${num(mf.median, mf.median % 1 ? 1 : 0)}. `) : ''}
                    {mf.higherPct != null ? tr(`This month is higher than ${num(mf.higherPct)}% of the ${earlierYears} earlier ${mf.monthOnly}s on record (ties count half). `, `Bulan ini lebih tinggi dari ${num(mf.higherPct)}% dari ${earlierYears} ${mf.monthOnly} sebelumnya dalam catatan (nilai sama dihitung setengah). `)
                      : tr(`There are fewer than ${MIN_EARLIER_YEARS} earlier years of this month, so no label is given. `, `Tahun sebelumnya untuk bulan ini kurang dari ${MIN_EARLIER_YEARS}, sehingga tidak diberi label. `)}
                    {tr(`Labels: below normal under ${cut(0)}%, near normal under ${cut(1)}%, above normal under ${cut(2)}%, far above normal from ${cut(2)}%.`, `Label: di bawah normal bila kurang dari ${cut(0)}%, mendekati normal bila kurang dari ${cut(1)}%, di atas normal bila kurang dari ${cut(2)}%, jauh di atas normal mulai ${cut(2)}%.`)}
                    {mf.partial ? ' ' + tr('The month is still running, so its count can still rise.', 'Bulan ini masih berjalan, sehingga angkanya masih bisa naik.') : ''}
                  </p>
                  <p className="now-why">
                    {tr('Why one scale: MODIS and VIIRS count fire differently (VIIRS sees smaller fires), so a raw count from today\'s satellites cannot be set beside a count from 2005. Only a single harmonized scale lets this month be compared with 25 years.',
                      'Mengapa satu skala: MODIS dan VIIRS menghitung api secara berbeda (VIIRS melihat api yang lebih kecil), sehingga hitungan mentah dari satelit hari ini tidak dapat disandingkan dengan hitungan tahun 2005. Hanya satu skala terharmonisasi yang memungkinkan bulan ini dibandingkan dengan 25 tahun.')}
                  </p>
                  <p className="now-src">
                    {tr(`Unit: fire cell-days (a 0.01 degree cell with a hotspot on one day), MODIS and VIIRS harmonized to one scale. District values are an approximate share-out of the province record. Source: NASA FIRMS archives, KalenderApi record${recordDate ? ` built ${recordDate}` : ''}${monthRow?.flag_nrt ? '; this month is near-real-time data, provisional' : ''}.`,
                      `Satuan: sel-hari api (sel 0,01 derajat dengan titik panas pada satu hari), MODIS dan VIIRS diharmonisasi ke satu skala. Nilai kabupaten adalah pembagian perkiraan dari catatan provinsi. Sumber: arsip NASA FIRMS, catatan KalenderApi${recordDate ? ` dibuat ${recordDate}` : ''}${monthRow?.flag_nrt ? '; bulan ini data waktu hampir nyata, sementara' : ''}.`)}
                  </p>
                  </details>
                </>
              ) : rows.state === 'ok' ? <p className="now-note" role="note">{tr('The record has no value for this district yet.', 'Catatan belum memuat nilai untuk kabupaten ini.')}</p> : null}
            </section>

            {/* ---- can today's zero be believed? */}
            <section className="now-card" aria-labelledby="now-h-zero">
              <h2 id="now-h-zero">{tr('Can today\'s zero be believed?', 'Apakah nol hari ini bisa dipercaya?')}</h2>
              <p>
                {counts
                  ? counts.total24 === 0
                    ? tr('The satellites recorded zero hotspots in this district in the last 24 hours.', 'Satelit mencatat nol titik panas di kabupaten ini dalam 24 jam terakhir.')
                    : tr(`The satellites recorded ${num(counts.total24)} hotspot${counts.total24 === 1 ? '' : 's'} in this district in the last 24 hours; everywhere else in it they recorded none.`, `Satelit mencatat ${num(counts.total24)} titik panas di kabupaten ini dalam 24 jam terakhir; di bagian lain kabupaten tidak ada yang tercatat.`)
                  : tr('Today\'s hotspots could not be read here.', 'Titik panas hari ini tidak dapat dibaca di sini.')}
                {' '}<b>{tr('Under cloud, no hotspot means not seen, not no fire.', 'Di bawah awan, tidak ada titik panas berarti tidak terlihat, bukan tidak ada api.')}</b>
              </p>
              <details className="now-more">
                <summary>{tr('How to read a zero', 'Cara membaca angka nol')}</summary>
              <p>
                {photoDay
                  ? tr(`Look at the photo of ${photoDay} above. Where the district is white with cloud, a satellite could not see the ground, so no hotspot there does not mean no fire: it means not seen. Where the ground is clear in the photo, a zero is more believable, though small or smouldering peat fires can still be missed.`,
                    `Lihat foto tanggal ${photoDay} di atas. Di bagian kabupaten yang putih tertutup awan, satelit tidak dapat melihat permukaan tanah, sehingga tidak adanya titik panas di sana tidak berarti tidak ada api: artinya tidak terlihat. Di bagian yang permukaannya tampak jelas pada foto, nol lebih dapat dipercaya, meskipun api kecil atau bara gambut masih bisa terlewat.`)
                  : tr('Under cloud a satellite cannot see the ground, so no hotspot there does not mean no fire: it means not seen. Without a photo, cloud cannot be judged on this page.',
                    'Di bawah awan satelit tidak dapat melihat permukaan tanah, sehingga tidak adanya titik panas di sana tidak berarti tidak ada api: artinya tidak terlihat. Tanpa foto, awan tidak dapat dinilai di halaman ini.')}
              </p>
              {blindRow && blindSeasons.length ? (
                <p>
                  {tr(`History of this district: in ${num(blindRow.district_days_above)} of ${num(blindRow.district_days)} district-days (${num(blindRow.share_pct, 1)}%) of ${blindSeasons.length} past August to October seasons (${Math.min(...blindSeasons)} to ${Math.max(...blindSeasons)}), cloud left more than half of the district's no-fire cells with no cloud-free look from MODIS on Terra or Aqua.`,
                    `Riwayat kabupaten ini: pada ${num(blindRow.district_days_above)} dari ${num(blindRow.district_days)} hari-kabupaten (${num(blindRow.share_pct, 1)}%) dalam ${blindSeasons.length} musim Agustus sampai Oktober yang lalu (${Math.min(...blindSeasons)} sampai ${Math.max(...blindSeasons)}), awan membuat lebih dari separuh sel tanpa api di kabupaten ini tidak mendapat pandangan bebas awan dari MODIS pada Terra atau Aqua.`)}
                  {' '}{tr('Thick smoke is not flagged as cloud, so this is a lower bound. The 2019 season is not in this count: a test registered in advance covers it.', 'Asap tebal tidak ditandai sebagai awan, sehingga angka ini adalah batas bawah. Musim 2019 tidak masuk hitungan ini: musim itu dicakup oleh uji yang didaftarkan lebih dulu.')}
                  {' '}<span className="now-src-inline">{tr('Source: NASA MOD14A1 and MYD14A1 daily FireMask.', 'Sumber: FireMask harian NASA MOD14A1 dan MYD14A1.')}</span>
                </p>
              ) : null}
              </details>
            </section>

            {/* ---- peat sites to re-check */}
            {peat ? (
              <section className="now-card" aria-labelledby="now-h-peat">
                <div className="now-head">
                  <h2 id="now-h-peat">{tr('Peat sites to re-check', 'Lokasi gambut untuk dicek ulang')}</h2>
                  <button type="button" className="now-btn now-btn-quiet"
                    onClick={() => saveText(peatCsv(peat, aoi.name ?? aoiId, aoiId, new Date().toISOString().slice(0, 10)), `kalenderapi_peat_sites_${aoiId}_${peat.season ?? 'season'}.csv`)}>
                    {tr(`Download CSV (${peat.sites.length} sites)`, `Unduh CSV (${peat.sites.length} lokasi)`)}
                  </button>
                </div>
                <p className="now-why">
                  {tr('On peat, fire came back at these places after days when the satellite had a clear look and detected nothing. Places like this are worth a ground re-check.',
                    'Di lahan gambut, api muncul lagi di tempat-tempat ini setelah hari-hari ketika satelit mendapat pandangan jelas dan tidak mendeteksi apa pun. Tempat seperti ini layak dicek ulang di lapangan.')}
                </p>
                <details className="now-more">
                  <summary>{tr('How this is counted', 'Cara menghitungnya')}</summary>
                <p>
                  {tr(`${place}, August to October ${peat.season ?? ''} season${peat.provisional ? ' (near-real-time data, provisional)' : ''}.`,
                    `${place}, musim Agustus sampai Oktober ${peat.season ?? ''}${peat.provisional ? ' (data waktu hampir nyata, sementara)' : ''}.`)}
                  {peat.persistentSites != null ? ' ' + tr(`${num(peat.persistentSites)} peat cells of about 1.1 km had fire detected on three or more days, or again after a gap of two or more days.`, `${num(peat.persistentSites)} sel gambut berukuran sekitar 1,1 km mencatat api pada tiga hari atau lebih, atau lagi setelah jeda dua hari atau lebih.`) : ''}
                  {peat.comeBacks ? ' ' + tr(`Fire was detected again after a gap ${num(peat.comeBacks.total)} times: ${num(peat.comeBacks.seenQuiet)} after days with a clear look and nothing detected, ${num(peat.comeBacks.underCloud)} after days under cloud only, and ${num(peat.comeBacks.modisFire)} where MODIS did detect fire during the gap${peat.comeBacks.noData ? `; ${num(peat.comeBacks.noData)} had no usable look` : ''}.`,
                    `Api terdeteksi lagi setelah jeda sebanyak ${num(peat.comeBacks.total)} kali: ${num(peat.comeBacks.seenQuiet)} setelah hari-hari dengan pandangan jelas tanpa deteksi, ${num(peat.comeBacks.underCloud)} setelah hari-hari yang seluruhnya berawan, dan ${num(peat.comeBacks.modisFire)} ketika MODIS mendeteksi api selama jeda${peat.comeBacks.noData ? `; ${num(peat.comeBacks.noData)} tanpa pandangan yang dapat dipakai` : ''}.`) : ''}
                  {' '}{tr(`The ${Math.min(SITE_ROWS, peat.sites.length)} sites with the most days are listed; the CSV has ${peat.sites.length}.`, `${Math.min(SITE_ROWS, peat.sites.length)} lokasi dengan hari terbanyak ditampilkan; berkas CSV memuat ${peat.sites.length}.`)}
                </p>
                </details>
                <div className="now-scroll" tabIndex={0} role="region" aria-label={tr('Peat sites to re-check', 'Lokasi gambut untuk dicek ulang')}>
                  <table className="now-table">
                    <thead><tr>
                      <th scope="col">#</th><th scope="col">{tr('Latitude', 'Lintang')}</th><th scope="col">{tr('Longitude', 'Bujur')}</th>
                      <th scope="col">{tr('Days detected', 'Hari terdeteksi')}</th><th scope="col">{tr('First date', 'Tanggal pertama')}</th><th scope="col">{tr('Last date', 'Tanggal terakhir')}</th>
                      <th scope="col">{tr('Came back (times)', 'Muncul lagi (kali)')}</th><th scope="col">{tr('Detected at night', 'Terdeteksi malam hari')}</th>
                    </tr></thead>
                    <tbody>
                      {peat.sites.slice(0, SITE_ROWS).map((x, i) => (
                        <tr key={`${x.lon},${x.lat}`}>
                          <td className="num">{i + 1}</td><td className="num">{x.lat.toFixed(3)}</td><td className="num">{x.lon.toFixed(3)}</td>
                          <td className="num">{num(x.days)}</td><td>{x.first ?? '–'}</td><td>{x.last ?? '–'}</td>
                          <td className="num">{num(x.comeBacks)}</td><td className="num">{x.nightShare != null ? `${num(x.nightShare * 100)}%` : '–'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="now-src">
                  {tr('Limits: a clear look by MODIS can still miss a small or smouldering fire, and thick smoke is usually not flagged as cloud. This is a list of candidates for a ground check, not confirmed fire. It is exploratory (written after looking at the data), it does not say fire was present during a gap, and it is not a forecast. Coordinates are the centre of a 0.01 degree cell; a gap is two or more days in a row with no VIIRS detection; "detected at night" is the share of the cell\'s detections made at night. Source: NASA FIRMS VIIRS S-NPP 375 m, NASA MODIS FireMask (Terra and Aqua), Global Forest Watch Indonesia peat lands.',
                    'Batasan: pandangan jelas oleh MODIS masih bisa melewatkan api kecil atau bara, dan asap tebal biasanya tidak ditandai sebagai awan. Ini daftar kandidat untuk dicek di lapangan, bukan kebakaran yang terkonfirmasi. Sifatnya eksploratif (ditulis setelah melihat data), tidak menyatakan ada api selama jeda, dan bukan prakiraan. Koordinat adalah titik tengah sel 0,01 derajat; jeda adalah dua hari berturut-turut atau lebih tanpa deteksi VIIRS; "terdeteksi malam hari" adalah bagian deteksi sel itu yang terjadi pada malam hari. Sumber: NASA FIRMS VIIRS S-NPP 375 m, NASA MODIS FireMask (Terra dan Aqua), lahan gambut Indonesia dari Global Forest Watch.')}
                  {peat.generated ? ' ' + tr(`File built ${dateOnly(peat.generated, lang) ?? peat.generated}.`, `Berkas dibuat ${dateOnly(peat.generated, lang) ?? peat.generated}.`) : ''}
                </p>
              </section>
            ) : null}

            {/* ---- what to do, and who to tell */}
            <section className="now-card" aria-labelledby="now-h-do">
              <h2 id="now-h-do">{tr('What to do, and who to tell', 'Apa yang dilakukan, dan siapa yang dikabari')}</h2>
              <div className={`now-level now-level-${result.level ?? 'none'}`}>
                <p className="now-level-label">{tr('Level', 'Tingkat')}</p>
                <p className="now-level-name">{liveState.state === 'loading' ? '…' : result.level ? levelName(result.level) : tr('Not set', 'Belum ditentukan')}</p>
                <p className="now-level-why">{liveState.state === 'loading' ? tr('Reading the hotspots…', 'Membaca titik panas…') : whyText[result.why]}</p>
              </div>
              <p className="now-small">{tr('KalenderApi\'s own level, not an official government status.', 'Tingkat milik KalenderApi sendiri, bukan status resmi pemerintah.')}</p>
              <details className="now-more">
                <summary>{tr('How the level is set', 'Cara tingkat ditetapkan')}</summary>
              <p className="now-note" role="note">
                {tr('These three levels are KalenderApi\'s own, from the rules below. They are not an official government status and not a forecast.',
                  'Tiga tingkat ini milik KalenderApi sendiri, dari aturan di bawah. Ini bukan status resmi pemerintah dan bukan prakiraan.')}
              </p>
              <ul className="now-rules">
                {rules.map((r) => (
                  <li key={r.level} className={r.level === result.level ? 'is-on' : undefined} aria-current={r.level === result.level ? 'true' : undefined}>
                    <b>{levelName(r.level)}</b> <span>{r.text}</span>
                  </li>
                ))}
              </ul>
              </details>

              <div className="now-head now-head-msg">
                <h3>{tr('Three messages, ready to send', 'Tiga pesan, siap dikirim')}</h3>
                <div className="now-seg" role="group" aria-label={tr('Message language', 'Bahasa pesan')}>
                  <button type="button" aria-pressed={msgLang === 'id'} onClick={() => setMsgLang('id')}>Bahasa Indonesia</button>
                  <button type="button" aria-pressed={msgLang === 'en'} onClick={() => setMsgLang('en')}>English</button>
                </div>
              </div>
              <p className="now-small">{tr('Each text is a fixed template filled with the numbers on this page. Nothing is sent until you send it yourself.', 'Setiap teks adalah templat tetap yang diisi angka dari halaman ini. Tidak ada yang terkirim sampai Anda sendiri mengirimnya.')}</p>
              <div className="now-msgs">
                {cards.map(({ kind, title }) => {
                  const text = message(kind);
                  return (
                    <article className="now-msg" key={kind} aria-labelledby={`now-m-${kind}`}>
                      <h4 id={`now-m-${kind}`}><NowIcon kind={kind} />{title}</h4>
                      <p className="now-msg-text" lang={msgLang}>{text}</p>
                      <label htmlFor={`now-p-${kind}`}>{tr('Local post phone number (optional, added to the text)', 'Nomor telepon posko setempat (opsional, ditambahkan ke teks)')}</label>
                      <input id={`now-p-${kind}`} type="tel" inputMode="tel" autoComplete="off" value={phones[kind]} maxLength={24}
                        onChange={(ev) => setPhones((p) => ({ ...p, [kind]: ev.target.value }))} />
                      <div className="now-msg-actions now-msg-send">
                        <a className="now-btn now-btn-primary now-btn-wa" href={waLink(text)} target="_blank" rel="noopener noreferrer">{tr('Share on WhatsApp', 'Bagikan ke WhatsApp')}</a>
                        <button type="button" className="now-btn now-btn-quiet" onClick={() => { void copyText(text).then((ok) => setCopied(ok ? kind : `fail-${kind}`)); }}>{tr('Copy', 'Salin')}</button>
                        <span className="now-small" role="status">{copied === kind ? tr('Copied.', 'Tersalin.') : copied === `fail-${kind}` ? tr('Could not copy; select the text instead.', 'Tidak dapat menyalin; pilih teksnya secara manual.') : ''}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
              {aiFacts ? <AiDraft key={`${aoiId}:${lang}:${liveData?.fetched_at ?? ''}`} facts={aiFacts} lang={lang} /> : null}
              <div className="now-actions">
                <a className="now-btn" href={`#/record?aoi=${encodeURIComponent(aoiId)}`}>{tr('Open the district\'s fire calendar', 'Buka kalender api kabupaten')}</a>
                <a className="now-btn" href={`#/brief?aoi=${encodeURIComponent(aoiId)}`}>{tr('Print the one-page brief', 'Cetak ringkasan satu halaman')}</a>
                <a className="now-btn" href="#/season?y=2026">{tr('Play the season', 'Putar musim')}</a>
              </div>
            </section>

            {/* ---- the alert loop we build next, as a demo: the office approves, a phone receives, the resident answers
                 (components/now/AlertLoop.tsx; it sends nothing) */}
            <div className="now-loop" id="now-alert-loop">
              <AlertLoop district={districtTitle(aoiName(aoi, msgLang), msgLang)} levelLabel={result.level ? levelName(result.level) : null}
                message={message('residents')} />
            </div>

            {/* ---- the AI assistant: a resident or an officer asks, it answers from this page's numbers only
                 (components/now/AskAssistant.tsx, public/api/ask.js) */}
            {askFacts ? (
              <AskAssistant key={`ask:${aoiId}`} facts={askFacts} lang={lang} place={districtTitle(aoiName(aoi, lang), lang)} hasPeat={sites.length > 0} />
            ) : null}

            {/* ---- the way back: a resident's report to the office, written for WhatsApp */}
            <ReportBack place={districtTitle(aoiName(aoi, msgLang), msgLang)} msgLang={msgLang} phone={phones.residents || phones.bpbd || phones.crew} />

            {/* ---- fine print */}
            <section className="now-fine" aria-labelledby="now-h-fine">
              <h2 id="now-h-fine">{tr('Fine print', 'Catatan penting')}</h2>
              <ul>
                <li>{tr('Near-real-time detections can miss fires: cloud, thick smoke, the hours between satellite passes, and fires too small or too cool to detect.', 'Deteksi waktu hampir nyata bisa melewatkan api: awan, asap tebal, jam-jam di antara lintasan satelit, serta api yang terlalu kecil atau terlalu dingin untuk dideteksi.')}</li>
                <li>{tr('A hotspot is a detection of heat. It is not a confirmed fire and not burned area.', 'Titik panas adalah deteksi panas. Itu bukan kebakaran yang terkonfirmasi dan bukan luas terbakar.')}</li>
                <li>{tr('This page sends nothing by itself. A message goes out only when you copy it or open it in WhatsApp and send it.', 'Halaman ini tidak mengirim apa pun dengan sendirinya. Pesan baru terkirim bila Anda menyalinnya atau membukanya di WhatsApp lalu mengirimnya.')}</li>
                <li>{tr('It is not an official warning system and its levels are not a government status. Follow BMKG, KLHK (SiPongi) and your BPBD for official information.', 'Ini bukan sistem peringatan resmi dan tingkatnya bukan status pemerintah. Ikuti BMKG, KLHK (SiPongi), dan BPBD Anda untuk informasi resmi.')}</li>
                <li>{tr('Always verify on the ground before acting. Times are in WIB (UTC+7) for every district.', 'Selalu verifikasi di lapangan sebelum bertindak. Waktu ditulis dalam WIB (UTC+7) untuk semua kabupaten.')}</li>
              </ul>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

export default Now;
