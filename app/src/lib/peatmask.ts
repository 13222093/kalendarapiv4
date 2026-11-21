// KalenderApi (new file): the mask of mapped peat (ka-data/peat_mask_idn.json), for "is this hot spot on mapped peat?".
// The file lists the 0.01 degree cells of Indonesia whose centre lies inside a polygon of the national peat map, as runs
// along the rows (pipeline/peat/build_peat_mask_idn.py). It is read once into two sorted arrays; a lookup is then a
// binary search. The mask says where peat was mapped, nothing about fire. The test is made at a cell centre on a
// 1:250,000 map, so a place near the edge of a peat area can be tagged wrongly: say "on mapped peat", not "on peat".

export const PEAT_MASK_FILE = 'ka-data/peat_mask_idn.json';
export const PEAT_MASK_FORMAT = 'ka-peat-mask-1';

// The grid of the pipeline (grid.py of Second Sight): rows and columns counted from -90, -180 in steps of 0.01 degree.
// EPS puts a point that sits exactly on a cell edge into the cell to the north / east, whatever the float rounding.
const CELL = 0.01, COLS = 36000, ROWS = 18000, EPS = 1e-7;
const rowOf = (lat: number) => Math.floor((lat + 90) / CELL + EPS);
const colOf = (lon: number) => Math.floor((lon + 180) / CELL + EPS);

/** The number of the cell a place falls in: row * 36000 + column. Note the order: latitude first, as in the pipeline. */
export function peatCellKey(lat: number, lon: number): number {
  return rowOf(lat) * COLS + colOf(lon);
}

export interface PeatMask {
  /** True when the cell the place falls in is in the mask. Longitude first, as in the app's [lon, lat] points. */
  has(lon: number, lat: number): boolean;
  /** Number of cells in the mask. */
  cells: number;
  /** One line that names the map, for a caption or the head of a file. */
  source: string;
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

/** "National peat map of Indonesia 1:250,000 (BBSDLP, Ministry of Agriculture, 2011), via Global Forest Watch", from
 *  the file's own source block; parts the file does not give are left out. */
function sourceLine(source: unknown): string {
  const s = (source && typeof source === 'object' ? source : {}) as Record<string, unknown>;
  const scale = str(s.scale), via = str(s.via);
  const who = [str(s.publisher), typeof s.year === 'number' ? String(s.year) : str(s.year)].filter(Boolean).join(', ');
  return `${str(s.title) ?? 'Peat map'}${scale ? ` ${scale}` : ''}${who ? ` (${who})` : ''}${via ? `, via ${via}` : ''}`;
}

/** The peat mask file, checked and decoded. Null when the body is not that file: another format or grid, or runs that
 *  are not whole numbers in rising order, or a cell count that differs from what the runs hold (a cut-off file).
 *  "runs" is a flat list of pairs: the first cell of a run minus the first cell of the run before, then its length. */
export function asPeatMask(body: unknown): PeatMask | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (b.format !== PEAT_MASK_FORMAT || b.cell_deg !== CELL || b.cols !== COLS) return null;
  const o = (b.origin && typeof b.origin === 'object' ? b.origin : {}) as Record<string, unknown>;
  if (o.lat !== -90 || o.lon !== -180) return null;          // the key formula above is for this grid only
  if (!Array.isArray(b.runs) || b.runs.length === 0 || b.runs.length % 2 !== 0) return null;
  const runs = b.runs as unknown[], n = runs.length / 2;
  const starts = new Uint32Array(n), ends = new Uint32Array(n);   // cell numbers stay below 648,000,000
  let start = 0, prevEnd = -1, cells = 0;
  for (let i = 0; i < n; i++) {
    const step = runs[2 * i], len = runs[2 * i + 1];
    if (typeof step !== 'number' || typeof len !== 'number' || !Number.isInteger(step) || !Number.isInteger(len) || len < 1) return null;
    start += step;
    const end = start + len - 1;
    if (start <= prevEnd || end >= ROWS * COLS) return null;  // not in rising order, or outside the grid
    starts[i] = start; ends[i] = end; prevEnd = end; cells += len;
  }
  if (b.cells !== cells) return null;
  return {
    cells,
    source: sourceLine(b.source),
    has(lon: number, lat: number): boolean {
      const row = rowOf(lat), col = colOf(lon);
      if (!(row >= 0 && row < ROWS && col >= 0 && col < COLS)) return false;   // off the grid, or not a number
      const key = row * COLS + col;
      let lo = 0, hi = n - 1;                                 // the last run that starts at or before the cell
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (starts[mid] <= key) lo = mid; else hi = mid - 1;
      }
      return starts[lo] <= key && key <= ends[lo];
    },
  };
}
