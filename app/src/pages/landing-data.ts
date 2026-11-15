// KalenderApi: everything the landing page (#/home) and the method page (#/method) show, computed here at run time
// from the same versioned files the record page reads (public/ss-data/) and the visibility files of Play the season
// (public/ka-data/). Nothing is filled in: a value the files do not give stays null and the pages leave it out.
import {
  beforeAfter, getJson, isViirs, KALTENG, loadIndex, loadMonthly, loadValidation, monthVerdict, NATIONAL, testStatus,
  type Ablation, type MonthRow, type TestRow, type TestStatus, type Validation,
} from '../lib/record.ts';
import { WINDOW_EARLY, WINDOW_RECENT } from '../lib/windows.ts';

export const LANDING_BRAND = 'KalenderApi';
export const LANDING_ROUTES = {
  home: '#/home',
  record: '#/record',
  method: '#/method',
  story: '#/story',
  season: '#/season?y=2015',
  zero: '#/zero',
  brief: '#/brief?aoi=prov-kalimantan-tengah',
};
export const REPO_URL = 'https://github.com/13222093/kalendarapiv4';
export const AI_USE_URL = `${REPO_URL}/blob/main/AI_USE.md`;
export const NOTICE_URL = `${REPO_URL}/blob/main/app/NOTICE.md`;
export const FIRE_HARMONY_URL = 'https://github.com/Warren-530/fire-harmony';

const BASE = import.meta.env.BASE_URL;

// ------------------------------------------------------------------------------------------------ the record

export interface LandingPoint {
  year: number;
  raw: number;
  fair: number;
  low: number;
  high: number;
  /** the year's one-scale value is VIIRS converted to the Aqua MODIS scale (not Aqua's own count) */
  converted: boolean;
}

export interface LandingCheck {
  value: number | null;
  ci: [number, number] | null;
  passed: boolean | null;
  status: string;
  rule: string | null;
}

/** (a) The latest complete month of the national record against the median of the same calendar month. */
export interface LatestFact {
  year: number;
  month: number;
  H: number;
  median: number | null;
  ratio: number | null;
  provisional: boolean;
  /** the years the median is taken over, when it is the bundle's baseline median */
  baseline: [number, number] | null;
}

/** (b) % change of the mean yearly total, WINDOW_RECENT against WINDOW_EARLY. */
export interface ChangeFact {
  raw: number;
  harm: number;
  early: readonly [number, number];
  recent: readonly [number, number];
}

/** One method of the validation file's comparison, errors in %. */
export interface MethodError {
  method: string;
  loyo: number | null;
  y2015: number | null;
  y2019: number | null;
  forwardKge: number | null;
}

export interface RegionCheck { name: string; value: number | null; status: TestStatus }

export interface ValidationSummary {
  chosen: string;
  runUtc: string | null;
  nBoot: number | null;
  raw: MethodError | null;
  ours: MethodError | null;
  /** methods other than the raw splice and ours */
  others: MethodError[];
  /** of them, those with a lower held-out error than ours */
  simplerBetter: MethodError[];
  counts: Record<TestStatus, number>;
  total: number;
  seam2012: LandingCheck | null;
  seam2022: LandingCheck | null;
  /** leave one region out, our method */
  regions: RegionCheck[];
  /** the forward-in-time test of our method (fit on the earlier overlap years, predict the later ones) */
  forward: LandingCheck | null;
  /** the peat checks are among the rows that were not run */
  peatNotRun: boolean;
}

/** A converted year against Aqua MODIS's own count of the same year. */
export interface SeamYear { year: number; ratio: number }

export interface LandingData {
  points: LandingPoint[];
  firstMonth: string | null;
  lastMonth: string | null;
  /** whole years from the first to the last month of the record */
  spanYears: number | null;
  /** the first year whose one-scale value is converted VIIRS */
  convertedFrom: number | null;
  calibration: [number, number] | null;
  areas: number;
  unit: string | null;
  latest: LatestFact | null;
  change: ChangeFact | null;
  validation: ValidationSummary;
  seamYears: SeamYear[];
  /** the season years with a cloud-visibility layer (Central Kalimantan) */
  visYears: number[];
  generatedAt: string | null;
}

function toCheck(row: TestRow | undefined): LandingCheck | null {
  if (!row) return null;
  const ci = Array.isArray(row.ci)
    && row.ci.length >= 2
    && typeof row.ci[0] === 'number'
    && typeof row.ci[1] === 'number'
    ? [row.ci[0], row.ci[1]] as [number, number]
    : null;
  return {
    value: typeof row.value === 'number' ? row.value : null,
    ci,
    passed: row.passed,
    status: row.status ?? 'run',
    rule: row.rule ?? null,
  };
}

function seamRow(rows: TestRow[], year: number, method: string): TestRow | undefined {
  const variant = year === 2012 ? 'switch2012' : 'main';
  return rows.find((row) => row.test_id === 'V3'
    && row.metric.includes('seam ' + year + '-01')
    && row.metric.includes(method + '/' + variant));
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function methodError(a: Ablation): MethodError {
  const more = a as Ablation & { sunset_kge?: number | null };
  return { method: a.method, loyo: num(a.loyo_mdape), y2015: num(a.ape_2015), y2019: num(a.ape_2019), forwardKge: num(more.sunset_kge) };
}

/** The validation file in the words the pages use: the held-out error first, then what fails. */
export function summarizeValidation(v: Validation): ValidationSummary {
  const chosen = v.meta?.chosen_method ?? 'M3';
  const all = (v.meta?.ablation ?? []).map(methodError);
  const raw = all.find((m) => m.method === 'M0') ?? null;
  const ours = all.find((m) => m.method === chosen) ?? null;
  // a method whose name starts with ours (a variant of it) is not a simpler method
  const others = all.filter((m) => m.method !== 'M0' && !m.method.startsWith(chosen));
  const simplerBetter = ours?.loyo != null ? others.filter((m) => m.loyo != null && m.loyo < ours.loyo!) : [];
  const counts: Record<TestStatus, number> = { pass: 0, fail: 0, not_run: 0, na: 0, info: 0 };
  for (const r of v.results) counts[testStatus(r)] += 1;
  const prefix = `LORO MdAPE ${chosen} `;
  const regions = v.results
    .filter((r) => r.test_id === 'V2' && r.metric.startsWith(prefix))
    .map((r) => ({ name: r.metric.slice(prefix.length), value: num(r.value), status: testStatus(r) }));
  const forward = v.results.find((r) => r.test_id === 'V5' && r.metric.includes('decision') && r.metric.includes(chosen));
  return {
    chosen,
    runUtc: v.meta?.run_utc ?? null,
    nBoot: num(v.meta?.n_boot),
    raw, ours, others, simplerBetter, counts,
    total: v.results.length,
    seam2012: toCheck(seamRow(v.results, 2012, chosen)),
    seam2022: toCheck(seamRow(v.results, 2022, chosen)),
    regions,
    forward: toCheck(forward),
    peatNotRun: v.results.some((r) => testStatus(r) === 'not_run' && /peat/i.test(`${r.metric} ${r.notes ?? ''}`)),
  };
}

function latestFact(rows: MonthRow[], baseline: [number, number] | null): LatestFact | null {
  let best: MonthRow | null = null;
  for (const r of rows) {
    if (r.H == null || r.flag_partial) continue;   // a month still filling in is not compared
    if (!best || r.year > best.year || (r.year === best.year && r.month > best.month)) best = r;
  }
  if (!best) return null;
  const verdict = monthVerdict(rows, `${best.year}-${String(best.month).padStart(2, '0')}`);
  if (!verdict) return null;
  const median = best.baseline_median ?? (verdict.ratio != null && verdict.ratio > 0 ? verdict.H / verdict.ratio : null);
  return {
    year: best.year, month: best.month, H: verdict.H, median, ratio: verdict.ratio, provisional: verdict.provisional,
    baseline: verdict.medianFrom === 'baseline' ? baseline : null,
  };
}

const monthIndex = (key: string) => Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7)) - 1;
const pair = (v: unknown): [number, number] | null =>
  (Array.isArray(v) && typeof v[0] === 'number' && typeof v[1] === 'number' ? [v[0], v[1]] : null);

/** Build the landing view from exactly the same versioned bundle as the record page. */
export async function loadLandingData(): Promise<LandingData | null> {
  const [index, validation] = await Promise.all([loadIndex(), loadValidation()]);
  const national = index.aois.find((area) => area.aoi_id === NATIONAL)
    ?? index.aois.find((area) => area.level === 'national');
  if (!national) return null;

  const rows = await loadMonthly(national);
  const record = beforeAfter(rows);
  if (!record) return null;

  const convertedYears = new Set(rows.filter((r) => r.H != null && isViirs(r.sensor_used)).map((r) => r.year));
  const convertedFrom = convertedYears.size ? Math.min(...convertedYears) : null;
  const points = record.points
    .filter((point) => point.year >= 2003 && !point.provisional)
    .map((point) => ({
      year: point.year,
      raw: point.naive,
      fair: point.H,
      low: Math.min(point.lo, point.hi),
      high: Math.max(point.lo, point.hi),
      converted: convertedYears.has(point.year),
    }));

  const mean = (key: 'rawNaive' | 'rawH', [from, to]: readonly [number, number]): number | null => {
    const xs = record.points.filter((p) => p.year >= from && p.year <= to);
    if (xs.length !== to - from + 1 || xs.some((p) => p.provisional)) return null;   // every year of the window, or nothing
    return xs.reduce((s, p) => s + p[key], 0) / xs.length;
  };
  const pct = (key: 'rawNaive' | 'rawH'): number | null => {
    const early = mean(key, WINDOW_EARLY), recent = mean(key, WINDOW_RECENT);
    return early != null && recent != null && early > 0 ? (recent / early - 1) * 100 : null;
  };
  const rawChange = pct('rawNaive'), harmChange = pct('rawH');

  // converted years against Aqua MODIS's own count of the same year (complete, final years only)
  const seamYears: SeamYear[] = [];
  for (const p of record.points) {
    if (!convertedYears.has(p.year) || p.provisional || p.months !== 12) continue;
    const aqua = rows.filter((r) => r.year === p.year).reduce((s, r) => s + (r.A_raw ?? 0), 0);
    if (aqua > 0) seamYears.push({ year: p.year, ratio: p.rawH / aqua });
  }

  const first = national.first ?? null, last = national.last ?? null;
  const visYears = [...new Set((index.obs_months?.[KALTENG] ?? []).map((k) => Number(k.slice(0, 4))))]
    .filter((y) => Number.isInteger(y)).sort((a, b) => a - b);

  return {
    points,
    firstMonth: first,
    lastMonth: last,
    spanYears: first && last ? Math.floor((monthIndex(last) - monthIndex(first) + 1) / 12) : null,
    convertedFrom,
    calibration: pair(index.calibration_window),
    areas: index.aois.length,
    unit: index.unit ?? null,
    latest: latestFact(rows, pair(index.baseline_period)),
    change: rawChange != null && harmChange != null
      ? { raw: rawChange, harm: harmChange, early: WINDOW_EARLY, recent: WINDOW_RECENT } : null,
    validation: summarizeValidation(validation),
    seamYears,
    visYears,
    generatedAt: index.generated_at ?? null,
  };
}

// ------------------------------------------------------------------------------------------------ one real day

/** The showcase day: Central Kalimantan, late in the 2015 season, most of the province under cloud. (2015, not 2019:
 *  a sibling project's registered test covers Central Kalimantan for January to October 2019.) */
export const FRAME_DATE = '2015-10-29';
const FRAME_YEAR = Number(FRAME_DATE.slice(0, 4));

/** One day of ka-data/visibility_kalteng_<Y>.json (pipeline/visibility/build_visibility.py): of the land cells with
 *  no fire detected, T had a cloud-free look from MODIS Terra or Aqua that day and U had none; F had fire. `d` lists
 *  [T, U] per district. */
interface VisDay { date: string; F: number; T: number; U: number; d?: [number, number][] }
interface VisFile {
  grid?: { bbox?: [number, number, number, number]; width?: number; height?: number; step_deg?: number };
  days: VisDay[];
  districts?: { name: string }[];
  source?: { firemask?: { product?: string; access?: string }; districts?: { name?: string; license?: string } };
}
interface DistrictFile { districts: { name: string; rings: [number, number][][] }[] }
/** One hotspot of a season file: lon, lat, frp (MW), isNight. */
type Pt = [number, number, number, number];
interface SeasonFile { source?: { product?: string }; days: { date: string; pts: Pt[] }[] }

export interface FrameData {
  date: string;
  bbox: [number, number, number, number];   // west, south, east, north
  width: number;
  height: number;
  /** the day's numbers, inside the districts */
  fireCells: number;
  noFireCells: number;
  noLookCells: number;
  /** noLookCells / noFireCells, in % */
  share: number;
  /** districts where more than half of the no-fire cells had no cloud-free look that day */
  districts: number;
  districtsMostly: number;
  /** the same count over every district and day of that season file */
  seasonDistrictDays: number;
  seasonMostly: number;
  seasonFrom: string;
  seasonTo: string;
  rings: [number, number][][];
  hatchUrl: string;
  /** that day's NASA true-colour photos of the box, bottom layer first */
  photos: { name: string; url: string }[];
  firemaskProduct: string | null;
  firemaskAccess: string | null;
  boundarySource: string | null;
  boundaryLicence: string | null;
}

const mostly = ([t, u]: [number, number]) => t + u > 0 && u / (t + u) > 0.5;

// NASA GIBS has Suomi NPP VIIRS true colour only from 24 November 2015 (as pages/Season.tsx), so the day's photo is
// MODIS. Near the equator each MODIS leaves a wedge with no data between two orbits; on this day Aqua's photo covers
// the west of the box and Terra's the east, so the frame lays Terra's over Aqua's (the page says so).
const PHOTO_LAYERS = [
  { id: 'MODIS_Aqua_CorrectedReflectance_TrueColor', name: 'MODIS Aqua' },
  { id: 'MODIS_Terra_CorrectedReflectance_TrueColor', name: 'MODIS Terra' },
];

/** The frame of the first screen: that day's numbers, its "no cloud-free look" image and the district outlines. */
export async function loadFrame(): Promise<FrameData | null> {
  const [vis, dist] = await Promise.all([
    getJson<VisFile>(`${BASE}ka-data/visibility_kalteng_${FRAME_YEAR}.json`),
    getJson<DistrictFile>(`${BASE}ka-data/kalteng_districts.json`),
  ]);
  const day = Array.isArray(vis.days) ? vis.days.find((d) => d.date === FRAME_DATE) : undefined;
  const bbox = vis.grid?.bbox;
  if (!day || !bbox || !(day.T + day.U > 0) || !Array.isArray(dist.districts)) return null;
  const [w, s, e, n] = bbox;
  const width = vis.grid?.width ?? Math.round((e - w) * 100), height = vis.grid?.height ?? Math.round((n - s) * 100);
  let seasonDistrictDays = 0, seasonMostly = 0;
  for (const d of vis.days) for (const c of d.d ?? []) { if (c[0] + c[1] > 0) { seasonDistrictDays += 1; if (mostly(c)) seasonMostly += 1; } }
  const dates = vis.days.map((d) => d.date).sort();
  return {
    date: FRAME_DATE, bbox, width, height,
    fireCells: day.F, noFireCells: day.T + day.U, noLookCells: day.U,
    share: (100 * day.U) / (day.T + day.U),
    districts: (day.d ?? []).length,
    districtsMostly: (day.d ?? []).filter(mostly).length,
    seasonDistrictDays, seasonMostly,
    seasonFrom: dates[0] ?? FRAME_DATE, seasonTo: dates[dates.length - 1] ?? FRAME_DATE,
    rings: dist.districts.flatMap((d) => d.rings),
    hatchUrl: `${BASE}ka-data/vis${FRAME_YEAR}/${FRAME_DATE}.png`,
    // still photos of the same box in plain latitude and longitude, so the photo, the hatch and the outlines line up
    photos: PHOTO_LAYERS.map((layer) => ({
      name: layer.name,
      url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0'
        + `&LAYERS=${layer.id}&STYLES=&FORMAT=image/jpeg&CRS=EPSG:4326&BBOX=${s},${w},${n},${e}`
        + `&WIDTH=${Math.round(width * 1.5)}&HEIGHT=${Math.round(height * 1.5)}&TIME=${FRAME_DATE}`,
    })),
    firemaskProduct: vis.source?.firemask?.product ?? null,
    firemaskAccess: vis.source?.firemask?.access ?? null,
    boundarySource: vis.source?.districts?.name ?? null,
    boundaryLicence: vis.source?.districts?.license ?? null,
  };
}

export interface FrameSpots { inside: Pt[]; outside: Pt[]; product: string | null }

function inRing(lon: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!, [xj, yj] = ring[j]!;
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** That day's VIIRS hotspots from the season file Play the season draws, split by whether they fall inside a
 *  district outline (the file covers a box around the province, not the province itself). */
export async function loadFrameSpots(rings: [number, number][][]): Promise<FrameSpots | null> {
  const file = await getJson<SeasonFile>(`${BASE}ka-data/kalteng_${FRAME_YEAR}_season.json`);
  const day = Array.isArray(file.days) ? file.days.find((d) => d.date === FRAME_DATE) : undefined;
  if (!day) return null;
  const inside: Pt[] = [], outside: Pt[] = [];
  for (const p of day.pts) (rings.some((r) => inRing(p[0], p[1], r)) ? inside : outside).push(p);
  return { inside, outside, product: file.source?.product ?? null };
}

// ------------------------------------------------------------------------------------------------ the reporting rule

/** ka-data/blind_rule_kalteng.json (pipeline/visibility/build_blind_rule.py): over the built August to October seasons
 *  of Central Kalimantan, the district-days on which more than half of a district's no-fire cell-days had no
 *  cloud-free look, and the same count for a wet-season quarter as a contrast. */
export interface BlindRule {
  seasons: number;
  years: number[];
  above: number;
  districtDays: number;
  sharePct: number;
  wet: { year: number; above: number; districtDays: number; sharePct: number } | null;
}
interface RuleCount { seasons?: number; district_days_above?: number; district_days?: number }
interface BlindRuleFile {
  total?: RuleCount;
  seasons?: { year?: number; aug_oct?: boolean }[];
  wet_season_contrast?: { total?: RuleCount; seasons?: { year?: number }[] };
}

export async function loadBlindRule(): Promise<BlindRule | null> {
  const file = await getJson<BlindRuleFile>(`${BASE}ka-data/blind_rule_kalteng.json`);
  const t = file.total;
  if (!t || typeof t.district_days_above !== 'number' || typeof t.district_days !== 'number' || !(t.district_days > 0)) return null;
  const years = (file.seasons ?? []).filter((s) => s.aug_oct !== false && typeof s.year === 'number').map((s) => s.year as number)
    .sort((a, b) => a - b);
  const w = file.wet_season_contrast?.total;
  const wetYear = file.wet_season_contrast?.seasons?.[0]?.year;
  return {
    seasons: t.seasons ?? years.length,
    years,
    above: t.district_days_above,
    districtDays: t.district_days,
    sharePct: (100 * t.district_days_above) / t.district_days,
    wet: w && typeof w.district_days_above === 'number' && typeof w.district_days === 'number' && w.district_days > 0 && typeof wetYear === 'number'
      ? { year: wetYear, above: w.district_days_above, districtDays: w.district_days, sharePct: (100 * w.district_days_above) / w.district_days }
      : null,
  };
}

/** How many kabupaten and kota have an (approximate) record of their own, and how many of them are flagged low data. */
export interface DistrictCount { total: number; lowData: number; method: string | null; licence: string | null }
export async function loadDistrictCount(): Promise<DistrictCount | null> {
  const file = await getJson<{ districts?: { low_data?: unknown }[]; method?: string; boundaries?: { licence?: string } }>(`${BASE}ss-data/districts/index.json`);
  return Array.isArray(file.districts) && file.districts.length
    ? {
      total: file.districts.length,
      lowData: file.districts.filter((d) => !!d.low_data).length,
      method: typeof file.method === 'string' ? file.method : null,
      licence: file.boundaries?.licence ?? null,
    }
    : null;
}

// ------------------------------------------------------------------------------------------------ plain names
// The validation file names its methods and regions by short codes; the pages show these words instead ([en, id]).

export const METHOD_NAMES: Record<string, [string, string]> = {
  M0: ['the raw splice', 'sambungan mentah'],
  M1: ['one ratio for the whole country', 'satu rasio untuk seluruh negeri'],
  M2: ['one ratio per island region and season', 'satu rasio per wilayah pulau dan musim'],
};
export const REGION_NAMES: Record<string, [string, string]> = {
  'Jawa-NusaTenggara-Bali-Maluku': ['Java, Nusa Tenggara, Bali and Maluku', 'Jawa, Nusa Tenggara, Bali, dan Maluku'],
  Kalimantan: ['Kalimantan', 'Kalimantan'],
  Papua: ['Papua', 'Papua'],
  Sulawesi: ['Sulawesi', 'Sulawesi'],
  Sumatra: ['Sumatra', 'Sumatra'],
};
