import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/source-sans-3';
import './styles/tokens.css';
import './styles/app.css';

const TOKENS = ['--bg', '--surface', '--ink', '--ink-2', '--hairline', '--accent-ui', '--zero', '--unobserved', '--el-nino', '--current-year', '--neutral-mid'];
const SIZES = [13, 15, 18, 24, 32];
type RGB = [number, number, number];

function rgb(css: string): RGB {
  const probe = document.createElement('span');
  probe.style.color = css;
  document.body.append(probe);
  const m = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g) ?? ['0', '0', '0'];
  probe.remove();
  return [Number(m[0]), Number(m[1]), Number(m[2])];
}
function lum([r, g, b]: RGB): number {
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a: string, b: string): number {
  const x = lum(rgb(a));
  const y = lum(rgb(b));
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const hex = (c: RGB) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');

function cell(label: string, fill: string, extra = ''): string {
  return `<figure style="margin:0;text-align:center">
    <svg width="40" height="40" viewBox="0 0 40 40"><rect class="cal-fill" x="4" y="4" width="32" height="32" rx="3" fill="${fill}"/>${extra}</svg>
    <figcaption class="muted" style="font-size:var(--fs-13)">${label}</figcaption></figure>`;
}

function typeBlock(font: string, label: string): string {
  const rows = SIZES.map((s) => `<div style="font-family:var(${font});font-size:var(--fs-${s})">${s}px Titik panas Sebangau</div>`).join('');
  return `<div class="panel"><h3 style="margin:0 0 8px;font:600 var(--fs-13) var(--font-body);color:var(--ink-2)">${label}</h3>${rows}
    <div style="font-family:var(${font});font-variant-numeric:tabular-nums;margin-top:8px">1.234.567<br>0.987.654<br>2015-09 · 41,2%</div></div>`;
}

function render(): void {
  const cs = getComputedStyle(document.documentElement);
  const bg = cs.getPropertyValue('--bg').trim();
  const swatches = TOKENS.map((tk) => {
    const v = cs.getPropertyValue(tk).trim();
    return `<div class="panel" style="display:flex;gap:12px;align-items:center;padding:8px">
      <span style="width:40px;height:40px;flex:none;border-radius:4px;border:1px solid var(--hairline);background:var(${tk})"></span>
      <span><code>${tk}</code><br><span class="muted" style="font-variant-numeric:tabular-nums">${hex(rgb(v))} · ${contrast(v, bg).toFixed(2)}:1 vs --bg</span></span></div>`;
  }).join('');
  const h2 = 'font:600 var(--fs-18) var(--font-head)';
  const el = document.getElementById('sg')!;
  el.innerHTML = `<main style="max-width:1100px;margin:0 auto;padding:var(--gutter);display:grid;gap:24px">
    <header style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <h1 style="margin:0;font:700 var(--fs-24) var(--font-head)">Second Sight styleguide</h1>
      <div class="seg" id="theme"><button data-t="">Sistem</button><button data-t="light">Terang</button><button data-t="dark">Gelap</button></div>
    </header>
    <section><h2 style="${h2}">Warna</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px">${swatches}</div></section>
    <section><h2 style="${h2}">Tipografi</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:8px">${typeBlock('--font-head', 'Plus Jakarta Sans')}${typeBlock('--font-body', 'Source Sans 3')}</div></section>
    <section><h2 style="${h2}">Sel kalender</h2><div class="panel" style="display:flex;gap:20px;flex-wrap:wrap">
      ${cell('nol', 'var(--zero)')}
      ${cell('ada titik', '#d9622b')}
      ${cell('tak teramati', 'var(--unobserved)')}
      ${cell('NRT', '#f0a35e', '<rect class="cal-nrt" x="4" y="4" width="32" height="32" rx="3"/>')}
      ${cell('masa depan', 'none', '<rect class="cal-future" x="4" y="4" width="32" height="32" rx="3" fill="none"/>')}
      ${cell('terpilih', '#d9622b', '<rect class="cal-sel" x="3" y="3" width="34" height="34" rx="4"/>')}
    </div></section>
    <section><h2 style="${h2}">Kontrol</h2><div class="panel" style="display:grid;gap:16px">
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn">Tombol</button><button class="btn-primary">Tombol utama</button></div>
      <div class="seg"><button aria-pressed="true">Jumlah</button><button aria-pressed="false">Rasio</button></div>
      <nav class="tabs" role="tablist"><button class="tab" role="tab" aria-selected="true">Awal</button><button class="tab" role="tab" aria-selected="false">Bulan</button><button class="tab" role="tab" aria-selected="false">Yakin</button></nav>
      <div style="display:flex;gap:16px;flex-wrap:wrap"><span class="badge">badge</span><span class="st-pass">pass</span><span class="st-fail">fail</span><span class="st-not_run">not run</span></div>
    </div></section>
  </main>`;
  const cur = document.documentElement.dataset.theme ?? '';
  el.querySelectorAll<HTMLButtonElement>('#theme button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.t === cur));
    b.onclick = () => {
      if (b.dataset.t) document.documentElement.dataset.theme = b.dataset.t;
      else delete document.documentElement.dataset.theme;
      render();
    };
  });
}

Object.assign(document.body.style, { background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font-body)', margin: '0' });
render();
