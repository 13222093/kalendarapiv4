// Project 4 (new file, not from Fire Harmony): the Indonesia record, read from the Second Sight bundle in
// public/ss-data/ (written by Second Sight's `python -m pipeline.export.bundle` plus the project 4 observability fields;
// schema in vendor/second-sight/pipeline/export/README.md and INTEGRATION.md "Data contract").
// Every number the record pages show is computed here from those files. Nothing is filled in: a value the bundle does
// not have stays null, and a file that is not there yet is "missing" (the pages say "not built yet"), never a demo file.

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

/** Does a ka-data file of a season year exist? (the record page only links to seasons that are built) */
export function seasonBuilt(year: number): Promise<boolean> {
  return once(`season:${year}`, () => getJson<unknown>(`${BASE}ka-data/kalteng_${year}_season.json`).then(() => true))
    .catch(() => false);
}

// ------------------------------------------------------------------------------------------------ names and words

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
export const ym = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;
export const monthName = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1] ?? ''} ${key.slice(0, 4)}`;
export const aoiName = (a: AoiEntry) => a.name_en ?? a.name ?? a.aoi_id;

export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');
export const fmt1 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** 52,341 -> "52k", 1,234,567 -> "1.2M": for small calendar cells only (the full number is in the cell's label). */
export function fmtCompact(n: number): string {
  const a = Math.abs(n);
  if (a < 10_000) return fmtInt(n);
  if (a < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${fmt1(n / 1_000_000)}M`;
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
export function aoiGroups(aois: AoiEntry[]): { label: string; items: AoiEntry[] }[] {
  const ck = aois.filter((a) => a.aoi_id === KALTENG);
  const rest = aois.filter((a) => a.aoi_id !== KALTENG);
  const groups = [
    { label: 'Blind zeros built here', items: ck },
    { label: 'Country', items: rest.filter((a) => a.level === 'national') },
    { label: 'Island regions', items: rest.filter((a) => a.level === 'island_region') },
    { label: 'Featured provinces', items: rest.filter((a) => a.level === 'province' && a.featured) },
    { label: 'Other provinces', items: rest.filter((a) => a.level === 'province' && !a.featured) },
    { label: 'Other areas', items: rest.filter((a) => a.level !== 'national' && a.level !== 'island_region' && a.level !== 'province') },
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

export interface YearPoint {
  year: number;
  naive: number; summed: number; H: number; lo: number; hi: number;   // indexed: own 2003-2011 mean = 100
  rawNaive: number; rawSummed: number; rawH: number; rawLo: number; rawHi: number;   // fire cell-days
  provisional: boolean;
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
    const y = years.get(r.year) ?? { year: r.year, rawNaive: 0, rawSummed: 0, rawH: 0, rawLo: 0, rawHi: 0, provisional: false, months: 0 };
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

export type TestStatus = 'pass' | 'fail' | 'not_run' | 'info';
export function testStatus(r: TestRow): TestStatus {
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
export function dateOnly(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null
    : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}
