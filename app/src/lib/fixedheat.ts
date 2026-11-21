// KalenderApi (new file): the mask of known fixed heat sources (ka-data/fixed_heat_idn.json), for "is this hot spot a
// refinery flare, a smelter or a volcano, and not a land fire?".
// NASA FIRMS near-real-time data carries no source type. The FIRMS standard archive does (its column "type"), so the
// file lists the 0.01 degree cells of Indonesia where the archive of the last five full years holds three or more
// detections that NASA typed as an active volcano, another static land source or offshore
// (pipeline/live/build_fixed_heat_idn.py). It is read once into a map from cell to kind.
// The type is NASA's presumption for a detection, not a ground check, and a facility newer than the archive is not in
// the file: a place in the mask is set aside, and a place outside it is not thereby a land fire.
import type { FixedKind } from './burnsites.ts';

export const FIXED_HEAT_FILE = 'ka-data/fixed_heat_idn.json';
export const FIXED_HEAT_FORMAT = 'ka-fixed-heat-1';

// The grid of the pipeline (grid.py of Second Sight): rows and columns counted from -90, -180 in steps of 0.01 degree.
// EPS puts a point that sits exactly on a cell edge into the cell to the north / east, whatever the float rounding.
const CELL = 0.01, COLS = 36000, ROWS = 18000, EPS = 1e-7;
const rowOf = (lat: number) => Math.floor((lat + 90) / CELL + EPS);
const colOf = (lon: number) => Math.floor((lon + 180) / CELL + EPS);

/** The number of the cell a place falls in: row * 36000 + column. Note the order: latitude first, as in the pipeline. */
export function fixedCellKey(lat: number, lon: number): number {
  return rowOf(lat) * COLS + colOf(lon);
}

/** The kinds as the file names them, in the order that settles a tie between neighbours. */
const KINDS: readonly FixedKind[] = ['static', 'volcano', 'offshore'];

export interface FixedHeat {
  /** The kind of the cell the place falls in, or null. Longitude first, as in the app's [lon, lat] points. */
  at(lon: number, lat: number): FixedKind | null;
  /** The kind of that cell or, when it has none, the most common kind among the eight cells around it (a tie goes to
   *  static, then volcano, then offshore); null when none of the nine is in the mask. A satellite coordinate can be
   *  off by a pixel, so this is the one to ask for a live hot spot. */
  near(lon: number, lat: number): FixedKind | null;
  /** Number of cells in the mask. */
  cells: number;
  /** The archive years the mask was built from, e.g. "2021–2025"; empty when the file does not say. */
  period: string;
  /** One line that names the data, for a caption or the head of a file. */
  source: string;
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const year = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : null);

/** "2021–2025" from the file's { first_year, last_year }; one year alone when both are the same. */
function periodLine(period: unknown): string {
  const p = (period && typeof period === 'object' ? period : {}) as Record<string, unknown>;
  const a = year(p.first_year), b = year(p.last_year);
  if (a == null || b == null) return '';
  return a === b ? String(a) : `${a}–${b}`;
}

/** The file's own citation; a plain name when the file gives none. */
function sourceLine(source: unknown): string {
  const s = (source && typeof source === 'object' ? source : {}) as Record<string, unknown>;
  return str(s.citation) ?? str(source) ?? 'NASA FIRMS standard archive, attribute "type"';
}

/** The fixed heat file, checked and decoded. Null when the body is not that file: another format or grid, a list that
 *  is missing or is not whole numbers in rising order, a cell in two kinds, or a cell count that differs from what the
 *  lists hold (a cut-off file). Each list under "kinds" is a first cell number, then the differences. */
export function asFixedHeat(body: unknown): FixedHeat | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (b.format !== FIXED_HEAT_FORMAT || b.cell_deg !== CELL || b.cols !== COLS) return null;
  if (b.origin !== undefined) {                              // the key formula above is for this grid only
    const o = (b.origin && typeof b.origin === 'object' ? b.origin : {}) as Record<string, unknown>;
    if (o.lat !== -90 || o.lon !== -180) return null;
  }
  if (!b.kinds || typeof b.kinds !== 'object') return null;
  const lists = b.kinds as Record<string, unknown>;
  const kindOf = new Map<number, FixedKind>();
  for (const kind of KINDS) {
    const list = lists[kind];
    if (!Array.isArray(list)) return null;
    let key = 0;
    for (let i = 0; i < list.length; i++) {
      const step: unknown = list[i];
      if (typeof step !== 'number' || !Number.isInteger(step) || (i > 0 && step < 1)) return null;
      key += step;
      if (key < 0 || key >= ROWS * COLS || kindOf.has(key)) return null;   // outside the grid, or in two kinds
      kindOf.set(key, kind);
    }
  }
  if (kindOf.size === 0 || b.cells !== kindOf.size) return null;

  // off the grid, or not a number: no kind (a comparison with NaN is false)
  const cell = (row: number, col: number): FixedKind | null =>
    (row >= 0 && row < ROWS && col >= 0 && col < COLS ? kindOf.get(row * COLS + col) ?? null : null);
  return {
    cells: kindOf.size,
    period: periodLine(b.period),
    source: sourceLine(b.source),
    at: (lon, lat) => cell(rowOf(lat), colOf(lon)),
    near(lon, lat) {
      const row = rowOf(lat), col = colOf(lon);
      const own = cell(row, col);
      if (own) return own;
      const seen: Record<FixedKind, number> = { static: 0, volcano: 0, offshore: 0 };
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const k = dr || dc ? cell(row + dr, col + dc) : null;
          if (k) seen[k] += 1;
        }
      }
      let best: FixedKind | null = null;
      for (const k of KINDS) if (seen[k] > (best ? seen[best] : 0)) best = k;   // a later kind must be strictly ahead
      return best;
    },
  };
}
