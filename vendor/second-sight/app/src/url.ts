// Adapted from squadronzero/project-shift web/src/lib/url.js (Apache License 2.0). Changes: ported to TS. Modified by Second Sight, Nov 2026.
// See THIRD_PARTY_LICENSES/project-shift-LICENSE.
//
// The page address keeps the view (tab), area, month, colour mode, series and language,
// so a shared link opens the same view.
// Example: #kalender?aoi=khg-sebangau&m=2015-09&mode=count&s=harm&lang=id

export interface HashState {
  view: string;
  params: Record<string, string>;
}

export function readHash(defaultView = 'kalender'): HashState {
  const h = location.hash.slice(1);
  const [view, q = ''] = h.split('?');
  return { view: view || defaultView, params: Object.fromEntries(new URLSearchParams(q)) };
}

export function writeHash(view: string, params: Record<string, string | null | undefined> = {}): void {
  const entries = Object.entries(params).filter((e): e is [string, string] => e[1] != null && e[1] !== '');
  const q = new URLSearchParams(entries).toString();
  const next = `#${view}${q ? `?${q}` : ''}`;
  if (location.hash !== next) history.replaceState(null, '', next);
}
