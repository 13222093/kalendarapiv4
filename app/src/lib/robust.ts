// Project 4, fourth round (after the science review, docs/research-v3/J2-science-judge.md): how much the headline
// change of "Before and after" depends on the years compared, and what the harmonized line is made of.
// Everything here is computed from the yearly totals of lib/record.ts beforeAfter (sums of the same monthly rows the
// chart draws). The only outside input is the list of El Nino years, read from public/ka-data/enso_oni.json
// (NOAA CPC Oceanic Nino Index, with its address, the day it was read and the rule). Nothing is filled in: a
// comparison with too few years is null and the page says "n/a".
import { SEAM_YEAR, type YearPoint } from './record';
import { WINDOW_ACROSS_SEAM, WINDOW_EARLY, WINDOW_RECENT } from './windows';

/** The headline comparison (lib/windows.ts, shared by every page): the mean of the last five years before the 2022
 *  seam (2017 to 2021) against the mean of 2003 to 2007. lib/record.ts beforeAfter still computes 2019 to 2023 against
 *  2003 to 2007; that comparison crosses the seam and is shown here as a second reading only. */
export const LATE: readonly [number, number] = WINDOW_RECENT;
export const EARLY: readonly [number, number] = WINDOW_EARLY;
export const ACROSS: readonly [number, number] = WINDOW_ACROSS_SEAM;
/** The first year whose harmonized values are VIIRS converted to the Aqua MODIS scale. In the bundle every monthly row
 *  has sensor_used "Aqua" from July 2002 to December 2021 and "SNPP" from January 2022 (finding.json meta.H_definition:
 *  "Aqua native to 2021-12, S-NPP*kappa after"). `lineMakeup` checks the first half of that against the yearly totals. */
export const CONVERTED_FROM = 2022;
/** A window that is left with fewer years than this gives no number. */
export const MIN_YEARS = 2;

export interface YearTotal {
  year: number;
  raw: number;     // stitched as recorded: MODIS to 2011, VIIRS from 2012
  harm: number;    // the harmonized line
  modis: number;   // MODIS alone, every year (Aqua; Terra only in a month Aqua has no data)
  provisional: boolean;
}

/** Yearly totals for the comparisons, from the chart's points. MODIS alone is not a field of a point, but it follows
 *  exactly from two that are: to 2011 the stitched record is MODIS; from 2012 "added together" is MODIS + VIIRS and the
 *  stitched record is VIIRS, so MODIS is their difference. */
export function yearTotals(points: YearPoint[]): YearTotal[] {
  return points.map((p) => ({
    year: p.year, raw: p.rawNaive, harm: p.rawH,
    modis: p.year < SEAM_YEAR ? p.rawNaive : p.rawSummed - p.rawNaive,
    provisional: p.provisional,
  }));
}

const span = ([a, b]: readonly [number, number]): number[] => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** % change of the mean over `late` against the mean over `early`. Null when a year of either list is not in the
 *  record, a list has fewer than MIN_YEARS years, or the early mean is not above zero. */
export function pctChange(totals: YearTotal[], key: 'raw' | 'harm' | 'modis', late: number[], early: number[]): number | null {
  if (late.length < MIN_YEARS || early.length < MIN_YEARS) return null;
  const by = new Map(totals.map((t) => [t.year, t]));
  const mean = (ys: number[]): number | null => {
    let s = 0;
    for (const y of ys) {
      const t = by.get(y);
      if (!t) return null;
      s += t[key];
    }
    return s / ys.length;
  };
  const l = mean(late), e = mean(early);
  if (l == null || e == null || !(e > 0)) return null;
  const c = (l / e - 1) * 100;
  return Number.isFinite(c) ? c : null;
}

export type VariantId = 'headline' | 'across-seam' | 'no-el-nino';
export interface Variant {
  id: VariantId;
  late: number[]; early: number[];
  dropped: number[];   // the years of the headline windows this comparison leaves out
}
export interface VariantResult extends Variant {
  raw: number | null; harm: number | null; modis: number | null;
}

/**
 * The comparisons of the strip, each against the early window (2003 to 2007):
 *  - headline: 2017 to 2021, the last five years before conversion starts (the stat tiles). No value sits on the 2022
 *    seam, whose test fails, and the harmonized line is MODIS's own count in every year of it;
 *  - across-seam: 2019 to 2023, the comparison the page led with before the science review. Two of its five late
 *    years are converted VIIRS;
 *  - no-el-nino: the headline windows without the El Nino years of the list given. Left out when there is no list.
 */
export function variants(elNino: readonly number[] | null): Variant[] {
  const late = span(LATE), early = span(EARLY), across = span(ACROSS);
  const out: Variant[] = [
    { id: 'headline', late, early, dropped: [] },
    { id: 'across-seam', late: across, early, dropped: [] },
  ];
  if (elNino) {
    const hot = new Set(elNino);
    out.push({
      id: 'no-el-nino',
      late: late.filter((y) => !hot.has(y)), early: early.filter((y) => !hot.has(y)),
      dropped: [...early, ...late].filter((y) => hot.has(y)),
    });
  }
  return out;
}

/** The headline change of each series (the stat tiles): the first comparison. */
export function headline(totals: YearTotal[]): VariantResult {
  return robustness(totals, null)[0]!;
}

export function robustness(totals: YearTotal[], elNino: readonly number[] | null): VariantResult[] {
  return variants(elNino).map((v) => ({
    ...v,
    raw: pctChange(totals, 'raw', v.late, v.early),
    harm: pctChange(totals, 'harm', v.late, v.early),
    modis: pctChange(totals, 'modis', v.late, v.early),
  }));
}

export interface Reading {
  n: number;              // comparisons with a number
  sameDirection: boolean; // every one of them has the same sign (none is zero)
  sign: -1 | 0 | 1;       // that sign, or 0 when they differ
  min: number; max: number;
}
/** What the strip says about one series: do all comparisons point the same way, and how far apart are they?
 *  Null with fewer than two numbers (nothing to compare). */
export function reading(results: VariantResult[], key: 'raw' | 'harm' | 'modis'): Reading | null {
  const xs = results.map((r) => r[key]).filter((x): x is number => x != null);
  if (xs.length < 2) return null;
  const min = Math.min(...xs), max = Math.max(...xs);
  const sameDirection = (min > 0 && max > 0) || (min < 0 && max < 0);
  return { n: xs.length, sameDirection, sign: sameDirection ? (min > 0 ? 1 : -1) : 0, min, max };
}

export interface LineMakeup {
  /** every complete year before CONVERTED_FROM has a harmonized total equal to MODIS's own count */
  ownCount: boolean;
  ownTo: number;          // the last year of MODIS's own count (CONVERTED_FROM - 1)
  convertedFrom: number;
}
/** What the harmonized line is, checked against the totals: MODIS's own count before CONVERTED_FROM (equal within
 *  half a cell-day in every year), converted VIIRS from then on. When the check fails the page must not say
 *  "Aqua's own count". */
export function lineMakeup(totals: YearTotal[]): LineMakeup {
  const before = totals.filter((t) => t.year < CONVERTED_FROM);
  return {
    ownCount: before.length > 0 && before.every((t) => Math.abs(t.harm - t.modis) < 0.5),
    ownTo: CONVERTED_FROM - 1,
    convertedFrom: CONVERTED_FROM,
  };
}

/** Of a list of years, how many come before conversion starts (MODIS's own count when `ownCount` holds). */
export const ownYears = (years: number[]): number => years.filter((y) => y < CONVERTED_FROM).length;

/** How one year's harmonized value was made (for the table). */
export function yearSource(t: YearTotal, m: LineMakeup): 'own' | 'converted' | 'unknown' {
  if (t.year >= m.convertedFrom) return 'converted';
  return Math.abs(t.harm - t.modis) < 0.5 ? 'own' : 'unknown';
}

// ------------------------------------------------------------------------------------------------ the seam check

/** The rows of validation_results.json this needs (lib/record.ts Validation has them). */
export interface SeamSource {
  meta: { chosen_method?: string } | null;
  results: { test_id: string; metric: string; passed: boolean | null; status?: string }[];
}
/** Does the chosen method's seam check at the year conversion starts fail (test V3, "seam <year>-01", the main
 *  series)? True or false when the file has that row and it was run; null otherwise, and the page then does not say
 *  "failed". */
export function seamFails(v: SeamSource | null, year: number): boolean | null {
  if (!v) return null;
  const method = v.meta?.chosen_method ?? 'M3';
  const row = v.results.find((r) => r.test_id === 'V3' && r.metric.includes(`seam ${year}-01`) && r.metric.includes(`${method}/main`));
  if (!row || row.passed == null || (row.status != null && row.status !== 'run')) return null;
  return row.passed === false;
}

// ------------------------------------------------------------------------------------------------ El Nino years

/** public/ka-data/enso_oni.json */
export interface EnsoFile {
  source: string; url: string; accessed: string; rule: string;
  season: string; threshold: number;
  years_covered?: [number, number];
  el_nino_years: number[];
  jas_oni: Record<string, number>;
  table_last_season?: string;
}

/** The El Nino years of the file: its rule applied to its own index values (the stored list is the same; a test
 *  checks that). Null when the file does not have what the rule needs. */
export function elNinoYears(f: EnsoFile | null | undefined): number[] | null {
  if (!f || typeof f.threshold !== 'number' || !f.jas_oni || typeof f.jas_oni !== 'object') return null;
  const ys = Object.entries(f.jas_oni)
    .filter(([y, v]) => Number.isFinite(Number(y)) && typeof v === 'number' && v >= f.threshold)
    .map(([y]) => Number(y)).sort((a, b) => a - b);
  return ys.length ? ys : null;
}

/** "2003 to 2007", "2003, 2005 to 2007", "2019 to 2022": a list of years in plain words (`to` is the word between
 *  the ends of a run, so the page can pass its own language's). */
export function yearsText(ys: number[], to = 'to'): string {
  const s = [...ys].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < s.length;) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j]! + 1) j += 1;
    parts.push(j === i ? String(s[i]) : j === i + 1 ? `${s[i]}, ${s[j]}` : `${s[i]} ${to} ${s[j]}`);
    i = j + 1;
  }
  return parts.join(', ');
}

// ------------------------------------------------------------------------------------------------ a month's status

/** The plain status of a month on the "This month" tile, from the record's own `pct_rank` of that month only: the
 *  share of the same calendar month in earlier years that this month is above (ties count half; the bundle's
 *  baseline rule, checked against every row of the national and the Central Kalimantan files). Nothing else enters. */
export type MonthStatus = 'below' | 'near' | 'above' | 'far-above';
/** Under the first cut: below normal; under the second: near normal; under the third: above normal; from it: far
 *  above normal. The tile states these on screen. */
export const STATUS_CUTS: readonly [number, number, number] = [0.25, 0.75, 0.9];
/** With fewer earlier years than this the rank says too little, and the tile shows no label. */
export const MIN_EARLIER_YEARS = 5;

export function monthStatus(pctRank: number | null | undefined): MonthStatus | null {
  if (pctRank == null || !Number.isFinite(pctRank)) return null;
  if (pctRank < STATUS_CUTS[0]) return 'below';
  if (pctRank < STATUS_CUTS[1]) return 'near';
  if (pctRank < STATUS_CUTS[2]) return 'above';
  return 'far-above';
}
