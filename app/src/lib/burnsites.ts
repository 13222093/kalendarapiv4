// KalenderApi (new file): places where NASA's satellites detected fire again in the last seven days.
// "Still burning?" in the command view, the daily report and the field check plan all read this one list. It is a
// plain function of the live hotspots the page already holds (the reply of /api/live): detections close together are
// one site, and a site is listed when its detections are spread over more than a day. Nothing here says a fire kept
// burning between two detections, or that two detections are the same fire: the satellites saw heat at the same place
// at different times, which is a reason to check on the ground. Nothing is forecast, and nothing is filled in.
import { HOUR, SENSORS, pointMs, type LivePoint, type Sensor } from './now.ts';

/** A detection this close (km) to any detection of a site belongs to that site. About one MODIS pixel (a VIIRS pixel
 *  is 375 m), so the same fire seen by two satellites, or on two days, lands in one site. Our own rule. */
export const SITE_JOIN_KM = 1;
/** A site is "detected again" when its first and last detection are at least this many hours apart. The satellites
 *  pass about every 12 hours (early afternoon and after midnight), so 18 hours or more is a later day's pass. */
export const AGAIN_HOURS = 18;
/** "Came back": this many hours or more with no detection at the site, then a detection again. A site seen once a day
 *  has gaps of about 24 hours; 36 or more means at least one day's passes went by without a detection. */
export const RETURN_GAP_HOURS = 36;
/** The window, as the page's "last 7 days" (lib/now.ts countLive). */
export const SITE_WINDOW_HOURS = 168;

/** `returned`: detected, then RETURN_GAP_HOURS or more without a detection, then detected again.
 *  `persisting`: detected again and again over AGAIN_HOURS or more, with no such gap.
 *  `single`: all its detections fall within AGAIN_HOURS (one day's passes). */
export type SiteKind = 'returned' | 'persisting' | 'single';

/** A known fixed heat source of NASA's archive (lib/fixedheat.ts): an active volcano; industry, a gas flare or another
 *  static source on land; a source NASA types "offshore", at sea or on the shore (the Balikpapan refinery flare is
 *  one). Such a place is seen day after day and is not a land fire. */
export type FixedKind = 'volcano' | 'static' | 'offshore';
/** What the page knows about a point beyond the detection itself; each is optional and may answer null (not known). */
export interface SiteTags {
  peat?: (lon: number, lat: number) => boolean | null;       // on mapped peat (lib/peatmask.ts)
  fixed?: (lon: number, lat: number) => FixedKind | null;    // at or next to a known fixed heat source
}

export interface BurnSite {
  id: string;                      // changes when the site is detected again: a new detection is a new thing to check
  lat: number; lon: number;        // the centre of the site's detections
  radiusKm: number;                // the farthest detection from that centre
  detections: number;
  firstMs: number; lastMs: number;
  spanHours: number;               // from the first detection to the last
  gapHours: number;                // the longest time between two detections that follow each other
  bins: number[];                  // detections per 24 hours before the read time: seven, oldest first (as sevenDays)
  daysSeen: number;                // how many of those seven have a detection
  fresh: boolean;                  // detected in the last 24 hours
  kind: SiteKind;
  night: number;                   // detections made at night
  frpMax: number | null;           // fire radiative power, MW: the highest and the middle value of the detections that have one
  frpMedian: number | null;
  sensors: Sensor[];
  newest: LivePoint;
  onPeat: boolean | null;          // the centre is on mapped peat; null when no peat map was given for this place
  fixed: FixedKind | null;         // half or more of its detections lie at a known fixed heat source: not a land fire
}

const RAD = Math.PI / 180;
/** Straight-line distance over the ground between two points, km (great circle). Not a road distance. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const a = Math.sin(((lat2 - lat1) * RAD) / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(((lon2 - lon1) * RAD) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(a)));
}

const r1 = (x: number) => Math.round(x * 10) / 10;
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
const median = (sorted: number[]) => (sorted.length % 2 ? sorted[(sorted.length - 1) / 2]! : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2);

/** The order of the list: detected again and seen in the last 24 hours first, then the other sites detected again,
 *  then the rest (seen in the last 24 hours first), and the known fixed heat sources last; within each, more days
 *  seen, then the newest, then the most detections. */
const rank = (s: BurnSite) => (s.fixed ? 4 : s.kind !== 'single' ? (s.fresh ? 0 : 1) : s.fresh ? 2 : 3);
const FIXED_KINDS: readonly FixedKind[] = ['static', 'volcano', 'offshore'];
function byPriority(a: BurnSite, b: BurnSite): number {
  return rank(a) - rank(b) || b.daysSeen - a.daysSeen || b.lastMs - a.lastMs || b.detections - a.detections || a.id.localeCompare(b.id);
}

/** The sites of the last seven days, most pressing first. `points` are the detections inside the district already
 *  (the page tests each against the district outline). `tags`, when the maps are at hand, say whether a point is on
 *  mapped peat and whether it is a known fixed heat source. Detections after `nowMs` or older than seven days are
 *  left out. */
export function burnSites(points: LivePoint[], nowMs: number, tags: SiteTags = {}): BurnSite[] {
  const pts = points
    .map((p) => ({ p, t: pointMs(p) }))
    .filter((x) => x.t <= nowMs && x.t >= nowMs - SITE_WINDOW_HOURS * HOUR)
    .sort((a, b) => a.p[1] - b.p[1]);
  // join detections within SITE_JOIN_KM of each other into one site (a chain of close detections is one site)
  const parent = pts.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]!]!; i = parent[i]!; }
    return i;
  };
  const latWindow = SITE_JOIN_KM / 110.5;   // a degree of latitude is never shorter than this many km
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!.p;
    for (let j = i + 1; j < pts.length && pts[j]!.p[1] - a[1] <= latWindow; j++) {
      const b = pts[j]!.p;
      if (distanceKm(a[1], a[0], b[1], b[0]) <= SITE_JOIN_KM) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, { p: LivePoint; t: number }[]>();
  pts.forEach((x, i) => {
    const root = find(i);
    const g = groups.get(root);
    if (g) g.push(x); else groups.set(root, [x]);
  });

  const sites: BurnSite[] = [];
  for (const g of groups.values()) {
    g.sort((a, b) => a.t - b.t);
    const lat = r4(g.reduce((s, x) => s + x.p[1], 0) / g.length), lon = r4(g.reduce((s, x) => s + x.p[0], 0) / g.length);
    const firstMs = g[0]!.t, lastMs = g[g.length - 1]!.t;
    let gap = 0;
    for (let i = 1; i < g.length; i++) gap = Math.max(gap, g[i]!.t - g[i - 1]!.t);
    const bins = [0, 0, 0, 0, 0, 0, 0];
    for (const x of g) {
      const age = nowMs - x.t;
      const back = age === 0 ? 0 : Math.ceil(age / (24 * HOUR)) - 1;   // 0: the last 24 hours ... 6: the oldest day
      bins[6 - Math.min(6, back)]! += 1;
    }
    const frps = g.map((x) => x.p[2]).filter((v): v is number => v != null).sort((a, b) => a - b);
    const spanHours = (lastMs - firstMs) / HOUR, gapHours = gap / HOUR;
    // a site is a fixed heat source when half or more of its detections lie at one (the kind most of them name)
    let fixed: FixedKind | null = null;
    if (tags.fixed) {
      const kinds = g.map((x) => tags.fixed!(x.p[0], x.p[1])).filter((k): k is FixedKind => k != null);
      if (kinds.length * 2 >= g.length) {
        fixed = FIXED_KINDS.reduce<FixedKind | null>((best, k) => {
          const n = kinds.filter((x) => x === k).length;
          return n > (best ? kinds.filter((x) => x === best).length : 0) ? k : best;
        }, null);
      }
    }
    sites.push({
      id: `site:${lat.toFixed(3)},${lon.toFixed(3)}:${g[g.length - 1]!.p[5]}T${g[g.length - 1]!.p[6]}`,
      lat, lon, radiusKm: r1(Math.max(...g.map((x) => distanceKm(lat, lon, x.p[1], x.p[0])))),
      detections: g.length, firstMs, lastMs, spanHours: r1(spanHours), gapHours: r1(gapHours),
      bins, daysSeen: bins.filter((n) => n > 0).length, fresh: nowMs - lastMs <= 24 * HOUR,
      kind: gapHours >= RETURN_GAP_HOURS ? 'returned' : spanHours >= AGAIN_HOURS ? 'persisting' : 'single',
      night: g.filter((x) => x.p[3] === 'N').length,
      frpMax: frps.length ? frps[frps.length - 1]! : null, frpMedian: frps.length ? r1(median(frps)) : null,
      sensors: SENSORS.filter((s) => g.some((x) => x.p[4] === s)),
      newest: g[g.length - 1]!.p,
      onPeat: tags.peat ? tags.peat(lon, lat) : null,
      fixed,
    });
  }
  return sites.sort(byPriority);
}

/** The sites detected again: the list of "Still burning?". Known fixed heat sources are not in it (fixedSites). */
export const againSites = (sites: BurnSite[]): BurnSite[] => sites.filter((s) => s.kind !== 'single' && !s.fixed);

/** The known fixed heat sources among the sites (a volcano, industry, a gas flare): left out of the lists above and
 *  named apart, so the reader sees they were seen and why they are not targets. */
export const fixedSites = (sites: BurnSite[]): BurnSite[] => sites.filter((s) => s.fixed != null);

/** The targets of a field check, in the list's order: every site detected again, then the sites seen only in the last
 *  24 hours. Sites seen once and not in the last 24 hours, and known fixed heat sources, are left out. At most `max`. */
export function planTargets(sites: BurnSite[], max: number): BurnSite[] {
  return sites.filter((s) => !s.fixed && (s.kind !== 'single' || s.fresh)).slice(0, Math.max(0, max));
}

export interface Visit { site: BurnSite; legKm: number | null }
/** An order to visit the targets in: start at the first (the most pressing), then always the nearest one not yet
 *  visited. `legKm` is the straight-line distance from the stop before (null for the first): not a road distance. */
export function visitOrder(targets: BurnSite[]): Visit[] {
  const left = targets.slice();
  const out: Visit[] = [];
  let at = left.shift();
  if (!at) return out;
  out.push({ site: at, legKm: null });
  while (left.length) {
    let best = 0, bestKm = Infinity;
    left.forEach((s, i) => {
      const km = distanceKm(at!.lat, at!.lon, s.lat, s.lon);
      if (km < bestKm) { bestKm = km; best = i; }
    });
    at = left.splice(best, 1)[0]!;
    out.push({ site: at, legKm: r1(bestKm) });
  }
  return out;
}

/** The nearest place of `past` within `km` of the site, or null (the peat sites of an earlier season, lib/now.ts PeatSite). */
export function pastSiteNear<T extends { lat: number; lon: number }>(site: { lat: number; lon: number }, past: T[], km = SITE_JOIN_KM): T | null {
  let best: T | null = null, bestKm = km;
  for (const p of past) {
    const d = distanceKm(site.lat, site.lon, p.lat, p.lon);
    if (d <= bestKm) { best = p; bestKm = d; }
  }
  return best;
}

/** A link that opens the point in Google Maps (for the crew's phone). */
export const mapsHref = (lat: number, lon: number): string => `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(5)},${lon.toFixed(5)}`;
