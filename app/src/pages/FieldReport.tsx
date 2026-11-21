// KalenderApi (new file): the two papers of "Today in my district" (#/report?aoi=<district aoi_id>&doc=daily|plan).
// What a disaster office works with every day, asked for by a team member on 21 November 2026: the daily fire
// report (laporan harian karhutla) and a draft field check plan (the shape of a "renlap"), each as one A4 page.
// The same district, data and rules as the Today page (useNowModel in pages/Now.tsx): this file loads nothing of its
// own. Every sentence and number of a paper is made in lib/fieldreport.ts, from which the text for WhatsApp is also
// written, so the page and the text cannot disagree. What the satellites do not give (burned area, crews, aircraft,
// water, weather, air quality) is a blank the officer types into; those blanks live in this browser only (localStorage,
// by district and day) and are sent nowhere. The decisions come from the command view's own storage, read and never
// written. One optional paragraph can be written by an AI model (public/api/ask.js, task mode): it is marked as AI,
// can be edited or removed, and the paper is complete without it. Styles: styles/fieldreport.css.
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { SENSOR_LABEL, isSensor, waLink } from '../lib/now.ts';
import { againSites, mapsHref, type Visit } from '../lib/burnsites.ts';
import { hotspotId, localDay, parseConsoleState, peatSiteId, queueRows, sevenDays, storageKey, type ConsoleState } from '../lib/nowconsole.ts';
import { aoiName } from '../lib/record.ts';
import { consoleHref, reportDocOf, reportHref, type ReportDoc } from '../lib/todayview.ts';
import {
  askFactsFor, boundsOf, dailyPaper, dayWib, decisionsOf, emptyNotes, fieldMax, frameOf, growBounds, notesKey, paperText, parseNotes, planPaper, ringsOf,
  scaleBarKm,
  type Bounds, type DailyPaper, type OfficerBlock, type OfficerNotes, type PaperTable, type PeatBlock, type PlacesBlock, type PlanPaper,
  type ReportInput, type ReportSummary,
} from '../lib/fieldreport.ts';
import type { Lang, Tr } from '../lib/lang.ts';
import { SiteHeader } from '../components/SiteHeader.tsx';
import { copyText, useNowModel } from './Now.tsx';
import '../styles/fieldreport.css';

const BASE = import.meta.env.BASE_URL;
const AI_WAIT_MS = 45_000;

function subscribeHash(fn: () => void): () => void {
  window.addEventListener('hashchange', fn);
  return () => window.removeEventListener('hashchange', fn);
}
const readHash = () => window.location.hash;

// ------------------------------------------------------------------------------------------------ what this browser keeps

function loadNotes(key: string): OfficerNotes {
  let raw: string | null = null;
  try { raw = key ? window.localStorage.getItem(key) : null; } catch { /* storage is off: the blanks live on this page only */ }
  return parseNotes(raw);
}
const EMPTY_NOTES = JSON.stringify(emptyNotes());

/** What the officer typed into the blanks of one district today. Read when the district changes, written on every
 *  change, both wrapped: a browser without storage loses nothing but the memory across reloads. Sent nowhere. */
function useOfficerNotes(aoiId: string) {
  const [openedAt] = useState(() => Date.now());   // the day is the day the page was opened
  const key = aoiId ? notesKey(aoiId, openedAt) : '';
  const [store, setStore] = useState(() => ({ key, v: loadNotes(key) }));
  if (store.key !== key) setStore({ key, v: loadNotes(key) });   // another district: its own blanks
  useEffect(() => {
    if (!store.key) return;
    try {
      const json = JSON.stringify(store.v);
      if (json === EMPTY_NOTES) window.localStorage.removeItem(store.key); else window.localStorage.setItem(store.key, json);
    } catch { /* full or switched off */ }
  }, [store]);
  useEffect(() => {
    // a report is of one day: the blanks of earlier days are of no use
    try {
      const today = `:${localDay(Date.now())}`;
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith('ka_report:') && !k.endsWith(today)) window.localStorage.removeItem(k);
      }
    } catch { /* storage is off */ }
  }, []);
  const set = (doc: ReportDoc, field: string, value: string) => setStore((prev) => ({
    key: prev.key, v: { ...prev.v, [doc]: { ...prev.v[doc], [field]: value.slice(0, fieldMax(field)) } },
  }));
  return [store.v, set] as const;
}

/** Today's decisions of the command view for this district (lib/nowconsole.ts): read, never written. */
function readConsole(aoiId: string): ConsoleState {
  let raw: string | null = null;
  try { raw = aoiId ? window.localStorage.getItem(storageKey(aoiId, Date.now())) : null; } catch { /* storage is off */ }
  return parseConsoleState(raw, Date.now());
}

// ------------------------------------------------------------------------------------------------ parts of a paper

function SecHead({ n, title, id }: { n: number | null; title: string; id: string }) {
  return <h2 id={id} className="fr-h">{n != null ? <span className="fr-h-n">{n}.</span> : null}{title}</h2>;
}

/** A table with hairlines, inside its own scrolling box on a narrow screen. `extra` adds a screen-only last column. */
function PaperTableView({ table, label, extra }: { table: PaperTable; label: string; extra?: { head: string; cell: (row: number) => ReactNode } }) {
  return (
    <div className="fr-scroll" tabIndex={0} role="region" aria-label={label}>
      <table className="fr-table">
        <thead><tr>
          {table.head.map((h, c) => <th key={c} scope="col" className={table.numeric[c] ? 'num' : undefined}>{h}</th>)}
          {extra ? <th scope="col" className="fr-noprint">{extra.head}</th> : null}
        </tr></thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => <td key={c} className={table.numeric[c] ? 'num' : table.whole[c] ? 'whole' : undefined}>{cell}</td>)}
              {extra ? <td className="fr-noprint">{extra.cell(r)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A list of places: the table, or the sentence that says why there is none, then the notes under it. */
function Places({ block, label, extra, children }: { block: PlacesBlock; label: string; extra?: { head: string; cell: (row: number) => ReactNode }; children?: ReactNode }) {
  return (
    <>
      {block.missing ? <p className="fr-missing">{block.missing}</p> : null}
      {block.empty ? <p className="fr-empty">{block.empty}</p> : null}
      {block.table ? <PaperTableView table={block.table} label={label} extra={extra} /> : null}
      {block.more ? <p className="fr-note">{block.more}</p> : null}
      {children}
      {block.notes.map((x) => <p key={x} className="fr-note">{x}</p>)}
    </>
  );
}

function PeatSection({ block, id }: { block: PeatBlock; id: string }) {
  return (
    <section className="fr-sec fr-sec-peat" aria-labelledby={id}>
      <SecHead n={block.n} title={block.title} id={id} />
      <p>{block.lead}</p>
      {block.numbered ? <ol className="fr-list">{block.items.map((x) => <li key={x}>{x}</li>)}</ol>
        : <ul className="fr-list">{block.items.map((x) => <li key={x}>{x}</li>)}</ul>}
      {block.tail ? <p className="fr-note">{block.tail}</p> : null}
    </section>
  );
}

/** The blanks: an input on screen; on paper the typed text, or a ruled line to write on. */
function OfficerSection({ block, doc, typed, onChange, id }: { block: OfficerBlock; doc: ReportDoc; typed: Record<string, string>; onChange: (doc: ReportDoc, key: string, value: string) => void; id: string }) {
  return (
    <section className="fr-sec fr-officer" aria-labelledby={id}>
      <SecHead n={block.n} title={block.title} id={id} />
      <p className="fr-note">{block.note}</p>
      <div className="fr-fields">
        {block.fields.map((f) => {
          const fid = `fr-f-${doc}-${f.key}`;
          const long = f.key === 'notes';
          return (
            <div key={f.key} className={`fr-field${long ? ' is-long' : ''}`}>
              <label htmlFor={fid}>{f.label}</label>
              {long
                ? <textarea id={fid} rows={2} value={typed[f.key] ?? ''} maxLength={fieldMax(f.key)} onChange={(e) => onChange(doc, f.key, e.target.value)} />
                : <input id={fid} type="text" autoComplete="off" value={typed[f.key] ?? ''} maxLength={fieldMax(f.key)} onChange={(e) => onChange(doc, f.key, e.target.value)} />}
              <span className={`fr-fill${f.value ? '' : ' is-blank'}`} aria-hidden="true">{f.value}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------------------------------------ the sketch map

const MAP_W = 360, MAP_H = 280, MAP_PAD = 16;   // one frame of the sketch, in its own units (the SVG scales to the column)
interface XY { x: number; y: number }
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Where the numbers go: beside their dots, pushed apart until none sits on another number or on another dot. */
function placeLabels(dots: XY[], w: number, h: number): XY[] {
  const n = Math.max(1, dots.length);
  const cx = dots.reduce((s, d) => s + d.x, 0) / n, cy = dots.reduce((s, d) => s + d.y, 0) / n;
  const labels = dots.map((d, i) => {
    let ux = d.x - cx, uy = d.y - cy;
    const len = Math.hypot(ux, uy);
    if (len < 0.5) { const a = (i * 2 * Math.PI) / n - Math.PI / 2; ux = Math.cos(a); uy = Math.sin(a); } else { ux /= len; uy /= len; }
    return { x: d.x + ux * 13, y: d.y + uy * 13 };
  });
  const apart = (a: XY, b: XY, gap: number, both: boolean, turn: number): boolean => {
    let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d >= gap) return false;
    if (d < 0.01) { dx = Math.cos(turn); dy = Math.sin(turn); d = 1; }
    const push = (gap - d) / (both ? 2 : 1) + 0.2;
    b.x += (dx / d) * push; b.y += (dy / d) * push;
    if (both) { a.x -= (dx / d) * push; a.y -= (dy / d) * push; }
    return true;
  };
  for (let it = 0; it < 80; it++) {
    let moved = false;
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) moved = apart(labels[i]!, labels[j]!, 17, true, (i + 1) * 2.4) || moved;
      for (let j = 0; j < dots.length; j++) if (j !== i) moved = apart({ ...dots[j]! }, labels[i]!, 12, false, (i + 1) * 2.4) || moved;
    }
    for (const l of labels) { l.x = clamp(l.x, 9, w - 9); l.y = clamp(l.y, 9, h - 9); }
    if (!moved) break;
  }
  return labels;
}

/** One frame of the sketch: the district outline, the targets as numbered dots and the visiting order as a thin line.
 *  A flat grid with the cos(latitude) correction (lib/fieldreport.ts frameOf), no base map; north is up. */
function SketchFrame({ bounds, rings, visits, box, title, name, lang }: { bounds: Bounds; rings: number[][][]; visits: Visit[]; box?: Bounds | null; title: string; name: string; lang: Lang }) {
  const [bw, bs, be, bn] = bounds;
  const f = useMemo(() => frameOf([bw, bs, be, bn], MAP_W, MAP_H, MAP_PAD), [bw, bs, be, bn]);
  const land = useMemo(() => rings.map((ring) => {
    let d = '', lx = NaN, ly = NaN;
    for (const p of ring) {
      const x = f.x(p[0]!), y = f.y(p[1]!);
      if (d && Math.abs(x - lx) < 0.4 && Math.abs(y - ly) < 0.4) continue;   // a step too small to draw
      d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
      lx = x; ly = y;
    }
    return d ? `${d}Z` : '';
  }).join(''), [rings, f]);
  const dots = visits.map((v) => ({ x: f.x(v.site.lon), y: f.y(v.site.lat) }));
  const labels = placeLabels(dots, f.width, f.height);
  const km = scaleBarKm(f.kmPerPx, f.width * 0.3);
  const bar = km > 0 ? km / f.kmPerPx : 0;
  const clip = `fr-clip-${name}`;
  const kmText = `${new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-GB').format(km)} km`;
  return (
    <figure className="fr-map">
      <svg viewBox={`0 0 ${f.width} ${f.height}`} role="img" aria-label={title} preserveAspectRatio="xMidYMid meet">
        <defs><clipPath id={clip}><rect x="0" y="0" width={f.width} height={f.height} /></clipPath></defs>
        <g clipPath={`url(#${clip})`}>
          {land ? <path className="fr-map-land" d={land} fillRule="evenodd" /> : null}
          {box ? <rect className="fr-map-box" x={f.x(box[0])} y={f.y(box[3])} width={Math.max(4, f.x(box[2]) - f.x(box[0]))} height={Math.max(4, f.y(box[1]) - f.y(box[3]))} /> : null}
          {dots.length > 1 ? <polyline className="fr-map-route" points={dots.map((d) => `${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(' ')} /> : null}
        </g>
        {dots.map((d, i) => <line key={`l${i}`} className="fr-map-lead" x1={d.x} y1={d.y} x2={labels[i]!.x} y2={labels[i]!.y} />)}
        {dots.map((d, i) => <circle key={`d${i}`} className="fr-map-dot" cx={d.x} cy={d.y} r="3.2" />)}
        {labels.map((l, i) => (
          <g key={`n${i}`}>
            <circle className="fr-map-num" cx={l.x} cy={l.y} r="7.6" />
            <text className="fr-map-numtext" x={l.x} y={l.y + 3.4} textAnchor="middle">{i + 1}</text>
          </g>
        ))}
        {/* the frame, drawn over the land so that its line is whole all the way round */}
        <rect className="fr-map-sea" x="0.5" y="0.5" width={f.width - 1} height={f.height - 1} />
        {/* north is up: a small arrow, with U (utara) or N */}
        <g className="fr-map-north" transform={`translate(${f.width - 18} 12)`}>
          <path d="M0 22V4M-4 9l4-6 4 6" />
          <text x="0" y="34" textAnchor="middle">{lang === 'id' ? 'U' : 'N'}</text>
        </g>
        {bar > 0 ? (
          <g className="fr-map-scale" transform={`translate(12 ${f.height - 12})`}>
            <path d={`M0 -4V0H${bar.toFixed(1)}V-4`} />
            <text x={bar / 2} y="-5" textAnchor="middle">{kmText}</text>
          </g>
        ) : null}
      </svg>
      <figcaption>{title}</figcaption>
    </figure>
  );
}

/** The sketch: the whole district, and beside it the targets drawn larger when they sit too close together to read. */
function Sketch({ outline, visits, lang, tr }: { outline: { type: string; coordinates: unknown } | null; visits: Visit[]; lang: Lang; tr: Tr }) {
  const rings = useMemo(() => ringsOf(outline), [outline]);
  const district = useMemo(() => boundsOf(rings.flat()), [rings]);
  const tb = boundsOf(visits.map((v) => [v.site.lon, v.site.lat]));
  if (!tb) return null;
  const whole: Bounds = district
    ? growBounds([Math.min(district[0], tb[0]), Math.min(district[1], tb[1]), Math.max(district[2], tb[2]), Math.max(district[3], tb[3])], 0, 0.02)
    : growBounds(tb, 20, 0.2);
  const f = frameOf(whole, MAP_W, MAP_H, MAP_PAD);
  const dots = visits.map((v) => ({ x: f.x(v.site.lon), y: f.y(v.site.lat) }));
  let nearest = Infinity;
  dots.forEach((a, i) => dots.forEach((b, j) => { if (j > i) nearest = Math.min(nearest, Math.hypot(a.x - b.x, a.y - b.y)); }));
  // a second frame only where it helps: the numbers would sit on each other, and the targets fill so little of the
  // district that drawing them alone makes them at least twice as large
  const near = growBounds(tb, 3, 0.25);
  const close = district && visits.length > 1 && nearest < 22 && f.kmPerPx / frameOf(near, MAP_W, MAP_H, MAP_PAD).kmPerPx >= 2 ? near : null;
  return (
    <div className={`fr-maps${close ? ' is-two' : ''}`}>
      <SketchFrame bounds={whole} rings={rings} visits={visits} box={close} name="whole" lang={lang}
        title={district ? tr('The district', 'Kabupaten') : tr('The targets (the district outline did not load)', 'Sasaran (batas kabupaten tidak termuat)')} />
      {close ? <SketchFrame bounds={close} rings={rings} visits={visits} name="close" lang={lang} title={tr('The targets, drawn larger (the dashed box)', 'Sasaran, diperbesar (kotak putus-putus)')} /> : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ the page

type AiStatus = 'idle' | 'working' | 'failed' | 'busy' | 'off' | 'unavailable';

export function FieldReport() {
  const hash = useSyncExternalStore(subscribeHash, readHash);
  const doc: ReportDoc = reportDocOf(hash) ?? 'daily';
  const m = useNowModel({ hrefFor: (id) => reportHref(id, doc) });
  const { tr, lang, aoi, aoiId, name, place, districts, unknownAsked, asked, liveState, liveData, nowMs, counts, burn, result, sites, peat, q, setQ, groups, go, setTick } = m;
  const loading = liveState.state === 'loading';

  // ---- what this browser keeps: the officer's blanks (ours), and the command view's decisions (read only)
  const [notes, setNote] = useOfficerNotes(aoiId);
  const [stamp, setStamp] = useState(0);
  useEffect(() => {
    const again = () => setStamp((s) => s + 1);   // another tab changed the queue, or the reader came back to this one
    window.addEventListener('storage', again);
    window.addEventListener('focus', again);
    return () => { window.removeEventListener('storage', again); window.removeEventListener('focus', again); };
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stored = useMemo(() => readConsole(aoiId), [aoiId, stamp, nowMs]);

  // ---- the optional AI paragraph: kept on this page only, and dropped when the hotspots are read again (it was
  // written from the numbers of that reading)
  const sumKey = `${aoiId}:${doc}:${nowMs}`;
  const [sums, setSums] = useState<Record<string, ReportSummary>>({});
  const [aiBy, setAiBy] = useState<Record<string, AiStatus>>({});
  const [aiShut, setAiShut] = useState<'off' | 'unavailable' | null>(null);
  const summary = sums[sumKey] ?? null;
  const ai: AiStatus = aiShut ?? aiBy[sumKey] ?? 'idle';
  const writeSummary = async () => {
    if (!m.askFacts || ai === 'working') return;
    const key = sumKey;
    setAiBy((p) => ({ ...p, [key]: 'working' }));
    const ctl = new AbortController();
    const timer = window.setTimeout(() => ctl.abort(), AI_WAIT_MS);
    let next: AiStatus = 'failed';   // no reply at all (network, or the time limit): the button stays, to try again
    try {
      const r = await fetch(`${BASE}api/ask`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
        // the function writes the instruction itself: nothing typed on this page goes with the numbers
        body: JSON.stringify({ lang, task: doc === 'daily' ? 'daily_summary' : 'plan_summary', facts: askFactsFor(doc, m.askFacts, burn) }),
      });
      if (r.status === 429) next = 'busy';
      else if (!(r.headers.get('content-type') ?? '').includes('json')) next = 'unavailable';
      else {
        const body = await r.json() as { ok?: boolean; text?: unknown; model?: unknown; generated_at?: unknown; error?: unknown };
        if (r.status === 503 && body.error === 'not_configured') next = 'off';
        else if (r.ok && body.ok === true && typeof body.text === 'string' && body.text.trim()) {
          const at = typeof body.generated_at === 'string' ? Date.parse(body.generated_at) : NaN;
          const text = body.text.trim();
          setSums((p) => ({ ...p, [key]: { text, model: typeof body.model === 'string' ? body.model : null, atMs: Number.isNaN(at) ? Date.now() : at } }));
          next = 'idle';
        } else if (r.ok && body.ok === false) next = 'failed';
        else next = 'unavailable';
      }
    } catch { /* next stays 'failed' */ } finally {
      window.clearTimeout(timer);
    }
    if (next === 'off' || next === 'unavailable') setAiShut(next);
    setAiBy((p) => ({ ...p, [key]: next }));
  };

  // ---- the one input both the paper and its text are made from
  const inside = useMemo(() => (m.marked ? m.marked.filter((x) => x.inside).map((x) => x.p) : null), [m.marked]);
  const week = useMemo(() => (inside ? sevenDays(inside, nowMs) : null), [inside, nowMs]);
  const rows = queueRows({
    liveFailed: liveState.state === 'unavailable',
    newestId: counts?.newest ? hotspotId(counts.newest) : null,
    againId: againSites(burn ?? [])[0]?.id ?? null,
    peatId: sites[0] ? peatSiteId(sites[0]) : null,
    level: result.level,
  }, stored);
  const input: ReportInput = {
    aoiId, place, province: aoi?.province ?? '', site: `${window.location.origin}${window.location.pathname}`,
    nowMs, live: liveState.state, failed: (liveData?.failed ?? []).map((s) => (isSensor(s) ? SENSOR_LABEL[s] : s)),
    counts, level: result.level, levelWhy: m.whyText[result.why],
    month: m.mf ? { ...m.mf, nrt: !!m.monthRow?.flag_nrt } : null,
    week, burn,
    peat: peat && sites.length ? { season: peat.season, provisional: peat.provisional, total: peat.persistentSites, sites } : null,
    decisions: decisionsOf(stored, rows), officer: notes, summary: { [doc]: summary },
  };
  const paper: DailyPaper | PlanPaper = doc === 'daily' ? dailyPaper(input, lang) : planPaper(input, lang);
  const text = paperText(paper);

  // the title names the paper, the district and the day, so a saved PDF gets a useful file name; it is set on every
  // render because the Today page's own title effect (in useNowModel, which runs first) is too
  const docName = doc === 'daily' ? tr('Daily report', 'Laporan harian') : tr('Field check plan', 'Rencana cek lapangan');
  useEffect(() => {
    document.title = aoi ? `${docName}: ${place}, ${dayWib(nowMs, lang, 'short')} · KalenderApi` : `${docName} · KalenderApi`;
  });

  const [copied, setCopied] = useState<{ key: string; ok: boolean } | null>(null);
  const copyNote = copied && copied.key === `${aoiId}:${doc}` ? copied.ok : null;
  const tabs: { doc: ReportDoc; label: string }[] = [
    { doc: 'daily', label: tr('Daily report', 'Laporan harian') },
    { doc: 'plan', label: tr('Field check plan', 'Rencana cek lapangan') },
  ];
  const head = paper.head;

  return (
    <div className="fr-page">
      {/* the same top bar as the Today page (components/SiteHeader.tsx) */}
      <SiteHeader current="now" />

      {/* ---- the tools: which paper, print, copy, WhatsApp, read again, the way back, another district (never printed) */}
      <div className="fr-tools">
        <nav className="fr-tabs" aria-label={tr('The two papers', 'Dua lembar')}>
          {tabs.map((t) => <a key={t.doc} href={aoiId ? reportHref(aoiId, t.doc) : `#/report?doc=${t.doc}`} aria-current={t.doc === doc ? 'page' : undefined}>{t.label}</a>)}
        </nav>
        <div className="fr-actions">
          <button type="button" className="fr-btn fr-btn-accent" onClick={() => window.print()} disabled={!aoi}>{tr('Print or save as PDF', 'Cetak atau simpan PDF')}</button>
          <button type="button" className="fr-btn" disabled={!aoi} onClick={() => { void copyText(text).then((ok) => setCopied({ key: `${aoiId}:${doc}`, ok })); }}>{tr('Copy as text', 'Salin sebagai teks')}</button>
          {aoi ? <a className="fr-btn" href={waLink(text)} target="_blank" rel="noopener noreferrer">{tr('Open in WhatsApp', 'Buka di WhatsApp')}</a> : null}
          <button type="button" className="fr-btn" onClick={() => setTick((t) => t + 1)} disabled={loading || !aoi}>{loading ? tr('Reading…', 'Membaca…') : tr('Read again', 'Baca ulang')}</button>
          {aoiId ? <a className="fr-link" href={consoleHref(aoiId)}>{tr('Command view', 'Tampilan komando')}</a> : null}
        </div>
        <div className="fr-find" role="search" aria-label={tr('Pick the district', 'Pilih kabupaten')}>
          <label htmlFor="fr-q">{tr('Change district', 'Ganti kabupaten')}</label>
          <input id="fr-q" type="search" value={q} onChange={(ev) => setQ(ev.target.value)} autoComplete="off"
            placeholder={tr('Search a district, for example Kapuas', 'Cari kabupaten, misalnya Kapuas')} />
          {q.trim().length >= 2 ? (
            groups.length ? (
              <ul className="fr-results" aria-label={tr('Matching districts', 'Kabupaten yang cocok')}>
                {groups.flatMap((g) => g.items.map((d) => (
                  <li key={d.aoi_id}><button type="button" onClick={() => go(d.aoi_id)}>{aoiName(d, lang)} <small>{g.province}</small></button></li>
                )))}
              </ul>
            ) : <p className="fr-small" role="status">{tr('No district matches.', 'Tidak ada kabupaten yang cocok.')}</p>
          ) : null}
        </div>
        <p className="fr-small fr-tools-note" role="status">
          {copyNote === true ? tr('Copied.', 'Tersalin.') : copyNote === false ? tr('Could not copy: open "The text version" under the paper and select it.', 'Tidak dapat menyalin: buka "Versi teks" di bawah lembar lalu pilih teksnya.') : ''}
        </p>
      </div>

      <main className="fr-main" id="fr-main">
        {districts.state === 'error' || districts.state === 'missing' ? (
          <p className="fr-alert" role="alert">{tr('The district list could not be loaded, so this page cannot show a district.', 'Daftar kabupaten tidak dapat dimuat, sehingga halaman ini tidak dapat menampilkan kabupaten.')}</p>
        ) : null}
        {unknownAsked ? <p className="fr-small" role="note">{tr(`No district "${asked}" in the record; showing ${name}.`, `Tidak ada kabupaten "${asked}" dalam catatan; menampilkan ${name}.`)}</p> : null}
        {!aoi && districts.state === 'loading' ? <p className="fr-small" role="status">{tr('Loading the districts…', 'Memuat daftar kabupaten…')}</p> : null}

        {aoi ? (
          <article className="fr-paper" aria-labelledby="fr-title" lang={lang} key={`${aoiId}:${doc}`}>
            <header className="fr-head">
              <p className="fr-org">{head.org}</p>
              <h1 id="fr-title" className="fr-title">{head.title}</h1>
              <p className="fr-place">{head.place}</p>
              <p className="fr-meta">{head.date}<span aria-hidden="true"> · </span>{head.read}</p>
              <p className="fr-meta">{head.source}</p>
              <p className="fr-draft">{head.draft}</p>
            </header>
            <div role="status">{paper.notices.map((x) => <p key={x} className="fr-notice">{x}</p>)}</div>

            {/* ---- the optional AI paragraph: offered on screen, on paper only once it is there */}
            {summary ? (
              <section className="fr-sec fr-sum" aria-labelledby="fr-h-sum">
                <SecHead n={null} title={tr('Summary (AI draft)', 'Ringkasan (draf AI)')} id="fr-h-sum" />
                <label className="fr-sr" htmlFor="fr-sum-text">{tr('The AI draft: edit it before printing', 'Draf AI: sunting sebelum dicetak')}</label>
                <textarea id="fr-sum-text" rows={5} value={summary.text} maxLength={1600}
                  onChange={(e) => { const v = e.target.value; setSums((p) => ({ ...p, [sumKey]: { ...summary, text: v } })); }} />
                <p className="fr-fill fr-sum-fill" aria-hidden="true">{summary.text}</p>
                <p className="fr-note">{paper.summary?.by ?? tr('The paragraph is empty, so it is left out of the print and of the text.', 'Paragraf kosong, sehingga tidak ikut dicetak dan tidak masuk ke teks.')}</p>
                <p className="fr-noprint fr-sum-tools">
                  <button type="button" className="fr-btn" onClick={() => setSums((p) => { const next = { ...p }; delete next[sumKey]; return next; })}>{tr('Remove the summary', 'Hapus ringkasan')}</button>
                  <span className="fr-small">{tr('You can edit the paragraph above; it is printed and copied as you leave it.', 'Paragraf di atas dapat disunting; yang dicetak dan disalin adalah teks terakhir.')}</span>
                </p>
              </section>
            ) : (
              <div className="fr-ai fr-noprint">
                {m.askFacts && ai !== 'off' && ai !== 'unavailable' ? (
                  <>
                    <button type="button" className="fr-btn" onClick={() => { void writeSummary(); }} disabled={ai === 'working'} aria-busy={ai === 'working'}>
                      {ai === 'working' ? tr('Writing… (up to 20 seconds)', 'Menulis… (hingga 20 detik)') : tr('Write the summary with AI', 'Tulis ringkasan dengan AI')}
                    </button>
                    <span className="fr-small">
                      {tr('Optional. Sends the numbers of this paper (district, counts, level, coordinates of the listed places; nothing you typed in the blanks) to an AI model through this site, only when you press the button.',
                        'Opsional. Mengirim angka di lembar ini (kabupaten, jumlah, tingkat, koordinat lokasi yang terdaftar; tidak termasuk isian Anda) ke sebuah model AI melalui situs ini, hanya saat Anda menekan tombol.')}
                    </span>
                  </>
                ) : null}
                <span className="fr-small" role="status">
                  {ai === 'failed' ? tr('The AI could not write the summary. You can try again; the paper is complete without it.', 'AI tidak dapat menulis ringkasan. Anda dapat mencoba lagi; lembar ini lengkap tanpa ringkasan.')
                    : ai === 'busy' ? tr('The AI is busy; try again in a minute. The paper is complete without it.', 'AI sedang sibuk; coba lagi sebentar lagi. Lembar ini lengkap tanpa ringkasan.')
                      : ai === 'off' ? tr('The AI summary is switched off on this site. The paper is complete without it.', 'Ringkasan AI sedang dimatikan di situs ini. Lembar ini lengkap tanpa ringkasan.')
                        : ai === 'unavailable' ? tr('The AI summary is not available on this copy of the site. The paper is complete without it.', 'Ringkasan AI tidak tersedia di salinan situs ini. Lembar ini lengkap tanpa ringkasan.') : ''}
                </span>
              </div>
            )}

            {paper.doc === 'daily' ? (
              <>
                <section className="fr-sec" aria-labelledby="fr-h-sit">
                  <SecHead n={paper.situation.n} title={paper.situation.title} id="fr-h-sit" />
                  <table className="fr-facts">
                    <tbody>
                      {paper.situation.facts.map((f) => (
                        <tr key={f.label}><th scope="row">{f.label}</th><td>{f.lead ? <b>{f.lead}</b> : null}{f.lead ? ' ' : ''}{f.value}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="fr-note">{paper.situation.note}</p>
                </section>

                <section className="fr-sec" aria-labelledby="fr-h-week">
                  <SecHead n={paper.week.n} title={paper.week.title} id="fr-h-week" />
                  {paper.week.cells ? (
                    <ol className="fr-week">
                      {paper.week.cells.map((c, i, all) => (
                        <li key={c.label} className={c.total ? 'has' : undefined}>
                          <span className="fr-week-day">{c.label}</span>
                          <span className="fr-week-n">{c.n}</span>
                          <span className="fr-week-bar" aria-hidden="true"><i style={{ width: `${(c.total / Math.max(1, ...all.map((x) => x.total))) * 100}%` }} /></span>
                          <span className="fr-sr">{i === all.length - 1 ? tr('(the last 24 hours)', '(24 jam terakhir)') : ''}</span>
                        </li>
                      ))}
                    </ol>
                  ) : <p className="fr-missing">{paper.week.missing}</p>}
                  <p className="fr-note">{paper.week.note}</p>
                </section>

                <section className="fr-sec" aria-labelledby="fr-h-again">
                  <SecHead n={paper.again.n} title={paper.again.title} id="fr-h-again" />
                  <Places block={paper.again} label={paper.again.title} />
                </section>

                {paper.peat ? <PeatSection block={paper.peat} id="fr-h-peat" /> : null}

                <section className="fr-sec" aria-labelledby="fr-h-dec">
                  <SecHead n={paper.decisions.n} title={paper.decisions.title} id="fr-h-dec" />
                  {paper.decisions.empty ? <p className="fr-empty">{paper.decisions.empty}</p>
                    : <ul className="fr-list">{paper.decisions.items.map((x) => <li key={x}>{x}</li>)}</ul>}
                  {paper.decisions.note ? <p className="fr-note">{paper.decisions.note}</p> : null}
                </section>
              </>
            ) : (
              <>
                <section className="fr-sec" aria-labelledby="fr-h-targets">
                  <SecHead n={paper.targets.n} title={paper.targets.title} id="fr-h-targets" />
                  <Places block={paper.targets} label={paper.targets.title}
                    extra={{
                      head: tr('Map', 'Peta'),
                      cell: (r) => {
                        const s = paper.targets.sites[r]!;
                        return <a href={mapsHref(s.lat, s.lon)} target="_blank" rel="noopener noreferrer" aria-label={tr(`Target ${r + 1} in Google Maps`, `Sasaran ${r + 1} di Google Maps`)}>Maps</a>;
                      },
                    }}>
                    {paper.targets.table ? <p className="fr-rule">{paper.targets.rule}</p> : null}
                  </Places>
                </section>

                {/* the sketch on the left, the peat sites and the crew's grid on the right, where the paper is wide enough
                    and the sketch is one frame (styles/fieldreport.css); in this order when stacked */}
                <div className="fr-pair">
                {paper.sketch ? (
                  <section className="fr-sec fr-sec-map" aria-labelledby="fr-h-map">
                    <SecHead n={paper.sketch.n} title={paper.sketch.title} id="fr-h-map" />
                    <Sketch outline={m.outline} visits={paper.targets.visits} lang={lang} tr={tr} />
                    <p className="fr-note">{paper.sketch.caption}</p>
                  </section>
                ) : null}

                <div className="fr-pair-side">
                {paper.peat ? <PeatSection block={paper.peat} id="fr-h-peat" /> : null}

                {paper.crew ? (
                  <section className="fr-sec fr-sec-crew" aria-labelledby="fr-h-crew">
                    <SecHead n={paper.crew.n} title={paper.crew.title} id="fr-h-crew" />
                    <div className="fr-scroll" tabIndex={0} role="region" aria-label={paper.crew.title}>
                      <table className="fr-table fr-grid">
                        <thead><tr>{paper.crew.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
                        <tbody>
                          {paper.crew.rows.map((r) => (
                            <tr key={r}>
                              <td className="num">{r}</td><td className="fr-yn">{paper.crew!.yesNo}</td><td className="fr-yn">{paper.crew!.yesNo}</td><td className="fr-yn">{paper.crew!.yesNo}</td><td />
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ) : null}
                </div>
                </div>
              </>
            )}

            <OfficerSection block={paper.officer} doc={doc} typed={notes[doc]} onChange={setNote} id="fr-h-off" />

            <footer className="fr-foot">
              {paper.closing.map((x) => <p key={x}>{x}</p>)}
              <p className="fr-url">{paper.address}</p>
            </footer>
          </article>
        ) : null}

        {aoi ? (
          <details className="fr-text fr-noprint">
            <summary>{tr('The text version (what "Copy as text" and "Open in WhatsApp" use)', 'Versi teks (yang dipakai "Salin sebagai teks" dan "Buka di WhatsApp")')}</summary>
            <pre tabIndex={0} lang={lang}>{text}</pre>
          </details>
        ) : null}
      </main>
    </div>
  );
}

export default FieldReport;
