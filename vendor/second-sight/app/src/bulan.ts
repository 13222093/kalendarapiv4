// "Bulan ini" screen (FE-12): spaghetti chart of every year, p10-p90 band, median, El Nino years,
// current year in the accent colour, optional comparison years, cumulative toggle, verdict sentence.
import * as Plot from '@observablehq/plot';
import type { MonthRow } from './data';
import { fmtInt, fmtDec1, type Lang } from './i18n';
import './styles/bulan.css';

// Moderate-to-strong El Nino years (NOAA CPC Oceanic Nino Index, Jun-Nov seasons).
// Source: NOAA Climate Prediction Center ONI table. Static list, not computed from data.
export const EL_NINO_YEARS = [2002, 2004, 2006, 2009, 2015, 2018, 2019, 2023];
const EL_NINO_SOURCE = 'NOAA CPC ONI';

const TXT = {
  id: {
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
    monthsLong: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
    monthly: 'Per bulan', cumulative: 'Kumulatif sejak Januari', view: 'Tampilan',
    addYear: '+ Tambah tahun pembanding', clear: 'Hapus pembanding',
    y: 'hari-sel api', band: 'rentang p10-p90', median: 'median', elnino: 'tahun El Niño',
    title: (m: string, y: number, pct: string) => `${m} ${y} lebih tinggi dari ${pct} ${m} lain sejak data dimulai`,
    titleLow: (m: string, y: number, pct: string) => `${m} ${y} hanya lebih tinggi dari ${pct} ${m} lain sejak data dimulai`,
    verdict: (m: string, y: number, v: string, ratio: string, rank: string, n: string) =>
      `${m} ${y}: <b>${v}</b> hari-sel api, <b>${ratio}×</b> median bulan yang sama, peringkat <b>${rank}</b> dari <b>${n}</b> tahun.`,
    source: (date: string, demo: boolean) => `Sumber: ${demo ? 'data contoh sintetis' : 'NASA FIRMS (MODIS, VIIRS), diharmonisasi Second Sight'}; El Niño: ${EL_NINO_SOURCE}. Diakses ${date}.`,
    none: 'Belum ada data untuk wilayah ini.',
  },
  en: {
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    monthsLong: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthly: 'Monthly', cumulative: 'Cumulative from January', view: 'View',
    addYear: '+ Add comparison year', clear: 'Clear comparison',
    y: 'fire cell-days', band: 'p10-p90 range', median: 'median', elnino: 'El Niño year',
    title: (m: string, y: number, pct: string) => `${m} ${y} was higher than ${pct} of other ${m}s on record`,
    titleLow: (m: string, y: number, pct: string) => `${m} ${y} was higher than only ${pct} of other ${m}s on record`,
    verdict: (m: string, y: number, v: string, ratio: string, rank: string, n: string) =>
      `${m} ${y}: <b>${v}</b> fire cell-days, <b>${ratio}×</b> the median for that month, rank <b>${rank}</b> of <b>${n}</b> years.`,
    source: (date: string, demo: boolean) => `Source: ${demo ? 'synthetic demo data' : 'NASA FIRMS (MODIS, VIIRS), harmonised by Second Sight'}; El Niño: ${EL_NINO_SOURCE}. Accessed ${date}.`,
    none: 'No data for this area yet.',
  },
};

let cumulative = false;
const compare = new Set<number>();

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
}

export function renderBulan(slot: HTMLElement, rows: MonthRow[], o: { lang: Lang; month: string; title: string; demo: boolean; rerender: () => void }): void {
  const d = TXT[o.lang];
  const panel = h('section', { class: 'panel bulan-panel', 'data-testid': 'bulan-panel' });
  const valid = rows.filter((r) => r.H != null);
  if (!valid.length) {
    panel.append(h('h2', {}, o.title), h('p', { class: 'muted' }, d.none));
    slot.replaceChildren(panel);
    return;
  }
  // Pick the selected month if present, else the latest month with data.
  let [sy, sm] = o.month.split('-').map(Number);
  if (!valid.some((r) => r.year === sy && r.month === sm)) {
    const last = valid.reduce((a, b) => (a.year * 12 + a.month > b.year * 12 + b.month ? a : b));
    sy = last.year;
    sm = last.month;
  }
  const years = [...new Set(valid.map((r) => r.year))].sort((a, b) => a - b);
  const byYear = new Map<number, { month: number; v: number }[]>();
  for (const y of years) {
    const ys = valid.filter((r) => r.year === y).sort((a, b) => a.month - b.month);
    let acc = 0;
    byYear.set(y, ys.map((r) => ({ month: r.month, v: cumulative ? (acc += r.H!) : r.H! })));
  }
  const pts = years.flatMap((y) => byYear.get(y)!.map((p) => ({ year: y, ...p })));
  const band = Array.from({ length: 12 }, (_, i) => {
    const vs = pts.filter((p) => p.month === i + 1 && p.year !== sy).map((p) => p.v).sort((a, b) => a - b);
    return { month: i + 1, p10: quantile(vs, 0.1), p50: quantile(vs, 0.5), p90: quantile(vs, 0.9) };
  }).filter((b) => Number.isFinite(b.p50));

  // Verdict numbers for the selected month (always monthly values, not cumulative).
  const same = valid.filter((r) => r.month === sm);
  const cur = same.find((r) => r.year === sy)!;
  const others = same.filter((r) => r.year !== sy).map((r) => r.H!);
  const below = others.filter((v) => v < cur.H!).length;
  const pct = others.length ? below / others.length : 0;
  const rank = same.filter((r) => r.H! > cur.H!).length + 1;
  const med = cur.baseline_median ?? quantile([...others].sort((a, b) => a - b), 0.5);
  const ratio = med > 0 ? cur.H! / med : NaN;
  const pctText = new Intl.NumberFormat(o.lang === 'id' ? 'id-ID' : 'en-GB', { style: 'percent', maximumFractionDigits: 0 }).format(pct);
  const mName = d.monthsLong[sm - 1];
  const finding = pct >= 0.5 ? d.title(mName, sy, pctText) : d.titleLow(mName, sy, pctText);

  panel.append(h('h2', {}, o.title));
  if (o.demo) panel.lastElementChild!.append(h('span', { class: 'badge' }, o.lang === 'id' ? 'Data contoh' : 'Demo data'));
  const verdict = h('p', { class: 'verdict', 'data-testid': 'verdict' });
  verdict.innerHTML = d.verdict(mName, sy, fmtInt(Math.round(cur.H!)), Number.isFinite(ratio) ? fmtDec1(ratio) : '-', fmtInt(rank), fmtInt(same.length));
  panel.append(verdict);

  // Controls
  const controls = h('div', { class: 'controls' });
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': d.view });
  for (const [val, label] of [[false, d.monthly], [true, d.cumulative]] as const) {
    const b = h('button', { type: 'button', 'aria-pressed': String(cumulative === val), 'data-testid': val ? 'bulan-cumulative' : 'bulan-monthly' }, label);
    b.addEventListener('click', () => {
      cumulative = val;
      o.rerender();
    });
    seg.append(b);
  }
  const sel = h('select', { class: 'aoi-input bulan-add', 'aria-label': d.addYear, 'data-testid': 'bulan-add-year' });
  sel.append(h('option', { value: '' }, d.addYear));
  for (const y of years) if (y !== sy && !compare.has(y)) sel.append(h('option', { value: String(y) }, String(y)));
  sel.addEventListener('change', () => {
    if (sel.value) compare.add(Number(sel.value));
    o.rerender();
  });
  controls.append(seg, sel);
  if (compare.size) {
    const c = h('button', { type: 'button', class: 'btn' }, d.clear);
    c.addEventListener('click', () => {
      compare.clear();
      o.rerender();
    });
    controls.append(c);
  }
  panel.append(controls);

  const ninos = years.filter((y) => EL_NINO_YEARS.includes(y) && y !== sy && !compare.has(y));
  const cmp = [...compare].filter((y) => y !== sy);
  const lastPt = (y: number) => {
    const s = byYear.get(y)!;
    return { year: y, ...s[s.length - 1] };
  };
  const width = Math.min(1040, Math.max(320, slot.clientWidth - 34));
  const accessed = new Date().toISOString().slice(0, 10);
  const chart = Plot.plot({
    width,
    height: 360,
    marginRight: 48,
    style: { fontFamily: 'var(--font-body)', fontSize: '12px', background: 'transparent' },
    title: finding,
    caption: d.source(accessed, o.demo),
    x: { domain: [1, 12], ticks: 12, tickFormat: (m: number) => d.months[m - 1], label: null },
    y: { grid: true, label: d.y, tickFormat: (v: number) => fmtInt(v) },
    marks: [
      Plot.areaY(band, { x: 'month', y1: 'p10', y2: 'p90', fill: '#9AA4AF', fillOpacity: 0.25, curve: 'monotone-x' }),
      Plot.lineY(pts.filter((p) => p.year !== sy), { x: 'month', y: 'v', z: 'year', stroke: '#B8C0C8', strokeWidth: 0.8, curve: 'monotone-x' }),
      Plot.lineY(band, { x: 'month', y: 'p50', stroke: '#56606B', strokeWidth: 1.5, strokeDasharray: '5 4', curve: 'monotone-x' }),
      Plot.lineY(pts.filter((p) => ninos.includes(p.year)), { x: 'month', y: 'v', z: 'year', stroke: '#B4462E', strokeWidth: 1.4, curve: 'monotone-x' }),
      Plot.text(ninos.map(lastPt), { x: 'month', y: 'v', text: (p: { year: number }) => String(p.year), dx: 4, textAnchor: 'start', fill: '#B4462E', fontSize: 11 }),
      Plot.lineY(pts.filter((p) => cmp.includes(p.year)), { x: 'month', y: 'v', z: 'year', stroke: '#1B1F24', strokeWidth: 1.6, curve: 'monotone-x' }),
      Plot.text(cmp.map(lastPt), { x: 'month', y: 'v', text: (p: { year: number }) => String(p.year), dx: 4, textAnchor: 'start', fill: '#1B1F24', fontSize: 11 }),
      Plot.lineY(byYear.get(sy)!, { x: 'month', y: 'v', stroke: '#1F5F8B', strokeWidth: 2.6, curve: 'monotone-x' }),
      Plot.dot(byYear.get(sy)!.filter((p) => p.month === sm), { x: 'month', y: 'v', r: 4, fill: '#1F5F8B' }),
      Plot.text([lastPt(sy)], { x: 'month', y: 'v', text: (p: { year: number }) => String(p.year), dx: 4, textAnchor: 'start', fill: '#1F5F8B', fontWeight: 700, fontSize: 12 }),
      Plot.tip(pts, Plot.pointerX({ x: 'month', y: 'v', title: (p: { year: number; month: number; v: number }) => `${d.months[p.month - 1]} ${p.year}: ${fmtInt(Math.round(p.v))}` })),
    ],
  });
  chart.setAttribute('data-testid', 'spaghetti-chart');
  const wrap = h('div', { class: 'bulan-chart' });
  wrap.append(chart);
  panel.append(wrap);
  const key = h('ul', { class: 'cal-legend' });
  const item = (svg: string, text: string) => {
    const li = h('li');
    li.innerHTML = `<svg width="22" height="10" aria-hidden="true">${svg}</svg>`;
    li.append(document.createTextNode(text));
    key.append(li);
  };
  item('<line x1="0" y1="5" x2="22" y2="5" stroke="#1F5F8B" stroke-width="2.6"/>', String(sy));
  item('<line x1="0" y1="5" x2="22" y2="5" stroke="#B4462E" stroke-width="1.4"/>', d.elnino);
  item('<line x1="0" y1="5" x2="22" y2="5" stroke="#56606B" stroke-width="1.5" stroke-dasharray="5 4"/>', d.median);
  item('<rect x="0" y="1" width="22" height="8" fill="#9AA4AF" fill-opacity=".25"/>', d.band);
  panel.append(key);
  slot.replaceChildren(panel);
}
