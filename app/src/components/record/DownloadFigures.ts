// KalenderApi (new file): the record's figures as stand-alone SVG, for the PNG downloads. The calendar on the page is a
// grid of buttons, not a drawing, so its picture is drawn here from the same rows with the same rules (lib/record.ts:
// one log scale for Raw and Harmonized, the 2012 seam, hatching only for a computed observability class). The colours
// are read from the theme tokens when the file is made, so the picture matches the theme on screen.
import type { Lang } from '../../lib/lang';
import {
  SEAM_YEAR, cellValue, emberStep, fmtCompact, inRange, isProvisional, monthsIn, obsState, ym,
  type MonthRange, type MonthRow, type Series,
} from '../../lib/record';

export interface CalendarPalette {
  steps: string[];        // index 0 = no fire, 1 to 9 = the ember ramp
  ink: string[];          // text colour on each step
  text: string; text2: string; text3: string; surface: string; border: string; accent: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The years x months calendar as an SVG string. Months outside `range` are faded when a range is picked. */
export function calendarSvg(rows: MonthRow[], series: Series, range: MonthRange | null, computed: Set<string> | null, c: CalendarPalette, lang: Lang = 'en'):
{ svg: string; width: number; height: number } {
  const id = lang === 'id';
  const yearW = 44, cw = 46, ch = 20, gap = 2, totW = 62, headH = 20, seamH = 18, legendH = 34;
  const byKey = new Map(rows.map((r) => [ym(r.year, r.month), r]));
  const y0 = rows[0]?.year ?? 0, y1 = rows[rows.length - 1]?.year ?? 0;
  const max = Math.max(0, ...rows.map((r) => Math.max(r.H ?? 0, cellValue(r, 'raw') ?? 0)));
  const width = yearW + 12 * (cw + gap) + totW;
  const out: string[] = [];
  const text = (x: number, y: number, s: string, fill: string, anchor = 'start', size = 11, extra = '') =>
    `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" text-anchor="${anchor}"${extra}>${esc(s)}</text>`;
  monthsIn(lang, 'short').forEach((m, i) => out.push(text(yearW + i * (cw + gap) + cw / 2, 13, m, c.text3, 'middle')));
  out.push(text(width - 2, 13, 'Total', c.text3, 'end'));
  let y = headH;
  for (let yr = y0; yr <= y1; yr++) {
    if (yr === SEAM_YEAR && yr > y0) {
      out.push(text(yearW, y + 11, id ? '2012: VIIRS MENYUSUL MODIS' : '2012: VIIRS JOINS MODIS', c.text3, 'start', 9, ' letter-spacing="0.6"'));
      out.push(`<line x1="${yearW}" x2="${width}" y1="${y + seamH - 3}" y2="${y + seamH - 3}" stroke="${c.border}" stroke-width="1"/>`);
      y += seamH;
    }
    out.push(text(0, y + 14, String(yr), c.text3));
    let sum = 0, any = false, prov = false;
    for (let m = 1; m <= 12; m++) {
      const key = ym(yr, m), r = byKey.get(key);
      if (!r) continue;
      const x = yearW + (m - 1) * (cw + gap);
      const v = cellValue(r, series);
      const dim = range && !inRange(key, range) ? ' opacity="0.28"' : '';
      if (isProvisional(r)) prov = true;
      if (v == null) {
        out.push(`<g${dim}><rect x="${x + 0.5}" y="${y + 0.5}" width="${cw - 1}" height="${ch - 1}" rx="3" fill="none" stroke="${c.border}"/>${text(x + cw / 2, y + 14, '–', c.text3, 'middle')}</g>`);
        continue;
      }
      sum += v; any = true;
      const step = emberStep(v, max), obs = obsState(r, computed);
      const marks = [
        `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="3" fill="${c.steps[step]}"/>`,
        obs === 'partial' || obs === 'unobserved' ? `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="3" fill="url(#hatch-${obs})"/>` : '',
        isProvisional(r) ? `<rect x="${x + 0.75}" y="${y + 0.75}" width="${cw - 1.5}" height="${ch - 1.5}" rx="2.5" fill="none" stroke="${c.text}" stroke-opacity="0.45" stroke-width="1.5"/>` : '',
        text(x + cw / 2, y + 14, fmtCompact(v, lang), c.ink[step]!, 'middle'),
        obs === 'good' ? `<circle cx="${x + cw - 5}" cy="${y + 5}" r="2.5" fill="${c.accent}" stroke="${c.surface}"/>` : '',
      ];
      out.push(`<g${dim}>${marks.join('')}</g>`);
    }
    out.push(text(width - 2, y + 14, any ? `${fmtCompact(sum, lang)}${prov ? '*' : ''}` : '–', c.text2, 'end'));
    y += ch + gap;
  }
  // the key: the ramp, and what a faded month means
  y += 12;
  const x0 = id ? 78 : 40;
  out.push(text(0, y + 10, id ? 'Lebih sedikit' : 'Fewer', c.text2));
  for (let s = 1; s <= 9; s++) out.push(`<rect x="${x0 + (s - 1) * 15}" y="${y}" width="14" height="12" fill="${c.steps[s]}"/>`);
  out.push(text(x0 + 9 * 15 + 6, y + 10, id
    ? `lebih banyak sel-hari api (skala log)${range ? '. Pudar: di luar rentang yang dipilih' : ''}. * total sejauh ini`
    : `more fire cell-days (log scale)${range ? '. Faded: outside the picked range' : ''}. * total so far`, c.text2));
  const height = y + legendH - 12;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif">`
    + `<defs><pattern id="hatch-partial" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1" height="5" fill="${c.text}" fill-opacity="0.55"/></pattern>`
    + `<pattern id="hatch-unobserved" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.2" height="5" fill="${c.text}" fill-opacity="0.85"/></pattern></defs>`
    + `${out.join('')}</svg>`;
  return { svg, width, height };
}
