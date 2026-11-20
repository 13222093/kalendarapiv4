// KalenderApi (new file): checks of lib/everyday.ts, the days of the "Every day" calendar: the date grid, the keys,
// reading the daily files, a day's value or the reason it has none, the colour steps and the CSV.
// The index and the area file below are a made-up fixture for the arithmetic only; they are never shown by the app.
import { describe, expect, it } from 'vitest';
import { emberStep } from './record';
import {
  DAILY_FORMAT, DAYS_CSV_COLUMNS, addDays, dateOfDoy, dayInfo, dayLabel, dayStep, daysCsv, daysInMonth, daysInYear, doyOf, fmtDay, isDate, isLeap,
  lastValueDay, monthCode, monthGrid, monthSum, moveDay, noValueWords, prepareDays, rawSensor, seasonDayHref, weekdayMon0, weekdays, yearGrid,
  type DailyFile, type DailyIndex,
} from './everyday';

// 313 months from 2000-11: Terra to 2002-06, Aqua to 2021-12, S-NPP to 2026-10, NOAA-20 for 2026-11
const baseMonths = 'T'.repeat(20) + 'A'.repeat(234) + 'S'.repeat(58) + 'N';
const at = (key: string) => (Number(key.slice(0, 4)) - 2000) * 12 + Number(key.slice(5, 7)) - 11;
function months(patch: Record<string, string>): string {
  const m = baseMonths.split('');
  for (const [k, c] of Object.entries(patch)) m[at(k)] = c;
  return m.join('');
}
const index = (): DailyIndex => ({
  format: DAILY_FORMAT,
  unit: 'fire cell-days a day (test)',
  record: { first_month: '2000-11', last_month: '2026-11', first_day: '2000-11-01', last_day: '2026-11-13' },
  satellites: {
    Aqua: { first_day: '2002-07-04', last_day: '2026-11-13', silent_days: [['2020-08-17', '2020-09-02']] },
    Terra: { first_day: '2000-11-01', last_day: '2026-11-13', silent_days: [['2001-06-16', '2001-06-18']] },
    SNPP: { first_day: '2012-01-20', last_day: '2026-11-02', silent_days: [['2022-07-27', '2022-08-10']] },
    NOAA20: { first_day: '2018-04-01', last_day: '2026-11-13', silent_days: [] },
  },
  provisional_months: ['2026-09', '2026-10', '2026-11'],
  partial_months: ['2026-11'],
  withheld: { from: '2019-01-01', to: '2019-10-31', areas: ['kab-test'] },
});
const file = (): DailyFile => ({
  format: DAILY_FORMAT, aoi_id: 'kab-test', name: 'Test', level: 'district', province_aoi: 'prov-kalimantan-tengah', approximate: true,
  first_month: '2000-11',
  months: months({
    '2005-01': '-', '2006-02': '0',
    '2019-01': 'x', '2019-02': 'x', '2019-03': 'x', '2019-04': 'x', '2019-05': 'x', '2019-06': 'x', '2019-07': 'x', '2019-08': 'x', '2019-09': 'x', '2019-10': 'x',
  }),
  withheld: [['2019-01-01', '2019-10-31']],
  years: {
    2001: { d: [10], h: [3.021], t: [1] },                                             // 10 January: Terra 1, converted
    2015: { d: [258, 259], h: [120, 0], a: [120, 0], t: [40, 2], v: [600, 30] },      // 15 and 16 September
    2020: { d: [230], h: [null], t: [5], v: [50], n: [48] },                           // 17 August: Aqua silent
    2023: { d: [258], h: [25.5], a: [20], v: [120], n: [130] },                        // 15 September: S-NPP 120 x 0.2125
    2026: { d: [306, 310], h: [12.345, 20], a: [9, 7], v: [80, 0], n: [70, 110] },     // 2 and 6 November
  },
});
const area = () => prepareDays(file(), index());

describe('dates', () => {
  it('knows leap years and the lengths of months and years', () => {
    expect([2000, 2004, 2024].every(isLeap)).toBe(true);
    expect([1900, 2019, 2023, 2100].some(isLeap)).toBe(false);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
    expect(daysInMonth(2023, 11)).toBe(30);
    expect(daysInYear(2024)).toBe(366);
    expect(daysInYear(2026)).toBe(365);
  });
  it('turns a day of the year into a date and back', () => {
    expect(dateOfDoy(2015, 258)).toBe('2015-09-15');
    expect(dateOfDoy(2020, 230)).toBe('2020-08-17');
    expect(dateOfDoy(2024, 366)).toBe('2024-12-31');
    expect(doyOf('2015-09-15')).toBe(258);
    expect(doyOf('2024-03-01')).toBe(61);
    for (const y of [2000, 2019, 2024]) for (let d = 1; d <= daysInYear(y); d += 17) expect(doyOf(dateOfDoy(y, d))).toBe(d);
  });
  it('accepts only real dates', () => {
    expect(isDate('2015-09-15')).toBe(true);
    expect(isDate('2023-02-29')).toBe(false);
    expect(isDate('2015-13-01')).toBe(false);
    expect(isDate('2015-9-15')).toBe(false);
    expect(isDate(null)).toBe(false);
  });
  it('counts the weekday from Monday and steps over month and year ends', () => {
    expect(weekdayMon0('2026-11-21')).toBe(5);    // a Saturday
    expect(weekdayMon0('2001-01-01')).toBe(0);    // a Monday
    expect(weekdayMon0('2015-09-13')).toBe(6);    // a Sunday
    expect(addDays('2015-09-30', 1)).toBe('2015-10-01');
    expect(addDays('2016-03-01', -1)).toBe('2016-02-29');
    expect(addDays('2015-01-01', -1)).toBe('2014-12-31');
  });
  it('names seven weekdays, Monday first, in both languages', () => {
    expect(weekdays('en').map((d) => d.long)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    expect(weekdays('id').map((d) => d.long)).toEqual(['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']);
    expect(weekdays('en').map((d) => d.short).join('')).toBe('MTWTFSS');
  });
});

describe('the date grid', () => {
  it('lays a month out in weeks that start on Monday', () => {
    const g = monthGrid(2015, 9);                 // 1 September 2015 was a Tuesday, 30 days
    expect(g.key).toBe('2015-09');
    expect(g.weeks).toHaveLength(5);
    expect(g.weeks.every((w) => w.length === 7)).toBe(true);
    expect(g.weeks[0]).toEqual([null, '2015-09-01', '2015-09-02', '2015-09-03', '2015-09-04', '2015-09-05', '2015-09-06']);
    expect(g.weeks[4]).toEqual(['2015-09-28', '2015-09-29', '2015-09-30', null, null, null, null]);
  });
  it('needs four weeks for February 2021 and six for a long month that starts on a Sunday', () => {
    expect(monthGrid(2021, 2).weeks).toHaveLength(4);     // 1 February 2021: a Monday, 28 days
    expect(monthGrid(2021, 2).weeks.flat().includes(null)).toBe(false);
    expect(monthGrid(2020, 3).weeks).toHaveLength(6);     // 1 March 2020: a Sunday, 31 days
    expect(monthGrid(2020, 3).weeks[0]).toEqual([null, null, null, null, null, null, '2020-03-01']);
  });
  it('holds every day of the year exactly once, in order', () => {
    for (const y of [2000, 2019, 2024, 2026]) {
      const g = yearGrid(y);
      expect(g).toHaveLength(12);
      const all = g.flatMap((m) => m.weeks.flat()).filter((d): d is string => d !== null);
      expect(all).toHaveLength(daysInYear(y));
      expect(all[0]).toBe(`${y}-01-01`);
      expect(all[all.length - 1]).toBe(`${y}-12-31`);
      expect([...all].sort()).toEqual(all);
      // every date sits in the column of its weekday
      for (const m of g) for (const w of m.weeks) w.forEach((d, col) => { if (d) expect(weekdayMon0(d)).toBe(col); });
    }
  });
});

describe('moveDay', () => {
  it('moves a day with the side arrows and a week with the up and down arrows', () => {
    expect(moveDay('2015-09-15', 'ArrowRight')).toBe('2015-09-16');
    expect(moveDay('2015-09-15', 'ArrowLeft')).toBe('2015-09-14');
    expect(moveDay('2015-09-15', 'ArrowDown')).toBe('2015-09-22');
    expect(moveDay('2015-09-15', 'ArrowUp')).toBe('2015-09-08');
    expect(moveDay('2015-09-30', 'ArrowRight')).toBe('2015-10-01');
    expect(moveDay('2015-09-03', 'ArrowUp')).toBe('2015-08-27');
  });
  it('goes to the ends of the month and to the months beside it', () => {
    expect(moveDay('2015-09-15', 'Home')).toBe('2015-09-01');
    expect(moveDay('2015-09-15', 'End')).toBe('2015-09-30');
    expect(moveDay('2015-03-31', 'PageUp')).toBe('2015-02-28');
    expect(moveDay('2024-01-31', 'PageDown')).toBe('2024-02-29');
  });
  it('stays inside the year and ignores other keys', () => {
    expect(moveDay('2015-01-01', 'ArrowLeft')).toBeNull();
    expect(moveDay('2015-12-31', 'ArrowRight')).toBeNull();
    expect(moveDay('2015-01-03', 'ArrowUp')).toBeNull();
    expect(moveDay('2015-12-28', 'ArrowDown')).toBeNull();
    expect(moveDay('2015-01-15', 'PageUp')).toBeNull();
    expect(moveDay('2015-12-15', 'PageDown')).toBeNull();
    expect(moveDay('2015-09-15', 'Enter')).toBeNull();
    expect(moveDay('2015-09-15', 'a')).toBeNull();
  });
});

describe('prepareDays (reading the files)', () => {
  it('indexes the listed days by date and reads a missing column as zero', () => {
    const a = area();
    expect(a.byDate.size).toBe(7);
    expect(a.byDate.get('2015-09-15')).toEqual({ h: 120, a: 120, t: 40, v: 600, n: 0 });
    expect(a.byDate.get('2001-01-10')).toEqual({ h: 3.021, a: 0, t: 1, v: 0, n: 0 });
    expect(a.byDate.get('2020-08-17')?.h).toBeNull();
    expect(a.firstYear).toBe(2000);
    expect(a.lastYear).toBe(2026);
  });
  it('expands the silent runs and keeps the provisional months', () => {
    const a = area();
    expect(a.silent.Aqua.size).toBe(17);
    expect(a.silent.Aqua.has('2020-09-02')).toBe(true);
    expect(a.silent.Aqua.has('2020-09-03')).toBe(false);
    expect(a.silent.NOAA20.size).toBe(0);
    expect(a.provisional.has('2026-10')).toBe(true);
    expect(a.partial.has('2026-11')).toBe(true);
  });
  it('takes the colour scale from the largest day of either series', () => {
    expect(area().max).toBe(600);   // 15 September 2015 as recorded by S-NPP
  });
  it('refuses a file in another format, with unequal columns or with a day outside its year', () => {
    expect(() => prepareDays({ ...file(), format: 'something-else' }, index())).toThrow(/format/);
    expect(() => prepareDays(file(), { ...index(), format: 'other' })).toThrow(/format/);
    expect(() => prepareDays({ ...file(), first_month: '2001-01' }, index())).toThrow(/different months/);
    expect(() => prepareDays({ ...file(), years: { 2015: { d: [258, 259], h: [1] } } }, index())).toThrow(/incomplete/);
    expect(() => prepareDays({ ...file(), years: { 2015: { d: [258], h: [1], a: [1, 2] } } }, index())).toThrow(/different length/);
    expect(() => prepareDays({ ...file(), years: { 2015: { d: [366], h: [1] } } }, index())).toThrow(/not in that year/);
    expect(() => prepareDays({ ...file(), years: { 2015: { d: [0], h: [1] } } }, index())).toThrow(/not in that year/);
    expect(() => prepareDays({ ...file(), months: undefined as unknown as string }, index())).toThrow(/months/);
  });
});

describe('dayInfo: a value, a zero, or the reason there is none', () => {
  const a = area();
  it('reads Aqua\'s own count and the counts of the other sensors', () => {
    const i = dayInfo(a, '2015-09-15');
    expect(i.harm).toEqual({ status: 'value', value: 120, sensor: 'Aqua', converted: false });
    expect(i.raw).toEqual({ status: 'value', value: 600, sensor: 'SNPP' });
    expect(i.counts).toEqual({ Aqua: 120, Terra: 40, SNPP: 600, NOAA20: null });   // NOAA-20 starts in 2018
    expect(i.flying).toEqual(['Aqua', 'Terra', 'SNPP']);
    expect(i.provisional).toBe(false);
  });
  it('gives a zero to a day that is not listed while the sensor was delivering data', () => {
    const i = dayInfo(a, '2015-09-20');
    expect(i.harm).toMatchObject({ status: 'value', value: 0, sensor: 'Aqua' });
    expect(i.raw).toMatchObject({ status: 'value', value: 0, sensor: 'SNPP' });
    expect(i.counts).toEqual({ Aqua: 0, Terra: 0, SNPP: 0, NOAA20: null });
    // listed because another sensor saw fire, the month's sensor none: still a zero
    expect(dayInfo(a, '2015-09-16').harm).toMatchObject({ status: 'value', value: 0 });
  });
  it('marks a converted day (Terra before July 2002, VIIRS from 2022) as approximate', () => {
    expect(dayInfo(a, '2001-01-10').harm).toEqual({ status: 'value', value: 3.021, sensor: 'Terra', converted: true });
    expect(dayInfo(a, '2023-09-15').harm).toEqual({ status: 'value', value: 25.5, sensor: 'SNPP', converted: true });
    expect(dayInfo(a, '2026-11-06').harm).toEqual({ status: 'value', value: 20, sensor: 'NOAA20', converted: true });
  });
  it('has no value outside the sensor\'s first and last day, and outside the record', () => {
    expect(dayInfo(a, '2002-07-02').harm).toMatchObject({ status: 'outside', value: null, sensor: 'Aqua' });   // Aqua starts 4 July
    expect(dayInfo(a, '2026-11-20').harm).toMatchObject({ status: 'outside', value: null, sensor: 'NOAA20' }); // after the last read
    expect(dayInfo(a, '2012-01-10').raw).toMatchObject({ status: 'outside', value: null, sensor: 'SNPP' });    // S-NPP starts 20 January
    expect(dayInfo(a, '2026-11-06').raw).toMatchObject({ status: 'outside', value: null, sensor: 'SNPP' });    // S-NPP read to 2 November
    expect(dayInfo(a, '2000-10-31').harm).toMatchObject({ status: 'outside', value: null, sensor: null });     // before the record
    expect(dayInfo(a, '2026-12-05').raw).toMatchObject({ status: 'outside', value: null, sensor: null });
    expect(dayInfo(a, '2000-10-31').flying).toEqual([]);
  });
  it('has no value on a day the sensor recorded nothing anywhere, listed or not', () => {
    const listed = dayInfo(a, '2020-08-17');
    expect(listed.harm).toMatchObject({ status: 'silent', value: null, sensor: 'Aqua' });
    expect(listed.raw).toMatchObject({ status: 'value', value: 50, sensor: 'SNPP' });
    expect(listed.counts).toEqual({ Aqua: null, Terra: 5, SNPP: 50, NOAA20: 48 });
    expect(dayInfo(a, '2020-08-25').harm.status).toBe('silent');
    expect(dayInfo(a, '2020-09-03').harm).toMatchObject({ status: 'value', value: 0 });
    expect(dayInfo(a, '2001-06-17').harm).toMatchObject({ status: 'silent', sensor: 'Terra' });
    expect(dayInfo(a, '2022-08-01').harm.status).toBe('silent');   // S-NPP, the month's sensor
    expect(dayInfo(a, '2022-08-01').raw.status).toBe('silent');
  });
  it('follows the monthly record where it has no value or a plain zero', () => {
    expect(dayInfo(a, '2005-01-12').harm).toMatchObject({ status: 'no-month', value: null });
    expect(dayInfo(a, '2005-01-12').raw).toMatchObject({ status: 'value', value: 0, sensor: 'Aqua' });
    expect(dayInfo(a, '2006-02-12').harm).toEqual({ status: 'value', value: 0, sensor: null, converted: false });
  });
  it('never gives a value to a withheld day', () => {
    for (const d of ['2019-01-01', '2019-06-15', '2019-10-31']) {
      const i = dayInfo(a, d);
      expect(i.harm).toMatchObject({ status: 'withheld', value: null });
      expect(i.raw).toMatchObject({ status: 'withheld', value: null });
      expect(i.counts).toEqual({ Aqua: null, Terra: null, SNPP: null, NOAA20: null });
    }
    expect(dayInfo(a, '2018-12-31').harm.status).toBe('value');
    expect(dayInfo(a, '2019-11-01').harm).toMatchObject({ status: 'value', value: 0 });
  });
  it('flags near-real-time days and the month still filling in', () => {
    expect(dayInfo(a, '2026-10-05')).toMatchObject({ provisional: true, partial: false });
    expect(dayInfo(a, '2026-11-02')).toMatchObject({ provisional: true, partial: true });
    expect(dayInfo(a, '2025-10-05')).toMatchObject({ provisional: false, partial: false });
  });
  it('stitches the as-recorded series as the monthly record does', () => {
    expect(rawSensor(a, '2001-05')).toBe('Terra');
    expect(rawSensor(a, '2002-07')).toBe('Aqua');
    expect(rawSensor(a, '2011-12')).toBe('Aqua');
    expect(rawSensor(a, '2012-01')).toBe('SNPP');
    expect(rawSensor(a, '2026-11')).toBe('SNPP');
    expect(monthCode(a, '2000-11')).toBe('T');
    expect(monthCode(a, '2026-11')).toBe('N');
    expect(monthCode(a, '2019-10')).toBe('x');
    expect(monthCode(a, '2000-10')).toBeNull();
    expect(monthCode(a, '2026-12')).toBeNull();
  });
});

describe('binning (the monthly calendar\'s log scale)', () => {
  const a = area();
  it('is null with no value, 0 for a zero, and the ember step otherwise', () => {
    expect(dayStep(dayInfo(a, '2019-06-15'), 'harm', a.max)).toBeNull();
    expect(dayStep(dayInfo(a, '2020-08-17'), 'harm', a.max)).toBeNull();
    expect(dayStep(dayInfo(a, '2015-09-20'), 'harm', a.max)).toBe(0);
    expect(dayStep(dayInfo(a, '2015-09-15'), 'harm', a.max)).toBe(emberStep(120, 600));
    expect(dayStep(dayInfo(a, '2015-09-15'), 'raw', a.max)).toBe(9);
  });
  it('keeps one scale for both series and never draws a small value as a zero', () => {
    expect(dayStep(dayInfo(a, '2001-01-10'), 'harm', a.max)).toBeGreaterThanOrEqual(1);
    expect(emberStep(0.04, 600)).toBe(1);
    expect(emberStep(120, 600)).toBeLessThan(emberStep(600, 600));
    const steps = [1, 5, 30, 120, 400, 600].map((v) => emberStep(v, 600));
    expect([...steps].sort((x, y) => x - y)).toEqual(steps);
    expect(Math.max(...steps)).toBe(9);
  });
});

describe('sums and the starting day', () => {
  const a = area();
  it('adds the days of a month for a series', () => {
    expect(monthSum(a, 2015, 9, 'harm')).toEqual({ sum: 120, any: true, withheld: false });
    expect(monthSum(a, 2015, 9, 'raw')).toEqual({ sum: 630, any: true, withheld: false });
    expect(monthSum(a, 2026, 11, 'harm').sum).toBeCloseTo(32.345, 6);
    expect(monthSum(a, 2026, 11, 'raw')).toEqual({ sum: 80, any: true, withheld: false });   // S-NPP, 1 and 2 November only
    expect(monthSum(a, 2019, 5, 'harm')).toEqual({ sum: 0, any: false, withheld: true });
    expect(monthSum(a, 2005, 1, 'harm')).toEqual({ sum: 0, any: false, withheld: false });
  });
  it('starts the keyboard on the latest day with a value', () => {
    expect(lastValueDay(a, 2026, 'harm')).toBe('2026-11-13');
    expect(lastValueDay(a, 2026, 'raw')).toBe('2026-11-02');
    expect(lastValueDay(a, 2019, 'harm')).toBe('2019-12-31');
    expect(lastValueDay(a, 2015, 'harm')).toBe('2015-12-31');
  });
});

describe('words', () => {
  const a = area();
  it('writes whole numbers plainly and converted values with a decimal', () => {
    expect(fmtDay(1234)).toBe('1,234');
    expect(fmtDay(1234, 'id')).toBe('1.234');
    expect(fmtDay(25.5)).toBe('25.5');
    expect(fmtDay(25.5, 'id')).toBe('25,5');
    expect(fmtDay(0.213)).toBe('0.21');
    expect(fmtDay(121.98)).toBe('122');
    expect(fmtDay(1089.874)).toBe('1,090');
    expect(fmtDay(99.94)).toBe('99.9');
    expect(fmtDay(0)).toBe('0');
  });
  it('gives each day a label a screen reader can read', () => {
    const en = dayLabel(dayInfo(a, '2023-09-15'), 'harm', 'en');
    expect(en).toContain('Friday, 15 September 2023');
    expect(en).toContain('25.5 fire cell-days on the Aqua MODIS scale');
    expect(en).toContain('approximate: converted from VIIRS with the month\'s factor');
    expect(en).toContain('as recorded: MODIS Aqua 20, MODIS Terra 0, VIIRS S-NPP 120, VIIRS NOAA-20 130');
    const id = dayLabel(dayInfo(a, '2023-09-15'), 'harm', 'id');
    expect(id).toContain('Jumat, 15 September 2023');
    expect(id).toContain('25,5 sel-hari api pada skala Aqua MODIS');
    expect(id).toContain('perkiraan: dikonversi dari VIIRS dengan faktor bulan itu');
    expect(dayLabel(dayInfo(a, '2015-09-15'), 'raw', 'en')).toContain('600 fire cell-days as recorded by VIIRS S-NPP');
    expect(dayLabel(dayInfo(a, '2015-09-15'), 'harm', 'en')).toContain('Aqua MODIS\'s own count');
    expect(dayLabel(dayInfo(a, '2026-11-02'), 'harm', 'en')).toContain('provisional');
  });
  it('says why a day has no value, and never calls it a zero', () => {
    expect(dayLabel(dayInfo(a, '2019-06-15'), 'harm', 'en')).toBe('Saturday, 15 June 2019, withheld for a registered test: not computed, not a zero');
    expect(dayLabel(dayInfo(a, '2019-06-15'), 'harm', 'id')).toContain('ditahan untuk sebuah uji terdaftar');
    expect(noValueWords(dayInfo(a, '2020-08-17').harm, 'en')).toContain('MODIS Aqua recorded nothing anywhere in Indonesia');
    expect(noValueWords(dayInfo(a, '2026-11-20').harm, 'en')).toContain('outside the days VIIRS NOAA-20 has data for');
    expect(noValueWords(dayInfo(a, '2000-10-31').harm, 'en')).toBe('no value: outside the record');
    expect(noValueWords(dayInfo(a, '2005-01-12').harm, 'en')).toContain('the monthly record has none');
    expect(noValueWords(dayInfo(a, '2015-09-15').harm, 'en')).toBe('');
  });
});

describe('seasonDayHref', () => {
  const kalteng = { aoi_id: 'prov-kalimantan-tengah' }, district = { aoi_id: 'kab-pulang-pisau', province_aoi: 'prov-kalimantan-tengah' };
  const seasons = [2015, 2019, 2023];
  it('links a day of a built season, for Central Kalimantan and its districts', () => {
    expect(seasonDayHref('2015-09-15', kalteng, seasons)).toBe('#/season?y=2015&d=2015-09-15');
    expect(seasonDayHref('2023-08-01', district, seasons)).toBe('#/season?y=2023&d=2023-08-01');
    expect(seasonDayHref('2023-10-31', district, seasons)).toBe('#/season?y=2023&d=2023-10-31');
    expect(seasonDayHref('2019-09-15', district, seasons)).toBe('#/season?d=2019-09-15');   // 2019 keeps its old form
  });
  it('gives no link outside the season, for a year that is not built, or for another area', () => {
    expect(seasonDayHref('2015-07-31', kalteng, seasons)).toBeNull();
    expect(seasonDayHref('2015-11-01', kalteng, seasons)).toBeNull();
    expect(seasonDayHref('2016-09-15', kalteng, seasons)).toBeNull();
    expect(seasonDayHref('2015-09-15', kalteng, null)).toBeNull();
    expect(seasonDayHref('2015-09-15', { aoi_id: 'prov-riau' }, seasons)).toBeNull();
    expect(seasonDayHref('2015-09-15', { aoi_id: 'kab-siak', province_aoi: 'prov-riau' }, seasons)).toBeNull();
    expect(seasonDayHref('2015-09-15', { aoi_id: 'IDN' }, seasons)).toBeNull();
  });
});

describe('daysCsv', () => {
  const a = area();
  const meta = { area: 'Test', aoiId: 'kab-test', dataVersion: 'abc123', generated: '2026-11-21', notes: ['District values are approximate.'] };
  const parse = (csv: string) => {
    const lines = csv.trimEnd().split('\r\n');
    const head = lines.filter((l) => l.startsWith('#'));
    const rest = lines.slice(head.length);
    return { head, columns: rest[0]!.split(','), rows: rest.slice(1).map((l) => l.split(',')) };
  };
  it('has the page\'s comment lines, one header row and one row for every date of the year', () => {
    const c = parse(daysCsv(a, 2015, meta));
    expect(c.head[0]).toContain('KalenderApi');
    expect(c.head.some((l) => l === '# Area: Test (kab-test)')).toBe(true);
    expect(c.head.some((l) => l === '# Year: 2015')).toBe(true);
    expect(c.head.some((l) => l === '# Unit: fire cell-days a day (test)')).toBe(true);
    expect(c.head.some((l) => l === '# Data version: abc123')).toBe(true);
    expect(c.head.some((l) => l.includes('District values are approximate.'))).toBe(true);
    expect(c.head[c.head.length - 1]).toBe('# Fire cell-days are not burned area.');
    expect(c.columns).toEqual([...DAYS_CSV_COLUMNS]);
    expect(c.rows).toHaveLength(365);
    expect(parse(daysCsv(a, 2024, meta)).rows).toHaveLength(366);
    expect(c.rows.every((r) => r.length === DAYS_CSV_COLUMNS.length)).toBe(true);
    expect(c.rows[0]![0]).toBe('2015-01-01');
    expect(c.rows[364]![0]).toBe('2015-12-31');
  });
  it('writes the values of a day and a zero for a day with nothing detected', () => {
    const c = parse(daysCsv(a, 2015, meta));
    expect(c.rows[257]).toEqual(['2015-09-15', '120', 'MODIS Aqua', '0', '600', 'VIIRS S-NPP', '120', '40', '600', '', '0', '0', 'value']);
    expect(c.rows[0]).toEqual(['2015-01-01', '0', 'MODIS Aqua', '0', '0', 'VIIRS S-NPP', '0', '0', '0', '', '0', '0', 'value']);
    const y23 = parse(daysCsv(a, 2023, meta));
    expect(y23.rows[257]).toEqual(['2023-09-15', '25.5', 'VIIRS S-NPP', '1', '120', 'VIIRS S-NPP', '20', '0', '120', '130', '0', '0', 'value']);
  });
  it('leaves a day with no value empty and says why', () => {
    const y19 = parse(daysCsv(a, 2019, meta));
    expect(y19.rows[0]).toEqual(['2019-01-01', '', '', '0', '', '', '', '', '', '', '0', '0', 'withheld']);
    expect(y19.rows.filter((r) => r[12] === 'withheld')).toHaveLength(304);     // 1 January to 31 October
    expect(y19.rows.filter((r) => r[12] === 'withheld').every((r) => r.slice(1, 3).join('') === '' && r.slice(4, 10).join('') === '')).toBe(true);
    expect(y19.rows[304]).toEqual(['2019-11-01', '0', 'MODIS Aqua', '0', '0', 'VIIRS S-NPP', '0', '0', '0', '0', '0', '0', 'value']);
    const y20 = parse(daysCsv(a, 2020, meta));
    expect(y20.rows[229]).toEqual(['2020-08-17', '', 'MODIS Aqua', '0', '50', 'VIIRS S-NPP', '', '5', '50', '48', '0', '0', 'sensor_silent']);
    const y26 = parse(daysCsv(a, 2026, meta));
    expect(y26.rows[305]).toEqual(['2026-11-02', '12.345', 'VIIRS NOAA-20', '1', '80', 'VIIRS S-NPP', '9', '0', '80', '70', '1', '1', 'value']);
    expect(y26.rows[323]).toEqual(['2026-11-20', '', 'VIIRS NOAA-20', '0', '', 'VIIRS S-NPP', '', '', '', '', '1', '1', 'outside_record']);
    expect(y26.rows[364]![12]).toBe('outside_record');
  });
});
