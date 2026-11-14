// Areas of interest. Bounds are approximate lon/lat boxes for map framing only;
// the real AOI geometry and aggregates come from the data pipeline (pipeline/export).
import turfArea from '@turf/area';

export type AoiId = string;
export type Bounds = [[number, number], [number, number]];
export type AoiGroup = 'story' | 'region' | 'national';

export interface Aoi {
  id: AoiId;
  group: AoiGroup;
  name: { id: string; en: string };
  story?: { id: string; en: string };
  bounds: Bounds;
}

export const AOIS: Aoi[] = [
  { id: 'kalteng', group: 'story', name: { id: 'Kalimantan Tengah', en: 'Central Kalimantan' }, story: { id: 'kabut 2015', en: 'the 2015 haze' }, bounds: [[110.7, -3.6], [116.0, 0.8]] },
  { id: 'khg-sebangau', group: 'story', name: { id: 'KHG Sebangau', en: 'Sebangau peat unit (KHG)' }, story: { id: 'gambut Sebangau', en: 'Sebangau peat' }, bounds: [[113.4, -3.4], [114.4, -1.9]] },
  { id: 'riau-kampar', group: 'story', name: { id: 'Riau, Semenanjung Kampar', en: 'Riau, Kampar Peninsula' }, story: { id: 'Sungai Kampar', en: 'Kampar River' }, bounds: [[102.4, -0.2], [103.6, 0.8]] },
  { id: 'sumsel-oki', group: 'story', name: { id: 'Sumatera Selatan, OKI', en: 'South Sumatra, OKI' }, story: { id: 'OKI 2019', en: 'OKI 2019' }, bounds: [[104.6, -4.0], [106.2, -2.6]] },
  { id: 'jambi-berbak', group: 'story', name: { id: 'Jambi, Berbak', en: 'Jambi, Berbak' }, story: { id: 'Berbak', en: 'Berbak' }, bounds: [[103.8, -1.7], [104.6, -0.9]] },
  { id: 'kalbar-ketapang', group: 'story', name: { id: 'Kalimantan Barat, Ketapang', en: 'West Kalimantan, Ketapang' }, story: { id: 'Ketapang', en: 'Ketapang' }, bounds: [[109.6, -3.1], [111.3, -0.9]] },
  { id: 'indonesia', group: 'national', name: { id: 'Indonesia', en: 'Indonesia' }, bounds: [[94.5, -11.5], [141.5, 6.5]] },
  { id: 'sumatera', group: 'region', name: { id: 'Sumatera', en: 'Sumatra' }, bounds: [[95.0, -6.0], [106.2, 6.0]] },
  { id: 'kalimantan', group: 'region', name: { id: 'Kalimantan', en: 'Kalimantan' }, bounds: [[108.5, -4.3], [119.3, 4.4]] },
  { id: 'jawa-bali-nusa', group: 'region', name: { id: 'Jawa, Bali, Nusa Tenggara', en: 'Java, Bali, Nusa Tenggara' }, bounds: [[105.0, -11.0], [127.5, -5.8]] },
  { id: 'sulawesi', group: 'region', name: { id: 'Sulawesi', en: 'Sulawesi' }, bounds: [[118.7, -6.2], [125.3, 2.0]] },
  { id: 'papua-maluku', group: 'region', name: { id: 'Papua dan Maluku', en: 'Papua and Maluku' }, bounds: [[124.0, -9.2], [141.1, 3.0]] },
];

export const CUSTOM_ID = 'custom';
export const isAoiId = (v: unknown): v is AoiId => v === CUSTOM_ID || AOIS.some((a) => a.id === v);
export const presetById = (id: AoiId): Aoi | undefined => AOIS.find((a) => a.id === id);

// Custom AOI: a ring of [lon, lat] points (closed implicitly), plus how it was made.
export interface CustomAoi {
  kind: 'bbox' | 'draw' | 'point';
  ring: [number, number][];
  radiusKm?: number;
  center?: [number, number]; // lon, lat
}

export function ringBounds(ring: [number, number][]): Bounds {
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  return [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]];
}

export function bboxRing(w: number, s: number, e: number, n: number): [number, number][] {
  return [[w, s], [e, s], [e, n], [w, n]];
}

export function circleRing(lon: number, lat: number, km: number, steps = 64): [number, number][] {
  const out: [number, number][] = [];
  const dLat = km / 110.574;
  const dLon = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    out.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return out;
}

export function ringPolygon(ring: [number, number][]): GeoJSON.Feature<GeoJSON.Polygon> {
  const closed = [...ring, ring[0]];
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [closed] } };
}

export const areaKm2 = (ring: [number, number][]): number => turfArea(ringPolygon(ring)) / 1e6;

export function boundsRing(b: Bounds): [number, number][] {
  return bboxRing(b[0][0], b[0][1], b[1][0], b[1][1]);
}

// URL encoding: bbox=W,S,E,N | pt=lat,lon,km | poly=lon lat;lon lat;...
export function customToParams(c: CustomAoi | null): Record<string, string | null> {
  if (!c) return { bbox: null, pt: null, poly: null };
  const r = (n: number) => String(Math.round(n * 1e4) / 1e4);
  if (c.kind === 'point' && c.center) return { pt: `${r(c.center[1])},${r(c.center[0])},${c.radiusKm}`, bbox: null, poly: null };
  if (c.kind === 'bbox') {
    const b = ringBounds(c.ring);
    return { bbox: [b[0][0], b[0][1], b[1][0], b[1][1]].map(r).join(','), pt: null, poly: null };
  }
  return { poly: c.ring.map((p) => `${r(p[0])} ${r(p[1])}`).join(';'), bbox: null, pt: null };
}

export function validBbox(w: number, s: number, e: number, n: number): boolean {
  return [w, s, e, n].every(Number.isFinite) && w >= -180 && e <= 180 && s >= -90 && n <= 90 && w < e && s < n;
}

export function validPoint(lat: number, lon: number, km: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && km >= 1 && km <= 200;
}

export function customFromParams(p: Record<string, string>): CustomAoi | null {
  if (p.bbox) {
    const [w, s, e, n] = p.bbox.split(',').map(Number);
    if (validBbox(w, s, e, n)) return { kind: 'bbox', ring: bboxRing(w, s, e, n) };
  }
  if (p.pt) {
    const [lat, lon, km] = p.pt.split(',').map(Number);
    if (validPoint(lat, lon, km)) return { kind: 'point', center: [lon, lat], radiusKm: km, ring: circleRing(lon, lat, km) };
  }
  if (p.poly) {
    const ring = p.poly.split(';').map((s) => s.trim().split(/\s+/).map(Number) as [number, number]);
    if (ring.length >= 3 && ring.every((q) => q.length === 2 && q.every(Number.isFinite))) return { kind: 'draw', ring };
  }
  return null;
}

// Simple fuzzy match: every query character appears in order; score favours contiguous/early hits.
export function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase().trim();
  const s = text.toLowerCase();
  if (!q) return 1;
  const idx = s.indexOf(q);
  if (idx >= 0) return 100 - idx;
  let pos = 0;
  let gaps = 0;
  for (const ch of q) {
    if (ch === ' ') continue;
    const next = s.indexOf(ch, pos);
    if (next < 0) return 0;
    gaps += next - pos;
    pos = next + 1;
  }
  return Math.max(1, 50 - gaps);
}

export function searchAois(query: string, lang: 'id' | 'en'): Aoi[] {
  return AOIS.map((a) => ({ a, s: Math.max(fuzzyScore(query, a.name[lang]), fuzzyScore(query, a.name.id), a.story ? fuzzyScore(query, a.story[lang]) : 0) }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s)
    .map((x) => x.a);
}
