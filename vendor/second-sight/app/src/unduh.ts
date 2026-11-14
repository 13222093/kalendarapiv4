// Download menu (FE-16): CSV of the calendar data currently shown, PNG/SVG of the calendar,
// and the raw data files, each with a short description.
import type { MonthRow, MonthlyDoc } from './data';
import type { CalendarHandle } from './calendar';
import type { Lang } from './i18n';
import './styles/unduh.css';

export interface ExportCtx {
  lang: Lang;
  doc: MonthlyDoc;
  rows: MonthRow[];
  aoiLabel: string;
  dataAoi: string;
  filters: Record<string, string>;
  makeCalendar: () => CalendarHandle;
}

const TXT = {
  id: {
    title: 'Unduh',
    lead: 'Semua file memakai data yang sedang tampil di kalender.',
    csv: 'Tabel bulanan (CSV)', csvD: 'Satu baris per bulan: nilai harmonisasi, interval 90%, hitungan mentah, median baseline, kelas pengamatan. Baris berawalan # berisi versi data, filter, baseline, sitasi dan catatan AI.',
    svg: 'Kalender (SVG)', svgD: 'Gambar vektor kalender dengan judul, legenda, sumber dan tanggal. Cocok untuk laporan.',
    png: 'Kalender (PNG)', pngD: 'Gambar kalender resolusi 2x untuk slide atau media sosial.',
    raw: 'File data mentah', rawD: 'File JSON yang dipakai aplikasi ini, apa adanya.',
    index: 'Indeks data (index.json): versi data, satuan, periode baseline, daftar wilayah.',
    validation: 'Hasil validasi (validation_results.json): semua uji, nilai dan status.',
    monthly: (f: string) => `Data bulanan wilayah (${f}).`,
    demo: 'Data contoh sintetis (demo_monthly.json), bukan hasil pengamatan.',
    button: 'Unduh',
    cite: 'Cara mengutip', rows: (n: number) => `${n} baris`,
    legend: 'Warna: jumlah hari-sel api. Abu-abu: nol. Arsir: sebagian atau tidak teramati. Garis putus: sementara.',
    source: (src: string, date: string) => `Sumber: ${src}. Dibuat ${date} dengan Second Sight.`,
  },
  en: {
    title: 'Download',
    lead: 'Every file uses the data currently shown in the calendar.',
    csv: 'Monthly table (CSV)', csvD: 'One row per month: harmonised value, 90% interval, raw counts, baseline median, observation class. Lines starting with # carry data version, filters, baseline, citation and an AI note.',
    svg: 'Calendar (SVG)', svgD: 'Vector image of the calendar with title, legend, source and date. Good for reports.',
    png: 'Calendar (PNG)', pngD: '2x-resolution calendar image for slides or social media.',
    raw: 'Raw data files', rawD: 'The JSON files this app uses, as they are.',
    index: 'Data index (index.json): data version, unit, baseline period, list of areas.',
    validation: 'Validation results (validation_results.json): every test, value and status.',
    monthly: (f: string) => `Monthly data for an area (${f}).`,
    demo: 'Synthetic demo data (demo_monthly.json), not observations.',
    button: 'Download',
    cite: 'How to cite', rows: (n: number) => `${n} rows`,
    legend: 'Colour: fire cell-day count. Grey: zero. Hatched: partial or unobserved. Dashed outline: provisional.',
    source: (src: string, date: string) => `Source: ${src}. Made ${date} with Second Sight.`,
  },
};

const CITATION = 'Second Sight (2026). Harmonised MODIS/VIIRS hotspot calendar for Indonesia. NASA Space Apps Challenge 2026. Data: NASA FIRMS (MODIS C6.1, VIIRS 375 m).';
const AI_NOTE = 'AI tools assisted with code; analysis choices and validation are by the team. See docs/ai_acknowledgement.md.';

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
}

function save(blob: Blob, name: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const today = () => new Date().toISOString().slice(0, 10);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function buildCsv(c: ExportCtx): string {
  const m = c.doc.meta;
  const head = [
    `# app: Second Sight`,
    `# data_version: ${m.data_version ?? (m.synthetic ? 'synthetic demo' : 'unknown')}`,
    `# generated: ${today()}`,
    `# area: ${c.aoiLabel} (data aoi_id: ${c.dataAoi})`,
    `# filters: ${Object.entries(c.filters).map(([k, v]) => `${k}=${v}`).join('; ')}`,
    `# unit: ${m.unit ?? ''}`,
    `# baseline: ${m.baseline ?? ''}`,
    `# citation: ${CITATION}`,
    `# ai_acknowledgement: ${AI_NOTE}`,
  ];
  if (m.synthetic) head.push('# WARNING: synthetic demo data, not observations');
  const cols: (keyof MonthRow)[] = ['aoi_id', 'year', 'month', 'H', 'H_lo', 'H_hi', 'A_raw', 'V_raw', 'sensor_used', 'baseline_median', 'pct_rank', 'obs_class', 'flag_nrt', 'agreement'];
  const esc = (v: unknown) => {
    if (v == null) return '';
    const s = typeof v === 'number' ? String(Math.round(v * 1000) / 1000) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [...c.rows].sort((a, b) => a.year - b.year || a.month - b.month).map((r) => cols.map((k) => esc(r[k])).join(','));
  return [...head, cols.join(','), ...body].join('\n') + '\n';
}

const STYLE_PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-opacity', 'opacity', 'font-size', 'font-family', 'font-weight', 'text-anchor', 'dominant-baseline'];

// Serialise the calendar SVG with computed styles inlined, framed by title, legend, source and date.
export function buildSvg(c: ExportCtx): { svg: string; width: number; height: number } {
  const d = TXT[c.lang];
  const cal = c.makeCalendar();
  const host = h('div', { style: 'position:absolute;left:-99999px;top:0' });
  host.append(cal.root);
  document.body.append(host);
  const live = cal.root.querySelector('svg.cal') as SVGSVGElement;
  const clone = live.cloneNode(true) as SVGSVGElement;
  const a = [live, ...live.querySelectorAll('*')];
  const b = [clone, ...clone.querySelectorAll('*')];
  a.forEach((node, i) => {
    const cs = getComputedStyle(node);
    const st = STYLE_PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';');
    (b[i] as SVGElement).setAttribute('style', st);
  });
  host.remove();
  const w = Number(live.getAttribute('width')) || 900;
  const hgt = Number(live.getAttribute('height')) || 600;
  const pad = 20;
  const W = w + pad * 2;
  const H = hgt + 120;
  clone.setAttribute('x', String(pad));
  clone.setAttribute('y', '56');
  clone.removeAttribute('class');
  const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const src = c.doc.meta.synthetic ? (c.lang === 'id' ? 'data contoh sintetis' : 'synthetic demo data') : `NASA FIRMS (MODIS, VIIRS), ${c.lang === 'id' ? 'versi data' : 'data version'} ${(c.doc.meta.data_version ?? '').slice(0, 8)}`;
  const title = `${c.aoiLabel}: ${c.lang === 'id' ? 'kalender titik panas bulanan' : 'monthly hotspot calendar'} (${c.filters.series ?? ''})`;
  const font = "font-family:'Source Sans 3 Variable','Source Sans 3',system-ui,sans-serif";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="100%" height="100%" fill="#ffffff"/>
<text x="${pad}" y="30" style="${font};font-size:20px;font-weight:600;fill:#1B1F24">${xml(title)}</text>
<text x="${pad}" y="48" style="${font};font-size:13px;fill:#56606B">${xml(c.doc.meta.unit ?? '')}</text>
${new XMLSerializer().serializeToString(clone)}
<text x="${pad}" y="${hgt + 84}" style="${font};font-size:13px;fill:#1B1F24">${xml(d.legend)}</text>
<text x="${pad}" y="${hgt + 104}" style="${font};font-size:12px;fill:#56606B">${xml(d.source(src, today()))}</text>
</svg>`;
  return { svg, width: W, height: H };
}

async function svgToPng(svg: string, w: number, hgt: number): Promise<Blob> {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  await new Promise<void>((ok, bad) => {
    img.onload = () => ok();
    img.onerror = () => bad(new Error('svg render'));
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = w * 2;
  canvas.height = hgt * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);
  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);
  return new Promise((ok) => canvas.toBlob((b) => ok(b!), 'image/png'));
}

export function renderUnduh(slot: HTMLElement, c: ExportCtx, files: string[]): void {
  const d = TXT[c.lang];
  const panel = h('section', { class: 'panel unduh', 'data-testid': 'download-menu' });
  panel.append(h('h2', {}, d.title), h('p', { class: 'muted' }, d.lead));
  const ul = h('ul', { class: 'dl-list' });
  const base = `second-sight_${slug(c.aoiLabel)}_${c.filters.series ?? ''}`;
  const item = (name: string, desc: string, testid: string, run: () => void | Promise<void>) => {
    const li = h('li', { class: 'dl-item' });
    const txt = h('div');
    const st = h('strong', {}, name);
    if (testid === 'download-csv') st.append(h('span', { class: 'dl-meta' }, d.rows(c.rows.length)));
    txt.append(st, h('p', { class: 'muted' }, desc));
    const b = h('button', { type: 'button', class: 'btn', 'data-testid': testid }, d.button);
    b.addEventListener('click', () => void run());
    li.append(txt, b);
    ul.append(li);
  };
  item(d.csv, d.csvD, 'download-csv', () => save(new Blob([buildCsv(c)], { type: 'text/csv;charset=utf-8' }), `${base}.csv`));
  item(d.svg, d.svgD, 'download-svg', () => save(new Blob([buildSvg(c).svg], { type: 'image/svg+xml' }), `${base}.svg`));
  item(d.png, d.pngD, 'download-png', async () => {
    const s = buildSvg(c);
    save(await svgToPng(s.svg, s.width, s.height), `${base}.png`);
  });
  panel.append(ul);
  panel.append(h('h3', {}, d.raw), h('p', { class: 'muted' }, d.rawD));
  const raw = h('ul', { class: 'dl-list' });
  for (const f of files) {
    const li = h('li', { class: 'dl-item' });
    const desc = f === 'index.json' ? d.index : f === 'validation_results.json' ? d.validation : f === 'demo_monthly.json' ? d.demo : d.monthly(f);
    const txt = h('div');
    const st = h('strong', {}, f);
    const meta = h('span', { class: 'dl-meta' });
    st.append(meta);
    void fetch(`${import.meta.env.BASE_URL}data/${f}`, { method: 'HEAD' }).then((res) => {
      const n = Number(res.headers.get('content-length'));
      if (res.ok && n > 0) meta.textContent = n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} kB`;
    }).catch(() => undefined);
    txt.append(st, h('p', { class: 'muted' }, desc));
    const a = h('a', { class: 'btn', href: `${import.meta.env.BASE_URL}data/${f}`, download: f, 'data-testid': 'download-raw' }, d.button);
    li.append(txt, a);
    raw.append(li);
  }
  panel.append(raw);
  panel.append(h('h3', {}, d.cite), h('p', { class: 'dl-cite', 'data-testid': 'citation' }, `${CITATION}\n${AI_NOTE}`));
  slot.replaceChildren(panel);
}
