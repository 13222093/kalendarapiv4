// KalenderApi (new file): the command view of "Today in my district" (#/command?aoi=<district aoi_id>&tab=<tab>).
// The same district, the same data and the same rules as the classic page (pages/Now.tsx, through its useNowModel),
// drawn as one working console: a status strip, the disaster office's decision queue on the left, the map in the
// centre, and on the right three tabs (the village thread, the evidence, the AI assistant), with a status bar below.
// The composition follows PeatForge's command centre, used with its authors' permission (NOTICE.md); the code and the
// styles are our own. This file loads no data. The queue's state (what was approved, held or marked done) lives here
// and in the browser's localStorage, by district and by day (lib/nowconsole.ts); the page works without storage.
// The village thread is a demo that sends nothing: only the WhatsApp buttons send, by the reader's own hand.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react';
import { SENSOR_LABEL, districtTitle, pointMs, wib } from '../lib/now.ts';
import {
  CONSOLE_TABS, accentRow, answerAlert, approveAlert, hashWith, holdAlert, hotspotId, localDay, markSent, nextRow, parseConsoleState,
  peatSiteId, queueRows, restartConsole, rowTitle, setGuideHidden, setRowDone, sevenDays, storageKey, tabForKey, tabOf, waitingCount,
  type ConsoleState, type ConsoleTab, type Reply,
} from '../lib/nowconsole.ts';
import { aoiName } from '../lib/record.ts';
import { classicHref } from '../lib/todayview.ts';
import { SiteHeader } from '../components/SiteHeader.tsx';
import { AskAssistant, type AskFacts } from '../components/now/AskAssistant.tsx';
import { DecisionQueue } from '../components/now/DecisionQueue.tsx';
import { EvidenceList } from '../components/now/EvidenceList.tsx';
import { VillageThread } from '../components/now/VillageThread.tsx';
import { NowMap, TABLE_ROWS, useNowModel, type MapFocus } from './Now.tsx';
import '../styles/nowconsole.css';

const SEND_MS = 600;             // from "approved" to "sent" in the demo thread, as components/now/AlertLoop.tsx
const WIDE = '(min-width: 1100px)';   // from this width the console is one screen and its panels scroll on their own

// ------------------------------------------------------------------------------------------------ what the console remembers

function loadState(key: string): ConsoleState {
  let raw: string | null = null;
  try { raw = key ? window.localStorage.getItem(key) : null; } catch { /* storage is off: the queue lives on this page only */ }
  return parseConsoleState(raw, Date.now());
}

/** The queue's state for one district today. Read from localStorage when the district changes, written back on every
 *  change; both are wrapped, so a browser without storage loses nothing but the memory across reloads. */
function useConsoleState(aoiId: string) {
  const [openedAt] = useState(() => Date.now());   // the day is the day the page was opened
  const key = aoiId ? storageKey(aoiId, openedAt) : '';
  const [store, setStore] = useState(() => ({ key, s: loadState(key) }));
  if (store.key !== key) setStore({ key, s: loadState(key) });   // another district (or a new day): its own state
  useEffect(() => {
    if (!store.key) return;
    try { window.localStorage.setItem(store.key, JSON.stringify(store.s)); } catch { /* full or switched off */ }
  }, [store]);
  useEffect(() => {
    // the queue starts fresh each day: yesterday's entries are of no use
    try {
      const today = `:${localDay(Date.now())}`;
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith('ka_cmd:') && !k.endsWith(today)) window.localStorage.removeItem(k);
      }
    } catch { /* storage is off */ }
  }, []);
  const update = useCallback((fn: (s: ConsoleState) => ConsoleState) => {
    setStore((prev) => { const next = fn(prev.s); return next === prev.s ? prev : { key: prev.key, s: next }; });
  }, []);
  return [store.s, update] as const;
}

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (fn) => { const mq = window.matchMedia(query); mq.addEventListener('change', fn); return () => mq.removeEventListener('change', fn); },
    () => window.matchMedia(query).matches,
    () => true,
  );
}

const lessMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

// ------------------------------------------------------------------------------------------------ small parts

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
    </svg>
  );
}

/** A modal sheet over the console (the district picker, the fine print): a native dialog, so focus stays inside and
 *  Escape closes it; a click on the dimmed page closes it too. */
function ConsoleDialog({ open, onClose, id, title, closeLabel, focusId, children }: { open: boolean; onClose: () => void; id: string; title: string; closeLabel: string; focusId?: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      if (focusId) document.getElementById(focusId)?.focus();   // the field the sheet is for, not its close button
    } else if (!open && d.open) d.close();
  }, [open, focusId]);
  return (
    <dialog ref={ref} className="cmd-dialog" aria-labelledby={id} onClose={onClose} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmd-dialog-in">
        <div className="cmd-dialog-head">
          <h2 id={id}>{title}</h2>
          <button type="button" className="cmd-btn cmd-btn-icon" aria-label={closeLabel} onClick={onClose}><CloseIcon /></button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

// ------------------------------------------------------------------------------------------------ the console

export function CommandConsole() {
  const m = useNowModel({ hrefFor: (id) => hashWith(window.location.hash, { aoi: id }) });
  const {
    tr, lang, hash, asked, districts, aoi, unknownAsked, aoiId, name, box, outline, setTick, liveState, liveData, nowMs, marked, counts,
    photoKnown, photoDate, photoDay, sites, peatOutline, result, askFacts,
    q, setQ, lat, setLat, lon, setLon, coordNote, groups, go, findByCoord, num, place, levelName, whyText,
  } = m;
  const wide = useMedia(WIDE);
  const [state, update] = useConsoleState(aoiId);

  // ---- the alert: approve (then "sent" a moment later, as in the classic demo), hold, the resident's reply, start again
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current != null) window.clearTimeout(timer.current); }, []);
  const approve = () => {
    update((s) => approveAlert(s, Date.now()));
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => update((s) => markSent(s, Date.now())), SEND_MS);
  };
  const hold = () => update(holdAlert);
  const reply = (r: Reply) => update((s) => answerAlert(s, r, Date.now()));
  const restart = () => {
    if (timer.current != null) window.clearTimeout(timer.current);
    update((s) => restartConsole(s, Date.now()));
  };

  // ---- the queue, from the same facts and conditions as the classic page's "What to do now"
  const rows = queueRows({
    liveFailed: liveState.state === 'unavailable',
    newestId: counts?.newest ? hotspotId(counts.newest) : null,
    peatId: sites[0] ? peatSiteId(sites[0]) : null,
    level: result.level,
  }, state);
  const waiting = waitingCount(rows);
  const next = nextRow(rows);
  const hasVillageRow = rows.some((r) => r.kind === 'village');

  // ---- the tab, kept in the address (tab=); a change of tab does not add a step to the browser's history
  const tab = tabOf(hash);
  const setTab = (t: ConsoleTab) => {
    const to = hashWith(window.location.hash, { tab: t });
    if (to === window.location.hash) return;
    window.history.replaceState(window.history.state, '', to);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const to = tabForKey(tab, e.key);
    if (!to) return;
    e.preventDefault();
    setTab(to);
    document.getElementById(`cmd-tab-${to}`)?.focus();
  };
  const tabName: Record<ConsoleTab, string> = { village: tr('Village', 'Warga'), evidence: tr('Evidence', 'Bukti'), assistant: tr('Assistant', 'Asisten') };

  // ---- moving between the panels: where the page scrolls (narrow screens) the target is brought into view
  const reveal = (id: string, focus = false) => {
    window.requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (!el) return;
      // (on the one-screen layout the target is already in view, or its own panel scrolls to it)
      el.scrollIntoView({ behavior: lessMotion() ? 'auto' : 'smooth', block: window.matchMedia(WIDE).matches ? 'nearest' : 'start' });
      if (focus) el.focus({ preventScroll: true });
    });
  };
  const [focus, setFocus] = useState<{ key: string; at: MapFocus } | null>(null);
  const showOnMap = (lo: number, la: number) => { setFocus({ key: aoiId, at: { lon: lo, lat: la } }); reveal('cmd-map'); };
  const [othersOpen, setOthersOpen] = useState(false);
  const openCrew = () => { setOthersOpen(true); setTab('village'); reveal('cmd-m-crew', true); };
  const openPeat = () => { setTab('evidence'); reveal('cmd-peat', true); };
  const openThread = () => { setTab('village'); reveal('cmd-thread', true); };
  const openQueueRow = () => reveal('cmd-row-village', true);

  // ---- the two sheets
  const [pickerFor, setPickerFor] = useState<string | null>(null);   // the district the picker was opened on
  const picker = pickerFor !== null && pickerFor === aoiId;           // so it closes by itself once another is picked
  const setPicker = (open: boolean) => setPickerFor(open ? aoiId : null);
  const [fine, setFine] = useState(false);

  const loading = liveState.state === 'loading';
  // The assistant needs a level, and while the hotspots are read again there is none for a moment. The numbers of the
  // reading before are kept for that moment, so "Read again" does not throw the conversation away (on the classic page
  // it does). When the new reading fails, the assistant leaves, as there.
  const askJson = askFacts ? JSON.stringify(askFacts) : null;
  const [lastAsk, setLastAsk] = useState<{ key: string; json: string } | null>(null);
  if (askJson && (lastAsk?.key !== aoiId || lastAsk.json !== askJson)) setLastAsk({ key: aoiId, json: askJson });
  const keptAsk = useMemo(() => (lastAsk ? { key: lastAsk.key, facts: JSON.parse(lastAsk.json) as AskFacts } : null), [lastAsk]);
  const shownAsk = askFacts ?? (loading && keptAsk?.key === aoiId ? keptAsk.facts : null);
  const inside = marked ? marked.filter((x) => x.inside).map((x) => x.p) : null;
  const week = inside ? sevenDays(inside, nowMs) : null;
  const weekMax = week ? Math.max(1, ...week.map((b) => b.total)) : 1;
  const failedNames = liveData ? liveData.failed : [];

  return (
    <div className="cmd-page">
      {/* the same top bar as the classic page (components/SiteHeader.tsx) */}
      <SiteHeader current="now" />

      {/* ---- the status strip: where, the level and its reason, the next step, three counters */}
      <section className="cmd-strip" aria-label={tr('Status', 'Status')}>
        <div className="cmd-strip-main">
          <p className="cmd-label">{tr('Today in my district', 'Hari ini di daerah saya')}{aoi ? ` · ${aoi.province}` : ''}</p>
          <h1 className="cmd-title">
            {!aoi ? tr('Loading the districts…', 'Memuat daftar kabupaten…')
              : loading ? <>{place}. <span className="cmd-title-why">{tr('Reading the hotspots…', 'Membaca titik panas…')}</span></>
                : <>{place}: {result.level ? levelName(result.level) : tr('level not set', 'tingkat belum ditentukan')}. <span className="cmd-title-why">{whyText[result.why]}</span></>}
          </h1>
          {aoi ? (
            <p className="cmd-next">
              <span className="cmd-label">{tr('Next', 'Berikutnya')}</span>{' '}
              {/* the classic page's level badge jumped to the list of actions; here the next step jumps to its row */}
              {next ? <button type="button" className="cmd-link cmd-next-go" onClick={() => reveal(`cmd-row-${next.kind}`, true)}>{rowTitle(next.kind, tr)}</button>
                : tr('Nothing is waiting for a decision.', 'Tidak ada yang menunggu keputusan.')}
            </p>
          ) : null}
          {districts.state === 'error' || districts.state === 'missing' ? (
            <p className="cmd-alert" role="alert">{tr('The district list could not be loaded, so this page cannot show a district.', 'Daftar kabupaten tidak dapat dimuat, sehingga halaman ini tidak dapat menampilkan kabupaten.')}</p>
          ) : null}
          {unknownAsked ? <p className="cmd-small" role="note">{tr(`No district "${asked}" in the record; showing ${name}.`, `Tidak ada kabupaten "${asked}" dalam catatan; menampilkan ${name}.`)}</p> : null}
        </div>
        <dl className="cmd-counters">
          <div><dt>{tr('waiting for a decision', 'menunggu keputusan')}</dt><dd>{aoi ? num(waiting) : '–'}</dd></div>
          <div><dt>{tr('hotspots, 24 hours', 'titik panas, 24 jam')}</dt><dd>{counts ? num(counts.total24) : <span title={tr('not read', 'tidak terbaca')}>–</span>}</dd></div>
          <div><dt>{tr('hotspots, 7 days', 'titik panas, 7 hari')}</dt><dd>{counts ? num(counts.total7) : <span title={tr('not read', 'tidak terbaca')}>–</span>}</dd></div>
        </dl>
        <button type="button" className="cmd-btn cmd-strip-pick" aria-haspopup="dialog" onClick={() => setPicker(true)}>{tr('Change district', 'Ganti kabupaten')}</button>
      </section>

      {aoi && box ? (
        <div className="cmd-grid">
          {/* ---- left: the decision queue */}
          <DecisionQueue m={m} state={state} rows={rows} accent={accentRow(rows)}
            onApprove={approve} onHold={hold} onDone={(id, done) => update((s) => setRowDone(s, id, done))} onRestart={restart}
            onGuide={(hidden) => update((s) => setGuideHidden(s, hidden))} onShow={showOnMap} onPeat={openPeat} onCrew={openCrew} onThread={openThread} />

          {/* ---- centre: the map, then the last seven days and the newest hotspots */}
          <section className="cmd-centre" aria-label={tr('Map and hotspots', 'Peta dan titik panas')}>
            <div className="cmd-map" id="cmd-map">
              <NowMap key={aoiId} box={box} outline={outline} points={marked} photoDate={photoDate} sites={sites} peat={peatOutline}
                focus={focus && focus.key === aoiId ? focus.at : null} freeWheel={wide}
                label={tr(`Map of ${place}: hotspots of the last 7 days over NASA's newest photo`, `Peta ${place}: titik panas 7 hari terakhir di atas foto NASA terbaru`)} />
              {liveState.state === 'unavailable' ? (
                <p className="cmd-map-flag">{tr('No live hotspot data: an empty map here does not mean no fire.', 'Tidak ada data titik panas langsung: peta kosong di sini tidak berarti tidak ada api.')}</p>
              ) : null}
            </div>
            <div className="cmd-under">
              <ul className="cmd-legend" aria-label={tr('Legend', 'Legenda')}>
                <li><i className="now-dot now-dot-viirs" aria-hidden="true" />VIIRS (NOAA-20, NOAA-21)</li>
                <li><i className="now-dot now-dot-modis" aria-hidden="true" />MODIS</li>
                <li><i className="now-dot now-dot-viirs now-dot-out" aria-hidden="true" />{tr('faint: outside the district (not counted)', 'pudar: di luar kabupaten (tidak dihitung)')}</li>
                <li><i className="now-line" aria-hidden="true" />{tr('district outline', 'batas kabupaten')}</li>
                {peatOutline ? <li><i className="now-line now-line-peat" aria-hidden="true" />{tr('peat outline', 'batas gambut')}</li> : null}
                {sites.length ? <li><i className="now-ring" aria-hidden="true" />{tr('peat site to re-check', 'lokasi gambut untuk dicek ulang')}</li> : null}
                <li className="cmd-legend-photo">{!photoKnown ? tr('photo: looking…', 'foto: mencari…') : photoDay ? tr(`photo: ${photoDay}`, `foto: ${photoDay}`) : tr('photo: none', 'foto: tidak ada')}</li>
              </ul>
              <details className="cmd-more">
                <summary>{tr('About the photo and the map', 'Tentang foto dan peta')}</summary>
                <p className="cmd-small">
                  {!photoKnown ? tr('Looking for NASA\'s newest photo…', 'Mencari foto NASA terbaru…')
                    : photoDay ? tr(`Photo: VIIRS NOAA-20 true colour of ${photoDay} (UTC day), the early-afternoon pass, from NASA GIBS. White is cloud; black wedges are gaps between passes. Hotspots are of the last 7 days, so some are older than the photo.`,
                      `Foto: warna asli VIIRS NOAA-20 tanggal ${photoDay} (hari UTC), lintasan awal siang, dari NASA GIBS. Putih adalah awan; baji hitam adalah celah antar lintasan. Titik panas berasal dari 7 hari terakhir, jadi sebagian lebih lama daripada foto.`)
                      : tr('NASA\'s photo of today and of the two days before could not be loaded, so the map has no photo. Cloud cannot be judged here.', 'Foto NASA hari ini dan dua hari sebelumnya tidak dapat dimuat, sehingga peta tidak memuat foto. Awan tidak dapat dinilai di sini.')}
                  {' '}{wide
                    ? tr('Zoom with the + and − buttons or the wheel; drag to move; with the keyboard, focus the map and use the arrow, + and − keys. Imagery: NASA GIBS. District boundary: geoBoundaries (BPS, WFP, OCHA ROAP), CC BY 3.0 IGO.', 'Perbesar dengan tombol + dan − atau roda; seret untuk menggeser; dengan papan ketik, fokuskan peta lalu pakai tombol panah, + dan −. Citra: NASA GIBS. Batas kabupaten: geoBoundaries (BPS, WFP, OCHA ROAP), CC BY 3.0 IGO.')
                    : tr('Zoom with the + and − buttons, or Ctrl + wheel; drag to move (two fingers on a phone); with the keyboard, focus the map and use the arrow, + and − keys. Imagery: NASA GIBS. District boundary: geoBoundaries (BPS, WFP, OCHA ROAP), CC BY 3.0 IGO.', 'Perbesar dengan tombol + dan −, atau Ctrl + roda; seret untuk menggeser (dua jari di ponsel); dengan papan ketik, fokuskan peta lalu pakai tombol panah, + dan −. Citra: NASA GIBS. Batas kabupaten: geoBoundaries (BPS, WFP, OCHA ROAP), CC BY 3.0 IGO.')}
                </p>
              </details>

              {/* the last seven days, per 24 hours counted back from the read time: past detections, never a forecast */}
              <section className="cmd-week" aria-labelledby="cmd-h-week">
                <p id="cmd-h-week" className="cmd-week-cap">
                  <b>{tr('Hotspots in this district, last 7 days', 'Titik panas di kabupaten ini, 7 hari terakhir')}</b>{' '}
                  {tr('Past detections from NASA FIRMS, per 24 hours before the read time. Not a forecast.', 'Deteksi yang sudah terjadi dari NASA FIRMS, per 24 jam sebelum waktu baca. Bukan prakiraan.')}
                </p>
                {week ? (
                  <>
                    <ol className="cmd-week-cells">
                      {week.map((b, i) => (
                        <li key={b.fromMs} className={b.total ? 'has' : undefined}
                          title={tr(`${wib(b.fromMs, lang)} to ${wib(b.toMs, lang)}: ${num(b.total)} (VIIRS ${num(b.viirs)}, MODIS ${num(b.modis)})`, `${wib(b.fromMs, lang)} sampai ${wib(b.toMs, lang)}: ${num(b.total)} (VIIRS ${num(b.viirs)}, MODIS ${num(b.modis)})`)}>
                          <span className="cmd-week-n">{num(b.total)}</span>
                          <span className="cmd-week-bar" aria-hidden="true">
                            <i className="is-viirs" style={{ width: `${(b.viirs / weekMax) * 100}%` }} /><i className="is-modis" style={{ width: `${(b.modis / weekMax) * 100}%` }} />
                          </span>
                          <span className="cmd-sr">
                            {i === 6 ? tr('hotspots in the last 24 hours', 'titik panas dalam 24 jam terakhir') : tr(`hotspots, ${6 - i + 1} days ago to ${6 - i} days ago`, `titik panas, ${6 - i + 1} hari lalu sampai ${6 - i} hari lalu`)}
                            {b.total ? tr(`: VIIRS ${num(b.viirs)}, MODIS ${num(b.modis)}`, `: VIIRS ${num(b.viirs)}, MODIS ${num(b.modis)}`) : ''}
                          </span>
                        </li>
                      ))}
                    </ol>
                    <p className="cmd-week-ticks" aria-hidden="true"><span>{tr('7 days ago', '7 hari lalu')}</span><span>{tr('last 24 hours', '24 jam terakhir')}</span></p>
                  </>
                ) : (
                  <p className="cmd-small" role="status">{loading ? tr('Reading the newest NASA hotspot files…', 'Membaca berkas titik panas NASA terbaru…')
                    : tr('Not read: the hotspots of these days are unknown, not zero.', 'Tidak terbaca: titik panas pada hari-hari ini tidak diketahui, bukan nol.')}</p>
                )}
              </section>

              {counts && counts.recent.length ? (
                <details className="cmd-more cmd-recent">
                  <summary>{tr(`Newest hotspots in the district (${Math.min(TABLE_ROWS, counts.recent.length)} of ${counts.recent.length} in 7 days)`, `Titik panas terbaru di kabupaten (${Math.min(TABLE_ROWS, counts.recent.length)} dari ${counts.recent.length} dalam 7 hari)`)}</summary>
                  <div className="cmd-scroll-x" tabIndex={0} role="region" aria-label={tr('Newest hotspots in the district', 'Titik panas terbaru di kabupaten')}>
                    <table className="cmd-table">
                      <thead><tr>
                        <th scope="col">{tr('Detected (WIB)', 'Terdeteksi (WIB)')}</th><th scope="col">{tr('Satellite', 'Satelit')}</th>
                        <th scope="col">{tr('Latitude', 'Lintang')}</th><th scope="col">{tr('Longitude', 'Bujur')}</th>
                        <th scope="col">{tr('Fire power (MW)', 'Daya api (MW)')}</th><th scope="col">{tr('Day or night', 'Siang atau malam')}</th>
                        <th scope="col"><span className="cmd-sr">{tr('Map', 'Peta')}</span></th>
                      </tr></thead>
                      <tbody>
                        {counts.recent.slice(0, TABLE_ROWS).map((p, i) => (
                          <tr key={i}>
                            <td>{wib(pointMs(p), lang).replace(' WIB', '')}</td><td>{SENSOR_LABEL[p[4]]}</td>
                            <td className="num">{p[1].toFixed(4)}</td><td className="num">{p[0].toFixed(4)}</td>
                            <td className="num">{p[2] != null ? num(p[2], 1) : '–'}</td><td>{p[3] === 'N' ? tr('night', 'malam') : tr('day', 'siang')}</td>
                            <td><button type="button" className="cmd-link" onClick={() => showOnMap(p[0], p[1])}
                              aria-label={tr(`Show hotspot ${i + 1} on the map`, `Lihat titik panas ${i + 1} di peta`)}>{tr('Map', 'Peta')}</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ) : null}
            </div>
          </section>

          {/* ---- right: the village thread, the evidence, the assistant */}
          <section className="cmd-side" aria-label={tr('Village, evidence and assistant', 'Warga, bukti, dan asisten')}>
            <div className="cmd-tabs" role="tablist" aria-label={tr('Side panel', 'Panel samping')}>
              {CONSOLE_TABS.map((t) => (
                <button key={t} type="button" role="tab" id={`cmd-tab-${t}`} aria-selected={tab === t} aria-controls={`cmd-panel-${t}`} tabIndex={tab === t ? 0 : -1}
                  onClick={() => setTab(t)} onKeyDown={onTabKey}>{tabName[t]}</button>
              ))}
            </div>
            <div className="cmd-tabpanel" role="tabpanel" id="cmd-panel-village" aria-labelledby="cmd-tab-village" hidden={tab !== 'village'}>
              <VillageThread m={m} state={state} hasVillageRow={hasVillageRow} othersOpen={othersOpen} onOthers={setOthersOpen}
                onApprove={approve} onHold={hold} onReply={reply} onQueue={openQueueRow} />
            </div>
            <div className="cmd-tabpanel" role="tabpanel" id="cmd-panel-evidence" aria-labelledby="cmd-tab-evidence" hidden={tab !== 'evidence'}>
              <EvidenceList m={m} onShow={showOnMap} />
            </div>
            <div className="cmd-tabpanel" role="tabpanel" id="cmd-panel-assistant" aria-labelledby="cmd-tab-assistant" hidden={tab !== 'assistant'}>
              {shownAsk ? (
                <AskAssistant key={`ask:${aoiId}`} variant="panel" facts={shownAsk} lang={lang} place={districtTitle(aoiName(aoi, lang), lang)} hasPeat={sites.length > 0} />
              ) : (
                <p className="cmd-small cmd-pad" role="note">
                  {loading ? tr('Reading the hotspots…', 'Membaca titik panas…')
                    : tr('The assistant answers from today\'s level and this month\'s record. One of them could not be read for this district, so it is not offered here now.', 'Asisten menjawab dari tingkat hari ini dan catatan bulan ini. Salah satunya tidak dapat dibaca untuk kabupaten ini, sehingga asisten tidak ditawarkan di sini sekarang.')}
                </p>
              )}
            </div>
          </section>
        </div>
      ) : <div className="cmd-grid cmd-grid-empty" />}

      {/* ---- the status bar: where and when the data was read, whose level this is, and the fine print */}
      <footer className="cmd-bar">
        <span className="cmd-bar-item">
          <i className={`cmd-bar-dot${liveData ? ' is-on' : ''}`} aria-hidden="true" />
          {liveData ? tr(`NASA FIRMS, read ${wib(nowMs, lang)}`, `NASA FIRMS, dibaca ${wib(nowMs, lang)}`)
            : loading ? tr('NASA FIRMS: reading…', 'NASA FIRMS: membaca…') : tr('NASA FIRMS: live hotspots could not be read', 'NASA FIRMS: titik panas langsung tidak dapat dibaca')}
        </span>
        <button type="button" className="cmd-link" onClick={() => setTick((t) => t + 1)} disabled={loading}>{loading ? tr('Reading…', 'Membaca…') : tr('Read again', 'Baca ulang')}</button>
        {failedNames.length ? (
          <span className="cmd-bar-item is-warn">{tr(`Not read this time: ${failedNames.join(', ')}; its count is unknown, not zero.`, `Tidak terbaca kali ini: ${failedNames.join(', ')}; jumlahnya tidak diketahui, bukan nol.`)}</span>
        ) : null}
        <span className="cmd-bar-item">{tr('Level: our own rule, not an official status', 'Tingkat: aturan kami sendiri, bukan status resmi')}</span>
        <span className="cmd-bar-end">
          <button type="button" className="cmd-link" aria-haspopup="dialog" onClick={() => setFine(true)}>{tr('Fine print', 'Catatan penting')}</button>
          {aoiId ? <a className="cmd-link" href={classicHref(aoiId)}>{tr('Classic view', 'Tampilan klasik')}</a> : null}
        </span>
      </footer>

      {/* ---- the district picker: the classic page's search of 514 districts and its latitude and longitude lookup */}
      <ConsoleDialog open={picker} onClose={() => setPicker(false)} id="cmd-h-pick" title={tr('Change district', 'Ganti kabupaten')} closeLabel={tr('Close', 'Tutup')} focusId="cmd-q">
        <div className="cmd-find" role="search" aria-label={tr('Pick the district', 'Pilih kabupaten')}>
          <label htmlFor="cmd-q">{tr('Change district (514 districts and cities)', 'Ganti kabupaten (514 kabupaten dan kota)')}</label>
          <input id="cmd-q" type="search" value={q} onChange={(ev) => setQ(ev.target.value)} autoComplete="off"
            placeholder={tr('Search a district, for example Kapuas', 'Cari kabupaten, misalnya Kapuas')} />
          {q.trim().length >= 2 ? (
            groups.length ? (
              <ul className="cmd-results" aria-label={tr('Matching districts', 'Kabupaten yang cocok')}>
                {groups.flatMap((g) => g.items.map((d) => (
                  <li key={d.aoi_id}>
                    <button type="button" onClick={() => { setPicker(false); go(d.aoi_id); }}>{aoiName(d, lang)} <small>{g.province}</small></button>
                  </li>
                )))}
              </ul>
            ) : <p className="cmd-small" role="status">{tr('No district matches.', 'Tidak ada kabupaten yang cocok.')}</p>
          ) : null}
          <form onSubmit={findByCoord} className="cmd-coord" aria-label={tr('Find the district of a point', 'Cari kabupaten dari satu titik')}>
            <p className="cmd-label">{tr('Or find by latitude and longitude', 'Atau cari dengan lintang dan bujur')}</p>
            <div><label htmlFor="cmd-lat">{tr('Latitude', 'Lintang')}</label><input id="cmd-lat" inputMode="decimal" value={lat} onChange={(ev) => setLat(ev.target.value)} placeholder="-2.72" /></div>
            <div><label htmlFor="cmd-lon">{tr('Longitude', 'Bujur')}</label><input id="cmd-lon" inputMode="decimal" value={lon} onChange={(ev) => setLon(ev.target.value)} placeholder="113.95" /></div>
            <button type="submit" className="cmd-btn">{tr('Find the district', 'Cari kabupaten')}</button>
            {coordNote ? <p className="cmd-small cmd-coord-note" role="status">{coordNote}</p> : null}
          </form>
        </div>
      </ConsoleDialog>

      {/* ---- the fine print of the classic page, word for word */}
      <ConsoleDialog open={fine} onClose={() => setFine(false)} id="cmd-h-fine" title={tr('Fine print', 'Catatan penting')} closeLabel={tr('Close', 'Tutup')}>
        <ul className="cmd-fine">
          <li>{tr('Near-real-time detections can miss fires: cloud, thick smoke, the hours between satellite passes, and fires too small or too cool to detect.', 'Deteksi waktu hampir nyata bisa melewatkan api: awan, asap tebal, jam-jam di antara lintasan satelit, serta api yang terlalu kecil atau terlalu dingin untuk dideteksi.')}</li>
          <li>{tr('A hotspot is a detection of heat. It is not a confirmed fire and not burned area.', 'Titik panas adalah deteksi panas. Itu bukan kebakaran yang terkonfirmasi dan bukan luas terbakar.')}</li>
          <li>{tr('This page sends nothing by itself. A message goes out only when you copy it or open it in WhatsApp and send it.', 'Halaman ini tidak mengirim apa pun dengan sendirinya. Pesan baru terkirim bila Anda menyalinnya atau membukanya di WhatsApp lalu mengirimnya.')}</li>
          <li>{tr('It is not an official warning system and its levels are not a government status. Follow BMKG, KLHK (SiPongi) and your BPBD for official information.', 'Ini bukan sistem peringatan resmi dan tingkatnya bukan status pemerintah. Ikuti BMKG, KLHK (SiPongi), dan BPBD Anda untuk informasi resmi.')}</li>
          <li>{tr('Always verify on the ground before acting. Times are in WIB (UTC+7) for every district.', 'Selalu verifikasi di lapangan sebelum bertindak. Waktu ditulis dalam WIB (UTC+7) untuk semua kabupaten.')}</li>
        </ul>
      </ConsoleDialog>
    </div>
  );
}

export default CommandConsole;
