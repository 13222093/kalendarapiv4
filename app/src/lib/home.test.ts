import { describe, expect, it } from 'vitest';
import {
  GLOBE_DISC, HOME_MENU, NOW_DISTRICT, driftStep, furthestAbove, globeZoom, highest, latestFullMonth, linePath, markRadius, niceMax, nowAt,
  peatFacts, provinceMark, provincePositions, recordAt, ribbon, ribbonMove, sectionOf, sensorYears, stillXY, timesDigits, toneOf, type ProvinceMark,
} from './home';
import type { AoiEntry, MonthRow } from './record';

const row = (year: number, month: number, H: number | null, extra: Partial<MonthRow> = {}): MonthRow => ({
  aoi_id: 'prov-x', year, month, H, H_lo: H, H_hi: H, A_raw: H, T_raw: null, V_raw: null, N20_raw: null, sensor_used: 'Aqua',
  baseline_median: null, pct_rank: null, obs_class: null, flag_nrt: false, flag_partial: false, agreement: null, ...extra,
});
const district = (id: string, prov: string, centroid: [number, number], area?: number): AoiEntry =>
  ({ aoi_id: id, file: `districts/monthly_${id}.json`, province_aoi: prov, centroid, area_km2: area });
const mark = (id: string, H: number, ratio: number | null): ProvinceMark =>
  ({ id, nameEn: id, nameId: id, lon: 0, lat: 0, year: 2026, month: 10, H, median: null, ratio, tone: toneOf(ratio), provisional: false });

describe('home menu', () => {
  it('names the pages by what the challenge asks, and opens the record at a section', () => {
    expect(HOME_MENU.map((m) => m.en)).toEqual(['Home', 'Today', 'Harmonize', 'Fire calendar', 'Date range', 'Zero under cloud', 'District brief', 'Method and data']);
    expect(nowAt(NOW_DISTRICT)).toBe('#/now?aoi=kab-pulang-pisau');
    expect(recordAt('IDN', 'calendar')).toBe('#/record?aoi=IDN&sec=calendar');
    expect(recordAt('prov-riau')).toBe('#/record?aoi=prov-riau');
    expect(sectionOf('#/record?aoi=IDN&sec=calendar')).toBe('calendar');
    expect(sectionOf('#/record?aoi=IDN')).toBeNull();
    expect(sectionOf('#/record?sec=a"b')).toBeNull();
  });
});

describe('province markers', () => {
  it('places a province at the area-weighted mean of its districts', () => {
    const pos = provincePositions([
      district('a', 'prov-x', [100, 0], 300), district('b', 'prov-x', [104, 4], 100),
      district('c', 'prov-y', [120, -8]), district('d', 'prov-y', [122, -6]),
      { aoi_id: 'e', file: 'f' },
    ]);
    expect(pos.get('prov-x')).toEqual([101, 1]);
    expect(pos.get('prov-y')).toEqual([121, -7]);
    expect(pos.size).toBe(2);
  });
  it('takes the latest month that is not still filling in', () => {
    const rows = [row(2026, 9, 5), row(2026, 10, 7, { flag_nrt: true }), row(2026, 11, 1, { flag_partial: true }), row(2026, 12, null)];
    expect(latestFullMonth(rows)).toEqual({ year: 2026, month: 10 });
    expect(latestFullMonth([])).toBeNull();
  });
  it('compares the month with the median of the same month and classes it', () => {
    const rows = [row(2024, 10, 10), row(2025, 10, 30), row(2026, 10, 60, { baseline_median: 20, flag_nrt: true })];
    const m = provinceMark({ aoi_id: 'prov-x', file: 'f', name_en: 'X', name_id: 'Eks' }, rows, [101, 1], { year: 2026, month: 10 })!;
    expect(m).toMatchObject({ id: 'prov-x', nameEn: 'X', nameId: 'Eks', lon: 101, lat: 1, H: 60, ratio: 3, median: 20, tone: 'up', provisional: true });
    expect(provinceMark({ aoi_id: 'prov-x', file: 'f' }, rows, undefined, { year: 2026, month: 10 })).toBeNull();
    expect(provinceMark({ aoi_id: 'prov-x', file: 'f' }, rows, [0, 0], { year: 2020, month: 1 })).toBeNull();
  });
  it('is neutral near normal, and unknown without a median', () => {
    expect(toneOf(1)).toBe('near');
    expect(toneOf(1.25)).toBe('near');
    expect(toneOf(1.3)).toBe('up');
    expect(toneOf(0.8)).toBe('near');
    expect(toneOf(0.5)).toBe('down');
    expect(toneOf(null)).toBe('unknown');
  });
  it('sizes a marker by the square root of its count', () => {
    expect(markRadius(0, 100)).toBe(4);
    expect(markRadius(100, 100)).toBe(15);
    expect(markRadius(25, 100)).toBe(9.5);
    expect(markRadius(5, 0)).toBe(4);
  });
  it('lists the highest counts and the provinces furthest above their median', () => {
    const marks = [mark('a', 10, 0.5), mark('b', 300, 1.2), mark('c', 40, 6), mark('d', 90, null), mark('e', 5, 2)];
    expect(highest(marks, 2).map((m) => m.id)).toEqual(['b', 'd']);
    expect(furthestAbove(marks, 5).map((m) => m.id)).toEqual(['c', 'e', 'b']);
    expect(timesDigits(2.34)).toBe(1);
    expect(timesDigits(12.6)).toBe(0);
  });
});

describe('the three yearly records', () => {
  const year = (y: number, extra: (m: number) => Partial<MonthRow> = () => ({})) =>
    Array.from({ length: 12 }, (_, i) => row(y, i + 1, 10, extra(i + 1)));
  it('keeps complete, final years and leaves a sensor out of a year it did not cover', () => {
    const rows = [
      row(2000, 11, 3), row(2000, 12, 3),
      ...year(2011),
      ...year(2012, () => ({ V_raw: 50 })),
      ...year(2026, (m) => ({ flag_nrt: m > 6 })),
    ];
    expect(sensorYears(rows)).toEqual([
      { year: 2011, harm: 120, modis: 120, viirs: null },
      { year: 2012, harm: 120, modis: 120, viirs: 600 },
    ]);
  });
  it('breaks a line at a missing value and at a gap in the years', () => {
    const x = (y: number) => (y - 2010) * 10, y = (v: number) => 100 - v;
    expect(linePath([2010, 2011, 2012, 2014], [1, null, 3, 4], x, y)).toBe('M0,99 M20,97 M40,96');
    expect(linePath([2010, 2011, 2012], [1, 2, 3], x, y)).toBe('M0,99 L10,98 L20,97');
  });
  it('rounds the axis up to a round number', () => {
    expect(niceMax(163872)).toBe(200000);
    expect(niceMax(4200)).toBe(5000);
    expect(niceMax(100)).toBe(100);
    expect(niceMax(0)).toBe(1);
  });
});

describe('the globe', () => {
  it('fits the disc inside its box', () => {
    const z = globeZoom(560, 0.9);
    const radius = (512 * 2 ** z) / (2 * Math.PI);
    expect(radius * 2 * GLOBE_DISC).toBeGreaterThan(560 * 0.89);
    expect(radius * 2 * GLOBE_DISC).toBeLessThan(560 * 0.91);
  });
  it('places a point on the still picture', () => {
    expect(stillXY(94, 8)).toEqual({ left: 0, top: 0 });
    expect(stillXY(142, -12)).toEqual({ left: 100, top: 100 });
    expect(stillXY(118, -2)).toEqual({ left: 50, top: 50 });
  });
  it('drifts and turns back at the edges of the window', () => {
    const step = driftStep(118, 1, 1000);
    expect(step.lng).toBeCloseTo(119.2, 6);
    expect(step.dir).toBe(1);
    expect(driftStep(131.9, 1, 1000)).toEqual({ lng: 132, dir: -1 });
    expect(driftStep(104.1, -1, 1000)).toEqual({ lng: 104, dir: 1 });
  });
});

describe('the calendar ribbon', () => {
  const rows = [
    row(2000, 11, 3), row(2000, 12, 3),
    row(2011, 1, 100, { baseline_median: 50 }), row(2011, 2, 0),
    row(2012, 1, 100, { V_raw: 500 }), row(2012, 2, null, { A_raw: null, V_raw: null }),
    row(2013, 1, 40, { V_raw: 200, flag_nrt: true }),
  ];
  const r = ribbon(rows);
  it('starts at the first year with a January and keeps the definitions of the record page', () => {
    expect(r.years).toEqual([2011, 2012, 2013]);
    expect(r.max).toBe(500);
    expect(r.seam).toBe(2012);
    expect(r.cells.has('2000-11')).toBe(false);
    expect(r.cells.get('2011-01')).toMatchObject({ raw: 100, harm: 100, rawSensor: 'MODIS', times: 2, provisional: false });
    expect(r.cells.get('2012-01')).toMatchObject({ raw: 500, harm: 100, rawSensor: 'VIIRS', stepRaw: 9 });
    expect(r.cells.get('2013-01')).toMatchObject({ raw: 200, harm: 40, provisional: true });
  });
  it('colours both views on one scale: the same value has the same step', () => {
    const a = r.cells.get('2011-01')!, b = r.cells.get('2012-01')!;
    expect(a.stepRaw).toBe(a.stepHarm);
    expect(b.stepHarm).toBe(a.stepHarm);
    expect(b.stepRaw!).toBeGreaterThan(b.stepHarm!);
    expect(r.cells.get('2011-02')).toMatchObject({ stepRaw: 0, stepHarm: 0 });
    expect(r.cells.get('2012-02')).toMatchObject({ stepRaw: null, stepHarm: null });
  });
  it('moves a year sideways and a month up and down, inside the ribbon only', () => {
    const has = (k: string) => r.cells.has(k);
    expect(ribbonMove('2011-01', 'ArrowRight', has)).toBe('2012-01');
    expect(ribbonMove('2011-01', 'ArrowLeft', has)).toBeNull();
    expect(ribbonMove('2011-01', 'ArrowDown', has)).toBe('2011-02');
    expect(ribbonMove('2011-01', 'ArrowUp', has)).toBeNull();
    expect(ribbonMove('2011-01', 'Enter', has)).toBeNull();
  });
});

describe('peat persistence', () => {
  it('reads the totals and refuses another shape', () => {
    expect(peatFacts({ total: { seasons: 11, persistent_peat_sites: 5, come_backs: { total: 9, seen_quiet: 7 } } }))
      .toEqual({ seasons: 11, sites: 5, comeBacks: 9, seenQuiet: 7 });
    expect(peatFacts({ total: { seasons: 11 } })).toBeNull();
    expect(peatFacts(null)).toBeNull();
  });
});
