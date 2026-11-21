// KalenderApi (new file): tests of lib/peatmask.ts (the mask of mapped peat behind "on mapped peat").
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PEAT_MASK_FILE, PEAT_MASK_FORMAT, asPeatMask, peatCellKey } from './peatmask.ts';

const COLS = 36000;
const lengths = (runs: number[]) => runs.filter((_, i) => i % 2 === 1).reduce((a, b) => a + b, 0);
/** A mask file with the given runs (pairs of step and length); `over` replaces or adds fields. */
const fileOf = (runs: number[], over: Record<string, unknown> = {}) => ({
  format: PEAT_MASK_FORMAT, cell_deg: 0.01, cols: COLS, origin: { lat: -90, lon: -180 }, cells: lengths(runs), runs,
  source: { title: 'National peat map of Indonesia', publisher: 'BBSDLP, Ministry of Agriculture', year: 2011, scale: '1:250,000', via: 'Global Forest Watch' },
  ...over,
});

describe('peatCellKey', () => {
  it('counts rows from -90 and columns from -180 in steps of 0.01 degree', () => {
    expect(peatCellKey(-90, -180)).toBe(0);
    expect(peatCellKey(-2.005, 113.005)).toBe(8799 * COLS + 29300);
    expect(peatCellKey(-2.845, 113.785)).toBe(313769378);        // a peat site of Pulang Pisau, as the pipeline numbers it
    expect(peatCellKey(-0.00001, 109.99999)).toBe(8999 * COLS + 28999);
  });
  it('puts a point on a cell edge into the cell to the north and east, whatever the float rounding', () => {
    expect(peatCellKey(0, 110)).toBe(9000 * COLS + 29000);
    expect(peatCellKey(1.23, 101.45)).toBe(9123 * COLS + 28145);   // 91.23 / 0.01 is not exactly 9123 in floats
    expect(peatCellKey(-2.3, 113.99)).toBe(8770 * COLS + 29399);
  });
  it('gives every place of a cell the key of its centre', () => {
    const centre = peatCellKey(-2.845, 113.785);
    for (const [lat, lon] of [[-2.8499, 113.7801], [-2.8401, 113.7899], [-2.85, 113.78], [-2.8452, 113.7833]] as const) expect(peatCellKey(lat, lon)).toBe(centre);
    expect(peatCellKey(-2.845, 113.795)).toBe(centre + 1);         // one cell east
    expect(peatCellKey(-2.835, 113.785)).toBe(centre + COLS);      // one cell north
  });
});

describe('asPeatMask on a hand-made mask', () => {
  // Row of latitude -2.005: cells 113.00 to 113.03 (a run of three, then one that touches it) and the cell at 113.10.
  // Row of latitude -1.995: the two cells from 112.50.
  const A = peatCellKey(-2.005, 113.005);
  const m = asPeatMask(fileOf([A, 3, 3, 1, 7, 1, COLS - 60, 2]))!;
  it('decodes the runs and counts their cells', () => {
    expect(m).not.toBeNull();
    expect(m.cells).toBe(7);
    expect(m.source).toBe('National peat map of Indonesia 1:250,000 (BBSDLP, Ministry of Agriculture, 2011), via Global Forest Watch');
  });
  it('has the first, middle and last cell of the first run, and the cell that touches it', () => {
    for (const lon of [113.005, 113.015, 113.025, 113.035]) expect(m.has(lon, -2.005)).toBe(true);
    expect(m.has(113.0299, -2.0001)).toBe(true);                   // anywhere in the cell, not only its centre
    expect(m.has(113.0, -2.01)).toBe(true);                        // the south-west corner belongs to the cell
  });
  it('has not the cells just outside the first run', () => {
    expect(m.has(112.995, -2.005)).toBe(false);                    // west
    expect(m.has(112.99999, -2.005)).toBe(false);
    expect(m.has(113.045, -2.005)).toBe(false);                    // east of the touching cell
    expect(m.has(113.04, -2.005)).toBe(false);                     // its east edge is the next cell
    expect(m.has(113.005, -2.015)).toBe(false);                    // the row to the south
    expect(m.has(113.005, -1.995)).toBe(false);                    // the row to the north, same column
  });
  it('has a run of one cell in the middle, and not its neighbours', () => {
    expect(m.has(113.105, -2.005)).toBe(true);
    expect(m.has(113.095, -2.005)).toBe(false);
    expect(m.has(113.115, -2.005)).toBe(false);
  });
  it('has the last run, and not the cells around it', () => {
    expect(m.has(112.505, -1.995)).toBe(true);
    expect(m.has(112.515, -1.995)).toBe(true);
    expect(m.has(112.495, -1.995)).toBe(false);
    expect(m.has(112.525, -1.995)).toBe(false);
    expect(m.has(112.505, -1.985)).toBe(false);
  });
  it('is false before the first run, after the last, off the grid and for no number', () => {
    expect(m.has(100, -5)).toBe(false);
    expect(m.has(120, 3)).toBe(false);
    expect(m.has(113.005, 91)).toBe(false);
    expect(m.has(181, -2.005)).toBe(false);
    expect(m.has(-181, -2.005)).toBe(false);
    expect(m.has(Number.NaN, -2.005)).toBe(false);
    expect(m.has(113.005, Number.POSITIVE_INFINITY)).toBe(false);
  });
  it('takes longitude first: the same numbers the other way round are another place', () => {
    expect(m.has(113.005, -2.005)).toBe(true);
    expect(m.has(-2.005, 113.005)).toBe(false);
  });
  it('works with a single run', () => {
    const one = asPeatMask(fileOf([A, 1]))!;
    expect(one.cells).toBe(1);
    expect(one.has(113.005, -2.005)).toBe(true);
    expect(one.has(113.015, -2.005)).toBe(false);
    expect(one.has(112.995, -2.005)).toBe(false);
  });
});

describe('asPeatMask on a body that is not the file', () => {
  const A = peatCellKey(-2.005, 113.005);
  it('is null for a page, a string, an empty object or another format', () => {
    expect(asPeatMask(null)).toBeNull();
    expect(asPeatMask('<!doctype html>')).toBeNull();
    expect(asPeatMask({})).toBeNull();
    expect(asPeatMask(fileOf([A, 3], { format: 'ka-peat-mask-0' }))).toBeNull();
  });
  it('is null for another grid, since the key is for this grid only', () => {
    expect(asPeatMask(fileOf([A, 3], { cell_deg: 0.05 }))).toBeNull();
    expect(asPeatMask(fileOf([A, 3], { cols: 7200 }))).toBeNull();
    expect(asPeatMask(fileOf([A, 3], { origin: { lat: 0, lon: 0 } }))).toBeNull();
    expect(asPeatMask(fileOf([A, 3], { origin: undefined }))).toBeNull();
  });
  it('is null for runs that are missing, odd in number, not whole numbers, empty or out of order', () => {
    expect(asPeatMask(fileOf([A, 3], { runs: undefined }))).toBeNull();
    expect(asPeatMask(fileOf([], { cells: 0 }))).toBeNull();
    expect(asPeatMask(fileOf([A, 3, 5], { cells: 3 }))).toBeNull();
    expect(asPeatMask(fileOf([A, 3], { runs: [A, '3'] }))).toBeNull();
    expect(asPeatMask(fileOf([A + 0.5, 3]))).toBeNull();
    expect(asPeatMask(fileOf([A, 0], { cells: 0 }))).toBeNull();
    expect(asPeatMask(fileOf([A, 3, 2, 1]))).toBeNull();            // the second run starts inside the first
    expect(asPeatMask(fileOf([A, 3, -10, 1]))).toBeNull();
    expect(asPeatMask(fileOf([18000 * COLS - 1, 2]))).toBeNull();   // runs off the end of the grid
  });
  it('is null when the cell count is not what the runs hold (a cut-off file)', () => {
    expect(asPeatMask(fileOf([A, 3], { cells: 4 }))).toBeNull();
    expect(asPeatMask(fileOf([A, 3], { cells: undefined }))).toBeNull();
  });
  it('still reads a file with no source block, with a plain name for the map', () => {
    expect(asPeatMask(fileOf([A, 3], { source: undefined }))!.source).toBe('Peat map');
    expect(asPeatMask(fileOf([A, 3], { source: { title: 'A map', year: '2011' } }))!.source).toBe('A map (2011)');
  });
});

describe('the real mask (public/ka-data/peat_mask_idn.json)', () => {
  const read = (f: string) => JSON.parse(readFileSync(new URL(`../../public/${f}`, import.meta.url), 'utf8')) as Record<string, unknown>;
  const file = read(PEAT_MASK_FILE);
  const m = asPeatMask(file)!;
  it('is read, and its cell count is the number of cells its runs hold', () => {
    expect(m).not.toBeNull();
    expect(m.cells).toBe(lengths(file.runs as number[]));
    expect(m.cells).toBe(file.cells);
    expect(m.cells).toBeGreaterThan(100_000);
    expect(m.source).toBe('National peat map of Indonesia 1:250,000 (BBSDLP, Ministry of Agriculture, 2011), via Global Forest Watch');
  });
  it('says what is known of the licence, and assumes none', () => {
    const lic = String((file.source as Record<string, unknown>).license);
    expect(lic).toContain('No licence is stated');
    expect(lic).toContain('doi:10.5518/252');
    expect(lic).not.toMatch(/assumed/i);
  });
  it('has places on mapped peat: two peat sites of Central Kalimantan, Sebangau, the Kampar peninsula', () => {
    expect(m.has(113.785, -2.845)).toBe(true);                     // Pulang Pisau
    expect(m.has(114.135, -2.025)).toBe(true);                     // Kapuas
    expect(m.has(113.70, -2.60)).toBe(true);                       // Sebangau
    expect(m.has(102.60, 0.40)).toBe(true);                        // Kampar peninsula, Riau
  });
  it('has not places off the peat map: Java, a hill town, a city on mineral soil, the sea', () => {
    expect(m.has(107.6098, -6.9147)).toBe(false);                  // Bandung
    expect(m.has(106.8272, -6.1754)).toBe(false);                  // Jakarta
    expect(m.has(114.5667, -0.6356)).toBe(false);                  // Puruk Cahu, Murung Raya
    expect(m.has(119.4327, -5.1477)).toBe(false);                  // Makassar
    expect(m.has(110.0, -5.0)).toBe(false);                        // Java Sea
  });
  it('has every peat site the Central Kalimantan file lists (the builder checks the same)', () => {
    const peat = read('ka-data/peat_persistence_kalteng.json');
    const sites = (peat.districts as { top_sites: { lon: number; lat: number }[] }[]).flatMap((d) => d.top_sites);
    expect(sites.length).toBeGreaterThan(0);
    expect(sites.filter((s) => !m.has(s.lon, s.lat))).toEqual([]);
  });
});
