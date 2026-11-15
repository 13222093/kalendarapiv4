// KalenderApi (new file): the small geometry "Play the season" needs to answer "which district is this?" and "how many
// of the loaded VIIRS hotspots fall in this district?". A plain even-odd point-in-polygon test over the district rings of
// public/ka-data/kalteng_districts.json (geoBoundaries, simplified). Nothing here estimates anything: it only counts the
// points the page already draws.

export type Ring = [number, number][];
export interface District {
  name: string;
  rings: Ring[];
  /** west, south, east, north of all rings */
  bbox: [number, number, number, number];
}

export function makeDistrict(name: string, rings: Ring[]): District {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < w) w = x;
      if (x > e) e = x;
      if (y < s) s = y;
      if (y > n) n = y;
    }
  }
  return { name, rings, bbox: [w, s, e, n] };
}

function inRing(ring: Ring, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!, b = ring[j]!;
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Even-odd over all rings: right for separate parts (islands) and for holes alike. */
export function inDistrict(d: District, lon: number, lat: number): boolean {
  const [w, s, e, n] = d.bbox;
  if (lon < w || lon > e || lat < s || lat > n) return false;
  let inside = false;
  for (const ring of d.rings) if (inRing(ring, lon, lat)) inside = !inside;
  return inside;
}

/** The index of the district a point falls in, or -1 (the data area is a box: some points lie outside the 14 districts). */
export function districtAt(ds: District[], lon: number, lat: number): number {
  for (let k = 0; k < ds.length; k++) if (inDistrict(ds[k]!, lon, lat)) return k;
  return -1;
}

/** Per day, the loaded points inside the district, and the running total from the first day. */
export function countByDay(d: District, days: { pts: ArrayLike<number>[] }[]): { day: number[]; soFar: number[] } {
  const day: number[] = [], soFar: number[] = [];
  let run = 0;
  for (const x of days) {
    let c = 0;
    for (const p of x.pts) if (inDistrict(d, p[0]!, p[1]!)) c += 1;
    run += c;
    day.push(c);
    soFar.push(run);
  }
  return { day, soFar };
}
