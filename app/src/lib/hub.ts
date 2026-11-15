// KalenderApi (new file): the small logic of the home panel (components/HubPanel.tsx). Pure functions only: which
// areas a typed name matches, the link an area opens, and the geometry of the small yearly chart. The numbers the
// panel shows are not computed here: they come from pages/landing-data.ts, the same loaders #/method reads.
import type { AoiEntry } from './record';

/** The quick-region chips, in order. A chip whose id is not in the index files is dropped by the panel. */
export const HUB_CHIP_IDS: readonly string[] = [
  'IDN', 'prov-kalimantan-tengah', 'prov-riau', 'prov-sumatera-selatan', 'prov-kalimantan-barat', 'kab-pulang-pisau',
];

/** The record page of one area. */
export const recordHref = (aoiId: string): string => `#/record?aoi=${encodeURIComponent(aoiId)}`;

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Areas of index.json (the country, island regions, provinces) whose English or Indonesian name holds every word
 *  typed. A name that starts with the first word comes first. */
export function matchAreas(aois: AoiEntry[], query: string, limit = 6): AoiEntry[] {
  const tokens = fold(query).split(' ').filter(Boolean);
  if (!tokens.length) return [];
  const t0 = tokens[0]!;
  const hits: { a: AoiEntry; score: number; name: string }[] = [];
  for (const a of aois) {
    const names = [...new Set([a.name_en, a.name_id, a.name].filter((n): n is string => !!n).map(fold))];
    if (!names.length) continue;
    const hay = names.join(' | ');
    if (!tokens.every((t) => hay.includes(t))) continue;
    const score = names.some((n) => n.startsWith(t0)) ? 0 : names.some((n) => n.split(' ').some((w) => w.startsWith(t0))) ? 1 : 2;
    hits.push({ a, score, name: names[0]! });
  }
  hits.sort((x, y) => x.score - y.score || x.name.localeCompare(y.name));
  return hits.slice(0, limit).map((h) => h.a);
}

/** The areas of the chips that exist, in chip order. */
export function chipAreas(ids: readonly string[], areas: AoiEntry[]): AoiEntry[] {
  const by = new Map(areas.map((a) => [a.aoi_id, a]));
  return ids.map((id) => by.get(id)).filter((a): a is AoiEntry => !!a);
}

export interface TrendPoint { year: number; raw: number; fair: number }
export interface TrendBox { width: number; height: number; top: number; right: number; bottom: number; left: number }
export interface TrendGeom {
  firstYear: number;
  lastYear: number;
  /** top of the value axis: the largest value of either line, rounded up to the next 100 */
  yMax: number;
  x: (year: number) => number;
  y: (value: number) => number;
  rawPath: string;
  fairPath: string;
  last: TrendPoint;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** The two lines of the yearly chart inside a box. A year missing from the list (left out as provisional) breaks the
 *  line there instead of being bridged. Null with fewer than two years or no value above zero. */
export function trendGeom(points: TrendPoint[], box: TrendBox): TrendGeom | null {
  const pts = points
    .filter((p) => Number.isFinite(p.year) && Number.isFinite(p.raw) && Number.isFinite(p.fair))
    .sort((a, b) => a.year - b.year);
  if (pts.length < 2) return null;
  const firstYear = pts[0]!.year, lastYear = pts[pts.length - 1]!.year;
  const top = Math.max(...pts.map((p) => Math.max(p.raw, p.fair)));
  if (!(top > 0) || lastYear === firstYear) return null;
  const yMax = Math.max(100, Math.ceil(top / 100) * 100);
  const w = box.width - box.left - box.right, h = box.height - box.top - box.bottom;
  const x = (year: number) => r1(box.left + ((year - firstYear) / (lastYear - firstYear)) * w);
  const y = (value: number) => r1(box.top + (1 - Math.min(1, Math.max(0, value / yMax))) * h);
  const path = (key: 'raw' | 'fair') => pts
    .map((p, i) => `${i === 0 || pts[i - 1]!.year !== p.year - 1 ? 'M' : 'L'}${x(p.year)},${y(p[key])}`)
    .join(' ');
  return { firstYear, lastYear, yMax, x, y, rawPath: path('raw'), fairPath: path('fair'), last: pts[pts.length - 1]! };
}
