// Project 4 (new file, not from Fire Harmony): the Indonesia record, read from the Second Sight bundle in
// public/ss-data/ (written by Second Sight's `python -m pipeline.export.bundle` plus the project 4 observability fields;
// schema in vendor/second-sight/pipeline/export/README.md and INTEGRATION.md "Data contract").
// Every number the record pages show is computed here from those files. Nothing is filled in: a value the bundle does
// not have stays null, and a file that is not there yet is "missing" (the pages say "not built yet"), never a demo file.

import { fmtNumber, locale, monthName as monthOf, type Lang } from './lang';

const BASE = import.meta.env.BASE_URL;
export const SS_URL = `${BASE}ss-data/`;
export const KALTENG = 'prov-kalimantan-tengah';
export const NATIONAL = 'IDN';
export const SEASON_YEARS = [2015, 2019, 2023] as const;

// ------------------------------------------------------------------------------------------------ types

export type ObsClass = 'good' | 'partial' | 'unobserved';

/** One AOI of index.json. */
export interface AoiEntry {
  aoi_id: string;
  name?: string; name_id?: string; name_en?: string;
  level?: 'national' | 'island_region' | 'province' | string;
  island_region?: string | null;
  featured?: boolean;
  file: string;
  n_months?: number;
  harmonized?: boolean;
  first?: string | null; last?: string | null;
  provisional_months?: string[];
  partial_month?: string | null;
  area_km2?: number | null;
  // districts only (public/ss-data/districts/index.json, level "district")
  province?: string; province_aoi?: string;
  centroid?: [number, number]; bbox?: number[];
  mean_cell_days_per_year?: number | null;
  low_data?: boolean | string | null;
  /** months the district run did not compute (null values): a registered test covers them */
  locked_months?: string[];
}

/** districts/index.json: kabupaten and kota, each sharing its province's monthly conversion (approximate). */
export interface DistrictIndex {
  approximate?: boolean; method?: string; generated_at?: string; unit?: string;
  baseline_period?: [number, number];
  locked?: { province?: string; months?: string[]; districts?: string[]; note?: string };
  n_districts?: number;
  /** districts summed to their province against the province file, per province and satellite */
  grid_check_summary?: { pairs?: number; median_abs_total_pct_diff?: number; max_abs_total_pct_diff?: number };
  districts: AoiEntry[];
}

export interface RecordIndex {
  app?: string;
  data_version?: string;
  generated_at?: string;
  calibration_window?: [number, number];
  baseline_period?: [number, number];
  harmonized?: boolean;
  harmonized_note?: string | null;
  unit?: string;
  not_yet_filled?: string[];
  aois: AoiEntry[];
  /** project 4: the months whose obs_class was computed, per AOI ("YYYY-MM") */
  obs_months?: Record<string, string[]>;
}

/** One row of monthly_<aoi>.json, as the bundle writes it. */
export interface MonthRow {
  aoi_id: string;
  year: number;
  month: number;
  H: number | null; H_lo: number | null; H_hi: number | null;
  A_raw: number | null; T_raw: number | null; V_raw: number | null; N20_raw: number | null;
  sensor_used: string | null;
  baseline_median: number | null;
  pct_rank: number | null;
  obs_class: ObsClass | null;
  flag_nrt: boolean | null;
  flag_partial: boolean | null;
  agreement: string | null;
  // project 4, Central Kalimantan months with FireMask visibility only
  f_cloud?: number | null; f_missing?: number | null; O?: number | null; obs_source?: string | null;
}

export interface Ablation {
  method: string; loyo_mdape?: number | null; ape_2015?: number | null; ape_2019?: number | null;
  overlap_kge?: number | null; delta_seam_2012?: number | null;
}
export interface TestRow {
  test_id: string; metric: string; value: number | null; ci?: unknown; rule?: string | null;
  passed: boolean | null; status?: string; notes?: string | null;
}
export interface Validation {
  meta: { run_utc?: string; ablation?: Ablation[]; chosen_method?: string; n_boot?: number; last_month?: string; commit?: string } | null;
  results: TestRow[];
}

export interface Trend { slope_raw_per_yr?: number; slope_H_per_yr?: number; slope_H_lo?: number; slope_H_hi?: number; artefact_share?: number | null }
export interface Finding {
  meta?: { run_utc?: string; status?: string; raw_definition?: string; H_definition?: string; interval?: string };
  regions?: Record<string, { trend_2001_2025?: Trend } | undefined>;
  en?: string; text?: string;
}

// ------------------------------------------------------------------------------------------------ loading

/** The state of one file: loading, not there yet (the build has not written it), failed, or in. */
export type Load<T> =
  | { state: 'loading' }
  | { state: 'missing' }
  | { state: 'error'; message: string }
  | { state: 'ok'; data: T };

class Missing extends Error {}

/** Reads a JSON file. A 404, or the dev server's page served in its place (no JSON content type), means the file has
 *  not been built: that is `Missing`, not an error. */
export async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (r.status === 404) throw new Missing(url);
  if (!r.ok) throw new Error(`${url.split('/').pop()}: HTTP ${r.status}`);
  if (!(r.headers.get('content-type') ?? '').includes('json')) throw new Missing(url);
  return r.json() as Promise<T>;
}

/** Turns a promise into a Load (for useEffect callers). */
export function settle<T>(p: Promise<T>, done: (l: Load<T>) => void): void {
  p.then((data) => done({ state: 'ok', data }))
    .catch((e: unknown) => done(e instanceof Missing ? { state: 'missing' }
      : { state: 'error', message: e instanceof Error ? e.message : String(e) }));
}

const cache = new Map<string, Promise<unknown>>();
function once<T>(key: string, make: () => Promise<T>): Promise<T> {
  let p = cache.get(key) as Promise<T> | undefined;
  if (!p) {
    p = make();
    cache.set(key, p);
    p.catch(() => cache.delete(key));   // a failed or missing file is asked again next time
  }
  return p;
}

/** index.json: written last by the data work, so its presence means the bundle is complete. */
export function loadIndex(): Promise<RecordIndex> {
  return once('index', async () => {
    const idx = await getJson<RecordIndex>(`${SS_URL}index.json`);
    if (!Array.isArray(idx.aois) || idx.aois.length === 0) throw new Error('index.json lists no areas');
    return idx;
  });
}

export function loadMonthly(aoi: AoiEntry): Promise<MonthRow[]> {
  return once(`m:${aoi.aoi_id}`, async () => {
    const body = await getJson<MonthRow[] | { rows: MonthRow[] }>(`${SS_URL}${aoi.file}`);
    const rows = Array.isArray(body) ? body : body.rows;
    if (!Array.isArray(rows)) throw new Error(`${aoi.file}: no rows`);
    return [...rows].sort((a, b) => a.year - b.year || a.month - b.month);
  });
}

/** validation_results.json: `{meta, results}` (pipeline/run/validate_all.py) or a bare list (pipeline/science/run.py). */
export function loadValidation(): Promise<Validation> {
  return once('validation', async () => {
    const body = await getJson<{ meta?: Validation['meta']; results?: TestRow[] } | TestRow[]>(`${SS_URL}validation_results.json`);
    return Array.isArray(body) ? { meta: null, results: body } : { meta: body.meta ?? null, results: body.results ?? [] };
  });
}

export function loadFinding(): Promise<Finding> {
  return once('finding', () => getJson<Finding>(`${SS_URL}finding.json`));
}

/** districts/index.json, written by the district run. Missing (not built) is a normal state: the page then has no
 *  district picker and works as before. */
export function loadDistricts(): Promise<DistrictIndex> {
  return once('districts', async () => {
    const d = await getJson<DistrictIndex>(`${SS_URL}districts/index.json`);
    if (!Array.isArray(d.districts)) throw new Error('districts/index.json lists no districts');
    return { ...d, districts: d.districts.filter((x) => x && typeof x.aoi_id === 'string' && typeof x.file === 'string') };
  });
}

/** One point of a season file: lon, lat, frp (MW), isNight (1 or 0). */
export type HotspotPt = [number, number, number, number];
export interface SeasonPoints {
  source?: { url?: string; product?: string; filter_text?: string; sha256?: string; downloaded_utc?: string; day_is?: string };
  bbox?: number[]; bbox_note?: string;
  days: { date: string; pts: HotspotPt[] }[];
}
/** The VIIRS detections of one built season (ka-data/kalteng_<key>_season.json, the file Play the season draws). */
export function loadSeasonPoints(key: number | string): Promise<SeasonPoints> {
  return once(`seasonpts:${key}`, async () => {
    const f = await getJson<SeasonPoints>(`${BASE}ka-data/kalteng_${key}_season.json`);
    if (!Array.isArray(f.days) || f.days.length === 0) throw new Error(`kalteng_${key}_season.json: the file has no days`);
    return f;
  });
}

/** A built point file and the months it covers: an August to October season, or another quarter. */
export interface SeasonWindow { key: string; year: number; from: string; to: string }
export const seasonWindow = (year: number): SeasonWindow => ({ key: String(year), year, from: `${year}-08`, to: `${year}-10` });
/** Point files that are not an August to October season (the wet-season quarter kept for contrast). */
export const EXTRA_WINDOWS: SeasonWindow[] = [{ key: '2023_janmar', year: 2023, from: '2023-01', to: '2023-03' }];
/** The first year a season file can exist for: the points are VIIRS S-NPP detections. */
export const FIRST_SEASON_YEAR = 2012;

/** Does a ka-data season file exist? Asked with HEAD, so the points themselves are not downloaded (the record page
 *  only links to seasons that are built; the dev server answers a missing file with its page, which is not JSON). */
export function seasonFileBuilt(key: number | string): Promise<boolean> {
  return once(`season:${key}`, async () => {
    const r = await fetch(`${BASE}ka-data/kalteng_${key}_season.json`, { method: 'HEAD' });
    return r.ok && (r.headers.get('content-type') ?? '').includes('json');
  }).catch(() => false);
}
export const seasonBuilt = (year: number): Promise<boolean> => seasonFileBuilt(year);

/** ka-data/blind_rule_kalteng.json: district-days where cloud left more than half of a district's no-fire cells with
 *  no cloud-free look, per Aug to Oct season (the 2019 season is not in it: a registered test covers it). */
export interface BlindRuleSeason {
  year: number; season: string; window?: string; aug_oct?: boolean; days?: number; days_counted?: number;
  district_days_above: number; district_days: number; share_pct: number;
  worst_day?: { date: string; share_no_cloud_free_look: number; fire_cells?: number };
}
export interface BlindRule {
  rule?: string; threshold?: number;
  excluded?: { season?: string; why?: string };
  total?: { seasons: number; district_days_above: number; district_days: number; share_pct: number };
  seasons?: BlindRuleSeason[];
}
export function loadBlindRule(): Promise<BlindRule> {
  return once('blind-rule', () => getJson<BlindRule>(`${BASE}ka-data/blind_rule_kalteng.json`));
}

// ------------------------------------------------------------------------------------------------ names and words

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
export const ym = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;
/** The 12 month names in a language: long ("October" / "Oktober") or short ("Oct" / "Okt"). */
export const monthsIn = (lang: Lang, width: 'short' | 'long' = 'long') => MONTHS.map((_, i) => monthOf(i + 1, lang, width));
/** "October 2015" / "Oktober 2015" for a "YYYY-MM" key (English when no language is given). */
export const monthName = (key: string, lang: Lang = 'en') =>
  `${lang === 'en' ? MONTHS[Number(key.slice(5, 7)) - 1] ?? '' : monthOf(Number(key.slice(5, 7)), lang, 'long')} ${key.slice(0, 4)}`;
/** An area's name: its English name, or its Indonesian one when the page is in Bahasa Indonesia. */
export const aoiName = (a: AoiEntry, lang: Lang = 'en') =>
  (lang === 'id' ? a.name_id ?? a.name ?? a.name_en : a.name_en ?? a.name) ?? a.aoi_id;

/** Whole number, with the language's separators (1,743 in English, 1.743 in Indonesian). */
export const fmtInt = (n: number, lang: Lang = 'en') => (lang === 'en' ? Math.round(n).toLocaleString('en-US') : fmtNumber(Math.round(n), lang));
export const fmt1 = (n: number, lang: Lang = 'en') =>
  (lang === 'en' ? n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : fmtNumber(n, lang, 1));
/** 52,341 -> "52k", 1,234,567 -> "1.2M" ("52rb", "1,2jt" in Indonesian): for small calendar cells only (the full
 *  number is in the cell's label). */
export function fmtCompact(n: number, lang: Lang = 'en'): string {
  const a = Math.abs(n);
  if (a < 10_000) return fmtInt(n, lang);
  if (a < 1_000_000) return `${Math.round(n / 1000)}${lang === 'id' ? 'rb' : 'k'}`;
  return `${fmt1(n / 1_000_000, lang)}${lang === 'id' ? 'jt' : 'M'}`;
}
/** "+38%" / "−24%" (a true minus sign). */
export const signedPct = (x: number) => `${x >= 0 ? '+' : '−'}${fmtInt(Math.abs(x))}%`;

/** The sensor family of a row's harmonized value. */
export function isViirs(sensor: string | null): boolean {
  return sensor === 'SNPP' || sensor === 'NOAA20' || sensor === 'NOAA21' || sensor === 'VIIRS';
}
export const SENSOR_NAME: Record<string, string> = {
  Terra: 'MODIS Terra', Aqua: 'MODIS Aqua', SNPP: 'VIIRS S-NPP', NOAA20: 'VIIRS NOAA-20', NOAA21: 'VIIRS NOAA-21',
  MODIS: 'MODIS', VIIRS: 'VIIRS',
};

/** The groups of the area picker: Central Kalimantan first, then Indonesia, the regions, the featured provinces, the
 *  other provinces (in the order of index.json). */
export function aoiGroups(aois: AoiEntry[], lang: Lang = 'en'): { label: string; items: AoiEntry[] }[] {
  const ck = aois.filter((a) => a.aoi_id === KALTENG);
  const rest = aois.filter((a) => a.aoi_id !== KALTENG);
  const t = (en: string, id: string) => (lang === 'id' ? id : en);
  const groups = [
    { label: t('With the cloud layer', 'Dengan lapisan awan'), items: ck },
    { label: t('Country', 'Negara'), items: rest.filter((a) => a.level === 'national') },
    { label: t('Island regions', 'Wilayah pulau'), items: rest.filter((a) => a.level === 'island_region') },
    { label: t('Featured provinces', 'Provinsi utama'), items: rest.filter((a) => a.level === 'province' && a.featured) },
    { label: t('Other provinces', 'Provinsi lain'), items: rest.filter((a) => a.level === 'province' && !a.featured) },
    { label: t('Other areas', 'Wilayah lain'), items: rest.filter((a) => a.level !== 'national' && a.level !== 'island_region' && a.level !== 'province') },
  ];
  return groups.filter((g) => g.items.length);
}

// ------------------------------------------------------------------------------------------------ the record

/** MODIS raw of a row: Aqua, or Terra where Aqua has no data (Second Sight's app/src/data.ts normalize). */
export const modisRaw = (r: MonthRow) => r.A_raw ?? r.T_raw ?? null;
/** VIIRS raw of a row: S-NPP, or NOAA-20 where S-NPP has no data (same rule). */
export const viirsRaw = (r: MonthRow) => r.V_raw ?? r.N20_raw ?? null;
/** The raw record stitched naively, as beforeafter.ts defines it: MODIS until 2011, VIIRS from 2012. */
export const rawSpliced = (r: MonthRow) => (r.year <= 2011 ? modisRaw(r) : viirsRaw(r));
export const SEAM_YEAR = 2012;

export const isProvisional = (r: MonthRow) => !!r.flag_nrt || !!r.flag_partial;

/** A month converted from VIIRS with some fire but no 90% interval (H_lo = H_hi = H > 0). Second Sight's own export
 *  produced these for every province from 2022 (one pooled national ratio, docs/DATA.md 8.1); project 4's re-export
 *  (docs/DATA.md 9.1) has none, but the app still checks rather than assume. Not flagged: Aqua-era months (Aqua's own
 *  count, no conversion) and months with no VIIRS fire at all (0 converts to exactly 0). */
export const noInterval = (r: MonthRow) =>
  r.H != null && r.H > 0 && isViirs(r.sensor_used) && r.H_lo != null && r.H_lo === r.H_hi;

/** The single VIIRS-to-MODIS ratio behind those months (median of H / V_raw over the S-NPP months without an
 *  interval), or null when there are none. */
export function pooledRatio(rows: MonthRow[]): { ratio: number; from: number } | null {
  const xs = rows.filter((r) => noInterval(r) && r.sensor_used === 'SNPP' && (r.V_raw ?? 0) > 0);
  if (!xs.length) return null;
  const v = xs.map((r) => r.H! / r.V_raw!).sort((a, b) => a - b);
  return { ratio: v[Math.floor(v.length / 2)]!, from: Math.min(...xs.map((r) => r.year)) };
}

/** The blind share of a month whose observability was computed: of its no-fire cell-days, the share Terra and Aqua
 *  had no clear look (U / (T + U), TRI-04). */
export const blindShare = (r: MonthRow) => (r.f_cloud == null ? null : r.f_cloud);
export const pct1 = (x: number, lang: Lang = 'en') =>
  `${lang === 'en' ? (Math.round(x * 1000) / 10).toFixed(1) : fmtNumber(Math.round(x * 1000) / 10, lang, 1)}%`;

export interface YearPoint {
  year: number;
  naive: number; summed: number; H: number; lo: number; hi: number;   // indexed: own 2003-2011 mean = 100
  rawNaive: number; rawSummed: number; rawH: number; rawLo: number; rawHi: number;   // fire cell-days
  provisional: boolean;
  noBand: boolean;   // some month of the year was converted without an interval: no 90% range for the year
  months: number;
}
export interface BeforeAfter {
  points: YearPoint[];
  /** % change of the mean of 2019-2023 over the mean of 2003-2007: stitched naively and on the harmonized scale */
  changeNaive: number | null;
  changeH: number | null;
  firstYear: number; lastYear: number;
}

/**
 * "Before and after", with Second Sight's definitions (vendor/second-sight/app/src/beforeafter.ts): yearly totals
 * 2003 to 2026; naive = MODIS until 2011 and VIIRS from 2012; summed = MODIS + VIIRS (wrong: the same fire counted
 * twice from 2012); H = harmonized, band = sums of the monthly 90% bounds (an approximation, as theirs). Each line is
 * indexed to its own 2003-2011 mean (= 100). Change = mean 2019-2023 / mean 2003-2007 - 1.
 */
export function beforeAfter(rows: MonthRow[]): BeforeAfter | null {
  const years = new Map<number, Omit<YearPoint, 'naive' | 'summed' | 'H' | 'lo' | 'hi'>>();
  for (const r of rows) {
    if (r.year < 2003 || r.year > 2026) continue;
    const y = years.get(r.year) ?? { year: r.year, rawNaive: 0, rawSummed: 0, rawH: 0, rawLo: 0, rawHi: 0, provisional: false, noBand: false, months: 0 };
    y.noBand ||= noInterval(r);
    y.rawNaive += rawSpliced(r) ?? 0;
    y.rawSummed += (modisRaw(r) ?? 0) + (viirsRaw(r) ?? 0);
    y.rawH += r.H ?? 0;
    y.rawLo += r.H_lo ?? r.H ?? 0;
    y.rawHi += r.H_hi ?? r.H ?? 0;
    y.provisional ||= isProvisional(r);
    y.months += 1;
    years.set(r.year, y);
  }
  const raw = [...years.values()].sort((a, b) => a.year - b.year);
  if (raw.length < 2) return null;
  type K = 'rawNaive' | 'rawSummed' | 'rawH';
  const mean = (k: K, a: number, b: number) => {
    const xs = raw.filter((p) => p.year >= a && p.year <= b).map((p) => p[k]);
    return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN;
  };
  const base = (k: K) => { const m = mean(k, 2003, 2011); return m > 0 ? m : 1; };
  const bN = base('rawNaive'), bS = base('rawSummed'), bH = base('rawH');
  const points = raw.map((p) => ({
    ...p,
    naive: (p.rawNaive / bN) * 100, summed: (p.rawSummed / bS) * 100,
    H: (p.rawH / bH) * 100, lo: (p.rawLo / bH) * 100, hi: (p.rawHi / bH) * 100,
  }));
  const chg = (k: K) => { const c = (mean(k, 2019, 2023) / mean(k, 2003, 2007) - 1) * 100; return Number.isFinite(c) ? c : null; };
  return { points, changeNaive: chg('rawNaive'), changeH: chg('rawH'), firstYear: raw[0]!.year, lastYear: raw[raw.length - 1]!.year };
}

/** How many more fire cell-days VIIRS S-NPP counts than MODIS Aqua over the same months (the size of the jump), over
 *  the years given (the calibration window of index.json): sum of V_raw / sum of A_raw over months where both report. */
export function sensorRatio(rows: MonthRow[], [from, to]: [number, number]): { ratio: number; months: number; from: number; to: number } | null {
  let v = 0, a = 0, n = 0;
  for (const r of rows) {
    if (r.year < from || r.year > to || r.V_raw == null || r.A_raw == null) continue;
    v += r.V_raw; a += r.A_raw; n += 1;
  }
  return a > 0 && n > 0 ? { ratio: v / a, months: n, from, to } : null;
}

// ------------------------------------------------------------------------------------------------ calendar cells

export type Series = 'raw' | 'harm';
/** Observability of a month: one of the TRI-04 classes, or not computed (never shown as unobserved). */
export type ObsState = ObsClass | 'not-computed';

export function obsState(r: MonthRow, computed: Set<string> | null): ObsState {
  const key = ym(r.year, r.month);
  if (r.obs_class == null) return 'not-computed';
  if (computed && !computed.has(key)) return 'not-computed';
  return r.obs_class;
}

export function cellValue(r: MonthRow, s: Series): number | null {
  return s === 'harm' ? r.H : rawSpliced(r);
}

/** The ember step (0 = no fire, 1 to 9) of a value on one log scale for both series, so switching Raw and Harmonized
 *  keeps the colours' meaning and shows the 2012 jump. */
export function emberStep(v: number, max: number): number {
  if (v <= 0) return 0;
  if (max <= 0) return 1;
  return Math.max(1, Math.min(9, Math.ceil((9 * Math.log1p(v)) / Math.log1p(max))));
}

// ------------------------------------------------------------------------------------------------ this month

export interface MonthVerdict {
  key: string;
  H: number; lo: number | null; hi: number | null;
  raw: number | null;
  ratio: number | null;       // H / median of the same calendar month
  medianFrom: 'baseline' | 'others' | null;
  rank: number; of: number;   // rank among the same calendar month of every year with a harmonized value
  higherThan: number;         // share of the other years' same month below this one (0 to 1)
  provisional: boolean;
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo);
}

/** The sentence numbers of one month, with Second Sight's rules (vendor/second-sight/app/src/bulan.ts). */
export function monthVerdict(rows: MonthRow[], key: string): MonthVerdict | null {
  const y = Number(key.slice(0, 4)), m = Number(key.slice(5, 7));
  const cur = rows.find((r) => r.year === y && r.month === m);
  if (!cur || cur.H == null) return null;
  const h = cur.H;
  const same = rows.filter((r) => r.month === m && r.H != null);
  const others = same.filter((r) => r.year !== y).map((r) => r.H!);
  const below = others.filter((v) => v < h).length;
  const fromOthers = quantile([...others].sort((a, b) => a - b), 0.5);
  const med = cur.baseline_median ?? (Number.isFinite(fromOthers) ? fromOthers : null);
  return {
    key, H: h, lo: cur.H_lo, hi: cur.H_hi, raw: rawSpliced(cur),
    ratio: med != null && med > 0 ? h / med : null,
    medianFrom: cur.baseline_median != null ? 'baseline' : med != null ? 'others' : null,
    rank: same.filter((r) => r.H! > h).length + 1, of: same.length,
    higherThan: others.length ? below / others.length : 0,
    provisional: isProvisional(cur),
  };
}

/** The month with the most harmonized fire (the calendar opens on it). */
export function peakMonth(rows: MonthRow[]): string | null {
  let best: MonthRow | null = null;
  for (const r of rows) if (r.H != null && (!best || r.H > best.H!)) best = r;
  return best ? ym(best.year, best.month) : null;
}

// ------------------------------------------------------------------------------------------------ validation

export type TestStatus = 'pass' | 'fail' | 'not_run' | 'na' | 'info';
export function testStatus(r: TestRow): TestStatus {
  if (r.status === 'not_applicable') return 'na';
  if (r.status && r.status !== 'run') return 'not_run';
  if (r.passed === true) return 'pass';
  if (r.passed === false) return 'fail';
  return 'info';
}

/** The trust numbers (yakin.ts): the raw method (M0) against the chosen one (default M3), on held-out years. */
export function trust(v: Validation): { raw: Ablation; harm: Ablation; chosen: string } | null {
  const abl = v.meta?.ablation ?? [];
  const chosen = v.meta?.chosen_method ?? 'M3';
  const raw = abl.find((a) => a.method === 'M0');
  const harm = abl.find((a) => a.method === chosen);
  return raw && harm ? { raw, harm, chosen } : null;
}

/** A short version of the bundle's data version (a sha256). */
export const shortVersion = (v?: string) => (v ? v.slice(0, 8) : null);
export function dateOnly(iso?: string, lang: Lang = 'en'): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null
    : new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}

// ------------------------------------------------------------------------------------------------ a picked range
// "Select a region and a date range": From month and To month on the monthly record. Totals are plain sums of the
// monthly values; the 90% range of a total is the sum of the monthly bounds (as the yearly band, an approximation).

/** A range of months, inclusive: "YYYY-MM" to "YYYY-MM", from <= to. */
export interface MonthRange { from: string; to: string }

const YM = /^\d{4}-(0[1-9]|1[0-2])$/;
export const isYm = (s: string | null | undefined): s is string => !!s && YM.test(s);
/** Months since year 0: to compare and step "YYYY-MM" keys. */
export const ymIndex = (key: string) => Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7)) - 1;
export const ymOfIndex = (i: number) => ym(Math.floor(i / 12), (i % 12) + 1);
export const inRange = (key: string, r: MonthRange) => key >= r.from && key <= r.to;
export const rangeMonths = (r: MonthRange) => ymIndex(r.to) - ymIndex(r.from) + 1;

/** The range an address asks for, kept inside the record: swapped when reversed, clamped to the first and last month.
 *  Null when an end is missing or is not a month, or when the whole range lies outside the record. */
export function clampRange(from: string | null | undefined, to: string | null | undefined, first: string, last: string): MonthRange | null {
  if (!isYm(from) || !isYm(to) || !isYm(first) || !isYm(last)) return null;
  let a = ymIndex(from), b = ymIndex(to);
  if (a > b) [a, b] = [b, a];
  const lo = ymIndex(first), hi = ymIndex(last);
  if (b < lo || a > hi) return null;
  return { from: ymOfIndex(Math.max(a, lo)), to: ymOfIndex(Math.min(b, hi)) };
}

/** "September 2015", "August to October 2015", "November 2014 to February 2015" ("Agustus sampai Oktober 2015"). */
export function rangeLabel(r: MonthRange, lang: Lang = 'en'): string {
  if (r.from === r.to) return monthName(r.from, lang);
  const sameYear = r.from.slice(0, 4) === r.to.slice(0, 4);
  return `${sameYear ? monthsIn(lang)[Number(r.from.slice(5, 7)) - 1] : monthName(r.from, lang)} ${lang === 'id' ? 'sampai' : 'to'} ${monthName(r.to, lang)}`;
}

export interface RangeTotals {
  months: number;            // months of the range
  withH: number;             // of them, with a harmonized value
  withRaw: number;           // of them, with a raw value
  H: number | null; lo: number | null; hi: number | null;   // sums; lo and hi are sums of the monthly 90% bounds
  raw: number | null;        // raw stitched as recorded (MODIS to 2011, VIIRS from 2012)
  noBand: boolean;           // some month has fire and no interval: no 90% range for the total
  own: boolean;              // every month is Aqua MODIS's own count (nothing converted, so the range has no width)
  provisional: string[];     // near real time months
  partial: string[];         // months still running when the bundle was built
  held: string[];            // months not computed for this area (a registered test covers them): in no total
}

function sumRows(rs: MonthRow[]) {
  let H = 0, lo = 0, hi = 0, raw = 0, withH = 0, withRaw = 0, noBand = false, own = true;
  const provisional: string[] = [], partial: string[] = [];
  for (const r of rs) {
    if (r.H != null) { H += r.H; lo += r.H_lo ?? r.H; hi += r.H_hi ?? r.H; withH += 1; own &&= r.sensor_used === 'Aqua'; }
    const w = rawSpliced(r);
    if (w != null) { raw += w; withRaw += 1; }
    noBand ||= noInterval(r);
    if (r.flag_partial) partial.push(ym(r.year, r.month));
    else if (r.flag_nrt) provisional.push(ym(r.year, r.month));
  }
  return { H: withH ? H : null, lo: withH ? lo : null, hi: withH ? hi : null, raw: withRaw ? raw : null, withH, withRaw, noBand, own: own && withH > 0, provisional, partial };
}

/** The months of the record inside a range, in order. */
export const rowsInRange = (rows: MonthRow[], r: MonthRange) => rows.filter((x) => inRange(ym(x.year, x.month), r));

/** The totals of a picked range: sums of the existing monthly record, nothing else. */
export function rangeTotals(rows: MonthRow[], r: MonthRange, locked?: Set<string>): RangeTotals {
  const inside = rowsInRange(rows, r);
  return { months: rangeMonths(r), ...sumRows(inside), held: inside.filter((x) => isHeldMonth(x, locked)).map((x) => ym(x.year, x.month)) };
}

/** A month a registered test covers that has no value here: it was not computed (never a zero, never "no data"). */
export const isHeldMonth = (r: MonthRow, locked?: Set<string> | null) => r.H == null && !!locked?.has(ym(r.year, r.month));

/** One row of "the same months in every year". */
export interface SamePeriod {
  start: string; end: string;      // "YYYY-MM"
  label: string;                   // "2015", or "2014 to 2015" when the months cross a new year
  H: number | null; lo: number | null; hi: number | null; raw: number | null;
  complete: boolean;               // every month has a harmonized value and none is still running
  provisional: boolean; partial: boolean;
  held: boolean;                   // a month of the period was not computed (a registered test covers it)
  picked: boolean;
}
export interface SameMonths {
  periods: SamePeriod[];
  picked: SamePeriod | null;
  rank: number | null; of: number;   // the picked period among the complete ones, 1 = the most fire
  median: number | null;             // of the complete periods' harmonized totals
  ratio: number | null;              // picked / median
}

/** The same calendar months in every year of the record (a range of 12 months or fewer; null for a longer one). A
 *  period with a missing or still-running month is listed but left out of the rank and the median. */
export function sameMonths(rows: MonthRow[], r: MonthRange, locked?: Set<string>): SameMonths | null {
  const n = rangeMonths(r);
  if (n > 12 || !rows.length) return null;
  const byKey = new Map(rows.map((x) => [ym(x.year, x.month), x]));
  const m0 = Number(r.from.slice(5, 7));
  const firstY = rows[0]!.year - 1, lastY = rows[rows.length - 1]!.year;
  const periods: SamePeriod[] = [];
  for (let y = firstY; y <= lastY; y++) {
    const s = ymIndex(ym(y, m0));
    const got: MonthRow[] = [];
    for (let i = 0; i < n; i++) { const x = byKey.get(ymOfIndex(s + i)); if (x) got.push(x); }
    if (!got.length) continue;
    const t = sumRows(got);
    const start = ymOfIndex(s), end = ymOfIndex(s + n - 1);
    const y2 = end.slice(0, 4);
    periods.push({
      start, end, label: y2 === String(y) ? String(y) : `${y} to ${y2}`,
      H: t.H, lo: t.lo, hi: t.hi, raw: t.raw,
      complete: t.withH === n && t.partial.length === 0,
      provisional: t.provisional.length > 0, partial: t.partial.length > 0,
      held: got.some((x) => isHeldMonth(x, locked)),
      picked: start === r.from,
    });
  }
  const picked = periods.find((p) => p.picked) ?? null;
  const done = periods.filter((p) => p.complete).map((p) => p.H!);
  const med = done.length ? quantile([...done].sort((a, b) => a - b), 0.5) : null;
  const ranked = !!picked && picked.complete;
  return {
    periods, picked,
    rank: ranked ? done.filter((v) => v > picked.H!).length + 1 : null, of: done.length,
    median: med,
    ratio: ranked && med != null && med > 0 ? picked.H! / med : null,
  };
}

// A sibling project (KalenderApi v1.1) registered a test on Central Kalimantan and Pulang Pisau for 1 January to
// 31 October 2019. Until it is run, this app adds no new statistic for those months: sums of the monthly record it
// already shows are fine, a rank or a ratio of a period inside them is not. The district run did not compute those
// months for Central Kalimantan's districts at all (their rows are null, listed in `locked_months`).
export const HELD: MonthRange = { from: '2019-01', to: '2019-10' };
/** The months of an area that a registered test covers ("YYYY-MM"). */
export function lockedMonths(a: AoiEntry): Set<string> {
  if (a.locked_months?.length) return new Set(a.locked_months);
  if (a.aoi_id !== KALTENG) return new Set();
  return new Set(Array.from({ length: rangeMonths(HELD) }, (_, i) => ymOfIndex(ymIndex(HELD.from) + i)));
}
/** Does a picked range of this area fall on the months the registered test covers? */
export function heldRange(a: AoiEntry, r: MonthRange): boolean {
  for (const k of lockedMonths(a)) if (inRange(k, r)) return true;
  return false;
}

// ------------------------------------------------------------------------------------------------ districts

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const KIND = new Set(['kabupaten', 'kab', 'kota', 'kotamadya']);

/** Districts matching what was typed (a kabupaten or kota name, or a province), grouped under their province. Every
 *  word typed must be in the name or the province; "kabupaten" and "kota" alone are not required to match. */
export function searchDistricts(ds: AoiEntry[], query: string, limit = 40): { province: string; items: AoiEntry[] }[] {
  const all = fold(query).split(' ').filter(Boolean);
  if (!all.length) return [];
  const core = all.filter((t) => !KIND.has(t));
  const tokens = core.length ? core : all;
  const hits: { d: AoiEntry; score: number }[] = [];
  for (const d of ds) {
    const name = fold(aoiName(d)), hay = `${name} ${fold(d.province ?? '')}`;
    if (!tokens.every((t) => hay.includes(t))) continue;
    const t0 = tokens[0]!;
    const bare = name.split(' ').filter((w) => !KIND.has(w)).join(' ');
    hits.push({ d, score: bare.startsWith(t0) ? 0 : name.split(' ').some((w) => w.startsWith(t0)) ? 1 : name.includes(t0) ? 2 : 3 });
  }
  hits.sort((a, b) => a.score - b.score || aoiName(a.d).localeCompare(aoiName(b.d)));
  const groups: { province: string; items: AoiEntry[] }[] = [];
  for (const { d } of hits.slice(0, limit)) {
    const p = d.province ?? 'Other';
    let g = groups.find((x) => x.province === p);
    if (!g) { g = { province: p, items: [] }; groups.push(g); }
    g.items.push(d);
  }
  return groups;
}

/** The note of a district flagged low_data (the district run's own words when it gives them). */
export function lowDataNote(a: AoiEntry, lang: Lang = 'en'): string | null {
  if (!a.low_data) return null;
  if (typeof a.low_data === 'string') return a.low_data;
  const mean = a.mean_cell_days_per_year;
  return lang === 'id'
    ? `Data sedikit: berkas kabupaten/kota menandai wilayah ini sebagai wilayah dengan sedikit sel-hari api${mean != null ? ` (rata-rata ${fmt1(mean, lang)} per tahun)` : ''}, sehingga angka satu bulan dan peringkatnya tidak banyak berarti.`
    : `Low data: the district file flags this district as having few fire cell-days${mean != null ? ` (${fmt1(mean)} a year on average)` : ''}, so single months and ranks say little.`;
}

interface Geometry { type: string; coordinates: unknown }
export interface DistrictShapes { features: { properties: { aoi_id?: string; name?: string; province?: string } | null; geometry: Geometry | null }[] }

function inRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number], [xj, yj] = ring[j] as [number, number];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inPolygon = (lon: number, lat: number, poly: number[][][]) =>
  poly.length > 0 && inRing(lon, lat, poly[0]!) && !poly.slice(1).some((hole) => inRing(lon, lat, hole));

/** Is a point inside a GeoJSON Polygon or MultiPolygon? (even-odd ray casting, holes excluded) */
export function pointInGeometry(lon: number, lat: number, g: Geometry | null): boolean {
  if (!g) return false;
  if (g.type === 'Polygon') return inPolygon(lon, lat, g.coordinates as number[][][]);
  if (g.type === 'MultiPolygon') return (g.coordinates as number[][][][]).some((p) => inPolygon(lon, lat, p));
  return false;
}

/** The aoi_id of the district that contains a point, or null (at sea, or outside Indonesia). */
export function districtAt(lon: number, lat: number, shapes: DistrictShapes): string | null {
  for (const f of shapes.features) if (f.properties?.aoi_id && pointInGeometry(lon, lat, f.geometry)) return f.properties.aoi_id;
  return null;
}

export function loadDistrictShapes(): Promise<DistrictShapes> {
  return once('district-shapes', async () => {
    const r = await fetch(`${SS_URL}districts/districts.geojson`);
    if (r.status === 404 || /text\/html/.test(r.headers.get('content-type') ?? '')) throw new Missing('districts.geojson');
    if (!r.ok) throw new Error(`districts.geojson: HTTP ${r.status}`);
    const g = await r.json() as DistrictShapes;
    if (!Array.isArray(g.features)) throw new Error('districts.geojson: no features');
    return g;
  });
}

// ------------------------------------------------------------------------------------------------ CSV files
// Every file starts with "#" comment lines (project, area, unit, data version, method, date, and that fire cell-days
// are not burned area), then one header row, then the rows. The numbers are the record's own; nothing is added.

export const PROJECT_LINE = "KalenderApi: Indonesia's fire record on one scale (NASA Space Apps 2026, Harmonization of MODIS and VIIRS Hot Spots)";
export const NOT_AREA = 'Fire cell-days are not burned area.';
export const UNIT_FALLBACK = 'fire cell-days (0.01 degree cell x local date x satellite x day or night pass)';
export const METHOD_LINE = 'harmonized = VIIRS counts converted to the Aqua MODIS scale, with a 90% range (lo90, hi90); raw_stitched = as recorded, MODIS to 2011 and VIIRS from 2012';

export interface CsvMeta {
  area: string; aoiId: string;
  unit?: string | null;
  dataVersion?: string | null;     // index.json data_version
  generated: string;               // "YYYY-MM-DD"
  notes?: string[];                // extra lines (district values are approximate, ...)
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();
const cell = (v: string | number | boolean | null | undefined): string => {
  if (v == null) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const num = (v: number | null | undefined) => (v == null ? '' : String(Math.round(v * 1000) / 1000));
function toCsv(comments: string[], header: string[], body: (string | number | boolean | null | undefined)[][]): string {
  return [...comments.map((c) => `# ${oneLine(c)}`), header.join(','), ...body.map((r) => r.map(cell).join(','))].join('\r\n') + '\r\n';
}
function headLines(meta: CsvMeta, what: string, r: MonthRange | null, method: string): string[] {
  return [
    PROJECT_LINE,
    what,
    `Area: ${meta.area} (${meta.aoiId})`,
    ...(r ? [`Range: ${r.from} to ${r.to} (${rangeMonths(r)} month${rangeMonths(r) === 1 ? '' : 's'}, inclusive)`] : []),
    `Unit: ${meta.unit || UNIT_FALLBACK}`,
    `Data version: ${meta.dataVersion || 'not stated in the bundle'}`,
    `Method: ${method}`,
    'Source: NASA FIRMS archives (MODIS C6.1 Terra and Aqua, VIIRS 375 m S-NPP and NOAA-20)',
    `Generated: ${meta.generated}`,
    ...(meta.notes ?? []),
    NOT_AREA,
  ];
}

/** The monthly series of an area over a range. */
export function monthlyCsv(rows: MonthRow[], r: MonthRange, meta: CsvMeta, computed: Set<string> | null): string {
  const body = rowsInRange(rows, r).map((x) => [
    ym(x.year, x.month), x.year, x.month, num(x.H), num(x.H_lo), num(x.H_hi), num(rawSpliced(x)),
    num(x.A_raw), num(x.T_raw), num(x.V_raw), num(x.N20_raw), x.sensor_used ?? '',
    x.flag_nrt ? 1 : 0, x.flag_partial ? 1 : 0, obsState(x, computed).replace('-', '_'),
  ]);
  return toCsv(
    [...headLines(meta, 'File: monthly series', r, METHOD_LINE),
      'provisional = 1: near real time data; partial = 1: the month was still running when the bundle was built; observability "not_computed" is unknown, not unobserved'],
    ['month', 'year', 'month_of_year', 'harmonized', 'harmonized_lo90', 'harmonized_hi90', 'raw_stitched', 'modis_aqua_raw', 'modis_terra_raw',
      'viirs_snpp_raw', 'viirs_noaa20_raw', 'harmonized_from', 'provisional', 'partial', 'observability'],
    body,
  );
}

/** "The same months in every year" for a range. `held`: the rank and the ratio are left out (see HELD). */
export function sameMonthsCsv(same: SameMonths, r: MonthRange, meta: CsvMeta, held = false): string {
  const verdict = held
    ? 'Picked period: rank and ratio to the median are not given for January to October 2019 here (a registered test covers those months)'
    : same.picked && same.rank != null
      ? `Picked period ${r.from} to ${r.to}: rank ${same.rank} of ${same.of} complete periods (1 = most fire)${same.median != null ? `; median ${num(same.median)}` : ''}${same.ratio != null ? `; ratio to the median ${num(same.ratio)}` : ''}`
      : 'Picked period: not ranked (a month is missing or was still running)';
  return toCsv(
    [...headLines(meta, 'File: the same months in every year (totals of the picked calendar months, one row a year)', r,
      `${METHOD_LINE}; totals are sums of the monthly values, lo90 and hi90 sums of the monthly bounds (an approximation)`),
      verdict, 'complete = 0: a month is missing or was still running; such a period is left out of the rank and the median'],
    ['period_start', 'period_end', 'harmonized', 'harmonized_lo90', 'harmonized_hi90', 'raw_stitched', 'complete', 'provisional', 'partial', 'picked'],
    same.periods.map((p) => [p.start, p.end, num(p.H), num(p.lo), num(p.hi), num(p.raw), p.complete ? 1 : 0, p.provisional ? 1 : 0, p.partial ? 1 : 0, p.picked ? 1 : 0]),
  );
}

/** The built point files with a month inside a range. */
export const windowsInRange = (ws: SeasonWindow[], r: MonthRange) => ws.filter((w) => r.from <= w.to && r.to >= w.from);
/** The built season years (1 August to 31 October each) with a day inside a range. */
export const seasonsInRange = (years: readonly number[], r: MonthRange) => years.filter((y) => r.from <= `${y}-10` && r.to >= `${y}-08`);
/** The days of a season file inside a range. */
export const seasonDaysInRange = (f: SeasonPoints, r: MonthRange) => f.days.filter((d) => inRange(d.date.slice(0, 7), r));

/** The VIIRS detections of the built seasons inside a range, one row a detection, as NASA FIRMS published them. */
export function hotspotCsv(files: SeasonPoints[], r: MonthRange, generated: string): string {
  const src = files[0]?.source;
  const body: (string | number)[][] = [];
  for (const f of files) for (const d of seasonDaysInRange(f, r)) for (const p of d.pts) body.push([d.date, p[0], p[1], p[2], p[3] ? 'N' : 'D']);
  return toCsv(
    [
      PROJECT_LINE,
      'File: hotspot detections of the picked range (one row = one detection)',
      `Area: ${files[0]?.bbox_note ?? 'Bounding box around Central Kalimantan, not the province polygon.'}${files[0]?.bbox ? ` Box (west, south, east, north): ${files[0].bbox.join(', ')}` : ''}`,
      `Range: ${r.from} to ${r.to}; only the days of the built point files (1 August to 31 October of a season year, and January to March 2023) are in this file`,
      `Unit: one row is one ${src?.product ?? 'VIIRS S-NPP 375 m'} detection; frp_mw is fire radiative power in megawatts`,
      `Data version: ${files.map((f) => `${f.days[0]?.date.slice(0, 4)}: sha256 ${f.source?.sha256 ?? 'not stated'}${f.source?.downloaded_utc ? `, downloaded ${f.source.downloaded_utc}` : ''}`).join('; ')}`,
      `Method: not harmonized; detections as published, filtered: ${src?.filter_text ?? 'see the season file'}`,
      `Source: ${files.map((f) => f.source?.url).filter(Boolean).join(' ; ') || 'NASA FIRMS'}`,
      `Day: ${src?.day_is ?? 'FIRMS acq_date in UTC'}`,
      `Generated: ${generated}`,
      'A hotspot is a detection of heat, not burned area. Fire cell-days are not burned area.',
    ],
    ['acq_date', 'longitude', 'latitude', 'frp_mw', 'daynight'],
    body,
  );
}
