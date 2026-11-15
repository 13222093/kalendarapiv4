import { describe, expect, it } from 'vitest';
import { chipAreas, matchAreas, recordHref, trendGeom } from './hub';
import type { AoiEntry } from './record';

const area = (aoi_id: string, name_en: string, name_id = name_en): AoiEntry => ({ aoi_id, name: name_id, name_en, name_id, file: `monthly_${aoi_id}.json` });
const AREAS = [
  area('IDN', 'Indonesia'),
  area('prov-riau', 'Riau'),
  area('prov-kepulauan-riau', 'Riau Islands', 'Kepulauan Riau'),
  area('prov-kalimantan-tengah', 'Central Kalimantan', 'Kalimantan Tengah'),
  area('prov-kalimantan-barat', 'West Kalimantan', 'Kalimantan Barat'),
];

describe('hub area search', () => {
  it('matches the English and the Indonesian name, every word typed', () => {
    expect(matchAreas(AREAS, 'central kal').map((a) => a.aoi_id)).toEqual(['prov-kalimantan-tengah']);
    expect(matchAreas(AREAS, 'Kalimantan Tengah').map((a) => a.aoi_id)).toEqual(['prov-kalimantan-tengah']);
    expect(matchAreas(AREAS, 'kalimantan').map((a) => a.aoi_id).sort()).toEqual(['prov-kalimantan-barat', 'prov-kalimantan-tengah']);
  });
  it('puts a name that starts with what was typed first, and returns nothing for nothing', () => {
    expect(matchAreas(AREAS, 'riau')[0]!.aoi_id).toBe('prov-riau');
    expect(matchAreas(AREAS, '   ')).toEqual([]);
    expect(matchAreas(AREAS, 'atlantis')).toEqual([]);
  });
  it('keeps only the chips whose id is in the files, in chip order', () => {
    expect(chipAreas(['prov-riau', 'kab-nowhere', 'IDN'], AREAS).map((a) => a.aoi_id)).toEqual(['prov-riau', 'IDN']);
  });
  it('links to the record page of the area', () => {
    expect(recordHref('kab-pulang-pisau')).toBe('#/record?aoi=kab-pulang-pisau');
  });
});

describe('hub yearly chart', () => {
  const box = { width: 360, height: 150, top: 10, right: 30, bottom: 20, left: 30 };
  it('scales both lines to one axis rounded up to the next 100', () => {
    const g = trendGeom([{ year: 2003, raw: 100, fair: 100 }, { year: 2004, raw: 430, fair: 90 }], box)!;
    expect(g.yMax).toBe(500);
    expect(g.x(2003)).toBe(30);
    expect(g.x(2004)).toBe(330);
    expect(g.y(0)).toBe(130);
    expect(g.y(500)).toBe(10);
    expect(g.rawPath.startsWith('M30,')).toBe(true);
    expect(g.last.year).toBe(2004);
  });
  it('breaks the line at a year that was left out, and gives nothing for a single year', () => {
    const g = trendGeom([{ year: 2003, raw: 100, fair: 100 }, { year: 2004, raw: 100, fair: 100 }, { year: 2006, raw: 100, fair: 100 }], box)!;
    expect(g.fairPath.match(/M/g)).toHaveLength(2);
    expect(trendGeom([{ year: 2003, raw: 100, fair: 100 }], box)).toBeNull();
  });
});
