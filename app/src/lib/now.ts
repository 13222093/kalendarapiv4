// KalenderApi (new file): the numbers and the words of "Today in my district" (#/now, pages/Now.tsx).
// Everything here is a plain function of data the page already holds: the reply of /api/live (NASA FIRMS near-real-time
// hotspots), one row of the district's monthly record, and the peat persistence file. Nothing is forecast, nothing is
// filled in, and the three messages are fixed templates with those numbers put in.
import { fmtNumber, locale, type Lang } from './lang.ts';
import type { MonthStatus } from './robust.ts';

// ------------------------------------------------------------------------------------------------ live hotspots

export type Sensor = 'N20' | 'N21' | 'MODIS';
export const SENSORS: readonly Sensor[] = ['N20', 'N21', 'MODIS'];
export const SENSOR_LABEL: Record<Sensor, string> = { N20: 'VIIRS NOAA-20', N21: 'VIIRS NOAA-21', MODIS: 'MODIS' };
export const isSensor = (s: unknown): s is Sensor => s === 'N20' || s === 'N21' || s === 'MODIS';

/** One detection of /api/live: lon, lat, frp (MW, or null), day or night, sensor, "YYYY-MM-DD", "HHMM" (UTC). */
export type LivePoint = [number, number, number | null, 'D' | 'N', Sensor, string, string];
export interface LiveSource { sensor: string; name?: string; file: string; last_modified: string | null; rows: number; kept?: number; error?: string }
export interface LiveReply {
  fetched_at: string; range: string; bbox: number[]; filter?: string;
  sources: LiveSource[]; failed: string[]; points: LivePoint[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/, TIME = /^\d{4}$/;

/** The reply of /api/live, checked. Null when the body is not that reply (the dev server answers with a page or the
 *  function's source text; an error body has no points). Points that are not well formed are dropped. */
export function asLive(body: unknown): LiveReply | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (typeof b.fetched_at !== 'string' || !Array.isArray(b.points) || !Array.isArray(b.sources)) return null;
  if (Number.isNaN(Date.parse(b.fetched_at))) return null;
  const points: LivePoint[] = [];
  for (const p of b.points as unknown[]) {
    if (!Array.isArray(p) || p.length < 7) continue;
    const [lon, lat, frp, dn, sensor, date, time] = p as unknown[];
    if (typeof lon !== 'number' || typeof lat !== 'number' || !Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    if (!isSensor(sensor) || typeof date !== 'string' || typeof time !== 'string' || !DATE.test(date) || !TIME.test(time)) continue;
    points.push([lon, lat, typeof frp === 'number' && Number.isFinite(frp) ? frp : null, dn === 'N' ? 'N' : 'D', sensor, date, time]);
  }
  const sources = (b.sources as unknown[]).filter((s): s is LiveSource => !!s && typeof s === 'object' && typeof (s as LiveSource).sensor === 'string');
  return {
    fetched_at: b.fetched_at, range: typeof b.range === 'string' ? b.range : '',
    bbox: Array.isArray(b.bbox) ? (b.bbox as number[]) : [], filter: typeof b.filter === 'string' ? b.filter : undefined,
    sources, failed: sources.filter((s) => !!s.error).map((s) => s.sensor), points,
  };
}

/** The moment of a detection, in ms since 1970 (FIRMS dates and times are UTC). */
export function pointMs(p: LivePoint): number {
  const d = p[5], t = p[6];
  return Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)), Number(t.slice(0, 2)), Number(t.slice(2, 4)));
}

/** A box grown by `pad` degrees on every side (the map shows a little of the neighbours). */
export function padBox([w, s, e, n]: readonly [number, number, number, number], pad: number): [number, number, number, number] {
  const r = (x: number) => Math.round(x * 1000) / 1000;
  return [r(Math.max(-180, w - pad)), r(Math.max(-90, s - pad)), r(Math.min(180, e + pad)), r(Math.min(90, n + pad))];
}

export const HOUR = 3600_000;
export interface LiveCounts {
  by24: Record<Sensor, number>; by7: Record<Sensor, number>;
  total24: number; total7: number;
  newest: LivePoint | null;        // the newest detection of the 7 days
  recent: LivePoint[];             // the detections of the 7 days, newest first
}

/** Hotspots by detection time: the 24 hours and the 7 days (168 hours) before `nowMs`. `points` are the detections
 *  inside the district already (the page tests each against the district outline). */
export function countLive(points: LivePoint[], nowMs: number): LiveCounts {
  const by24: Record<Sensor, number> = { N20: 0, N21: 0, MODIS: 0 }, by7: Record<Sensor, number> = { N20: 0, N21: 0, MODIS: 0 };
  const recent: { p: LivePoint; t: number }[] = [];
  for (const p of points) {
    const t = pointMs(p);
    if (!(t <= nowMs) || t < nowMs - 168 * HOUR) continue;
    by7[p[4]] += 1;
    if (t >= nowMs - 24 * HOUR) by24[p[4]] += 1;
    recent.push({ p, t });
  }
  recent.sort((a, b) => b.t - a.t);
  const sum = (r: Record<Sensor, number>) => r.N20 + r.N21 + r.MODIS;
  return { by24, by7, total24: sum(by24), total7: sum(by7), newest: recent[0]?.p ?? null, recent: recent.map((x) => x.p) };
}

/** When NASA last wrote the newest of the files that were read (ms), or null. */
export function filesUpdatedMs(sources: LiveSource[]): number | null {
  const ts = sources.filter((s) => !s.error && s.last_modified).map((s) => Date.parse(s.last_modified!)).filter((t) => Number.isFinite(t));
  return ts.length ? Math.max(...ts) : null;
}

// ------------------------------------------------------------------------------------------------ the level

/** Our own three levels. They are not an official government status. */
export type Level = 'calm' | 'watch' | 'high';
/** This many hotspots in the district in the last 24 hours, or more, is "High". */
export const HIGH_24H = 5;
export type LevelWhy = 'h24-high' | 'month-far-above' | 'h24-some' | 'd7-some' | 'month-above' | 'quiet' | 'no-live';
export interface LevelInput {
  live24: number | null;           // hotspots in the district in the last 24 hours; null when live data could not be read
  live7: number | null;            // and in the last 7 days
  status: MonthStatus | null;      // this month on the one-scale record against the same month of earlier years
}
export interface LevelResult { level: Level | null; why: LevelWhy }

/** The level, from stated rules only (the page prints them):
 *  High:  HIGH_24H or more hotspots in the last 24 hours, or this month is far above normal.
 *  Watch: any hotspot in the last 7 days, or this month is above normal.
 *  Calm:  no hotspot in the last 7 days and this month is not above normal.
 *  Without live data there is no "Calm": the level is null unless the month alone gives Watch or High. */
export function levelOf({ live24, live7, status }: LevelInput): LevelResult {
  if (live24 != null && live24 >= HIGH_24H) return { level: 'high', why: 'h24-high' };
  if (status === 'far-above') return { level: 'high', why: 'month-far-above' };
  if (live24 != null && live24 >= 1) return { level: 'watch', why: 'h24-some' };
  if (live7 != null && live7 >= 1) return { level: 'watch', why: 'd7-some' };
  if (status === 'above') return { level: 'watch', why: 'month-above' };
  if (live24 == null || live7 == null) return { level: null, why: 'no-live' };
  return { level: 'calm', why: 'quiet' };
}

export const LEVEL_NAME: Record<Level, { en: string; id: string }> = {
  calm: { en: 'Calm', id: 'Tenang' }, watch: { en: 'Watch', id: 'Waspada' }, high: { en: 'High', id: 'Tinggi' },
};
export const STATUS_NAME: Record<MonthStatus, { en: string; id: string }> = {
  below: { en: 'below normal', id: 'di bawah normal' }, near: { en: 'near normal', id: 'mendekati normal' },
  above: { en: 'above normal', id: 'di atas normal' }, 'far-above': { en: 'far above normal', id: 'jauh di atas normal' },
};

// ------------------------------------------------------------------------------------------------ words

const L = (lang: Lang, en: string, id: string) => (lang === 'id' ? id : en);

/** "15 Nov 2026, 20:53 WIB": Western Indonesia Time (UTC+7), the same clock for every district so two officers read
 *  the same time. */
export function wib(ms: number, lang: Lang): string {
  const s = new Intl.DateTimeFormat(locale(lang), {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta',
  }).format(new Date(ms));
  return `${s} WIB`;
}

/** "Pulang Pisau district" / "Kabupaten Pulang Pisau"; a city keeps its own name ("Kota Palangka Raya"). */
export function districtTitle(name: string, lang: Lang): string {
  if (/^kota\b/i.test(name)) return name;
  return lang === 'id' ? `Kabupaten ${name}` : `${name} district`;
}

/** Digits of a phone number as typed, for display in a message: trimmed, one line. Never invented: empty stays empty. */
export const cleanPhone = (raw: string) => raw.replace(/[^\d+()\- ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);

/** The WhatsApp link that opens the app with the text ready; the officer picks who to send it to and presses send. */
export const waLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

const coord = (x: number) => x.toFixed(4);

// ------------------------------------------------------------------------------------------------ peat sites

export type GapClass = 'under_cloud' | 'seen_quiet' | 'no_data' | 'modis_fire';
export interface PeatGap { from: string; to: string; days: number; cls: GapClass | null }
export interface PeatSite {
  lon: number; lat: number; days: number; first: string | null; last: string | null;
  comeBacks: number; underCloud: number; seenQuiet: number; noData: number; modisFire: number;
  nightShare: number | null; gaps: PeatGap[];
}
export interface PeatDistrict {
  season: number | null; provisional: boolean; persistentSites: number | null; peatCells: number | null; sites: PeatSite[];
  /** The district's come-backs of that season, by what MODIS recorded on the gap days (the file's own counts). */
  comeBacks: { total: number; underCloud: number; seenQuiet: number; noData: number; modisFire: number } | null;
  rule: string | null; generated: string | null; peatSource: string | null;
}

const n0 = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const GAPS: readonly GapClass[] = ['under_cloud', 'seen_quiet', 'no_data', 'modis_fire'];

/** The district's entry of ka-data/peat_persistence_kalteng.json, read defensively. Null when the file is not that
 *  file, has no such district, or the district has no site with coordinates (the page then leaves the section out). */
export function peatFor(file: unknown, aoiId: string): PeatDistrict | null {
  if (!file || typeof file !== 'object') return null;
  const f = file as Record<string, unknown>;
  if (!Array.isArray(f.districts)) return null;
  const d = (f.districts as Record<string, unknown>[]).find((x) => x && typeof x === 'object' && x.aoi_id === aoiId);
  if (!d || !Array.isArray(d.top_sites)) return null;
  const sites: PeatSite[] = [];
  for (const raw of d.top_sites as Record<string, unknown>[]) {
    if (!raw || typeof raw.lon !== 'number' || typeof raw.lat !== 'number' || typeof raw.days_detected !== 'number') continue;
    const cb = (raw.come_backs && typeof raw.come_backs === 'object' ? raw.come_backs : {}) as Record<string, unknown>;
    const gaps = Array.isArray(raw.gaps) ? (raw.gaps as Record<string, unknown>[]).filter((g) => g && typeof g.from === 'string' && typeof g.to === 'string').map((g): PeatGap => ({
      from: g.from as string, to: g.to as string, days: n0(g.days), cls: GAPS.includes(g.class as GapClass) ? (g.class as GapClass) : null,
    })) : [];
    sites.push({
      lon: raw.lon, lat: raw.lat, days: raw.days_detected, first: str(raw.first_date), last: str(raw.last_date),
      comeBacks: n0(cb.total), underCloud: n0(cb.under_cloud), seenQuiet: n0(cb.seen_quiet), noData: n0(cb.no_data), modisFire: n0(cb.modis_fire),
      nightShare: typeof raw.night_share === 'number' ? raw.night_share : null, gaps,
    });
  }
  if (!sites.length) return null;
  const src = (f.sources && typeof f.sources === 'object' ? (f.sources as Record<string, unknown>).peat : null) as Record<string, unknown> | null;
  const ofSeason = Array.isArray(d.seasons) ? (d.seasons as Record<string, unknown>[]).find((x) => x && x.season === d.top_sites_season) : undefined;
  const scb = ofSeason && ofSeason.come_backs && typeof ofSeason.come_backs === 'object' ? (ofSeason.come_backs as Record<string, unknown>) : null;
  return {
    comeBacks: scb && typeof scb.total === 'number'
      ? { total: scb.total, underCloud: n0(scb.under_cloud), seenQuiet: n0(scb.seen_quiet), noData: n0(scb.no_data), modisFire: n0(scb.modis_fire) } : null,
    season: typeof d.top_sites_season === 'number' ? d.top_sites_season : null,
    provisional: d.top_sites_provisional === true,
    persistentSites: typeof d.persistent_peat_sites_in_that_season === 'number' ? d.persistent_peat_sites_in_that_season : null,
    peatCells: typeof d.peat_cells === 'number' ? d.peat_cells : null,
    sites, rule: str(f.rule), generated: str(f.generated_utc), peatSource: src ? str(src.name) : null,
  };
}

const csvCell = (v: string | number | null) => {
  if (v == null) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The peat sites of a district as a CSV file, with "#" lines that say what it is and where it comes from. */
export function peatCsv(p: PeatDistrict, district: string, aoiId: string, generated: string): string {
  const head = [
    'KalenderApi: peat sites to re-check (persistence of fire activity on peat, as the satellites recorded it)',
    `Area: ${district} (${aoiId})`,
    `Season: 1 Aug to 31 Oct ${p.season ?? 'not stated'}${p.provisional ? ' (near-real-time data, provisional)' : ''}`,
    ...(p.rule ? [`Rule: ${p.rule.replace(/\s+/g, ' ')}`] : []),
    'lon and lat are the centre of a 0.01 degree cell (about 1.1 km). A gap is two or more days in a row with no VIIRS detection between two detection days.',
    'gaps_under_cloud: every gap day was classed cloud by MODIS (the quiet days were not observed). gaps_seen_quiet: at least one gap day had a cloud-free look with no fire.',
    'This is not a forecast and does not say fire was present during a gap. Verify on the ground.',
    `Source: NASA FIRMS VIIRS S-NPP 375 m; NASA MODIS MOD14A1 and MYD14A1 FireMask${p.peatSource ? `; peat: ${p.peatSource}` : ''}`,
    `File built: ${p.generated ?? 'not stated'}. Downloaded: ${generated}`,
  ].map((c) => `# ${c}`);
  const cols = ['rank', 'latitude', 'longitude', 'days_detected', 'first_date', 'last_date', 'come_backs', 'gaps_under_cloud', 'gaps_seen_quiet', 'gaps_no_data', 'gaps_with_modis_fire', 'night_share'];
  const rows = p.sites.map((s, i) => [i + 1, s.lat, s.lon, s.days, s.first, s.last, s.comeBacks, s.underCloud, s.seenQuiet, s.noData, s.modisFire, s.nightShare].map(csvCell).join(','));
  return [...head, cols.join(','), ...rows].join('\r\n') + '\r\n';
}

// ------------------------------------------------------------------------------------------------ the three messages

export interface MonthFact {
  label: string;                // "November 2026"
  monthOnly: string;            // "November"
  H: number;                    // fire cell-days on the one scale
  median: number | null;        // median of the same month (the record's baseline years)
  higherPct: number | null;     // share of the same month in earlier years that this month is above, 0 to 100
  status: MonthStatus | null;
  partial: boolean;             // the month is still running
}
export interface MsgInput {
  lang: Lang;
  district: string;             // "Pulang Pisau"
  nowMs: number;
  level: Level | null;
  live: { counts: LiveCounts; updatedMs: number | null; failed: string[] } | null;   // null: live data could not be read
  month: MonthFact | null;
  sites: PeatSite[];            // peat sites to re-check, ranked; may be empty
  sitesSeason: number | null;
  phone: string;                // the local post's number as typed; empty: no number in the text
}
export interface Messages { residents: string; bpbd: string; crew: string }

const SITES_IN_MESSAGE = 5, HOTSPOTS_IN_MESSAGE = 5;

/** The three ready-to-send texts. Fixed templates: every number in them is one the page shows. */
export function buildMessages(i: MsgInput): Messages {
  const { lang } = i;
  const t = (en: string, id: string) => L(lang, en, id);
  const num = (v: number, digits = 0) => fmtNumber(v, lang, digits);
  const place = districtTitle(i.district, lang);
  const when = wib(i.nowMs, lang);
  const phone = cleanPhone(i.phone);
  const levelName = i.level ? LEVEL_NAME[i.level][lang].toUpperCase() : null;
  const levelLine = levelName
    ? t(`Level: ${levelName} (KalenderApi's own rule, not an official government status).`,
      `Tingkat: ${levelName} (aturan KalenderApi sendiri, bukan status resmi pemerintah).`)
    : t('Level: not set, because today\'s satellite hotspots could not be read.',
      'Tingkat: belum ditentukan, karena titik panas satelit hari ini tidak dapat dibaca.');
  const c = i.live?.counts ?? null;
  const countLine = c
    ? t(`NASA satellites recorded ${num(c.total24)} hotspot${c.total24 === 1 ? '' : 's'} in the last 24 hours and ${num(c.total7)} in the last 7 days in ${place}.`,
      `Satelit NASA mencatat ${num(c.total24)} titik panas dalam 24 jam terakhir dan ${num(c.total7)} dalam 7 hari terakhir di ${place}.`)
    : t(`Today's satellite hotspots for ${place} could not be read. This is not a sign that there is no fire.`,
      `Titik panas satelit hari ini untuk ${place} tidak dapat dibaca. Ini bukan tanda tidak ada api.`);
  const zeroLine = t('Zero hotspots does not mean no fire: cloud and smoke can hide the ground from the satellites.',
    'Nol titik panas tidak berarti tidak ada api: awan dan asap dapat menutupi pandangan satelit.');
  const report = phone
    ? t(`If you see fire or smoke, report it to the local post at once: ${phone}.`, `Jika melihat api atau asap, segera lapor ke posko setempat: ${phone}.`)
    : t('If you see fire or smoke, report it to the village post or the district disaster office (BPBD) at once.',
      'Jika melihat api atau asap, segera lapor ke posko desa atau BPBD.');
  const source = t('Source: NASA FIRMS (VIIRS and MODIS), prepared with KalenderApi. Not an official warning.',
    'Sumber: NASA FIRMS (VIIRS dan MODIS), diolah dengan KalenderApi. Bukan peringatan resmi.');

  // ---- residents and the village
  const advice: Record<Level | 'none', string> = {
    calm: t('Do not burn land or waste.', 'Jangan membakar lahan atau sampah.'),
    watch: t('Do not burn land or waste. Keep an eye on peat land and gardens near you.',
      'Jangan membakar lahan atau sampah. Awasi lahan gambut dan kebun di sekitar Anda.'),
    high: t('Do not burn anything on the land. Keep masks and water ready, and keep children and older people away from smoke.',
      'Jangan membakar apa pun di lahan. Siapkan masker dan air, serta jauhkan anak-anak dan lansia dari asap.'),
    none: t('Do not burn land or waste.', 'Jangan membakar lahan atau sampah.'),
  };
  const residents = [
    t(`Hotspot information, ${place}, ${when}`, `Info titik panas, ${place}, ${when}`),
    levelLine, countLine, `${advice[i.level ?? 'none']} ${report}`, zeroLine, source,
  ].join('\n');

  // ---- the district disaster office
  const bySensor = c ? SENSORS.map((s) => `${SENSOR_LABEL[s]} ${num(c.by24[s])}`).join(', ') : '';
  const newest = c?.newest ?? null;
  const m = i.month;
  const monthLine = m
    ? t(`${m.label}${m.partial ? ' (month still running)' : ''}: ${num(m.H, 1)} fire cell-days on the single MODIS and VIIRS scale${m.median != null ? `; the median ${m.monthOnly} has ${num(m.median, m.median % 1 ? 1 : 0)}` : ''}${m.higherPct != null ? `; higher than ${num(m.higherPct)}% of earlier ${m.monthOnly}s` : ''}${m.status ? ` (${STATUS_NAME[m.status].en})` : ''}.`,
      `${m.label}${m.partial ? ' (bulan masih berjalan)' : ''}: ${num(m.H, 1)} sel-hari api pada skala tunggal MODIS dan VIIRS${m.median != null ? `; median ${m.monthOnly} adalah ${num(m.median, m.median % 1 ? 1 : 0)}` : ''}${m.higherPct != null ? `; lebih tinggi dari ${num(m.higherPct)}% ${m.monthOnly} tahun-tahun sebelumnya` : ''}${m.status ? ` (${STATUS_NAME[m.status].id})` : ''}.`)
    : null;
  const act: Record<Level | 'none', string> = {
    calm: t('Suggested: routine monitoring; check again after the next satellite pass.', 'Saran: pemantauan rutin; periksa lagi setelah lintasan satelit berikutnya.'),
    watch: t('Suggested: check the newest hotspot coordinates on the ground and keep village posts informed.',
      'Saran: cek koordinat titik panas terbaru di lapangan dan kabari posko desa.'),
    high: t('Suggested: send ground checks to the newest hotspot coordinates today and coordinate with Manggala Agni and the village posts.',
      'Saran: kirim pengecekan lapangan ke koordinat titik panas terbaru hari ini dan koordinasikan dengan Manggala Agni serta posko desa.'),
    none: t('Suggested: read the hotspots again later or from NASA FIRMS directly, and verify on the ground.',
      'Saran: baca ulang titik panas nanti atau langsung dari NASA FIRMS, dan verifikasi di lapangan.'),
  };
  const bpbd = [
    t(`Hotspot brief, ${place}, ${when}`, `Laporan singkat titik panas, ${place}, ${when}`),
    levelLine,
    c ? t(`Last 24 hours: ${num(c.total24)} hotspot${c.total24 === 1 ? '' : 's'} (${bySensor}). Last 7 days: ${num(c.total7)}.`,
      `24 jam terakhir: ${num(c.total24)} titik panas (${bySensor}). 7 hari terakhir: ${num(c.total7)}.`) : countLine,
    ...(newest ? [t(`Newest detection: ${wib(pointMs(newest), lang)} (${SENSOR_LABEL[newest[4]]}), at ${coord(newest[1])}, ${coord(newest[0])}.`,
      `Deteksi terbaru: ${wib(pointMs(newest), lang)} (${SENSOR_LABEL[newest[4]]}), di ${coord(newest[1])}, ${coord(newest[0])}.`)] : []),
    ...(i.live?.updatedMs != null ? [t(`NASA file last updated: ${wib(i.live.updatedMs, lang)}.`, `Berkas NASA terakhir diperbarui: ${wib(i.live.updatedMs, lang)}.`)] : []),
    ...(i.live?.failed.length ? [t(`Not read this time: ${i.live.failed.join(', ')}.`, `Tidak terbaca kali ini: ${i.live.failed.join(', ')}.`)] : []),
    ...(monthLine ? [monthLine] : []),
    t('Zero hotspots under cloud is not proof of no fire. Look at today\'s satellite photo and verify on the ground.',
      'Nol titik panas di bawah awan bukan bukti tidak ada api. Lihat foto satelit hari ini dan verifikasi di lapangan.'),
    act[i.level ?? 'none'],
    ...(phone ? [t(`Local post: ${phone}.`, `Posko setempat: ${phone}.`)] : []),
    source,
  ].join('\n');

  // ---- the Manggala Agni crew
  const hot = (c?.recent ?? []).slice(0, HOTSPOTS_IN_MESSAGE);
  const sites = i.sites.slice(0, SITES_IN_MESSAGE);
  const season = i.sitesSeason ? ` ${i.sitesSeason}` : '';
  const crew = [
    t(`Field check list, ${place}, ${when}`, `Daftar cek lapangan, ${place}, ${when}`),
    levelLine,
    c ? (hot.length
      ? t(`Newest satellite hotspots of the last 7 days (latitude, longitude):`, `Titik panas satelit terbaru dalam 7 hari terakhir (lintang, bujur):`)
      : t('No satellite hotspot in the last 7 days. Under cloud this is not proof of no fire.', 'Tidak ada titik panas satelit dalam 7 hari terakhir. Di bawah awan, ini bukan bukti tidak ada api.'))
      : countLine,
    ...hot.map((p, k) => `${k + 1}. ${coord(p[1])}, ${coord(p[0])} · ${wib(pointMs(p), lang)} · ${SENSOR_LABEL[p[4]]}${p[2] != null ? ` · ${num(p[2], 1)} MW` : ''}`),
    ...(sites.length ? [
      t(`Peat sites to re-check (fire activity kept coming back, Aug to Oct${season} season):`,
        `Lokasi gambut untuk dicek ulang (aktivitas api berulang, musim Agu sampai Okt${season}):`),
      ...sites.map((s, k) => t(
        `${k + 1}. ${coord(s.lat)}, ${coord(s.lon)} · detected on ${num(s.days)} days${s.last ? `, last ${s.last}` : ''} · came back ${num(s.comeBacks)} time${s.comeBacks === 1 ? '' : 's'}`,
        `${k + 1}. ${coord(s.lat)}, ${coord(s.lon)} · terdeteksi ${num(s.days)} hari${s.last ? `, terakhir ${s.last}` : ''} · muncul lagi ${num(s.comeBacks)} kali`)),
    ] : []),
    t('Verify on the ground. A satellite coordinate can be off by up to about 1 km, and peat can smoulder below what a satellite detects.',
      'Verifikasi di lapangan. Koordinat satelit bisa meleset hingga sekitar 1 km, dan gambut bisa membara di bawah batas deteksi satelit.'),
    ...(phone ? [t(`Report back to the local post: ${phone}.`, `Lapor kembali ke posko setempat: ${phone}.`)] : []),
    source,
  ].join('\n');

  return { residents, bpbd, crew };
}
