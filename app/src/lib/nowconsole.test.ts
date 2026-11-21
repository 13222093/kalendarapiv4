// KalenderApi (new file): tests of lib/nowconsole.ts (the command view of "Today in my district").
import { describe, expect, it } from 'vitest';
import { HOUR, countLive, type LivePoint } from './now.ts';
import {
  ALERT_STEPS, accentRow, activeStep, alertStatus, answerAlert, approveAlert, clockWib, hashWith, holdAlert, hotspotId, localDay, markSent,
  newConsoleState, nextRow, parseConsoleState, peatSiteId, queueRows, restartConsole, rowTitle, setGuideHidden, setRowDone, sevenDays, storageKey,
  tabForKey, tabOf, threadOf, waitingCount, type QueueInput,
} from './nowconsole.ts';
import { TODAY_DEFAULT_VIEW, classicHref, consoleHref, todayViewOf } from './todayview.ts';

const NOW = Date.UTC(2026, 10, 21, 2, 42);   // 21 Nov 2026 02:42 UTC = 09:42 WIB
const pt = (date: string, time: string, sensor: 'N20' | 'N21' | 'MODIS' = 'N20'): LivePoint => [113.9216, -3.3715, 4.6, 'D', sensor, date, time];
const NEWEST = pt('2026-11-17', '0624', 'N21');
const watch: QueueInput = { liveFailed: false, newestId: hotspotId(NEWEST), peatId: peatSiteId({ lat: -2.845, lon: 113.785 }), level: 'watch' };

describe('the village alert', () => {
  it('starts as a draft with one time', () => {
    const s = newConsoleState(NOW);
    expect(s.alert.times).toEqual({ drafted: NOW });
    expect(activeStep(s.alert)).toBe('drafted');
    expect(alertStatus(s.alert)).toBe('waiting');
  });
  it('goes drafted, approved, sent, read, replied, each with its time', () => {
    let s = approveAlert(newConsoleState(NOW), NOW + 1000);
    expect([activeStep(s.alert), alertStatus(s.alert)]).toEqual(['approved', 'sending']);
    s = markSent(s, NOW + 1600);
    expect([activeStep(s.alert), alertStatus(s.alert)]).toEqual(['sent', 'sent']);
    s = answerAlert(s, 'read', NOW + 60_000);
    expect(s.alert.times).toEqual({ drafted: NOW, approved: NOW + 1000, sent: NOW + 1600, read: NOW + 60_000, replied: NOW + 60_000 });
    expect([activeStep(s.alert), alertStatus(s.alert)]).toEqual(['replied', 'read']);
    expect(ALERT_STEPS.every((st) => s.alert.times[st] != null)).toBe(true);
  });
  it('approves once, and a held alert can still be approved', () => {
    const held = holdAlert(newConsoleState(NOW));
    expect(alertStatus(held.alert)).toBe('held');
    const ok = approveAlert(held, NOW + 5);
    expect(ok.alert.held).toBe(false);
    expect(approveAlert(ok, NOW + 99)).toBe(ok);            // a second approval changes nothing
    expect(holdAlert(ok)).toBe(ok);                          // nor does Hold after approval
  });
  it('takes no reply before the alert is sent, and only one reply after', () => {
    const draft = newConsoleState(NOW);
    expect(answerAlert(draft, 'fire', NOW)).toBe(draft);
    expect(markSent(draft, NOW)).toBe(draft);               // nothing is sent without approval
    const sent = markSent(approveAlert(draft, NOW), NOW);
    const fire = answerAlert(sent, 'fire', NOW + 10);
    expect(fire.alert.reply).toBe('fire');
    expect(answerAlert(fire, 'read', NOW + 20)).toBe(fire);
  });
  it('writes the thread: the draft waiting, then sent, then the reply and the office answer', () => {
    let s = newConsoleState(NOW);
    expect(threadOf(s.alert)).toEqual([{ key: 'alert', who: 'office', kind: 'alert', at: NOW, mark: 'waiting' }]);
    expect(threadOf(holdAlert(s).alert)[0]!.mark).toBe('held');
    s = approveAlert(s, NOW + 1);
    expect(threadOf(s.alert)[0]!.mark).toBe('sending');
    s = markSent(s, NOW + 2);
    expect(threadOf(s.alert)).toEqual([{ key: 'alert', who: 'office', kind: 'alert', at: NOW + 2, mark: 'sent' }]);
    s = answerAlert(s, 'fire', NOW + 3);
    expect(threadOf(s.alert).map((l) => [l.who, l.kind, l.at])).toEqual([
      ['office', 'alert', NOW + 2], ['resident', 'reply-fire', NOW + 3], ['office', 'ack-fire', NOW + 3],
    ]);
  });
  it('starts again with a new draft, keeping the guide dismissed', () => {
    let s = setGuideHidden(answerAlert(markSent(approveAlert(newConsoleState(NOW), NOW), NOW), 'fire', NOW), true);
    s = setRowDone(s, 'cloud', true);
    const again = restartConsole(s, NOW + 500);
    expect(again).toEqual({ v: 1, alert: { times: { drafted: NOW + 500 }, held: false, reply: null }, done: [], guideHidden: true });
  });
});

describe('the decision queue', () => {
  it('lists the four actions of the classic page under the same conditions', () => {
    const rows = queueRows(watch, newConsoleState(NOW));
    expect(rows.map((r) => r.kind)).toEqual(['newest', 'peat', 'village', 'cloud']);
    expect(rows.every((r) => r.state === 'waiting')).toBe(true);
    expect(waitingCount(rows)).toBe(4);
    expect(nextRow(rows)?.kind).toBe('newest');
  });
  it('has no hotspot row without a hotspot and no peat row without peat data', () => {
    const rows = queueRows({ liveFailed: false, newestId: null, peatId: null, level: 'calm' }, newConsoleState(NOW));
    expect(rows.map((r) => r.kind)).toEqual(['calm', 'cloud']);
  });
  it('asks to read again when live data failed, and offers no village row without a level', () => {
    const rows = queueRows({ liveFailed: true, newestId: null, peatId: watch.peatId, level: null }, newConsoleState(NOW));
    expect(rows.map((r) => r.kind)).toEqual(['reread', 'peat', 'cloud']);
    expect(accentRow(rows)).toBe('reread');
  });
  it('follows the alert: waiting, held, approved, then done once a resident replied', () => {
    const village = (s: ReturnType<typeof newConsoleState>) => queueRows(watch, s).find((r) => r.kind === 'village')!.state;
    let s = newConsoleState(NOW);
    expect(village(s)).toBe('waiting');
    expect(village(holdAlert(s))).toBe('held');
    s = markSent(approveAlert(s, NOW), NOW);
    expect(village(s)).toBe('approved');
    expect(village(answerAlert(s, 'read', NOW))).toBe('done');
  });
  it('puts a resident report of fire in a new row at the top', () => {
    const sent = markSent(approveAlert(newConsoleState(NOW), NOW), NOW);
    expect(queueRows(watch, answerAlert(sent, 'read', NOW + 7)).some((r) => r.kind === 'resident')).toBe(false);
    const fire = answerAlert(sent, 'fire', NOW + 7);
    const rows = queueRows(watch, fire);
    expect(rows.map((r) => r.kind)).toEqual(['resident', 'newest', 'peat', 'village', 'cloud']);
    expect(rows[0]).toEqual({ id: `resident:${NOW + 7}`, kind: 'resident', state: 'waiting' });
    expect(nextRow(rows)?.kind).toBe('resident');
    expect(accentRow(rows)).toBeNull();                      // the alert is approved: the accent is on the real way to send
    const checked = queueRows(watch, setRowDone(fire, rows[0]!.id, true));
    expect(checked[0]!.state).toBe('done');
    expect(accentRow(checked)).toBeNull();
  });
  it('marks a row done and reopens it; a newer hotspot is a new row', () => {
    let s = setRowDone(newConsoleState(NOW), watch.newestId!, true);
    expect(queueRows(watch, s)[0]!.state).toBe('done');
    expect(waitingCount(queueRows(watch, s))).toBe(3);
    expect(nextRow(queueRows(watch, s))?.kind).toBe('peat');
    const newer = { ...watch, newestId: hotspotId(pt('2026-11-21', '0130', 'N20')) };
    expect(queueRows(newer, s)[0]!.state).toBe('waiting');
    s = setRowDone(s, watch.newestId!, false);
    expect(queueRows(watch, s)[0]!.state).toBe('waiting');
    expect(setRowDone(s, watch.newestId!, false)).toBe(s);
  });
  it('gives the accent to the village alert while it waits, and to no row after', () => {
    const s = newConsoleState(NOW);
    expect(accentRow(queueRows(watch, s))).toBe('village');
    expect(accentRow(queueRows({ ...watch, liveFailed: true }, s))).toBe('reread');   // reading again comes first
    expect(accentRow(queueRows(watch, holdAlert(s)))).toBeNull();
    expect(accentRow(queueRows(watch, approveAlert(s, NOW)))).toBeNull();
    expect(accentRow(queueRows({ ...watch, level: 'calm' }, s))).toBeNull();
  });
  it('names a hotspot and a peat site by where and when', () => {
    expect(hotspotId(NEWEST)).toBe('newest:2026-11-17T0624:-3.3715,113.9216:N21');
    expect(peatSiteId({ lat: -2.845, lon: 113.785 })).toBe('peat:-2.845,113.785');
  });
});

describe('storage', () => {
  it('keys the state by district and by the day on this device', () => {
    const local = new Date(2026, 10, 21, 9, 0).getTime();
    expect(localDay(local)).toBe('2026-11-21');
    expect(storageKey('kab-pulang-pisau', local)).toBe('ka_cmd:kab-pulang-pisau:2026-11-21');
  });
  it('reads back what it wrote', () => {
    const s = setRowDone(answerAlert(markSent(approveAlert(newConsoleState(NOW), NOW + 1), NOW + 2), 'fire', NOW + 3), 'cloud', true);
    expect(parseConsoleState(JSON.stringify(s), NOW + 9)).toEqual(s);
  });
  it('gives a fresh state for anything else', () => {
    const fresh = newConsoleState(NOW);
    for (const raw of [null, '', 'not json', '[]', '{"v":2}', '{"v":1}', '{"v":1,"alert":{"times":{}}}', '{"v":1,"alert":{"times":{"drafted":"x"}}}']) {
      expect(parseConsoleState(raw, NOW)).toEqual(fresh);
    }
  });
  it('repairs a state that cannot be: approved but never sent, a reply without a time', () => {
    const half = parseConsoleState(JSON.stringify({ v: 1, alert: { times: { drafted: NOW, approved: NOW + 1 }, held: true, reply: null }, done: ['cloud', 7], guideHidden: true }), NOW + 5);
    expect(half.alert.times).toEqual({ drafted: NOW, approved: NOW + 1, sent: NOW + 1 });
    expect(half.alert.held).toBe(false);
    expect(half.done).toEqual(['cloud']);
    expect(half.guideHidden).toBe(true);
    const noTime = parseConsoleState(JSON.stringify({ v: 1, alert: { times: { drafted: NOW }, held: false, reply: 'fire' }, done: [] }), NOW);
    expect(noTime.alert.reply).toBeNull();
    expect(queueRows(watch, noTime).some((r) => r.kind === 'resident')).toBe(false);
  });
  it('writes the clock in WIB', () => {
    expect(clockWib(NOW)).toBe('09:42');
  });
});

describe('the last seven days', () => {
  const points = [
    pt('2026-11-21', '0242'),            // the read time itself: the last 24 hours
    pt('2026-11-20', '0600', 'MODIS'),   // 20 h 42 min ago: the last 24 hours
    pt('2026-11-20', '0242', 'N21'),     // exactly 24 h ago: still the last 24 hours (as countLive)
    pt('2026-11-20', '0241'),            // a minute older: the day before
    pt('2026-11-17', '0624', 'N21'),     // about 92 h ago: the fourth bin back
    pt('2026-11-14', '0242', 'MODIS'),   // exactly 168 h ago: the oldest bin
    pt('2026-11-14', '0241'),            // older than 7 days: not counted
    pt('2026-11-21', '0300'),            // after the read time: not counted
  ];
  it('has seven 24-hour bins, oldest first, ending at the read time', () => {
    const bins = sevenDays(points, NOW);
    expect(bins).toHaveLength(7);
    expect(bins[6]!.toMs).toBe(NOW);
    expect(bins[0]!.fromMs).toBe(NOW - 168 * HOUR);
    for (let k = 1; k < 7; k++) expect(bins[k]!.fromMs).toBe(bins[k - 1]!.toMs);
    expect(bins.map((b) => b.total)).toEqual([1, 0, 0, 1, 0, 1, 3]);
    expect(bins[6]).toMatchObject({ total: 3, viirs: 2, modis: 1 });
    expect(bins[0]).toMatchObject({ total: 1, viirs: 0, modis: 1 });
  });
  it('agrees with the page counts: the last bin is the 24 hours, the seven are the 7 days', () => {
    const bins = sevenDays(points, NOW), c = countLive(points, NOW);
    expect(bins[6]!.total).toBe(c.total24);
    expect(bins.reduce((n, b) => n + b.total, 0)).toBe(c.total7);
    expect(bins.reduce((n, b) => n + b.modis, 0)).toBe(c.by7.MODIS);
    expect(bins.reduce((n, b) => n + b.viirs, 0)).toBe(c.by7.N20 + c.by7.N21);
  });
  it('is seven zeros for no points', () => {
    expect(sevenDays([], NOW).map((b) => b.total)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe('the tab in the address', () => {
  it('reads the tab, the village thread by default', () => {
    expect(tabOf('#/command?aoi=kab-pulang-pisau')).toBe('village');
    expect(tabOf('#/command?aoi=kab-pulang-pisau&tab=evidence')).toBe('evidence');
    expect(tabOf('#/command?tab=assistant')).toBe('assistant');
    expect(tabOf('#/command?tab=nonsense')).toBe('village');
    expect(tabOf('')).toBe('village');
  });
  it('changes one value of the address and keeps the rest', () => {
    expect(hashWith('#/command?aoi=kab-pulang-pisau&lang=id', { tab: 'evidence' })).toBe('#/command?aoi=kab-pulang-pisau&lang=id&tab=evidence');
    expect(hashWith('#/command?aoi=kab-pulang-pisau&tab=evidence', { aoi: 'kab-kapuas' })).toBe('#/command?aoi=kab-kapuas&tab=evidence');
    expect(hashWith('#/command?aoi=x&tab=evidence', { tab: null })).toBe('#/command?aoi=x');
    expect(hashWith('#/command', { aoi: 'kota-palangka-raya' })).toBe('#/command?aoi=kota-palangka-raya');
  });
  it('opens the command view at #/now and #/command, and the classic page at #/now?view=classic (lib/todayview.ts)', () => {
    expect(TODAY_DEFAULT_VIEW).toBe('console');                       // the one value that says which view '#/now' opens
    expect(todayViewOf('#/now')).toBe(TODAY_DEFAULT_VIEW);
    expect(todayViewOf('#/now?aoi=kab-pulang-pisau')).toBe(TODAY_DEFAULT_VIEW);
    expect(todayViewOf('#/command')).toBe('console');
    expect(todayViewOf('#/command?aoi=kab-pulang-pisau&tab=evidence')).toBe('console');
    expect(todayViewOf('#/now?view=console&aoi=kab-kapuas')).toBe('console');
    expect(todayViewOf('#/now?view=classic')).toBe('classic');
    for (const other of ['', '#/', '#/nowhere', '#/commander', '#/record?aoi=IDN', '#/home']) expect(todayViewOf(other)).toBeNull();
    expect(classicHref('kab-pulang-pisau')).toBe('#/now?view=classic&aoi=kab-pulang-pisau');
    expect(consoleHref('kab-pulang-pisau')).toBe('#/command?aoi=kab-pulang-pisau');
    expect(todayViewOf(classicHref('kab-kapuas'))).toBe('classic');
    expect(todayViewOf(consoleHref('kab-kapuas'))).toBe('console');
  });
  it('names every row in both languages', () => {
    const en = (a: string) => a, id = (_a: string, b: string) => b;
    for (const kind of ['resident', 'reread', 'newest', 'peat', 'village', 'calm', 'cloud'] as const) {
      expect(rowTitle(kind, en).length).toBeGreaterThan(5);
      expect(rowTitle(kind, id)).not.toBe(rowTitle(kind, en));
    }
    expect(rowTitle('village', en)).toBe('Tell the village');
    expect(rowTitle('resident', id)).toBe('Seorang warga melaporkan api: cek di lapangan');
  });
  it('moves between tabs with the arrow keys, and wraps', () => {
    expect(tabForKey('village', 'ArrowRight')).toBe('evidence');
    expect(tabForKey('assistant', 'ArrowRight')).toBe('village');
    expect(tabForKey('village', 'ArrowLeft')).toBe('assistant');
    expect(tabForKey('evidence', 'Home')).toBe('village');
    expect(tabForKey('evidence', 'End')).toBe('assistant');
    expect(tabForKey('evidence', 'Enter')).toBeNull();
  });
});
