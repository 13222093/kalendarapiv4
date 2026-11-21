// KalenderApi (new file): the days of the fire record, for the "Every day" calendar of the Harmonize page.
// Read from public/ka-data/daily/ (written by pipeline/daily/build_everyday_days.py, whose header documents the
// format): index.json once, and <aoi_id>.json for the area on the page. The days of a month add up to that month of
// the monthly record (pipeline/daily/check_everyday_days.py). Nothing is filled in here: a day with no value stays
// "no value" and is never drawn as a zero.

import { fmtNumber, locale, type Lang } from './lang';
import { KALTENG, NOT_AREA, PROJECT_LINE, SENSOR_NAME, emberStep, fmtInt, getJson, type AoiEntry, type Series } from './record';

const BASE = import.meta.env.BASE_URL;
export const DAILY_URL = `${BASE}ka-data/daily/`;
export const DAILY_FORMAT = 'kalenderapi-daily/1';

// ------------------------------------------------------------------------------------------------ types

export type Sat = 'Aqua' | 'Terra' | 'SNPP' | 'NOAA20';
export const SATS: readonly Sat[] = ['Aqua', 'Terra', 'SNPP', 'NOAA20'];
type Col = 'a' | 't' | 'v' | 'n';
const COLUMN: Record<Sat, Col> = { Aqua: 'a', Terra: 't', SNPP: 'v', NOAA20: 'n' };
const CODE_SAT: Record<string, Sat> = { A: 'Aqua', T: 'Terra', S: 'SNPP', N: 'NOAA20' };

/** One sensor in index.json: its first and last local date in the files, and the dates in between on which it
 *  recorded nothing anywhere in Indonesia (as [first, last] runs). */
export interface DailySat { first_day: string; last_day: string; silent_days: [string, string][] }
export interface DailyIndex {
  format: string;
  generated_at?: string; data_version?: string | null; unit?: string; notes?: string[];
  record: { first_month: string; last_month: string; first_day: string; last_day: string };
  satellites: Record<Sat, DailySat>;
  provisional_months: string[];
  partial_months: string[];
  withheld?: { from: string; to: string; areas: string[]; why?: string };
  areas?: Record<string, [number, number]>;
}
/** One year of an area: d = day of the year of each listed date, h = the value on one scale (null = no value),
 *  a, t, v, n = cell-days as recorded by Aqua, Terra, S-NPP, NOAA-20 (a column left out is 0 on every listed day). */
export interface DailyYear { d: number[]; h: (number | null)[]; a?: number[]; t?: number[]; v?: number[]; n?: number[] }
export interface DailyFile {
  format: string; aoi_id: string; name?: string; level?: string; province_aoi?: string; approximate?: boolean;
  first_month: string;
  /** one character per month from first_month: A T S N (the sensor of the month's value), 0, - (no value), x (withheld) */
  months: string;
  withheld?: [string, string][];
  years: Record<string, DailyYear>;
}

// ------------------------------------------------------------------------------------------------ dates
// Plain calendar dates ("YYYY-MM-DD", the local date of the record); all arithmetic in UTC so no time zone moves a day.

const pad = (n: number) => String(n).padStart(2, '0');
export const isoDate = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
export const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export const daysInYear = (y: number) => (isLeap(y) ? 366 : 365);
export const daysInMonth = (y: number, m: number) => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] ?? 0;
const utc = (date: string) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
const fromUtc = (ms: number) => { const d = new Date(ms); return isoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); };
const DAY_MS = 86_400_000;

/** Is this a real calendar date written "YYYY-MM-DD"? */
export function isDate(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && fromUtc(utc(s)) === s;
}
export const addDays = (date: string, n: number) => fromUtc(utc(date) + n * DAY_MS);
/** Day of the year (1 = 1 January) to a date, and back. */
export const dateOfDoy = (year: number, doy: number) => fromUtc(Date.UTC(year, 0, 1) + (doy - 1) * DAY_MS);
export const doyOf = (date: string) => Math.round((utc(date) - Date.UTC(Number(date.slice(0, 4)), 0, 1)) / DAY_MS) + 1;
/** Monday = 0 ... Sunday = 6. */
export const weekdayMon0 = (date: string) => (new Date(utc(date)).getUTCDay() + 6) % 7;
const ymOf = (date: string) => date.slice(0, 7);
const ymNumber = (key: string) => Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7)) - 1;

/** One month laid out in weeks that start on Monday: null where the week has no day of this month. */
export interface MonthGrid { year: number; month: number; key: string; weeks: (string | null)[][] }
export function monthGrid(year: number, month: number): MonthGrid {
  const n = daysInMonth(year, month);
  const cells: (string | null)[] = Array.from({ length: weekdayMon0(isoDate(year, month, 1)) }, () => null);
  for (let d = 1; d <= n; d++) cells.push(isoDate(year, month, d));
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { year, month, key: `${year}-${pad(month)}`, weeks };
}
export const yearGrid = (year: number): MonthGrid[] => Array.from({ length: 12 }, (_, i) => monthGrid(year, i + 1));

/** Where a key moves the focus from a day, inside the year shown: arrows a day or a week, Home and End the ends of
 *  the month, PageUp and PageDown a month. Null when the key is not one of these or the move would leave the year. */
export function moveDay(date: string, key: string): string | null {
  const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7)), d = Number(date.slice(8, 10));
  let next: string;
  switch (key) {
    case 'ArrowLeft': next = addDays(date, -1); break;
    case 'ArrowRight': next = addDays(date, 1); break;
    case 'ArrowUp': next = addDays(date, -7); break;
    case 'ArrowDown': next = addDays(date, 7); break;
    case 'Home': next = isoDate(y, m, 1); break;
    case 'End': next = isoDate(y, m, daysInMonth(y, m)); break;
    case 'PageUp': if (m === 1) return null; next = isoDate(y, m - 1, Math.min(d, daysInMonth(y, m - 1))); break;
    case 'PageDown': if (m === 12) return null; next = isoDate(y, m + 1, Math.min(d, daysInMonth(y, m + 1))); break;
    default: return null;
  }
  return next.slice(0, 4) === date.slice(0, 4) ? next : null;
}

/** "Tuesday, 15 September 2015" / "Selasa, 15 September 2015". */
export function longDate(date: string, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(utc(date)));
}
/** The seven weekday initials, Monday first, with their full names. */
export function weekdays(lang: Lang): { short: string; long: string }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(2001, 0, 1 + i));   // 1 January 2001 was a Monday
    const long = new Intl.DateTimeFormat(locale(lang), { weekday: 'long', timeZone: 'UTC' }).format(d);
    return { short: long.slice(0, 1).toUpperCase(), long };
  });
}

// ------------------------------------------------------------------------------------------------ an area's days

interface DayRow { h: number | null; a: number; t: number; v: number; n: number }

/** An area's daily file, checked and indexed by date. */
export interface AreaDays {
  file: DailyFile; index: DailyIndex;
  byDate: Map<string, DayRow>;
  silent: Record<Sat, Set<string>>;
  provisional: Set<string>; partial: Set<string>;
  firstYear: number; lastYear: number;
  /** the largest day of either series over the whole record of the area: one colour scale for every year */
  max: number;
}

const fail = (what: string): never => { throw new Error(what); };

/** Checks the two files and indexes the days. Throws (in plain words) when a file is not what the page expects. */
export function prepareDays(file: DailyFile, index: DailyIndex): AreaDays {
  if (index?.format !== DAILY_FORMAT) fail('the index of the daily files is in a format this page does not read');
  if (file?.format !== DAILY_FORMAT) fail('the daily file is in a format this page does not read');
  if (typeof file.months !== 'string' || !/^\d{4}-\d{2}$/.test(file.first_month ?? '')) fail('the daily file does not list its months');
  if (file.first_month !== index.record?.first_month) fail('the daily file and its index start in different months');
  if (!file.years || typeof file.years !== 'object') fail('the daily file has no years');
  for (const s of SATS) if (!isDate(index.satellites?.[s]?.first_day) || !isDate(index.satellites?.[s]?.last_day)) fail(`the index does not give the days of ${s}`);

  const byDate = new Map<string, DayRow>();
  for (const [y, block] of Object.entries(file.years)) {
    const year = Number(y);
    const n = block?.d?.length;
    if (!Number.isInteger(year) || !Array.isArray(block?.d) || !Array.isArray(block.h) || block.h.length !== n) fail(`the daily file's year ${y} is incomplete`);
    for (const c of ['a', 't', 'v', 'n'] as const) if (block[c] && block[c]!.length !== n) fail(`the daily file's year ${y} has columns of different length`);
    for (let i = 0; i < n; i++) {
      const doy = block.d[i]!;
      if (!Number.isInteger(doy) || doy < 1 || doy > daysInYear(year)) fail(`the daily file's year ${y} has a day that is not in that year`);
      byDate.set(dateOfDoy(year, doy), { h: block.h[i] ?? null, a: block.a?.[i] ?? 0, t: block.t?.[i] ?? 0, v: block.v?.[i] ?? 0, n: block.n?.[i] ?? 0 });
    }
  }
  const silent = {} as Record<Sat, Set<string>>;
  for (const s of SATS) {
    const set = new Set<string>();
    for (const [lo, hi] of index.satellites[s].silent_days ?? []) for (let d = lo; d <= hi; d = addDays(d, 1)) set.add(d);
    silent[s] = set;
  }
  const area: AreaDays = {
    file, index, byDate, silent,
    provisional: new Set(index.provisional_months ?? []), partial: new Set(index.partial_months ?? []),
    firstYear: Number(index.record.first_month.slice(0, 4)), lastYear: Number(index.record.last_month.slice(0, 4)),
    max: 0,
  };
  for (const date of byDate.keys()) {
    const i = dayInfo(area, date);
    area.max = Math.max(area.max, i.harm.value ?? 0, i.raw.value ?? 0);
  }
  return area;
}

/** Why a day has a value or has none. */
export type DayStatus =
  | 'value'      // the sensor was delivering data: the count, or a zero (nothing detected)
  | 'outside'    // before the sensor's first day in the files, after its last, or outside the record
  | 'silent'     // the sensor recorded nothing anywhere in Indonesia that day: off, or a nationwide zero
  | 'no-month'   // the monthly record has no value for the month
  | 'withheld';  // a registered test covers the day: not computed
export interface SeriesDay { status: DayStatus; value: number | null; sensor: Sat | null }
export interface DayInfo {
  date: string;
  /** on one scale; `converted`: from VIIRS or Terra with the month's one factor (approximate) */
  harm: SeriesDay & { converted: boolean };
  /** as recorded: MODIS to 2011, VIIRS from 2012 (the monthly calendar's Raw series) */
  raw: SeriesDay;
  /** as recorded by each sensor; null = that sensor has no data for the day */
  counts: Record<Sat, number | null>;
  /** the sensors whose first day in the files is on or before this date (the ones worth naming for the day) */
  flying: Sat[];
  provisional: boolean; partial: boolean;
}

/** The month's character in the area's `months`, or null outside the record. */
export function monthCode(area: AreaDays, ym: string): string | null {
  const i = ymNumber(ym) - ymNumber(area.file.first_month);
  return i >= 0 && i < area.file.months.length ? area.file.months[i]! : null;
}
const monthActive = (area: AreaDays, s: Sat, ym: string) =>
  ym >= ymOf(area.index.satellites[s].first_day) && ym <= ymOf(area.index.satellites[s].last_day);
/** The sensor of the "as recorded" series in a month, as the monthly record stitches it: MODIS to 2011 (Aqua, or
 *  Terra before Aqua), VIIRS from 2012 (S-NPP, or NOAA-20 where S-NPP has no data). */
export function rawSensor(area: AreaDays, ym: string): Sat | null {
  const pick: Sat[] = Number(ym.slice(0, 4)) <= 2011 ? ['Aqua', 'Terra'] : ['SNPP', 'NOAA20'];
  return pick.find((s) => monthActive(area, s, ym)) ?? null;
}
function sensorDay(area: AreaDays, s: Sat, date: string): SeriesDay {
  const sat = area.index.satellites[s];
  if (date < sat.first_day || date > sat.last_day) return { status: 'outside', value: null, sensor: s };
  if (area.silent[s].has(date)) return { status: 'silent', value: null, sensor: s };
  return { status: 'value', value: area.byDate.get(date)?.[COLUMN[s]] ?? 0, sensor: s };
}

/** Everything the page says about one day of an area. */
export function dayInfo(area: AreaDays, date: string): DayInfo {
  const ym = ymOf(date);
  const code = monthCode(area, ym);
  const row = area.byDate.get(date);
  const none = (status: DayStatus): SeriesDay => ({ status, value: null, sensor: null });
  const flags = { provisional: area.provisional.has(ym), partial: area.partial.has(ym) };
  if (code === null || code === 'x') {
    const s = none(code === 'x' ? 'withheld' : 'outside');
    return { date, harm: { ...s, converted: false }, raw: s, counts: { Aqua: null, Terra: null, SNPP: null, NOAA20: null }, flying: [], provisional: false, partial: false };
  }
  const counts = {} as Record<Sat, number | null>;
  for (const s of SATS) counts[s] = sensorDay(area, s, date).value;
  const flying = SATS.filter((s) => date >= area.index.satellites[s].first_day);

  let harm: SeriesDay;
  const sat = CODE_SAT[code];
  if (code === '-') harm = none('no-month');
  else if (code === '0') harm = { status: 'value', value: 0, sensor: null };
  else if (!sat) harm = none('no-month');
  else {
    const d = sensorDay(area, sat, date);
    // the file's own value for a listed day (the count times the month's factor); an unlisted day is a zero
    harm = d.status !== 'value' ? d : row ? (row.h == null ? { status: 'silent', value: null, sensor: sat } : { ...d, value: row.h }) : { ...d, value: 0 };
  }
  const rs = rawSensor(area, ym);
  const raw = rs ? sensorDay(area, rs, date) : none('outside');
  return { date, harm: { ...harm, converted: !!sat && sat !== 'Aqua' }, raw, counts, flying, ...flags };
}

export const seriesDay = (i: DayInfo, s: Series): SeriesDay => (s === 'harm' ? i.harm : i.raw);
/** The colour step of a day (0 = a zero, 1 to 9 on the monthly calendar's log scale), or null when it has no value. */
export function dayStep(i: DayInfo, s: Series, max: number): number | null {
  const v = seriesDay(i, s).value;
  return v == null ? null : emberStep(v, max);
}

/** The days of a month summed for a series: the fallback for the month's total when the monthly record is not in. */
export function monthSum(area: AreaDays, year: number, month: number, s: Series): { sum: number; any: boolean; withheld: boolean } {
  let sum = 0, any = false, withheld = false;
  for (let d = 1; d <= daysInMonth(year, month); d++) {
    const x = seriesDay(dayInfo(area, isoDate(year, month, d)), s);
    if (x.status === 'withheld') withheld = true;
    if (x.value != null) { sum += x.value; any = true; }
  }
  return { sum, any, withheld };
}

/** The latest date of a year that has a value in a series (where the keyboard focus starts), or null. */
export function lastValueDay(area: AreaDays, year: number, s: Series): string | null {
  for (let doy = daysInYear(year); doy >= 1; doy--) {
    const date = dateOfDoy(year, doy);
    if (seriesDay(dayInfo(area, date), s).value != null) return date;
  }
  return null;
}

// ------------------------------------------------------------------------------------------------ words

/** A day's value: whole numbers as they are; converted values with one decimal below 100 (two below 1, so 0.04 is
 *  not "0.0") and none from 100. */
export function fmtDay(v: number, lang: Lang = 'en'): string {
  if (Number.isInteger(v) || v >= 100) return fmtInt(v, lang);
  return fmtNumber(v, lang, v < 1 ? 2 : 1);
}
const t = (lang: Lang, en: string, id: string) => (lang === 'id' ? id : en);

/** Why a day has no value, in plain words. */
export function noValueWords(d: SeriesDay, lang: Lang): string {
  const name = d.sensor ? SENSOR_NAME[d.sensor] ?? d.sensor : '';
  switch (d.status) {
    case 'withheld': return t(lang, 'withheld for a registered test: not computed, not a zero', 'ditahan untuk sebuah uji terdaftar: tidak dihitung, bukan nol');
    case 'silent': return t(lang, `no value: ${name} recorded nothing anywhere in Indonesia this day (it was off, or it is a nationwide zero; the record cannot tell)`,
      `tanpa nilai: ${name} tidak mencatat apa pun di seluruh Indonesia pada hari ini (sedang mati, atau memang nol se-Indonesia; rekaman tidak dapat membedakannya)`);
    case 'no-month': return t(lang, 'no value: the monthly record has none for this month', 'tanpa nilai: rekaman bulanan tidak memiliki nilai untuk bulan ini');
    case 'outside': return name
      ? t(lang, `no value: outside the days ${name} has data for`, `tanpa nilai: di luar hari-hari yang memiliki data ${name}`)
      : t(lang, 'no value: outside the record', 'tanpa nilai: di luar rekaman');
    default: return '';
  }
}
/** Where a one-scale value comes from. */
export function scaleWords(i: DayInfo, lang: Lang): string {
  const s = i.harm.sensor;
  if (i.harm.status !== 'value' || !s) return '';
  if (s === 'Aqua') return t(lang, 'Aqua MODIS\'s own count', 'hitungan Aqua MODIS sendiri');
  const fam = s === 'Terra' ? 'Terra' : 'VIIRS';
  return t(lang, `approximate: converted from ${fam} with the month's factor`, `perkiraan: dikonversi dari ${fam} dengan faktor bulan itu`);
}
/** The raw counts of a day, one entry per sensor that had started by then ("MODIS Aqua 12"; "no data" where the
 *  sensor has none for the day). Empty for a withheld day and outside the record. */
export function countsList(i: DayInfo, lang: Lang): { sat: Sat; name: string; text: string }[] {
  return i.flying.map((s) => ({
    sat: s, name: SENSOR_NAME[s] ?? s,
    text: i.counts[s] == null ? t(lang, 'no data', 'tanpa data') : fmtInt(i.counts[s]!, lang),
  }));
}
/** The provisional mark of a day with a value, in words; '' when it has none. */
export function provisionalWords(i: DayInfo, lang: Lang): string {
  if (i.partial) return t(lang, 'provisional: near-real-time data, and the month is still filling in', 'sementara: data hampir waktu nyata, dan bulan ini masih terisi');
  if (i.provisional) return t(lang, 'provisional: near-real-time data, may change', 'sementara: data hampir waktu nyata, dapat berubah');
  return '';
}

/** One sentence for a screen reader: the date, the value of the series shown, the raw counts, the flags. */
export function dayLabel(i: DayInfo, s: Series, lang: Lang): string {
  const parts = [longDate(i.date, lang)];
  const d = seriesDay(i, s);
  if (d.value == null) parts.push(noValueWords(d, lang));
  else if (s === 'harm') {
    parts.push(t(lang, `${fmtDay(d.value)} fire cell-days on the Aqua MODIS scale`, `${fmtDay(d.value, lang)} sel-hari api pada skala Aqua MODIS`));
    const w = scaleWords(i, lang);
    if (w) parts.push(w);
  } else {
    const name = d.sensor ? SENSOR_NAME[d.sensor] ?? d.sensor : '';
    parts.push(t(lang, `${fmtDay(d.value)} fire cell-days as recorded by ${name}`, `${fmtDay(d.value, lang)} sel-hari api sebagaimana tercatat oleh ${name}`));
  }
  const counts = countsList(i, lang).map((c) => `${c.name} ${c.text}`).join(', ');
  if (counts) parts.push(t(lang, `as recorded: ${counts}`, `sebagaimana tercatat: ${counts}`));
  if (d.value != null) { const p = provisionalWords(i, lang); if (p) parts.push(p); }
  return parts.join(', ');
}

// ------------------------------------------------------------------------------------------------ season player

/** The day in Play the season ('#/season?y=2015&d=2015-09-15'; 2019 keeps its old form, as pages/Season.tsx writes
 *  it): for Central Kalimantan and its districts, on the days of a season the player holds (1 August to 31 October). */
export function seasonDayHref(date: string, aoi: { aoi_id: string; province_aoi?: string }, seasons: readonly number[] | null | undefined): string | null {
  if (aoi.aoi_id !== KALTENG && aoi.province_aoi !== KALTENG) return null;
  const y = Number(date.slice(0, 4)), md = date.slice(5);
  if (!seasons?.includes(y) || md < '08-01' || md > '10-31') return null;
  return `#/season?${y === 2019 ? '' : `y=${y}&`}d=${date}`;
}

// ------------------------------------------------------------------------------------------------ CSV

export interface DaysCsvMeta { area: string; aoiId: string; unit?: string | null; dataVersion?: string | null; generated: string; notes?: string[] }
const STATUS: Record<DayStatus, string> = { value: 'value', outside: 'outside_record', silent: 'sensor_silent', 'no-month': 'no_monthly_value', withheld: 'withheld' };
export const DAYS_CSV_COLUMNS = ['date', 'one_scale', 'one_scale_from', 'approximate', 'as_recorded', 'as_recorded_from', 'modis_aqua_raw', 'modis_terra_raw',
  'viirs_snpp_raw', 'viirs_noaa20_raw', 'provisional', 'partial_month', 'status'] as const;

/** Every date of one year of an area, one row a date, with the columns of the daily data. An empty cell is "no
 *  value", never a zero; `status` says why. The file starts with "#" lines, like the page's other CSV files. */
export function daysCsv(area: AreaDays, year: number, meta: DaysCsvMeta): string {
  const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();
  const num = (v: number | null) => (v == null ? '' : String(Math.round(v * 1000) / 1000));
  const head = [
    PROJECT_LINE,
    'File: the days of one year (one row = one local date)',
    `Area: ${meta.area} (${meta.aoiId})`,
    `Year: ${year}`,
    `Unit: ${meta.unit || area.index.unit || 'fire cell-days a day (0.01 degree cell x local date x satellite x day or night pass)'}`,
    `Data version: ${meta.dataVersion || 'not stated in the bundle'}`,
    'Method: one_scale = the day\'s cell-days of the sensor in one_scale_from x one factor for the whole month (the month\'s value / the month\'s cell-days of that sensor), on the Aqua MODIS scale; the factor is 1 for MODIS Aqua (its own count). approximate = 1: converted from VIIRS or Terra with the month\'s factor. as_recorded = MODIS to 2011, VIIRS from 2012. The days of a month add up to the month of the monthly record.',
    'An empty value is not a zero. status: value; outside_record = outside the days the sensor has data for; sensor_silent = the sensor recorded nothing anywhere in Indonesia that day (off, or a nationwide zero); no_monthly_value = the monthly record has no value for the month; withheld = a registered test covers the day, not computed.',
    'A zero means nothing was detected, not that nothing burned: cloud and smoke hide fires. provisional = 1: near-real-time data; partial_month = 1: the month was still running when the files were read.',
    'Source: NASA FIRMS archives (MODIS C6.1 Terra and Aqua, VIIRS 375 m S-NPP and NOAA-20)',
    `Generated: ${meta.generated}`,
    ...(meta.notes ?? []),
    NOT_AREA,
  ];
  const body: string[] = [];
  for (let doy = 1; doy <= daysInYear(year); doy++) {
    const i = dayInfo(area, dateOfDoy(year, doy));
    body.push([
      i.date, num(i.harm.value), i.harm.sensor ? SENSOR_NAME[i.harm.sensor] ?? i.harm.sensor : '', i.harm.value != null && i.harm.converted ? 1 : 0,
      num(i.raw.value), i.raw.sensor ? SENSOR_NAME[i.raw.sensor] ?? i.raw.sensor : '',
      num(i.counts.Aqua), num(i.counts.Terra), num(i.counts.SNPP), num(i.counts.NOAA20),
      i.provisional ? 1 : 0, i.partial ? 1 : 0, STATUS[i.harm.status],
    ].join(','));
  }
  return [...head.map((c) => `# ${oneLine(c)}`), DAYS_CSV_COLUMNS.join(','), ...body].join('\r\n') + '\r\n';
}

// ------------------------------------------------------------------------------------------------ the area picker

const foldName = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** The record's own areas (Indonesia, the island regions, the provinces) whose English or Indonesian name holds every
 *  word typed, names that start with the first word first, otherwise in the order given. For the area picker inside
 *  "Every day": a reader may type "South Sumatra" or "Sumatera Selatan". Districts are matched by lib/record.ts
 *  searchDistricts. */
export function findAreas(areas: AoiEntry[], query: string, limit = 8): AoiEntry[] {
  const words = foldName(query).split(' ').filter(Boolean);
  if (!words.length) return [];
  const first: AoiEntry[] = [], rest: AoiEntry[] = [];
  for (const a of areas) {
    const names = [a.name_en, a.name_id, a.name].filter((n): n is string => !!n).map(foldName);
    if (!names.some((n) => words.every((w) => n.includes(w)))) continue;
    (names.some((n) => n.startsWith(words[0]!)) ? first : rest).push(a);
  }
  return [...first, ...rest].slice(0, limit);
}

// ------------------------------------------------------------------------------------------------ loading

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
/** index.json of the daily files: written last by the export, so its presence means the set is complete. */
export const loadDailyIndex = (): Promise<DailyIndex> => once('index', () => getJson<DailyIndex>(`${DAILY_URL}index.json`));
/** The days of one area, checked and indexed. A missing file is the page's "not built yet" (lib/record.ts settle). */
export function loadAreaDays(aoiId: string): Promise<AreaDays> {
  return once(`a:${aoiId}`, async () => {
    const [index, file] = await Promise.all([loadDailyIndex(), getJson<DailyFile>(`${DAILY_URL}${encodeURIComponent(aoiId)}.json`)]);
    if (file.aoi_id !== aoiId) throw new Error(`${aoiId}.json holds another area`);
    return prepareDays(file, index);
  });
}
