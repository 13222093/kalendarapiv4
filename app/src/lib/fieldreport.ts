// KalenderApi (new file): the two papers of "Today in my district" (#/report, pages/FieldReport.tsx): the daily fire
// report and the draft field check plan, the two shapes a disaster office works with every day.
// Plain functions of what the Today page already holds (useNowModel in pages/Now.tsx). One input object makes a paper
// (dailyPaper, planPaper); the page draws that paper and the text for WhatsApp (dailyReportText, planText) is written
// from the same paper, so a number on the page is the same number in the text. Nothing is made here: what the
// satellites do not give (burned area, crews, aircraft, water, weather, air quality) is a blank the officer fills in.
// A hotspot is a satellite's detection of heat, not a confirmed fire and not burned area. "Detected again" never says
// that a fire burned between two detections, or that two detections are the same fire. The level, the list and the
// visiting order are our own rules, not an official status or procedure.
import { fmtNumber, locale, type Lang } from './lang.ts';
import {
  LEVEL_NAME, SENSOR_LABEL, STATUS_NAME, pointMs, wib,
  type Level, type LiveCounts, type MonthFact, type PeatSite,
} from './now.ts';
import {
  AGAIN_HOURS, SITE_JOIN_KM, againSites, distanceKm, fixedSites, pastSiteNear, planTargets, visitOrder,
  type BurnSite, type FixedKind, type SiteKind, type Visit,
} from './burnsites.ts';
import { clockWib, localDay, rowTitle, type ConsoleState, type DayBin, type QueueRow, type Reply, type RowKind } from './nowconsole.ts';
import { reportHref, type ReportDoc } from './todayview.ts';

/** Places listed in a table (public/api/ask.js takes as many). */
export const LIST_ROWS = 8;
/** Past-season peat sites named on a paper. */
export const PEAT_ROWS = 3;
/** Known fixed heat sources named in the "left out" line. */
export const FIXED_ROWS = 5;
/** "within N km" is written for a site whose detections spread farther than this from its centre. */
export const SPREAD_KM = 0.3;

// ------------------------------------------------------------------------------------------------ what the officer types

export const DAILY_FIELDS = ['area', 'areaSource', 'crews', 'air', 'rain', 'ispu', 'notes'] as const;
export const PLAN_FIELDS = ['crew', 'vehicles', 'water', 'air', 'contact', 'depart'] as const;
export type DailyField = typeof DAILY_FIELDS[number];
export type PlanField = typeof PLAN_FIELDS[number];
/** What the officer typed into the blanks, by paper. It lives in the browser only (localStorage, by district and day). */
export interface OfficerNotes { v: 1; daily: Record<DailyField, string>; plan: Record<PlanField, string> }

const FIELD_MAX = 240, NOTES_MAX = 1200;
export const fieldMax = (key: string): number => (key === 'notes' ? NOTES_MAX : FIELD_MAX);
export const emptyNotes = (): OfficerNotes => ({
  v: 1,
  daily: { area: '', areaSource: '', crews: '', air: '', rain: '', ispu: '', notes: '' },
  plan: { crew: '', vehicles: '', water: '', air: '', contact: '', depart: '' },
});
/** The storage key of the blanks: one set per district per day on this device's clock (as the command view's queue). */
export const notesKey = (aoiId: string, nowMs: number): string => `ka_report:${aoiId}:${localDay(nowMs)}`;
/** What was stored, checked: anything that is not a set of these blanks gives empty ones. */
export function parseNotes(raw: string | null | undefined): OfficerNotes {
  const out = emptyNotes();
  if (!raw) return out;
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return out; }
  if (!body || typeof body !== 'object' || (body as { v?: unknown }).v !== 1) return out;
  const b = body as Record<string, unknown>;
  const take = (from: unknown, key: string): string => {
    const v = from && typeof from === 'object' ? (from as Record<string, unknown>)[key] : undefined;
    return typeof v === 'string' ? v.slice(0, fieldMax(key)) : '';
  };
  for (const k of DAILY_FIELDS) out.daily[k] = take(b.daily, k);
  for (const k of PLAN_FIELDS) out.plan[k] = take(b.plan, k);
  return out;
}

// ------------------------------------------------------------------------------------------------ the input

/** The decisions the command view recorded today for this district (lib/nowconsole.ts, read from its storage). */
export interface ReportDecisions {
  approvedMs: number | null; sentMs: number | null; held: boolean;
  reply: Reply | null; repliedMs: number | null;
  done: RowKind[];        // the queue rows the office ticked as done
  doneOther: number;      // other entries ticked today that are no longer rows of the queue
}
/** The stored state as the paper needs it. `rows` is the queue as the command view would draw it now (queueRows). */
export function decisionsOf(s: ConsoleState, rows: QueueRow[]): ReportDecisions {
  return {
    approvedMs: s.alert.times.approved ?? null, sentMs: s.alert.times.sent ?? null, held: s.alert.held,
    reply: s.alert.reply, repliedMs: s.alert.times.replied ?? null,
    done: rows.filter((r) => r.kind !== 'village' && r.kind !== 'reread' && s.done.includes(r.id)).map((r) => r.kind),
    doneOther: s.done.filter((id) => !rows.some((r) => r.id === id)).length,
  };
}

export type LiveRead = 'loading' | 'ok' | 'unavailable';
/** The optional paragraph an AI model wrote (public/api/ask.js, task mode), as the officer left it after editing. */
export interface ReportSummary { text: string; model: string | null; atMs: number | null }
export interface ReportPeat { season: number | null; provisional: boolean; total: number | null; sites: PeatSite[] }

/** Everything the two papers say, as the Today page holds it. The words that come from the page (`place`, `levelWhy`,
 *  the month's names) are in the reader's language already; `lang` picks the paper's own words. */
export interface ReportInput {
  aoiId: string;
  place: string;                   // "Pulang Pisau district" / "Kabupaten Pulang Pisau"
  province: string;
  site: string;                    // the address of this copy of the app up to its '#': origin and path
  nowMs: number;                   // when the hotspots were read (the device's clock while they are not)
  live: LiveRead;
  failed: string[];                // the satellites whose file was not read this time
  counts: LiveCounts | null;       // null: the hotspots are not read
  level: Level | null;
  levelWhy: string;                // the Today page's sentence for the level (whyText[result.why])
  month: (MonthFact & { nrt: boolean }) | null;
  week: DayBin[] | null;           // sevenDays of the district
  burn: BurnSite[] | null;         // the district's sites of the last 7 days (lib/burnsites.ts)
  peat: ReportPeat | null;         // peat sites of a past season, where the district has them
  decisions: ReportDecisions | null;
  officer: OfficerNotes;
  summary: Partial<Record<ReportDoc, ReportSummary | null>>;
}

// ------------------------------------------------------------------------------------------------ the papers

/** A labelled line. `lead` is the part a page sets in bold (a count, the level's name). */
export interface Fact { label: string; lead?: string; value: string }
/** `numeric`: the columns set as numerals. `whole`: the columns whose cells stay on one line (a time, a coordinate). */
export interface PaperTable { head: string[]; rows: string[][]; numeric: boolean[]; whole: boolean[] }
export interface PaperHead { org: string; title: string; place: string; date: string; read: string; source: string; draft: string }
export interface SummaryBlock { title: string; text: string; by: string }
export interface OfficerBlock { n: number; title: string; note: string; blank: string; fields: { key: string; label: string; value: string }[] }
/** `numbered`: the items are the first of a ranked list (else each names the target it belongs to). */
export interface PeatBlock { n: number; title: string; lead: string; items: string[]; numbered: boolean; tail: string | null }
/** A list of places: as a table for the page and as short lines for the text, row for row the same values. */
export interface PlacesBlock {
  n: number; title: string;
  table: PaperTable | null; lines: string[]; sites: BurnSite[];
  more: string | null;             // "8 of N", when the list is longer than the table
  empty: string | null;            // read, and nothing to list
  missing: string | null;          // not read (or still reading): nothing can be said
  notes: string[];                 // the rule, the peat footnote, the fixed heat sources left out
}
export interface WeekCell { label: string; n: string; total: number; viirs: number; modis: number }

export interface DailyPaper {
  doc: 'daily'; lang: Lang;
  head: PaperHead; notices: string[]; summary: SummaryBlock | null;
  situation: { n: number; title: string; facts: Fact[]; note: string };
  week: { n: number; title: string; note: string; cells: WeekCell[] | null; missing: string | null };
  again: PlacesBlock;
  peat: PeatBlock | null;
  decisions: { n: number; title: string; items: string[]; empty: string | null; note: string | null };
  officer: OfficerBlock;
  closing: string[];
  address: string;
}
export interface PlanPaper {
  doc: 'plan'; lang: Lang;
  head: PaperHead; notices: string[]; summary: SummaryBlock | null;
  targets: PlacesBlock & { visits: Visit[]; rule: string };
  sketch: { n: number; title: string; caption: string } | null;
  peat: PeatBlock | null;
  crew: { n: number; title: string; head: string[]; rows: string[]; yesNo: string; line: string } | null;
  officer: OfficerBlock;
  closing: string[];
  address: string;
}

const L = (lang: Lang, en: string, id: string) => (lang === 'id' ? id : en);
const c4 = (x: number) => x.toFixed(4);
const c3 = (x: number) => x.toFixed(3);
const DASH = '–';

/** "21 November 2026" (or "21 Nov 2026"): the day in Western Indonesia Time, as every time on the page. */
export function dayWib(ms: number, lang: Lang, month: 'long' | 'short' = 'long'): string {
  return new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month, year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(ms));
}
/** "20 Nov, 23:30 WIB": a time inside the last seven days, where the year would only take room (WIB, as wib()). */
export function wibShort(ms: number, lang: Lang): string {
  const s = new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }).format(new Date(ms));
  return `${s} WIB`;
}
/** "20–21 Nov": the 24 hours of one bin, by the days (WIB) it starts and ends on. */
function binLabel(b: DayBin, lang: Lang): string {
  const f = (ms: number, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale(lang), { ...o, timeZone: 'Asia/Jakarta' }).format(new Date(ms));
  const d1 = f(b.fromMs, { day: 'numeric' }), d2 = f(b.toMs, { day: 'numeric' });
  const m1 = f(b.fromMs, { month: 'short' }), m2 = f(b.toMs, { month: 'short' });
  return m1 === m2 ? `${d1}–${d2} ${m2}` : `${d1} ${m1}–${d2} ${m2}`;
}

/** "38 hours" up to two days, then "2.5 days": the longest time without a detection at a site. */
export function gapWords(hours: number, lang: Lang): string {
  if (hours < 48) return L(lang, `${fmtNumber(Math.round(hours), lang)} hours`, `${fmtNumber(Math.round(hours), lang)} jam`);
  const d = Math.round((hours / 24) * 10) / 10;
  return L(lang, `${fmtNumber(d, lang, d % 1 ? 1 : 0)} days`, `${fmtNumber(d, lang, d % 1 ? 1 : 0)} hari`);
}

/** Why a site is listed, in the words the science allows. A site detected again 18 hours or more apart can still fall
 *  inside one 24-hour bin of the week (yesterday's afternoon pass and today's): it is then worded by the hours. */
export function statusWords(s: Pick<BurnSite, 'kind' | 'gapHours' | 'daysSeen' | 'spanHours' | 'fresh'>, lang: Lang): string {
  const n = (v: number) => fmtNumber(v, lang);
  if (s.kind === 'returned') return L(lang, `came back after ${gapWords(s.gapHours, lang)} with no detection`, `muncul lagi setelah ${gapWords(s.gapHours, lang)} tanpa deteksi`);
  if (s.kind === 'persisting') {
    return s.daysSeen >= 2 ? L(lang, `detected on ${n(s.daysSeen)} of 7 days`, `terdeteksi pada ${n(s.daysSeen)} dari 7 hari`)
      : L(lang, `detected again ${n(Math.round(s.spanHours))} hours after the first detection`, `terdeteksi lagi ${n(Math.round(s.spanHours))} jam setelah deteksi pertama`);
  }
  return s.fresh ? L(lang, 'detected in the last 24 hours', 'terdeteksi dalam 24 jam terakhir') : L(lang, 'detected on one day', 'terdeteksi pada satu hari');
}

// NASA's archive types a flare that stands on the shore as "offshore" (the Balikpapan refinery): inside a district it
// is industry or a gas flare like the others, so both kinds take the same words.
const FIXED_WORD: Record<FixedKind, { en: string; id: string }> = {
  volcano: { en: 'volcano', id: 'gunung api' },
  static: { en: 'industry or gas flare', id: 'industri atau suar gas' },
  offshore: { en: 'industry or gas flare', id: 'industri atau suar gas' },
};
/** The one line about the known fixed heat sources the lists leave out (lib/burnsites.ts fixedSites), or null. */
export function fixedLine(burn: BurnSite[] | null, lang: Lang): string | null {
  const fx = fixedSites(burn ?? []);
  if (!fx.length) return null;
  const n = (v: number) => fmtNumber(v, lang);
  const shown = fx.slice(0, FIXED_ROWS).map((s) => `${c4(s.lat)}, ${c4(s.lon)} (${FIXED_WORD[s.fixed!][lang]})`).join('; ');
  const rest = fx.length - FIXED_ROWS;
  const more = rest > 0 ? L(lang, `; and ${n(rest)} more`, `; dan ${n(rest)} lainnya`) : '';
  return L(lang,
    `Left out: ${n(fx.length)} known fixed heat source${fx.length === 1 ? '' : 's'} (industry, a gas flare or a volcano in NASA's archive): ${shown}${more}. Seen day after day and not a land fire.`,
    `Tidak dimasukkan: ${n(fx.length)} sumber panas tetap yang sudah dikenal (industri, suar gas, atau gunung api dalam arsip NASA): ${shown}${more}. Terdeteksi tiap hari dan bukan kebakaran lahan.`);
}
const peatFootnote = (lang: Lang) => L(lang,
  'Peat: the national peat map, 1:250,000 (Ministry of Agriculture, 2011). It marks a place on the map, not a detected peat fire.',
  'Gambut: peta lahan gambut nasional skala 1:250.000 (Kementerian Pertanian, 2011). Ini menandai lokasi pada peta, bukan api gambut yang terdeteksi.');
const againRule = (lang: Lang) => L(lang,
  `Detected again: the satellites detected heat at the same place (within ${SITE_JOIN_KM} km) at times ${AGAIN_HOURS} hours or more apart. That does not say the fire burned in between, or that it is the same fire: only a check on the ground can tell. Our own rule, not an official status.`,
  `Terdeteksi lagi: satelit mendeteksi panas di lokasi yang sama (dalam ${SITE_JOIN_KM} km) pada waktu yang berjarak ${AGAIN_HOURS} jam atau lebih. Itu tidak menyatakan api menyala di antaranya, atau bahwa itu api yang sama: hanya pengecekan di lapangan yang dapat memastikan. Aturan kami sendiri, bukan status resmi.`);
const peatWords = (p: PeatSite, lang: Lang) => L(lang,
  `detected on ${fmtNumber(p.days, lang)} days, came back ${fmtNumber(p.comeBacks, lang)} time${p.comeBacks === 1 ? '' : 's'}`,
  `terdeteksi ${fmtNumber(p.days, lang)} hari, muncul lagi ${fmtNumber(p.comeBacks, lang)} kali`);

function headOf(i: ReportInput, doc: ReportDoc, lang: Lang): PaperHead {
  return {
    org: L(lang, 'KalenderApi · NASA satellite hotspots (MODIS and VIIRS), Indonesia', 'KalenderApi · titik panas satelit NASA (MODIS dan VIIRS), Indonesia'),
    title: doc === 'daily' ? L(lang, 'Daily fire report', 'Laporan harian karhutla') : L(lang, 'Draft field check plan', 'Draf rencana cek lapangan'),
    place: i.province ? `${i.place}, ${i.province}` : i.place,
    date: dayWib(i.nowMs, lang),
    read: i.live === 'ok' ? L(lang, `Data read ${wib(i.nowMs, lang)}`, `Data dibaca ${wib(i.nowMs, lang)}`)
      : i.live === 'loading' ? L(lang, 'Reading the newest NASA hotspot files…', 'Membaca berkas titik panas NASA terbaru…')
        : L(lang, 'Data not read', 'Data tidak terbaca'),
    source: L(lang, 'Source: NASA FIRMS (VIIRS NOAA-20, VIIRS NOAA-21, MODIS)', 'Sumber: NASA FIRMS (VIIRS NOAA-20, VIIRS NOAA-21, MODIS)'),
    draft: doc === 'daily'
      ? L(lang, 'A draft from KalenderApi, from satellite data. Not an official report.', 'Draf dari KalenderApi, dari data satelit. Bukan laporan resmi.')
      : L(lang, 'A draft from satellite data, to be discussed. Not an official field plan (renlap): aircraft routes, water sources and equipment are filled in by the officer.',
        'Draf dari data satelit untuk dibahas. Bukan renlap resmi: jalur pesawat, sumber air, dan peralatan diisi oleh petugas.'),
  };
}
function noticesOf(i: ReportInput, lang: Lang): string[] {
  if (i.live === 'loading') return [L(lang, 'Reading the newest NASA hotspot files: the numbers are not in yet.', 'Membaca berkas titik panas NASA terbaru: angkanya belum masuk.')];
  if (i.live === 'unavailable') return [L(lang, 'Today\'s hotspots could not be read: the counts are unknown, not zero.', 'Titik panas hari ini tidak dapat dibaca: jumlahnya tidak diketahui, bukan nol.')];
  return i.failed.length
    ? [L(lang, `Not read this time: ${i.failed.join(', ')}; its count is unknown, not zero.`, `Tidak terbaca kali ini: ${i.failed.join(', ')}; jumlahnya tidak diketahui, bukan nol.`)]
    : [];
}
function summaryOf(i: ReportInput, doc: ReportDoc, lang: Lang): SummaryBlock | null {
  const s = i.summary[doc];
  const text = s?.text.trim();
  if (!s || !text) return null;
  const model = s.model ? ` (${s.model})` : '';
  const at = s.atMs != null ? `, ${wib(s.atMs, lang)}` : '';
  return {
    title: L(lang, 'Summary (AI draft)', 'Ringkasan (draf AI)'), text,
    by: L(lang, `Written by AI${model} from the numbers on this paper${at}. Check it before you use it.`, `Ditulis AI${model} dari angka di lembar ini${at}. Periksa sebelum dipakai.`),
  };
}
function officerOf(n: number, doc: ReportDoc, notes: OfficerNotes, lang: Lang): OfficerBlock {
  const daily: Record<DailyField, string> = {
    area: L(lang, 'Burned area (ha)', 'Luas terbakar (ha)'),
    areaSource: L(lang, 'Source of the burned area figure', 'Sumber angka luas terbakar'),
    crews: L(lang, 'Ground crews sent', 'Regu darat yang dikerahkan'),
    air: L(lang, 'Water bombing / air operations', 'Water bombing / operasi udara'),
    rain: L(lang, 'Rain or weather modification', 'Hujan atau modifikasi cuaca'),
    ispu: L(lang, 'Air quality (ISPU)', 'Kualitas udara (ISPU)'),
    notes: L(lang, 'Notes', 'Catatan'),
  };
  const plan: Record<PlanField, string> = {
    crew: L(lang, 'Crew and number of people', 'Regu dan jumlah personel'),
    vehicles: L(lang, 'Vehicles', 'Kendaraan'),
    water: L(lang, 'Nearest water source', 'Sumber air terdekat'),
    air: L(lang, 'Air support and route', 'Dukungan udara dan jalur'),
    contact: L(lang, 'Contact', 'Kontak'),
    depart: L(lang, 'Departure time', 'Waktu berangkat'),
  };
  return {
    n, title: L(lang, 'To be filled in by the officer', 'Diisi petugas'),
    note: L(lang, 'KalenderApi has no data for these.', 'KalenderApi tidak punya data untuk bagian ini.'),
    blank: L(lang, '(not filled in)', '(belum diisi)'),
    fields: doc === 'daily' ? DAILY_FIELDS.map((key) => ({ key, label: daily[key], value: notes.daily[key].trim() }))
      : PLAN_FIELDS.map((key) => ({ key, label: plan[key], value: notes.plan[key].trim() })),
  };
}
const addressOf = (i: ReportInput, doc: ReportDoc, lang: Lang) => `${i.site}${reportHref(i.aoiId, doc)}${lang === 'id' ? '&lang=id' : ''}`;
const notRead = (i: ReportInput, lang: Lang, unknown: [string, string]): string | null => (
  i.live === 'loading' ? L(lang, 'Reading the hotspots…', 'Membaca titik panas…') : i.burn ? null : L(lang, unknown[0], unknown[1]));

/** The daily fire report of a district. */
export function dailyPaper(i: ReportInput, lang: Lang): DailyPaper {
  const num = (v: number, digits = 0) => fmtNumber(v, lang, digits);
  const c = i.counts;
  let n = 0;

  // ---- 1. the situation
  const split = (by: LiveCounts['by24']) => `(VIIRS ${num(by.N20 + by.N21)}, MODIS ${num(by.MODIS)})`;
  const newest = c?.newest ?? null;
  const m = i.month;
  const usual = m && m.median != null ? num(m.median, m.median % 1 ? 1 : 0) : null;
  // The counts (and so the level) are of every detection, also those at a known fixed heat source that the list of
  // section 3 leaves out (a refinery flare, a smelter, a volcano): the report says how many of them are of that kind.
  const fx = fixedSites(i.burn ?? []);
  const fx24 = fx.reduce((a, s) => a + (s.bins[6] ?? 0), 0), fx7 = fx.reduce((a, s) => a + s.detections, 0);
  // the district's newest detection belongs to such a site: detected at the site's last time, within its spread
  // (two detections of one pass share a time, so the points themselves cannot be compared)
  const newestFixed = !!newest && fx.some((s) => s.lastMs === pointMs(newest) && distanceKm(s.lat, s.lon, newest[1], newest[0]) <= s.radiusKm + 0.06);
  const facts: Fact[] = [
    {
      label: L(lang, 'Level (KalenderApi\'s own rule)', 'Tingkat (aturan KalenderApi sendiri)'),
      ...(i.live === 'loading' ? { value: L(lang, 'Reading the hotspots…', 'Membaca titik panas…') }
        : { lead: `${i.level ? LEVEL_NAME[i.level][lang] : L(lang, 'Not set', 'Belum ditentukan')}.`, value: i.levelWhy }),
    },
    { label: L(lang, 'Hotspots, last 24 hours', 'Titik panas, 24 jam terakhir'), ...(c ? { lead: num(c.total24), value: split(c.by24) } : { value: DASH }) },
    { label: L(lang, 'Hotspots, last 7 days', 'Titik panas, 7 hari terakhir'), ...(c ? { lead: num(c.total7), value: split(c.by7) } : { value: DASH }) },
    ...(c && fx.length ? [{
      label: L(lang, 'Of these, at a known fixed heat source', 'Di antaranya, di sumber panas tetap'),
      value: L(lang,
        `${num(fx24)} in the last 24 hours and ${num(fx7)} in the last 7 days (industry, a gas flare or a volcano: not a land fire). The counts and the level include them.`,
        `${num(fx24)} dalam 24 jam terakhir dan ${num(fx7)} dalam 7 hari terakhir (industri, suar gas, atau gunung api: bukan kebakaran lahan). Jumlah dan tingkat ikut menghitungnya.`),
    }] : []),
    {
      label: L(lang, 'Newest detection', 'Deteksi terbaru'),
      value: !c ? DASH : newest ? `${wib(pointMs(newest), lang)} · ${SENSOR_LABEL[newest[4]]} · ${c4(newest[1])}, ${c4(newest[0])}${newestFixed ? L(lang, ' · at a known fixed heat source', ' · di sumber panas tetap yang sudah dikenal') : ''}`
        : L(lang, 'none in 7 days', 'tidak ada dalam 7 hari'),
    },
    {
      label: L(lang, 'This month on one scale (MODIS + VIIRS)', 'Bulan ini pada satu skala (MODIS + VIIRS)'),
      value: !m ? DASH : L(lang,
        `${m.label}${m.partial ? ' so far' : ''}: ${num(m.H, 1)} fire cell-days${usual ? `; the usual ${m.monthOnly}: ${usual}` : ''}${m.status ? `; ${STATUS_NAME[m.status].en}` : ''}${m.higherPct != null ? ` (higher than ${num(m.higherPct)}% of earlier ${m.monthOnly}s)` : ''}${m.nrt ? '; near-real-time data, provisional' : ''}`,
        `${m.label}${m.partial ? ' sejauh ini' : ''}: ${num(m.H, 1)} sel-hari api${usual ? `; ${m.monthOnly} biasanya: ${usual}` : ''}${m.status ? `; ${STATUS_NAME[m.status].id}` : ''}${m.higherPct != null ? ` (lebih tinggi dari ${num(m.higherPct)}% ${m.monthOnly} tahun-tahun sebelumnya)` : ''}${m.nrt ? '; data waktu hampir nyata, sementara' : ''}`),
    },
  ];
  const situation = {
    n: ++n, title: L(lang, 'Situation', 'Situasi'), facts,
    note: L(lang,
      'A hotspot is one satellite detection of heat: not a confirmed fire and not burned area. A fire cell-day is a cell of about 1.1 km with a hotspot on one day; a district\'s value is an approximate share of its province\'s record.',
      'Titik panas adalah satu deteksi panas oleh satelit: bukan kebakaran yang terkonfirmasi dan bukan luas terbakar. Sel-hari api adalah sel berukuran sekitar 1,1 km dengan titik panas pada satu hari; nilai kabupaten adalah pembagian perkiraan dari catatan provinsinya.'),
  };

  // ---- 2. the last seven days
  const week = {
    n: ++n, title: L(lang, 'Last 7 days', '7 hari terakhir'),
    note: L(lang, 'Hotspots in the district per 24 hours before the read time, oldest first. Past detections, not a forecast.',
      'Titik panas di kabupaten per 24 jam sebelum waktu baca, terlama dulu. Deteksi yang sudah terjadi, bukan prakiraan.'),
    cells: i.week ? i.week.map((b) => ({ label: binLabel(b, lang), n: num(b.total), total: b.total, viirs: b.viirs, modis: b.modis })) : null,
    missing: i.week ? null : i.live === 'loading' ? L(lang, 'Reading the hotspots…', 'Membaca titik panas…')
      : L(lang, 'Not read: the hotspots of these days are unknown, not zero.', 'Tidak terbaca: titik panas pada hari-hari ini tidak diketahui, bukan nol.'),
  };

  // ---- 3. the places detected again
  const all = againSites(i.burn ?? []);
  const sites = all.slice(0, LIST_ROWS);
  const rows = sites.map((s, k) => {
    const status = statusWords(s, lang);
    const peat = s.onPeat === true;
    const last = wibShort(s.lastMs, lang);
    const night = L(lang, `${num(s.night)} of ${num(s.detections)}`, `${num(s.night)} dari ${num(s.detections)}`);
    const frp = s.frpMax != null ? num(s.frpMax, 1) : DASH;
    const days = s.kind === 'persisting' && s.daysSeen >= 2 ? null : L(lang, `seen on ${num(s.daysSeen)} of 7 days`, `terdeteksi pada ${num(s.daysSeen)} dari 7 hari`);
    return {
      cells: [String(k + 1), c4(s.lat), c4(s.lon), num(s.daysSeen), peat ? `${status}; ${L(lang, 'on mapped peat', 'di lahan gambut (peta)')}` : status, last.replace(' WIB', ''), night, frp],
      line: [
        `${k + 1}. ${c4(s.lat)}, ${c4(s.lon)}`, status, ...(days ? [days] : []), ...(peat ? [L(lang, 'mapped peat', 'gambut (peta)')] : []),
        L(lang, `last ${last}`, `terakhir ${last}`), L(lang, `night ${night}`, `malam ${night}`),
        ...(s.frpMax != null ? [L(lang, `highest ${frp} MW`, `tertinggi ${frp} MW`)] : []),
      ].join(' · '),
    };
  });
  const fixed = fx.length ? fixedLine(i.burn, lang) : null;
  const again: PlacesBlock = {
    n: ++n, title: L(lang, 'Still burning? Places detected again', 'Belum padam? Lokasi yang terdeteksi lagi'),
    table: rows.length ? {
      head: [
        'No.', L(lang, 'Latitude', 'Lintang'), L(lang, 'Longitude', 'Bujur'), L(lang, 'Days seen (of\u00a07)', 'Hari terdeteksi (dari\u00a07)'), 'Status',
        L(lang, 'Last detected (WIB)', 'Terakhir terdeteksi (WIB)'), L(lang, 'Night detections', 'Deteksi malam'), L(lang, 'Highest fire power (MW)', 'Daya api tertinggi (MW)'),
      ],
      rows: rows.map((r) => r.cells), numeric: [true, true, true, true, false, false, true, true], whole: [true, true, true, true, false, true, true, true],
    } : null,
    lines: rows.map((r) => r.line), sites,
    more: all.length > sites.length ? L(lang, `${num(sites.length)} of ${num(all.length)} places are listed, the most pressing first.`, `${num(sites.length)} dari ${num(all.length)} lokasi ditampilkan, yang paling mendesak lebih dulu.`) : null,
    empty: i.burn && !all.length ? L(lang, 'No place was detected again this week. That is not proof that every fire is out.', 'Tidak ada lokasi yang terdeteksi lagi minggu ini. Itu bukan bukti semua api sudah padam.') : null,
    missing: notRead(i, lang, ['Not read: whether a place was detected again is unknown.', 'Tidak terbaca: tidak diketahui apakah ada lokasi yang terdeteksi lagi.']),
    notes: [...(rows.length ? [againRule(lang)] : []), ...(sites.some((s) => s.onPeat === true) ? [peatFootnote(lang)] : []), ...(fixed ? [fixed] : [])],
  };

  // ---- 4. peat sites of a past season (only where the district has them)
  const p = i.peat && i.peat.sites.length ? i.peat : null;
  const peatTop = p ? p.sites.slice(0, PEAT_ROWS) : [];
  const peatTotal = p ? p.total ?? p.sites.length : 0;
  const peat: PeatBlock | null = p ? {
    n: ++n, title: L(lang, 'Peat sites to re-check (past season)', 'Lokasi gambut untuk dicek ulang (musim lalu)'),
    lead: L(lang,
      `${num(peatTotal)} peat site${peatTotal === 1 ? '' : 's'} in the August to October ${p.season ?? ''} season${p.provisional ? ' (provisional)' : ''}: places where fire was detected on three or more days, or again after a gap, in that season. A past season's record, not places burning now. The first ${num(peatTop.length)} of the list:`,
      `${num(peatTotal)} lokasi gambut pada musim Agustus sampai Oktober ${p.season ?? ''}${p.provisional ? ' (sementara)' : ''}: tempat api terdeteksi pada tiga hari atau lebih, atau terdeteksi lagi setelah jeda, pada musim itu. Ini catatan musim lalu, bukan tempat yang sedang terbakar sekarang. ${num(peatTop.length)} lokasi pertama dalam daftar:`).replace(/ {2,}/g, ' '),
    items: peatTop.map((s) => `${c3(s.lat)}, ${c3(s.lon)} · ${peatWords(s, lang)}`),
    numbered: true, tail: null,
  } : null;

  // ---- 5. the decisions the command view recorded today
  const d = i.decisions;
  const items: string[] = [];
  if (d) {
    const at = (ms: number | null) => (ms != null ? `${clockWib(ms)} WIB` : DASH);
    if (d.approvedMs != null) {
      items.push(L(lang,
        `Village alert: approved at ${at(d.approvedMs)}${d.sentMs != null ? `, marked sent at ${at(d.sentMs)}` : ''}.`,
        `Peringatan desa: disetujui pukul ${at(d.approvedMs)}${d.sentMs != null ? `, ditandai terkirim pukul ${at(d.sentMs)}` : ''}.`));
    } else if (d.held) items.push(L(lang, 'Village alert: held, not approved.', 'Peringatan desa: ditahan, belum disetujui.'));
    if (d.reply === 'read') items.push(L(lang, `Read: a resident replied "I have read it" at ${at(d.repliedMs)}.`, `Dibaca: seorang warga membalas "Sudah saya baca" pukul ${at(d.repliedMs)}.`));
    if (d.reply === 'fire') {
      const checked = d.done.includes('resident');
      items.push(L(lang,
        `A resident replied "I see fire" at ${at(d.repliedMs)}: ${checked ? 'marked checked.' : 'to be checked on the ground.'}`,
        `Seorang warga membalas "Saya melihat api" pukul ${at(d.repliedMs)}: ${checked ? 'ditandai sudah dicek.' : 'perlu dicek di lapangan.'}`));
    }
    for (const kind of d.done) {
      const title = rowTitle(kind, (en, idn) => L(lang, en, idn));
      if (kind !== 'resident') items.push(L(lang, `Marked done: ${title}.`, `Ditandai selesai: ${title}.`));
    }
    if (d.doneOther > 0) {
      items.push(L(lang,
        `${num(d.doneOther)} earlier item${d.doneOther === 1 ? '' : 's'} marked done (no longer in the queue).`,
        `${num(d.doneOther)} butir sebelumnya ditandai selesai (sudah tidak ada di antrean).`));
    }
  }
  const decisions = {
    n: ++n, title: L(lang, 'Decisions recorded today', 'Keputusan yang dicatat hari ini'), items,
    empty: items.length ? null : L(lang, 'No decision has been recorded in the command view today.', 'Belum ada keputusan yang dicatat di tampilan komando hari ini.'),
    note: items.length ? L(lang,
      'As recorded in the command view on this device. Its village thread is a demo: KalenderApi itself sent and received nothing.',
      'Sesuai catatan tampilan komando di perangkat ini. Utas desa di sana adalah demo: KalenderApi sendiri tidak mengirim atau menerima apa pun.') : null,
  };

  return {
    doc: 'daily', lang, head: headOf(i, 'daily', lang), notices: noticesOf(i, lang), summary: summaryOf(i, 'daily', lang),
    situation, week, again, peat, decisions, officer: officerOf(++n, 'daily', i.officer, lang),
    closing: [
      L(lang, 'Under thick cloud or smoke the satellites cannot detect fire (NASA FIRMS): a zero on such a day means \'not observed\', not \'no fire\'.',
        'Di bawah awan atau asap tebal, satelit tidak dapat mendeteksi api (NASA FIRMS): nol pada hari seperti itu berarti \'tidak teramati\', bukan \'tidak ada api\'.'),
      L(lang, 'Level: our own rule, not an official status.', 'Tingkat: aturan kami sendiri, bukan status resmi.'),
    ],
    address: addressOf(i, 'daily', lang),
  };
}

/** The draft field check plan of a district. */
export function planPaper(i: ReportInput, lang: Lang): PlanPaper {
  const num = (v: number, digits = 0) => fmtNumber(v, lang, digits);
  let n = 0;

  // ---- 1. the targets, in visiting order
  const total = planTargets(i.burn ?? [], Number.MAX_SAFE_INTEGER).length;
  const visits = visitOrder(planTargets(i.burn ?? [], LIST_ROWS));
  const rows = visits.map((v, k) => {
    const s = v.site;
    const peat = s.onPeat === true;
    const spread = s.radiusKm > SPREAD_KM ? L(lang, `detections within ${num(s.radiusKm, 1)} km`, `deteksi dalam ${num(s.radiusKm, 1)} km`) : null;
    const why = [statusWords(s, lang), ...(peat ? [L(lang, 'on mapped peat', 'di lahan gambut (peta)')] : []), ...(spread ? [spread] : [])].join('; ');
    const last = wibShort(s.lastMs, lang);
    const night = L(lang, `${num(s.night)} of ${num(s.detections)}`, `${num(s.night)} dari ${num(s.detections)}`);
    const frp = s.frpMax != null ? num(s.frpMax, 1) : DASH;
    const leg = v.legKm == null ? L(lang, 'start', 'awal') : num(v.legKm, 1);
    return {
      cells: [String(k + 1), why, `${c4(s.lat)}, ${c4(s.lon)}`, last.replace(' WIB', ''), num(s.daysSeen), night, frp, leg],
      line: [
        `${k + 1}. ${c4(s.lat)}, ${c4(s.lon)}`, statusWords(s, lang), ...(peat ? [L(lang, 'mapped peat', 'gambut (peta)')] : []), ...(spread ? [spread] : []),
        L(lang, `last ${last}`, `terakhir ${last}`), L(lang, `seen on ${num(s.daysSeen)} of 7 days`, `terdeteksi pada ${num(s.daysSeen)} dari 7 hari`),
        L(lang, `night ${night}`, `malam ${night}`), ...(s.frpMax != null ? [L(lang, `highest ${frp} MW`, `tertinggi ${frp} MW`)] : []),
        v.legKm == null ? L(lang, 'start here', 'mulai di sini') : L(lang, `${leg} km from the stop before`, `${leg} km dari titik sebelumnya`),
      ].join(' · '),
    };
  });
  const fixed = fixedLine(i.burn, lang);
  const sites = visits.map((v) => v.site);
  const targets: PlanPaper['targets'] = {
    n: ++n, title: L(lang, 'Targets, in visiting order', 'Sasaran, menurut urutan kunjungan'),
    table: rows.length ? {
      head: [
        'No.', L(lang, 'Why it is on the list', 'Alasan masuk daftar'), L(lang, 'Latitude, longitude', 'Lintang, bujur'), L(lang, 'Last detected (WIB)', 'Terakhir terdeteksi (WIB)'),
        L(lang, 'Days seen (of\u00a07)', 'Hari terdeteksi (dari\u00a07)'), L(lang, 'Night detections', 'Deteksi malam'), L(lang, 'Highest fire power (MW)', 'Daya api tertinggi (MW)'),
        L(lang, 'Km from the stop before', 'Km dari titik sebelumnya'),
      ],
      rows: rows.map((r) => r.cells), numeric: [true, false, true, false, true, true, true, true], whole: [true, false, true, true, true, true, true, true],
    } : null,
    lines: rows.map((r) => r.line), sites, visits,
    rule: L(lang, 'Order: start at the most pressing target, then always the nearest one not yet visited. Distances are straight lines, not roads.',
      'Urutan: mulai dari sasaran paling mendesak, lalu selalu ke sasaran terdekat yang belum dikunjungi. Jarak adalah garis lurus, bukan jarak jalan.'),
    more: total > visits.length ? L(lang, `${num(visits.length)} of ${num(total)} targets are listed, the most pressing first.`, `${num(visits.length)} dari ${num(total)} sasaran ditampilkan, yang paling mendesak lebih dulu.`) : null,
    empty: i.burn && !visits.length
      ? L(lang, 'No target today: no place was detected again this week, and none in the last 24 hours. That is not proof that nothing burns; keep the routine patrol.',
        'Tidak ada sasaran hari ini: tidak ada lokasi yang terdeteksi lagi minggu ini, dan tidak ada deteksi dalam 24 jam terakhir. Itu bukan bukti tidak ada api; lanjutkan patroli rutin.') : null,
    missing: notRead(i, lang, ['No target list can be drawn: today\'s hotspots could not be read. That is not a sign that nothing burns; keep the routine patrol.',
      'Daftar sasaran tidak dapat disusun: titik panas hari ini tidak dapat dibaca. Itu bukan tanda tidak ada api; lanjutkan patroli rutin.']),
    notes: [
      ...(sites.some((s) => s.kind !== 'single') ? [againRule(lang)] : []), ...(sites.some((s) => s.onPeat === true) ? [peatFootnote(lang)] : []), ...(fixed ? [fixed] : []),
    ],
  };

  // ---- 2. the sketch map (drawn by the page; the text has no picture)
  const sketch = visits.length ? {
    n: ++n, title: L(lang, 'Sketch map', 'Peta sketsa'),
    caption: L(lang, 'Sketch: district outline and targets. Straight lines, not roads.', 'Sketsa: batas kabupaten dan sasaran. Garis lurus, bukan jalan.'),
  } : null;

  // ---- 3. peat sites of a past season: the ones next to a target, else the first of the district's list
  const p = i.peat && i.peat.sites.length ? i.peat : null;
  let peat: PeatBlock | null = null;
  if (p) {
    const near = visits.map((v, k) => ({ k, site: pastSiteNear(v.site, p.sites) })).filter((x): x is { k: number; site: PeatSite } => x.site !== null);
    const top = p.sites.slice(0, PEAT_ROWS);
    peat = {
      n: ++n, title: L(lang, 'Also re-check: peat sites of a past season', 'Cek ulang juga: lokasi gambut musim lalu'),
      lead: near.length
        ? L(lang, `Past-season peat sites within ${SITE_JOIN_KM} km of a target:`, `Lokasi gambut musim lalu dalam ${SITE_JOIN_KM} km dari sasaran:`)
        : visits.length
          ? L(lang, `No target lies within ${SITE_JOIN_KM} km of a past-season peat site. The first ${num(top.length)} of the district's list:`, `Tidak ada sasaran dalam ${SITE_JOIN_KM} km dari lokasi gambut musim lalu. ${num(top.length)} lokasi pertama dalam daftar kabupaten:`)
          : L(lang, `The first ${num(top.length)} of the district's list:`, `${num(top.length)} lokasi pertama dalam daftar kabupaten:`),
      items: near.length
        ? near.map(({ k, site }) => `${L(lang, 'Target', 'Sasaran')} ${k + 1}: ${c3(site.lat)}, ${c3(site.lon)} · ${peatWords(site, lang)}`)
        : top.map((s) => `${c3(s.lat)}, ${c3(s.lon)} · ${peatWords(s, lang)}`),
      numbered: !near.length,
      tail: L(lang,
        `Peat sites of the August to October ${p.season ?? ''} season${p.provisional ? ' (provisional)' : ''}: places where fire was detected again after a gap in a past season, not places burning now.`,
        `Lokasi gambut musim Agustus sampai Oktober ${p.season ?? ''}${p.provisional ? ' (sementara)' : ''}: tempat api terdeteksi lagi setelah jeda pada musim yang lalu, bukan tempat yang sedang terbakar sekarang.`).replace(/ {2,}/g, ' '),
    };
  }

  // ---- 4. what the crew reports back: a grid to fill by hand, one row per target
  const yesNo = L(lang, 'yes / no', 'ya / tidak');
  const crew = visits.length ? {
    n: ++n, title: L(lang, 'What the crew reports back, per target', 'Yang dilaporkan regu, per sasaran'),
    head: [L(lang, 'Target no.', 'No. sasaran'), L(lang, 'Fire or smoke seen', 'Api atau asap terlihat'), L(lang, 'Peat', 'Gambut'), L(lang, 'More crews needed', 'Perlu tambahan regu'), L(lang, 'Notes', 'Catatan')],
    rows: visits.map((_, k) => String(k + 1)), yesNo,
    line: L(lang, `For each target the crew reports: fire or smoke seen (${yesNo}) · peat (${yesNo}) · more crews needed (${yesNo}) · notes.`,
      `Untuk tiap sasaran regu melaporkan: api atau asap terlihat (${yesNo}) · gambut (${yesNo}) · perlu tambahan regu (${yesNo}) · catatan.`),
  } : null;

  return {
    doc: 'plan', lang, head: headOf(i, 'plan', lang), notices: noticesOf(i, lang), summary: summaryOf(i, 'plan', lang),
    targets, sketch, peat, crew, officer: officerOf(++n, 'plan', i.officer, lang),
    closing: [
      L(lang, 'A hotspot is a satellite\'s detection of heat, not a confirmed fire. Under thick cloud or smoke the satellites cannot detect fire (NASA FIRMS), so a place that is not on this list is not shown to be free of fire.',
        'Titik panas adalah deteksi panas oleh satelit, bukan kebakaran yang terkonfirmasi. Di bawah awan atau asap tebal, satelit tidak dapat mendeteksi api (NASA FIRMS), sehingga lokasi yang tidak ada di daftar ini belum tentu bebas api.'),
      L(lang, 'The list and the visiting order: our own rules, not an official procedure.', 'Daftar dan urutan kunjungan: aturan kami sendiri, bukan prosedur resmi.'),
    ],
    address: addressOf(i, 'plan', lang),
  };
}

// ------------------------------------------------------------------------------------------------ the text versions

const heading = (n: number | null, title: string) => `*${n != null ? `${n}. ` : ''}${title}*`;
const factLine = (f: Fact) => `${f.label}: ${f.lead ? `${f.lead} ` : ''}${f.value}`;
const headLines = (h: PaperHead, notices: string[]) => [`*${h.title.toUpperCase()}*`, h.place, h.date, h.read, h.source, h.draft, ...notices];
const summaryLines = (s: SummaryBlock | null) => (s ? ['', heading(null, s.title), s.text, s.by] : []);
const placesLines = (b: PlacesBlock) => [
  ...(b.missing ? [b.missing] : []), ...(b.empty ? [b.empty] : []), ...b.lines, ...(b.more ? [b.more] : []),
];
const officerLines = (o: OfficerBlock) => ['', heading(o.n, o.title), o.note, ...o.fields.map((f) => `${f.label}: ${f.value || o.blank}`)];
const peatLines = (p: PeatBlock | null) => (p ? ['', heading(p.n, p.title), p.lead, ...p.items.map((x, k) => `${p.numbered ? `${k + 1}.` : '-'} ${x}`), ...(p.tail ? [p.tail] : [])] : []);

/** A paper as plain text for WhatsApp: short lines, *bold* headings, no tables; it ends with the page's address. */
export function paperText(p: DailyPaper | PlanPaper): string {
  if (p.doc === 'daily') {
    return [
      ...headLines(p.head, p.notices), ...summaryLines(p.summary),
      '', heading(p.situation.n, p.situation.title), ...p.situation.facts.map(factLine), p.situation.note,
      '', heading(p.week.n, p.week.title), p.week.note, p.week.cells ? p.week.cells.map((c) => c.n).join(' · ') : p.week.missing ?? '',
      '', heading(p.again.n, p.again.title), ...placesLines(p.again), ...p.again.notes,
      ...peatLines(p.peat),
      '', heading(p.decisions.n, p.decisions.title), ...(p.decisions.empty ? [p.decisions.empty] : p.decisions.items.map((x) => `- ${x}`)), ...(p.decisions.note ? [p.decisions.note] : []),
      ...officerLines(p.officer),
      '', ...p.closing, p.address,
    ].join('\n');
  }
  return [
    ...headLines(p.head, p.notices), ...summaryLines(p.summary),
    '', heading(p.targets.n, p.targets.title), ...placesLines(p.targets), ...(p.targets.lines.length ? [p.targets.rule] : []), ...p.targets.notes,
    ...peatLines(p.peat),
    ...(p.crew ? ['', heading(p.crew.n, p.crew.title), p.crew.line] : []),
    ...officerLines(p.officer),
    '', ...p.closing, p.address,
  ].join('\n');
}
/** The daily report as text: the same facts as the page's paper, from the same input. */
export const dailyReportText = (i: ReportInput, lang: Lang): string => paperText(dailyPaper(i, lang));
/** The draft field check plan as text. */
export const planText = (i: ReportInput, lang: Lang): string => paperText(planPaper(i, lang));

// ------------------------------------------------------------------------------------------------ facts for the AI paragraph

export interface AskPlace {
  lat: number; lon: number; first: string; last: string; days_seen: number; detections: number; night: number;
  kind: SiteKind; seen_in_last_24h: boolean; on_peat: boolean | null; order?: number; leg_km?: number | null;
}
const askPlace = (s: BurnSite): AskPlace => ({
  lat: s.lat, lon: s.lon, first: new Date(s.firstMs).toISOString(), last: new Date(s.lastMs).toISOString(),
  days_seen: s.daysSeen, detections: s.detections, night: s.night, kind: s.kind, seen_in_last_24h: s.fresh, on_peat: s.onPeat,
});
/** The facts sent for the optional AI paragraph: the Today page's own facts (askFacts), with the paper's list in the
 *  place of its shorter one. The daily report sends the places detected again that its table shows; the plan sends its
 *  targets in visiting order. Known fixed heat sources are in neither. public/api/ask.js checks every field again. */
export function askFactsFor(doc: ReportDoc, base: Record<string, unknown>, burn: BurnSite[] | null): Record<string, unknown> {
  const again = againSites(burn ?? []);
  const list: AskPlace[] = doc === 'plan'
    ? visitOrder(planTargets(burn ?? [], LIST_ROWS)).map((v, k) => ({ ...askPlace(v.site), order: k + 1, leg_km: v.legKm }))
    : again.slice(0, LIST_ROWS).map(askPlace);
  return { ...base, again_list: list, again_total: burn ? again.length : null };
}

// ------------------------------------------------------------------------------------------------ the sketch map

export type Bounds = [number, number, number, number];   // west, south, east, north
/** Every ring of a GeoJSON Polygon or MultiPolygon, as [lon, lat] points (none for anything else). */
export function ringsOf(g: { type: string; coordinates: unknown } | null | undefined): number[][][] {
  if (!g || !Array.isArray(g.coordinates)) return [];
  if (g.type === 'Polygon') return g.coordinates as number[][][];
  if (g.type === 'MultiPolygon') return (g.coordinates as number[][][][]).flat();
  return [];
}
/** The box around some [lon, lat] points, or null when there is none. */
export function boundsOf(points: number[][]): Bounds | null {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const p of points) {
    const lon = p[0], lat = p[1];
    if (typeof lon !== 'number' || typeof lat !== 'number' || !Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    if (lon < w) w = lon; if (lon > e) e = lon; if (lat < s) s = lat; if (lat > n) n = lat;
  }
  return Number.isFinite(w) && Number.isFinite(s) ? [w, s, e, n] : null;
}
/** A box grown so that it is at least `minKm` wide and high, then by `share` of its size on every side. */
export function growBounds([w, s, e, n]: Bounds, minKm: number, share: number): Bounds {
  const lat0 = (s + n) / 2, kmLat = 111.195, kmLon = Math.max(1, kmLat * Math.cos((lat0 * Math.PI) / 180));
  const needLon = Math.max(0, minKm / kmLon - (e - w)) / 2, needLat = Math.max(0, minKm / kmLat - (n - s)) / 2;
  const [w1, s1, e1, n1] = [w - needLon, s - needLat, e + needLon, n + needLat];
  const dx = (e1 - w1) * share, dy = (n1 - s1) * share;
  return [w1 - dx, s1 - dy, e1 + dx, n1 + dy];
}
export interface Frame { width: number; height: number; x: (lon: number) => number; y: (lat: number) => number; kmPerPx: number }
/** A plain map frame: longitude and latitude drawn as a flat grid, with longitude shrunk by the cosine of the middle
 *  latitude so that a kilometre is as long across as it is up and down. The box is fitted into `width` (and at most
 *  `maxHeight`) with `pad` around it, and centred. `kmPerPx` comes from distanceKm, for the scale bar. */
export function frameOf(b: Bounds, width: number, maxHeight: number, pad: number): Frame {
  const lat0 = (b[1] + b[3]) / 2, k = Math.cos((lat0 * Math.PI) / 180);
  const dx = Math.max((b[2] - b[0]) * k, 1e-6), dy = Math.max(b[3] - b[1], 1e-6);
  const scale = Math.min((width - 2 * pad) / dx, (maxHeight - 2 * pad) / dy);   // px for one degree of latitude
  const height = Math.round(dy * scale + 2 * pad);
  const offX = (width - dx * scale) / 2, offY = (height - dy * scale) / 2;
  return {
    width, height,
    x: (lon) => offX + (lon - b[0]) * k * scale,
    y: (lat) => offY + (b[3] - lat) * scale,
    kmPerPx: distanceKm(lat0 - 0.5, b[0], lat0 + 0.5, b[0]) / scale,
  };
}
/** A round length (km) for a scale bar no longer than `maxPx`: 1, 2 or 5 times a power of ten. */
export function scaleBarKm(kmPerPx: number, maxPx: number): number {
  const max = kmPerPx * maxPx;
  let best = 0;
  for (let p = -2; p <= 4; p++) for (const m of [1, 2, 5]) { const v = m * 10 ** p; if (v <= max) best = v; }
  return Math.round(best * 100) / 100;
}
