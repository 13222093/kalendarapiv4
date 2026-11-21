// KalenderApi (new file): tests of lib/fixedheat.ts (the mask of known fixed heat sources behind "not a land fire").
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { FixedKind } from './burnsites.ts';
import { FIXED_HEAT_FILE, FIXED_HEAT_FORMAT, asFixedHeat, fixedCellKey } from './fixedheat.ts';

const COLS = 36000;
type Lists = Record<FixedKind, number[]>;
/** Cell numbers in any order -> the file's list: the first cell, then the differences. */
const enc = (keys: number[]) => keys.slice().sort((a, b) => a - b).map((k, i, all) => (i ? k - all[i - 1]! : k));
/** A mask file with the given cells per kind; `over` replaces or adds fields. */
const fileOf = (kinds: Lists, over: Record<string, unknown> = {}) => ({
  format: FIXED_HEAT_FORMAT, cell_deg: 0.01, cols: COLS, origin: { lat: -90, lon: -180 },
  period: { first_year: 2021, last_year: 2025 }, min_detections: 3,
  cells: kinds.volcano.length + kinds.static.length + kinds.offshore.length,
  kinds: { volcano: enc(kinds.volcano), static: enc(kinds.static), offshore: enc(kinds.offshore) },
  source: { citation: 'NASA FIRMS standard-processing archive, attribute "type"' },
  ...over,
});

describe('fixedCellKey', () => {
  it('counts rows from -90 and columns from -180 in steps of 0.01 degree', () => {
    expect(fixedCellKey(-90, -180)).toBe(0);
    expect(fixedCellKey(-2.005, 113.005)).toBe(8799 * COLS + 29300);
    expect(fixedCellKey(-2.845, 113.785)).toBe(313769378);         // the same cell as in the peat mask
  });
  it('gives the known places the cell numbers the pipeline printed for them', () => {
    expect(fixedCellKey(-1.2427, 116.8156)).toBe(319529681);       // Balikpapan refinery flare
    expect(fixedCellKey(-2.576, 121.3815)).toBe(314742138);        // Sorowako
    expect(fixedCellKey(-3.8712, 122.4009)).toBe(310062240);       // Morosi
    expect(fixedCellKey(-1.4577, 127.4363)).toBe(318774743);       // Obi
    expect(fixedCellKey(-8.2741, 123.5062)).toBe(294222350);       // Lewotolok
  });
  it('puts a point on a cell edge into the cell to the north and east, whatever the float rounding', () => {
    expect(fixedCellKey(0, 110)).toBe(9000 * COLS + 29000);
    expect(fixedCellKey(1.23, 101.45)).toBe(9123 * COLS + 28145);  // 91.23 / 0.01 is not exactly 9123 in floats
  });
});

describe('asFixedHeat on a hand-made mask', () => {
  // Three lone cells, one of each kind, far from each other.
  const S = fixedCellKey(-1.005, 117.005), V = fixedCellKey(-8.275, 123.505), O = fixedCellKey(-1.245, 116.815);
  // X is empty: two volcano cells (west, north) and one static cell (south-east) around it.
  const X = fixedCellKey(2.005, 100.005);
  // Y is empty, between a static cell (west) and a volcano cell (east). Z is empty, between volcano and offshore.
  const Y = fixedCellKey(3.005, 100.005), Z = fixedCellKey(4.005, 100.005);
  // W is an offshore cell with a static cell on either side.
  const W = fixedCellKey(5.005, 100.005);
  const m = asFixedHeat(fileOf({
    static: [S, X - COLS + 1, Y - 1, W - 1, W + 1],
    volcano: [V, X - 1, X + COLS, Y + 1, Z - 1],
    offshore: [O, Z + 1, W],
  }))!;

  it('decodes the lists and says what it was built from', () => {
    expect(m).not.toBeNull();
    expect(m.cells).toBe(13);
    expect(m.period).toBe('2021–2025');
    expect(m.source).toBe('NASA FIRMS standard-processing archive, attribute "type"');
  });
  it('at: the kind of the cell the place falls in, each kind', () => {
    expect(m.at(117.005, -1.005)).toBe('static');
    expect(m.at(123.505, -8.275)).toBe('volcano');
    expect(m.at(116.815, -1.245)).toBe('offshore');
    expect(m.at(117.0099, -1.0001)).toBe('static');                // anywhere in the cell, not only its centre
    expect(m.at(117.0, -1.01)).toBe('static');                     // the south-west corner belongs to the cell
  });
  it('at is null one cell away, near is not: all eight cells around a source', () => {
    for (const dLat of [-0.01, 0, 0.01]) {
      for (const dLon of [-0.01, 0, 0.01]) {
        if (!dLat && !dLon) continue;
        expect(m.at(117.005 + dLon, -1.005 + dLat)).toBeNull();
        expect(m.near(117.005 + dLon, -1.005 + dLat)).toBe('static');
      }
    }
    expect(m.near(123.515, -8.265)).toBe('volcano');
    expect(m.near(116.805, -1.245)).toBe('offshore');
  });
  it('a point two cells away gives null, for at and for near', () => {
    for (const [lon, lat] of [[117.025, -1.005], [116.985, -1.005], [117.005, -0.985], [117.005, -1.025], [117.025, -1.025]] as const) {
      expect(m.at(lon, lat)).toBeNull();
      expect(m.near(lon, lat)).toBeNull();
    }
  });
  it('near takes the most common kind among the eight neighbours', () => {
    expect(m.at(100.005, 2.005)).toBeNull();
    expect(m.near(100.005, 2.005)).toBe('volcano');                // two volcano cells against one static
  });
  it('near settles a tie: static, then volcano, then offshore', () => {
    expect(m.near(100.005, 3.005)).toBe('static');                 // one static, one volcano
    expect(m.near(100.005, 4.005)).toBe('volcano');                // one volcano, one offshore
  });
  it('near gives the cell its own kind, whatever is around it', () => {
    expect(m.at(100.005, 5.005)).toBe('offshore');
    expect(m.near(100.005, 5.005)).toBe('offshore');
  });
  it('is null far from every source, off the grid and for no number', () => {
    for (const [lon, lat] of [[110, -5], [117.005, 91], [181, -1.005], [-181, -1.005], [Number.NaN, -1.005], [117.005, Number.POSITIVE_INFINITY]] as const) {
      expect(m.at(lon, lat)).toBeNull();
      expect(m.near(lon, lat)).toBeNull();
    }
  });
  it('takes longitude first: the same numbers the other way round are another place', () => {
    expect(m.at(117.005, -1.005)).toBe('static');
    expect(m.at(-1.005, 117.005)).toBeNull();
    expect(m.near(-1.005, 117.005)).toBeNull();
  });
  it('reads a file with one kind only, and one without a period or a source block', () => {
    const one = asFixedHeat(fileOf({ static: [], volcano: [V], offshore: [] }, { period: undefined, source: undefined }))!;
    expect(one.cells).toBe(1);
    expect(one.at(123.505, -8.275)).toBe('volcano');
    expect(one.period).toBe('');
    expect(one.source).toBe('NASA FIRMS standard archive, attribute "type"');
    expect(asFixedHeat(fileOf({ static: [S], volcano: [], offshore: [] }, { period: { first_year: 2025, last_year: 2025 }, source: 'A line' }))).toMatchObject({ period: '2025', source: 'A line' });
  });
});

describe('asFixedHeat on a body that is not the file', () => {
  const A = fixedCellKey(-1.005, 117.005);
  const ok: Lists = { static: [A, A + 5], volcano: [A + 9], offshore: [] };
  it('reads the well-formed one (so the cases below fail for their own reason)', () => {
    expect(asFixedHeat(fileOf(ok))!.cells).toBe(3);
  });
  it('is null for a page, a string, an empty object or another format', () => {
    expect(asFixedHeat(null)).toBeNull();
    expect(asFixedHeat('<!doctype html>')).toBeNull();
    expect(asFixedHeat({})).toBeNull();
    expect(asFixedHeat(fileOf(ok, { format: 'ka-peat-mask-1' }))).toBeNull();
  });
  it('is null for another grid, since the key is for this grid only', () => {
    expect(asFixedHeat(fileOf(ok, { cell_deg: 0.05 }))).toBeNull();
    expect(asFixedHeat(fileOf(ok, { cols: 7200 }))).toBeNull();
    expect(asFixedHeat(fileOf(ok, { origin: { lat: 0, lon: 0 } }))).toBeNull();
  });
  it('is null for lists that are missing, not whole numbers, not rising or off the grid', () => {
    expect(asFixedHeat(fileOf(ok, { kinds: undefined }))).toBeNull();
    expect(asFixedHeat(fileOf(ok, { kinds: { static: [A], volcano: [A + 9] }, cells: 2 }))).toBeNull();          // no offshore list
    expect(asFixedHeat(fileOf(ok, { kinds: { static: [A, '5'], volcano: [A + 9], offshore: [] } }))).toBeNull();
    expect(asFixedHeat(fileOf(ok, { kinds: { static: [A + 0.5, 5], volcano: [A + 9], offshore: [] } }))).toBeNull();
    expect(asFixedHeat(fileOf(ok, { kinds: { static: [A, 0], volcano: [A + 9], offshore: [] } }))).toBeNull();   // the same cell twice
    expect(asFixedHeat(fileOf(ok, { kinds: { static: [A, -3], volcano: [A + 9], offshore: [] } }))).toBeNull();
    expect(asFixedHeat(fileOf(ok, { kinds: { static: [18000 * COLS], volcano: [], offshore: [] }, cells: 1 }))).toBeNull();
    expect(asFixedHeat(fileOf(ok, { kinds: { static: [-1], volcano: [], offshore: [] }, cells: 1 }))).toBeNull();
  });
  it('is null when a cell is in two kinds', () => {
    expect(asFixedHeat(fileOf(ok, { kinds: { static: [A, 5], volcano: [A + 5], offshore: [] } }))).toBeNull();
  });
  it('is null when the cell count is not what the lists hold (a cut-off file), or when there is no cell', () => {
    expect(asFixedHeat(fileOf(ok, { cells: 4 }))).toBeNull();
    expect(asFixedHeat(fileOf(ok, { cells: undefined }))).toBeNull();
    expect(asFixedHeat(fileOf({ static: [], volcano: [], offshore: [] }))).toBeNull();
  });
});

describe('the real mask (public/ka-data/fixed_heat_idn.json)', () => {
  const file = JSON.parse(readFileSync(new URL(`../../public/${FIXED_HEAT_FILE}`, import.meta.url), 'utf8')) as Record<string, unknown>;
  const lists = file.kinds as Lists;
  const m = asFixedHeat(file)!;
  it('is read, and its cell count is the number of cells its lists hold', () => {
    expect(m).not.toBeNull();
    expect(m.cells).toBe(lists.volcano.length + lists.static.length + lists.offshore.length);
    expect(m.cells).toBe(file.cells);
    expect(m.cells).toBeGreaterThan(300);                          // hundreds or low thousands: sources, not land fire
    expect(m.cells).toBeLessThan(5000);
    for (const k of ['volcano', 'static', 'offshore'] as const) expect(lists[k].length).toBeGreaterThan(0);
  });
  it('says which years and which data it was built from', () => {
    expect(m.period).toMatch(/^20\d\d–20\d\d$/);
    expect(Number(m.period.slice(0, 4))).toBeGreaterThanOrEqual(2021);   // nothing older is read
    expect(m.source).toContain('NASA FIRMS');
    expect(m.source).toContain('"type"');
    expect(m.source).toContain('MODIS');
    expect(m.source).toContain('VIIRS');
    expect(file.min_detections).toBeGreaterThanOrEqual(2);
    expect(String(file.rule)).toContain(`${String(file.min_detections)} or more detections`);
  });
  it('finds the places seen on 7 of 7 days that are not land fire', () => {
    expect(['offshore', 'static']).toContain(m.near(116.8156, -1.2427));   // Balikpapan refinery flare, on the shore
    expect(m.near(121.3815, -2.576)).toBe('static');               // Sorowako nickel smelter
    expect(m.near(122.4009, -3.8712)).toBe('static');              // Morosi nickel smelters
    expect(m.near(127.4363, -1.4577)).toBe('static');              // Obi nickel smelter
    expect(m.near(123.5062, -8.2741)).toBe('volcano');             // Lewotolok
    for (const [lon, lat] of [[116.8156, -1.2427], [121.3815, -2.576], [122.4009, -3.8712], [127.4363, -1.4577], [123.5062, -8.2741]] as const) {
      expect(m.at(lon, lat)).not.toBeNull();                       // each is in the mask itself, not only next to it
    }
  });
  it('does not find ordinary places: peat swamp, peat of Riau, towns, open sea', () => {
    for (const [lon, lat] of [
      [113.79, -2.85],      // peat swamp, Pulang Pisau
      [102.2, 1.5],         // Riau peat area
      [113.70, -2.60],      // Sebangau
      [102.60, 0.40],       // Kampar peninsula
      [113.92, -2.21],      // Palangka Raya
      [107.6098, -6.9147],  // Bandung
      [110.0, -5.0],        // Java Sea
      [128.0, -6.0],        // Banda Sea
      [105.0, -9.5],        // Indian Ocean
    ] as const) {
      expect(m.at(lon, lat)).toBeNull();
      expect(m.near(lon, lat)).toBeNull();
    }
  });
  it('near finds every cell that at finds, with the same kind', () => {
    let key = 0, n = 0;
    for (const step of lists.static) {
      key += step;
      const lat = (Math.floor(key / COLS) + 0.5) * 0.01 - 90, lon = ((key % COLS) + 0.5) * 0.01 - 180;
      expect(fixedCellKey(lat, lon)).toBe(key);                    // the centre of a cell is in the cell
      expect(m.at(lon, lat)).toBe('static');
      expect(m.near(lon, lat)).toBe('static');
      n += 1;
    }
    expect(n).toBe(lists.static.length);
  });
});
