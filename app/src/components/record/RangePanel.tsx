// KalenderApi (new file): "Pick a period" on the Indonesia record page. From month and To month (the record is monthly),
// kept in the address (from=YYYY-MM&to=YYYY-MM). For the picked range: the harmonized total with its 90% range (the sum
// of the monthly bounds, as the page does for years), the raw total, and "the same months in every year" (the total of
// those calendar months in each year, the picked period's rank among them, the median and the ratio to it). Every
// number is a sum of the monthly record (lib/record.ts rangeTotals, sameMonths); nothing is modelled here.
// Texts are in English and Bahasa Indonesia, side by side (lib/lang.ts).
import { useMemo } from 'react';
import * as Plot from '@observablehq/plot';
import { PlotFigure, StatGrid, StatTile, cssVar } from '../ui';
import { useLang, useTr, type Lang, type Tr } from '../../lib/lang';
import {
  fmtCompact, fmtInt, fmt1, monthName, monthsIn, rangeLabel, rangeMonths, ym,
  type MonthRange, type RangeTotals, type SameMonths, type SamePeriod,
} from '../../lib/record';

const ordinal = (n: number, lang: Lang) => (lang === 'id' ? `ke-${n}`
  : `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`);
const times = (x: number, lang: Lang) => (x >= 10 ? fmtInt(x, lang) : x >= 0.1 ? fmt1(x, lang) : lang === 'id' ? x.toFixed(2).replace('.', ',') : x.toFixed(2));
/** "August to October", "November to February", "September": the calendar months of a range, without the year. */
export function monthsLabel(r: MonthRange, lang: Lang = 'en'): string {
  const names = monthsIn(lang);
  const a = names[Number(r.from.slice(5, 7)) - 1]!, b = names[Number(r.to.slice(5, 7)) - 1]!;
  if (rangeMonths(r) === 12) return lang === 'id' ? `12 bulan sejak ${a}` : `the 12 months from ${a}`;
  return a === b ? a : `${a} ${lang === 'id' ? 'sampai' : 'to'} ${b}`;
}

function MonthPick({ label, value, first, last, onChange }: {
  label: string; value: string; first: string; last: string; onChange: (key: string) => void;
}) {
  const tr = useTr();
  const lang = useLang();
  const y = Number(value.slice(0, 4)), m = Number(value.slice(5, 7));
  const y0 = Number(first.slice(0, 4)), y1 = Number(last.slice(0, 4));
  const set = (yy: number, mm: number) => { const k = ym(yy, mm); onChange(k < first ? first : k > last ? last : k); };
  return (
    <fieldset className="ka-rec-mpick">
      <legend>{label}</legend>
      <select aria-label={tr(`${label}: month`, `${label}: bulan`)} value={m} onChange={(e) => set(y, Number(e.target.value))}>
        {monthsIn(lang).map((n, i) => {
          const k = ym(y, i + 1);
          return <option key={n} value={i + 1} disabled={k < first || k > last}>{n}</option>;
        })}
      </select>
      <select aria-label={tr(`${label}: year`, `${label}: tahun`)} value={y} onChange={(e) => set(Number(e.target.value), m)}>
        {Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i).map((yy) => <option key={yy} value={yy}>{yy}</option>)}
      </select>
    </fieldset>
  );
}

export function RangePanel({ area, first, last, range, onRange, totals, same, held, selected, source }: {
  area: string;
  first: string; last: string;             // the record's first and last month
  range: MonthRange | null;                // null = the whole record
  onRange: (r: MonthRange | null) => void;
  totals: RangeTotals;                     // of the range shown (the whole record when none is picked)
  same: SameMonths | null;                 // null when the range is longer than 12 months
  held: boolean;                           // the range falls on months a registered test covers: no rank, no ratio
  selected: string | null;                 // the month picked in the calendar, for the quick picks
  source: string;
}) {
  const tr = useTr();
  const lang = useLang();
  const eff = range ?? { from: first, to: last };
  const n = rangeMonths(eff);
  const label = rangeLabel(eff, lang);
  const clamp = (r: MonthRange): MonthRange => ({ from: r.from < first ? first : r.from, to: r.to > last ? last : r.to });
  const selY = selected ? selected.slice(0, 4) : null;
  const quick: { label: string; r: MonthRange }[] = selected && selY ? [
    { label: monthName(selected, lang), r: { from: selected, to: selected } },
    { label: rangeLabel({ from: `${selY}-08`, to: `${selY}-10` }, lang), r: { from: `${selY}-08`, to: `${selY}-10` } },
    { label: tr(`All of ${selY}`, `Sepanjang ${selY}`), r: { from: `${selY}-01`, to: `${selY}-12` } },
  ].filter((q) => q.r.to >= first && q.r.from <= last) : [];

  const missing = n - totals.withH - totals.held.length;
  const names = (keys: string[]) => keys.map((k) => monthName(k, lang)).join(', ');
  const prov = totals.provisional;
  const provSpan = prov.length ? `${monthName(prov[0]!, lang)}${prov.length > 1 ? ` ${tr('to', 'sampai')} ${monthName(prov[prov.length - 1]!, lang)}` : ''}` : '';
  const flags = [
    totals.partial.length ? tr(`${names(totals.partial)} ${totals.partial.length === 1 ? 'was' : 'were'} still running when the data was built (partial)`,
      `${names(totals.partial)} masih berjalan saat data dibuat (belum lengkap)`) : '',
    prov.length ? tr(`${prov.length} month${prov.length === 1 ? ' is' : 's are'} provisional, from near real time data (${provSpan})`,
      `${prov.length} bulan bersifat sementara, dari data hampir waktu nyata (${provSpan})`) : '',
    totals.held.length ? tr(`${totals.held.length} month${totals.held.length === 1 ? ' is' : 's are'} held for a registered test (January to October 2019): not computed for ${area}, and in no total, median or rank`,
      `${totals.held.length} bulan ditahan untuk sebuah uji terdaftar (Januari sampai Oktober 2019): tidak dihitung untuk ${area}, dan tidak masuk dalam total, median, maupun peringkat`) : '',
    missing > 0 ? tr(`${missing} of the ${n} months ${missing === 1 ? 'has' : 'have'} no harmonized value and ${missing === 1 ? 'is' : 'are'} left out of the total`,
      `${missing} dari ${n} bulan tidak memiliki nilai terharmonisasi dan tidak dimasukkan dalam total`) : '',
  ].filter(Boolean);

  const picked = same?.picked ?? null;
  const months = monthsLabel(eff, lang);
  const rankTile = !same ? { value: 'n/a', context: tr('Pick 12 months or fewer to compare the same months across the years.', 'Pilih 12 bulan atau kurang untuk membandingkan bulan yang sama antartahun.') }
    : held ? {
      value: tr('Not shown', 'Tidak ditampilkan'),
      context: tr(`No rank or ratio is given for a period in January to October 2019 in ${area}: a registered test covers those months. The totals are the record's own sums.`,
        `Peringkat dan rasio tidak diberikan untuk periode dalam Januari sampai Oktober 2019 di ${area}: bulan-bulan itu dicakup oleh sebuah uji terdaftar. Total adalah jumlah dari rekaman itu sendiri.`),
    }
      : same.rank == null || !picked ? {
        value: tr('Not ranked', 'Tidak diperingkat'),
        context: tr('A month of this period is missing or was still running, so it is not ranked against complete periods.',
          'Ada bulan dalam periode ini yang tidak tersedia atau masih berjalan, sehingga periode ini tidak diperingkat terhadap periode yang lengkap.'),
      }
        : {
          value: tr(`${ordinal(same.rank, 'en')} of ${same.of}`, `${ordinal(same.rank, 'id')} dari ${same.of}`),
          context: tr(
            `${same.rank === 1 ? 'The most fire' : `Rank ${same.rank}`} among ${months} of ${same.of} complete years${same.ratio != null && same.median != null ? `: ${times(same.ratio, 'en')} times their median (${fmtInt(same.median)} fire cell-days)` : ''}.`,
            `${same.rank === 1 ? 'Api terbanyak' : `Peringkat ${same.rank}`} di antara ${months} pada ${same.of} tahun yang lengkap${same.ratio != null && same.median != null ? `: ${times(same.ratio, 'id')} kali mediannya (${fmtInt(same.median, 'id')} sel-hari api)` : ''}.`),
        };
  const cellDays = tr('fire cell-days', 'sel-hari api');

  return (
    <div className="ka-rec-range">
      <div className="ka-rec-range-bar">
        <MonthPick label={tr('From', 'Dari')} value={eff.from} first={first} last={last}
          onChange={(k) => onRange(clamp({ from: k, to: k > eff.to ? k : eff.to }))} />
        <MonthPick label={tr('To', 'Sampai')} value={eff.to} first={first} last={last}
          onChange={(k) => onRange(clamp({ from: k < eff.from ? k : eff.from, to: k }))} />
        <button type="button" className="ui-btn" disabled={!range} onClick={() => onRange(null)}>{tr('Reset to the whole record', 'Atur ulang ke seluruh rekaman')}</button>
      </div>
      {quick.length ? (
        <p className="ka-rec-quick">
          <span>{tr('Quick picks, from the month selected in the calendar:', 'Pilihan cepat, dari bulan yang dipilih pada kalender:')}</span>
          {quick.map((q) => (
            <button key={q.label} type="button" className="ka-rec-chip" aria-pressed={!!range && range.from === q.r.from && range.to === q.r.to}
              onClick={() => onRange(clamp(q.r))}>{q.label}</button>
          ))}
        </p>
      ) : null}
      <p className="ka-rec-range-now" role="status">
        {range ? <>{tr('Picked: ', 'Dipilih: ')}<strong>{label}</strong> ({n} {tr(n === 1 ? 'month' : 'months', 'bulan')}), {area}. {tr('The calendar below fades the other months.', 'Kalender di bawah memudarkan bulan lainnya.')}</>
          : <>{tr('No range picked: the whole record, ', 'Belum ada rentang dipilih: seluruh rekaman, ')}<strong>{label}</strong> ({n} {tr('months', 'bulan')}), {area}.</>}
      </p>
      <StatGrid>
        <StatTile label={tr('Harmonized total', 'Total terharmonisasi')} value={totals.H == null ? 'n/a' : fmtInt(totals.H, lang)} unit={totals.H == null ? undefined : cellDays}
          context={totals.H == null ? tr('No month of this range has a harmonized value.', 'Tidak ada bulan dalam rentang ini yang memiliki nilai terharmonisasi.')
            : totals.own ? tr('The count of Aqua MODIS itself in these months: nothing is converted, so there is no range to give.', 'Hitungan Aqua MODIS sendiri pada bulan-bulan ini: tidak ada yang dikonversi, sehingga tidak ada rentang yang perlu diberikan.')
              : totals.noBand || totals.lo == null || totals.hi == null
              ? tr('On the Aqua MODIS scale. No 90% range: a month of this range was converted without one.', 'Pada skala Aqua MODIS. Tanpa rentang 90%: ada bulan dalam rentang ini yang dikonversi tanpa rentang.')
              : tr(`90% range ${fmtInt(totals.lo)} to ${fmtInt(totals.hi)} (sum of the monthly bounds, an approximation). On the Aqua MODIS scale.`,
                `Rentang 90% ${fmtInt(totals.lo, 'id')} sampai ${fmtInt(totals.hi, 'id')} (jumlah batas-batas bulanan, suatu pendekatan). Pada skala Aqua MODIS.`)} />
        <StatTile label={tr('Raw total, as recorded', 'Total mentah, sebagaimana tercatat')} value={totals.raw == null ? 'n/a' : fmtInt(totals.raw, lang)} unit={totals.raw == null ? undefined : cellDays}
          context={eff.from.slice(0, 4) <= '2011' && eff.to.slice(0, 4) >= '2012'
            ? tr('MODIS to 2011 and VIIRS from 2012 in one sum: the two satellites do not count alike, so read the harmonized total.',
              'MODIS sampai 2011 dan VIIRS sejak 2012 dalam satu jumlah: kedua satelit tidak menghitung dengan cara yang sama, jadi bacalah total terharmonisasi.')
            : eff.to.slice(0, 4) <= '2011' ? tr('MODIS (Aqua, or Terra before Aqua), as recorded.', 'MODIS (Aqua, atau Terra sebelum ada Aqua), sebagaimana tercatat.')
              : tr('VIIRS, as recorded: it counts several times what MODIS does for the same fires.', 'VIIRS, sebagaimana tercatat: hitungannya beberapa kali lipat hitungan MODIS untuk api yang sama.')} />
        <StatTile label={tr('Against the same months', 'Dibandingkan bulan yang sama')} value={rankTile.value} context={rankTile.context} />
      </StatGrid>
      {flags.length ? <p className="ka-rec-note">{tr('Mind: ', 'Perhatikan: ')}{flags.join('; ')}.</p> : null}
      {same && same.periods.some((p) => p.H != null)
        ? <SameMonthsFigure area={area} eff={eff} same={same} held={held} source={source} />
        : !same ? (
          <p className="ka-rec-note">
            {tr(`"The same months in every year" needs a range of 12 months or fewer: this one is ${n} months long.`,
              `"Bulan yang sama setiap tahun" memerlukan rentang 12 bulan atau kurang: rentang ini ${n} bulan.`)}
          </p>
        ) : null}
    </div>
  );
}

function status(p: SamePeriod, tr: Tr): string {
  return [
    p.picked ? tr('picked', 'dipilih') : '', p.partial ? tr('partial', 'belum lengkap') : '', p.provisional ? tr('provisional', 'sementara') : '',
    p.held ? tr('held for a registered test', 'ditahan untuk uji terdaftar') : !p.complete && !p.partial ? tr('a month is missing', 'ada bulan yang tidak tersedia') : '',
  ].filter(Boolean).join(', ');
}

function SameMonthsFigure({ area, eff, same, held, source }: { area: string; eff: MonthRange; same: SameMonths; held: boolean; source: string }) {
  const tr = useTr();
  const lang = useLang();
  const months = monthsLabel(eff, lang);
  const data = useMemo(() => same.periods.filter((p) => p.H != null).map((p) => ({ ...p, yr: Number(p.start.slice(0, 4)) })), [same]);
  const crosses = eff.from.slice(0, 4) !== eff.to.slice(0, 4);
  const to = tr('to', 'sampai');
  const periodLabel = (p: SamePeriod) => (lang === 'id' ? p.label.replace(' to ', ' sampai ') : p.label);
  const table = useMemo(() => ({
    columns: [crosses ? tr('Period (years)', 'Periode (tahun)') : tr('Year', 'Tahun'), tr('Harmonized (fire cell-days)', 'Terharmonisasi (sel-hari api)'),
      tr('90% range', 'Rentang 90%'), tr('Raw, as recorded', 'Mentah, sebagaimana tercatat'), tr('Note', 'Catatan')],
    rows: same.periods.map((p) => [
      periodLabel(p), p.H == null ? '–' : fmtInt(p.H, lang),
      p.lo == null || p.hi == null || Math.round(p.lo) === Math.round(p.hi) ? '–' : `${fmtInt(p.lo, lang)} ${to} ${fmtInt(p.hi, lang)}`,
      p.raw == null ? '–' : fmtInt(p.raw, lang), status(p, tr) || '–',
    ]),
  }), [same, crosses, lang]);   // eslint-disable-line react-hooks/exhaustive-deps
  const showRank = !held && same.rank != null && same.picked;
  const title = showRank
    ? tr(`${area}: ${rangeLabel(eff)} ranks ${ordinal(same.rank!, 'en')} of ${same.of} for ${monthsLabel(eff)}${same.ratio != null ? `, ${times(same.ratio, 'en')} times the median` : ''}`,
      `${area}: ${rangeLabel(eff, 'id')} berperingkat ${ordinal(same.rank!, 'id')} dari ${same.of} untuk ${monthsLabel(eff, 'id')}${same.ratio != null ? `, ${times(same.ratio, 'id')} kali median` : ''}`)
    : tr(`${area}: ${months} in every year of the record`, `${area}: ${months} pada setiap tahun dalam rekaman`);
  const medianShown = !held && same.median != null;
  return (
    <PlotFigure
      title={title}
      subtitle={tr(
        `Harmonized fire cell-days in ${months} of each year${crosses ? ' (a period is named by the year it starts)' : ''}, with the 90% range of each total (sum of the monthly bounds). The picked period is in colour; faded bars are provisional or incomplete${medianShown ? '; the line is the median of the complete periods' : ''}.`,
        `Sel-hari api terharmonisasi pada ${months} setiap tahun${crosses ? ' (periode dinamai menurut tahun awalnya)' : ''}, dengan rentang 90% tiap total (jumlah batas-batas bulanan). Periode yang dipilih diberi warna; batang pudar bersifat sementara atau belum lengkap${medianShown ? '; garis adalah median dari periode yang lengkap' : ''}.`)}
      source={source}
      table={table}
      height={240}
      deps={[same, held, lang]}
      build={(width) => {
        const narrow = width < 560;
        const accent = cssVar('--accent', '#ff7a3d'), base = cssVar('--harmonized', '#f2f3f5'), muted = cssVar('--text-3', '#7f908c'), ink = cssVar('--text', '#f2f3f5');
        const bar = (rows: typeof data, fill: string, fillOpacity: number) =>
          Plot.rectY(rows, { x1: (d: { yr: number }) => d.yr - 0.38, x2: (d: { yr: number }) => d.yr + 0.38, y: 'H', fill, fillOpacity });
        const solid = (p: SamePeriod) => p.complete && !p.provisional;
        return {
          height: narrow ? 220 : 260,
          marginTop: 18, marginRight: 54,
          x: { label: null, tickFormat: (y: number) => String(y), ticks: narrow ? 5 : 12 },
          y: { label: tr('fire cell-days', 'sel-hari api'), grid: true, zero: true, tickFormat: (v: number) => fmtCompact(v, lang) },
          marks: [
            bar(data.filter((p) => !p.picked && solid(p)), base, 0.5),
            bar(data.filter((p) => !p.picked && !solid(p)), base, 0.2),
            bar(data.filter((p) => p.picked), accent, 1),
            Plot.ruleX(data.filter((p) => p.lo != null && p.hi != null && Math.round(p.lo) !== Math.round(p.hi)), { x: 'yr', y1: 'lo', y2: 'hi', stroke: ink, strokeOpacity: 0.75 }),
            ...(medianShown ? [
              Plot.ruleY([same.median!], { stroke: muted, strokeOpacity: 0.9 }),
              Plot.text([same.median!], { y: (d: number) => d, frameAnchor: 'right', dx: 6, textAnchor: 'start', text: () => 'median', fill: muted, fontSize: 11 }),
            ] : []),
            Plot.tip(data, Plot.pointerX({
              x: 'yr', y: 'H', fill: cssVar('--surface-2', '#10191c'), stroke: cssVar('--border-strong', '#2a3a3d'),
              title: (d: SamePeriod) => `${periodLabel(d)}${status(d, tr) ? ` (${status(d, tr)})` : ''}\n${fmtInt(d.H!, lang)} ${tr('fire cell-days, harmonized', 'sel-hari api, terharmonisasi')}${d.lo != null && d.hi != null && Math.round(d.lo) !== Math.round(d.hi) ? `\n90%: ${fmtInt(d.lo, lang)} ${to} ${fmtInt(d.hi, lang)}` : ''}${d.raw != null ? `\n${tr('raw, as recorded', 'mentah, sebagaimana tercatat')}: ${fmtInt(d.raw, lang)}` : ''}`,
            })),
          ],
        };
      }}
    />
  );
}
