// "Seberapa yakin" screen (FE-15): trust card, tests table, 3-point disclaimer, limitations.
// Reads data/validation_results.json when present; otherwise shows a labelled placeholder.
import * as Plot from '@observablehq/plot';
import { fmtDec1, fmtInt, type Lang } from './i18n';
import './styles/yakin.css';

interface Ablation { method: string; loyo_mdape?: number; ape_2015?: number; ape_2019?: number; overlap_kge?: number; delta_seam_2012?: number }
interface TestRow { test_id: string; metric: string; value: number | null; rule?: string; passed: boolean | null; status?: string; notes?: string }
interface Validation { meta?: { run_utc?: string; ablation?: Ablation[]; chosen_method?: string }; results?: TestRow[] }

let cache: Promise<Validation | null> | null = null;
export function loadValidation(): Promise<Validation | null> {
  cache ??= fetch(`${import.meta.env.BASE_URL}data/validation_results.json`)
    .then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? (r.json() as Promise<Validation>) : null))
    .catch(() => null);
  return cache;
}

const TXT = {
  id: {
    title: 'Seberapa yakin',
    trust: 'Kartu kepercayaan',
    trustTitle: (raw: string, harm: string) => `Galat pada tahun uji turun dari ${raw}% (mentah) ke ${harm}% (harmonisasi)`,
    pending: 'Hasil validasi belum tersedia',
    pendingNote: 'Kartu ini terisi otomatis setelah pipeline validasi menulis validation_results.json.',
    raw: 'Mentah', harm: 'Harmonisasi', err: 'galat persentase absolut (%)',
    held: { ape_2015: 'Tahun uji 2015', ape_2019: 'Tahun uji 2019', loyo_mdape: 'Median leave-one-year-out' },
    tests: 'Daftar uji', test: 'Uji', metric: 'Ukuran', value: 'Nilai', status: 'Status',
    st: { pass: 'Lulus', fail: 'Gagal', not_run: 'Belum dijalankan', info: 'Deskriptif' },
    more: (n: string) => `${n} uji deskriptif lain disembunyikan.`,
    disc: 'Yang perlu diingat',
    d1: 'Titik panas bukan kejadian kebakaran dan bukan luas area terbakar.',
    d2: 'Api di bawah gambut atau di bawah asap tebal bisa tidak terlihat oleh kedua satelit.',
    d3: 'Data 2026 masih sementara (FIRMS NRT) dan bisa direvisi.',
    lim: 'Keterbatasan',
    lims: [
      'Rasio VIIRS/MODIS dianggap tetap dalam tiap strata; tahun ekstrem bisa menyimpang.',
      'Seri sebelum 2012 tidak memuat api kecil yang hanya terlihat VIIRS.',
      'Luas terbakar resmi (SiPongi) memakai metode lain; hanya dipakai untuk korelasi peringkat.',
      'Parameter siklus harian untuk Indonesia belum pasti; koreksi drift orbit hanya diagnostik.',
      'Tahun analog El Niño sedikit, jadi peringkat analog punya ketidakpastian besar.',
      'Batas KHG dan peta gambut mungkin bukan versi resmi terbaru.',
    ],
    source: (d: string) => `Sumber: validation_results.json, dijalankan ${d}.`,
  },
  en: {
    title: 'How sure',
    trust: 'Trust card',
    trustTitle: (raw: string, harm: string) => `Error on held-out years drops from ${raw}% (raw) to ${harm}% (harmonised)`,
    pending: 'Validation results not yet available',
    pendingNote: 'This card fills in automatically once the validation pipeline writes validation_results.json.',
    raw: 'Raw', harm: 'Harmonised', err: 'absolute percentage error (%)',
    held: { ape_2015: 'Held-out 2015', ape_2019: 'Held-out 2019', loyo_mdape: 'Leave-one-year-out median' },
    tests: 'Tests', test: 'Test', metric: 'Metric', value: 'Value', status: 'Status',
    st: { pass: 'Pass', fail: 'Fail', not_run: 'Not run', info: 'Descriptive' },
    more: (n: string) => `${n} other descriptive tests hidden.`,
    disc: 'Keep in mind',
    d1: 'Hotspots are not fire events and not burned area.',
    d2: 'Fires under peat or thick smoke can be missed by both satellites.',
    d3: '2026 data are provisional (FIRMS NRT) and may be revised.',
    lim: 'Limitations',
    lims: [
      'The VIIRS/MODIS ratio is assumed stable within each stratum; extreme years can deviate.',
      'The pre-2012 series lacks small fires only VIIRS can see.',
      'Official burned area (SiPongi) uses other methods; used only for rank correlation.',
      'Diurnal-cycle parameters for Indonesia are uncertain; orbit-drift correction is diagnostic only.',
      'There are few El Niño analogue years, so analogue rankings are very uncertain.',
      'KHG boundaries and peat maps may not be the latest official versions.',
    ],
    source: (d: string) => `Source: validation_results.json, run ${d}.`,
  },
};

// Outline icons (stroke only, no fill).
const ICONS = [
  '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>',
  '<path d="M3 15c3-2 5-2 9 0s6 2 9 0"/><path d="M3 10c3-2 5-2 9 0s6 2 9 0"/>',
  '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
];

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
}

const statusOf = (r: TestRow): keyof typeof TXT.id.st => {
  if (r.status && r.status !== 'run') return 'not_run';
  if (r.passed === true) return 'pass';
  if (r.passed === false) return 'fail';
  return 'info';
};

export function renderYakin(slot: HTMLElement, v: Validation | null, lang: Lang): void {
  const d = TXT[lang];
  const wrap = h('div', { class: 'yakin' });
  const card = h('section', { class: 'panel', 'data-testid': 'trust-card' });
  card.append(h('h2', {}, d.trust));
  const abl = v?.meta?.ablation ?? [];
  const raw = abl.find((a) => a.method === 'M0');
  const harm = abl.find((a) => a.method === (v?.meta?.chosen_method ?? 'M3'));
  if (!raw || !harm) {
    card.append(h('p', { class: 'trust-pending', 'data-testid': 'trust-pending' }, d.pending), h('p', { class: 'muted' }, d.pendingNote));
  } else {
    const keys = ['ape_2015', 'ape_2019', 'loyo_mdape'] as const;
    const data = keys.flatMap((k) => [
      { k: d.held[k], s: d.raw, v: raw[k] ?? NaN },
      { k: d.held[k], s: d.harm, v: harm[k] ?? NaN },
    ]).filter((x) => Number.isFinite(x.v));
    const mean = (a: Ablation) => keys.map((k) => a[k] ?? NaN).filter(Number.isFinite).reduce((x, y, _, arr) => x + y / arr.length, 0);
    const chart = Plot.plot({
      width: Math.min(720, Math.max(300, slot.clientWidth - 34)),
      height: 220,
      marginLeft: 170,
      title: d.trustTitle(fmtInt(Math.round(mean(raw))), fmtDec1(mean(harm))),
      caption: d.source((v?.meta?.run_utc ?? '').slice(0, 10)),
      style: { fontFamily: 'var(--font-body)', fontSize: '12px', background: 'transparent' },
      x: { type: 'log', label: d.err, grid: true, tickFormat: (n: number) => fmtInt(n) },
      y: { label: null },
      fy: { label: null },
      color: { domain: [d.raw, d.harm], range: ['#9AA4AF', '#1F5F8B'], legend: true },
      marks: [
        Plot.ruleX([1]),
        Plot.barX(data, { y: 's', x: 'v', fill: 's', fy: 'k' }),
        Plot.text(data, { y: 's', x: 'v', fy: 'k', text: (x: { v: number }) => fmtDec1(x.v), dx: 4, textAnchor: 'start', fontSize: 11 }),
      ],
    });
    card.append(chart);
    if (raw.delta_seam_2012 != null && harm.delta_seam_2012 != null) {
      const seam = h('table', { class: 'tests seam', 'data-testid': 'seam-table' });
      seam.append(h('caption', {}, lang === 'id' ? 'Lompatan level saat satelit baru masuk' : 'Level change at each satellite arrival'));
      const hr = h('tr');
      for (const c of [lang === 'id' ? 'Sambungan' : 'Seam', d.raw, d.harm]) hr.append(h('th', { scope: 'col' }, c));
      const tr = h('tr');
      const nf2 = new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const sg = (x: number) => (x < 0 ? '−' : '') + nf2.format(Math.abs(x));
      tr.append(h('td', {}, lang === 'id' ? '2012-01 MODIS ke VIIRS (Δ log)' : '2012-01 MODIS to VIIRS (Δ log)'),
        h('td', { class: 'num' }, sg(raw.delta_seam_2012)), h('td', { class: 'num strong' }, sg(harm.delta_seam_2012)));
      seam.append(hr, tr);
      card.append(seam);
    }
  }
  wrap.append(card);

  const tests = h('section', { class: 'panel', 'data-testid': 'tests-table' });
  tests.append(h('h3', {}, d.tests));
  const rows = v?.results ?? [];
  if (!rows.length) tests.append(h('p', { class: 'muted' }, d.pending));
  else {
    const shown = rows.filter((r) => statusOf(r) !== 'info');
    const hidden = rows.length - shown.length;
    const table = h('table', { class: 'tests' });
    const thead = h('tr');
    for (const c of [d.test, d.metric, d.value, d.status]) thead.append(h('th', { scope: 'col' }, c));
    table.append(thead);
    for (const r of shown) {
      const st = statusOf(r);
      const tr = h('tr', { 'data-status': st });
      tr.append(h('td', {}, r.test_id), h('td', {}, r.metric), h('td', { class: 'num' }, r.value == null ? '-' : fmtDec1(r.value)), h('td', { class: `st st-${st}` }, d.st[st]));
      table.append(tr);
    }
    const sc = h('div', { class: 'tests-scroll' });
    sc.append(table);
    tests.append(sc);
    if (hidden) tests.append(h('p', { class: 'muted' }, d.more(fmtInt(hidden))));
  }
  wrap.append(tests);

  const disc = h('section', { class: 'panel', 'data-testid': 'disclaimer' });
  disc.append(h('h3', {}, d.disc));
  const ul = h('ul', { class: 'disc-list' });
  [d.d1, d.d2, d.d3].forEach((text, i) => {
    const li = h('li');
    li.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1F5F8B" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">${ICONS[i]}</svg>`;
    li.append(h('span', {}, text));
    ul.append(li);
  });
  disc.append(ul);
  wrap.append(disc);

  const lim = h('section', { class: 'panel', 'data-testid': 'limitations' });
  lim.append(h('h3', {}, d.lim));
  const ol = h('ol', { class: 'lim-list' });
  d.lims.forEach((x) => ol.append(h('li', {}, x)));
  lim.append(ol);
  wrap.append(lim);
  slot.replaceChildren(wrap);
}
