// KalenderApi (new file): tests of lib/fieldreport.ts (the daily report and the draft field check plan).
// The inputs are made-up detections at made-up places, as in burnsites.test.ts: they test the wording and the
// arithmetic, and are no record of any fire.
import { describe, expect, it } from 'vitest';
import { HOUR, countLive, type LivePoint, type PeatSite, type Sensor } from './now.ts';
import { againSites, burnSites, fixedSites, planTargets, visitOrder, type FixedKind } from './burnsites.ts';
import { answerAlert, approveAlert, hotspotId, markSent, newConsoleState, queueRows, setRowDone, sevenDays } from './nowconsole.ts';
import {
  FIXED_ROWS, LIST_ROWS, askFactsFor, boundsOf, dailyPaper, dailyReportText, decisionsOf, emptyNotes, fixedLine, frameOf, gapWords, growBounds,
  notesKey, paperText, parseNotes, planPaper, planText, ringsOf, scaleBarKm, statusWords,
  type AskPlace, type ReportInput,
} from './fieldreport.ts';

const NOW = Date.UTC(2026, 10, 21, 7, 0);   // 21 Nov 2026 07:00 UTC = 14:00 WIB
function at(hoursAgo: number, lat: number, lon: number, o: { frp?: number | null; dn?: 'D' | 'N'; sensor?: Sensor } = {}): LivePoint {
  const d = new Date(NOW - hoursAgo * HOUR).toISOString();
  return [lon, lat, o.frp === undefined ? 5 : o.frp, o.dn ?? 'D', o.sensor ?? 'N20', d.slice(0, 10), d.slice(11, 13) + d.slice(14, 16)];
}
const PEAT_AT = -3.4;          // the made-up peat map: this latitude is on peat
const FLARE_AT = -3.8;         // the made-up fixed heat source
const tags = {
  peat: (_lon: number, lat: number) => Math.abs(lat - PEAT_AT) < 0.01,
  fixed: (_lon: number, lat: number): FixedKind | null => (Math.abs(lat - FLARE_AT) < 0.01 ? 'static' : null),
};
const POINTS: LivePoint[] = [
  at(3, PEAT_AT, 104.0, { frp: 12.5, dn: 'N' }), at(27, PEAT_AT, 104.0), at(51, PEAT_AT, 104.0, { sensor: 'MODIS' }),   // on 3 days, seen today, on peat
  at(60, -3.2, 104.0, { frp: 7 }), at(100, -3.2, 104.0, { frp: null, dn: 'N' }),                                      // came back after 40 hours
  at(2, -3.0, 104.0),                                                                                                  // seen today only
  at(90, -3.6, 104.0),                                                                                                 // seen once, days ago: on no list
  at(1, FLARE_AT, 104.0), at(25, FLARE_AT, 104.0), at(49, FLARE_AT, 104.0),                                            // a known fixed heat source
];
const PAST: PeatSite[] = [
  { lon: 104.002, lat: -3.398, days: 9, first: '2023-08-20', last: '2023-10-02', comeBacks: 2, underCloud: 1, seenQuiet: 1, noData: 0, modisFire: 0, nightShare: 0.4, gaps: [] },
  { lon: 104.5, lat: -3.9, days: 6, first: '2023-09-01', last: '2023-09-20', comeBacks: 1, underCloud: 0, seenQuiet: 1, noData: 0, modisFire: 0, nightShare: null, gaps: [] },
];

function input(over: Partial<ReportInput> = {}): ReportInput {
  const counts = countLive(POINTS, NOW);
  return {
    aoiId: 'kab-contoh', place: 'Contoh district', province: 'Sumatera Selatan', site: 'https://example.test/', nowMs: NOW,
    live: 'ok', failed: [], counts, level: 'watch', levelWhy: `${counts.total24} hotspots in the last 24 hours (fewer than 5).`,
    month: { label: 'November 2026', monthOnly: 'November', H: 14.2, median: 3, higherPct: 81, status: 'above', partial: true, nrt: true },
    week: sevenDays(POINTS, NOW), burn: burnSites(POINTS, NOW, tags),
    peat: { season: 2023, provisional: false, total: 41, sites: PAST },
    decisions: null, officer: emptyNotes(), summary: {},
    ...over,
  };
}
const notRead = (): ReportInput => input({
  live: 'unavailable', counts: null, week: null, burn: null, level: null,
  levelWhy: 'Today\'s hotspots could not be read, so no level is set: "Calm" needs to know them.',
});
const nothing = (): ReportInput => input({
  counts: countLive([], NOW), week: sevenDays([], NOW), burn: [], level: 'calm', peat: null,
  levelWhy: 'No hotspot in the last 7 days, and this month is not above normal.',
});

describe('the words for a site', () => {
  it('writes a gap in hours up to two days, then in days', () => {
    expect(gapWords(38.4, 'en')).toBe('38 hours');
    expect(gapWords(38.4, 'id')).toBe('38 jam');
    expect(gapWords(60, 'en')).toBe('2.5 days');
    expect(gapWords(60, 'id')).toBe('2,5 hari');
    expect(gapWords(72, 'en')).toBe('3 days');
  });
  it('says "came back", "detected on N of 7 days" or "in the last 24 hours", and never that it kept burning', () => {
    const [persisting, returned, fresh] = planTargets(burnSites(POINTS, NOW, tags), LIST_ROWS);
    expect(statusWords(persisting!, 'en')).toBe('detected on 3 of 7 days');
    expect(statusWords(persisting!, 'id')).toBe('terdeteksi pada 3 dari 7 hari');
    expect(statusWords(returned!, 'en')).toBe('came back after 40 hours with no detection');
    expect(statusWords(returned!, 'id')).toBe('muncul lagi setelah 40 jam tanpa deteksi');
    expect(statusWords(fresh!, 'en')).toBe('detected in the last 24 hours');
    expect(statusWords(fresh!, 'id')).toBe('terdeteksi dalam 24 jam terakhir');
  });
  it('words a site detected again inside one 24-hour bin by its hours, not as "1 of 7 days"', () => {
    const [s] = burnSites([at(1, -3, 104), at(23, -3, 104)], NOW);
    expect([s!.kind, s!.daysSeen]).toEqual(['persisting', 1]);
    expect(statusWords(s!, 'en')).toBe('detected again 22 hours after the first detection');
    expect(statusWords(s!, 'id')).toBe('terdeteksi lagi 22 jam setelah deteksi pertama');
  });
});

describe('the daily report', () => {
  it('numbers its sections and leaves the peat section out where the district has no peat list', () => {
    const p = dailyPaper(input(), 'en');
    expect([p.situation.n, p.week.n, p.again.n, p.peat?.n, p.decisions.n, p.officer.n]).toEqual([1, 2, 3, 4, 5, 6]);
    const q = dailyPaper(input({ peat: null }), 'en');
    expect(q.peat).toBeNull();
    expect([q.decisions.n, q.officer.n]).toEqual([4, 5]);
  });
  it('states the counts of the page with the VIIRS and MODIS split, the newest detection and the month', () => {
    const i = input(), c = i.counts!;
    const facts = dailyPaper(i, 'en').situation.facts;
    expect(facts[0]).toMatchObject({ lead: 'Watch.', value: i.levelWhy });
    expect(facts[1]).toMatchObject({ lead: String(c.total24), value: `(VIIRS ${c.by24.N20 + c.by24.N21}, MODIS ${c.by24.MODIS})` });
    expect(facts[2]).toMatchObject({ lead: String(c.total7), value: `(VIIRS ${c.by7.N20 + c.by7.N21}, MODIS ${c.by7.MODIS})` });
    // the counts are of every detection: the report says how many are at the fixed heat source its list leaves out,
    // and that the newest detection is one of them
    expect(facts[3]).toEqual({ label: 'Of these, at a known fixed heat source', value: '1 in the last 24 hours and 3 in the last 7 days (industry, a gas flare or a volcano: not a land fire). The counts and the level include them.' });
    expect(facts[4]!.value).toBe(`21 Nov 2026, 13:00 WIB · VIIRS NOAA-20 · ${c.newest![1].toFixed(4)}, ${c.newest![0].toFixed(4)} · at a known fixed heat source`);
    expect(dailyPaper(i, 'id').situation.facts[3]!.value).toBe('1 dalam 24 jam terakhir dan 3 dalam 7 hari terakhir (industri, suar gas, atau gunung api: bukan kebakaran lahan). Jumlah dan tingkat ikut menghitungnya.');
    // two detections of one pass share a time: the newest one is still known to lie at the fixed source
    const pass = [at(1, FLARE_AT, 104.0), at(1, FLARE_AT + 0.003, 104.0, { sensor: 'N21' }), at(30, -3.2, 104.0)];
    const tied = dailyPaper(input({ counts: countLive(pass, NOW), burn: burnSites(pass, NOW, tags) }), 'en').situation.facts;
    expect(tied[3]!.value).toContain('2 in the last 24 hours and 2 in the last 7 days');
    expect(tied[4]!.value).toMatch(/ · at a known fixed heat source$/);
    const plain = dailyPaper(input({ burn: burnSites(POINTS, NOW) }), 'en').situation.facts;      // no mask: no such line
    expect(plain.map((f) => f.label)).toEqual(['Level (KalenderApi\'s own rule)', 'Hotspots, last 24 hours', 'Hotspots, last 7 days', 'Newest detection', 'This month on one scale (MODIS + VIIRS)']);
    expect(plain[3]!.value).not.toContain('fixed');
    expect(facts[5]!.value).toBe('November 2026 so far: 14.2 fire cell-days; the usual November: 3; above normal (higher than 81% of earlier Novembers); near-real-time data, provisional');
    expect(dailyPaper(i, 'id').situation.facts[5]!.value).toBe('November 2026 sejauh ini: 14,2 sel-hari api; November biasanya: 3; di atas normal (lebih tinggi dari 81% November tahun-tahun sebelumnya); data waktu hampir nyata, sementara');
  });
  it('gives the seven numbers of the week strip, which add up to the 7-day count', () => {
    const i = input();
    const cells = dailyPaper(i, 'en').week.cells!;
    expect(cells.map((c) => c.total)).toEqual(sevenDays(POINTS, NOW).map((b) => b.total));
    expect(cells.reduce((a, c) => a + c.total, 0)).toBe(i.counts!.total7);
    expect(cells[6]!.label).toBe('20–21 Nov');
  });
  it('lists the places detected again, the most pressing first, without the fixed heat source', () => {
    const i = input();
    const p = dailyPaper(i, 'en');
    expect(p.again.sites).toEqual(againSites(i.burn!));
    expect(p.again.table!.rows.map((r) => [r[1], r[2]])).toEqual([['-3.4000', '104.0000'], ['-3.2000', '104.0000']]);
    expect(p.again.table!.rows[0]).toEqual(['1', '-3.4000', '104.0000', '3', 'detected on 3 of 7 days; on mapped peat', '21 Nov, 11:00', '1 of 3', '12.5']);
    expect(p.again.table!.rows[1]).toEqual(['2', '-3.2000', '104.0000', '2', 'came back after 40 hours with no detection', '19 Nov, 02:00', '1 of 2', '7.0']);
    expect(dailyPaper(i, 'id').again.table!.rows[0]![5]).toBe('21 Nov, 11.00');
    expect(p.again.empty).toBeNull();
    expect(p.again.missing).toBeNull();
  });
  it('explains "detected again", notes the peat map once and names the fixed heat source it left out', () => {
    const notes = dailyPaper(input(), 'en').again.notes;
    expect(notes).toHaveLength(3);
    expect(notes[0]).toContain('18 hours or more apart');
    expect(notes[0]).toContain('does not say the fire burned in between');
    expect(notes[1]).toBe('Peat: the national peat map, 1:250,000 (Ministry of Agriculture, 2011). It marks a place on the map, not a detected peat fire.');
    expect(notes[2]).toBe('Left out: 1 known fixed heat source (industry, a gas flare or a volcano in NASA\'s archive): -3.8000, 104.0000 (industry or gas flare). Seen day after day and not a land fire.');
    const idn = dailyPaper(input(), 'id').again.notes;
    expect(idn[1]).toBe('Gambut: peta lahan gambut nasional skala 1:250.000 (Kementerian Pertanian, 2011). Ini menandai lokasi pada peta, bukan api gambut yang terdeteksi.');
    expect(idn[2]).toBe('Tidak dimasukkan: 1 sumber panas tetap yang sudah dikenal (industri, suar gas, atau gunung api dalam arsip NASA): -3.8000, 104.0000 (industri atau suar gas). Terdeteksi tiap hari dan bukan kebakaran lahan.');
    // no peat tag, no footnote
    const plain = dailyPaper(input({ burn: burnSites(POINTS, NOW) }), 'en').again;
    expect(plain.notes).toHaveLength(1);
    expect(plain.table!.rows[0]![4]).toBe('detected on 3 of 7 days');
  });
  it('names at most five fixed heat sources and counts the rest', () => {
    const many = burnSites(Array.from({ length: FIXED_ROWS + 2 }, (_, k) => at(1, -3 - k * 0.1, 104)), NOW, { fixed: () => 'volcano' });
    expect(fixedSites(many)).toHaveLength(FIXED_ROWS + 2);
    expect(fixedLine(many, 'en')).toContain('Left out: 7 known fixed heat sources');
    expect(fixedLine(many, 'en')).toContain('(volcano); and 2 more. Seen day after day');
    expect(fixedLine(many, 'id')).toContain('(gunung api); dan 2 lainnya. Terdeteksi tiap hari');
    // NASA types a flare on the shore as "offshore": on a district's paper it is industry or a gas flare like the others
    const shore = burnSites([at(1, -3, 104)], NOW, { fixed: () => 'offshore' });
    expect(fixedLine(shore, 'en')).toContain('-3.0000, 104.0000 (industry or gas flare). Seen day after day');
    expect(fixedLine(shore, 'id')).toContain('(industri atau suar gas). Terdeteksi tiap hari');
    expect(fixedLine([], 'en')).toBeNull();
    expect(fixedLine(null, 'en')).toBeNull();
  });
  it('says "8 of N" when more places were detected again than the table holds', () => {
    const pts = Array.from({ length: LIST_ROWS + 3 }, (_, k) => [at(2, -3 - k * 0.1, 104), at(26, -3 - k * 0.1, 104)]).flat();
    const p = dailyPaper(input({ burn: burnSites(pts, NOW) }), 'en');
    expect(p.again.table!.rows).toHaveLength(LIST_ROWS);
    expect(p.again.more).toBe('8 of 11 places are listed, the most pressing first.');
    expect(planPaper(input({ burn: burnSites(pts, NOW) }), 'id').targets.more).toBe('8 dari 11 sasaran ditampilkan, yang paling mendesak lebih dulu.');
  });
  it('names the past-season peat sites as a past season\'s record', () => {
    const p = dailyPaper(input(), 'en').peat!;
    expect(p.lead).toContain('41 peat sites in the August to October 2023 season');
    expect(p.lead).toContain('not places burning now');
    expect(p.items).toEqual(['-3.398, 104.002 · detected on 9 days, came back 2 times', '-3.900, 104.500 · detected on 6 days, came back 1 time']);
  });
  it('writes the blanks as blanks, and what the officer typed as typed', () => {
    const notes = emptyNotes();
    notes.daily.crews = '  2 regu  ';
    const p = dailyPaper(input({ officer: notes }), 'id');
    expect(p.officer.fields.map((f) => f.key)).toEqual(['area', 'areaSource', 'crews', 'air', 'rain', 'ispu', 'notes']);
    expect(p.officer.fields.find((f) => f.key === 'crews')!.value).toBe('2 regu');
    const text = paperText(p);
    expect(text).toContain('Regu darat yang dikerahkan: 2 regu');
    expect(text).toContain('Luas terbakar (ha): (belum diisi)');
    expect(text).toContain('KalenderApi tidak punya data untuk bagian ini.');
  });
});

describe('the decisions of the command view', () => {
  const NEWEST = countLive(POINTS, NOW).newest!;
  const q = { liveFailed: false, newestId: hotspotId(NEWEST), againId: 'site:a', peatId: null, level: 'watch' as const };
  it('has nothing to say about a fresh queue', () => {
    const s = newConsoleState(NOW);
    const d = decisionsOf(s, queueRows(q, s));
    expect(d).toEqual({ approvedMs: null, sentMs: null, held: false, reply: null, repliedMs: null, done: [], doneOther: 0 });
    const p = dailyPaper(input({ decisions: d }), 'en').decisions;
    expect(p.items).toEqual([]);
    expect(p.empty).toBe('No decision has been recorded in the command view today.');
    expect(dailyPaper(input({ decisions: null }), 'id').decisions.empty).toBe('Belum ada keputusan yang dicatat di tampilan komando hari ini.');
  });
  it('reports the alert with its times, the rows ticked, and a resident\'s report of fire', () => {
    let s = markSent(approveAlert(newConsoleState(NOW), NOW + 60_000), NOW + 61_000);
    s = answerAlert(s, 'fire', NOW + 5 * 60_000);
    s = setRowDone(setRowDone(setRowDone(s, q.newestId, true), 'site:a', true), 'newest:gone', true);
    const d = decisionsOf(s, queueRows(q, s));
    expect(d.done).toEqual(['newest', 'again']);
    expect(d.doneOther).toBe(1);
    const p = dailyPaper(input({ decisions: d }), 'en').decisions;
    expect(p.empty).toBeNull();
    expect(p.items).toEqual([
      'Village alert: approved at 14:01 WIB, marked sent at 14:01 WIB.',
      'A resident replied "I see fire" at 14:05 WIB: to be checked on the ground.',
      'Marked done: Check the newest hotspot on the ground.',
      'Marked done: Re-check the places detected again.',
      '1 earlier item marked done (no longer in the queue).',
    ]);
    expect(p.note).toContain('demo');
  });
  it('reports a held alert, and a reply that the alert was read', () => {
    const held = { ...newConsoleState(NOW), alert: { times: { drafted: NOW }, held: true, reply: null } };
    expect(dailyPaper(input({ decisions: decisionsOf(held, queueRows(q, held)) }), 'id').decisions.items).toEqual(['Peringatan desa: ditahan, belum disetujui.']);
    const read = answerAlert(markSent(approveAlert(newConsoleState(NOW), NOW), NOW), 'read', NOW + 120_000);
    expect(dailyPaper(input({ decisions: decisionsOf(read, queueRows(q, read)) }), 'id').decisions.items[1]).toBe('Dibaca: seorang warga membalas "Sudah saya baca" pukul 14:02 WIB.');
  });
});

describe('the field check plan', () => {
  it('lists the targets in visiting order with the straight-line km from the stop before', () => {
    const i = input();
    const p = planPaper(i, 'en');
    const route = visitOrder(planTargets(i.burn!, LIST_ROWS));
    expect(p.targets.visits).toEqual(route);
    expect(route.map((v) => v.site.lat)).toEqual([-3.4, -3.2, -3.0]);
    expect(p.targets.table!.rows.map((r) => r[7])).toEqual(['start', route[1]!.legKm!.toFixed(1), route[2]!.legKm!.toFixed(1)]);
    expect(p.targets.table!.rows[0]).toEqual(['1', 'detected on 3 of 7 days; on mapped peat', '-3.4000, 104.0000', '21 Nov, 11:00', '3', '1 of 3', '12.5', 'start']);
    expect(p.targets.table!.rows[2]![1]).toBe('detected in the last 24 hours');
    expect(p.targets.rule).toBe('Order: start at the most pressing target, then always the nearest one not yet visited. Distances are straight lines, not roads.');
    expect(p.targets.notes.some((x) => x.startsWith('Left out: 1 known fixed heat source'))).toBe(true);
    expect([p.targets.n, p.sketch?.n, p.peat?.n, p.crew?.n, p.officer.n]).toEqual([1, 2, 3, 4, 5]);
  });
  it('says how far a site\'s detections spread when that is more than 0.3 km', () => {
    const km = 1 / 111.195;
    const wide = burnSites([at(2, -3, 104), at(3, -3 + 0.8 * km, 104), at(26, -3 + 1.6 * km, 104)], NOW);
    expect(wide[0]!.radiusKm).toBe(0.8);
    expect(planPaper(input({ burn: wide }), 'en').targets.table!.rows[0]![1]).toBe('detected on 2 of 7 days; detections within 0.8 km');
    expect(planPaper(input({ burn: wide }), 'id').targets.lines[0]).toContain('deteksi dalam 0,8 km');
  });
  it('names the past-season peat site next to a target, else the first of the district\'s list', () => {
    const p = planPaper(input(), 'en').peat!;
    expect(p.lead).toBe('Past-season peat sites within 1 km of a target:');
    expect(p.items).toEqual(['Target 1: -3.398, 104.002 · detected on 9 days, came back 2 times']);
    expect(p.tail).toContain('not places burning now');
    const far = planPaper(input({ peat: { season: 2023, provisional: false, total: 1, sites: [PAST[1]!] } }), 'en').peat!;
    expect(far.lead).toBe('No target lies within 1 km of a past-season peat site. The first 1 of the district\'s list:');
    expect(far.items).toEqual(['-3.900, 104.500 · detected on 6 days, came back 1 time']);
  });
  it('gives the crew one row to fill per target', () => {
    const p = planPaper(input(), 'id');
    expect(p.crew!.rows).toEqual(['1', '2', '3']);
    expect(p.crew!.head).toEqual(['No. sasaran', 'Api atau asap terlihat', 'Gambut', 'Perlu tambahan regu', 'Catatan']);
    expect(p.officer.fields.map((f) => f.label)).toEqual(['Regu dan jumlah personel', 'Kendaraan', 'Sumber air terdekat', 'Dukungan udara dan jalur', 'Kontak', 'Waktu berangkat']);
  });
});

describe('the text versions', () => {
  it('carry every value of the page\'s tables, line for line', () => {
    const i = input();
    for (const lang of ['en', 'id'] as const) {
      const d = dailyPaper(i, lang), text = dailyReportText(i, lang);
      d.again.table!.rows.forEach((row, k) => {
        const line = text.split('\n').find((x) => x.startsWith(`${k + 1}. ${row[1]}, ${row[2]}`));
        expect(line).toBeDefined();
        for (const cell of [row[5]!, row[6]!, row[7]!]) expect(line).toContain(cell);
        expect(line).toContain(statusWords(d.again.sites[k]!, lang));
      });
      for (const f of d.situation.facts) expect(text).toContain(`${f.label}: ${f.lead ? `${f.lead} ` : ''}${f.value}`);
      expect(text).toContain(d.week.cells!.map((c) => c.n).join(' · '));
      for (const note of d.again.notes) expect(text).toContain(note);

      const p = planPaper(i, lang), plan = planText(i, lang);
      p.targets.table!.rows.forEach((row, k) => {
        const line = plan.split('\n').find((x) => x.startsWith(`${k + 1}. ${row[2]}`));
        expect(line).toBeDefined();
        for (const cell of [row[3]!, row[5]!, row[6]!]) expect(line).toContain(cell);
        if (k > 0) expect(line).toContain(`${row[7]} km`);
      });
      expect(plan).toContain(p.targets.rule);
      for (const note of p.targets.notes) expect(plan).toContain(note);
    }
  });
  it('mark a place on mapped peat with a short word', () => {
    expect(dailyReportText(input(), 'en').split('\n').find((x) => x.startsWith('1. -3.4000'))).toBe('1. -3.4000, 104.0000 · detected on 3 of 7 days · mapped peat · last 21 Nov, 11:00 WIB · night 1 of 3 · highest 12.5 MW');
    expect(planText(input(), 'id').split('\n').find((x) => x.startsWith('1. -3.4000'))).toContain(' · gambut (peta) · ');
    expect(dailyReportText(input(), 'en').split('\n').find((x) => x.startsWith('2. -3.2000'))).not.toContain('peat');
  });
  it('start with the title and the draft line and end with the page address', () => {
    const d = dailyReportText(input(), 'id').split('\n');
    expect(d.slice(0, 6)).toEqual([
      '*LAPORAN HARIAN KARHUTLA*', 'Contoh district, Sumatera Selatan', '21 November 2026', 'Data dibaca 21 Nov 2026, 14.00 WIB',
      'Sumber: NASA FIRMS (VIIRS NOAA-20, VIIRS NOAA-21, MODIS)', 'Draf dari KalenderApi, dari data satelit. Bukan laporan resmi.',
    ]);
    expect(d[d.length - 1]).toBe('https://example.test/#/report?aoi=kab-contoh&doc=daily&lang=id');
    expect(d[d.length - 2]).toBe('Tingkat: aturan kami sendiri, bukan status resmi.');
    const p = planText(input(), 'en').split('\n');
    expect(p[0]).toBe('*DRAFT FIELD CHECK PLAN*');
    expect(p[5]).toBe('A draft from satellite data, to be discussed. Not an official field plan (renlap): aircraft routes, water sources and equipment are filled in by the officer.');
    expect(p[p.length - 1]).toBe('https://example.test/#/report?aoi=kab-contoh&doc=plan');
  });
  it('have no table marks, and never say that a fire kept burning', () => {
    for (const text of [dailyReportText(input(), 'en'), dailyReportText(input(), 'id'), planText(input(), 'en'), planText(input(), 'id')]) {
      expect(text).not.toMatch(/\|/);
      expect(text).not.toMatch(/kept burning|still burning(?!\?)|terus menyala|masih menyala|masih terbakar/i);
      expect(text.split('\n').every((x) => x.length <= 420)).toBe(true);
    }
  });
  it('include the AI paragraph only when there is one, with who wrote it', () => {
    expect(dailyReportText(input(), 'en')).not.toMatch(/\bAI\b/);
    const withAi = input({ summary: { daily: { text: '  A paragraph.  ', model: 'model-name', atMs: NOW } } });
    const text = dailyReportText(withAi, 'en');
    expect(text).toContain('*Summary (AI draft)*\nA paragraph.\nWritten by AI (model-name) from the numbers on this paper, 21 Nov 2026, 14:00 WIB. Check it before you use it.');
    expect(planText(withAi, 'en')).not.toMatch(/\bAI\b/);                                   // the plan has its own
    expect(dailyPaper(input({ summary: { daily: { text: '   ', model: null, atMs: null } } }), 'en').summary).toBeNull();
  });

  it('say "unknown, not zero" when the hotspots could not be read, with a dash for every number that needs them', () => {
    for (const lang of ['en', 'id'] as const) {
      const i = notRead(), d = dailyPaper(i, lang), text = dailyReportText(i, lang);
      expect(d.notices).toEqual([lang === 'en' ? 'Today\'s hotspots could not be read: the counts are unknown, not zero.' : 'Titik panas hari ini tidak dapat dibaca: jumlahnya tidak diketahui, bukan nol.']);
      expect(d.head.read).toBe(lang === 'en' ? 'Data not read' : 'Data tidak terbaca');
      expect(d.situation.facts[0]!.lead).toBe(lang === 'en' ? 'Not set.' : 'Belum ditentukan.');
      expect(d.situation.facts.slice(1, 4).map((f) => [f.lead, f.value])).toEqual([[undefined, '–'], [undefined, '–'], [undefined, '–']]);
      expect(d.situation.facts).toHaveLength(5);
      expect(d.week.cells).toBeNull();
      expect(d.again.table).toBeNull();
      expect(d.again.empty).toBeNull();                               // "no place was detected again" would be a claim
      expect(d.again.missing).not.toBeNull();
      expect(text).toContain(d.week.missing!);
      expect(text).not.toMatch(/No place was detected again|Tidak ada lokasi yang terdeteksi lagi/);
      const p = planPaper(i, lang), plan = planText(i, lang);
      expect(p.targets.empty).toBeNull();
      expect(p.targets.missing).not.toBeNull();
      expect([p.sketch, p.crew]).toEqual([null, null]);
      expect(plan).toContain(p.notices[0]!);
      expect(plan).not.toMatch(/No target today|Tidak ada sasaran hari ini/);
    }
  });
  it('say so while the hotspots are still being read', () => {
    const i = input({ live: 'loading', counts: null, week: null, burn: null, level: null });
    const d = dailyPaper(i, 'en');
    expect(d.notices).toEqual(['Reading the newest NASA hotspot files: the numbers are not in yet.']);
    expect(d.situation.facts[0]).toEqual({ label: 'Level (KalenderApi\'s own rule)', value: 'Reading the hotspots…' });
    expect([d.again.missing, d.again.empty]).toEqual(['Reading the hotspots…', null]);
    expect(planPaper(i, 'en').targets.missing).toBe('Reading the hotspots…');
  });
  it('name the satellite whose file was not read', () => {
    expect(dailyPaper(input({ failed: ['MODIS'] }), 'en').notices).toEqual(['Not read this time: MODIS; its count is unknown, not zero.']);
  });
  it('say what an empty week does not prove', () => {
    const i = nothing();
    const d = dailyPaper(i, 'en'), text = dailyReportText(i, 'en');
    expect(d.situation.facts.slice(1, 4).map((f) => [f.lead, f.value])).toEqual([['0', '(VIIRS 0, MODIS 0)'], ['0', '(VIIRS 0, MODIS 0)'], [undefined, 'none in 7 days']]);
    expect(d.again.empty).toBe('No place was detected again this week. That is not proof that every fire is out.');
    expect(d.again.notes).toEqual([]);
    expect(text).toContain('0 · 0 · 0 · 0 · 0 · 0 · 0');
    expect(dailyPaper(i, 'id').again.empty).toBe('Tidak ada lokasi yang terdeteksi lagi minggu ini. Itu bukan bukti semua api sudah padam.');
    const p = planPaper(i, 'en');
    expect(p.targets.empty).toBe('No target today: no place was detected again this week, and none in the last 24 hours. That is not proof that nothing burns; keep the routine patrol.');
    expect(planPaper(i, 'id').targets.empty).toBe('Tidak ada sasaran hari ini: tidak ada lokasi yang terdeteksi lagi minggu ini, dan tidak ada deteksi dalam 24 jam terakhir. Itu bukan bukti tidak ada api; lanjutkan patroli rutin.');
    expect([p.sketch, p.crew, p.peat]).toEqual([null, null, null]);
    expect(planText(i, 'en')).toContain(p.targets.empty!);
    expect(planText(i, 'en')).not.toContain(p.targets.rule);
  });
});

describe('the facts for the AI paragraph', () => {
  it('sends the daily report\'s places detected again, and the plan\'s targets in visiting order', () => {
    const burn = burnSites(POINTS, NOW, tags);
    const daily = askFactsFor('daily', { district: 'Contoh', again_list: [], again_total: 0 }, burn);
    const list = daily.again_list as AskPlace[];
    expect(daily.district).toBe('Contoh');
    expect(daily.again_total).toBe(2);
    expect(list.map((x) => [x.lat, x.kind, x.on_peat, x.days_seen, x.detections, x.night, x.seen_in_last_24h])).toEqual([
      [-3.4, 'persisting', true, 3, 3, 1, true], [-3.2, 'returned', false, 2, 2, 1, false],
    ]);
    expect(list[0]!.first).toBe(new Date(NOW - 51 * HOUR).toISOString());
    expect(list.every((x) => x.order === undefined)).toBe(true);
    const plan = askFactsFor('plan', {}, burn).again_list as AskPlace[];
    expect(plan.map((x) => [x.lat, x.kind, x.order])).toEqual([[-3.4, 'persisting', 1], [-3.2, 'returned', 2], [-3.0, 'single', 3]]);
    expect(plan.map((x) => x.leg_km)).toEqual(visitOrder(planTargets(burn, LIST_ROWS)).map((v) => v.legKm));
    // the fixed heat source is in neither list
    expect([...list, ...plan].some((x) => x.lat === FLARE_AT)).toBe(false);
  });
  it('sends no total while the hotspots are not read', () => {
    expect(askFactsFor('daily', {}, null)).toEqual({ again_list: [], again_total: null });
  });
});

describe('what the officer typed', () => {
  it('is kept by district and day', () => {
    expect(notesKey('kab-contoh', new Date(2026, 10, 21, 9).getTime())).toBe('ka_report:kab-contoh:2026-11-21');
  });
  it('comes back as typed, cut to its length, and anything else gives blanks', () => {
    const typed = emptyNotes();
    typed.daily.ispu = 'x';
    typed.plan.depart = 'y';
    expect(parseNotes(JSON.stringify(typed))).toEqual(typed);
    expect(parseNotes(JSON.stringify({ v: 1, daily: { crews: 'a'.repeat(999), ispu: 7 }, plan: 'no' })).daily.crews).toHaveLength(240);
    for (const raw of [null, undefined, '', 'not json', '[]', '{"v":2,"daily":{"ispu":"x"}}']) expect(parseNotes(raw)).toEqual(emptyNotes());
  });
});

describe('the sketch map', () => {
  it('reads the rings of a polygon and of a multipolygon', () => {
    const ring = [[104, -3], [105, -3], [105, -2], [104, -3]];
    expect(ringsOf({ type: 'Polygon', coordinates: [ring] })).toEqual([ring]);
    expect(ringsOf({ type: 'MultiPolygon', coordinates: [[ring], [ring, ring]] })).toHaveLength(3);
    expect(ringsOf({ type: 'Point', coordinates: [104, -3] })).toEqual([]);
    expect(ringsOf(null)).toEqual([]);
    expect(boundsOf(ring)).toEqual([104, -3, 105, -2]);
    expect(boundsOf([])).toBeNull();
  });
  it('draws a kilometre as long across as up and down, and fits the box inside the frame', () => {
    const f = frameOf([104, -60.5, 105, -59.5], 400, 400, 10);
    // at 60 degrees a degree of longitude is half as long as a degree of latitude
    expect((f.x(105) - f.x(104)) / (f.y(-60.5) - f.y(-59.5))).toBeCloseTo(0.5, 5);
    expect(f.y(-59.5)).toBeCloseTo(10, 5);
    expect(f.height).toBe(400);
    expect(f.kmPerPx).toBeCloseTo(111.195 / 380, 3);
    const wide = frameOf([104, -3.1, 106, -2.9], 400, 300, 10);
    expect(wide.x(104)).toBeCloseTo(10, 5);
    expect(wide.x(106)).toBeCloseTo(390, 5);
    expect(wide.height).toBeLessThan(80);
  });
  it('grows a small box to a least size, and picks a round scale bar', () => {
    const [w, s, e, n] = growBounds([104, -3, 104, -3], 4, 0);
    expect((n - s) * 111.195).toBeCloseTo(4, 5);
    expect((e - w) * 111.195 * Math.cos((3 * Math.PI) / 180)).toBeCloseTo(4, 5);
    expect(growBounds([104, -3, 105, -2], 4, 0.1)).toEqual([103.9, -3.1, 105.1, -1.9]);
    expect(scaleBarKm(0.37, 100)).toBe(20);
    expect(scaleBarKm(0.012, 100)).toBe(1);
    expect(scaleBarKm(0.004, 100)).toBe(0.2);
  });
});
