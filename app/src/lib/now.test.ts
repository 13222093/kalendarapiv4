// KalenderApi (new file): tests of lib/now.ts ("Today in my district").
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  HIGH_24H, HOUR, asLive, buildMessages, cleanPhone, countLive, districtTitle, filesUpdatedMs, levelOf, padBox, peatCsv, peatFor,
  pointMs, waLink, wib, type LivePoint, type MsgInput,
} from './now.ts';

const NOW = Date.UTC(2026, 10, 15, 13, 53);   // 15 Nov 2026 13:53 UTC = 20:53 WIB
const pt = (date: string, time: string, sensor: 'N20' | 'N21' | 'MODIS' = 'N20'): LivePoint => [113.9, -2.7, 5.1, 'D', sensor, date, time];

describe('asLive', () => {
  it('rejects a page or the function source served in place of JSON', () => {
    expect(asLive(null)).toBeNull();
    expect(asLive('<!doctype html>')).toBeNull();
    expect(asLive({ error: 'range must be 24h or 7d' })).toBeNull();
    expect(asLive({ fetched_at: 'not a date', points: [], sources: [] })).toBeNull();
  });
  it('keeps well-formed points and names failed sources', () => {
    const r = asLive({
      fetched_at: '2026-11-15T13:53:00Z', range: '7d', bbox: [1, 2, 3, 4],
      sources: [{ sensor: 'N20', file: 'a', last_modified: '2026-11-15T13:42:14.000Z', rows: 3 }, { sensor: 'MODIS', file: 'b', last_modified: null, rows: 0, error: 'HTTP 503' }],
      points: [[113.9, -2.7, 5.1, 'N', 'N21', '2026-11-14', '0540'], [113.9, -2.7, null, 'D', 'XX', '2026-11-14', '0540'], ['x', 1], [113.9, -2.7, 1, 'D', 'N20', '14/11/2026', '0540']],
    });
    expect(r?.points).toEqual([[113.9, -2.7, 5.1, 'N', 'N21', '2026-11-14', '0540']]);
    expect(r?.failed).toEqual(['MODIS']);
    expect(filesUpdatedMs(r!.sources)).toBe(Date.parse('2026-11-15T13:42:14.000Z'));
  });
});

describe('countLive', () => {
  it('reads FIRMS dates and times as UTC', () => {
    expect(pointMs(pt('2026-11-14', '0540'))).toBe(Date.UTC(2026, 10, 14, 5, 40));
  });
  it('counts by detection time: 24 hours and 7 days before now', () => {
    const c = countLive([
      pt('2026-11-15', '0600', 'N21'),            // 7 h 53 min ago
      pt('2026-11-14', '1353', 'MODIS'),          // exactly 24 h ago: inside
      pt('2026-11-14', '0540', 'N21'),            // 32 h ago: 7 days only
      pt('2026-11-08', '1353', 'N20'),            // exactly 168 h ago: inside 7 days
      pt('2026-11-08', '1352', 'N20'),            // older: dropped
      pt('2026-11-15', '1400', 'N20'),            // after now: dropped
    ], NOW);
    expect(c.total24).toBe(2);
    expect(c.by24).toEqual({ N20: 0, N21: 1, MODIS: 1 });
    expect(c.total7).toBe(4);
    expect(c.by7).toEqual({ N20: 1, N21: 2, MODIS: 1 });
    expect(c.newest?.[6]).toBe('0600');
    expect(c.recent.map((p) => p[6])).toEqual(['0600', '1353', '0540', '1353']);
  });
  it('an empty list is zero, with no newest detection', () => {
    const c = countLive([], NOW);
    expect([c.total24, c.total7, c.newest]).toEqual([0, 0, null]);
  });
});

describe('levelOf', () => {
  it('follows the stated rules', () => {
    expect(levelOf({ live24: HIGH_24H, live7: HIGH_24H, status: 'below' })).toEqual({ level: 'high', why: 'h24-high' });
    expect(levelOf({ live24: 0, live7: 0, status: 'far-above' })).toEqual({ level: 'high', why: 'month-far-above' });
    expect(levelOf({ live24: HIGH_24H - 1, live7: 9, status: 'near' })).toEqual({ level: 'watch', why: 'h24-some' });
    expect(levelOf({ live24: 0, live7: 14, status: 'near' })).toEqual({ level: 'watch', why: 'd7-some' });
    expect(levelOf({ live24: 0, live7: 0, status: 'above' })).toEqual({ level: 'watch', why: 'month-above' });
    expect(levelOf({ live24: 0, live7: 0, status: 'near' })).toEqual({ level: 'calm', why: 'quiet' });
    expect(levelOf({ live24: 0, live7: 0, status: null })).toEqual({ level: 'calm', why: 'quiet' });
  });
  it('is never Calm when live data could not be read', () => {
    expect(levelOf({ live24: null, live7: null, status: 'near' })).toEqual({ level: null, why: 'no-live' });
    expect(levelOf({ live24: null, live7: null, status: 'above' }).level).toBe('watch');
    expect(levelOf({ live24: null, live7: null, status: 'far-above' }).level).toBe('high');
  });
});

describe('words', () => {
  it('names a district and keeps a city name', () => {
    expect(districtTitle('Pulang Pisau', 'id')).toBe('Kabupaten Pulang Pisau');
    expect(districtTitle('Pulang Pisau', 'en')).toBe('Pulang Pisau district');
    expect(districtTitle('Kota Palangka Raya', 'id')).toBe('Kota Palangka Raya');
  });
  it('writes times in WIB', () => {
    expect(wib(NOW, 'en')).toMatch(/15 Nov 2026.*20:53 WIB$/);
    expect(wib(NOW, 'id')).toMatch(/WIB$/);
  });
  it('pads a box and builds a WhatsApp link with no recipient', () => {
    expect(padBox([113.5759, -3.4689, 114.349, -1.5416], 0.25)).toEqual([113.326, -3.719, 114.599, -1.292]);
    expect(waLink('Info titik panas, 0 & 14')).toBe('https://wa.me/?text=Info%20titik%20panas%2C%200%20%26%2014');
    expect(cleanPhone('  0812-3456 7890 <script> ')).toBe('0812-3456 7890');
    expect(cleanPhone('')).toBe('');
  });
});

const base: MsgInput = {
  lang: 'id', district: 'Pulang Pisau', nowMs: NOW, level: 'watch',
  live: { counts: countLive([pt('2026-11-14', '0540', 'N21'), pt('2026-11-10', '0610', 'N20')], NOW), updatedMs: Date.parse('2026-11-15T13:46:44Z'), failed: [] },
  month: { label: 'November 2026', monthOnly: 'November', H: 21.93, median: 1, higherPct: 69, status: 'near', partial: true },
  sites: [{ lon: 113.785, lat: -2.845, days: 28, first: '2026-09-04', last: '2026-10-18', comeBacks: 3, underCloud: 0, seenQuiet: 1, noData: 0, modisFire: 2, nightShare: 0.94, gaps: [] }],
  sitesSeason: 2026, phone: '',
};

describe('buildMessages', () => {
  it('fills the Bahasa Indonesia templates with the numbers given, and nothing else', () => {
    const m = buildMessages(base);
    expect(m.residents).toContain('Kabupaten Pulang Pisau');
    expect(m.residents).toContain('Tingkat: WASPADA (aturan KalenderApi sendiri, bukan status resmi pemerintah).');
    expect(m.residents).toContain('mencatat 0 titik panas dalam 24 jam terakhir dan 2 dalam 7 hari terakhir');
    expect(m.residents).toContain('Nol titik panas tidak berarti tidak ada api');
    expect(m.residents).toContain('lapor ke posko desa atau BPBD');
    expect(m.bpbd).toContain('24 jam terakhir: 0 titik panas (VIIRS NOAA-20 0, VIIRS NOAA-21 0, MODIS 0). 7 hari terakhir: 2.');
    expect(m.bpbd).toContain('(VIIRS NOAA-21), di -2.7000, 113.9000');
    expect(m.bpbd).toContain('November 2026 (bulan masih berjalan): 21,9 sel-hari api');
    expect(m.bpbd).toContain('median November adalah 1; lebih tinggi dari 69% November tahun-tahun sebelumnya (mendekati normal)');
    expect(m.crew).toContain('1. -2.7000, 113.9000');
    expect(m.crew).toContain('Lokasi gambut untuk dicek ulang (aktivitas api berulang, musim Agu sampai Okt 2026):');
    expect(m.crew).toContain('1. -2.8450, 113.7850 · terdeteksi 28 hari, terakhir 2026-10-18 · muncul lagi 3 kali');
  });
  it('never invents a phone number, and uses the one typed', () => {
    const none = buildMessages(base);
    for (const text of Object.values(none)) expect(text).not.toMatch(/\b0\d{8,}\b|\+62/);
    const withPhone = buildMessages({ ...base, phone: '0812-0000-0000' });
    expect(withPhone.residents).toContain('lapor ke posko setempat: 0812-0000-0000.');
    expect(withPhone.bpbd).toContain('Posko setempat: 0812-0000-0000.');
    expect(withPhone.crew).toContain('0812-0000-0000');
  });
  it('says so when live data could not be read, and sets no level', () => {
    const m = buildMessages({ ...base, live: null, level: null, lang: 'en' });
    expect(m.residents).toContain('Level: not set');
    expect(m.residents).toContain('could not be read. This is not a sign that there is no fire.');
    expect(m.bpbd).not.toContain('Last 24 hours');
    expect(m.crew).not.toMatch(/^1\. -2\.7/m);
  });
  it('makes no claim of fire under cloud, no forecast and no automatic alert', () => {
    for (const lang of ['en', 'id'] as const) for (const level of ['calm', 'watch', 'high'] as const) {
      const all = Object.values(buildMessages({ ...base, lang, level })).join('\n').toLowerCase();
      expect(all).not.toMatch(/forecast|prakiraan|will burn|akan terbakar|hidden fire|api tersembunyi|fire under cloud|sent automatically|dikirim otomatis/);
    }
  });
  it('writes English when asked', () => {
    const m = buildMessages({ ...base, lang: 'en', level: 'high', live: { ...base.live!, counts: countLive([pt('2026-11-15', '0600')], NOW) } });
    expect(m.residents).toContain('Level: HIGH');
    expect(m.residents).toContain('recorded 1 hotspot in the last 24 hours and 1 in the last 7 days in Pulang Pisau district.');
  });
});

describe('peatFor', () => {
  const file = JSON.parse(readFileSync(new URL('../../public/ka-data/peat_persistence_kalteng.json', import.meta.url), 'utf8')) as unknown;
  it('reads a district of the real file, ranked by days detected', () => {
    const p = peatFor(file, 'kab-pulang-pisau');
    expect(p).not.toBeNull();
    expect(p!.sites.length).toBeGreaterThan(0);
    expect(p!.sites.length).toBeLessThanOrEqual(40);
    expect(p!.season).not.toBe(2019);
    for (let k = 1; k < p!.sites.length; k++) expect(p!.sites[k]!.days).toBeLessThanOrEqual(p!.sites[k - 1]!.days);
    for (const s of p!.sites) {
      expect(s.lon).toBeGreaterThan(113.4); expect(s.lon).toBeLessThan(114.5);
      expect(s.underCloud + s.seenQuiet + s.noData + s.modisFire).toBe(s.comeBacks);
      for (const g of s.gaps) expect(g.from.slice(0, 4)).not.toBe('2019');
    }
    const csv = peatCsv(p!, 'Pulang Pisau', 'kab-pulang-pisau', '2026-11-15');
    expect(csv.split('\r\n').filter((l) => l && !l.startsWith('#')).length).toBe(p!.sites.length + 1);
    expect(csv).toContain('rank,latitude,longitude,days_detected');
  });
  it('is null for a district outside the file, and for a file of another shape', () => {
    expect(peatFor(file, 'kab-aceh-barat')).toBeNull();
    expect(peatFor({ districts: {} }, 'kab-pulang-pisau')).toBeNull();
    expect(peatFor(null, 'kab-pulang-pisau')).toBeNull();
    expect(peatFor({ districts: [{ aoi_id: 'kab-pulang-pisau', top_sites: [{ lon: 'x' }] }] }, 'kab-pulang-pisau')).toBeNull();
  });
});

it('HOUR is an hour', () => { expect(HOUR).toBe(3600000); });
