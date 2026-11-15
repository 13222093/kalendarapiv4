import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/app.css';
import './styles/ui.css';
import './styles/theme.css';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/public-sans';
import '@fontsource-variable/geist-mono';
import './styles/brand.css';
import { App } from './App.tsx';
import { initTheme } from './lib/theme';
import { getDb } from './lib/db';
import { prefetchFirstView } from './lib/web';

initTheme();

// KalenderApi: a tab left open across a new release still names the old release's files. When a page's code is asked
// for and is gone, load the new release instead of leaving an empty page. At most once a minute, so a file that is
// really missing cannot make the page reload for ever.
const STALE = /dynamically imported module|Importing a module script failed|Unable to preload CSS|Loading chunk/i;
const loadNewRelease = () => {
  try {
    const last = Number(sessionStorage.getItem('ka_reloaded_at') ?? 0);
    if (Date.now() - last < 60000) return;
    sessionStorage.setItem('ka_reloaded_at', String(Date.now()));
  } catch { /* storage is off: reload anyway */ }
  window.location.reload();
};
window.addEventListener('vite:preloadError', loadNewRelease);
window.addEventListener('error', (e) => { if (STALE.test(e.message ?? '')) loadNewRelease(); });
window.addEventListener('unhandledrejection', (e) => { if (STALE.test(String((e.reason as Error | undefined)?.message ?? e.reason))) loadNewRelease(); });

// The Explorer's first view (the series of the place and the level 3 map) comes from small JSON files and needs no
// database: start reading them now, before the Explorer's code has arrived.
const hash = window.location.hash;
const onExplorer = !hash || hash === '#/' || hash.startsWith('#/?');
if (onExplorer) prefetchFirstView(hash);

// The data engine (an 8 MB download, then a few hundred ms of set up) is for drawn areas, a clicked hexagon's series,
// place names under the pointer, the zoomed in map and the hotspot download: start it once the first view is under
// way, when the browser is idle.
const startEngine = () => { void getDb().catch(() => undefined); };
if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(startEngine, { timeout: onExplorer ? 2500 : 8000 });
else setTimeout(startEngine, onExplorer ? 1500 : 3000);   // Safari before 18 has no requestIdleCallback

const root = document.getElementById('root');
if (!root) throw new Error('Fire Harmony: the #root element is missing from index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
