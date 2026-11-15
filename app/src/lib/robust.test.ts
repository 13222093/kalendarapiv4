// Fourth round: checks of lib/robust.ts. The yearly totals below are a made-up test fixture for the arithmetic only;
// they are never shown by the app. The last block checks the stored El Nino file itself.
import { describe, expect, it } from 'vitest';
import enso from '../../public/ka-data/enso_oni.json';
import type { YearPoint } from './record';
import { WINDOW_ACROSS_SEAM, WINDOW_EARLY, WINDOW_RECENT } from './windows';
import {
  ACROSS, CONVERTED_FROM, EARLY, LATE, STATUS_CUTS, elNinoYears, headline, lineMakeup, monthStatus, ownYears, pctChange,
  reading, robustness, seamFails, variants, yearSource, yearTotals, yearsText, type EnsoFile, type YearTotal,
} from './robust';

/** 2003 to 2023: MODIS 100 a year (300 in 2004 and 2023); VIIRS five times MODIS from 2012; harmonized = MODIS to 2021,
 *  then 1.2 x MODIS (a converted value that does not land on MODIS's own count). */
function fixture(): YearTotal[] {
  const out: YearTotal[] = [];
  for (let y = 2003; y <= 2023; y += 1) {
    const modis = y === 2004 || y === 2023 ? 300 : 100;
    out.push({ year: y, modis, raw: y < 2012 ? modis : modis * 5, harm: y < CONVERTED_FROM ? modis : modis * 1.2, provisional: false });
  }
  return out;
}

describe('windows', () => {
  it('uses the shared windows of lib/windows.ts', () => {
    expect(LATE).toBe(WINDOW_RECENT);
    expect(EARLY).toBe(WINDOW_EARLY);
    expect(ACROSS).toBe(WINDOW_ACROSS_SEAM);
  });
  it('the headline window ends before conversion starts; the second reading crosses it', () => {
    expect(LATE[1]).toBeLessThan(CONVERTED_FROM);
    expect(ACROSS[1]).toBeGreaterThanOrEqual(CONVERTED_FROM);
  });
});

describe('yearTotals', () => {
  it('reads MODIS alone from the chart points: the stitched record to 2011, added together minus stitched from 2012', () => {
    const p = (year: number, rawNaive: number, rawSummed: number, rawH: number) =>
      ({ year, rawNaive, rawSummed, rawH, provisional: false } as YearPoint);
    const t = yearTotals([p(2011, 40, 40, 40), p(2012, 200, 245, 45), p(2022, 36, 42, 7)]);
    expect(t.map((x) => x.modis)).toEqual([40, 45, 6]);
    expect(t.map((x) => x.raw)).toEqual([40, 200, 36]);
    expect(t.map((x) => x.harm)).toEqual([40, 45, 7]);
  });
});

describe('pctChange', () => {
  const t = fixture();
  it('is the mean of the late years over the mean of the early years', () => {
    // early 2003 to 2007: (100 + 300 + 100 + 100 + 100) / 5 = 140; late 2019 to 2021: 100
    expect(pctChange(t, 'modis', [2019, 2020, 2021], [2003, 2004, 2005, 2006, 2007])).toBeCloseTo((100 / 140 - 1) * 100, 10);
    // raw late is VIIRS: 500
    expect(pctChange(t, 'raw', [2019, 2020, 2021], [2003, 2004, 2005, 2006, 2007])).toBeCloseTo((500 / 140 - 1) * 100, 10);
  });
  it('gives no number for a missing year, a window of one year, or an early mean of zero', () => {
    expect(pctChange(t, 'harm', [2019, 2030], [2003, 2004])).toBeNull();
    expect(pctChange(t, 'harm', [2019], [2003, 2004])).toBeNull();
    const zero = t.map((x) => ({ ...x, harm: 0 }));
    expect(pctChange(zero, 'harm', [2019, 2020], [2003, 2004])).toBeNull();
  });
});

describe('variants', () => {
  it('the headline, across the seam, and the headline without El Nino years', () => {
    const v = variants([2002, 2004, 2015, 2018, 2023]);
    expect(v.map((x) => x.id)).toEqual(['headline', 'across-seam', 'no-el-nino']);
    expect(v[0]).toMatchObject({ late: [2017, 2018, 2019, 2020, 2021], early: [2003, 2004, 2005, 2006, 2007], dropped: [] });
    expect(v[1]).toMatchObject({ late: [2019, 2020, 2021, 2022, 2023], early: [2003, 2004, 2005, 2006, 2007], dropped: [] });
    expect(v[2]).toMatchObject({ late: [2017, 2019, 2020, 2021], early: [2003, 2005, 2006, 2007], dropped: [2004, 2018] });
  });
  it('leaves the El Nino comparison out when there is no list', () => {
    expect(variants(null).map((x) => x.id)).toEqual(['headline', 'across-seam']);
  });
  it('the headline uses no converted year; the second reading uses two', () => {
    const v = variants(null);
    expect(ownYears(v[0]!.late)).toBe(v[0]!.late.length);
    expect(v[1]!.late.length - ownYears(v[1]!.late)).toBe(2);
  });
});

describe('robustness, headline and reading', () => {
  it('computes each series for each comparison', () => {
    const r = robustness(fixture(), [2004, 2023]);
    // headline: late 2017 to 2021 = 100, early 140; the harmonized line is MODIS's own count, so the two are one number
    expect(r[0]!.harm).toBeCloseTo((100 / 140 - 1) * 100, 10);
    expect(r[0]!.harm).toBe(r[0]!.modis);
    expect(r[0]!.raw).toBeCloseTo((500 / 140 - 1) * 100, 10);
    // across the seam: harmonized late = (100 + 100 + 100 + 120 + 360) / 5 = 156; MODIS alone = 140
    expect(r[1]!.harm).toBeCloseTo((156 / 140 - 1) * 100, 10);
    expect(r[1]!.modis).toBeCloseTo(0, 10);
    // without 2004 (2023 is not in the headline windows): early 100, late 100
    expect(r[2]!.dropped).toEqual([2004]);
    expect(r[2]!.harm).toBeCloseTo(0, 10);
  });
  it('the headline is the first comparison', () => {
    expect(headline(fixture())).toEqual(robustness(fixture(), null)[0]);
  });
  it('says whether the direction holds, and the spread', () => {
    const r = robustness(fixture(), [2004, 2023]);
    const raw = reading(r, 'raw')!;
    expect(raw.sameDirection).toBe(true);
    expect(raw.sign).toBe(1);
    expect(raw.n).toBe(3);
    expect(raw.min).toBeLessThan(raw.max);
    // harmonized: -28.6% headline, +11.4% across the seam, 0% without El Nino years: the direction does not hold
    const harm = reading(r, 'harm')!;
    expect(harm.sameDirection).toBe(false);
    expect(harm.sign).toBe(0);
  });
  it('a zero change is not a direction, and one number is not a comparison', () => {
    const r = robustness(fixture(), [2004, 2023]);
    expect(reading(r, 'modis')!.sameDirection).toBe(false);   // -28.6%, 0%, 0%
    expect(reading(r.slice(0, 1), 'harm')).toBeNull();
  });
});

describe('lineMakeup', () => {
  it('finds MODIS own count before conversion starts', () => {
    const m = lineMakeup(fixture());
    expect(m).toEqual({ ownCount: true, ownTo: 2021, convertedFrom: 2022 });
    expect(yearSource(fixture().find((t) => t.year === 2015)!, m)).toBe('own');
    expect(yearSource(fixture().find((t) => t.year === 2022)!, m)).toBe('converted');
  });
  it('does not claim own count when a year before conversion differs', () => {
    const t = fixture().map((x) => (x.year === 2010 ? { ...x, harm: x.modis + 3 } : x));
    const m = lineMakeup(t);
    expect(m.ownCount).toBe(false);
    expect(yearSource(t.find((x) => x.year === 2010)!, m)).toBe('unknown');
  });
});

describe('seamFails', () => {
  const row = (metric: string, passed: boolean | null, status = 'run') => ({ test_id: 'V3', metric, passed, status });
  it('reads the main-series seam row of the chosen method at the year given', () => {
    const v = { meta: { chosen_method: 'M3' }, results: [
      row('seam 2022-01 SNPP x kappa M0/main', false), row('seam 2022-01 SNPP x kappa M3/switch2012', true),
      row('seam 2022-01 SNPP x kappa M3/main', false), row('seam 2012-01 MODIS->VIIRS overlap M3/main', null, 'not_applicable'),
    ] };
    expect(seamFails(v, 2022)).toBe(true);
    expect(seamFails(v, 2012)).toBeNull();   // not applicable: no claim
    expect(seamFails({ meta: null, results: [row('seam 2022-01 SNPP x kappa M3/main', true)] }, 2022)).toBe(false);
  });
  it('makes no claim without the file or the row', () => {
    expect(seamFails(null, 2022)).toBeNull();
    expect(seamFails({ meta: null, results: [] }, 2022)).toBeNull();
  });
});

describe('monthStatus', () => {
  it('reads the label from the rank among earlier years, with the cuts stated on screen', () => {
    expect(STATUS_CUTS).toEqual([0.25, 0.75, 0.9]);
    expect(monthStatus(0)).toBe('below');
    expect(monthStatus(0.2499)).toBe('below');
    expect(monthStatus(0.25)).toBe('near');
    expect(monthStatus(0.7499)).toBe('near');
    expect(monthStatus(0.75)).toBe('above');
    expect(monthStatus(0.8999)).toBe('above');
    expect(monthStatus(0.9)).toBe('far-above');
    expect(monthStatus(1)).toBe('far-above');
  });
  it('gives no label without a rank', () => {
    expect(monthStatus(null)).toBeNull();
    expect(monthStatus(undefined)).toBeNull();
    expect(monthStatus(Number.NaN)).toBeNull();
  });
});

describe('yearsText', () => {
  it('writes runs as ranges', () => {
    expect(yearsText([2003, 2004, 2005, 2006, 2007])).toBe('2003 to 2007');
    expect(yearsText([2003, 2005, 2006, 2007])).toBe('2003, 2005 to 2007');
    expect(yearsText([2023, 2004])).toBe('2004, 2023');
    expect(yearsText([2019, 2020])).toBe('2019, 2020');
    expect(yearsText([2003, 2004, 2005], 'sampai')).toBe('2003 sampai 2005');
  });
});

describe('the stored El Nino file (public/ka-data/enso_oni.json)', () => {
  const f = enso as unknown as EnsoFile;
  it('names its source, address, the day it was read and the rule', () => {
    expect(f.source).toMatch(/NOAA Climate Prediction Center/);
    expect(f.url).toMatch(/^https:\/\/www\.cpc\.ncep\.noaa\.gov\//);
    expect(f.accessed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(f.rule.length).toBeGreaterThan(10);
    expect(f.season).toBe('JAS');
    expect(f.threshold).toBe(0.5);
  });
  it('its list of years is its rule applied to its own index values', () => {
    expect(elNinoYears(f)).toEqual(f.el_nino_years);
  });
  it('covers every year of the windows compared', () => {
    for (const [a, b] of [WINDOW_EARLY, WINDOW_RECENT, WINDOW_ACROSS_SEAM]) {
      for (let y = a; y <= b; y += 1) expect(typeof f.jas_oni[String(y)]).toBe('number');
    }
  });
  it('gives no list for a file without index values', () => {
    expect(elNinoYears(null)).toBeNull();
    expect(elNinoYears({ ...f, jas_oni: {} })).toBeNull();
  });
});
