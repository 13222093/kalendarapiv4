// AOI panel (FE-09): presets, search, draw (rectangle / polygon), bbox inputs, point + radius.
// Drawing uses plain MapLibre mouse events (no extra drawing library).
import type { Map as MlMap, GeoJSONSource, MapMouseEvent } from 'maplibre-gl';
import {
  AOIS, searchAois, areaKm2, bboxRing, circleRing, validBbox, validPoint, ringPolygon, ringBounds, boundsRing,
  type Aoi, type CustomAoi, type Bounds,
} from './aoi';
import { fmtInt, type Lang } from './i18n';

type Mode = 'preset' | 'search' | 'draw' | 'bbox' | 'point';
const MODES: Mode[] = ['preset', 'search', 'draw', 'bbox', 'point'];

const TXT = {
  id: {
    title: 'Wilayah',
    modes: { preset: 'Pilihan', search: 'Cari', draw: 'Gambar', bbox: 'Koordinat', point: 'Titik' },
    story: 'Cerita', national: 'Nasional', region: 'Wilayah pulau',
    searchPh: 'Ketik nama wilayah, mis. Kampar', noHit: 'Tidak ada yang cocok.',
    rect: 'Persegi', poly: 'Poligon',
    drawHintRect: 'Klik dan seret di peta untuk membuat persegi.',
    drawHintPoly: 'Klik titik-titik di peta, klik dua kali untuk menutup poligon.',
    w: 'Barat (W)', s: 'Selatan (S)', e: 'Timur (E)', n: 'Utara (N)',
    lat: 'Lintang', lon: 'Bujur', radius: 'Radius (km, 1-200)',
    preview: 'Pratinjau', badBbox: 'Periksa angka: W < E, S < N, dalam derajat desimal.',
    badPoint: 'Lintang -90 sampai 90, bujur -180 sampai 180, radius 1-200 km.',
    area: (km: string) => `Luas area: ${km} km²`,
    confirm: 'Gunakan area ini', cancel: 'Batal',
    customNote: 'Area buatan sendiri belum punya agregat bulanan; kalender memakai wilayah terdekat yang tersedia.',
  },
  en: {
    title: 'Area',
    modes: { preset: 'Presets', search: 'Search', draw: 'Draw', bbox: 'Coordinates', point: 'Point' },
    story: 'Stories', national: 'National', region: 'Island regions',
    searchPh: 'Type an area name, e.g. Kampar', noHit: 'No matches.',
    rect: 'Rectangle', poly: 'Polygon',
    drawHintRect: 'Click and drag on the map to draw a rectangle.',
    drawHintPoly: 'Click points on the map, double-click to close the polygon.',
    w: 'West (W)', s: 'South (S)', e: 'East (E)', n: 'North (N)',
    lat: 'Latitude', lon: 'Longitude', radius: 'Radius (km, 1-200)',
    preview: 'Preview', badBbox: 'Check the numbers: W < E, S < N, decimal degrees.',
    badPoint: 'Latitude -90 to 90, longitude -180 to 180, radius 1-200 km.',
    area: (km: string) => `Area: ${km} km²`,
    confirm: 'Use this area', cancel: 'Cancel',
    customNote: 'A custom area has no monthly aggregate yet; the calendar uses the nearest available region.',
  },
};

export interface AoiPanelOpts {
  lang: Lang;
  aoi: string;
  custom: CustomAoi | null;
  onPreset: (id: string) => void;
  onCustom: (c: CustomAoi) => void;
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
}

// ---- map overlay (AOI outline + draft) ----
let mapRef: MlMap | null = null;
const SRC = 'aoi-outline';
const DRAFT = 'aoi-draft';

function ensureLayers(map: MlMap): void {
  if (map.getSource(SRC)) return;
  const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
  map.addSource(SRC, { type: 'geojson', data: empty });
  map.addSource(DRAFT, { type: 'geojson', data: empty });
  map.addLayer({ id: 'aoi-line', type: 'line', source: SRC, paint: { 'line-color': '#1F5F8B', 'line-width': 2 } });
  map.addLayer({ id: 'aoi-draft-fill', type: 'fill', source: DRAFT, paint: { 'fill-color': '#1F5F8B', 'fill-opacity': 0.08 } });
  map.addLayer({ id: 'aoi-draft-line', type: 'line', source: DRAFT, paint: { 'line-color': '#1F5F8B', 'line-width': 1.5, 'line-dasharray': [2, 2] } });
}

function setRing(id: string, ring: [number, number][] | null): void {
  const map = mapRef;
  if (!map) return;
  const apply = () => {
    ensureLayers(map);
    const data: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: ring && ring.length >= 2 ? [ringPolygon(ring)] : [] };
    (map.getSource(id) as GeoJSONSource).setData(data);
  };
  if (map.isStyleLoaded()) apply();
  else map.once('load', apply);
}

export function attachMap(map: MlMap): void {
  mapRef = map;
}

export function showOutline(ring: [number, number][] | null): void {
  setRing(SRC, ring);
}

// ---- drawing ----
let stopDraw: (() => void) | null = null;

function startDraw(kind: 'rect' | 'poly', onDone: (ring: [number, number][]) => void): void {
  stopDraw?.();
  const map = mapRef;
  if (!map) return;
  const canvas = map.getCanvasContainer();
  canvas.style.cursor = 'crosshair';
  const pts: [number, number][] = [];
  let start: [number, number] | null = null;
  const ll = (e: MapMouseEvent): [number, number] => [e.lngLat.lng, e.lngLat.lat];
  const handlers: [string, (e: MapMouseEvent) => void][] = [];
  const on = (type: 'mousedown' | 'mousemove' | 'mouseup' | 'click' | 'dblclick', fn: (e: MapMouseEvent) => void) => {
    map.on(type, fn);
    handlers.push([type, fn]);
  };
  const finish = (ring: [number, number][] | null) => {
    stop();
    if (ring && ring.length >= 3) onDone(ring);
  };
  if (kind === 'rect') {
    map.dragPan.disable();
    on('mousedown', (e) => {
      start = ll(e);
    });
    on('mousemove', (e) => {
      if (!start) return;
      const p = ll(e);
      setRing(DRAFT, bboxRing(Math.min(start[0], p[0]), Math.min(start[1], p[1]), Math.max(start[0], p[0]), Math.max(start[1], p[1])));
    });
    on('mouseup', (e) => {
      if (!start) return;
      const p = ll(e);
      const s = start;
      start = null;
      if (Math.abs(p[0] - s[0]) < 1e-4 || Math.abs(p[1] - s[1]) < 1e-4) return;
      finish(bboxRing(Math.min(s[0], p[0]), Math.min(s[1], p[1]), Math.max(s[0], p[0]), Math.max(s[1], p[1])));
    });
  } else {
    map.doubleClickZoom.disable();
    on('click', (e) => {
      pts.push(ll(e));
      setRing(DRAFT, pts);
    });
    on('mousemove', (e) => {
      if (pts.length) setRing(DRAFT, [...pts, ll(e)]);
    });
    on('dblclick', (e) => {
      e.preventDefault();
      finish([...pts]);
    });
  }
  function stop() {
    for (const [type, fn] of handlers) map!.off(type as 'click', fn);
    map!.dragPan.enable();
    map!.doubleClickZoom.enable();
    canvas.style.cursor = '';
    stopDraw = null;
  }
  stopDraw = () => {
    stop();
    setRing(DRAFT, null);
  };
}

// ---- panel ----
let mode: Mode = 'preset';
let pending: CustomAoi | null = null;
let query = '';

export function renderAoiPanel(slot: HTMLElement, o: AoiPanelOpts, fit: (b: Bounds) => void): void {
  const d = TXT[o.lang];
  slot.setAttribute('data-testid', 'aoi-panel');
  const tabs = h('div', { class: 'seg aoi-modes', role: 'tablist', 'aria-label': d.title });
  for (const m of MODES) {
    const b = h('button', { type: 'button', role: 'tab', 'aria-selected': String(m === mode), 'aria-pressed': String(m === mode), 'data-testid': `aoi-mode-${m}` }, d.modes[m]);
    b.addEventListener('click', () => {
      if (m !== 'draw') stopDraw?.();
      mode = m;
      pending = null;
      setRing(DRAFT, null);
      renderAoiPanel(slot, o, fit);
    });
    tabs.append(b);
  }
  const body = h('div', { class: 'aoi-body' });
  const presetButton = (a: Aoi) => {
    const li = h('li');
    const b = h('button', { type: 'button', 'aria-pressed': String(a.id === o.aoi), 'data-testid': 'aoi-preset', 'data-aoi': a.id });
    b.append(document.createTextNode(a.name[o.lang]));
    if (a.story) b.append(h('span', { class: 'aoi-story' }, ` · ${a.story[o.lang]}`));
    b.addEventListener('click', () => o.onPreset(a.id));
    li.append(b);
    return li;
  };
  const confirmBox = h('div', { class: 'aoi-confirm', 'data-testid': 'aoi-confirm', 'aria-live': 'polite' });
  const showPending = (c: CustomAoi | null) => {
    pending = c;
    confirmBox.replaceChildren();
    if (!c) return;
    setRing(DRAFT, c.ring);
    fit(ringBounds(c.ring));
    confirmBox.append(h('p', { 'data-testid': 'aoi-area' }, d.area(fmtInt(Math.round(areaKm2(c.ring))))));
    const ok = h('button', { type: 'button', class: 'btn-primary', 'data-testid': 'aoi-confirm-btn' }, d.confirm);
    ok.addEventListener('click', () => {
      setRing(DRAFT, null);
      o.onCustom(c);
    });
    const no = h('button', { type: 'button', class: 'btn' }, d.cancel);
    no.addEventListener('click', () => {
      setRing(DRAFT, null);
      showPending(null);
    });
    confirmBox.append(ok, no);
  };

  if (mode === 'preset') {
    for (const [g, label] of [['story', d.story], ['national', d.national], ['region', d.region]] as const) {
      body.append(h('p', { class: 'muted aoi-group' }, label));
      const ul = h('ul', { class: 'preset-list' });
      AOIS.filter((a) => a.group === g).forEach((a) => ul.append(presetButton(a)));
      body.append(ul);
    }
  } else if (mode === 'search') {
    const input = h('input', { type: 'search', class: 'aoi-input', placeholder: d.searchPh, 'aria-label': d.modes.search, 'data-testid': 'aoi-search' });
    input.value = query;
    const ul = h('ul', { class: 'preset-list' });
    const run = () => {
      query = input.value;
      const hits = searchAois(query, o.lang);
      ul.replaceChildren(...(hits.length ? hits.map(presetButton) : [h('li', { class: 'muted' }, d.noHit)]));
    };
    input.addEventListener('input', run);
    run();
    body.append(input, ul);
    queueMicrotask(() => input.focus());
  } else if (mode === 'draw') {
    const hint = h('p', { class: 'muted' });
    const row = h('div', { class: 'seg' });
    for (const [k, label] of [['rect', d.rect], ['poly', d.poly]] as const) {
      const b = h('button', { type: 'button', 'data-testid': `aoi-draw-${k}` }, label);
      b.addEventListener('click', () => {
        row.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        hint.textContent = k === 'rect' ? d.drawHintRect : d.drawHintPoly;
        startDraw(k, (ring) => showPending({ kind: k === 'rect' ? 'bbox' : 'draw', ring }));
      });
      row.append(b);
    }
    body.append(row, hint);
  } else if (mode === 'bbox') {
    const cur = o.custom ? ringBounds(o.custom.ring) : AOIS.find((a) => a.id === o.aoi)?.bounds ?? ringBounds(boundsRing([[110, -3], [114, 0]]));
    const vals = [cur[0][0], cur[0][1], cur[1][0], cur[1][1]];
    const grid = h('div', { class: 'aoi-grid' });
    const inputs = (['w', 's', 'e', 'n'] as const).map((k, i) => {
      const lab = h('label', {}, d[k]);
      const inp = h('input', { type: 'number', step: '0.01', class: 'aoi-input', 'data-testid': `aoi-bbox-${k}` });
      inp.value = String(Math.round(vals[i] * 100) / 100);
      lab.append(inp);
      grid.append(lab);
      return inp;
    });
    const err = h('p', { class: 'aoi-err', role: 'alert' });
    const go = h('button', { type: 'button', class: 'btn', 'data-testid': 'aoi-bbox-preview' }, d.preview);
    go.addEventListener('click', () => {
      const [w, s, e, n] = inputs.map((x) => parseFloat(x.value.replace(',', '.')));
      if (!validBbox(w, s, e, n)) {
        err.textContent = d.badBbox;
        showPending(null);
        return;
      }
      err.textContent = '';
      showPending({ kind: 'bbox', ring: bboxRing(w, s, e, n) });
    });
    body.append(grid, go, err);
  } else {
    const grid = h('div', { class: 'aoi-grid' });
    const mk = (label: string, key: string, v: string) => {
      const lab = h('label', {}, label);
      const inp = h('input', { type: 'number', step: key === 'r' ? '1' : '0.01', class: 'aoi-input', 'data-testid': `aoi-point-${key}` });
      inp.value = v;
      lab.append(inp);
      grid.append(lab);
      return inp;
    };
    const c = o.custom?.kind === 'point' ? o.custom : null;
    const lat = mk(d.lat, 'lat', c?.center ? String(c.center[1]) : '-2.30');
    const lon = mk(d.lon, 'lon', c?.center ? String(c.center[0]) : '113.90');
    const r = mk(d.radius, 'r', String(c?.radiusKm ?? 25));
    const err = h('p', { class: 'aoi-err', role: 'alert' });
    const go = h('button', { type: 'button', class: 'btn', 'data-testid': 'aoi-point-preview' }, d.preview);
    go.addEventListener('click', () => {
      const [la, lo, km] = [lat, lon, r].map((x) => parseFloat(x.value.replace(',', '.')));
      if (!validPoint(la, lo, km)) {
        err.textContent = d.badPoint;
        showPending(null);
        return;
      }
      err.textContent = '';
      showPending({ kind: 'point', center: [lo, la], radiusKm: km, ring: circleRing(lo, la, km) });
    });
    body.append(grid, go, err);
  }
  const children: Node[] = [h('h3', {}, d.title), tabs, body, confirmBox];
  if (o.aoi === 'custom' && o.custom) children.push(h('p', { class: 'muted', 'data-testid': 'aoi-custom-note' }, `${d.area(fmtInt(Math.round(areaKm2(o.custom.ring))))}. ${d.customNote}`));
  slot.replaceChildren(...children);
  if (pending) showPending(pending);
}
