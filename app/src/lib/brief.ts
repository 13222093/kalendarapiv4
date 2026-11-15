// KalenderApi (new file, not from Fire Harmony): the numbers of the printable brief (#/brief?aoi=<aoi_id>,
// pages/Brief.tsx), written for a district fire officer, and their words in English and Bahasa Indonesia.
// Every number comes from the record's own logic in lib/record.ts (the baseline medians as the bundle stores them,
// beforeAfter's yearly totals, monthVerdict's ratio and rank) or from the ka-data files the app already reads
// (visibility_kalteng_<Y>.json with BlindDistrictsCard's formula, reported_kalteng.json, blind_rule_kalteng.json).
// Nothing is filled in: a function returns null (or an empty list) when its data is not there, and the page then
// leaves that section out.
import {
  KALTENG, beforeAfter, isViirs, monthVerdict, ym,
  type AoiEntry, type DistrictIndex, type MonthRow, type MonthVerdict, type RecordIndex,
} from './record';
import { fmtNumber, monthName, pick, type Lang } from './lang';

// ------------------------------------------------------------------------------------------------ words and numbers

/** A whole number with the language's separators: 52,341 in English, 52.341 in Indonesian. */
export const num = (n: number, lang: Lang) => fmtNumber(n, lang, 0);
/** One decimal: 7.7 / 7,7. */
export const num1 = (n: number, lang: Lang) => fmtNumber(n, lang, 1);
/** "How many times the median": no decimal from 10, one from 1, two below 1 (where one decimal says too little). */
export const times = (ratio: number, lang: Lang) => fmtNumber(ratio, lang, ratio >= 10 ? 0 : ratio >= 1 ? 1 : 2);
/** For the small bar labels only (the full number is in the text): 10446 -> "10k" / "10 rb", 1234567 -> "1.2M" / "1,2 jt". */
export function compact(n: number, lang: Lang): string {
  const a = Math.abs(n);
  if (a < 1000) return num(n, lang);
  if (a < 10_000) return `${num1(n / 1000, lang)}${pick(lang, 'k', ' rb')}`;
  if (a < 1_000_000) return `${num(n / 1000, lang)}${pick(lang, 'k', ' rb')}`;
  return `${num1(n / 1_000_000, lang)}${pick(lang, 'M', ' jt')}`;
}
/** "2026-10" -> "October 2026" / "Oktober 2026". */
export const monthYear = (key: string, lang: Lang) => `${monthName(Number(key.slice(5, 7)), lang, 'long')} ${key.slice(0, 4)}`;
/** A date as "15 November 2026": an ISO text is read in UTC, a Date in local time. Null when it is not a date. */
export function dateWords(d: Date | string | null | undefined, lang: Lang): string | null {
  if (d == null) return null;
  const iso = typeof d === 'string';
  const t = iso ? new Date(d.length === 10 ? `${d}T00:00:00Z` : d) : d;
  if (Number.isNaN(t.getTime())) return null;
  const day = iso ? t.getUTCDate() : t.getDate(), mon = iso ? t.getUTCMonth() : t.getMonth(), yr = iso ? t.getUTCFullYear() : t.getFullYear();
  return `${day} ${monthName(mon + 1, lang, 'long')} ${yr}`;
}
/** ["August", "September", "October"] -> "August, September and October" / "Agustus, September dan Oktober". */
export function listWords(items: string[], lang: Lang): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ${pick(lang, 'and', 'dan')} ${items[items.length - 1]}`;
}

/** A name without its "Kabupaten" or "Kota" and without spaces, for matching one file's district to another's. */
export const slug = (s: string) => s.toLowerCase().replace(/^(kabupaten|kab\.?|kota)\s+/, '').replace(/[^a-z0-9]/g, '');

// ------------------------------------------------------------------------------------------------ the area

export interface BriefArea {
  aoi: AoiEntry;
  isDistrict: boolean;
  /** the Indonesian name, and the English one (the same for a district) */
  name: string; nameEn: string;
  /** a district's province: its names and its aoi_id in the main index */
  province: string | null; provinceEn: string | null;
  provinceAoi: string | null;
  /** a district the district run marked as having little data (its own note, when it wrote one) */
  lowData: boolean;
  lowDataNote: string | null;
}

export const areaNameId = (a: AoiEntry) => a.name_id ?? a.name ?? a.name_en ?? a.aoi_id;
export const areaNameEn = (a: AoiEntry) => a.name_en ?? a.name ?? a.name_id ?? a.aoi_id;
export const areaName = (a: AoiEntry, lang: Lang) => (lang === 'id' ? areaNameId(a) : areaNameEn(a));

/** The area of `#/brief?aoi=`: from the main index, else from the district index (when it is built). No aoi in the
 *  address opens Central Kalimantan; an aoi that neither index lists is null (the page says so, it never guesses). */
export function resolveArea(aoiId: string | null, index: RecordIndex, districts: DistrictIndex | null): BriefArea | null {
  const main = aoiId === null
    ? index.aois.find((a) => a.aoi_id === KALTENG) ?? index.aois[0]
    : index.aois.find((a) => a.aoi_id === aoiId);
  if (main) {
    return { aoi: main, isDistrict: false, name: areaNameId(main), nameEn: areaNameEn(main), province: null, provinceEn: null, provinceAoi: null, lowData: false, lowDataNote: null };
  }
  const d = aoiId === null ? undefined : districts?.districts.find((a) => a.aoi_id === aoiId);
  if (!d) return null;
  const note = typeof d.low_data === 'string' && d.low_data.trim() !== '' ? d.low_data.trim() : null;
  const provinceAoi = d.province_aoi ?? null;
  const parent = provinceAoi ? index.aois.find((a) => a.aoi_id === provinceAoi) : undefined;
  return {
    aoi: d, isDistrict: true, name: areaNameId(d), nameEn: areaNameEn(d),
    province: parent ? areaNameId(parent) : d.province ?? null, provinceEn: parent ? areaNameEn(parent) : d.province ?? null, provinceAoi,
    lowData: d.low_data === true || note !== null, lowDataNote: note,
  };
}

/** The areas with cloud-visibility data: Central Kalimantan and its districts. */
export const hasVisibility = (a: BriefArea) => a.aoi.aoi_id === KALTENG || a.provinceAoi === KALTENG;

// A sibling project's registered test locks Central Kalimantan and Pulang Pisau, 1 January to 31 October 2019: the
// brief derives nothing new from those months. For Central Kalimantan it only repeats numbers the app already shows
// (the 2019 yearly total of the "Before and after" table, the 2019 season share of "Blind zeros by district", the
// SiPongi figure). For Pulang Pisau the app shows no yearly total, so 2019 is left out of its ranking of years.
// The district run leaves the locked months empty (H null) in the files of Central Kalimantan's districts and lists
// them in the district's `locked_months`.
export const LOCKED_YEAR = 2019;
export const isPulangPisau = (a: BriefArea) => a.isDistrict && (a.aoi.aoi_id === 'kab-pulang-pisau' || slug(a.name) === 'pulangpisau');
export const isLockedArea = (a: BriefArea) => a.aoi.aoi_id === KALTENG || a.provinceAoi === KALTENG || isPulangPisau(a);
/** The months the district run left empty for this area ("YYYY-MM"), from the district index. */
export function lockedMonths(a: BriefArea): string[] {
  const m = (a.aoi as AoiEntry & { locked_months?: unknown }).locked_months;
  return Array.isArray(m) ? m.filter((x): x is string => typeof x === 'string' && /^\d{4}-\d{2}$/.test(x)).sort() : [];
}
/** A month inside the locked window (1 Jan to 31 Oct 2019). */
export const isLockedMonth = (year: number, month: number) => year === LOCKED_YEAR && month <= 10;

// ------------------------------------------------------------------------------------------------ when it burns

export interface MonthMedian { month: number; median: number }

/** The median of each calendar month over the baseline period, as the bundle stores it on every row
 *  (`baseline_median`, the value the record page's "This month" divides by). Null when a calendar month has none:
 *  the brief does not make its own median. */
export function monthlyMedians(rows: MonthRow[]): MonthMedian[] | null {
  const out: MonthMedian[] = [];
  for (let m = 1; m <= 12; m++) {
    const r = rows.find((x) => x.month === m && x.baseline_median != null);
    if (!r) return null;
    out.push({ month: m, median: r.baseline_median! });
  }
  return out;
}

/** The peak months: the month with the highest median and every month whose median is at least half of it, in
 *  calendar order. None when no month has a median above zero. */
export function peakMonths(medians: MonthMedian[]): number[] {
  const max = Math.max(0, ...medians.map((m) => m.median));
  if (max <= 0) return [];
  return medians.filter((m) => m.median >= max / 2).map((m) => m.month);
}

// ------------------------------------------------------------------------------------------------ the worst years

export interface WorstYear {
  year: number;
  /** fire cell-days of the year on the harmonized scale, and the sums of the monthly 90% bounds */
  H: number; lo: number; hi: number;
  months: number;
  /** some month is near-real-time or still filling in */
  provisional: boolean;
  /** some month was converted from VIIRS (an estimate with a 90% range, not Aqua's own count) */
  estimate: boolean;
  noBand: boolean;
}

export interface WorstYears {
  years: WorstYear[];
  /** years left out of the ranking: a month of theirs has no value (the district files leave the locked months of
   *  2019 empty), or the caller excluded them */
  skipped: number[];
  /** the years ranked over */
  from: number; to: number;
}

/** The n highest years on the harmonized scale, from beforeAfter's yearly totals (2003 on, the totals the record
 *  page's table shows). A year with a month that has no value is not ranked (its total would be too low), and
 *  `exclude` leaves further years out (see the 2019 lock above). */
export function worstYears(rows: MonthRow[], n = 3, exclude: readonly number[] = []): WorstYears | null {
  const ba = beforeAfter(rows);
  if (!ba) return null;
  const out = new Set<number>(exclude);
  for (const r of rows) if (r.H == null) out.add(r.year);
  const years = ba.points
    .filter((p) => p.rawH > 0 && !out.has(p.year))
    .sort((a, b) => b.rawH - a.rawH || a.year - b.year)
    .slice(0, n)
    .map((p) => ({
      year: p.year, H: p.rawH, lo: p.rawLo, hi: p.rawHi, months: p.months, provisional: p.provisional, noBand: p.noBand,
      estimate: rows.some((r) => r.year === p.year && r.H != null && isViirs(r.sensor_used)),
    }));
  if (!years.length) return null;
  return {
    years, from: ba.firstYear, to: ba.lastYear,
    skipped: [...out].filter((y) => y >= ba.firstYear && y <= ba.lastYear).sort((a, b) => a - b),
  };
}

// ------------------------------------------------------------------------------------------------ the latest month

/** The latest complete month: the last month with a harmonized value that is not still filling in. */
export function latestCompleteKey(rows: MonthRow[]): string | null {
  let best: MonthRow | null = null;
  for (const r of rows) {
    if (r.H == null || r.flag_partial) continue;
    if (!best || r.year > best.year || (r.year === best.year && r.month > best.month)) best = r;
  }
  return best ? ym(best.year, best.month) : null;
}
/** The first month of the record. */
export function firstKey(rows: MonthRow[]): string | null {
  let best: MonthRow | null = null;
  for (const r of rows) {
    if (r.H == null) continue;
    if (!best || r.year < best.year || (r.year === best.year && r.month < best.month)) best = r;
  }
  return best ? ym(best.year, best.month) : null;
}

export interface LatestMonth {
  verdict: MonthVerdict;
  /** the median the ratio divides by */
  median: number | null;
  /** converted from VIIRS: an estimate with a 90% range */
  estimate: boolean;
  /** the satellite the month's value comes from (`sensor_used`) */
  sensor: string | null;
  /** the years the rank is taken over */
  firstYear: number; lastYear: number;
}

/** The latest complete month against the median of the same calendar month (ratio and rank: monthVerdict). */
export function latestMonth(rows: MonthRow[], locked = false): LatestMonth | null {
  const key = latestCompleteKey(rows);
  if (!key) return null;
  const y = Number(key.slice(0, 4)), m = Number(key.slice(5, 7));
  if (locked && isLockedMonth(y, m)) return null;
  const verdict = monthVerdict(rows, key);
  const cur = rows.find((r) => r.year === y && r.month === m);
  if (!verdict || !cur) return null;
  const years = rows.filter((r) => r.month === m && r.H != null).map((r) => r.year);
  return {
    verdict,
    median: cur.baseline_median ?? (verdict.ratio != null && verdict.ratio > 0 ? verdict.H / verdict.ratio : null),
    estimate: isViirs(cur.sensor_used), sensor: cur.sensor_used,
    firstYear: Math.min(...years), lastYear: Math.max(...years),
  };
}

// ------------------------------------------------------------------------------------------------ can a zero be trusted

export interface VisDistrict { name: string; T: number; U: number }
/** ka-data/visibility_kalteng_<Y>.json, the parts the brief reads: T = no-fire cell-days with a cloud-free look from
 *  Terra or Aqua, U = no-fire cell-days where neither had one. */
export interface VisFile { districts: VisDistrict[]; days: { date: string }[] }

/** U / (T + U) in %, one decimal, rounded as BlindDistrictsCard rounds it (so a repeated number is the same number). */
export const blindPct = (T: number, U: number): number | null => (T + U > 0 ? Math.round((1000 * U) / (T + U)) / 10 : null);

export interface SeasonBlind { year: number; pct: number; days: number; from: string; to: string }

/** One built season: the share of no-fire cell-days with no cloud-free look, for the whole province (`district` null:
 *  all its districts together, as "Blind zeros by district" totals them) or for one district by name. */
export function seasonBlind(vis: VisFile, district: string | null): SeasonBlind | null {
  if (!Array.isArray(vis.districts) || !Array.isArray(vis.days) || vis.days.length === 0) return null;
  const ds = district === null ? vis.districts : vis.districts.filter((d) => slug(d.name) === slug(district));
  if (!ds.length) return null;
  const pct = blindPct(ds.reduce((s, d) => s + d.T, 0), ds.reduce((s, d) => s + d.U, 0));
  const dates = vis.days.map((d) => d.date).filter((d) => typeof d === 'string').sort();
  const from = dates[0], to = dates[dates.length - 1];
  if (pct === null || !from || !to) return null;
  return { year: Number(from.slice(0, 4)), pct, days: dates.length, from, to };
}

/** ka-data/blind_rule_kalteng.json, as far as the brief uses it: the count of district-days on which more than the
 *  threshold share of a district had no cloud-free look, in total and per district, and the seasons counted. */
export interface BlindRule {
  /** the share above which a district-day counts (0.5 = "most of it") */
  threshold: number | null;
  seasons: number[];
  /** all districts together: district-days above the threshold, and district-days counted */
  total: { above: number; of: number | null } | null;
  districts: { name: string; above: number; of: number | null }[];
  /** per season, when the file splits its counts by season */
  bySeason: { year: number; total: { above: number; of: number | null } | null; districts: { name: string; above: number; of: number | null }[] }[];
}

const asNum = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const asObj = (v: unknown): Record<string, unknown> | null => (v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null);
const firstOf = (o: Record<string, unknown>, keys: string[]): unknown => { for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k]; return undefined; };

const ABOVE_KEYS = ['district_days_above', 'district_days_above_50', 'district_days_over_50', 'days_above', 'days_above_50', 'days_over_50', 'n_above', 'above', 'count'];
const OF_KEYS = ['district_days', 'district_days_total', 'n_district_days', 'days', 'n_days', 'of', 'total_days'];

function count(v: unknown): { above: number; of: number | null } | null {
  const n = asNum(v);
  if (n !== null) return { above: n, of: null };
  const o = asObj(v);
  if (!o) return null;
  const above = asNum(firstOf(o, ABOVE_KEYS));
  return above === null ? null : { above, of: asNum(firstOf(o, OF_KEYS)) };
}

function districtCounts(v: unknown): { name: string; above: number; of: number | null }[] {
  const out: { name: string; above: number; of: number | null }[] = [];
  if (Array.isArray(v)) {
    for (const d of v) {
      const o = asObj(d), c = count(d);
      const name = o ? firstOf(o, ['name', 'district', 'kabupaten']) : undefined;
      if (c && typeof name === 'string') out.push({ name, ...c });
    }
  } else {
    const o = asObj(v);
    if (o) for (const [name, d] of Object.entries(o)) { const c = count(d); if (c) out.push({ name, ...c }); }
  }
  return out;
}

/** Reads blind_rule_kalteng.json without trusting its shape: a count it cannot find is left out, never guessed. */
export function readBlindRule(raw: unknown): BlindRule | null {
  const o = asObj(raw);
  if (!o) return null;
  const seasonsRaw = firstOf(o, ['seasons', 'seasons_included', 'years']);
  const seasonList = Array.isArray(seasonsRaw) ? seasonsRaw : asObj(seasonsRaw) ? Object.entries(asObj(seasonsRaw)!).map(([k, v]) => ({ year: Number(k), ...(asObj(v) ?? {}) })) : [];
  const bySeason: BlindRule['bySeason'] = [];
  const seasons: number[] = [];
  for (const s of seasonList) {
    const so = asObj(s);
    const year = so ? asNum(firstOf(so, ['year', 'season'])) : asNum(s);
    if (year === null) continue;
    seasons.push(year);
    if (!so) continue;
    const total = count(firstOf(so, ['total', 'all', 'province'])) ?? count(so);
    const districts = districtCounts(firstOf(so, ['districts', 'per_district', 'by_district']));
    if (total || districts.length) bySeason.push({ year, total, districts });
  }
  const total = count(firstOf(o, ['total', 'all', 'province'])) ?? count(o);
  const districts = districtCounts(firstOf(o, ['districts', 'per_district', 'by_district']));
  if (!total && !districts.length && !bySeason.length) return null;
  const t = asNum(firstOf(o, ['threshold', 'threshold_share', 'unseen_threshold']));
  return { threshold: t === null ? null : t > 1 ? t / 100 : t, seasons: seasons.sort((a, b) => a - b), total, districts, bySeason };
}

export interface BlindCount { above: number; of: number | null; seasons: number[] }

/** The count the brief shows for an area: the province's total, or one district's (by name). `exclude` drops seasons
 *  (the 2019 lock): it needs the file's per-season counts, and returns null when the file only has a sum that includes
 *  an excluded season. */
export function blindCount(rule: BlindRule, district: string | null, exclude: readonly number[] = []): BlindCount | null {
  const of1 = (name: string | null, total: BlindRule['total'], ds: BlindRule['districts']) =>
    (name === null ? total : ds.find((d) => slug(d.name) === slug(name)) ?? null);
  const dropped = rule.seasons.filter((y) => exclude.includes(y));
  if (!dropped.length) {
    const c = of1(district, rule.total, rule.districts);
    if (c) return { above: c.above, of: c.of, seasons: rule.seasons };
  }
  const kept = rule.bySeason.filter((s) => !exclude.includes(s.year));
  if (!kept.length) return null;
  let above = 0, of: number | null = 0;
  for (const s of kept) {
    const c = of1(district, s.total, s.districts);
    if (!c) return null;
    above += c.above;
    of = of === null || c.of === null ? null : of + c.of;
  }
  return { above, of, seasons: kept.map((s) => s.year) };
}

/** One season's count for the province (`district` null) or one district, when the file has it. */
export function seasonCount(rule: BlindRule, year: number, district: string | null): { above: number; of: number | null } | null {
  const s = rule.bySeason.find((x) => x.year === year);
  if (!s) return null;
  const c = district === null ? s.total : s.districts.find((d) => slug(d.name) === slug(district)) ?? null;
  return c ? { above: c.above, of: c.of } : null;
}

// ------------------------------------------------------------------------------------------------ official figures

export interface ReportedYear { year: number; burned_area_ha: number | null }
/** ka-data/reported_kalteng.json (the SiPongi figures the app already holds for Central Kalimantan). */
export interface ReportedFile {
  accessed?: string;
  sources?: { id: string; url?: string; title?: string }[];
  years: ReportedYear[];
}
export interface ReportedPair { year: number; ha: number; cellDays: number | null; provisional: boolean }

/** Each year with a verified SiPongi figure beside the record's own yearly total (beforeAfter, the record page's
 *  table). Two different measures, side by side: nothing is divided or ranked. */
export function reportedPairs(rep: ReportedFile, rows: MonthRow[]): ReportedPair[] {
  if (!Array.isArray(rep.years)) return [];
  const pts = new Map((beforeAfter(rows)?.points ?? []).map((p) => [p.year, p]));
  return rep.years
    .filter((y) => typeof y.burned_area_ha === 'number')
    .map((y) => {
      const p = pts.get(y.year);
      return { year: y.year, ha: y.burned_area_ha!, cellDays: p ? p.rawH : null, provisional: p?.provisional ?? false };
    })
    .sort((a, b) => a.year - b.year);
}
