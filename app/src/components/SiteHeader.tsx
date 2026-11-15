// KalenderApi (new file): the one top bar of the pages that stand outside the app shell (Today in my district, the
// district calendar). The same mark, the same menu (lib/home.ts HOME_MENU) and the same language switch as the home
// sections (pages/Home.tsx) and the shell's header (App.tsx), so every page opens the same way. The Story, the season
// player and the zero inspector are full-screen views of a map and keep their own small bar.
import { HOME_HREF, HOME_MENU } from '../lib/home';
import { useTr } from '../lib/lang';
import { LangToggle } from './LangToggle';
import '../styles/siteheader.css';

/** `current`: the key of the menu entry this page is (lib/home.ts HOME_MENU), when it is one of them. */
export function SiteHeader({ current }: { current?: string }) {
  const tr = useTr();
  return (
    <header className="ka-site-top">
      <a className="ka-site-brand" href={HOME_HREF} aria-label="KalenderApi">
        <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
          <path className="ka-site-mark-hex" d="M16 1.5 28.6 8.75v14.5L16 30.5 3.4 23.25V8.75z" />
          <path className="ka-site-mark-flame" d="M16 7c1.5 3.5 5.5 5.8 5.5 10.6a5.5 5.5 0 0 1-11 0c0-2.4 1.2-4 2.5-5.2.1 1.7.9 2.9 2.1 3.4C14.6 12.8 15 9.8 16 7z" />
        </svg>
        <span>KalenderApi</span>
      </a>
      <nav className="ka-site-nav" aria-label={tr('Main', 'Utama')}>
        <ul>
          {HOME_MENU.map((p) => (
            <li key={p.key}><a href={p.href} aria-current={p.key === current ? 'page' : undefined}>{tr(p.en, p.id)}</a></li>
          ))}
        </ul>
      </nav>
      <div className="ka-site-tools"><LangToggle /></div>
    </header>
  );
}
