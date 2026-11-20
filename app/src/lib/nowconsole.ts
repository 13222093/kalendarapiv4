// KalenderApi (new file): the logic of the command view of "Today in my district" (#/command, pages/CommandConsole.tsx).
// Plain functions of what the Today page already holds: which rows the decision queue shows and in what state, the
// steps of the village alert with their times, the thread of the demo village group, the hotspots of the last seven
// days per 24 hours, and the tab named in the address. No number is made here and nothing is sent: the village thread
// is a demo that lives in the browser (the steps and their times are those of components/now/AlertLoop.tsx).
import { HOUR, pointMs, type Level, type LivePoint } from './now.ts';

// ------------------------------------------------------------------------------------------------ the village alert

/** The steps of the village alert, in order. The last one is the resident's reply ("I have read it" or "I see fire"). */
export type AlertStep = 'drafted' | 'approved' | 'sent' | 'read' | 'replied';
export const ALERT_STEPS: readonly AlertStep[] = ['drafted', 'approved', 'sent', 'read', 'replied'];
export type Reply = 'read' | 'fire';
export interface AlertLoopState {
  times: Partial<Record<AlertStep, number>>;   // when each step happened, ms since 1970
  held: boolean;                               // the office pressed Hold and has not approved since
  reply: Reply | null;                         // the one reply of the demo resident
}
/** What the console remembers for one district on one day. `done` lists the ids of the rows marked done. */
export interface ConsoleState { v: 1; alert: AlertLoopState; done: string[]; guideHidden: boolean }

export const newConsoleState = (nowMs: number): ConsoleState =>
  ({ v: 1, alert: { times: { drafted: nowMs }, held: false, reply: null }, done: [], guideHidden: false });

/** Approve: only once. A held alert can still be approved. */
export function approveAlert(s: ConsoleState, nowMs: number): ConsoleState {
  if (s.alert.times.approved != null) return s;
  return { ...s, alert: { ...s.alert, held: false, times: { ...s.alert.times, approved: nowMs } } };
}
/** The approved alert reaches the demo thread. */
export function markSent(s: ConsoleState, nowMs: number): ConsoleState {
  if (s.alert.times.approved == null || s.alert.times.sent != null) return s;
  return { ...s, alert: { ...s.alert, times: { ...s.alert.times, sent: nowMs } } };
}
export function holdAlert(s: ConsoleState): ConsoleState {
  if (s.alert.times.approved != null || s.alert.held) return s;
  return { ...s, alert: { ...s.alert, held: true } };
}
/** The resident answers: only after the alert was sent, and only once. */
export function answerAlert(s: ConsoleState, reply: Reply, nowMs: number): ConsoleState {
  if (s.alert.times.sent == null || s.alert.reply) return s;
  return { ...s, alert: { ...s.alert, reply, times: { ...s.alert.times, read: nowMs, replied: nowMs } } };
}
/** "Start again": a new draft and no row marked done. The dismissed guide stays dismissed. */
export const restartConsole = (s: ConsoleState, nowMs: number): ConsoleState => ({ ...newConsoleState(nowMs), guideHidden: s.guideHidden });
export function setRowDone(s: ConsoleState, id: string, done: boolean): ConsoleState {
  const has = s.done.includes(id);
  if (done === has) return s;
  return { ...s, done: done ? [...s.done, id] : s.done.filter((x) => x !== id) };
}
export const setGuideHidden = (s: ConsoleState, hidden: boolean): ConsoleState => (s.guideHidden === hidden ? s : { ...s, guideHidden: hidden });

/** The step the alert has reached: the last one with a time. */
export function activeStep(a: AlertLoopState): AlertStep {
  let at: AlertStep = 'drafted';
  for (const st of ALERT_STEPS) if (a.times[st] != null) at = st;
  return at;
}
/** Where the alert stands, for the one status sentence (the sentences are AlertLoop.tsx's). */
export type AlertStatus = 'waiting' | 'held' | 'sending' | 'sent' | 'read' | 'fire';
export function alertStatus(a: AlertLoopState): AlertStatus {
  if (a.reply === 'fire') return 'fire';
  if (a.reply === 'read') return 'read';
  if (a.times.sent != null) return 'sent';
  if (a.times.approved != null) return 'sending';
  return a.held ? 'held' : 'waiting';
}

/** One line of the village thread. `kind` picks the words (the component holds them in both languages). */
export interface ThreadLine {
  key: string;
  who: 'office' | 'resident';
  kind: 'alert' | 'reply-read' | 'reply-fire' | 'ack-read' | 'ack-fire';
  at: number;                                             // ms since 1970
  mark: 'waiting' | 'held' | 'sending' | 'sent' | null;   // the state chip of the alert line
}
/** The thread: the drafted alert (waiting, held, sending, then sent), the resident's reply, the office's answer. */
export function threadOf(a: AlertLoopState): ThreadLine[] {
  const st = alertStatus(a);
  const lines: ThreadLine[] = [{
    key: 'alert', who: 'office', kind: 'alert', at: a.times.sent ?? a.times.approved ?? a.times.drafted ?? 0,
    mark: st === 'waiting' || st === 'held' || st === 'sending' ? st : 'sent',
  }];
  if (a.reply && a.times.replied != null) {
    lines.push({ key: 'reply', who: 'resident', kind: a.reply === 'fire' ? 'reply-fire' : 'reply-read', at: a.times.replied, mark: null });
    lines.push({ key: 'ack', who: 'office', kind: a.reply === 'fire' ? 'ack-fire' : 'ack-read', at: a.times.replied, mark: null });
  }
  return lines;
}

// ------------------------------------------------------------------------------------------------ the decision queue

/** The rows the queue can hold. `resident`: a resident answered "I see fire". `reread`: live hotspots could not be read.
 *  `newest`, `peat`, `village` or `calm`, `cloud`: the four actions of the classic page, under the same conditions. */
export type RowKind = 'resident' | 'reread' | 'newest' | 'peat' | 'village' | 'calm' | 'cloud';
export type RowState = 'waiting' | 'approved' | 'held' | 'done';
export interface QueueRow { id: string; kind: RowKind; state: RowState }
export interface QueueInput {
  liveFailed: boolean;          // live hotspots could not be read (the classic page then asks to read again)
  newestId: string | null;      // the newest hotspot in the district, when there is one (hotspotId)
  peatId: string | null;        // the first peat site of the list, when the district has one (peatSiteId)
  level: Level | null;          // the page's own level; null when it is not set
}

/** A hotspot's identity for the queue: a later, newer hotspot is a new row to check, not the one marked done. */
export const hotspotId = (p: LivePoint): string => `newest:${p[5]}T${p[6]}:${p[1].toFixed(4)},${p[0].toFixed(4)}:${p[4]}`;
export const peatSiteId = (site: { lat: number; lon: number }): string => `peat:${site.lat.toFixed(3)},${site.lon.toFixed(3)}`;

/** The queue, top to bottom. A resident's report of fire comes first; the rest keep the order of the classic list. */
export function queueRows(i: QueueInput, s: ConsoleState): QueueRow[] {
  const mark = (id: string): RowState => (s.done.includes(id) ? 'done' : 'waiting');
  const rows: QueueRow[] = [];
  if (s.alert.reply === 'fire') {
    const id = `resident:${s.alert.times.replied ?? 0}`;
    rows.push({ id, kind: 'resident', state: mark(id) });
  }
  if (i.liveFailed) rows.push({ id: 'reread', kind: 'reread', state: 'waiting' });
  if (i.newestId) rows.push({ id: i.newestId, kind: 'newest', state: mark(i.newestId) });
  if (i.peatId) rows.push({ id: i.peatId, kind: 'peat', state: mark(i.peatId) });
  if (i.level === 'calm') rows.push({ id: 'calm', kind: 'calm', state: mark('calm') });
  else if (i.level) {
    const a = s.alert;
    rows.push({ id: 'village', kind: 'village', state: a.reply ? 'done' : a.times.approved != null ? 'approved' : a.held ? 'held' : 'waiting' });
  }
  rows.push({ id: 'cloud', kind: 'cloud', state: mark('cloud') });
  return rows;
}

/** A row's title, in the reader's language. The four actions keep the classic page's words. */
export function rowTitle(kind: RowKind, tr: (en: string, id: string) => string): string {
  switch (kind) {
    case 'resident': return tr('A resident reports fire: check on the ground', 'Seorang warga melaporkan api: cek di lapangan');
    case 'reread': return tr('Read the hotspots again', 'Baca ulang titik panas');
    case 'newest': return tr('Check the newest hotspot on the ground', 'Cek titik panas terbaru di lapangan');
    case 'peat': return tr('Re-check peat where fire came back', 'Cek ulang gambut tempat api muncul lagi');
    case 'village': return tr('Tell the village', 'Kabari desa');
    case 'calm': return tr('No alert needed today; keep the routine patrol', 'Hari ini tidak perlu peringatan; lanjutkan patroli rutin');
    case 'cloud': return tr('On a clouded day, report "not observed", not "no hotspots"', 'Pada hari berawan, laporkan "tidak teramati", bukan "tidak ada titik panas"');
  }
}

/** Rows still waiting for the office (the first counter of the status strip). */
export const waitingCount = (rows: QueueRow[]): number => rows.filter((r) => r.state === 'waiting').length;
/** The next step: the first row still waiting, or null when none is. */
export const nextRow = (rows: QueueRow[]): QueueRow | null => rows.find((r) => r.state === 'waiting') ?? null;
/** The one row whose lead button takes the accent: the first waiting row that asks the office to press something now
 *  (read the hotspots again, or approve the village alert). The other rows never take it. Once the alert is approved
 *  and no row holds the accent, it passes to the real way to send ("Open in WhatsApp" in the Village tab), so there is
 *  one accented action in view at a time. */
export function accentRow(rows: QueueRow[]): string | null {
  return rows.find((r) => r.state === 'waiting' && (r.kind === 'reread' || r.kind === 'village'))?.id ?? null;
}

// ------------------------------------------------------------------------------------------------ storage

const pad = (n: number) => String(n).padStart(2, '0');
/** The date on this device's own clock, "YYYY-MM-DD": the queue starts fresh each day. */
export function localDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const storageKey = (aoiId: string, nowMs: number): string => `ka_cmd:${aoiId}:${localDay(nowMs)}`;

const isMs = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
/** What was stored, checked. Anything that is not a state of this shape gives a fresh one. An alert that was approved
 *  but never reached "sent" (the page was closed in between) is sent. */
export function parseConsoleState(raw: string | null | undefined, nowMs: number): ConsoleState {
  const fresh = newConsoleState(nowMs);
  if (!raw) return fresh;
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return fresh; }
  if (!body || typeof body !== 'object') return fresh;
  const b = body as Record<string, unknown>;
  const a = b.alert as Record<string, unknown> | undefined;
  if (b.v !== 1 || !a || typeof a !== 'object' || !a.times || typeof a.times !== 'object') return fresh;
  const t = a.times as Record<string, unknown>;
  const times: Partial<Record<AlertStep, number>> = {};
  // a step counts only when the step before it does: the chain never has a gap
  for (const st of ALERT_STEPS) {
    if (!isMs(t[st])) break;
    times[st] = t[st];
  }
  if (times.drafted == null) return fresh;
  if (times.approved != null && times.sent == null) times.sent = times.approved;
  const replied = times.replied != null && (a.reply === 'read' || a.reply === 'fire');
  if (!replied) { delete times.read; delete times.replied; }
  return {
    v: 1,
    alert: { times, held: a.held === true && times.approved == null, reply: replied ? (a.reply as Reply) : null },
    done: Array.isArray(b.done) ? (b.done as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 40) : [],
    guideHidden: b.guideHidden === true,
  };
}

/** "09:42": the clock in Western Indonesia Time, as AlertLoop.tsx writes its step times. */
export const clockWib = (ms: number): string =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }).format(new Date(ms));

// ------------------------------------------------------------------------------------------------ the last seven days

export interface DayBin { fromMs: number; toMs: number; total: number; viirs: number; modis: number }

/** Hotspots per 24 hours, counted back from the read time: seven bins, oldest first. The last bin is the page's
 *  "last 24 hours" and the seven add up to its "last 7 days" (the same edges as lib/now.ts countLive). `points` are the
 *  detections inside the district. These are past detections; nothing here looks ahead. */
export function sevenDays(points: LivePoint[], nowMs: number): DayBin[] {
  const bins: DayBin[] = [];
  for (let k = 6; k >= 0; k--) bins.push({ fromMs: nowMs - (k + 1) * 24 * HOUR, toMs: nowMs - k * 24 * HOUR, total: 0, viirs: 0, modis: 0 });
  for (const p of points) {
    const age = nowMs - pointMs(p);
    if (!(age >= 0) || age > 168 * HOUR) continue;
    const back = age === 0 ? 0 : Math.ceil(age / (24 * HOUR)) - 1;   // 0: the last 24 hours ... 6: the oldest day
    const bin = bins[6 - back]!;
    bin.total += 1;
    if (p[4] === 'MODIS') bin.modis += 1; else bin.viirs += 1;
  }
  return bins;
}

// ------------------------------------------------------------------------------------------------ the tab in the address

export type ConsoleTab = 'village' | 'evidence' | 'assistant';
export const CONSOLE_TABS: readonly ConsoleTab[] = ['village', 'evidence', 'assistant'];

const queryOf = (hash: string) => new URLSearchParams(hash.split('?')[1] ?? '');
/** The tab named in '#/command?aoi=...&tab=evidence'; the village thread when none or an unknown one is named. */
export function tabOf(hash: string): ConsoleTab {
  const t = queryOf(hash).get('tab');
  return t === 'evidence' || t === 'assistant' ? t : 'village';
}
/** The same address with some of its values changed (null removes one). The path ('#/command') is kept. */
export function hashWith(hash: string, set: Record<string, string | null>): string {
  const path = (hash.split('?')[0] || '#/command');
  const q = queryOf(hash);
  for (const [k, v] of Object.entries(set)) {
    if (v == null) q.delete(k); else q.set(k, v);
  }
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}
/** The tab an arrow key moves to (Left, Right, Home, End), or null for any other key. */
export function tabForKey(current: ConsoleTab, key: string): ConsoleTab | null {
  const i = CONSOLE_TABS.indexOf(current), n = CONSOLE_TABS.length;
  if (key === 'ArrowRight') return CONSOLE_TABS[(i + 1) % n]!;
  if (key === 'ArrowLeft') return CONSOLE_TABS[(i + n - 1) % n]!;
  if (key === 'Home') return CONSOLE_TABS[0]!;
  if (key === 'End') return CONSOLE_TABS[n - 1]!;
  return null;
}
