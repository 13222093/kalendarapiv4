// Project 4 (new file): checks of lib/record.ts against Second Sight's definitions (beforeafter.ts, bulan.ts) and the
// project 4 data contract (obs_class null or not listed in obs_months = "not computed", never "unobserved").
// The rows below are a made-up test fixture for the arithmetic only; they are never shown by the app.
import { describe, expect, it } from 'vitest';
import { beforeAfter, emberStep, monthVerdict, obsState, rawSpliced, sensorRatio, type MonthRow } from './record';

function row(year: number, month: number, p: Partial<MonthRow>): MonthRow {
  return {
    aoi_id: 'TEST', year, month, H: null, H_lo: null, H_hi: null, A_raw: null, T_raw: null, V_raw: null, N20_raw: null,
    sensor_used: null, baseline_median: null, pct_rank: null, obs_class: null, flag_nrt: false, flag_partial: false,
    agreement: null, ...p,
  };
}

describe('rawSpliced', () => {
  it('is MODIS (Aqua, else Terra) to 2011 and VIIRS (S-NPP, else NOAA-20) from 2012', () => {
    expect(rawSpliced(row(2001, 1, { T_raw: 5 }))).toBe(5);
    expect(rawSpliced(row(2011, 1, { A_raw: 7, T_raw: 5, V_raw: 99 }))).toBe(7);
    expect(rawSpliced(row(2012, 1, { A_raw: 7, V_raw: 20 }))).toBe(20);
    expect(rawSpliced(row(2026, 11, { A_raw: 7, N20_raw: 30 }))).toBe(30);
  });
});

describe('beforeAfter', () => {
  // one month a year: MODIS 10 every year; VIIRS 30 from 2012 (three times MODIS); H 10 every year (flat)
  const rows: MonthRow[] = [];
  for (let y = 2003; y <= 2023; y++) rows.push(row(y, 9, { A_raw: 10, V_raw: y >= 2012 ? 30 : null, H: 10, H_lo: 8, H_hi: 12 }));
  const ba = beforeAfter(rows)!;
  it('indexes each line to its own 2003-2011 mean', () => {
    const p2003 = ba.points.find((p) => p.year === 2003)!;
    expect(p2003.naive).toBeCloseTo(100);
    expect(p2003.H).toBeCloseTo(100);
    expect(p2003.lo).toBeCloseTo(80);
    expect(p2003.hi).toBeCloseTo(120);
  });
  it('shows the jump in the stitched line and none in the harmonized one', () => {
    expect(ba.points.find((p) => p.year === 2012)!.naive).toBeCloseTo(300);
    expect(ba.points.find((p) => p.year === 2012)!.summed).toBeCloseTo(400);
    expect(ba.changeNaive).toBeCloseTo(200);   // 2019-23 mean 30 against 2003-07 mean 10
    expect(ba.changeH).toBeCloseTo(0);
  });
  it('marks a provisional year', () => {
    const b = beforeAfter([...rows, row(2026, 1, { A_raw: 1, V_raw: 3, H: 1, flag_nrt: true })])!;
    expect(b.points.find((p) => p.year === 2026)!.provisional).toBe(true);
    expect(b.points.find((p) => p.year === 2023)!.provisional).toBe(false);
  });
});

describe('sensorRatio', () => {
  it('sums VIIRS over MODIS Aqua on the months both report, inside the window', () => {
    const rows = [
      row(2011, 9, { A_raw: 10, V_raw: null }),
      row(2012, 9, { A_raw: 10, V_raw: 25 }),
      row(2013, 9, { A_raw: 30, V_raw: 75 }),
      row(2022, 9, { A_raw: 10, V_raw: 90 }),   // outside 2012-2021
    ];
    const r = sensorRatio(rows, [2012, 2021])!;
    expect(r.ratio).toBeCloseTo(2.5);
    expect(r.months).toBe(2);
    expect(sensorRatio([row(2015, 1, { A_raw: 0, V_raw: 4 })], [2012, 2021])).toBeNull();
  });
});

describe('obsState', () => {
  it('never turns a missing class into "unobserved"', () => {
    expect(obsState(row(2019, 9, { obs_class: null }), null)).toBe('not-computed');
    expect(obsState(row(2019, 9, { obs_class: 'unobserved' }), new Set(['2019-10']))).toBe('not-computed');
    expect(obsState(row(2019, 9, { obs_class: 'unobserved' }), new Set(['2019-09']))).toBe('unobserved');
    expect(obsState(row(2019, 9, { obs_class: 'partial' }), null)).toBe('partial');
  });
});

describe('monthVerdict', () => {
  it('ranks the month among the same calendar month and compares it to the median', () => {
    const rows = [row(2015, 9, { H: 90, baseline_median: 30 }), row(2016, 9, { H: 10 }), row(2019, 9, { H: 60 }), row(2019, 8, { H: 500 })];
    const v = monthVerdict(rows, '2015-09')!;
    expect(v.rank).toBe(1);
    expect(v.of).toBe(3);
    expect(v.ratio).toBeCloseTo(3);
    expect(v.higherThan).toBe(1);
    const w = monthVerdict(rows, '2019-09')!;
    expect(w.rank).toBe(2);
    expect(w.medianFrom).toBe('others');   // no baseline_median: the median of the other Septembers (10, 90) = 50
    expect(w.ratio).toBeCloseTo(1.2);
    expect(monthVerdict(rows, '2020-09')).toBeNull();
  });
});

describe('emberStep', () => {
  it('is 0 for no fire and 9 at the maximum, on a log scale', () => {
    expect(emberStep(0, 1000)).toBe(0);
    expect(emberStep(1000, 1000)).toBe(9);
    expect(emberStep(1, 1000)).toBe(1);
    expect(emberStep(30, 1000)).toBeLessThan(emberStep(300, 1000));
  });
});
