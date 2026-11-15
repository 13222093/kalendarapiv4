// KalenderApi (new file): the calendar ribbon, the first thing on the home page. Columns are the years, rows are the
// months, and each cell is coloured by Indonesia's fire cell-days that month. A two-state switch shows the same
// months "as recorded" (MODIS to 2011, VIIRS from 2012) and "on one scale" (the harmonized record): both states use
// one logarithmic colour scale, so the flare after 2012 in the first state is the change of satellite, and its
// disappearance in the second is the harmonization. The definitions are the record page's (lib/home.ts ribbon(),
// from components/record/RecordCalendar.tsx), so the two calendars agree.
// The switch plays once after the data arrives (as recorded, then one scale), unless reduced motion is asked for.
// Keyboard: arrow keys move among the months; the readout names the month in focus. A table holds the same values.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { fmtNumber, monthName, useLang, useTr, type Lang } from '../../lib/lang';
import { SEAM_YEAR, type MonthRow, type Series } from '../../lib/record';
import { ribbon, ribbonMove, timesDigits, type RibbonCell } from '../../lib/home';

const PLAY_MS = 2500;
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const keyOf = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

export function FireRibbon({ rows, monthHref }: { rows: MonthRow[]; monthHref: (key: string) => string }) {
  const tr = useTr();
  const lang = useLang();
  const model = useMemo(() => ribbon(rows), [rows]);
  const { years, cells, seam } = model;
  const grid = useRef<HTMLDivElement>(null);
  // with reduced motion the page opens on the record we offer; otherwise it opens as recorded and plays the switch once
  const [series, setSeries] = useState<Series>(() => (reducedMotion() ? 'harm' : 'raw'));
  const [played, setPlayed] = useState(() => reducedMotion());
  const [hover, setHover] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const ready = years.length > 0;

  useEffect(() => {
    if (!ready || played) return undefined;
    const t = window.setTimeout(() => { setSeries('harm'); setPlayed(true); }, PLAY_MS);
    return () => window.clearTimeout(t);
  }, [ready, played]);
  const choose = (s: Series) => { setPlayed(true); setSeries(s); };

  // the month the keyboard starts on: the one in focus, else the latest month with a value
  const lastKey = useMemo(() => {
    let best: RibbonCell | null = null;
    for (const c of cells.values()) if (c.harm != null && (!best || c.key > best.key)) best = c;
    return best?.key ?? null;
  }, [cells]);
  const tabKey = focus && cells.has(focus) ? focus : lastKey;
  const shown = cells.get(hover ?? focus ?? '') ?? null;

  const describe = (c: RibbonCell): string => {
    const parts = [`${monthName(c.month, lang, 'long')} ${c.year}`];
    parts.push(c.raw != null
      ? tr(`${fmtNumber(c.raw, lang)} fire cell-days as recorded by ${c.rawSensor}`, `${fmtNumber(c.raw, lang)} sel-hari api sebagaimana tercatat oleh ${c.rawSensor}`)
      : tr('no value as recorded', 'tidak ada nilai sebagaimana tercatat'));
    parts.push(c.harm != null
      ? tr(`${fmtNumber(c.harm, lang)} on one scale`, `${fmtNumber(c.harm, lang)} pada satu skala`)
      : tr('no value on one scale', 'tidak ada nilai pada satu skala'));
    if (c.times != null) parts.push(timesText(c, lang, tr));
    if (c.provisional) parts.push(tr('provisional', 'sementara'));
    return parts.join(', ');
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!tabKey) return;
    const next = ribbonMove(tabKey, e.key, (k) => cells.has(k));
    if (!e.key.startsWith('Arrow')) return;
    e.preventDefault();
    if (!next) return;
    setFocus(next);
    grid.current?.querySelector<HTMLButtonElement>(`[data-key="${next}"]`)?.focus();
  };

  const seamCol = seam != null ? years.indexOf(seam) : -1;
  const cols = { ['--cols' as string]: years.length, ['--seam' as string]: seamCol } as CSSProperties;
  const first = years[0], last = years[years.length - 1];

  if (!ready) {
    return <div className="ka-rib is-wait" role="status">{tr('Loading the calendar…', 'Memuat kalender…')}</div>;
  }
  return (
    <figure className="ka-rib" data-series={series} style={cols}>
      <figcaption className="ka-rib-head">
        <div className="ka-rib-switch" role="group" aria-label={tr('Which record the calendar shows', 'Rekaman yang ditampilkan kalender')}>
          <button type="button" aria-pressed={series === 'raw'} onClick={() => choose('raw')}>{tr('As recorded', 'Sebagaimana tercatat')}</button>
          <button type="button" aria-pressed={series === 'harm'} onClick={() => choose('harm')}>{tr('On one scale', 'Pada satu skala')}</button>
        </div>
        <p className="ka-rib-say" aria-live="polite">
          {series === 'raw'
            ? tr(`MODIS to ${SEAM_YEAR - 1}, VIIRS from ${SEAM_YEAR}: the right-hand side flares because the satellite changed.`,
              `MODIS sampai ${SEAM_YEAR - 1}, VIIRS sejak ${SEAM_YEAR}: sisi kanan menyala karena satelitnya berganti.`)
            : tr('The same months on one scale: the flare was the satellite, not the fire.',
              'Bulan yang sama pada satu skala: nyala tadi berasal dari satelit, bukan dari api.')}
        </p>
      </figcaption>

      <div className="ka-rib-body">
        {/* the two satellites over their years, and the seam between them */}
        <div className="ka-rib-sats" aria-hidden="true">
          <span className="ka-rib-sat is-modis" style={{ gridColumn: seamCol > 0 ? `2 / ${seamCol + 2}` : '2 / -1' }}>MODIS</span>
          {seamCol > 0 ? <span className="ka-rib-sat is-viirs" style={{ gridColumn: `${seamCol + 2} / -1` }}>VIIRS</span> : null}
        </div>
        <div ref={grid} className="ka-rib-grid" role="grid" onKeyDown={onKey} onPointerLeave={() => setHover(null)}
          aria-label={tr(`Indonesia’s fire cell-days by month, ${first} to ${last}, ${series === 'harm' ? 'on one scale' : 'as recorded'}`,
            `Sel-hari api Indonesia per bulan, ${first} sampai ${last}, ${series === 'harm' ? 'pada satu skala' : 'sebagaimana tercatat'}`)}>
          {MONTHS.map((m) => (
            <div key={m} role="row" className="ka-rib-row">
              <span role="rowheader" className="ka-rib-m" aria-label={monthName(m, lang, 'long')}>{monthName(m, lang, 'short')}</span>
              {years.map((y, i) => {
                const c = cells.get(keyOf(y, m));
                if (!c) return <span key={y} role="gridcell" className="ka-rib-cell is-out" style={{ ['--i' as string]: i } as CSSProperties} />;
                const step = series === 'harm' ? c.stepHarm : c.stepRaw;
                return (
                  <button key={y} type="button" role="gridcell" className="ka-rib-cell" data-key={c.key}
                    data-step={step ?? undefined} data-null={step == null ? '' : undefined} data-prov={c.provisional ? '' : undefined}
                    style={{ ['--i' as string]: i } as CSSProperties} tabIndex={c.key === tabKey ? 0 : -1} aria-label={describe(c)}
                    onPointerEnter={() => setHover(c.key)} onFocus={() => setFocus(c.key)} onClick={() => setFocus(c.key)} />
                );
              })}
            </div>
          ))}
          {seamCol > 0 ? (
            <span className="ka-rib-seam" aria-hidden="true"><i>{tr(`${SEAM_YEAR}: VIIRS joins MODIS`, `${SEAM_YEAR}: VIIRS menyusul MODIS`)}</i></span>
          ) : null}
        </div>
        <div className="ka-rib-years" aria-hidden="true">
          <span />
          {years.map((y) => <span key={y} data-five={y % 5 === 0 || y === first ? '' : undefined} data-seam={y === seam ? '' : undefined}>{y}</span>)}
        </div>
      </div>

      <div className="ka-rib-foot">
        <p className="ka-rib-read" aria-hidden="true">
          {shown ? (
            <>
              <b>{monthName(shown.month, lang, 'long')} {shown.year}</b>
              <span className={series === 'raw' ? 'is-on' : undefined}>
                {shown.raw != null ? `${fmtNumber(shown.raw, lang)} ${tr('as recorded', 'sebagaimana tercatat')} (${shown.rawSensor})` : tr('no value as recorded', 'tanpa nilai tercatat')}
              </span>
              <span className={series === 'harm' ? 'is-on' : undefined}>
                {shown.harm != null ? `${fmtNumber(shown.harm, lang)} ${tr('on one scale', 'pada satu skala')}` : tr('no value on one scale', 'tanpa nilai pada satu skala')}
              </span>
              {shown.times != null ? <span>{timesText(shown, lang, tr)}</span> : null}
              {shown.provisional ? <span className="is-prov">{tr('provisional', 'sementara')}</span> : null}
              <a href={monthHref(shown.key)}>{tr('Open this month', 'Buka bulan ini')} →</a>
            </>
          ) : tr('Point at a month, or use the arrow keys, to read it. Counts are fire cell-days: one 1 km cell with a hotspot on one day.',
            'Arahkan ke sebuah bulan, atau pakai tombol panah. Sel-hari api: satu sel 1 km dengan titik panas pada satu hari.')}
        </p>
        <p className="ka-rib-key">
          <span>{tr('Fewer', 'Lebih sedikit')}</span>
          <span className="ka-rib-ramp" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} data-step={i + 1} />)}</span>
          <span>{tr('more, same scale in both views (logarithmic)', 'lebih banyak, skala sama di kedua tampilan (log)')}</span>
          <span className="ka-rib-key-prov"><i data-step="4" data-prov="" aria-hidden="true" />{tr('provisional', 'sementara')}</span>
        </p>
      </div>

      <details className="ka-rib-table">
        <summary>{tr('Show the calendar as a table', 'Tampilkan kalender sebagai tabel')}</summary>
        <div className="ka-rib-table-scroll">
          <table>
            <caption>
              {tr(`Indonesia, fire cell-days by month, ${series === 'harm' ? 'on one scale' : 'as recorded (MODIS to ' + (SEAM_YEAR - 1) + ', VIIRS from ' + SEAM_YEAR + ')'}. An asterisk marks a provisional month.`,
                `Indonesia, sel-hari api per bulan, ${series === 'harm' ? 'pada satu skala' : 'sebagaimana tercatat (MODIS sampai ' + (SEAM_YEAR - 1) + ', VIIRS sejak ' + SEAM_YEAR + ')'}. Tanda bintang menandai bulan sementara.`)}
            </caption>
            <thead>
              <tr><th scope="col">{tr('Year', 'Tahun')}</th>{MONTHS.map((m) => <th key={m} scope="col">{monthName(m, lang, 'short')}</th>)}</tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y}>
                  <th scope="row">{y}</th>
                  {MONTHS.map((m) => {
                    const c = cells.get(keyOf(y, m));
                    const v = c ? (series === 'harm' ? c.harm : c.raw) : null;
                    return <td key={m}>{v == null ? '–' : `${fmtNumber(v, lang)}${c?.provisional ? '*' : ''}`}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/** "3.1 times the usual September" */
function timesText(c: RibbonCell, lang: Lang, tr: (en: string, id: string) => string): string {
  const n = fmtNumber(c.times!, lang, timesDigits(c.times!));
  const month = monthName(c.month, lang, 'long');
  return tr(`${n} times the usual ${month}`, `${n} kali ${month} biasanya`);
}
