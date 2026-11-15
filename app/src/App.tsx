import {
  Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore,
  type CSSProperties, type ErrorInfo, type MouseEvent, type PointerEvent, type ReactNode, type RefObject,
} from 'react';
import { DICTS, FIRMS_ACKNOWLEDGEMENT, I18nContext, type I18n } from './lib/i18n.ts';
import { ToastProvider, useToast } from './components/Toast.tsx';
import { Shortcuts } from './components/Shortcuts.tsx';
import { AskButton, Assistant, setAskOpen } from './components/Assistant.tsx';
import { assistantOn } from './lib/assistant.ts';
import { Tooltip } from './components/Tooltip.tsx';
import { MOD_KEY } from './components/platform.ts';
import {
  IconBook, IconCalendar, IconChart, IconCheck, IconChevronRight, IconClose, IconCode, IconExternal, IconFlame, IconMenu, IconMoon,
  IconReport, IconSearch, IconSparkle, IconSun, IconTarget,
} from './components/icons.tsx';
import { PALETTE_EVENT, panelSearchBox, useCommand } from './lib/commands.ts';
import { LangToggle } from './components/LangToggle.tsx';
import { useTr } from './lib/lang.ts';
import { toggleTheme, useTheme } from './lib/theme.ts';
import { RESIZE_FROM, clampPanel, savedPanelWidth } from './components/explorer/panelSize.ts';

// The loading outline uses the classes of the shared building blocks (ui.css) directly: importing ui.tsx here would
// pull Observable Plot into the first download.
function Page({ children }: { children: ReactNode }) {
  return <div className="ui-page">{children}</div>;
}
function Skeleton({ height }: { height: number }) {
  return <div className="ui-skeleton" style={{ height }} aria-hidden="true" />;
}

// Pages load on demand: the explorer brings the map, the charts and the database; the text pages are small.
const Explorer = lazy(() => import('./pages/Explorer.tsx').then((m) => ({ default: m.Explorer })));
const Methods = lazy(() => import('./pages/Methods.tsx').then((m) => ({ default: m.Methods })));
const DataPage = lazy(() => import('./pages/Data.tsx').then((m) => ({ default: m.DataPage })));
const Haze = lazy(() => import('./pages/Haze.tsx').then((m) => ({ default: m.Haze })));
const Dashboard = lazy(() => import('./pages/Dashboard.tsx').then((m) => ({ default: m.Dashboard })));
const Rankings = lazy(() => import('./pages/Rankings.tsx').then((m) => ({ default: m.Rankings })));
// Project 4 (modification): the Indonesia record (Second Sight's harmonized fire cell-days and the blind zeros).
const RecordPage = lazy(() => import('./pages/Record.tsx').then((m) => ({ default: m.Record })));
// KalenderApi's own method page (#/method); Fire Harmony's '#/methods' stays at its address.
const MethodPage = lazy(() => import('./pages/Method.tsx').then((m) => ({ default: m.Method })));
// The command palette brings the place list (and the data code), so it loads the first time it is opened.
const CommandPalette = lazy(() => import('./components/CommandPalette.tsx').then((m) => ({ default: m.CommandPalette })));

type Route = 'record' | 'explorer' | 'dashboard' | 'rankings' | 'haze' | 'methods' | 'data' | 'method';

// Fire Harmony's own pages (another team's open-source project, Apache-2.0). They still open at their addresses, and
// the explorer builds its own links from '#/', but the header, the page menu and the footer link only to KalenderApi's
// pages; one footer line points to the explorer as global context.
const FH_ROUTES: ReadonlySet<Route> = new Set<Route>(['explorer', 'dashboard', 'rankings', 'haze', 'methods', 'data']);
const HREF: Record<Route, string> = { record: '#/record', explorer: '#/', dashboard: '#/dashboard', rankings: '#/rankings', haze: '#/haze', methods: '#/methods', data: '#/data', method: '#/method' };
// The cinematic Story is the first screen, and its final frame is the home ('hub=1' opens that frame without playing).
const HOME = '#/story?hub=1';
const CODE_URL = 'https://github.com/13222093/kalendarapiv4';

/** A page linked from the header, the page menu and the footer: KalenderApi's own pages, in English and Bahasa
 *  Indonesia. `route` is set for the pages inside this shell (the others have their own full-screen layout). */
interface NavItem { key: string; href: string; route?: Route; en: string; id: string; noteEn: string; noteId: string; icon: (size: number) => ReactNode }
const NAV: readonly NavItem[] = [
  { key: 'home', href: HOME, en: 'Home', id: 'Beranda',
    noteEn: 'Start here: the story, and where to go next', noteId: 'Mulai di sini: ceritanya, dan ke mana selanjutnya', icon: (s) => <IconFlame size={s} /> },
  { key: 'record', href: HREF.record, route: 'record', en: 'Indonesia record', id: 'Rekaman Indonesia',
    noteEn: 'Fire on one scale, MODIS to VIIRS, and the months cloud hid', noteId: 'Api pada satu skala, dari MODIS ke VIIRS, dan bulan yang tertutup awan', icon: (s) => <IconChart size={s} /> },
  { key: 'season', href: '#/season?y=2015', en: 'Play the season', id: 'Putar musim',
    noteEn: 'Central Kalimantan, one real day per frame', noteId: 'Kalimantan Tengah, satu hari nyata per bingkai', icon: (s) => <IconCalendar size={s} /> },
  { key: 'zero', href: '#/zero', en: 'Zero inspector', id: 'Pemeriksa nol',
    noteEn: 'Check a zero: did a satellite have a cloud-free look?', noteId: 'Periksa angka nol: apakah satelit punya pengamatan bebas awan?', icon: (s) => <IconTarget size={s} /> },
  { key: 'brief', href: '#/brief?aoi=prov-kalimantan-tengah', en: 'Brief', id: 'Ringkasan',
    noteEn: 'One printable page for a district fire officer', noteId: 'Satu halaman siap cetak untuk petugas kabupaten', icon: (s) => <IconReport size={s} /> },
  { key: 'method', href: HREF.method, route: 'method', en: 'About and method', id: 'Tentang dan metode',
    noteEn: 'Who we are, how the record is made and tested, and its limits', noteId: 'Siapa kami, cara catatan dibuat dan diuji, serta batasannya', icon: (s) => <IconBook size={s} /> },
];

// The text of the shell. T: English only (page titles, Fire Harmony's own controls, errors). L: [English, Indonesian],
// read with tr(...L.key).
const T = {
  appName: 'KalenderApi',
  appTitle: 'KalenderApi: a zero is not always a zero',
  nav: { record: 'Indonesia record', explorer: 'Global context (Fire Harmony)', dashboard: 'Dashboard', rankings: 'Rankings', haze: 'Haze', methods: 'Methods', data: 'Data', method: 'About and method' } satisfies Record<Route, string>,
  dataTo: 'Data to',
  dataTitle: (first: string, last: string, now: string | null) =>
    `Full months from ${first} to ${last}.${now ? ` ${now} is still filling in.` : ''} Open the Data page for the sources and files.`,
  dataYears: (first: number, last: number) => `Data ${first} to ${last}`,
  menu: { version: (v: string) => `Fire Harmony data version ${v}` },
  search: {
    // on the Explorer the panel has its own place search: the header's box goes to pages and actions first
    explorerText: 'Go to…',
    explorerTip: 'Go to a page, an action or a place',
    explorerLabel: (mod: string) => `Go to a page, an action or a place (${mod} K)`,
    text: 'Search places',
    tip: 'Search places, pages and actions',
    label: (mod: string) => `Search places, pages and actions (${mod} K)`,
  },
  version: (v: string, built: string) => `Fire Harmony data version ${v}, built ${built}.`,
  loading: 'Loading the page…',
  errorTitle: 'This page could not be shown',
  errorText: 'Something went wrong while loading it. Check your internet connection, then reload. The other pages still work.',
  details: 'Technical details',
  reload: 'Reload the page',
  toExplorer: 'Open the Indonesia record',
} as const;

const L = {
  skip: ['Skip to content', 'Lewati ke konten'],
  navLabel: ['Main', 'Utama'],
  menuOpen: ['Open the page menu', 'Buka menu halaman'],
  menuClose: ['Close the menu', 'Tutup menu'],
  menuTitle: ['Pages', 'Halaman'],
  tagline: [
    'Indonesia\'s fire record on one scale, from MODIS to VIIRS, with the days and months when the satellites had no cloud-free look. A zero is not always a zero.',
    'Catatan kebakaran Indonesia pada satu skala, dari MODIS ke VIIRS, dengan hari dan bulan ketika satelit tidak punya pengamatan bebas awan. Nol belum tentu nol.',
  ],
  made: ['Made for the NASA Space Apps Challenge 2026.', 'Dibuat untuk NASA Space Apps Challenge 2026.'],
  creditTitle: ['Data', 'Data'],
  credit: [
    'Fire hotspots from NASA FIRMS (MODIS Collection 6.1 and VIIRS 375 m), counted and put on one scale by us. Cloud-free looks from the NASA MODIS daily FireMask (MOD14A1, MYD14A1). Daily satellite photos from NASA GIBS. Official burned area from SIPONGI KEMENHUT. District borders from geoBoundaries (CC BY 3.0 IGO).',
    'Titik panas dari NASA FIRMS (MODIS Collection 6.1 dan VIIRS 375 m), kami hitung dan kami taruh pada satu skala. Pengamatan bebas awan dari NASA MODIS FireMask harian (MOD14A1, MYD14A1). Foto satelit harian dari NASA GIBS. Luas terbakar resmi dari SIPONGI KEMENHUT. Batas kabupaten dari geoBoundaries (CC BY 3.0 IGO).',
  ],
  linksTitle: ['Pages', 'Halaman'],
  projectTitle: ['Project', 'Proyek'],
  code: ['Code on GitHub', 'Kode di GitHub'],
  codeNote: ['The data build, the tests and this app', 'Pembangunan data, uji dan aplikasi ini'],
  newTab: ['opens in a new tab', 'terbuka di tab baru'],
  firms: [
    FIRMS_ACKNOWLEDGEMENT,
    'Kami berterima kasih atas penggunaan data dari Fire Information for Resource Management System (FIRMS) milik NASA, bagian dari Earth Science Data and Information System (ESDIS) NASA.',
  ],
  globalLead: ['Global context: ', 'Konteks global: '],
  globalLink: ['Fire Harmony\'s explorer', 'penjelajah Fire Harmony'],
  globalTail: [', another team\'s open-source project (Apache-2.0), on a different scale.', ', proyek sumber terbuka tim lain (Apache-2.0), dengan skala yang berbeda.'],
} as const satisfies Record<string, readonly [string, string]>;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthLong = (ym: number) => `${MONTHS[(ym % 100) - 1] ?? ''} ${Math.floor(ym / 100)}`;
const monthShort = (ym: number) => `${(MONTHS[(ym % 100) - 1] ?? '').slice(0, 3)} ${Math.floor(ym / 100)}`;
/** yyyymm plus n months. */
function addMonths(ym: number, n: number): number {
  const t = Math.floor(ym / 100) * 12 + (ym % 100) - 1 + n;
  return Math.floor(t / 12) * 100 + (t % 12) + 1;
}

/** '#/methods' -> 'methods'; anything unknown (or empty) is the explorer. (A first visit with no hash at all is sent to
 *  '#/record' by index.html.) */
function routeOf(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split(/[/?]/)[0] ?? '';
  return path === 'record' || path === 'method' || path === 'methods' || path === 'data' || path === 'haze' || path === 'dashboard' || path === 'rankings' ? path : 'explorer';
}

function subscribeHash(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

function readHash(): string {
  return window.location.hash;
}

// The cinematic story is outside the shared app shell. (The old landing page, '#/home', now goes to the Story's final
// frame: see HomeRedirect.)
const Story = lazy(() => import('./pages/Story.tsx').then((m) => ({ default: m.Story })));
// KalenderApi (modification): '#/season' plays Central Kalimantan, Aug to Oct 2019, one real day per frame.
const Season = lazy(() => import('./pages/Season.tsx').then((m) => ({ default: m.Season })));
// The printable brief (#/brief?aoi=<aoi_id>): one A4 page, with no header or menu.
const BriefPage = lazy(() => import('./pages/Brief.tsx').then((m) => ({ default: m.Brief })));
// The Zero inspector (#/zero) and the district calendar (#/calendar): full-screen pages of their own.
const ZeroPage = lazy(() => import('./pages/Zero.tsx').then((m) => ({ default: m.Zero })));
const DistrictCalendarPage = lazy(() => import('./pages/DistrictCalendar.tsx').then((m) => ({ default: m.DistrictCalendar })));
/** Project 4: the season year of '#/season?y=2015' (or of the day in '#/season?d=2023-09-01'); 2019 by default. */
function seasonYearOf(hash: string): number {
  const q = new URLSearchParams(hash.split('?')[1] ?? '');
  const y = Number(q.get('y') ?? q.get('d')?.slice(0, 4));
  return Number.isInteger(y) && y >= 2012 && y <= 2030 ? y : 2019;
}

export function App() {
  const hash = useSyncExternalStore(subscribeHash, readHash);
  if (hash === '#/home' || hash.startsWith('#/home?')) return <HomeRedirect />;
  if (hash === '#/story' || hash.startsWith('#/story?')) {
    return (
      <Suspense fallback={<div className="ka-story" />}>
        <Story />
      </Suspense>
    );
  }
  if (hash === '#/zero' || hash.startsWith('#/zero?')) {
    return (
      <Suspense fallback={<div className="ka-story" aria-hidden="true" />}>
        <ZeroPage />
      </Suspense>
    );
  }
  if (hash === '#/calendar' || hash.startsWith('#/calendar?')) {
    return (
      <Suspense fallback={<div className="ka-story" aria-hidden="true" />}>
        <DistrictCalendarPage />
      </Suspense>
    );
  }
  if (hash === '#/brief' || hash.startsWith('#/brief?')) {
    return (
      <Suspense fallback={null}>
        <BriefPage />
      </Suspense>
    );
  }
  if (hash === '#/season' || hash.startsWith('#/season?')) {
    // project 4: one season per year (#/season?y=2015); a new year mounts a new page with its own files
    const year = seasonYearOf(hash);
    return (
      <Suspense fallback={<div className="ka-story" />}>
        <Season key={year} year={year} />
      </Suspense>
    );
  }
  return <Shell />;
}

/** Old '#/home' links: the address is replaced by the Story's final frame (no new history entry), which the hash
 *  listener then mounts. */
function HomeRedirect() {
  useEffect(() => { window.location.replace(HOME); }, []);
  return <div className="ka-story" aria-hidden="true" />;
}

function Shell() {
  const route = routeOf(useSyncExternalStore(subscribeHash, readHash));
  const i18n = useMemo<I18n>(() => ({ lang: 'en', t: DICTS.en, setLang: () => undefined }), []);
  const tr = useTr();
  // Fire Harmony's months and data version: only its own pages show them
  const shell = useShellData(FH_ROUTES.has(route));

  // Once opened, the explorer stays mounted (hidden on other pages) so the map and the choices survive.
  const [explorerOpened, setExplorerOpened] = useState(route === 'explorer');
  if (route === 'explorer' && !explorerOpened) setExplorerOpened(true);

  const mainRef = useRef<HTMLElement>(null);
  usePageEffects(route, mainRef);

  const skipToMain = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault(); // a plain '#main' link would change the route
    mainRef.current?.focus();
  };

  return (
    <I18nContext value={i18n}>
      <ToastProvider>
      <GlobalKeys />
      <PaletteHost />
      <Shortcuts />
      <div className="fh-app">
        <a className="fh-skip" href="#main" onClick={skipToMain}>{tr(...L.skip)}</a>
        <Header route={route} shell={shell} />
        {assistantOn() ? <Assistant /> : null}
        <main id="main" ref={mainRef} className="fh-main" tabIndex={-1}>
          {/* .fh-route: each page fades in and rises 6 px when it opens (theme.css); the explorer replays it when it is
              shown again, since an element shown after display: none starts its animation anew */}
          {explorerOpened ? (
            <div className="fh-route" hidden={route !== 'explorer'}>
              <PageBoundary>
                <Suspense fallback={<ExplorerLoading />}>
                  <Explorer />
                </Suspense>
              </PageBoundary>
            </div>
          ) : null}
          {route !== 'explorer' ? (
            <div className="fh-route" key={route}>
              {route === 'record' ? (
                <PageBoundary key="record">
                  <Suspense fallback={<PageLoading />}>
                    <RecordPage />
                  </Suspense>
                </PageBoundary>
              ) : null}
              {route === 'method' ? (
                <PageBoundary key="method">
                  <Suspense fallback={<PageLoading />}>
                    <MethodPage />
                  </Suspense>
                </PageBoundary>
              ) : null}
              {route === 'dashboard' ? (
                <PageBoundary key="dashboard">
                  <Suspense fallback={<PageLoading />}>
                    <Dashboard />
                  </Suspense>
                </PageBoundary>
              ) : null}
              {route === 'rankings' ? (
                <PageBoundary key="rankings">
                  <Suspense fallback={<PageLoading />}>
                    <Rankings />
                  </Suspense>
                </PageBoundary>
              ) : null}
              {route === 'haze' ? (
                <PageBoundary key="haze">
                  <Suspense fallback={<PageLoading />}>
                    <Haze />
                  </Suspense>
                </PageBoundary>
              ) : null}
              {route === 'methods' ? (
                <PageBoundary key="methods">
                  <Suspense fallback={<PageLoading />}>
                    <Methods />
                  </Suspense>
                </PageBoundary>
              ) : null}
              {route === 'data' ? (
                <PageBoundary key="data">
                  <Suspense fallback={<PageLoading />}>
                    <DataPage />
                  </Suspense>
                </PageBoundary>
              ) : null}
            </div>
          ) : null}
        </main>
        <Footer route={route} shell={shell} />
      </div>
      </ToastProvider>
    </I18nContext>
  );
}

/** Loads the command palette: at idle time after the first view (so the first Ctrl+K opens at once), or the first time
 *  someone asks for it (Ctrl or Cmd+K, "/", the search button: PALETTE_EVENT). Keys typed while its code still loads
 *  go into its search box (Escape cancels the opening), never to the page's shortcuts. */
function PaletteHost() {
  const [loaded, setLoaded] = useState(false);
  const typed = useRef<string | null>(null);   // what was typed while the code loads; null: no opening waits
  const handed = useRef(false);                // the palette has shown up and taken over its keys
  useEffect(() => {
    const load = () => { void import('./components/CommandPalette.tsx').catch(() => undefined); };
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(load, { timeout: 8000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(load, 5000);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => {
    if (loaded) return undefined;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      const modK = (e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey) && !e.altKey;
      const slash = e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey && !document.querySelector('[aria-modal="true"], dialog[open]');
      if (slash && panelSearchBox()) { e.preventDefault(); panelSearchBox()?.focus(); return; }   // the Explorer's own search
      if (modK || slash) { e.preventDefault(); typed.current = ''; setLoaded(true); }
    };
    const onOpen = (e: Event) => { typed.current = (e as CustomEvent<{ query?: string } | null>).detail?.query ?? ''; setLoaded(true); };
    window.addEventListener('keydown', onKey);
    window.addEventListener(PALETTE_EVENT, onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener(PALETTE_EVENT, onOpen); };
  }, [loaded]);
  useEffect(() => {
    if (!loaded) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (handed.current || e.isComposing) return;
      const modK = (e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey) && !e.altKey;
      if (typed.current === null) {
        if (!modK) return;
        typed.current = '';                       // opened again while the code still loads
      } else if (modK || e.key === 'Escape') typed.current = null;
      else if (e.key === 'Backspace') typed.current = typed.current.slice(0, -1);
      else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) typed.current += e.key;
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [loaded]);
  const take = useCallback(() => { const t = typed.current; typed.current = null; handed.current = true; return t; }, []);
  if (!loaded) return null;
  return <Suspense fallback={null}><CommandPalette initialOpen takeTyped={take} /></Suspense>;
}

/** Shortcuts that work on every page: T switches the theme (not while a dialog is open). The theme command also comes
 *  from the palette. */
function GlobalKeys() {
  const toast = useToast();
  const flip = () => { toggleTheme(); toast(`Switched to ${document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'} mode`, 'info'); };
  useCommand((c) => { if (c.action === 'toggle-theme') flip(); });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if (e.defaultPrevented || typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[aria-modal="true"], dialog[open]')) return;
      if (e.key === 't' || e.key === 'T') flip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return null;
}

/** Page title, and focus on the new page after a route change (not on first load). */
function usePageEffects(route: Route, mainRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    document.title = route === 'explorer' ? T.appTitle : `${T.nav[route]} · ${T.appName}`;
  }, [route]);

  const shownRoute = useRef(route);
  useEffect(() => {
    if (shownRoute.current === route) return;
    shownRoute.current = route;
    window.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
  }, [route, mainRef]);
}

// ------------------------------------------------------------------------------------------------ shell data

interface ShellData {
  firstFull: number | null;   // yyyymm of the first full month
  lastFull: number | null;    // yyyymm of the latest full month
  current: number | null;     // yyyymm of a month that is still filling in, if any
  firstYear: number | null; lastYear: number | null;
  version: string | null; built: string | null;
}

const EMPTY: ShellData = { firstFull: null, lastFull: null, current: null, firstYear: null, lastYear: null, version: null, built: null };

/** The months covered (dashboard.json, else meta.json) and the data version (meta.json), for the header and footer.
 *  data.ts is imported on demand so the database code stays out of the first download. */
function useShellData(enabled: boolean): ShellData {
  const [data, setData] = useState<ShellData>(EMPTY);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    void import('./lib/data.ts').then(async ({ loadDashboard, loadMeta }) => {
      const [meta, dash] = await Promise.allSettled([loadMeta(), loadDashboard()]);
      if (!alive) return;
      const next: ShellData = { ...EMPTY };
      if (meta.status === 'fulfilled') {
        const m = meta.value;
        next.firstYear = Math.floor(m.first_month / 100);
        next.lastYear = Math.floor(m.last_month / 100);
        next.version = m.version;
        const built = new Date(m.built_utc);
        next.built = Number.isNaN(built.getTime()) ? null
          : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(built);
      }
      if (dash.status === 'fulfilled') {
        const r = dash.value.record;
        next.lastFull = r.latest_full_month;
        next.firstFull = addMonths(r.latest_full_month, -(r.months - 1));
        next.current = r.last_month > r.latest_full_month ? r.last_month : null;
        next.firstYear ??= Math.floor(r.first_month / 100);
        next.lastYear ??= Math.floor(r.last_month / 100);
      }
      setData(next);
    }).catch(() => undefined);   // the badge and the version line are extras: the pages report their own errors
    return () => { alive = false; };
  }, [enabled]);
  return data;
}

// ------------------------------------------------------------------------------------------------ header

function Header({ route, shell }: { route: Route; shell: ShellData }) {
  const tr = useTr();
  const header = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 2);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useHeaderAutoHide(header, menuOpen);
  const onMap = route === 'explorer';
  // Fire Harmony's own controls (its place search and its data badge) show on its own pages only
  const fh = FH_ROUTES.has(route);
  const searchLabel = onMap ? T.search.explorerLabel(MOD_KEY) : T.search.label(MOD_KEY);
  return (
    <header ref={header} className="fh-header" data-scrolled={scrolled ? '' : undefined}>
      <div className="fh-header-inner">
        {/* On phones and tablets the open page is named under the brand (the page's own title says it to screen
            readers, so this line is hidden from them; it is not part of the link, which opens the home page). */}
        <div className="fh-brand-wrap">
          <a className="fh-brand" href={HOME}>
            <BrandMark />
            <span className="fh-brand-name">{T.appName}</span>
          </a>
          <span key={route} className="fh-brand-page" aria-hidden="true">{pageName(route, tr)}</span>
        </div>
        <nav className="fh-nav" aria-label={tr(...L.navLabel)}>
          <ul>
            {NAV.map((p) => (
              <li key={p.key}>
                <a href={p.href} aria-current={p.route !== undefined && p.route === route ? 'page' : undefined}>
                  <span className="fh-nav-icon">{p.icon(16)}</span>
                  <span className="fh-nav-label" data-label={tr(p.en, p.id)}>{tr(p.en, p.id)}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="fh-header-tools">
          {fh ? (
            <Tooltip content={onMap ? T.search.explorerTip : T.search.tip} keys={[MOD_KEY, 'K']} describe={false}>
              <button type="button" className="fh-search-trigger ui-press" onClick={() => window.dispatchEvent(new Event('fh:open-palette'))}
                aria-label={searchLabel} aria-keyshortcuts="Control+K Meta+K">
                <IconSearch size={16} />
                <span className="fh-search-trigger-text">{onMap ? T.search.explorerText : T.search.text}</span>
                <span className="fh-search-trigger-keys" aria-hidden="true"><kbd className="ui-kbd">{MOD_KEY}</kbd><kbd className="ui-kbd">K</kbd></span>
              </button>
            </Tooltip>
          ) : null}
          {assistantOn() ? <AskButton /> : null}
          {fh ? <DataBadge shell={shell} /> : null}
          <LangToggle />
          <ThemeButton />
          <Tooltip content={tr(...L.menuOpen)} describe={false}>
            <button type="button" className="ui-btn ui-btn-ghost ui-btn-icon fh-menu-btn" aria-label={tr(...L.menuOpen)} aria-haspopup="dialog"
              aria-expanded={menuOpen} aria-controls="fh-menu" onClick={() => setMenuOpen(true)}>
              <IconMenu size={20} />
            </button>
          </Tooltip>
        </div>
      </div>
      <PageMenu open={menuOpen} route={route} shell={shell} onClosed={() => setMenuOpen(false)} />
    </header>
  );
}

/** The name of the open page: KalenderApi's pages in the reader's language, Fire Harmony's in English. */
function pageName(route: Route, tr: (en: string, id: string) => string): string {
  const own = NAV.find((p) => p.route === route);
  return own ? tr(own.en, own.id) : T.nav[route];
}

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const SCROLL_KEYS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ']);

/** On phones and tablets the header slides away while you read down the page, and comes back as soon as you scroll
 *  up, reach the top, or move the keyboard focus into it. Never under reduced motion, or while the menu is open.
 *  Only the reader's own scrolling moves it (a finger, a wheel or the scroll keys): a scroll that the page starts
 *  itself, such as a jump to a section, leaves the header as it was, so the offset the page measured for the jump
 *  stays right and the section title never ends up under the bars.
 *  The state is html[data-header-hidden] (CSS moves the header; the sticky bars under it follow once stuck). */
function useHeaderAutoHide(header: RefObject<HTMLElement | null>, locked: boolean): void {
  useEffect(() => {
    const root = document.documentElement;
    const small = window.matchMedia('(max-width: 880px)');
    let hidden = root.dataset.headerHidden !== undefined;
    let last = window.scrollY, travel = 0, raf = 0, instant = 0;
    let byReader = 0;   // until this time, the scroll is the reader's (it is extended while the page keeps moving)
    const reader = () => { byReader = performance.now() + 500; };
    const notReader = () => { byReader = 0; };
    const set = (h: boolean) => {
      if (h === hidden) return;
      hidden = h;
      if (h) root.dataset.headerHidden = ''; else delete root.dataset.headerHidden;
    };
    const focusInside = () => !!header.current?.contains(document.activeElement);
    const update = () => {
      raf = 0;
      const y = Math.max(0, window.scrollY);
      const dy = y - last;
      last = y;
      if (!small.matches || reduceMotion() || locked || y < 64 || focusInside()) { travel = 0; set(false); return; }
      if (performance.now() >= byReader) { travel = 0; return; }   // the page scrolled itself: keep the header as it is
      // a few pixels of travel in one direction first, so a jittery finger does not make it flicker
      travel = Math.sign(dy) === Math.sign(travel) ? travel + dy : dy;
      if (travel > 12) set(true);
      else if (travel < -6) set(false);
    };
    const onScroll = () => {
      if (performance.now() < byReader) reader();   // the glide after the finger lifts is still the reader's
      if (!raf) raf = requestAnimationFrame(update);
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target instanceof Element ? e.target : null;
      const own = t?.closest('input, textarea, select, [contenteditable="true"], [role="slider"], [role="listbox"], [role="grid"]')
        || (e.key === ' ' && t?.closest('button, a, summary, [role="button"], [role="tab"]'));
      if (SCROLL_KEYS.has(e.key) && !own && !e.altKey && !e.ctrlKey && !e.metaKey) reader(); else notReader();
    };
    // a new window width (a phone turned): show it at once, so the bars under it measure it in place. A new height
    // alone is the browser's own toolbar sliding away as the reader scrolls: that changes nothing here.
    let width = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      root.dataset.headerInstant = '';
      set(false);
      window.clearTimeout(instant);
      instant = window.setTimeout(() => { delete root.dataset.headerInstant; }, 300);
    };
    const onFocus = () => { if (hidden && focusInside()) set(false); };
    const opts = { passive: true, capture: true } as const;
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('wheel', reader, opts);
    window.addEventListener('touchmove', reader, opts);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', notReader, true);   // a tap or click starts no scroll of the reader's own
    document.addEventListener('focusin', onFocus);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(instant);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('wheel', reader, opts);
      window.removeEventListener('touchmove', reader, opts);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', notReader, true);
      document.removeEventListener('focusin', onFocus);
    };
  }, [header, locked]);
}

/** The page menu of phones and tablets: a sheet from the bottom on a phone (drag it down, tap outside or press
 *  Escape to close), a panel under the menu button on a tablet. A native modal dialog, so focus stays inside. */
function PageMenu({ open, route, shell, onClosed }: { open: boolean; route: Route; shell: ShellData; onClosed: () => void }) {
  const tr = useTr();
  const fh = FH_ROUTES.has(route);
  const dlg = useRef<HTMLDialogElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; dy: number; id: number } | null>(null);

  const close = useCallback(() => {
    const d = dlg.current;
    if (!d?.open || d.dataset.closing !== undefined) return;
    if (reduceMotion()) { d.close(); return; }
    d.dataset.closing = '';
    window.setTimeout(() => { delete d.dataset.closing; d.close(); if (sheet.current) sheet.current.style.transform = ''; }, 150);
  }, []);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>('a[aria-current="page"]')?.focus();
    } else if (!open && d.open) close();
  }, [open, close]);

  // a wider window has the page links in the header: the menu closes
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 881px)');
    const onChange = () => { if (wide.matches) close(); };
    wide.addEventListener('change', onChange);
    return () => wide.removeEventListener('change', onChange);
  }, [close]);

  // drag the sheet down by its top bar to close it (phones)
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!window.matchMedia('(max-width: 560px)').matches || (e.target as HTMLElement).closest('button')) return;
    drag.current = { y: e.clientY, t: performance.now(), dy: 0, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current, s = sheet.current;
    if (!d || !s || e.pointerId !== d.id) return;
    d.dy = Math.max(0, e.clientY - d.y);
    s.style.transition = 'none';
    s.style.transform = `translateY(${d.dy}px)`;
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current, s = sheet.current;
    drag.current = null;
    if (!d || !s || e.pointerId !== d.id) return;
    const speed = d.dy / Math.max(1, performance.now() - d.t);
    if (d.dy > 72 || (d.dy > 16 && speed > 0.5)) { close(); return; }
    s.style.transition = 'transform var(--t-med) var(--ease-out)';
    s.style.transform = '';
  };

  return (
    <dialog ref={dlg} id="fh-menu" className="fh-menu" aria-labelledby="fh-menu-title" onClose={onClosed}
      onCancel={(e) => { e.preventDefault(); close(); }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div ref={sheet} className="fh-menu-sheet">
        <div className="fh-menu-drag" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <span className="fh-menu-grip" aria-hidden="true" />
          <div className="fh-menu-head">
            <p className="fh-menu-title" id="fh-menu-title">{tr(...L.menuTitle)}</p>
            <button type="button" className="ui-btn ui-btn-ghost ui-btn-icon" aria-label={tr(...L.menuClose)} onClick={close}>
              <IconClose size={20} />
            </button>
          </div>
        </div>
        <nav aria-label={tr(...L.navLabel)}>
          <ul className="fh-menu-list">
            {NAV.map((p, i) => {
              const on = p.route !== undefined && p.route === route;
              return (
                <li key={p.key}>
                  <a href={p.href} aria-current={on ? 'page' : undefined} onClick={close} style={{ '--i': i } as CSSProperties}>
                    <span className="fh-menu-icon" aria-hidden="true">{p.icon(20)}</span>
                    <span className="fh-menu-text">
                      <span className="fh-menu-name">{tr(p.en, p.id)}</span>
                      <span className="fh-menu-note">{tr(p.noteEn, p.noteId)}</span>
                    </span>
                    <span className="fh-menu-end" aria-hidden="true">{on ? <IconCheck size={18} /> : <IconChevronRight size={18} />}</span>
                  </a>
                </li>
              );
            })}
            {assistantOn() ? (
              <li className="fh-menu-ask">
                <a href="#ask" role="button" onClick={(e) => { e.preventDefault(); close(); setAskOpen(true); }} style={{ '--i': NAV.length } as CSSProperties}>
                  <span className="fh-menu-icon" aria-hidden="true"><IconSparkle size={18} /></span>
                  <span className="fh-menu-text">
                    <span className="fh-menu-name">Ask KalenderApi</span>
                    <span className="fh-menu-note">Questions about any place, answered from the data (AI)</span>
                  </span>
                  <span className="fh-menu-end" aria-hidden="true"><IconChevronRight size={18} /></span>
                </a>
              </li>
            ) : null}
          </ul>
        </nav>
        <nav aria-labelledby="fh-menu-project">
          <p className="fh-menu-group" id="fh-menu-project">{tr(...L.projectTitle)}</p>
          <ul className="fh-menu-list fh-menu-project">
            <li>
              <a href={CODE_URL} target="_blank" rel="noopener" onClick={close} style={{ '--i': NAV.length + 1 } as CSSProperties}
                aria-label={`${tr(...L.code)} (${tr(...L.newTab)})`}>
                <span className="fh-menu-icon" aria-hidden="true"><IconCode size={20} /></span>
                <span className="fh-menu-text">
                  <span className="fh-menu-name">{tr(...L.code)}</span>
                  <span className="fh-menu-note">{tr(...L.codeNote)}</span>
                </span>
                <span className="fh-menu-end" aria-hidden="true"><IconExternal size={16} /></span>
              </a>
            </li>
          </ul>
        </nav>
        {fh ? (
          <div className="fh-menu-foot">
            <DataBadge shell={shell} tip={false} />
            {shell.version ? <span>{T.menu.version(shell.version)}</span> : null}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}

function ThemeButton() {
  const theme = useTheme();
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <Tooltip content={label} keys={['T']}>
      <button type="button" className="ui-btn ui-btn-ghost ui-btn-icon fh-theme-btn" aria-label={label} aria-keyshortcuts="T" onClick={() => toggleTheme()}>
        {theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
      </button>
    </Tooltip>
  );
}

function DataBadge({ shell, tip = true }: { shell: ShellData; tip?: boolean }) {
  const { firstFull, lastFull, current, firstYear, lastYear } = shell;
  if (lastFull !== null && firstFull !== null) {
    const badge = (
      <a className="fh-data-badge" href={HREF.data}>
        <CalendarIcon />
        <span>{T.dataTo} <time dateTime={`${Math.floor(lastFull / 100)}-${String(lastFull % 100).padStart(2, '0')}`}>{monthShort(lastFull)}</time></span>
      </a>
    );
    return tip ? <Tooltip content={T.dataTitle(monthLong(firstFull), monthLong(lastFull), current ? monthLong(current) : null)}>{badge}</Tooltip> : badge;
  }
  if (firstYear !== null && lastYear !== null) {
    return <a className="fh-data-badge" href={HREF.data}><CalendarIcon /><span>{T.dataYears(firstYear, lastYear)}</span></a>;
  }
  return <span className="fh-data-badge fh-data-badge-empty" aria-hidden="true" />;
}

function CalendarIcon() {
  return (
    <svg className="fh-data-badge-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
      <rect x="2.25" y="3.25" width="11.5" height="10.5" rx="2" />
      <path d="M2.5 6.75h11M5.5 1.75v3M10.5 1.75v3" strokeLinecap="round" />
    </svg>
  );
}

function BrandMark() {
  return (
    <svg className="fh-brand-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path className="fh-mark-hex" d="M16 1.5 28.6 8.75v14.5L16 30.5 3.4 23.25V8.75z" />
      <path
        className="fh-mark-flame"
        d="M16 7c1.5 3.5 5.5 5.8 5.5 10.6a5.5 5.5 0 0 1-11 0c0-2.4 1.2-4 2.5-5.2.1 1.7.9 2.9 2.1 3.4C14.6 12.8 15 9.8 16 7z"
      />
    </svg>
  );
}

// ------------------------------------------------------------------------------------------------ footer

function Footer({ route, shell }: { route: Route; shell: ShellData }) {
  const tr = useTr();
  return (
    <footer className="fh-footer">
      <div className="fh-footer-inner">
        <div className="fh-footer-brand">
          <a className="fh-brand" href={HOME}>
            <BrandMark />
            <span className="fh-brand-name">{T.appName}</span>
          </a>
          <p>{tr(...L.tagline)}</p>
          <p>{tr(...L.made)}</p>
        </div>
        <div className="fh-footer-col">
          <p className="fh-footer-title">{tr(...L.creditTitle)}</p>
          <p>{tr(...L.credit)}</p>
        </div>
        <nav className="fh-footer-col" aria-label={tr(...L.linksTitle)}>
          <p className="fh-footer-title">{tr(...L.linksTitle)}</p>
          <ul className="fh-footer-links">
            {NAV.map((p) => (
              <li key={p.key}><a href={p.href}>{tr(p.en, p.id)}</a><span>{tr(p.noteEn, p.noteId)}</span></li>
            ))}
          </ul>
        </nav>
        <nav className="fh-footer-col" aria-label={tr(...L.projectTitle)}>
          <p className="fh-footer-title">{tr(...L.projectTitle)}</p>
          <ul className="fh-footer-links fh-footer-project">
            <li>
              <a href={CODE_URL} target="_blank" rel="noopener" aria-label={`${tr(...L.code)} (${tr(...L.newTab)})`}>
                {tr(...L.code)}<IconExternal size={13} className="fh-footer-ext" />
              </a>
              <span>{tr(...L.codeNote)}</span>
            </li>
          </ul>
        </nav>
        <div className="fh-footer-base">
          <p>{tr(...L.firms)}</p>
          {/* the only link to Fire Harmony's explorer: named as another team's project, on its own scale */}
          <p>{tr(...L.globalLead)}<a href={HREF.explorer}>{tr(...L.globalLink)}</a>{tr(...L.globalTail)}</p>
          {FH_ROUTES.has(route) && shell.version && shell.built ? <p>{T.version(shell.version, shell.built)}</p> : null}
        </div>
      </div>
    </footer>
  );
}

// ------------------------------------------------------------------------------------------------ loading and errors

/** A quiet outline of a page while its code loads (same layout as the pages, so nothing jumps). */
function PageLoading() {
  return (
    <Page>
      <div className="fh-page-loading" role="status">
        <span className="sr-only">{T.loading}</span>
        <div className="fh-page-loading-head" aria-hidden="true">
          <div style={{ width: 96 }}><Skeleton height={12} /></div>
          <div style={{ width: 'min(520px, 80%)' }}><Skeleton height={30} /></div>
          <div style={{ width: 'min(720px, 100%)' }}><Skeleton height={16} /></div>
        </div>
        <div className="fh-page-loading-grid" aria-hidden="true">
          <Skeleton height={112} /><Skeleton height={112} /><Skeleton height={112} />
        </div>
        <div aria-hidden="true"><Skeleton height={300} /></div>
      </div>
    </Page>
  );
}

/** The Explorer's outline while its code loads, in its own layout (styles in app.css, since explorer.css comes with that
 *  code): the map's ground, the area panel at its inset and width with the parts it will show, and the timeline dock
 *  at the bottom; on a phone the bottom sheet at its half height. No site footer meanwhile (the map is the page). */
function ExplorerLoading() {
  // (the width the reader gave the panel, explorer/panelSize.ts: the outline has it too, so nothing jumps on load)
  const saved = window.innerWidth >= RESIZE_FROM ? savedPanelWidth() : null;
  const style = saved === null ? undefined : ({ ['--panel-w' as string]: `${clampPanel(saved)}px` } as CSSProperties);
  return (
    <div className="fh-ex-boot" role="status" aria-busy="true" style={style}>
      <span className="sr-only">{T.loading}</span>
      <div className="fh-ex-boot-panel" aria-hidden="true">
        <div className="fh-ex-boot-row"><Skeleton height={44} /><div style={{ width: 86 }}><Skeleton height={44} /></div></div>
        <div className="fh-ex-boot-chips"><Skeleton height={32} /><Skeleton height={32} /><Skeleton height={32} /></div>
        <div className="fh-ex-boot-line" />
        <div style={{ width: 120 }}><Skeleton height={12} /></div>
        <div style={{ width: '70%' }}><Skeleton height={24} /></div>
        <Skeleton height={74} />
        <div className="fh-ex-boot-chips"><Skeleton height={28} /><Skeleton height={28} /><Skeleton height={28} /><Skeleton height={28} /></div>
        <Skeleton height={190} />
      </div>
      <div className="fh-ex-boot-dock" aria-hidden="true"><div style={{ width: 44 }}><Skeleton height={44} /></div><Skeleton height={44} /></div>
    </div>
  );
}

function PageError({ message }: { message: string }) {
  return (
    <Page>
      <div className="fh-error fh-page-error" role="alert">
        <svg className="fh-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9.5" />
          <path d="M12 7v6M12 16.5v.5" />
        </svg>
        <div className="fh-error-body">
          <p className="fh-error-title">{T.errorTitle}</p>
          <p>{T.errorText}</p>
          <details>
            <summary>{T.details}</summary>
            <code>{message}</code>
          </details>
          <div className="fh-page-error-actions">
            <button type="button" className="fh-btn" onClick={() => window.location.reload()}>{T.reload}</button>
            <a className="fh-btn fh-btn-quiet" href={HREF.record}>{T.toExplorer}</a>
          </div>
        </div>
      </div>
    </Page>
  );
}

interface BoundaryProps { children: ReactNode }
interface BoundaryState { message: string | null }

/** Keeps the header and the other pages alive if a page fails to load or render. */
class PageBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { message: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('Fire Harmony: a page failed', error, info.componentStack);
  }

  override render(): ReactNode {
    return this.state.message === null ? this.props.children : <PageError message={this.state.message} />;
  }
}
