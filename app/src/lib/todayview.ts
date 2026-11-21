// KalenderApi (new file): the two views of "Today in my district" and which address opens which.
// 'classic' is the page of pages/Now.tsx; 'console' is the three-panel command view of pages/CommandConsole.tsx.
// Both read the same data through one hook (useNowModel in pages/Now.tsx). This file imports nothing, so App.tsx can
// read it without pulling the page's code into the first download.

export type TodayView = 'classic' | 'console';

/** The view '#/now' opens. Since 21 November 2026 it is the command view; the classic page stays at
 *  '#/now?view=classic', and '#/command' opens the command view either way. Set this one value back to 'classic' to
 *  make the classic page the default again. */
export const TODAY_DEFAULT_VIEW = 'console' as TodayView;

const enc = encodeURIComponent;

/** The view an address asks for, or null when it is not an address of the Today page. */
export function todayViewOf(hash: string): TodayView | null {
  const [path, query] = hash.split('?');
  if (path === '#/command') return 'console';
  if (path !== '#/now') return null;
  const asked = new URLSearchParams(query ?? '').get('view');
  return asked === 'classic' || asked === 'console' ? asked : TODAY_DEFAULT_VIEW;
}

/** The classic page of a district. */
export const classicHref = (aoiId: string): string =>
  (TODAY_DEFAULT_VIEW === 'classic' ? `#/now?aoi=${enc(aoiId)}` : `#/now?view=classic&aoi=${enc(aoiId)}`);

/** The command view of a district. */
export const consoleHref = (aoiId: string): string => `#/command?aoi=${enc(aoiId)}`;

/** The two papers of a district, drawn from the same data as the Today page (pages/FieldReport.tsx): the daily report
 *  and the draft field check plan. Address: '#/report?aoi=<district aoi_id>&doc=daily|plan'. */
export type ReportDoc = 'daily' | 'plan';
export const reportHref = (aoiId: string, doc: ReportDoc = 'daily'): string => `#/report?aoi=${enc(aoiId)}&doc=${doc}`;
/** The paper an address asks for ('daily' unless it names the plan), or null when it is not an address of that page. */
export function reportDocOf(hash: string): ReportDoc | null {
  const [path, query] = hash.split('?');
  if (path !== '#/report') return null;
  return new URLSearchParams(query ?? '').get('doc') === 'plan' ? 'plan' : 'daily';
}
