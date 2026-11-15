// KalenderApi (new file): English / Bahasa Indonesia switch for the pages KalenderApi adds (landing, record, story,
// season, brief, method). English is the default: the event rules ask for the project link in English. The reused
// Fire Harmony pages keep their own English dictionary (lib/i18n.ts).
import { useSyncExternalStore } from 'react';

export type Lang = 'en' | 'id';

const KEY = 'ka_lang';
const listeners = new Set<() => void>();

function initial(): Lang {
  if (typeof window === 'undefined') return 'en';
  try {
    const fromHash = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('lang');
    const fromQuery = new URLSearchParams(window.location.search).get('lang');
    const asked = fromHash ?? fromQuery;
    if (asked === 'id' || asked === 'en') return asked;
    const saved = window.localStorage.getItem(KEY);
    if (saved === 'id' || saved === 'en') return saved;
  } catch {
    /* private mode: keep the default */
  }
  return 'en';
}

let current: Lang = initial();
if (typeof document !== 'undefined') document.documentElement.lang = current;

export function getLang(): Lang {
  return current;
}

export function setLang(next: Lang): void {
  if (next === current) return;
  current = next;
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    /* private mode */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The current language; the component re-renders when it changes. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, () => 'en' as Lang);
}

export type Tr = (en: string, id: string) => string;

/** `const tr = useTr()` then `tr('Fire record', 'Rekaman api')`. Both texts sit side by side so neither goes stale. */
export function useTr(): Tr {
  const lang = useLang();
  return (en, id) => (lang === 'id' ? id : en);
}

/** For code outside React (CSV headers, file names): pass the language explicitly. */
export function pick(lang: Lang, en: string, id: string): string {
  return lang === 'id' ? id : en;
}

export function locale(lang: Lang): string {
  return lang === 'id' ? 'id-ID' : 'en-GB';
}

/** Month name for month 1 to 12, e.g. "Oct" / "Okt" (short) or "October" / "Oktober" (long). */
export function monthName(month: number, lang: Lang, width: 'short' | 'long' = 'short'): string {
  return new Intl.DateTimeFormat(locale(lang), { month: width, timeZone: 'UTC' }).format(
    new Date(Date.UTC(2001, month - 1, 1)),
  );
}

/** Number with the language's separators: 1,743 in English, 1.743 in Indonesian. */
export function fmtNumber(value: number, lang: Lang, digits = 0): string {
  return new Intl.NumberFormat(locale(lang), {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}
