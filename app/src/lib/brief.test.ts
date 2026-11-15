// KalenderApi (new file): checks of lib/brief.ts, the numbers of the printable brief (#/brief).
// The rows and files below are a made-up test fixture for the arithmetic only; they are never shown by the app.
import { describe, expect, it } from 'vitest';
import type { AoiEntry, DistrictIndex, MonthRow, RecordIndex } from './record';
import {
  blindCount, blindPct, compact, dateWords, firstKey, hasVisibility, isLockedArea, isLockedMonth, isPulangPisau,
  latestCompleteKey, latestMonth, listWords, lockedMonths, monthYear, monthlyMedians, num, num1, peakMonths,
  readBlindRule, reportedPairs, resolveArea, seasonBlind, seasonCount, slug, times, worstYears, type VisFile,
} from './brief';

function row(year: number, month: number, p: Partial<MonthRow>): MonthRow {
  return {
    aoi_id: 'TEST', year, month, H: null, H_lo: null, H_hi: null, A_raw: null, T_raw: null, V_raw: null, N20_raw: null,
    sensor_used: null, baseline_median: null, pct_rank: null, obs_class: null, flag_nrt: false, flag_partial: false,
    agreement: null, ...p,
  };
}

const index: RecordIndex = {
  aois: [
    { aoi_id: 'IDN', name: 'Indonesia', name_en: 'Indonesia', level: 'national', file: 'monthly_IDN.json' },
    { aoi_id: 'prov-kalimantan-tengah', name: 'Kalimantan Tengah', name_id: 'Kalimantan Tengah', name_en: 'Central Kalimantan', level: 'province', file: 'monthly_prov-kalimantan-tengah.json' },
    { aoi_id: 'prov-riau', name: 'Riau', level: 'province', file: 'monthly_prov-riau.json' },
  ],
};
const district = (p: Partial<AoiEntry> & { aoi_id: string; name: string }): AoiEntry => ({ level: 'district', file: `districts/monthly_${p.aoi_id}.json`, ...p });
const districts: DistrictIndex = {
  approximate: true,
  districts: [
    district({ aoi_id: 'kab-pulang-pisau', name: 'Pulang Pisau', province: 'Kalimantan Tengah', province_aoi: 'prov-kalimantan-tengah', low_data: false,
      ...({ locked_months: ['2019-02', '2019-01', '2019-10'] } as object) }),
    district({ aoi_id: 'kab-siak', name: 'Siak', province: 'Riau', province_aoi: 'prov-riau', low_data: true, mean_cell_days_per_year: 12 }),
  ],
};

describe('words and numbers', () => {
  it('writes numbers with each language\'s separators', () => {
    expect(num(52341.4, 'en')).toBe('52,341');
    expect(num(52341.4, 'id')).toBe('52.341');
    expect(num1(7.71, 'en')).toBe('7.7');
    expect(num1(7.71, 'id')).toBe('7,7');
  });
  it('gives a ratio more decimals when it is small', () => {
    expect(times(12.4, 'en')).toBe('12');
    expect(times(7.71, 'en')).toBe('7.7');
    expect(times(0.254, 'id')).toBe('0,25');
  });
  it('shortens the bar labels only', () => {
    expect(compact(388, 'en')).toBe('388');
    expect(compact(7234.5, 'en')).toBe('7.2k');
    expect(compact(10445.5, 'id')).toBe('10 rb');
    expect(compact(1_234_567, 'id')).toBe('1,2 jt');
  });
  it('names months, dates and lists in both languages', () => {
    expect(monthYear('2026-10', 'en')).toBe('October 2026');
    expect(monthYear('2026-10', 'id')).toBe('Oktober 2026');
    expect(dateWords('2026-11-14T11:02:40+00:00', 'id')).toBe('14 November 2026');
    expect(dateWords('2026-11-14', 'en')).toBe('14 November 2026');
    expect(dateWords('not a date', 'en')).toBeNull();
    expect(listWords(['August', 'September', 'October'], 'en')).toBe('August, September and October');
    expect(listWords(['Agustus', 'September'], 'id')).toBe('Agustus dan September');
    expect(listWords(['September'], 'id')).toBe('September');
  });
  it('matches district names across files', () => {
    expect(slug('Kota Palangka Raya')).toBe('palangkaraya');
    expect(slug('Kabupaten Pulang Pisau')).toBe('pulangpisau');
    expect(slug('Kotawaringin Barat')).toBe('kotawaringinbarat');   // "Kota" is part of the name here
  });
});

describe('resolveArea', () => {
  it('opens Central Kalimantan when the address names no area', () => {
    expect(resolveArea(null, index, null)?.aoi.aoi_id).toBe('prov-kalimantan-tengah');
  });
  it('finds an area of the main index, with both names', () => {
    const a = resolveArea('prov-kalimantan-tengah', index, districts)!;
    expect(a.isDistrict).toBe(false);
    expect(a.name).toBe('Kalimantan Tengah');
    expect(a.nameEn).toBe('Central Kalimantan');
    expect(hasVisibility(a)).toBe(true);
    expect(isLockedArea(a)).toBe(true);
  });
  it('finds a district once the district index is built, with its province and its low-data mark', () => {
    expect(resolveArea('kab-siak', index, null)).toBeNull();
    const a = resolveArea('kab-siak', index, districts)!;
    expect(a.isDistrict).toBe(true);
    expect(a.province).toBe('Riau');
    expect(a.lowData).toBe(true);
    expect(hasVisibility(a)).toBe(false);
    expect(isLockedArea(a)).toBe(false);
  });
  it('knows Central Kalimantan\'s districts: visibility data, and the locked months of the district index', () => {
    const a = resolveArea('kab-pulang-pisau', index, districts)!;
    expect(a.provinceEn).toBe('Central Kalimantan');
    expect(hasVisibility(a)).toBe(true);
    expect(isPulangPisau(a)).toBe(true);
    expect(isLockedArea(a)).toBe(true);
    expect(lockedMonths(a)).toEqual(['2019-01', '2019-02', '2019-10']);
  });
  it('never guesses an area it does not know', () => {
    expect(resolveArea('kab-nowhere', index, districts)).toBeNull();
  });
  it('marks the locked window', () => {
    expect(isLockedMonth(2019, 10)).toBe(true);
    expect(isLockedMonth(2019, 11)).toBe(false);
    expect(isLockedMonth(2018, 9)).toBe(false);
  });
});

describe('monthlyMedians and peakMonths', () => {
  const med = [1, 2, 3, 4, 5, 10, 40, 100, 80, 50, 6, 1];
  const rows = med.map((m, i) => row(2020, i + 1, { H: 1, baseline_median: m }));
  it('reads the bundle\'s own median of each calendar month', () => {
    const m = monthlyMedians(rows)!;
    expect(m).toHaveLength(12);
    expect(m[7]).toEqual({ month: 8, median: 100 });
  });
  it('makes no median of its own when the bundle has none for a month', () => {
    expect(monthlyMedians(rows.filter((r) => r.month !== 3))).toBeNull();
    expect(monthlyMedians([...rows.filter((r) => r.month !== 3), row(2020, 3, { H: 9 })])).toBeNull();
  });
  it('names the months with at least half of the highest median', () => {
    expect(peakMonths(monthlyMedians(rows)!)).toEqual([8, 9, 10]);
  });
  it('names no peak when nothing burns', () => {
    expect(peakMonths(rows.map((r) => ({ month: r.month, median: 0 })))).toEqual([]);
  });
});

describe('worstYears', () => {
  const rows: MonthRow[] = [];
  const total: Record<number, number> = { 2003: 10, 2004: 30, 2005: 20, 2015: 90, 2019: 70, 2023: 60, 2026: 80 };
  for (const [y, h] of Object.entries(total)) {
    const year = Number(y);
    rows.push(row(year, 9, {
      H: h, H_lo: year >= 2022 ? h - 5 : h, H_hi: year >= 2022 ? h + 5 : h,
      sensor_used: year >= 2022 ? 'SNPP' : 'Aqua', flag_nrt: year === 2026,
    }));
  }
  it('ranks the highest years on the harmonized scale', () => {
    const w = worstYears(rows, 3)!;
    expect(w.years.map((y) => y.year)).toEqual([2015, 2026, 2019]);
    expect(w.years[0]).toMatchObject({ H: 90, estimate: false, provisional: false });
    expect([w.from, w.to]).toEqual([2003, 2026]);
    expect(w.skipped).toEqual([]);
  });
  it('marks a converted year as an estimate with its range, and a near-real-time year as provisional', () => {
    const y2026 = worstYears(rows, 3)!.years[1]!;
    expect(y2026).toMatchObject({ estimate: true, provisional: true, lo: 75, hi: 85, months: 1 });
  });
  it('does not rank a year with a month that has no value (the locked months of a district file)', () => {
    const w = worstYears([...rows, row(2019, 3, { H: null })], 3)!;
    expect(w.years.map((y) => y.year)).toEqual([2015, 2026, 2023]);
    expect(w.skipped).toEqual([2019]);
  });
  it('leaves out the years the caller excludes', () => {
    const w = worstYears(rows, 2, [2015])!;
    expect(w.years.map((y) => y.year)).toEqual([2026, 2019]);
    expect(w.skipped).toEqual([2015]);
  });
  it('is null without a record', () => {
    expect(worstYears([], 3)).toBeNull();
  });
});

describe('latestMonth', () => {
  const rows = [
    row(2001, 10, { H: 40, baseline_median: 50, sensor_used: 'Terra' }),
    row(2015, 10, { H: 400, baseline_median: 50, sensor_used: 'Aqua' }),
    row(2019, 10, { H: 60, baseline_median: 50, sensor_used: 'Aqua' }),
    row(2026, 9, { H: 70, baseline_median: 20, sensor_used: 'SNPP', flag_nrt: true }),
    row(2026, 10, { H: 200, H_lo: 180, H_hi: 215, baseline_median: 50, sensor_used: 'SNPP', flag_nrt: true }),
    row(2026, 11, { H: 5, baseline_median: 10, sensor_used: 'NOAA20', flag_nrt: true, flag_partial: true }),
  ];
  it('skips the month that is still filling in', () => {
    expect(latestCompleteKey(rows)).toBe('2026-10');
    expect(firstKey(rows)).toBe('2001-10');
  });
  it('gives the ratio to the median of the same month, the rank and the flags', () => {
    const l = latestMonth(rows)!;
    expect(l.verdict.key).toBe('2026-10');
    expect(l.verdict.ratio).toBeCloseTo(4);
    expect(l.median).toBe(50);
    expect([l.verdict.rank, l.verdict.of]).toEqual([2, 4]);
    expect([l.firstYear, l.lastYear]).toEqual([2001, 2026]);
    expect(l.verdict.provisional).toBe(true);
    expect(l.estimate).toBe(true);
  });
  it('says nothing for a locked area whose latest complete month is inside the locked window', () => {
    const old = rows.filter((r) => r.year <= 2019);
    expect(latestMonth(old, false)!.verdict.key).toBe('2019-10');
    expect(latestMonth(old, true)).toBeNull();
  });
  it('is null without a harmonized month', () => {
    expect(latestMonth([row(2026, 10, { H: null })])).toBeNull();
  });
});

describe('seasonBlind', () => {
  const vis: VisFile = {
    districts: [{ name: 'Kapuas', T: 900, U: 100 }, { name: 'Kota Palangka Raya', T: 450, U: 50 }, { name: 'Pulang Pisau', T: 1000, U: 333 }],
    days: [{ date: '2015-08-02' }, { date: '2015-08-01' }, { date: '2015-10-31' }],
  };
  it('rounds the share as "Blind zeros by district" does', () => {
    expect(blindPct(900, 100)).toBe(10);
    expect(blindPct(1000, 333)).toBe(25);          // 24.98 -> 25.0
    expect(blindPct(443050, 31867)).toBe(6.7);
    expect(blindPct(0, 0)).toBeNull();
  });
  it('totals the province over its districts', () => {
    const s = seasonBlind(vis, null)!;
    expect(s.pct).toBe(blindPct(2350, 483));
    expect(s).toMatchObject({ year: 2015, days: 3, from: '2015-08-01', to: '2015-10-31' });
  });
  it('finds one district by name, whatever its prefix', () => {
    expect(seasonBlind(vis, 'Pulang Pisau')!.pct).toBe(25);
    expect(seasonBlind(vis, 'Palangka Raya')!.pct).toBe(10);
    expect(seasonBlind(vis, 'Siak')).toBeNull();
  });
  it('is null for a file without days or districts', () => {
    expect(seasonBlind({ districts: [], days: [{ date: '2015-08-01' }] }, null)).toBeNull();
    expect(seasonBlind({ districts: vis.districts, days: [] }, null)).toBeNull();
  });
});

describe('readBlindRule and blindCount', () => {
  it('reads a total and per-district counts', () => {
    const r = readBlindRule({
      threshold: 0.5, seasons: [2015, 2023],
      total: { district_days_above: 41, district_days: 2576 },
      districts: [{ name: 'Pulang Pisau', district_days_above: 7, district_days: 184 }],
    })!;
    expect(r.threshold).toBe(0.5);
    expect(r.seasons).toEqual([2015, 2023]);
    expect(blindCount(r, null)).toEqual({ above: 41, of: 2576, seasons: [2015, 2023] });
    expect(blindCount(r, 'Kabupaten Pulang Pisau')).toEqual({ above: 7, of: 184, seasons: [2015, 2023] });
    expect(blindCount(r, 'Kapuas')).toBeNull();
  });
  it('leaves a locked season out only when the file splits its counts by season', () => {
    const split = readBlindRule({
      threshold: 50,
      seasons: [
        { year: 2015, total: { district_days_above: 10, district_days: 1288 }, districts: { Kapuas: { district_days_above: 2, district_days: 92 } } },
        { year: 2019, total: { district_days_above: 30, district_days: 1288 }, districts: { Kapuas: { district_days_above: 9, district_days: 92 } } },
        { year: 2023, total: { district_days_above: 5, district_days: 1288 }, districts: { Kapuas: { district_days_above: 1, district_days: 92 } } },
      ],
      total: { district_days_above: 45, district_days: 3864 },
    })!;
    expect(split.threshold).toBe(0.5);
    expect(blindCount(split, null)).toEqual({ above: 45, of: 3864, seasons: [2015, 2019, 2023] });
    expect(blindCount(split, null, [2019])).toEqual({ above: 15, of: 2576, seasons: [2015, 2023] });
    expect(blindCount(split, 'Kapuas', [2019])).toEqual({ above: 3, of: 184, seasons: [2015, 2023] });
    const sumOnly = readBlindRule({ seasons: [2015, 2019, 2023], total: { district_days_above: 45 } })!;
    expect(blindCount(sumOnly, null)).toEqual({ above: 45, of: null, seasons: [2015, 2019, 2023] });
    expect(blindCount(sumOnly, null, [2019])).toBeNull();
  });
  it('reads the file as the visibility run writes it: seasons with their own counts, the locked season absent', () => {
    const r = readBlindRule({
      threshold: 0.5, seasons_included: ['2015', '2023'], excluded: { season: '2019' },
      total: { seasons: 2, district_days_above: 76, district_days: 2576, share_pct: 3 },
      districts: [{ name: 'Barito Selatan', district_days_above: 5, district_days: 184, share_pct: 2.7 }],
      seasons: [
        { year: 2015, season: '2015', days: 92, district_days_above: 37, district_days: 1288, districts: [{ name: 'Barito Selatan', district_days_above: 2, district_days: 92 }] },
        { year: 2023, season: '2023', days: 92, district_days_above: 39, district_days: 1288, districts: [{ name: 'Barito Selatan', district_days_above: 3, district_days: 92 }] },
      ],
    })!;
    expect(r.seasons).toEqual([2015, 2023]);
    expect(blindCount(r, null, [2019])).toEqual({ above: 76, of: 2576, seasons: [2015, 2023] });
    expect(blindCount(r, 'Barito Selatan', [2019])).toEqual({ above: 5, of: 184, seasons: [2015, 2023] });
    expect(seasonCount(r, 2015, null)).toEqual({ above: 37, of: 1288 });
    expect(seasonCount(r, 2023, 'Barito Selatan')).toEqual({ above: 3, of: 92 });
    expect(seasonCount(r, 2019, null)).toBeNull();
    expect(seasonCount(r, 2015, 'Kapuas')).toBeNull();
  });
  it('is null for a file with no count it can find', () => {
    expect(readBlindRule({ rule: 'some words', seasons: [2015] })).toBeNull();
    expect(readBlindRule(null)).toBeNull();
    expect(readBlindRule('text')).toBeNull();
  });
});

describe('reportedPairs', () => {
  const rows = [2015, 2016, 2026].map((y) => row(y, 9, { H: y - 2000, flag_nrt: y === 2026 }));
  it('puts each verified official figure beside the record\'s own yearly total', () => {
    const pairs = reportedPairs({ years: [
      { year: 2016, burned_area_ha: 6148.42 }, { year: 2015, burned_area_ha: 583833.44 },
      { year: 2025, burned_area_ha: null }, { year: 2014, burned_area_ha: 100 },
    ] }, rows);
    expect(pairs).toEqual([
      { year: 2014, ha: 100, cellDays: null, provisional: false },
      { year: 2015, ha: 583833.44, cellDays: 15, provisional: false },
      { year: 2016, ha: 6148.42, cellDays: 16, provisional: false },
    ]);
  });
});
