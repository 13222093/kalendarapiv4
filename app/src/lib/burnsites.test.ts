// KalenderApi (new file): tests of lib/burnsites.ts (sites detected again in the last seven days).
import { describe, expect, it } from 'vitest';
import { HOUR, type LivePoint, type Sensor } from './now.ts';
import { AGAIN_HOURS, RETURN_GAP_HOURS, againSites, burnSites, distanceKm, fixedSites, mapsHref, pastSiteNear, planTargets, visitOrder } from './burnsites.ts';
import { sevenDays } from './nowconsole.ts';

const NOW = Date.UTC(2026, 10, 21, 7, 0);   // 21 Nov 2026 07:00 UTC = 14:00 WIB
/** A detection `hoursAgo` before NOW at (lat, lon). */
function at(hoursAgo: number, lat: number, lon: number, o: { frp?: number | null; dn?: 'D' | 'N'; sensor?: Sensor } = {}): LivePoint {
  const d = new Date(NOW - hoursAgo * HOUR).toISOString();
  return [lon, lat, o.frp === undefined ? 5 : o.frp, o.dn ?? 'D', o.sensor ?? 'N20', d.slice(0, 10), d.slice(11, 13) + d.slice(14, 16)];
}
const A = { lat: -3.0, lon: 104.0 };
const KM = 1 / 111.195;   // one km of latitude, in degrees

describe('distanceKm', () => {
  it('measures one degree of latitude as about 111.2 km and nothing as zero', () => {
    expect(distanceKm(0, 100, 1, 100)).toBeCloseTo(111.195, 2);
    expect(distanceKm(-3, 104, -3, 104)).toBe(0);
  });
});

describe('burnSites', () => {
  it('joins detections within a km into one site and keeps far ones apart', () => {
    const sites = burnSites([at(2, A.lat, A.lon), at(3, A.lat + 0.5 * KM, A.lon), at(2, A.lat + 5 * KM, A.lon)], NOW);
    expect(sites.map((s) => s.detections).sort()).toEqual([1, 2]);
  });
  it('joins a chain of close detections even when its ends are more than a km apart', () => {
    const sites = burnSites([at(2, A.lat, A.lon), at(2, A.lat + 0.8 * KM, A.lon), at(2, A.lat + 1.6 * KM, A.lon)], NOW);
    expect(sites).toHaveLength(1);
    expect(sites[0]!.radiusKm).toBeCloseTo(0.8, 1);
  });
  it('calls a site seen within one day\'s passes "single"', () => {
    const [s] = burnSites([at(2, A.lat, A.lon), at(14, A.lat, A.lon, { dn: 'N' })], NOW);
    expect(s!.kind).toBe('single');
    expect(s!.spanHours).toBe(12);
    expect(againSites([s!])).toEqual([]);
  });
  it('calls a site seen on following days "persisting"', () => {
    const [s] = burnSites([at(1, A.lat, A.lon), at(25, A.lat, A.lon), at(49, A.lat, A.lon)], NOW);
    expect(s!.kind).toBe('persisting');
    expect(s!.gapHours).toBe(24);
    expect(s!.daysSeen).toBe(3);
    expect(s!.bins).toEqual([0, 0, 0, 0, 1, 1, 1]);
    expect(s!.fresh).toBe(true);
  });
  it('calls a site "returned" after a gap of a day and a half or more', () => {
    const [s] = burnSites([at(30, A.lat, A.lon), at(30 + RETURN_GAP_HOURS, A.lat, A.lon)], NOW);
    expect(s!.kind).toBe('returned');
    expect(s!.fresh).toBe(false);
    const [t] = burnSites([at(30, A.lat, A.lon), at(30 + RETURN_GAP_HOURS - 1, A.lat, A.lon)], NOW);
    expect(t!.kind).toBe('persisting');
    expect(AGAIN_HOURS).toBeLessThan(RETURN_GAP_HOURS);
  });
  it('leaves out detections older than seven days and detections after the read time', () => {
    expect(burnSites([at(169, A.lat, A.lon), at(-1, A.lat, A.lon)], NOW)).toEqual([]);
    expect(burnSites([at(168, A.lat, A.lon)], NOW)).toHaveLength(1);
  });
  it('counts the same seven 24-hour bins as the week strip', () => {
    const pts = [at(0, A.lat, A.lon), at(23.9, A.lat, A.lon), at(24, A.lat, A.lon), at(24.1, A.lat, A.lon), at(100, A.lat, A.lon), at(168, A.lat, A.lon)];
    const [s] = burnSites(pts, NOW);
    expect(s!.bins).toEqual(sevenDays(pts, NOW).map((b) => b.total));
    expect(s!.bins.reduce((a, b) => a + b, 0)).toBe(pts.length);
  });
  it('reports night detections, fire power and the satellites, and the centre of the detections', () => {
    const [s] = burnSites([
      at(1, A.lat, A.lon, { frp: 2, dn: 'N', sensor: 'N21' }), at(26, A.lat + 0.2 * KM, A.lon, { frp: 10, sensor: 'MODIS' }),
      at(50, A.lat + 0.4 * KM, A.lon, { frp: null, dn: 'N' }),
    ], NOW);
    expect([s!.night, s!.frpMax, s!.frpMedian]).toEqual([2, 10, 6]);
    expect(s!.sensors).toEqual(['N20', 'N21', 'MODIS']);
    expect(s!.lat).toBeCloseTo(A.lat + 0.2 * KM, 4);
    expect(s!.newest[4]).toBe('N21');
    expect(s!.onPeat).toBeNull();
  });
  it('has no fire power when no detection carries one', () => {
    const [s] = burnSites([at(1, A.lat, A.lon, { frp: null })], NOW);
    expect([s!.frpMax, s!.frpMedian]).toEqual([null, null]);
  });
  it('asks the peat map about the centre when one is given', () => {
    const [s] = burnSites([at(1, A.lat, A.lon)], NOW, { peat: (lon, lat) => lon === A.lon && lat === A.lat });
    expect(s!.onPeat).toBe(true);
    expect(s!.fixed).toBeNull();
  });
  it('sets a known fixed heat source aside: last in the list, in neither the "detected again" list nor the targets', () => {
    const flare = { lat: -1.2427, lon: 116.8156 };
    const sites = burnSites([
      at(1, flare.lat, flare.lon, { dn: 'N' }), at(25, flare.lat, flare.lon, { dn: 'N' }), at(49, flare.lat, flare.lon, { dn: 'N' }),
      at(60, -3.2, 104.0), at(100, -3.2, 104.0),
      at(90, -3.6, 104.0),
    ], NOW, { fixed: (lon, lat) => (lon === flare.lon && lat === flare.lat ? 'static' : null) });
    expect(sites.map((s) => s.fixed)).toEqual([null, null, 'static']);
    expect(againSites(sites).map((s) => s.lat)).toEqual([-3.2]);
    expect(planTargets(sites, 8).map((s) => s.lat)).toEqual([-3.2]);
    expect(fixedSites(sites).map((s) => [s.lat, s.kind])).toEqual([[flare.lat, 'persisting']]);
  });
  it('calls a site fixed only when half or more of its detections lie at a fixed source, by the kind most name', () => {
    const near = (n: number) => at(n, A.lat + 0.3 * KM, A.lon);
    const one = burnSites([at(1, A.lat, A.lon), near(2), near(3)], NOW, { fixed: (_lon, lat) => (lat === A.lat ? 'volcano' : null) });
    expect(one[0]!.fixed).toBeNull();
    const two = burnSites([at(1, A.lat, A.lon), near(2)], NOW, { fixed: (_lon, lat) => (lat === A.lat ? 'volcano' : null) });
    expect(two[0]!.fixed).toBe('volcano');
    const mixed = burnSites([at(1, A.lat, A.lon), near(2), near(3)], NOW, { fixed: (_lon, lat) => (lat === A.lat ? 'volcano' : 'static') });
    expect(mixed[0]!.fixed).toBe('static');
  });
  it('lists sites detected again and seen today first, then the others detected again, then the rest', () => {
    const sites = burnSites([
      at(2, -3.0, 104.0),                                             // single, fresh
      at(60, -3.2, 104.0), at(100, -3.2, 104.0),                      // returned, not fresh
      at(3, -3.4, 104.0), at(27, -3.4, 104.0),                        // persisting, fresh
      at(90, -3.6, 104.0),                                            // single, not fresh
    ], NOW);
    expect(sites.map((s) => s.lat)).toEqual([-3.4, -3.2, -3.0, -3.6]);
    expect(againSites(sites).map((s) => s.lat)).toEqual([-3.4, -3.2]);
    expect(planTargets(sites, 8).map((s) => s.lat)).toEqual([-3.4, -3.2, -3.0]);
    expect(planTargets(sites, 2)).toHaveLength(2);
  });
  it('gives a new id when the site is detected again', () => {
    const before = burnSites([at(30, A.lat, A.lon), at(54, A.lat, A.lon)], NOW)[0]!;
    const after = burnSites([at(30, A.lat, A.lon), at(54, A.lat, A.lon), at(1, A.lat, A.lon)], NOW)[0]!;
    expect(after.id).not.toBe(before.id);
  });
});

describe('visitOrder', () => {
  it('starts at the first target and then goes to the nearest one not yet visited', () => {
    const sites = burnSites([
      at(3, -3.0, 104.0), at(27, -3.0, 104.0),      // first by priority (persisting, fresh)
      at(60, -3.5, 104.0), at(100, -3.5, 104.0),    // second by priority, but far
      at(2, -3.1, 104.0),                           // third by priority, but near the first
    ], NOW);
    const route = visitOrder(planTargets(sites, 8));
    expect(route.map((v) => v.site.lat)).toEqual([-3.0, -3.1, -3.5]);
    expect(route[0]!.legKm).toBeNull();
    expect(route[1]!.legKm).toBeCloseTo(11.1, 1);
    expect(route[2]!.legKm).toBeCloseTo(44.5, 1);
    expect(visitOrder([])).toEqual([]);
  });
});

describe('pastSiteNear and mapsHref', () => {
  it('finds a past site within a km, the nearest one, and none farther away', () => {
    const past = [{ lat: A.lat + 0.9 * KM, lon: A.lon, n: 1 }, { lat: A.lat + 0.3 * KM, lon: A.lon, n: 2 }, { lat: A.lat + 3 * KM, lon: A.lon, n: 3 }];
    expect(pastSiteNear(A, past)?.n).toBe(2);
    expect(pastSiteNear(A, [past[2]!])).toBeNull();
  });
  it('writes a Google Maps link with latitude first', () => {
    expect(mapsHref(-3.3715, 113.9216)).toBe('https://www.google.com/maps/search/?api=1&query=-3.37150,113.92160');
  });
});
