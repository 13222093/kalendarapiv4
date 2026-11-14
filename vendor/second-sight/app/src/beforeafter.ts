// "Before vs after" opening screen (FND-03): yearly totals 2003-2026 for the selected AOI as
// naive stitch (MODIS until 2011, VIIRS from 2012), summed (wrong) and fair (harmonised H),
// each indexed to its own 2003-2011 mean (= 100) so the 2012 step is visible on one scale.
import * as Plot from '@observablehq/plot';
import type { MonthRow } from './data';
import { fmtInt, fmtDec1, type Lang } from './i18n';

interface Finding { id?: string; en?: string; text?: string }
let findingP: Promise<Finding | null> | null = null;
const loadFinding = () =>
  (findingP ??= fetch(`${import.meta.env.BASE_URL}data/finding.json`)
    .then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? (r.json() as Promise<Finding>) : null))
    .catch(() => null));

const dir = (n: number, up: string, down: string) => `${n >= 0 ? up : down} ${fmtInt(Math.abs(Math.round(n)))}%`;

const TXT = {
  id: {
    title: 'Sebelum dan sesudah harmonisasi',
    naive: 'disambung begitu saja',
    summed: 'dijumlahkan (keliru)',
    fair: 'skala adil (pita 90%)',
    y: 'indeks, rerata 2003-2011 = 100',
    prov: 'provisional (NRT)',
    national: 'Nasional:',
    prelim: 'preliminary',
    headline: (a: string, n: number, f: number) => `${a}: disambung begitu saja tampak ${dir(n, 'naik', 'turun')}, pada skala adil ${dir(f, 'naik', 'turun')} (2003-07 → 2019-23)`,
    valid: (v: string) => `Galat median leave-one-year-out setelah harmonisasi: ${v}%.`,
    validPending: 'Angka validasi belum tersedia.',
    source: (demo: boolean, d: string) => `Sumber: ${demo ? 'data contoh sintetis' : 'NASA FIRMS (MODIS, VIIRS)'}, diolah Second Sight. Tiap garis diindeks ke rerata 2003-2011 miliknya sendiri. Pita: jumlah batas bulanan (pendekatan). ${d}.`,
    seam: 'VIIRS mulai',
  },
  en: {
    title: 'Before and after harmonisation',
    naive: 'naive stitch',
    summed: 'summed (wrong)',
    fair: 'fair scale (90% band)',
    y: 'index, 2003-2011 mean = 100',
    prov: 'provisional (NRT)',
    national: 'National:',
    prelim: 'preliminary',
    headline: (a: string, n: number, f: number) => `${a}: naively stitched it appears to ${dir(n, 'rise', 'fall')}, on the fair scale it ${dir(f, 'rises', 'falls')} (2003-07 → 2019-23)`,
    valid: (v: string) => `Median leave-one-year-out error after harmonisation: ${v}%.`,
    validPending: 'Validation number not yet available.',
    source: (demo: boolean, d: string) => `Source: ${demo ? 'synthetic demo data' : 'NASA FIRMS (MODIS, VIIRS)'}, processed by Second Sight. Each line is indexed to its own 2003-2011 mean. Band: sum of monthly bounds (approximation). ${d}.`,
    seam: 'VIIRS starts',
  },
};

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
}

type Key = 'naive' | 'summed' | 'H';

export function renderBeforeAfter(
  slot: HTMLElement,
  rows: MonthRow[],
  o: { lang: Lang; area: string; demo: boolean; note?: string; validation: Promise<{ meta?: { ablation?: { method: string; loyo_mdape?: number }[] } } | null> },
): void {
  const d = TXT[o.lang];
  const panel = h('section', { class: 'panel bulan-panel ba-panel', 'data-testid': 'before-after' });

  const years = new Map<number, { naive: number; summed: number; H: number; lo: number; hi: number }>();
  for (const r of rows) {
    if (r.year < 2003 || r.year > 2026) continue;
    const y = years.get(r.year) ?? { naive: 0, summed: 0, H: 0, lo: 0, hi: 0 };
    y.naive += (r.year <= 2011 ? r.A_raw : r.V_raw) ?? 0;
    y.summed += (r.A_raw ?? 0) + (r.V_raw ?? 0);
    y.H += r.H ?? 0;
    y.lo += r.H_lo ?? r.H ?? 0;
    y.hi += r.H_hi ?? r.H ?? 0;
    years.set(r.year, y);
  }
  const raw = [...years.entries()].sort((a, b) => a[0] - b[0]).map(([year, v]) => ({ year, ...v }));
  const mean = (k: Key, a: number, b: number) => {
    const xs = raw.filter((p) => p.year >= a && p.year <= b).map((p) => p[k]);
    return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN;
  };
  const base = (k: Key) => {
    const m = mean(k, 2003, 2011);
    return m > 0 ? m : 1;
  };
  const bN = base('naive'), bS = base('summed'), bH = base('H');
  const data = raw.map((p) => ({ year: p.year, naive: (p.naive / bN) * 100, summed: (p.summed / bS) * 100, H: (p.H / bH) * 100, lo: (p.lo / bH) * 100, hi: (p.hi / bH) * 100 }));
  const chg = (k: Key) => (mean(k, 2019, 2023) / mean(k, 2003, 2007) - 1) * 100;
  const cN = chg('naive'), cH = chg('H');

  const head = h('h2', { class: 'ba-title', 'data-testid': 'finding-aoi' }, Number.isFinite(cN) && Number.isFinite(cH) ? d.headline(o.area, cN, cH) : `${o.area}: ${d.title}`);
  if (o.demo) head.append(h('span', { class: 'badge' }, o.lang === 'id' ? 'Data contoh' : 'Demo data'));
  panel.append(head);
  if (o.note) panel.append(h('p', { class: 'muted', 'data-testid': 'aoi-note' }, o.note));

  const prov = data.at(-1)?.year === 2026;
  const solid = prov ? data.slice(0, -1) : data;
  const tail = prov ? data.slice(-2) : [];
  const series: { k: Key; label: string; stroke: string; w: number; dash?: string }[] = [
    { k: 'summed', label: d.summed, stroke: '#C3C9CF', w: 1, dash: '3 3' },
    { k: 'naive', label: d.naive, stroke: '#7D8792', w: 1.8 },
    { k: 'H', label: d.fair, stroke: '#1F5F8B', w: 3 },
  ];
  const width = Math.min(1100, Math.max(300, slot.clientWidth - 34));
  const narrow = width < 600;
  const endYear = solid.at(-1)?.year ?? 2025;
  const ends = series.map((s) => ({ year: endYear, v: solid.at(-1)?.[s.k] ?? 0, label: s.label, fill: s.stroke }));
  // Direct end labels only when the end values are far enough apart not to overlap; else a legend.
  const yMax = Math.max(100, ...data.map((p) => Math.max(p.naive, p.summed, p.hi)));
  const ev = ends.map((e) => e.v).sort((a, b) => a - b);
  const spread = ev.every((v, i) => i === 0 || (v - ev[i - 1]) / yMax > 0.06);
  const long = data.flatMap((p) => series.map((s) => ({ year: p.year, v: p[s.k], s: s.label })));
  const chart = Plot.plot({
    width,
    height: narrow ? 300 : 400,
    marginLeft: 44,
    marginRight: narrow || !spread ? 24 : 160,
    marginTop: 28,
    caption: d.source(o.demo, new Date().toISOString().slice(0, 10)),
    style: { fontFamily: 'var(--font-body)', fontSize: '12px', background: 'transparent' },
    x: { label: null, tickFormat: (y: number) => String(y), domain: [2003, 2026], ticks: narrow ? 5 : 12 },
    y: { grid: true, label: d.y, tickFormat: (v: number) => fmtInt(v), zero: true },
    marks: [
      Plot.areaY(data, { x: 'year', y1: 'lo', y2: 'hi', fill: '#1F5F8B', fillOpacity: 0.16 }),
      Plot.ruleY([100], { stroke: '#56606B', strokeOpacity: 0.45 }),
      Plot.ruleX([2012], { stroke: '#56606B', strokeDasharray: '4 3' }),
      Plot.text([{ x: 2012 }], { x: 'x', frameAnchor: 'top', text: () => `2012 ${d.seam}`, dx: 4, dy: -18, textAnchor: 'start', fill: '#56606B', fontSize: 11 }),
      ...(prov ? [Plot.text([{ x: 2026 }], { x: 'x', frameAnchor: 'top', text: () => `2026 ${d.prov}`, dy: -18, textAnchor: narrow ? 'end' : 'middle', fill: '#56606B', fontSize: 11 })] : []),
      ...series.flatMap((s) => [
        Plot.lineY(solid, { x: 'year', y: s.k, stroke: s.stroke, strokeWidth: s.w, strokeDasharray: s.dash }),
        ...(prov
          ? [
              Plot.lineY(tail, { x: 'year', y: s.k, stroke: s.stroke, strokeWidth: s.w, strokeDasharray: '2 3' }),
              Plot.dot(data.slice(-1), { x: 'year', y: s.k, r: 3, stroke: s.stroke, strokeWidth: 1.5, fill: '#FFFFFF' }),
            ]
          : []),
      ]),
      ...(narrow || !spread ? [] : [Plot.text(ends, { x: 'year', y: 'v', text: 'label', fill: 'fill', dx: prov ? 40 : 8, textAnchor: 'start', fontSize: 12 })]),
      Plot.tip(long, Plot.pointerX({ x: 'year', y: 'v', title: (p: { year: number; v: number; s: string }) => `${p.year} · ${p.s}: ${fmtInt(Math.round(p.v))}` })),
    ],
  });
  chart.setAttribute('data-testid', 'before-after-chart');
  if (narrow || !spread) {
    const lg = h('p', { class: 'muted ba-legend' });
    for (const s of series.slice().reverse()) {
      lg.append(h('span', { class: 'ba-swatch', style: `border-top:${s.w + 1}px ${s.dash ? 'dashed' : 'solid'} ${s.stroke}` }), document.createTextNode(` ${s.label} `));
    }
    panel.append(lg);
  }
  const wrap = h('div', { class: 'bulan-chart ba-chart' });
  wrap.append(chart);
  panel.append(wrap);

  const finding = h('span', { 'data-testid': 'finding' });
  const valid = h('span', { 'data-testid': 'validation-number' }, d.validPending);
  const cap = h('p', { class: 'muted ba-caption' });
  cap.append(finding, document.createTextNode(' '), valid);
  panel.append(cap);
  slot.replaceChildren(panel);

  loadFinding().then((f) => {
    const text = f ? (f[o.lang] ?? f.text) : null;
    if (!text) return;
    const clean = String(text).replace(/\s*\((?:preliminary|pendahuluan)[^)]*\)/gi, '').trim().replace(/\.$/, '');
    finding.textContent = `${d.national} ${clean} (${d.prelim}).`;
  });
  o.validation.then((v) => {
    const m = v?.meta?.ablation?.find((a) => a.method === 'M3')?.loyo_mdape;
    if (m != null && Number.isFinite(m)) valid.textContent = d.valid(fmtDec1(m));
  });
}
