import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/source-sans-3';
import './styles/tokens.css';
import './styles/app.css';
import { tinykeys } from 'tinykeys';
import { TABS, type Tab, type Lang, setLang, t, isLang } from './i18n';
import { createMap, type MapHandle } from './map';
import { AOIS, type AoiId, isAoiId, presetById, customFromParams, customToParams, ringBounds, type CustomAoi, type Bounds, CUSTOM_ID } from './aoi';
import { renderBulan } from './bulan';
import { renderYakin, loadValidation } from './yakin';
import { renderUnduh } from './unduh';
import { renderBeforeAfter } from './beforeafter';
import { renderAoiPanel, attachMap, showOutline } from './aoipanel';
import { readHash, writeHash } from './url';
import { loadMonthly, type LoadedDoc as MonthlyDoc } from './data';
import { countColor } from './scale';
import { createCalendar, summarize, type CalendarHandle, type Mode, type Series } from './calendar';
import { fmtInt, fmtPct } from './i18n';

interface State {
  tab: Tab;
  lang: Lang;
  aoi: AoiId;
  month: string; // YYYY-MM, selected cell
  mode: Mode;
  series: Series;
  custom: CustomAoi | null;
}

const DEFAULTS: State = { tab: 'awal', lang: 'id', aoi: 'khg-sebangau', month: '2015-09', mode: 'count', series: 'harm', custom: null };
const MODES: Mode[] = ['count', 'ratio'];
const SERIES: Series[] = ['raw', 'sensor', 'harm'];

function stateFromHash(): State {
  const { view, params } = readHash(DEFAULTS.tab);
  return {
    tab: (TABS as readonly string[]).includes(view) ? (view as Tab) : DEFAULTS.tab,
    lang: isLang(params.lang) ? params.lang : DEFAULTS.lang,
    aoi: isAoiId(params.aoi) && (params.aoi !== CUSTOM_ID || customFromParams(params)) ? params.aoi : DEFAULTS.aoi,
    month: /^\d{4}-(0[1-9]|1[0-2])$/.test(params.m ?? '') ? params.m : DEFAULTS.month,
    mode: MODES.includes(params.mode as Mode) ? (params.mode as Mode) : DEFAULTS.mode,
    series: SERIES.includes(params.s as Series) ? (params.s as Series) : DEFAULTS.series,
    custom: params.aoi === CUSTOM_ID ? customFromParams(params) : null,
  };
}

function stateToHash(s: State): void {
  writeHash(s.tab, { aoi: s.aoi, ...customToParams(s.aoi === CUSTOM_ID ? s.custom : null), m: s.month, mode: s.mode, s: s.series, lang: s.lang });
}

const state: State = stateFromHash();

const root = document.getElementById('app')!;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  return node;
}

// Static skeleton, built once so the map survives re-renders.
const headerSlot = el('div');
const layout = el('div', { class: 'layout' });
const aside = el('aside', { class: 'aside' });
const regionSlot = el('section', { class: 'panel' });
const mapBox = el('div', { class: 'map', role: 'region', 'aria-label': 'Peta' });
const mapNote = el('p', { class: 'muted' });
const mainSlot = el('main', { class: 'main' });
aside.append(regionSlot, mapBox, mapNote);
layout.append(aside, mainSlot);
root.append(headerSlot, layout);

let mapHandle: MapHandle | null = null;

function renderHeader(): void {
  const d = t();
  const header = el('header', { class: 'top' });
  const row = el('div', { class: 'top-row' });
  row.append(el('span', { class: 'brand' }, d.appName));
  const nav = el('nav', { class: 'tabs', role: 'tablist', 'aria-label': d.appName });
  for (const tab of NAV_TABS) {
    const b = el('button', { class: 'tab', role: 'tab', 'aria-selected': String(tab === state.tab), 'data-tab': tab }, d.tabs[tab]);
    b.addEventListener('click', () => update({ tab }));
    nav.append(b);
  }
  row.append(nav);
  const lang = el('div', { class: 'lang', role: 'group', 'aria-label': 'Bahasa / Language' });
  for (const l of ['id', 'en'] as const) {
    const b = el('button', { 'aria-pressed': String(l === state.lang) }, l.toUpperCase());
    b.addEventListener('click', () => update({ lang: l }));
    lang.append(b);
  }
  row.append(lang);
  const fresh = monthly && !monthly.meta.synthetic
    ? (state.lang === 'id' ? `Data NASA FIRMS sampai ${monthly.meta.last_month ?? '-'}, versi ${(monthly.meta.data_version ?? '').slice(0, 8)}` : `NASA FIRMS data through ${monthly.meta.last_month ?? '-'}, version ${(monthly.meta.data_version ?? '').slice(0, 8)}`)
    : d.freshness;
  header.append(row, el('div', { class: 'fresh', 'data-testid': 'freshness' }, `${fresh} · ${d.snpp}`));
  headerSlot.replaceChildren(header);
}

function aoiBounds(): Bounds {
  if (state.aoi === CUSTOM_ID && state.custom) return ringBounds(state.custom.ring);
  return (presetById(state.aoi) ?? presetById('indonesia')!).bounds;
}

function aoiLabel(): string {
  if (state.aoi === CUSTOM_ID) return state.lang === 'id' ? 'Area pilihan sendiri' : 'Custom area';
  return (presetById(state.aoi) ?? presetById('indonesia')!).name[state.lang];
}

// The AOI whose monthly rows are shown: the selected preset if it has rows, else the smallest
// preset containing the selection centre that has rows, else Indonesia.
// Unfinished screens (Peta, Lab, Metode) stay reachable by URL but are hidden from the top nav.
const HIDDEN_TABS: readonly Tab[] = ['peta', 'lab', 'metode'];
const NAV_TABS = TABS.filter((x) => !HIDDEN_TABS.includes(x));

// Story presets map to their province AOI from the pipeline bundle (data/index.json).
const STORY_TO_PROV: Record<string, string> = {
  kalteng: 'prov-kalimantan-tengah',
  'khg-sebangau': 'prov-kalimantan-tengah',
  'riau-kampar': 'prov-riau',
  'sumsel-oki': 'prov-sumatera-selatan',
  'jambi-berbak': 'prov-jambi',
  'kalbar-ketapang': 'prov-kalimantan-barat',
};
const PROV_NAME_EN: Record<string, string> = { 'prov-kalimantan-tengah': 'Central Kalimantan', 'prov-kalimantan-barat': 'West Kalimantan', 'prov-sumatera-selatan': 'South Sumatra', 'prov-riau': 'Riau', 'prov-jambi': 'Jambi' };
function areaName(id: AoiId): string {
  if (id === state.aoi) return aoiLabel();
  const p = presetById(id);
  if (p) return p.name[state.lang];
  if (id.startsWith('prov-')) {
    if (state.lang === 'en' && PROV_NAME_EN[id]) return PROV_NAME_EN[id];
    return id.slice(5).split('-').map((w) => (w === 'dki' ? 'DKI' : w[0].toUpperCase() + w.slice(1))).join(' ');
  }
  return id;
}
function areaNote(shown: AoiId): string | undefined {
  if (shown === state.aoi || (state.aoi === 'kalteng' && shown === 'prov-kalimantan-tengah')) return undefined;
  if (state.aoi === 'khg-sebangau' && shown === 'prov-kalimantan-tengah') return state.lang === 'id' ? 'Batas KHG belum tersedia; memakai provinsi Kalimantan Tengah.' : 'KHG boundary not yet available; using Central Kalimantan province.';
  if (STORY_TO_PROV[state.aoi] === shown) return state.lang === 'id' ? `Batas area cerita belum tersedia; memakai provinsi ${areaName(shown)}.` : `Story-area boundary not yet available; using ${areaName(shown)} province.`;
  return state.lang === 'id' ? `Data untuk area ini belum tersedia; menampilkan ${areaName(shown)}.` : `Data for this area is not available yet; showing ${areaName(shown)}.`;
}

function dataAoi(doc: MonthlyDoc): AoiId {
  const has = new Set(doc.rows.map((r) => r.aoi_id));
  if (state.aoi !== CUSTOM_ID && has.has(state.aoi)) return state.aoi;
  const prov = STORY_TO_PROV[state.aoi];
  if (prov && has.has(prov)) return prov;
  const b = aoiBounds();
  const cx = (b[0][0] + b[1][0]) / 2;
  const cy = (b[0][1] + b[1][1]) / 2;
  const size = (a: Bounds) => (a[1][0] - a[0][0]) * (a[1][1] - a[0][1]);
  const hit = AOIS.filter((a) => has.has(a.id) && a.bounds[0][0] <= cx && cx <= a.bounds[1][0] && a.bounds[0][1] <= cy && cy <= a.bounds[1][1]).sort((x, y) => size(x.bounds) - size(y.bounds))[0];
  return hit?.id ?? (has.has('indonesia') ? 'indonesia' : doc.rows[0]?.aoi_id ?? 'indonesia');
}

function renderRegion(): void {
  const d = t();
  renderAoiPanel(regionSlot, {
    lang: state.lang,
    aoi: state.aoi,
    custom: state.custom,
    onPreset: (id) => update({ aoi: id, custom: null }),
    onCustom: (c) => update({ aoi: CUSTOM_ID, custom: c }),
  }, (b) => mapHandle?.fitTo(b));
  mapNote.textContent = d.mapNote;
}

let monthly: MonthlyDoc | null = null;
let dataError: string | null = null;
loadMonthly()
  .then((doc) => {
    monthly = doc;
    render();
  })
  .catch((e: unknown) => {
    dataError = String(e);
    render();
  });

interface CalView {
  key: string;
  root: HTMLElement;
  cal: CalendarHandle;
  buttons: { el: HTMLButtonElement; field: 'mode' | 'series'; value: string }[];
  note: HTMLElement;
}
let calView: CalView | null = null;

function segGroup(label: string, field: 'mode' | 'series', items: [string, string][], view: CalView['buttons']): HTMLElement {
  const wrap = el('div');
  wrap.append(el('span', { class: 'ctl-label' }, label));
  const seg = el('div', { class: 'seg', role: 'group', 'aria-label': label });
  for (const [value, text] of items) {
    const b = el('button', { type: 'button' }, text);
    b.addEventListener('click', () => update({ [field]: value } as Partial<State>));
    view.push({ el: b, field, value });
    seg.append(b);
  }
  wrap.append(seg);
  return wrap;
}

// Finding-style calendar title from the shown AOI's own rows: usual peak month + worst year.
function calFinding(rows: MonthlyDoc['rows'], area: string, worstYear: string): string {
  const byMonth = new Array(12).fill(0);
  for (const r of rows) if (r.year <= 2025) byMonth[r.month - 1] += r.H ?? 0;
  const peak = byMonth.indexOf(Math.max(...byMonth));
  const first = Math.min(...rows.map((r) => r.year));
  const mName = new Intl.DateTimeFormat(state.lang === 'id' ? 'id-ID' : 'en-GB', { month: 'long' }).format(new Date(2001, peak, 1));
  return state.lang === 'id' ? `${area}: ${mName} biasanya puncak; ${worstYear} tertinggi sejak ${first}.` : `${area}: ${mName} is usually the peak; ${worstYear} is the highest since ${first}.`;
}

function legendItem(svg: string, text: string): HTMLElement {
  const li = el('li');
  li.innerHTML = `<svg width="22" height="14" aria-hidden="true">${svg}</svg>`;
  li.append(document.createTextNode(text));
  return li;
}

function calOpts() {
  return {
    mode: state.mode,
    series: state.series,
    selected: state.month,
    aoiName: aoiLabel(),
    onSelect: (m: string) => update({ month: m }),
  };
}

function buildCalView(doc: MonthlyDoc): CalView {
  const d = t();
  const shown = dataAoi(doc);
  const rows = doc.rows.filter((r) => r.aoi_id === shown);
  const sum = summarize(rows);
  const root = el('section', { class: 'panel cal-panel' });
  const h = el('h2', {}, aoiLabel());
  if (doc.meta.synthetic) h.append(el('span', { class: 'badge', title: d.demoNote }, d.demoBadge));
  root.append(h);
  root.append(el('p', { class: 'cal-headline', 'data-testid': 'cal-finding' }, calFinding(rows, areaName(shown), String(sum.worstYear))));
  root.append(el('p', { class: 'muted' }, `${d.unit}. ${doc.meta.synthetic ? d.demoNote : ''}`));
  const buttons: CalView['buttons'] = [];
  const controls = el('div', { class: 'controls' });
  controls.append(
    segGroup(d.modeLabel, 'mode', [['count', d.modeCount], ['ratio', d.modeRatio]], buttons),
    segGroup(d.seriesLabel, 'series', [['raw', d.seriesRaw], ['sensor', d.seriesSensor], ['harm', d.seriesHarm]], buttons),
  );
  root.append(controls);
  const note = el('p', { class: 'series-note', 'aria-live': 'polite' });
  root.append(note);
  const cal = createCalendar(rows, calOpts());
  root.append(cal.root);
  const legend = el('ul', { class: 'cal-legend' });
  legend.append(
    legendItem(`<defs><linearGradient id="lg-ramp">${[0, 0.25, 0.5, 0.75, 1].map((s) => `<stop offset="${s}" stop-color="${countColor(Math.expm1(s * Math.log1p(1000)), 1000)}"/>`).join('')}</linearGradient></defs><rect x="1" y="1" width="20" height="12" rx="2" fill="url(#lg-ramp)"/>`, d.stateActive),
    legendItem('<rect x="1" y="1" width="20" height="12" rx="2" fill="#ECEFF2"/>', d.stateZero),
    legendItem('<defs><pattern id="lg-p" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#1B1F24" stroke-opacity=".45"/></pattern></defs><rect x="1" y="1" width="20" height="12" rx="2" fill="#f57d15"/><rect x="1" y="1" width="20" height="12" rx="2" fill="url(#lg-p)"/>', d.statePartial),
    legendItem('<defs><pattern id="lg-u" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#F6F7F8"/><line x1="0" y1="0" x2="0" y2="5" stroke="#9AA4AF" stroke-width="2.5"/></pattern></defs><rect x="1" y="1" width="20" height="12" rx="2" fill="url(#lg-u)"/>', d.stateUnobserved),
    legendItem('<rect x="1.5" y="1.5" width="19" height="11" rx="2" fill="#fac228" stroke="#1B1F24" stroke-dasharray="3 2"/>', d.stateProvisional),
    legendItem('<rect x="1" y="1" width="20" height="12" rx="3" fill="none" stroke="#1B1F24" stroke-width="1.5"/>', d.stateAnomaly),
  );
  root.append(legend);
  root.append(el('p', { class: 'muted' }, `${d.arrivals}. ${d.agreeBadge}.`));
  root.append(el('p', { class: 'cal-foot' }, d.observedSentence(fmtInt(sum.ok), fmtInt(sum.all), fmtPct(sum.ok / Math.max(1, sum.all)))));
  root.append(el('p', { class: 'muted' }, `${d.source(doc.meta.synthetic ? d.demoBadge + ' (Second Sight)' : 'NASA FIRMS')} · ${d.disclaimer} · ${d.shortcuts}`));
  if (shown !== state.aoi) root.insertBefore(el('p', { class: 'muted', 'data-testid': 'aoi-fallback-note' }, areaNote(shown) ?? ''), root.children[2] ?? null);
  return { key: aoiKey(), root, cal, buttons, note };
}

function aoiKey(): string {
  return `${state.lang}|${state.aoi}|${JSON.stringify(state.custom?.ring ?? null)}`;
}

function renderMain(): void {
  const d = t();
  if (state.tab === 'kalender' || state.tab === 'peta') {
    if (!monthly) {
      const p = el('section', { class: 'panel' });
      p.append(el('p', { class: 'muted' }, dataError ?? '…'));
      mainSlot.replaceChildren(p);
      return;
    }
    const key = aoiKey();
    if (!calView || calView.key !== key) calView = buildCalView(monthly);
    else calView.cal.update(calOpts());
    for (const b of calView.buttons) b.el.setAttribute('aria-pressed', String(state[b.field] === b.value));
    calView.note.textContent = t().seriesNote[state.series];
    if (mainSlot.firstChild !== calView.root || mainSlot.childNodes.length !== 1) mainSlot.replaceChildren(calView.root);
    return;
  }
  if (state.tab === 'bulan' && monthly) {
    const doc = monthly;
    const shown = dataAoi(doc);
    renderBulan(mainSlot, doc.rows.filter((r) => r.aoi_id === shown), {
      lang: state.lang,
      month: state.month,
      title: areaName(shown),
      demo: !!doc.meta.synthetic,
      rerender: () => renderMain(),
    });
    return;
  }
  if (state.tab === 'awal' && monthly) {
    const doc = monthly;
    const shown = dataAoi(doc);
    renderBeforeAfter(mainSlot, doc.rows.filter((r) => r.aoi_id === shown), { lang: state.lang, area: areaName(shown), note: areaNote(shown), demo: !!doc.meta.synthetic, validation: loadValidation() });
    return;
  }
  if (state.tab === 'unduh' && monthly) {
    const doc = monthly;
    const shown = dataAoi(doc);
    const rows = doc.rows.filter((r) => r.aoi_id === shown);
    const lang = state.lang;
    loadValidation().then((v) => {
      if (state.tab !== 'unduh' || state.lang !== lang) return;
      const files = doc.index?.aois ? ['index.json', ...doc.index.aois.map((a) => a.file)] : ['demo_monthly.json'];
      if (v) files.push('validation_results.json');
      renderUnduh(mainSlot, {
        lang,
        doc,
        rows,
        aoiLabel: aoiLabel(),
        dataAoi: shown,
        filters: { aoi: state.aoi, ...Object.fromEntries(Object.entries(customToParams(state.aoi === CUSTOM_ID ? state.custom : null)).filter((e): e is [string, string] => e[1] != null)), series: state.series, mode: state.mode, month: state.month },
        makeCalendar: () => createCalendar(rows, calOpts()),
      }, files);
    });
    return;
  }
  if (state.tab === 'yakin') {
    const lang = state.lang;
    loadValidation().then((v) => {
      if (state.tab === 'yakin' && state.lang === lang) renderYakin(mainSlot, v, lang);
    });
    return;
  }
  const panel = el('section', { class: 'panel' });
  panel.append(el('h2', {}, d.tabs[state.tab]), el('p', { class: 'muted' }, d.comingSoon));
  mainSlot.replaceChildren(panel);
}

function render(): void {
  setLang(state.lang);
  document.body.dataset.tab = state.tab;
  renderHeader();
  renderRegion();
  renderMain();
  mapHandle?.resize();
}

function update(patch: Partial<State>): void {
  const aoiChanged = (patch.aoi != null && patch.aoi !== state.aoi) || patch.custom !== undefined;
  Object.assign(state, patch);
  stateToHash(state);
  render();
  if (aoiChanged && mapHandle) {
    mapHandle.fitTo(aoiBounds());
    showOutline(state.aoi === CUSTOM_ID && state.custom ? state.custom.ring : null);
  }
}

window.addEventListener('hashchange', () => {
  const next = stateFromHash();
  if (JSON.stringify(next) !== JSON.stringify(state)) update(next);
});

const cycle = <T,>(list: T[], v: T): T => list[(list.indexOf(v) + 1) % list.length];
const keyMap: Record<string, (e: KeyboardEvent) => void> = {
  l: () => update({ lang: state.lang === 'id' ? 'en' : 'id' }),
  m: () => update({ mode: cycle(MODES, state.mode) }),
  r: () => update({ series: cycle(SERIES, state.series) }),
};
NAV_TABS.forEach((tab, i) => {
  keyMap[String(i + 1)] = () => update({ tab });
});
tinykeys(window, keyMap);

stateToHash(state);
render();
mapHandle = createMap(mapBox, state.lang);
attachMap(mapHandle.map);
if (state.aoi !== 'indonesia') mapHandle.map.once('load', () => mapHandle?.fitTo(aoiBounds()));
if (state.aoi === CUSTOM_ID && state.custom) showOutline(state.custom.ring);
