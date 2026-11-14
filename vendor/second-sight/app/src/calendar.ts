// Custom SVG calendar: years (rows) x months (columns), number in every cell, yearly total + rank,
// median row, sensor-era line between 2011 and 2012, satellite arrival dots, drift-era label.
// Five cell states never share a look: activity / zero / partial (thin hatch) /
// unobserved (heavy hatch, no ramp) / provisional (dashed border). Anomaly >= p90 = ring.
// Keyboard: role=grid with roving tabindex; arrows, PageUp/PageDown (5 years), Home/End, Enter.
import type { MonthRow } from './data';
import { countColor, ratioClass, ratioColor, textOn } from './scale';
import { t, fmtInt, fmtDec1, fmtPct, getLang } from './i18n';
import './styles/kalender.css';

export type Mode = 'count' | 'ratio';
export type Series = 'raw' | 'sensor' | 'harm';

export interface CalendarOptions {
  mode: Mode;
  series: Series;
  selected: string; // YYYY-MM
  aoiName: string;
  onSelect: (ym: string) => void;
}

const NS = 'http://www.w3.org/2000/svg';
const Y0 = 2001;
const Y1 = 2026;
const ERA_SPLIT = 2012;
const ARRIVALS = new Set([2002, 2012, 2018, 2023]);
const DRIFT_FROM = 2022;

const LABEL_W = 96;
const CW = 46;
const CH = 24;
const GAP = 2;
const HEAD_H = 24;
const ERA_GAP = 26;
const TOTAL_W = 70;
const RANK_W = 70;
const MED_GAP = 10;

const W = LABEL_W + 12 * (CW + GAP) + 8 + TOTAL_W + RANK_W;
const rowY = (year: number) => HEAD_H + (year - Y0) * (CH + GAP) + (year >= ERA_SPLIT ? ERA_GAP : 0);
const colX = (month: number) => LABEL_W + (month - 1) * (CW + GAP);
const MEDIAN_Y = rowY(Y1) + CH + GAP + MED_GAP;
const H = MEDIAN_Y + CH + 6;

function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, text?: string): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  if (text != null) n.textContent = text;
  return n;
}

const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;

interface CellRefs {
  row: MonthRow | undefined;
  g: SVGGElement;
  fill: SVGRectElement;
  label: SVGTextElement;
  sel: SVGRectElement;
}

export interface CalendarHandle {
  root: HTMLElement;
  update(opts: CalendarOptions): void;
}

function displayValue(r: MonthRow, series: Series): number | null {
  if (series === 'harm') return r.H;
  return r.sensor_used === 'VIIRS' ? r.V_raw : r.A_raw;
}

const median = (xs: number[]): number => {
  const v = [...xs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

export function createCalendar(rows: MonthRow[], initial: CalendarOptions): CalendarHandle {
  const d = t();
  const byKey = new Map(rows.map((r) => [ym(r.year, r.month), r]));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const root = document.createElement('div');
  root.className = 'cal-wrap';
  const scroller = document.createElement('div');
  scroller.className = 'cal-scroll';
  const tip = document.createElement('div');
  tip.className = 'cal-tip';
  tip.setAttribute('role', 'tooltip');
  tip.id = 'cal-tip';
  tip.hidden = true;

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'cal', role: 'grid', 'aria-label': d.calendarAria, 'aria-describedby': 'cal-tip' });
  const defs = s('defs');
  const pPartial = s('pattern', { id: 'hatch-partial', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
  pPartial.append(s('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: '#1B1F24', 'stroke-width': 1, 'stroke-opacity': 0.45 }));
  const pUnobs = s('pattern', { id: 'hatch-unobs', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
  pUnobs.append(s('rect', { width: 6, height: 6, fill: '#F6F7F8' }), s('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: '#9AA4AF', 'stroke-width': 3 }));
  defs.append(pPartial, pUnobs);
  svg.append(defs);

  // Header row
  const head = s('g', { role: 'row' });
  head.append(s('text', { x: LABEL_W - 8, y: HEAD_H - 8, class: 'cal-head', 'text-anchor': 'end', role: 'columnheader' }, ''));
  for (let m = 1; m <= 12; m++) head.append(s('text', { x: colX(m) + CW / 2, y: HEAD_H - 8, class: 'cal-head', 'text-anchor': 'middle', role: 'columnheader' }, d.months[m - 1]));
  const xTot = LABEL_W + 12 * (CW + GAP) + 8;
  head.append(s('text', { x: xTot + TOTAL_W - 8, y: HEAD_H - 8, class: 'cal-head', 'text-anchor': 'end', role: 'columnheader' }, d.total));
  head.append(s('text', { x: xTot + TOTAL_W + RANK_W - 8, y: HEAD_H - 8, class: 'cal-head', 'text-anchor': 'end', role: 'columnheader' }, d.rank));
  svg.append(head);

  // Drift-era label: thin bracket on the far left for 2022+
  const dy0 = rowY(DRIFT_FROM);
  const dy1 = rowY(Y1) + CH;
  svg.append(s('line', { x1: 6, y1: dy0, x2: 6, y2: dy1, class: 'cal-drift' }));
  svg.append(s('text', { x: 12, y: (dy0 + dy1) / 2 + 4, class: 'cal-note' }, d.eraDrift));

  // Sensor era line + pill
  const eraY = rowY(ERA_SPLIT) - ERA_GAP / 2 - GAP / 2;
  svg.append(s('line', { x1: LABEL_W - 40, y1: eraY, x2: xTot + TOTAL_W + RANK_W, y2: eraY, class: 'cal-era' }));
  const pillText = s('text', { x: LABEL_W + 6 * (CW + GAP), y: eraY + 4, class: 'cal-pill-text', 'text-anchor': 'middle' }, d.eraPill);
  const pillW = Math.min(12 * (CW + GAP) - 20, d.eraPill.length * 6.6 + 24);
  svg.append(s('rect', { x: LABEL_W + 6 * (CW + GAP) - pillW / 2, y: eraY - 9, width: pillW, height: 18, rx: 9, class: 'cal-pill' }), pillText);

  const cells: CellRefs[] = [];
  const totals: SVGTextElement[] = [];
  const ranks: SVGTextElement[] = [];
  const medianTexts: SVGTextElement[] = [];

  for (let y = Y0; y <= Y1; y++) {
    const row = s('g', { role: 'row' });
    const yy = rowY(y);
    const yl = s('text', { x: LABEL_W - 10, y: yy + CH / 2 + 5, class: 'cal-year', 'text-anchor': 'end', role: 'rowheader' }, String(y));
    row.append(yl);
    if (ARRIVALS.has(y)) row.append(s('circle', { cx: LABEL_W - 48, cy: yy + CH / 2, r: 3, class: 'cal-dot' }));
    for (let m = 1; m <= 12; m++) {
      const r = byKey.get(ym(y, m));
      const g = s('g', { role: 'gridcell', tabindex: -1, 'data-ym': ym(y, m), class: 'cal-cell' });
      const x = colX(m);
      const fill = s('rect', { x, y: yy, width: CW, height: CH, rx: 2, class: 'cal-fill' });
      if (!reduceMotion) fill.style.transition = 'fill 1s ease';
      g.append(fill);
      if (r?.obs_class === 'partial') g.append(s('rect', { x, y: yy, width: CW, height: CH, rx: 2, fill: 'url(#hatch-partial)', 'pointer-events': 'none' }));
      if (r?.obs_class === 'unobserved') g.append(s('rect', { x, y: yy, width: CW, height: CH, rx: 2, fill: 'url(#hatch-unobs)', 'pointer-events': 'none' }));
      if (r?.flag_nrt || (r && y === Y1)) g.append(s('rect', { x: x + 1, y: yy + 1, width: CW - 2, height: CH - 2, rx: 2, class: 'cal-nrt' }));
      if (r && r.pct_rank != null && r.pct_rank >= 0.9 && r.obs_class !== 'unobserved') {
        g.append(s('rect', { x: x - 1.5, y: yy - 1.5, width: CW + 3, height: CH + 3, rx: 3, class: 'cal-ring' }));
      }
      // Triangulation badge: only for B/C so the grid stays calm (A is the default).
      if (r && r.agreement !== 'A' && r.obs_class !== 'unobserved') {
        g.append(s('circle', { cx: x + CW - 4, cy: yy + 4, r: 2.6, class: r.agreement === 'C' ? 'cal-agree-c' : 'cal-agree-b' }));
      }
      const label = s('text', { x: x + CW / 2, y: yy + CH / 2 + 5, 'text-anchor': 'middle', class: 'cal-num' });
      const sel = s('rect', { x: x - 2.5, y: yy - 2.5, width: CW + 5, height: CH + 5, rx: 4, class: 'cal-sel' });
      g.append(label, sel);
      row.append(g);
      cells.push({ row: r, g, fill, label, sel });
    }
    const tt = s('text', { x: xTot + TOTAL_W - 8, y: yy + CH / 2 + 5, 'text-anchor': 'end', class: 'cal-total' });
    const rk = s('text', { x: xTot + TOTAL_W + RANK_W - 8, y: yy + CH / 2 + 5, 'text-anchor': 'end', class: 'cal-total' });
    totals.push(tt);
    ranks.push(rk);
    row.append(tt, rk);
    svg.append(row);
  }

  // Median row
  const medRow = s('g', { role: 'row' });
  medRow.append(s('line', { x1: LABEL_W, y1: MEDIAN_Y - MED_GAP / 2, x2: xTot + TOTAL_W + RANK_W, y2: MEDIAN_Y - MED_GAP / 2, class: 'cal-rule' }));
  medRow.append(s('text', { x: LABEL_W - 10, y: MEDIAN_Y + CH / 2 + 5, class: 'cal-year', 'text-anchor': 'end', role: 'rowheader' }, d.median));
  for (let m = 1; m <= 12; m++) {
    const tx = s('text', { x: colX(m) + CW / 2, y: MEDIAN_Y + CH / 2 + 5, 'text-anchor': 'middle', class: 'cal-median', role: 'gridcell' });
    medianTexts.push(tx);
    medRow.append(tx);
  }
  svg.append(medRow);

  scroller.append(svg);
  const observed = rows.filter((r) => r.obs_class !== 'unobserved').length;
  const cov = document.createElement('p');
  cov.className = 'cal-coverage';
  cov.textContent = getLang() === 'id'
    ? `${fmtInt(observed)} dari ${fmtInt(rows.length)} sel-bulan teramati. Bulan ${Y1} bersifat sementara (data NRT, garis putus).`
    : `${fmtInt(observed)} of ${fmtInt(rows.length)} cell-months observed. ${Y1} months are provisional (NRT data, dashed).`;
  root.append(scroller, tip, cov);

  let opts = initial;

  function describe(c: CellRefs): string {
    const [y, m] = c.g.dataset.ym!.split('-').map(Number);
    const when = `${d.monthsLong[m - 1]} ${y}`;
    const r = c.row;
    if (!r) return `${when}: ${d.stateFuture}`;
    const parts = [when];
    const v = displayValue(r, opts.series);
    if (r.obs_class === 'unobserved' || v == null) parts.push(d.stateUnobserved);
    else {
      parts.push(`${fmtInt(v)} ${d.unitShort}`);
      if (r.baseline_median) parts.push(d.ratioMedian(fmtDec1(v / r.baseline_median)));
      if (r.obs_class === 'partial') parts.push(d.statePartial);
    }
    if (r.flag_nrt || r.year === Y1) parts.push(d.stateProvisional);
    if (r.pct_rank != null && r.pct_rank >= 0.9) parts.push(d.stateAnomaly);
    return parts.join(', ');
  }

  function showTip(c: CellRefs): void {
    const r = c.row;
    const [y, m] = c.g.dataset.ym!.split('-').map(Number);
    const lines: string[] = [`<strong>${d.monthsLong[m - 1]} ${y} · ${opts.aoiName}</strong>`];
    if (!r) lines.push(d.stateFuture);
    else if (r.obs_class === 'unobserved' || r.H == null) lines.push(d.stateUnobserved);
    else {
      lines.push(`${fmtInt(r.H)} ${d.unitShort} · ${d.likely(fmtInt(r.H_lo ?? r.H), fmtInt(r.H_hi ?? r.H))}`);
      const sameMonth = rows.filter((q) => q.month === m && q.H != null).sort((a, b) => b.H! - a.H!);
      const rank = sameMonth.findIndex((q) => q.year === y) + 1;
      const ratio = r.baseline_median ? `${d.ratioMedian(fmtDec1(r.H / r.baseline_median))} · ` : '';
      lines.push(`${ratio}${d.rankOf(fmtInt(rank), fmtInt(sameMonth.length))}`);
    }
    if (r) {
      lines.push(`${d.source(d.sensorNames[r.sensor_used])} · ${d.obs[r.obs_class]}${r.flag_nrt || r.year === Y1 ? ` · ${d.stateProvisional}` : ''}`);
      lines.push(d.agreement[r.agreement]);
    }
    tip.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
    tip.hidden = false;
    const box = c.fill.getBoundingClientRect();
    const host = root.getBoundingClientRect();
    const left = Math.min(Math.max(0, box.left - host.left - 120), host.width - 300);
    tip.style.left = `${Math.max(0, left)}px`;
    tip.style.top = `${box.bottom - host.top + 6}px`;
  }

  function hideTip(): void {
    tip.hidden = true;
  }

  function focusIndex(i: number): void {
    const c = cells[i];
    cells.forEach((x) => x.g.setAttribute('tabindex', '-1'));
    c.g.setAttribute('tabindex', '0');
    c.g.focus();
  }

  cells.forEach((c, i) => {
    c.g.addEventListener('mouseenter', () => showTip(c));
    c.g.addEventListener('mouseleave', () => {
      if (document.activeElement !== c.g) hideTip();
    });
    c.g.addEventListener('focus', () => showTip(c));
    c.g.addEventListener('blur', hideTip);
    c.g.addEventListener('click', () => {
      focusIndex(i);
      opts.onSelect(c.g.dataset.ym!);
    });
    c.g.addEventListener('keydown', (e: KeyboardEvent) => {
      const row = Math.floor(i / 12);
      const col = i % 12;
      let next = -1;
      switch (e.key) {
        case 'ArrowRight': next = col < 11 ? i + 1 : i; break;
        case 'ArrowLeft': next = col > 0 ? i - 1 : i; break;
        case 'ArrowDown': next = row < Y1 - Y0 ? i + 12 : i; break;
        case 'ArrowUp': next = row > 0 ? i - 12 : i; break;
        case 'PageDown': next = Math.min(Y1 - Y0, row + 5) * 12 + col; break;
        case 'PageUp': next = Math.max(0, row - 5) * 12 + col; break;
        case 'Home': next = row * 12; break;
        case 'End': next = row * 12 + 11; break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          opts.onSelect(c.g.dataset.ym!);
          return;
        case 'Escape': hideTip(); return;
        default: return;
      }
      e.preventDefault();
      e.stopPropagation();
      focusIndex(next);
    });
  });

  function update(o: CalendarOptions): void {
    opts = o;
    // Scale domain: whole AOI, or per sensor era in "per sensor" series.
    const vals = (pred: (r: MonthRow) => boolean) =>
      rows.filter(pred).map((r) => displayValue(r, o.series)).filter((v): v is number => v != null);
    const maxAll = Math.max(1, ...vals(() => true));
    const maxModis = Math.max(1, ...vals((r) => r.sensor_used === 'MODIS'));
    const maxViirs = Math.max(1, ...vals((r) => r.sensor_used === 'VIIRS'));
    const monthMedian = (m: number) => {
      if (o.series === 'harm') return rows.find((r) => r.month === m)?.baseline_median ?? null;
      const v = rows.filter((r) => r.month === m && r.year >= 2003 && r.year <= 2022).map((r) => displayValue(r, o.series)).filter((x): x is number => x != null);
      return v.length ? median(v) : null;
    };
    const medians = Array.from({ length: 12 }, (_, k) => monthMedian(k + 1));

    for (const c of cells) {
      const r = c.row;
      const isSel = c.g.dataset.ym === o.selected;
      c.sel.style.display = isSel ? '' : 'none';
      c.g.setAttribute('aria-selected', String(isSel));
      if (!r) {
        c.fill.style.fill = 'transparent';
        c.fill.setAttribute('class', 'cal-fill cal-future');
        c.label.textContent = '';
      } else if (r.obs_class === 'unobserved') {
        c.fill.style.fill = '#F6F7F8';
        c.label.textContent = '–';
        c.label.style.fill = '#1B1F24';
      } else {
        const v = displayValue(r, o.series) ?? 0;
        let color: string;
        let text: string;
        if (v === 0 && o.mode === 'count') {
          color = '#ECEFF2';
          text = '0';
        } else if (o.mode === 'count') {
          const max = o.series === 'sensor' ? (r.sensor_used === 'VIIRS' ? maxViirs : maxModis) : maxAll;
          color = countColor(v, max);
          text = fmtInt(v);
        } else {
          const med = medians[r.month - 1];
          const ratio = med ? v / med : v > 0 ? 4 : 1;
          color = v === 0 && !med ? '#ECEFF2' : ratioColor(ratioClass(ratio));
          text = med ? `×${fmtDec1(ratio)}` : fmtInt(v);
        }
        c.fill.style.fill = color;
        c.label.textContent = text;
        c.label.style.fill = textOn(color);
      }
      c.g.setAttribute('aria-label', describe(c));
    }

    // Totals + rank (descending) on the displayed series
    const yearTotals: { year: number; total: number }[] = [];
    for (let y = Y0; y <= Y1; y++) {
      const tot = rows.filter((r) => r.year === y).reduce((acc, r) => acc + (displayValue(r, o.series) ?? 0), 0);
      yearTotals.push({ year: y, total: tot });
    }
    const order = [...yearTotals].sort((a, b) => b.total - a.total).map((x) => x.year);
    yearTotals.forEach((x, k) => {
      totals[k].textContent = fmtInt(x.total);
      ranks[k].textContent = fmtInt(order.indexOf(x.year) + 1);
    });
    medians.forEach((m, k) => {
      medianTexts[k].textContent = m == null ? '–' : fmtInt(m);
    });

    // Roving tabindex on the selected cell (or first cell)
    const selIdx = Math.max(0, cells.findIndex((c) => c.g.dataset.ym === o.selected));
    if (!cells.some((c) => c.g.getAttribute('tabindex') === '0' && c.g === document.activeElement)) {
      cells.forEach((c, k) => c.g.setAttribute('tabindex', k === selIdx ? '0' : '-1'));
    }
  }

  update(initial);
  return { root, update };
}

/** Headline + coverage helpers (computed from the data, never hard-coded). */
export function summarize(rows: MonthRow[]): { worstYear: number; ok: number; all: number } {
  const totals = new Map<number, number>();
  for (const r of rows) totals.set(r.year, (totals.get(r.year) ?? 0) + (r.H ?? 0));
  const worstYear = [...totals.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return { worstYear, ok: rows.filter((r) => r.obs_class === 'good').length, all: rows.length };
}

export { fmtPct };
