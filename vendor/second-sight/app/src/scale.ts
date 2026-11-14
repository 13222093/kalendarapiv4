// Colour scales for the calendar.
// Count: sequential log scale on Inferno, trimmed so the light end stays visible on white and the
// dark end is not pure black. Higher = darker. Adaptive: max comes from the AOI being shown.
// Ratio vs median: diverging RdBu reversed (blue = below median, red/orange = above), 9 classes,
// neutral grey centre = equal to the median.
import { interpolateInferno, interpolateRdBu } from 'd3-scale-chromatic';

export function countColor(v: number, max: number): string {
  const t = max > 0 ? Math.log1p(v) / Math.log1p(max) : 0;
  return interpolateInferno(0.97 - 0.62 * Math.min(1, Math.max(0, t)));
}

/** 9 classes on log2(ratio), clamped to [1/4, 4]. Class 4 is neutral. */
export function ratioClass(ratio: number): number {
  const l = Math.log2(Math.max(1e-6, ratio));
  return Math.round(Math.min(2, Math.max(-2, l)) * 2) + 4;
}

export function ratioColor(cls: number): string {
  if (cls === 4) return '#E6E8EB';
  return interpolateRdBu(1 - (0.06 + (cls / 8) * 0.88));
}

function parse(c: string): [number, number, number] {
  if (c.startsWith('#')) return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
  const m = c.match(/\d+(\.\d+)?/g) ?? ['0', '0', '0'];
  return [Number(m[0]), Number(m[1]), Number(m[2])];
}

/** Dark or white text for a fill, by relative luminance (keeps contrast >= 4.5:1 where possible). */
export function textOn(fill: string): string {
  const [r, g, b] = parse(fill).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.2 ? '#1B1F24' : '#FFFFFF';
}
