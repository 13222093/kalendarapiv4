// KalenderApi (new file): the logic of the home page (pages/Home.tsx). Pure functions only: where a province sits on
// the globe, the latest full month of each province against the median of the same month, the size and colour class
// of its marker, the yearly lines of the three records (one scale, MODIS as recorded, VIIRS as recorded) and the
// small geometry the page draws with. Nothing here holds a number of the record: every value comes from the files.
import { SEAM_YEAR, emberStep, isProvisional, modisRaw, monthVerdict, rawSpliced, viirsRaw, ym, type AoiEntry, type MonthRow } from './record';

// ------------------------------------------------------------------------------------------------ the menu

/** The pages of the menu, named by what the challenge asks for. `sec` is the section of the record page a link
 *  opens at (App.tsx scrolls to the element with that id once the page has drawn it). */
export interface HomeLink { key: string; href: string; en: string; id: string; sec?: string }
export const HOME_HREF = '#/home';
export const recordAt = (aoiId: string, sec?: string): string =>
  `#/record?aoi=${encodeURIComponent(aoiId)}${sec ? `&sec=${sec}` : ''}`;
/** The condition right now of one district (#/now); the home page's first button opens this district. */
export const NOW_HREF = '#/now';
export const NOW_DISTRICT = 'kab-pulang-pisau';
export const nowAt = (aoiId: string): string => `${NOW_HREF}?aoi=${encodeURIComponent(aoiId)}`;
export const HOME_MENU: readonly HomeLink[] = [
  { key: 'home', href: HOME_HREF, en: 'Home', id: 'Beranda' },
  { key: 'now', href: NOW_HREF, en: 'Today', id: 'Hari ini' },
  { key: 'harmonize', href: recordAt('IDN', 'jump'), sec: 'jump', en: 'Harmonize', id: 'Harmonisasi' },
  { key: 'calendar', href: recordAt('IDN', 'calendar'), sec: 'calendar', en: 'Fire calendar', id: 'Kalender api' },
  { key: 'range', href: recordAt('IDN', 'range'), sec: 'range', en: 'Date range', id: 'Rentang tanggal' },
  { key: 'cloud', href: '#/season?y=2015', en: 'Zero under cloud', id: 'Nol di bawah awan' },
  { key: 'brief', href: '#/brief?aoi=prov-kalimantan-tengah', en: 'District brief', id: 'Ringkasan kabupaten' },
  { key: 'method', href: '#/method', en: 'Method and data', id: 'Metode dan data' },
];

/** The section named in an address ('#/record?aoi=IDN&sec=calendar' gives 'calendar'); null when there is none or it
 *  is not a plain element id. */
export function sectionOf(hash: string): string | null {
  const sec = new URLSearchParams(hash.split('?')[1] ?? '').get('sec');
  return sec && /^[a-z][a-z0-9-]*$/.test(sec) ? sec : null;
}

// ------------------------------------------------------------------------------------------------ province markers

/** Where each province sits: the mean of its districts' centroids, weighted by district area (an unweighted mean when
 *  an area is missing). Keyed by the province's aoi_id. */
export function provincePositions(districts: AoiEntry[]): Map<string, [number, number]> {
  const sums = new Map<string, { x: number; y: number; w: number }>();
  for (const d of districts) {
    const c = d.centroid, key = d.province_aoi;
    if (!key || !c || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
    const w = d.area_km2 != null && d.area_km2 > 0 ? d.area_km2 : 1;
    const s = sums.get(key) ?? { x: 0, y: 0, w: 0 };
    s.x += c[0] * w; s.y += c[1] * w; s.w += w;
    sums.set(key, s);
  }
  const out = new Map<string, [number, number]>();
  for (const [key, s] of sums) if (s.w > 0) out.set(key, [s.x / s.w, s.y / s.w]);
  return out;
}

/** The latest month with a value that is not still filling in (the rule of the national card, pages/landing-data.ts). */
export function latestFullMonth(rows: MonthRow[]): { year: number; month: number } | null {
  let best: MonthRow | null = null;
  for (const r of rows) {
    if (r.H == null || r.flag_partial) continue;
    if (!best || r.year > best.year || (r.year === best.year && r.month > best.month)) best = r;
  }
  return best ? { year: best.year, month: best.month } : null;
}

/** Near normal: from 0.8 to 1.25 times the median (the same distance below and above, as a ratio). */
export const NEAR_BAND: readonly [number, number] = [0.8, 1.25];
export type Tone = 'up' | 'down' | 'near' | 'unknown';
export function toneOf(ratio: number | null): Tone {
  if (ratio == null || !Number.isFinite(ratio)) return 'unknown';
  return ratio > NEAR_BAND[1] ? 'up' : ratio < NEAR_BAND[0] ? 'down' : 'near';
}

export interface ProvinceMark {
  id: string;
  nameEn: string; nameId: string;
  lon: number; lat: number;
  year: number; month: number;
  /** fire cell-days of the month, on the one scale */
  H: number;
  median: number | null;
  /** H divided by the median of the same month; null when there is no median above zero */
  ratio: number | null;
  tone: Tone;
  provisional: boolean;
}

/** One province's marker for a month. Null when the province has no position or no value that month. */
export function provinceMark(aoi: AoiEntry, rows: MonthRow[], pos: [number, number] | undefined,
  at: { year: number; month: number }): ProvinceMark | null {
  if (!pos) return null;
  const v = monthVerdict(rows, `${at.year}-${String(at.month).padStart(2, '0')}`);
  if (!v) return null;
  const ratio = v.ratio != null && Number.isFinite(v.ratio) ? v.ratio : null;
  return {
    id: aoi.aoi_id,
    nameEn: aoi.name_en ?? aoi.name ?? aoi.aoi_id, nameId: aoi.name_id ?? aoi.name ?? aoi.aoi_id,
    lon: pos[0], lat: pos[1], year: at.year, month: at.month,
    H: v.H, median: ratio != null && ratio > 0 ? v.H / ratio : null, ratio, tone: toneOf(ratio), provisional: v.provisional,
  };
}

/** Marker radius in pixels: the dot's area grows with the count (square root), between rMin and rMax. */
export function markRadius(H: number, maxH: number, rMin = 4, rMax = 15): number {
  if (!(maxH > 0) || !(H > 0)) return rMin;
  return Math.round((rMin + (rMax - rMin) * Math.sqrt(Math.min(1, H / maxH))) * 10) / 10;
}

/** The provinces with the highest counts (their markers carry a name). */
export function highest(marks: ProvinceMark[], n = 5): ProvinceMark[] {
  return [...marks].sort((a, b) => b.H - a.H || a.id.localeCompare(b.id)).slice(0, n);
}

/** The provinces furthest above their own median of the same month: highest ratio first, above the median only. */
export function furthestAbove(marks: ProvinceMark[], n = 5): ProvinceMark[] {
  return marks.filter((m) => m.ratio != null && m.ratio > 1)
    .sort((a, b) => b.ratio! - a.ratio! || b.H - a.H || a.id.localeCompare(b.id)).slice(0, n);
}

/** Digits for "N times the median": one decimal below 10, none from 10 up. */
export const timesDigits = (ratio: number): number => (Math.abs(ratio) < 10 ? 1 : 0);

// ------------------------------------------------------------------------------------------------ the three records

export interface SensorYear {
  year: number;
  /** yearly fire cell-days on the one scale */
  harm: number;
  /** MODIS as recorded (Aqua, Terra before Aqua); null when a month of the year has no MODIS count */
  modis: number | null;
  /** VIIRS as recorded (Suomi NPP, else NOAA-20); null before VIIRS and when a month has no VIIRS count */
  viirs: number | null;
}

/** Yearly totals of complete, final years only: twelve months, each with a value, none provisional. */
export function sensorYears(rows: MonthRow[]): SensorYear[] {
  const byYear = new Map<number, MonthRow[]>();
  for (const r of rows) { const list = byYear.get(r.year) ?? []; list.push(r); byYear.set(r.year, list); }
  const out: SensorYear[] = [];
  for (const [year, list] of byYear) {
    if (list.length !== 12 || list.some((r) => r.H == null || isProvisional(r))) continue;
    const sum = (get: (r: MonthRow) => number | null): number | null => {
      let s = 0;
      for (const r of list) { const v = get(r); if (v == null) return null; s += v; }
      return s;
    };
    out.push({ year, harm: sum((r) => r.H)!, modis: sum(modisRaw), viirs: sum(viirsRaw) });
  }
  return out.sort((a, b) => a.year - b.year);
}

/** An SVG path through the values; a null value (or a gap in the years) breaks the line instead of bridging it. */
export function linePath(years: number[], values: (number | null)[], x: (year: number) => number, y: (v: number) => number): string {
  const parts: string[] = [];
  let pen = false;
  for (let i = 0; i < years.length; i += 1) {
    const v = values[i];
    if (v == null || !Number.isFinite(v)) { pen = false; continue; }
    const joined = pen && years[i - 1] === years[i]! - 1;
    parts.push(`${joined ? 'L' : 'M'}${r1(x(years[i]!))},${r1(y(v))}`);
    pen = true;
  }
  return parts.join(' ');
}
const r1 = (v: number) => Math.round(v * 10) / 10;

/** The top of a value axis: the largest value rounded up to 1, 2 or 5 times a power of ten. */
export function niceMax(top: number): number {
  if (!(top > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(top));
  for (const k of [1, 2, 5, 10]) if (top <= k * p) return k * p;
  return 10 * p;
}

// ------------------------------------------------------------------------------------------------ the globe

/** Indonesia on the globe: the centre the globe opens on, and the box of the still picture shown without WebGL
 *  (west, south, east, north). */
export const GLOBE_CENTER: readonly [number, number] = [118, -2.5];
export const STILL_BOX: readonly [number, number, number, number] = [94, -12, 142, 8];

/** The disc MapLibre draws is this share of the nominal radius of a globe at a zoom (512 x 2^z / 2 pi pixels):
 *  measured on screen, since the camera looks at the sphere in perspective. */
export const GLOBE_DISC = 0.79;

/** The MapLibre zoom at which the globe's disc is `fill` times as wide as its square box. */
export function globeZoom(boxPx: number, fill = 0.9): number {
  const radius = Math.max(60, boxPx) * fill / 2 / GLOBE_DISC;
  return Math.round(Math.log2((radius * 2 * Math.PI) / 512) * 100) / 100;
}

/** A place on the still picture, in percent from its left and top edges (plain latitude and longitude grid). */
export function stillXY(lon: number, lat: number, box: readonly [number, number, number, number] = STILL_BOX): { left: number; top: number } {
  const [w, s, e, n] = box;
  return { left: r1(((lon - w) / (e - w)) * 100), top: r1(((n - lat) / (n - s)) * 100) };
}

/** The drift of the globe before anyone touches it: the longitude moves at `speed` degrees per millisecond and turns
 *  back at the edges of a window around Indonesia, so the country never leaves the view. */
export function driftStep(lng: number, dir: 1 | -1, dtMs: number, speed = 0.0012, window: readonly [number, number] = [104, 132]): { lng: number; dir: 1 | -1 } {
  let next = lng + dir * speed * dtMs, d = dir;
  if (next > window[1]) { next = window[1]; d = -1; } else if (next < window[0]) { next = window[0]; d = 1; }
  return { lng: next, dir: d };
}

// ------------------------------------------------------------------------------------------------ the calendar ribbon

/** One month of the ribbon on the home page: the record as recorded and on one scale, each with its colour step. The
 *  definitions are the record page's (components/record/RecordCalendar.tsx): as recorded is MODIS to 2011 and VIIRS
 *  from 2012 (rawSpliced), one scale is H, and both use one logarithmic colour scale (emberStep on the largest value
 *  of either), so the two calendars agree. */
export interface RibbonCell {
  key: string; year: number; month: number;
  raw: number | null; harm: number | null;
  /** colour steps: 0 is no fire, 1 to 9 the ember ramp, null when there is no value */
  stepRaw: number | null; stepHarm: number | null;
  /** the sensor behind the as-recorded value */
  rawSensor: 'MODIS' | 'VIIRS';
  /** the one-scale value divided by the median of the same month, where the record has a median above zero */
  times: number | null;
  provisional: boolean;
}
export interface Ribbon {
  /** from the first year that has a January to the last year of the record */
  years: number[];
  /** the top of the colour scale: the largest value of either view, over the whole record */
  max: number;
  cells: Map<string, RibbonCell>;
  /** the first VIIRS year, when it is inside the ribbon */
  seam: number | null;
}

export function ribbon(rows: MonthRow[]): Ribbon {
  const cells = new Map<string, RibbonCell>();
  const januaries = rows.filter((r) => r.month === 1).map((r) => r.year);
  if (!rows.length || !januaries.length) return { years: [], max: 0, cells, seam: null };
  const max = Math.max(0, ...rows.map((r) => Math.max(r.H ?? 0, rawSpliced(r) ?? 0)));
  const first = Math.min(...januaries), last = Math.max(...rows.map((r) => r.year));
  const years = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  for (const r of rows) {
    if (r.year < first) continue;
    const key = ym(r.year, r.month);
    const raw = rawSpliced(r);
    const ratio = r.H != null ? monthVerdict(rows, key)?.ratio ?? null : null;
    cells.set(key, {
      key, year: r.year, month: r.month, raw, harm: r.H,
      stepRaw: raw == null ? null : emberStep(raw, max), stepHarm: r.H == null ? null : emberStep(r.H, max),
      rawSensor: r.year < SEAM_YEAR ? 'MODIS' : 'VIIRS',
      times: ratio != null && Number.isFinite(ratio) ? ratio : null,
      provisional: isProvisional(r),
    });
  }
  return { years, max, cells, seam: years.includes(SEAM_YEAR) && years[0] !== SEAM_YEAR ? SEAM_YEAR : null };
}

/** Arrow keys on the ribbon (years across, months down): left and right move a year, up and down a month. Null when
 *  the move leaves the ribbon. */
export function ribbonMove(key: string, arrow: string, has: (key: string) => boolean): string | null {
  const y = Number(key.slice(0, 4)), m = Number(key.slice(5, 7));
  const next = arrow === 'ArrowRight' ? ym(y + 1, m) : arrow === 'ArrowLeft' ? ym(y - 1, m)
    : arrow === 'ArrowDown' ? (m < 12 ? ym(y, m + 1) : null) : arrow === 'ArrowUp' ? (m > 1 ? ym(y, m - 1) : null) : null;
  return next && has(next) ? next : null;
}

// ------------------------------------------------------------------------------------------------ peat persistence

/** The totals of ka-data/peat_persistence_kalteng.json that the home page reads. Null when the file has another shape. */
export interface PeatFacts {
  seasons: number;
  /** persistent peat sites, counted once per season (site-seasons) */
  sites: number;
  /** times fire activity was detected again after a gap of two or more days with no detection */
  comeBacks: number;
  /** come-backs whose gap had a cloud-free look with nothing detected */
  seenQuiet: number;
}
export function peatFacts(file: unknown): PeatFacts | null {
  const t = (file as { total?: { seasons?: unknown; persistent_peat_sites?: unknown; come_backs?: { total?: unknown; seen_quiet?: unknown } } } | null)?.total;
  const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
  const seasons = n(t?.seasons), sites = n(t?.persistent_peat_sites), comeBacks = n(t?.come_backs?.total), seenQuiet = n(t?.come_backs?.seen_quiet);
  return seasons != null && sites != null && comeBacks != null && seenQuiet != null ? { seasons, sites, comeBacks, seenQuiet } : null;
}
