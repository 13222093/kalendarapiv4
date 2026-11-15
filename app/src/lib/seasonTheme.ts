// KalenderApi (new file): the map colours of "Play the season", read from the design tokens (styles/brand.css) so the
// WebGL layers and the page's CSS use one palette: VIIRS amber for hotspots, MODIS blue for the cloud map, the accent
// for what is selected. deck.gl needs numbers, so the tokens are read from the page once and parsed.

export type Rgb = [number, number, number];
export interface SeasonColors { viirs: Rgb; modis: Rgb; accent: Rgb; text: Rgb; text3: Rgb; bg: Rgb }

function parse(raw: string): Rgb | null {
  const v = raw.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v)?.[1];
  if (hex) {
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
  }
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(v);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Reads the tokens from the page's root. A token that cannot be read falls back to plain white, never to a made-up hue. */
export function readSeasonColors(): SeasonColors {
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string): Rgb => parse(cs.getPropertyValue(name)) ?? [255, 255, 255];
  return {
    viirs: get('--ka-viirs'), modis: get('--ka-modis'), accent: get('--accent'),
    text: get('--text'), text3: get('--text-3'), bg: get('--bg'),
  };
}

/** a toward b by t (0 to 1) */
export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
}
