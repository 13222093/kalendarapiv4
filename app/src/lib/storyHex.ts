// KalenderApi (new file): the Story's hexagon field. The VIIRS hotspots the Story already loads
// (ka-data/kalteng_2019_season.json, NASA FIRMS, August to October 2019) are counted per H3 hexagon in the browser,
// once. The counts are a picture only: height and colour follow the count on a log scale, and no number from this
// aggregation is printed anywhere.
import { latLngToCell } from 'h3-js';

export interface StoryHex {
  h3: string;
  /** Height in metres at full rise. */
  elev: number;
  color: [number, number, number, number];
}

type Pt = [number, number, number, number];   // lon, lat, frp, isNight

/** The warm ramp of the story: dark red, red-orange, orange, pale yellow. */
const RAMP: [number, number, number, number][] = [
  [140, 40, 30, 190], [210, 80, 35, 210], [244, 140, 60, 225], [255, 214, 120, 235],
];
const MAX_HEIGHT_M = 70000;
const MAX_CELLS = 1500;

function ramp(t: number): [number, number, number, number] {
  const x = Math.max(0, Math.min(1, t)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(x)), f = x - i;
  const a = RAMP[i]!, b = RAMP[i + 1]!;
  return [0, 1, 2, 3].map((k) => Math.round(a[k]! + (b[k]! - a[k]!) * f)) as [number, number, number, number];
}

const memo = new WeakMap<object, StoryHex[]>();

/** Hotspots per hexagon over all the days given: resolution 5 (about 8 km a side), or 4 if that gives too many. */
export function storyHexes(days: { pts: Pt[] }[]): StoryHex[] {
  const hit = memo.get(days);
  if (hit) return hit;
  let counts = new Map<string, number>();
  for (const res of [5, 4, 3]) {
    counts = new Map();
    for (const d of days) {
      for (const p of d.pts) {
        const c = latLngToCell(p[1], p[0], res);
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
    }
    if (counts.size <= MAX_CELLS) break;
  }
  let max = 1;
  for (const n of counts.values()) if (n > max) max = n;
  const top = Math.log(1 + max);
  const out: StoryHex[] = [];
  for (const [h3, n] of counts) {
    const t = Math.log(1 + n) / top;
    out.push({ h3, elev: (0.05 + 0.95 * t) * MAX_HEIGHT_M, color: ramp(t) });
  }
  memo.set(days, out);
  return out;
}
