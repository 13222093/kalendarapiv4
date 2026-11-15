// KalenderApi: "Before and after" on the Indonesia record page. The yearly record three ways (lib/record.ts
// beforeAfter): stitched as recorded (MODIS to 2011, VIIRS from 2012), the two sensors added together (wrong), and the
// harmonized record with its 90% band, each indexed to its own 2003-2011 mean. House chart style (PlotFigure).
// Fourth round (after the science review):
//  - the harmonized line is named for what it is: Aqua MODIS's own count to 2021, VIIRS converted to the Aqua scale
//    from 2022 (checked against the yearly totals), in the tile, the legend, the table and the source line; 2022 is
//    marked on the chart next to the 2012 marker;
//  - the headline change is 2017 to 2021 against 2003 to 2007 (lib/windows.ts), which stops before the 2022 seam;
//  - a strip under the stat tiles shows how the change moves with the years compared (lib/robust.ts);
//  - the absolute trend slopes are no longer shown: the raw series changes unit in 2012 and the finding file has no
//    interval for them;
//  - every string is in English and Bahasa Indonesia (lib/lang.ts).
import { useEffect, useMemo, useState } from 'react';
import * as Plot from '@observablehq/plot';
import { PlotFigure, StatGrid, StatTile, cssVar } from '../ui';
import {
  SEAM_YEAR, getJson, loadValidation, settle, type BeforeAfter as BA, type Finding, type Load, type YearPoint,
} from '../../lib/record';
import {
  EARLY, LATE, elNinoYears, headline, lineMakeup, ownYears, reading, robustness, seamFails, yearSource, yearTotals,
  yearsText, type EnsoFile, type LineMakeup, type VariantId, type VariantResult,
} from '../../lib/robust';
import { fmtNumber, useLang, useTr, type Lang, type Tr } from '../../lib/lang';
import '../../styles/robust.css';

type Key = 'summed' | 'naive' | 'H';

const ENSO_URL = `${import.meta.env.BASE_URL}ka-data/enso_oni.json`;
let ensoOnce: Promise<EnsoFile> | null = null;
function loadEnso(): Promise<EnsoFile> {
  if (!ensoOnce) {
    ensoOnce = getJson<EnsoFile>(ENSO_URL);
    ensoOnce.catch(() => { ensoOnce = null; });   // a failed or missing file is asked again next time
  }
  return ensoOnce;
}

/** "+38%" / "−24%" (a true minus sign), with the language's separators. */
const pctText = (x: number, lang: Lang) => `${x >= 0 ? '+' : '−'}${fmtNumber(Math.abs(x), lang)}%`;

/** What the harmonized line is, in words (only what the yearly totals confirm). */
function lineWords(m: LineMakeup, tr: Tr): string {
  return m.ownCount
    ? tr(`Aqua MODIS's own count to ${m.ownTo}, VIIRS converted to the Aqua MODIS scale from ${m.convertedFrom}`,
      `hitungan Aqua MODIS sendiri sampai ${m.ownTo}, lalu VIIRS yang dikonversi ke skala Aqua MODIS sejak ${m.convertedFrom}`)
    : tr(`on the Aqua MODIS scale, with VIIRS converted to it from ${m.convertedFrom}`,
      `pada skala Aqua MODIS, dengan VIIRS dikonversi ke skala itu sejak ${m.convertedFrom}`);
}

/** The name of a comparison. "Fails" is said only when the validation file has that seam check and it fails. */
function variantName(id: VariantId, m: LineMakeup, failed: boolean | null, tr: Tr): string {
  if (id === 'headline') return tr('As shown above', 'Seperti di atas');
  if (id === 'across-seam') {
    return failed
      ? tr(`Across the ${m.convertedFrom} seam, whose check fails`, `Melewati sambungan ${m.convertedFrom}, yang ujinya gagal`)
      : tr(`Across the ${m.convertedFrom} seam`, `Melewati sambungan ${m.convertedFrom}`);
  }
  return tr('Without El Niño years', 'Tanpa tahun El Niño');
}

/** The strip under the stat tiles: the raw and the harmonized change for the headline comparison, for the one that
 *  crosses the 2022 seam, and for the headline without El Nino years. */
function RobustStrip({ area, results, makeup, enso, failed }: {
  area: string; results: VariantResult[]; makeup: LineMakeup; enso: Load<EnsoFile>;
  failed: boolean | null;   // the seam check where conversion starts: fails, passes, or not known
}) {
  const tr = useTr();
  const lang = useLang();
  const to = tr('to', 'sampai');
  const pct = (x: number | null) => (x == null ? tr('n/a', 't/a') : pctText(x, lang));
  const harm = reading(results, 'harm');
  const file = enso.state === 'ok' ? enso.data : null;
  const noNino = results.find((r) => r.id === 'no-el-nino') ?? null;
  const across = results.find((r) => r.id === 'across-seam') ?? null;
  const all = harm != null && harm.n === results.length;
  // from the value nearest zero to the one farthest from it
  const near = harm ? (harm.sign < 0 ? harm.max : harm.min) : 0;
  const far = harm ? (harm.sign < 0 ? harm.min : harm.max) : 0;
  const acrossConverted = across ? across.late.length - ownYears(across.late) : 0;
  const ensoState = enso.state === 'loading' ? tr('is loading', 'sedang dimuat')
    : enso.state === 'missing' ? tr('is not built yet', 'belum dibuat')
      : enso.state === 'error' ? tr(`could not be loaded (${enso.message})`, `gagal dimuat (${enso.message})`)
        : tr('has no index values', 'tidak berisi nilai indeks');
  const rule = file
    ? file.season === 'JAS'
      ? tr(`a year counts as El Niño when its July to September Oceanic Niño Index is +${file.threshold} or more`,
        `satu tahun dihitung El Niño bila Oceanic Niño Index Juli sampai September-nya +${fmtNumber(file.threshold, lang, 1)} atau lebih`)
      : file.rule
    : '';
  return (
    <section className="ka-rob" aria-label={tr('How much the change depends on the years compared', 'Seberapa besar perubahan bergantung pada tahun yang dibandingkan')}>
      <h4 className="ka-rob-title">{tr('Does the change depend on the years compared?', 'Apakah perubahan bergantung pada tahun yang dibandingkan?')}</h4>
      <div className="ka-rob-grid">
        {results.map((r) => (
          <div className="ka-rob-item" key={r.id}>
            <p className="ka-rob-label">{variantName(r.id, makeup, failed, tr)}</p>
            <p className="ka-rob-years">
              {tr(`Mean of ${yearsText(r.late, to)} against ${yearsText(r.early, to)}`, `Rata-rata ${yearsText(r.late, to)} dibanding ${yearsText(r.early, to)}`)}
              {r.dropped.length ? tr(` (left out: ${yearsText(r.dropped, to)})`, ` (dikeluarkan: ${yearsText(r.dropped, to)})`) : ''}
              {r.id === 'no-el-nino' && !r.dropped.length ? tr(' (none of these years is an El Niño year)', ' (tidak ada tahun El Niño di antaranya)') : ''}
            </p>
            <dl className="ka-rob-vals">
              <div data-series="raw"><dt>{tr('Raw, stitched', 'Mentah, disambung')}</dt><dd>{pct(r.raw)}</dd></div>
              <div data-series="harm"><dt>{tr('Harmonized', 'Terharmonisasi')}</dt><dd>{pct(r.harm)}</dd></div>
              <div data-series="modis"><dt>{tr('Aqua MODIS alone', 'Aqua MODIS saja')}</dt><dd>{pct(r.modis)}</dd></div>
            </dl>
          </div>
        ))}
        {!noNino ? (
          <div className="ka-rob-item">
            <p className="ka-rob-label">{variantName('no-el-nino', makeup, failed, tr)}</p>
            <p className="ka-rob-years">
              {tr(`Not shown: the list of El Niño years (ka-data/enso_oni.json) ${ensoState}.`, `Tidak ditampilkan: daftar tahun El Niño (ka-data/enso_oni.json) ${ensoState}.`)}
            </p>
          </div>
        ) : null}
      </div>
      <p className="ka-rob-read">
        {!harm
          ? tr(`Too few of these comparisons have a number for ${area} to say whether the change depends on the years.`,
            `Terlalu sedikit perbandingan yang punya angka untuk ${area}, sehingga tidak bisa dikatakan apakah perubahannya bergantung pada tahun.`)
          : harm.sameDirection
            ? tr(
              `In ${all ? `all ${harm.n}` : `the ${harm.n}`} comparisons${all ? '' : ' that have a number'} the harmonized change is a ${harm.sign < 0 ? 'fall' : 'rise'}, from ${pctText(near, lang)} to ${pctText(far, lang)}: its direction does not depend on these choices; its size does.`,
              `Pada ${all ? `semua ${harm.n}` : `${harm.n}`} perbandingan${all ? '' : ' yang punya angka'}, perubahan terharmonisasi selalu ${harm.sign < 0 ? 'turun' : 'naik'}, dari ${pctText(near, lang)} sampai ${pctText(far, lang)}: arahnya tidak bergantung pada pilihan ini; besarnya bergantung.`)
            : tr(
              `For ${area} the harmonized change runs from ${pctText(harm.min, lang)} to ${pctText(harm.max, lang)} across these comparisons: here even its direction depends on the years compared.`,
              `Untuk ${area}, perubahan terharmonisasi berkisar dari ${pctText(harm.min, lang)} sampai ${pctText(harm.max, lang)} di antara perbandingan ini: di sini arahnya pun bergantung pada tahun yang dibandingkan.`)}
      </p>
      <p className="ka-rob-how">
        {tr(
          'Each number is the mean yearly count of the late years against the early years, computed in your browser from the yearly totals of the chart below; a window left with fewer than two years gives n/a.',
          'Setiap angka adalah rata-rata hitungan tahunan tahun-tahun akhir dibanding tahun-tahun awal, dihitung di peramban Anda dari total tahunan grafik di bawah; jendela yang tersisa kurang dari dua tahun diberi t/a.')}
        {makeup.ownCount ? tr(
          ` To ${makeup.ownTo} the harmonized line is Aqua MODIS's own count, so in the first comparison it equals "Aqua MODIS alone" and involves no conversion.`,
          ` Sampai ${makeup.ownTo}, garis terharmonisasi adalah hitungan Aqua MODIS sendiri, sehingga pada perbandingan pertama nilainya sama dengan "Aqua MODIS saja" dan tidak melibatkan konversi.`) : ''}
        {across && acrossConverted > 0 ? tr(
          ` The second comparison crosses ${makeup.convertedFrom}: ${acrossConverted} of its ${across.late.length} late years are converted VIIRS${failed ? `, and the ${makeup.convertedFrom} seam check fails (see How sure)` : ''}.`,
          ` Perbandingan kedua melewati ${makeup.convertedFrom}: ${acrossConverted} dari ${across.late.length} tahun akhirnya adalah VIIRS yang dikonversi${failed ? `, dan uji sambungan ${makeup.convertedFrom} gagal (lihat Seberapa yakin)` : ''}.`) : ''}
        {file && noNino ? (
          <>{tr(` El Niño years: ${rule}. Source: NOAA Climate Prediction Center, Oceanic Niño Index (`, ` Tahun El Niño: ${rule}. Sumber: NOAA Climate Prediction Center, Oceanic Niño Index (`)}
            <a href={file.url} target="_blank" rel="noreferrer">{file.url.replace(/^https?:\/\//, '')}</a>
            {tr(`, read ${file.accessed}). Another season or threshold gives another list.`, `, dibaca ${file.accessed}). Musim atau ambang lain memberi daftar lain.`)}</>
        ) : null}
        {tr(' These are counts of satellite detections; they say nothing about cause.', ' Ini hitungan deteksi satelit; angka ini tidak menjelaskan penyebab.')}
      </p>
    </section>
  );
}

export function BeforeAfterFigure({ area, ba, source, ratio, pooled }: {
  area: string; ba: BA; source: string;
  ratio: { ratio: number; from: number; to: number } | null;
  finding: Finding | null;   // no longer drawn: the absolute trend slopes were removed in the fourth round
  pooled: { ratio: number; from: number } | null;   // years converted with one national ratio and no interval
}) {
  const tr = useTr();
  const lang = useLang();
  const n0 = (x: number) => fmtNumber(x, lang);
  const to = tr('to', 'sampai');
  const pts = ba.points;
  const solid = useMemo(() => pts.filter((p) => !p.provisional), [pts]);
  // the 90% band only where the record has one (a province after 2021 has none: never drawn as a zero-width band)
  const banded = useMemo(() => solid.filter((p) => !p.noBand), [solid]);
  const firstNoBand = solid.find((p) => p.noBand)?.year ?? null;
  const tail = useMemo(() => {
    const i = pts.findIndex((p) => p.provisional);
    return i > 0 ? pts.slice(i - 1) : [];
  }, [pts]);
  const lastProv = pts.find((p) => p.provisional) ?? null;

  // what the harmonized line is made of, the headline change, and how it moves with the years compared (lib/robust.ts)
  const totals = useMemo(() => yearTotals(pts), [pts]);
  const makeup = useMemo(() => lineMakeup(totals), [totals]);
  const head = useMemo(() => headline(totals), [totals]);
  const [enso, setEnso] = useState<Load<EnsoFile>>({ state: 'loading' });
  useEffect(() => {
    let on = true;
    settle(loadEnso(), (l) => { if (on) setEnso(l); });
    return () => { on = false; };
  }, []);
  // whether the seam check at the year conversion starts fails (validation_results.json, the file How sure reads)
  const [failed, setFailed] = useState<boolean | null>(null);
  useEffect(() => {
    let on = true;
    settle(loadValidation(), (l) => { if (on) setFailed(l.state === 'ok' ? seamFails(l.data, makeup.convertedFrom) : null); });
    return () => { on = false; };
  }, [makeup.convertedFrom]);
  const nino = useMemo(() => (enso.state === 'ok' ? elNinoYears(enso.data) : null), [enso]);
  const results = useMemo(() => robustness(totals, nino), [totals, nino]);

  const words = lineWords(makeup, tr);
  const label: Record<Key, string> = {
    summed: tr('Added together (wrong)', 'Dijumlahkan (keliru)'),
    naive: tr('Raw, stitched as recorded', 'Mentah, disambung apa adanya'),
    H: tr('Harmonized (Aqua scale)', 'Terharmonisasi (skala Aqua)'),
  };
  const made = (year: number): string => {
    const t = totals.find((x) => x.year === year);
    const s = t ? yearSource(t, makeup) : 'unknown';
    return s === 'own' ? tr('Aqua MODIS\'s own count', 'Hitungan Aqua MODIS sendiri')
      : s === 'converted' ? tr('VIIRS converted to the Aqua scale', 'VIIRS dikonversi ke skala Aqua') : '–';
  };
  const isOwn = (year: number): boolean => {
    const t = totals.find((x) => x.year === year);
    return t ? yearSource(t, makeup) === 'own' : false;
  };
  const windowText = `${LATE[0]} ${to} ${LATE[1]}`, earlyText = `${EARLY[0]} ${to} ${EARLY[1]}`;
  const lateYears = Array.from({ length: LATE[1] - LATE[0] + 1 }, (_, i) => LATE[0] + i);
  const lateOwn = ownYears(lateYears);

  const title = head.raw == null || head.harm == null
    ? tr(`${area}: the record before and after harmonization`, `${area}: rekaman sebelum dan sesudah harmonisasi`)
    : tr(
      `${area}: stitched as recorded, detections seem to ${head.raw >= 0 ? 'rise' : 'fall'} ${n0(Math.abs(head.raw))}%; on the Aqua MODIS scale they ${head.harm >= 0 ? 'rise' : 'fall'} ${n0(Math.abs(head.harm))}%`,
      `${area}: bila disambung apa adanya, deteksi tampak ${head.raw >= 0 ? 'naik' : 'turun'} ${n0(Math.abs(head.raw))}%; pada skala Aqua MODIS deteksi ${head.harm >= 0 ? 'naik' : 'turun'} ${n0(Math.abs(head.harm))}%`);

  const table = {
    columns: [
      tr('Year', 'Tahun'), tr('Raw, stitched (fire cell-days)', 'Mentah, disambung (sel-hari api)'), tr('Added together', 'Dijumlahkan'),
      tr('Harmonized', 'Terharmonisasi'), tr('How the harmonized value was made', 'Cara nilai terharmonisasi dibuat'),
      tr('90% range of the conversion', 'Rentang 90% konversi'), tr('Aqua MODIS alone', 'Aqua MODIS saja'),
    ],
    rows: pts.map((p) => {
      const t = totals.find((x) => x.year === p.year);
      return [
        p.provisional ? tr(`${p.year} (so far)`, `${p.year} (sejauh ini)`) : String(p.year), n0(p.rawNaive), n0(p.rawSummed), n0(p.rawH),
        made(p.year),
        isOwn(p.year) ? tr('none: not converted', 'tidak ada: tidak dikonversi')
          : p.noBand ? tr('no interval', 'tanpa interval') : `${n0(p.rawLo)} ${to} ${n0(p.rawHi)}`,
        t ? n0(t.modis) : '–',
      ];
    }),
  };

  return (
    <div className="ka-rec-ba">
      <ul className="ka-rec-big3">
        <li><b>{head.raw == null ? tr('n/a', 't/a') : pctText(head.raw, lang)}</b><span>{tr('Raw, stitched as recorded', 'Mentah, disambung apa adanya')}</span></li>
        <li><b className="is-one">{head.harm == null ? tr('n/a', 't/a') : pctText(head.harm, lang)}</b><span>{tr('On one scale (Aqua MODIS)', 'Pada satu skala (Aqua MODIS)')}</span></li>
        <li><b className="is-viirs">{ratio ? `${fmtNumber(ratio.ratio, lang, 1)}×` : tr('n/a', 't/a')}</b><span>{tr(`The jump in ${SEAM_YEAR}: VIIRS per MODIS`, `Lonjakan pada ${SEAM_YEAR}: VIIRS per MODIS`)}</span></li>
      </ul>
      <PlotFigure
        title={title}
        subtitle={tr(
          `Fire cell-days a year, each line indexed to its own 2003 to 2011 mean (= 100). The harmonized line is ${words}. Band: the 90% range of that conversion (sum of the monthly bounds, an approximation). The change in the title is the mean of ${windowText} against ${earlyText}.`,
          `Sel-hari api per tahun; tiap garis diindeks ke rata-rata 2003 sampai 2011 miliknya (= 100). Garis terharmonisasi adalah ${words}. Pita: rentang 90% konversi itu (jumlah batas bulanan, sebuah pendekatan). Perubahan pada judul adalah rata-rata ${windowText} dibanding ${earlyText}.`)}
        source={`${source} ${tr(
          `Harmonized line: ${words}${makeup.ownCount ? ' (checked in your browser: its yearly totals equal Aqua MODIS\'s before that year)' : ''}.`,
          `Garis terharmonisasi: ${words}${makeup.ownCount ? ' (diperiksa di peramban Anda: total tahunannya sama dengan Aqua MODIS sebelum tahun itu)' : ''}.`)}`}
        table={table}
        height={300}
        deps={[pts, makeup, lang]}
        build={(width) => {
          const narrow = width < 640;
          // the data colours (brand.css): the raw stitched line is MODIS blue up to 2011 and VIIRS amber from 2012, the one-scale line orange
          const c = { naive: cssVar('--ka-viirs', '#f2c14e'), summed: cssVar('--text-3', '#a79b86'), H: cssVar('--ka-harm', '#f05a28') };
          const modis = cssVar('--ka-modis', '#7db3ff');
          const muted = cssVar('--text-3', '#a79b86');
          const endPt = solid[solid.length - 1];
          const ends = endPt ? (['summed', 'naive', 'H'] as Key[]).map((k) => ({ year: endPt.year, v: endPt[k], label: label[k], k })) : [];
          const yMax = Math.max(100, ...pts.map((p) => Math.max(p.naive, p.summed, p.hi)));
          const sorted = ends.map((e) => e.v).sort((a, b) => a - b);
          const spread = sorted.every((v, i) => i === 0 || (v - sorted[i - 1]!) / yMax > 0.07);
          const labels = !narrow && spread;
          const long = pts.flatMap((p) => (['naive', 'summed', 'H'] as Key[]).map((k) => ({ year: p.year, k, v: p[k], p })));
          const line = (k: Key, w: number) => Plot.lineY(solid, { x: 'year', y: k, stroke: c[k], strokeWidth: w, curve: 'monotone-x' });
          const tailLine = (k: Key, w: number) => Plot.lineY(tail, { x: 'year', y: k, stroke: c[k], strokeWidth: w, strokeOpacity: 0.4, curve: 'monotone-x' });
          // where conversion starts: its own row in the top margin (on a phone, the row between the axis label and the frame)
          const showSeam = makeup.convertedFrom > ba.firstYear && makeup.convertedFrom <= ba.lastYear;
          const seamText = width >= 900 && makeup.ownCount
            ? tr(`Aqua MODIS's own count to ${makeup.ownTo}  |  converted VIIRS from ${makeup.convertedFrom} →`,
              `hitungan Aqua MODIS sendiri s.d. ${makeup.ownTo}  |  VIIRS dikonversi sejak ${makeup.convertedFrom} →`)
            : tr(`converted VIIRS from ${makeup.convertedFrom} →`, `VIIRS dikonversi sejak ${makeup.convertedFrom} →`);
          return {
            height: narrow ? 314 : 374,
            marginRight: labels ? 196 : 20, marginTop: 40,
            x: { label: null, tickFormat: (y: number) => String(y), ticks: narrow ? 5 : 12, domain: [ba.firstYear, ba.lastYear] },
            y: { label: tr('index, 2003 to 2011 = 100', 'indeks, 2003 sampai 2011 = 100'), grid: true, zero: true, tickFormat: (v: number) => n0(v) },
            marks: [
              Plot.areaY(banded, { x: 'year', y1: 'lo', y2: 'hi', fill: c.H, fillOpacity: 0.14, curve: 'monotone-x' }),
              ...(firstNoBand != null ? [
                Plot.ruleX([firstNoBand - 0.5], { stroke: muted, strokeOpacity: 0.35 }),
                // (a phone has no room for it in the top margin: the note under the chart says it)
                ...(narrow ? [] : [Plot.text([firstNoBand - 0.5], { x: (d: number) => d, frameAnchor: 'top', dy: -16, dx: -4, textAnchor: 'end', text: () => tr(`no 90% range from ${firstNoBand} →`, `tanpa rentang 90% sejak ${firstNoBand} →`), fill: muted, fontSize: 11 })]),
              ] : []),
              Plot.ruleY([100], { stroke: muted, strokeOpacity: 0.5 }),
              Plot.ruleX([SEAM_YEAR], { stroke: muted, strokeOpacity: 0.8 }),
              Plot.text([SEAM_YEAR], { x: (d: number) => d, frameAnchor: 'top', dy: narrow ? 2 : -16, dx: 4, textAnchor: 'start', text: () => (narrow ? tr('VIIRS joins', 'VIIRS masuk') : tr(`${SEAM_YEAR}: VIIRS joins`, `${SEAM_YEAR}: VIIRS masuk`)), fill: muted, fontSize: 11 }),
              ...(showSeam ? [
                Plot.ruleX([makeup.convertedFrom], { stroke: muted, strokeOpacity: 0.8, strokeDasharray: '3 3' }),
                Plot.text([makeup.convertedFrom], { x: (d: number) => d, frameAnchor: 'top', dy: narrow ? -14 : -30, dx: -4, textAnchor: 'end', text: () => seamText, fill: muted, fontSize: 11 }),
              ] : []),
              line('summed', 1.2),
              Plot.lineY(solid.filter((p) => p.year >= SEAM_YEAR - 1), { x: 'year', y: 'naive', stroke: c.naive, strokeWidth: 2, curve: 'monotone-x' }),
              line('H', 2.6),
              // up to 2011 the raw line and the one-scale line are the same MODIS count: the blue is dashed and drawn on top, so both show
              Plot.lineY(solid.filter((p) => p.year < SEAM_YEAR), { x: 'year', y: 'naive', stroke: modis, strokeWidth: 2.4, strokeDasharray: '7 6', strokeLinecap: 'butt', curve: 'monotone-x' }),
              ...(tail.length ? [tailLine('summed', 1.2), tailLine('naive', 2), tailLine('H', 2.6)] : []),
              ...(lastProv ? [Plot.text([lastProv], { x: 'year', frameAnchor: 'top', dy: narrow ? 2 : -16, textAnchor: 'end', text: () => (narrow ? tr('so far', 'sejauh ini') : tr(`${lastProv.year} so far`, `${lastProv.year} sejauh ini`)), fill: muted, fontSize: 11 })] : []),
              ...(labels ? [Plot.text(ends, { x: 'year', y: 'v', text: 'label', fill: (d: { k: Key }) => c[d.k], dx: 10, textAnchor: 'start', fontSize: 12, fontWeight: 600 })] : []),
              Plot.ruleX(pts, Plot.pointerX({ x: 'year', stroke: muted, strokeOpacity: 0.6 })),
              Plot.tip(long, Plot.pointerX({
                x: 'year', y: 'v', fill: cssVar('--surface-2', '#1e1812'), stroke: cssVar('--border-strong', '#33405c'),
                title: (d: { year: number; k: Key; v: number; p: YearPoint }) => {
                  const raw = d.k === 'naive' ? d.p.rawNaive : d.k === 'summed' ? d.p.rawSummed : d.p.rawH;
                  const how = made(d.year);
                  const band = isOwn(d.year) ? ''
                    : d.p.noBand ? tr('\nno 90% range (one national ratio)', '\ntanpa rentang 90% (satu rasio nasional)')
                      : `\n90%: ${n0(d.p.rawLo)} ${to} ${n0(d.p.rawHi)}`;
                  return `${d.year}${d.p.provisional ? tr(' (so far, provisional)', ' (sejauh ini, sementara)') : ''}\n${d.k === 'H' ? tr('Harmonized', 'Terharmonisasi') : label[d.k]}: ${n0(d.v)}\n${n0(raw)} ${tr('fire cell-days', 'sel-hari api')}${d.k === 'H' ? `${how === '–' ? '' : `\n${how}`}${band}` : ''}`;
                },
              })),
            ],
          };
        }}
      />
      <ul className="ka-rec-key" aria-label={tr('Lines', 'Garis')}>
        <li><i className="ka-rec-sw ka-rec-sw-h" aria-hidden="true" />{tr(`One scale (MODIS + VIIRS, harmonized): ${words} (band: 90% range of the conversion)`, `Satu skala (MODIS + VIIRS, terharmonisasi): ${words} (pita: rentang 90% konversi)`)}</li>
        <li>{label.naive}:</li>
        <li><i className="ka-rec-sw ka-rec-sw-modis" aria-hidden="true" /><b>MODIS</b></li>
        <li><i className="ka-rec-sw ka-rec-sw-viirs" aria-hidden="true" /><b>VIIRS</b></li>
        <li><i className="ka-rec-sw ka-rec-sw-summed" aria-hidden="true" />{label.summed}</li>
      </ul>
      <details className="ka-rec-more">
        <summary>{tr('Does it depend on the years compared?', 'Apakah bergantung pada tahun yang dibandingkan?')}</summary>
      <StatGrid>
        <StatTile label={tr('Raw, stitched as recorded', 'Mentah, disambung apa adanya')} value={head.raw == null ? tr('n/a', 't/a') : pctText(head.raw, lang)}
          context={tr(`Mean of ${windowText} against ${earlyText}: MODIS before ${SEAM_YEAR}, VIIRS after`,
            `Rata-rata ${windowText} dibanding ${earlyText}: MODIS sebelum ${SEAM_YEAR}, VIIRS sesudahnya`)} />
        <StatTile label={tr('Harmonized (Aqua MODIS scale)', 'Terharmonisasi (skala Aqua MODIS)')} value={head.harm == null ? tr('n/a', 't/a') : pctText(head.harm, lang)}
          context={makeup.ownCount && lateOwn === lateYears.length
            ? tr(`The same years. Every one of them is Aqua MODIS's own count: this change involves no conversion. VIIRS is converted to the Aqua scale only from ${makeup.convertedFrom}`,
              `Tahun yang sama. Semuanya hitungan Aqua MODIS sendiri: perubahan ini tidak melibatkan konversi. VIIRS dikonversi ke skala Aqua baru sejak ${makeup.convertedFrom}`)
            : tr(`The same years. The line is ${words}`, `Tahun yang sama. Garis ini adalah ${words}`)} />
        <StatTile label={tr(`The jump in ${SEAM_YEAR}`, `Lonjakan pada ${SEAM_YEAR}`)} value={ratio ? `${fmtNumber(ratio.ratio, lang, 1)}×` : tr('n/a', 't/a')}
          context={ratio
            ? tr(`VIIRS fire cell-days per MODIS Aqua fire cell-day, same months ${ratio.from} to ${ratio.to}`,
              `Sel-hari api VIIRS per satu sel-hari api MODIS Aqua, bulan yang sama ${ratio.from} sampai ${ratio.to}`)
            : tr('Needs months where both satellites report', 'Perlu bulan saat kedua satelit sama-sama melapor')} />
      </StatGrid>
      <RobustStrip area={area} results={results} makeup={makeup} enso={enso} failed={failed} />
      <p className="ka-rec-note">
        {makeup.ownCount
          ? tr(
            `What the harmonized line is: to ${makeup.ownTo} it is Aqua MODIS's own count, with no conversion; only from ${makeup.convertedFrom} (the dashed line) is it VIIRS converted to the Aqua scale. So the change above shows that stitching two sensors misleads; it is not a test of our harmonization. That test is in How sure${failed ? `, where the ${makeup.convertedFrom} seam check fails` : ''}.`,
            `Apa garis terharmonisasi itu: sampai ${makeup.ownTo} garis ini adalah hitungan Aqua MODIS sendiri, tanpa konversi; baru sejak ${makeup.convertedFrom} (garis putus-putus) garis ini adalah VIIRS yang dikonversi ke skala Aqua. Jadi perubahan di atas menunjukkan bahwa menyambung dua sensor begitu saja menyesatkan; ini bukan uji atas harmonisasi kami. Uji itu ada di bagian Seberapa yakin${failed ? `, tempat uji sambungan ${makeup.convertedFrom} gagal` : ''}.`)
          : tr(
            `What the harmonized line is: values from ${makeup.convertedFrom} (the dashed line) are VIIRS converted to the Aqua MODIS scale${failed ? `; the ${makeup.convertedFrom} seam check in How sure fails` : ''}.`,
            `Apa garis terharmonisasi itu: nilai sejak ${makeup.convertedFrom} (garis putus-putus) adalah VIIRS yang dikonversi ke skala Aqua MODIS${failed ? `; uji sambungan ${makeup.convertedFrom} di bagian Seberapa yakin gagal` : ''}.`)}
      </p>
      {pooled ? (
        <p className="ka-rec-note">
          {tr(
            `No 90% range for ${area} from ${pooled.from}: these VIIRS months are converted with one national ratio (${pooled.ratio.toFixed(3)} Aqua MODIS fire cell-days per VIIRS one) and no interval. Indonesia and the island regions keep their ranges.`,
            `Tidak ada rentang 90% untuk ${area} sejak ${pooled.from}: bulan-bulan VIIRS ini dikonversi dengan satu rasio nasional (${fmtNumber(pooled.ratio, lang, 3)} sel-hari api Aqua MODIS per satu sel-hari api VIIRS) tanpa interval. Indonesia dan wilayah pulau tetap punya rentang.`)}
        </p>
      ) : null}
      </details>
    </div>
  );
}
