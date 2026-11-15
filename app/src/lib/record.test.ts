// Project 4 (new file): checks of lib/record.ts against Second Sight's definitions (beforeafter.ts, bulan.ts) and the
// project 4 data contract (obs_class null or not listed in obs_months = "not computed", never "unobserved").
// The rows below are a made-up test fixture for the arithmetic only; they are never shown by the app.
import { describe, expect, it } from 'vitest';
import {
  EXTRA_WINDOWS, KALTENG, NOT_AREA, PROJECT_LINE, aoiName, beforeAfter, clampRange, districtAt, emberStep, heldRange, hotspotCsv, lockedMonths, lowDataNote,
  monthName, monthVerdict, monthlyCsv, noInterval, obsState, pointInGeometry, pooledRatio, rangeLabel, rangeMonths, rangeTotals, rawSpliced,
  sameMonths, sameMonthsCsv, searchDistricts, seasonWindow, seasonsInRange, sensorRatio, testStatus, windowsInRange,
  type AoiEntry, type DistrictIndex, type MonthRow, type SeasonPoints,
} from './record';

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

describe('noInterval and pooledRatio', () => {
  it('flags VIIRS months without an interval, not Aqua months (their own count)', () => {
    const aqua = row(2019, 9, { H: 100, H_lo: 100, H_hi: 100, A_raw: 100, sensor_used: 'Aqua' });
    const snppBand = row(2023, 9, { H: 50, H_lo: 40, H_hi: 60, V_raw: 250, sensor_used: 'SNPP' });
    const snppPooled = row(2023, 10, { H: 50, H_lo: 50, H_hi: 50, V_raw: 250, sensor_used: 'SNPP' });
    expect(noInterval(aqua)).toBe(false);
    expect(noInterval(snppBand)).toBe(false);
    expect(noInterval(snppPooled)).toBe(true);
    expect(noInterval(row(2023, 2, { H: 0, H_lo: 0, H_hi: 0, V_raw: 0, sensor_used: 'SNPP' }))).toBe(false);   // a true zero
    expect(pooledRatio([aqua, snppBand, snppPooled])).toEqual({ ratio: 0.2, from: 2023 });
    expect(pooledRatio([aqua, snppBand])).toBeNull();
    const ba = beforeAfter([row(2003, 9, { A_raw: 1, H: 1 }), aqua, snppPooled])!;
    expect(ba.points.find((p) => p.year === 2023)!.noBand).toBe(true);
    expect(ba.points.find((p) => p.year === 2019)!.noBand).toBe(false);
  });
});

describe('testStatus', () => {
  it('keeps "not applicable" apart from "not run"', () => {
    const t = { test_id: 'V3', metric: 'm', value: null };
    expect(testStatus({ ...t, passed: null, status: 'not_applicable' })).toBe('na');
    expect(testStatus({ ...t, passed: null, status: 'not_run' })).toBe('not_run');
    expect(testStatus({ ...t, passed: false, status: 'run' })).toBe('fail');
    expect(testStatus({ ...t, passed: null, status: 'run' })).toBe('info');
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

// ---------------------------------------------------------------- a picked range, the same months, the files
// (made-up rows again: 2014 to 2017, Aug to Oct, plus a still-running month; never shown by the app)

describe('clampRange', () => {
  it('keeps a range inside the record, swaps a reversed one, and refuses a bad or outside one', () => {
    expect(clampRange('2015-08', '2015-10', '2000-11', '2026-11')).toEqual({ from: '2015-08', to: '2015-10' });
    expect(clampRange('2015-10', '2015-08', '2000-11', '2026-11')).toEqual({ from: '2015-08', to: '2015-10' });
    expect(clampRange('1999-01', '2001-02', '2000-11', '2026-11')).toEqual({ from: '2000-11', to: '2001-02' });
    expect(clampRange('2026-10', '2030-01', '2000-11', '2026-11')).toEqual({ from: '2026-10', to: '2026-11' });
    expect(clampRange('2015-08', null, '2000-11', '2026-11')).toBeNull();
    expect(clampRange('2015-13', '2015-10', '2000-11', '2026-11')).toBeNull();
    expect(clampRange('1990-01', '1990-12', '2000-11', '2026-11')).toBeNull();
    expect(rangeMonths({ from: '2014-11', to: '2015-02' })).toBe(4);
  });
  it('names a range in English and in Indonesian', () => {
    expect(rangeLabel({ from: '2015-08', to: '2015-10' })).toBe('August to October 2015');
    expect(rangeLabel({ from: '2014-11', to: '2015-02' })).toBe('November 2014 to February 2015');
    expect(rangeLabel({ from: '2015-09', to: '2015-09' })).toBe('September 2015');
    expect(rangeLabel({ from: '2015-08', to: '2015-10' }, 'id')).toBe('Agustus sampai Oktober 2015');
    expect(monthName('2015-10', 'id')).toBe('Oktober 2015');
  });
});

const season = (y: number, h: number, extra: Partial<MonthRow> = {}): MonthRow[] => [8, 9, 10].map((m) =>
  row(y, m, { H: h, H_lo: h - 1, H_hi: h + 2, A_raw: h, V_raw: y >= 2012 ? h * 5 : null, sensor_used: 'Aqua', ...extra }));
const RANGE_ROWS: MonthRow[] = [
  ...season(2014, 10), ...season(2015, 100), ...season(2016, 20), ...season(2017, 30),
  row(2018, 8, { H: 40, H_lo: 39, H_hi: 42, V_raw: 200, sensor_used: 'SNPP', flag_nrt: true }),
  row(2018, 9, { H: 5, H_lo: 4, H_hi: 7, V_raw: 25, sensor_used: 'SNPP', flag_nrt: true, flag_partial: true }),
];

describe('rangeTotals', () => {
  it('sums the monthly record and its monthly bounds over the range, and nothing else', () => {
    const t = rangeTotals(RANGE_ROWS, { from: '2015-08', to: '2015-10' });
    expect(t.months).toBe(3);
    expect(t.withH).toBe(3);
    expect(t.H).toBe(300);
    expect(t.lo).toBe(297);
    expect(t.hi).toBe(306);
    expect(t.raw).toBe(1500);   // VIIRS from 2012 (5 x 100 a month)
    expect(t.provisional).toEqual([]);
  });
  it('lists provisional and partial months, and counts the months without a value', () => {
    const t = rangeTotals(RANGE_ROWS, { from: '2018-07', to: '2018-09' });
    expect(t.months).toBe(3);
    expect(t.withH).toBe(2);        // July 2018 is not in the record
    expect(t.H).toBe(45);
    expect(t.provisional).toEqual(['2018-08']);
    expect(t.partial).toEqual(['2018-09']);
    expect(rangeTotals(RANGE_ROWS, { from: '2010-01', to: '2010-03' }).H).toBeNull();
  });
});

describe('sameMonths', () => {
  it('totals the same calendar months in every year, ranks the picked period and compares it to the median', () => {
    const s = sameMonths(RANGE_ROWS, { from: '2015-08', to: '2015-10' })!;
    expect(s.periods.map((p) => p.label)).toEqual(['2014', '2015', '2016', '2017', '2018']);
    expect(s.periods.map((p) => p.H)).toEqual([30, 300, 60, 90, 45]);
    expect(s.picked!.start).toBe('2015-08');
    expect(s.rank).toBe(1);
    expect(s.of).toBe(4);              // 2018 has a missing and a still-running month: not ranked, not in the median
    expect(s.median).toBe(75);         // of 30, 60, 90, 300
    expect(s.ratio).toBeCloseTo(4);
    const p2018 = s.periods.find((p) => p.label === '2018')!;
    expect(p2018.complete).toBe(false);
    expect(p2018.partial).toBe(true);
    expect(sameMonths(RANGE_ROWS, { from: '2016-08', to: '2016-10' })!.rank).toBe(3);
  });
  it('does not rank an incomplete picked period, and is null for more than 12 months', () => {
    const s = sameMonths(RANGE_ROWS, { from: '2018-08', to: '2018-10' })!;
    expect(s.rank).toBeNull();
    expect(s.ratio).toBeNull();
    expect(sameMonths(RANGE_ROWS, { from: '2014-08', to: '2015-10' })).toBeNull();
  });
  it('follows months across a new year', () => {
    const rows = [row(2014, 12, { H: 1 }), row(2015, 1, { H: 2 }), row(2015, 12, { H: 10 }), row(2016, 1, { H: 20 })];
    const s = sameMonths(rows, { from: '2015-12', to: '2016-01' })!;
    expect(s.periods.filter((p) => p.complete).map((p) => [p.label, p.H])).toEqual([['2014 to 2015', 3], ['2015 to 2016', 30]]);
    expect(s.rank).toBe(1);
  });
});

describe('the months a registered test covers', () => {
  const ck: AoiEntry = { aoi_id: KALTENG, file: 'x.json' };
  const district: AoiEntry = { aoi_id: 'kab-test', file: 'x.json', level: 'district', locked_months: ['2019-08', '2019-09'] };
  it('holds back the rank for Central Kalimantan in January to October 2019, and for the locked months of a district', () => {
    expect(heldRange(ck, { from: '2019-08', to: '2019-10' })).toBe(true);
    expect(heldRange(ck, { from: '2018-11', to: '2019-01' })).toBe(true);
    expect(heldRange(ck, { from: '2019-11', to: '2019-12' })).toBe(false);
    expect(heldRange(ck, { from: '2015-08', to: '2015-10' })).toBe(false);
    expect(heldRange({ aoi_id: 'prov-riau', file: 'x.json' }, { from: '2019-08', to: '2019-10' })).toBe(false);
    expect(heldRange(district, { from: '2019-09', to: '2019-12' })).toBe(true);
    expect(heldRange(district, { from: '2019-10', to: '2019-12' })).toBe(false);
    expect(lockedMonths(ck).size).toBe(10);
  });
});

describe('CSV files', () => {
  const meta = { area: 'Test area, east', aoiId: 'TEST', unit: 'fire cell-days', dataVersion: 'abc123', generated: '2026-11-15', notes: ['District values are approximate.'] };
  const r = { from: '2015-08', to: '2015-10' };
  it('starts the monthly file with # lines, then one header row and one row a month', () => {
    const lines = monthlyCsv(RANGE_ROWS, r, meta, null).trimEnd().split('\r\n');
    const comments = lines.filter((l) => l.startsWith('#'));
    expect(comments[0]).toBe(`# ${PROJECT_LINE}`);
    expect(comments).toContain('# Area: Test area, east (TEST)');
    expect(comments).toContain('# Range: 2015-08 to 2015-10 (3 months, inclusive)');
    expect(comments).toContain('# Unit: fire cell-days');
    expect(comments).toContain('# Data version: abc123');
    expect(comments).toContain('# Generated: 2026-11-15');
    expect(comments).toContain('# District values are approximate.');
    expect(comments).toContain(`# ${NOT_AREA}`);
    expect(comments.some((l) => l.startsWith('# Method: '))).toBe(true);
    const body = lines.filter((l) => !l.startsWith('#'));
    expect(body[0]!.split(',').slice(0, 7)).toEqual(['month', 'year', 'month_of_year', 'harmonized', 'harmonized_lo90', 'harmonized_hi90', 'raw_stitched']);
    expect(body).toHaveLength(4);
    expect(body[1]).toBe('2015-08,2015,8,100,99,102,500,100,,500,,Aqua,0,0,not_computed');
    expect(lines.every((l) => !/project 4|Second Sight/.test(l))).toBe(true);
  });
  it('writes the same-months table with the rank of the picked period, or without it when the months are held', () => {
    const same = sameMonths(RANGE_ROWS, r)!;
    const open = sameMonthsCsv(same, r, meta);
    expect(open).toContain('# Picked period 2015-08 to 2015-10: rank 1 of 4 complete periods (1 = most fire); median 75; ratio to the median 4');
    expect(open).toContain('\r\n2015-08,2015-10,300,297,306,1500,1,0,0,1\r\n');
    expect(open).toContain('\r\n2018-08,2018-10,45,43,49,225,0,1,1,0\r\n');
    const held = sameMonthsCsv(same, r, meta, true);
    expect(held).not.toContain('rank 1 of');
    expect(held).toContain('a registered test covers those months');
  });
  it('writes the detections of the built seasons inside the range, as published', () => {
    const file: SeasonPoints = {
      source: { product: 'VIIRS S-NPP 375 m', sha256: 'f00', url: 'https://example.test/v.csv', filter_text: 'box' },
      bbox: [110.7, -3.6, 115.9, 0.9], bbox_note: 'A box, not the province polygon.',
      days: [{ date: '2015-07-31', pts: [[1, 2, 3, 0]] }, { date: '2015-08-01', pts: [[113.5, -2.25, 12.5, 1], [114, -2, 3, 0]] }, { date: '2015-11-01', pts: [[9, 9, 9, 0]] }],
    };
    const csv = hotspotCsv([file], r, '2026-11-15');
    const body = csv.trimEnd().split('\r\n').filter((l) => !l.startsWith('#'));
    expect(body).toEqual(['acq_date,longitude,latitude,frp_mw,daynight', '2015-08-01,113.5,-2.25,12.5,N', '2015-08-01,114,-2,3,D']);
    expect(csv).toContain('# Area: A box, not the province polygon.');
    expect(csv).toContain('not burned area');
    expect(seasonsInRange([2015, 2019, 2023], r)).toEqual([2015]);
    expect(seasonsInRange([2015, 2019, 2023], { from: '2015-11', to: '2019-07' })).toEqual([]);
    expect(seasonsInRange([2015, 2019, 2023], { from: '2015-10', to: '2023-08' })).toEqual([2015, 2019, 2023]);
  });
});

// ---------------------------------------------------------------- districts (a tiny made-up index, in this test only)

describe('districts', () => {
  const index: DistrictIndex = {
    approximate: true, method: 'test',
    districts: [
      { aoi_id: 'kab-kapuas', name: 'Kapuas', province: 'Kalimantan Tengah', province_aoi: KALTENG, level: 'district', file: 'districts/monthly_kab-kapuas.json', low_data: false },
      { aoi_id: 'kab-kapuas-hulu', name: 'Kapuas Hulu', province: 'Kalimantan Barat', province_aoi: 'prov-kalimantan-barat', level: 'district', file: 'districts/monthly_kab-kapuas-hulu.json', low_data: false },
      { aoi_id: 'kab-kota-palangka-raya', name: 'Kota Palangka Raya', province: 'Kalimantan Tengah', province_aoi: KALTENG, level: 'district', file: 'districts/monthly_kab-kota-palangka-raya.json', low_data: true, mean_cell_days_per_year: 12.34 },
    ],
  };
  it('finds a kabupaten or kota by name, grouped under its province', () => {
    const g = searchDistricts(index.districts, 'kapuas');
    expect(g.map((x) => [x.province, x.items.map((d) => d.aoi_id)])).toEqual([['Kalimantan Tengah', ['kab-kapuas']], ['Kalimantan Barat', ['kab-kapuas-hulu']]]);
    expect(searchDistricts(index.districts, 'Kabupaten Kapuas Hulu')[0]!.items[0]!.aoi_id).toBe('kab-kapuas-hulu');
    expect(searchDistricts(index.districts, 'palangka')[0]!.items[0]!.aoi_id).toBe('kab-kota-palangka-raya');
    expect(searchDistricts(index.districts, 'kalimantan tengah').flatMap((x) => x.items)).toHaveLength(2);
    expect(searchDistricts(index.districts, 'zzz')).toEqual([]);
    expect(searchDistricts(index.districts, '  ')).toEqual([]);
  });
  it('gives the low data note only for a flagged district, and a name in either language', () => {
    expect(lowDataNote(index.districts[0]!)).toBeNull();
    expect(lowDataNote(index.districts[2]!)).toContain('12.3 a year');
    expect(lowDataNote(index.districts[2]!, 'id')).toContain('12,3 per tahun');
    expect(aoiName({ aoi_id: 'x', file: 'f', name_en: 'Central Kalimantan', name_id: 'Kalimantan Tengah' })).toBe('Central Kalimantan');
    expect(aoiName({ aoi_id: 'x', file: 'f', name_en: 'Central Kalimantan', name_id: 'Kalimantan Tengah' }, 'id')).toBe('Kalimantan Tengah');
  });
  it('picks the district whose outline holds a point (holes and several parts included)', () => {
    const square = (x: number, y: number, w: number) => [[x, y], [x + w, y], [x + w, y + w], [x, y + w], [x, y]];
    const shapes = { features: [
      { properties: { aoi_id: 'kab-a', name: 'A' }, geometry: { type: 'Polygon', coordinates: [square(0, 0, 10), square(4, 4, 2)] } },
      { properties: { aoi_id: 'kab-b', name: 'B' }, geometry: { type: 'MultiPolygon', coordinates: [[square(20, 0, 2)], [square(30, 0, 2)]] } },
    ] };
    expect(districtAt(1, 1, shapes)).toBe('kab-a');
    expect(districtAt(5, 5, shapes)).toBeNull();          // in the hole
    expect(districtAt(31, 1, shapes)).toBe('kab-b');
    expect(districtAt(25, 1, shapes)).toBeNull();         // between the two parts
    expect(pointInGeometry(1, 1, null)).toBe(false);
  });
});

describe('held months of a district', () => {
  // 2019 Aug and Sep were not computed (null), October has a value; 2018 is whole
  const locked = new Set(['2019-08', '2019-09']);
  const rows = [
    ...season(2017, 10), ...season(2018, 20),
    row(2019, 8, {}), row(2019, 9, {}), row(2019, 10, { H: 7, H_lo: 6, H_hi: 8, V_raw: 35, sensor_used: 'SNPP' }),
    ...season(2020, 30),
  ];
  it('keeps them out of the total and lists them, never as zero', () => {
    const t = rangeTotals(rows, { from: '2019-08', to: '2019-10' }, locked);
    expect(t.held).toEqual(['2019-08', '2019-09']);
    expect(t.withH).toBe(1);
    expect(t.H).toBe(7);
    expect(rangeTotals(rows, { from: '2019-08', to: '2019-09' }, locked).H).toBeNull();
    expect(rangeTotals(rows, { from: '2018-08', to: '2018-10' }, locked).held).toEqual([]);
  });
  it('keeps their period out of the rank and the median, and says why', () => {
    const s = sameMonths(rows, { from: '2018-08', to: '2018-10' }, locked)!;
    const p2019 = s.periods.find((p) => p.label === '2019')!;
    expect(p2019.held).toBe(true);
    expect(p2019.complete).toBe(false);
    expect(s.of).toBe(3);               // 2017, 2018, 2020
    expect(s.median).toBe(60);
    expect(s.rank).toBe(2);
    expect(sameMonths(rows, { from: '2019-08', to: '2019-10' }, locked)!.rank).toBeNull();
    expect(s.periods.find((p) => p.label === '2018')!.held).toBe(false);
  });
});

describe('point files', () => {
  it('finds the built files with a month inside the range', () => {
    const ws = [seasonWindow(2015), ...EXTRA_WINDOWS, seasonWindow(2023)];
    expect(seasonWindow(2015)).toEqual({ key: '2015', year: 2015, from: '2015-08', to: '2015-10' });
    expect(windowsInRange(ws, { from: '2023-01', to: '2023-12' }).map((w) => w.key)).toEqual(['2023_janmar', '2023']);
    expect(windowsInRange(ws, { from: '2015-10', to: '2015-10' }).map((w) => w.key)).toEqual(['2015']);
    expect(windowsInRange(ws, { from: '2016-01', to: '2022-12' })).toEqual([]);
  });
});
