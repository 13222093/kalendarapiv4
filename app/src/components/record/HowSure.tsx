// KalenderApi: "How sure" on the Indonesia record page, from our validation run (public/ss-data/validation_results.json).
// Nothing here is a placeholder: without the file the section says it is not built yet, and a sentence whose rows are
// not in the file is not written.
// Fourth round (after the science review): evidence first, not a count. The order is (1) the error on a year left out
// of the fit, uncorrected against converted; (2) the chosen method beside the simpler ones, where it is not the best;
// (3) the seam checks, with the 2022 failure said plainly; (4) what each pre-written test decided and why the pass
// count is not a score; (5) every test in full. Every string is in English and Bahasa Indonesia (lib/lang.ts); rules,
// test names and notes are shown as the file has them.
import { useMemo } from 'react';
import * as Plot from '@observablehq/plot';
import { Badge, Card, PlotFigure, cssVar } from '../ui';
import { dateOnly, testStatus, trust, type Ablation, type TestRow, type TestStatus, type Validation } from '../../lib/record';
import { fmtNumber, useLang, useTr, type Lang, type Tr } from '../../lib/lang';
import '../../styles/robust.css';

type HeldKey = 'loyo_mdape' | 'ape_2015' | 'ape_2019';
const HELD_KEYS: HeldKey[] = ['loyo_mdape', 'ape_2015', 'ape_2019'];
const ST_TONE = { pass: 'good', fail: 'critical', not_run: 'neutral', na: 'neutral', info: 'neutral' } as const;
const ORDER: Record<TestStatus, number> = { fail: 0, pass: 1, not_run: 2, na: 3, info: 4 };
type Abl = Ablation & { sunset_kge?: number | null };

const heldName = (k: HeldKey, tr: Tr): string => (
  k === 'loyo_mdape' ? tr('Each year in turn (median)', 'Tiap tahun bergiliran (median)')
    : k === 'ape_2015' ? tr('2015 left out', '2015 disisihkan') : tr('2019 left out', '2019 disisihkan'));
const statusWord = (s: TestStatus, tr: Tr): string => (
  s === 'pass' ? tr('Pass', 'Lulus') : s === 'fail' ? tr('Fail', 'Gagal') : s === 'not_run' ? tr('Not run', 'Tidak dijalankan')
    : s === 'na' ? tr('Not applicable', 'Tidak berlaku') : tr('Descriptive', 'Deskriptif'));
/** The methods of the comparison, in plain words (our validation plan: "M0 raw concatenation; M1 single global ratio;
 *  M2 ratio per region x season; M3 strata + peat + day/night + EB; M3x M3 calibrated 2012-2025"; peat labels are
 *  unknown in this data, so M3 has no peat strata here). */
function methodName(id: string, tr: Tr): string {
  switch (id) {
    case 'M0': return tr('VIIRS as recorded, no conversion', 'VIIRS apa adanya, tanpa konversi');
    case 'M1': return tr('One ratio for everything', 'Satu rasio untuk semuanya');
    case 'M2': return tr('One ratio per region and season', 'Satu rasio per wilayah dan musim');
    case 'M3': return tr('Region, season and day or night strata, with shrinkage', 'Strata wilayah, musim, dan siang atau malam, dengan penyusutan');
    case 'M3x': return tr('As M3, fitted on 2012 to 2025', 'Seperti M3, dikalibrasi pada 2012 sampai 2025');
    default: return '';
  }
}
/** The pre-written tests that have a pass rule, in plain words (same plan). */
function testName(id: string, tr: Tr): string {
  switch (id) {
    case 'V1': return tr('a year left out', 'satu tahun disisihkan');
    case 'V2': return tr('a region left out', 'satu wilayah disisihkan');
    case 'V3': return tr('seams', 'sambungan');
    case 'V5': return tr('sunset test', 'uji setelah MODIS berhenti');
    case 'V10': return tr('high-fire month flags', 'penanda bulan api tinggi');
    case 'V12': return tr('rank of the years', 'peringkat tahun');
    default: return '';
  }
}

function num(v: number | null | undefined, lang: Lang): string {
  if (v == null || !Number.isFinite(v)) return '–';
  const a = Math.abs(v);
  return a >= 100 ? fmtNumber(v, lang) : a >= 1 ? fmtNumber(v, lang, 1) : fmtNumber(v, lang, 3);
}
function interval(r: TestRow): [number, number] | null {
  const ci = r.ci;
  if (!Array.isArray(ci) || ci.length < 2 || typeof ci[0] !== 'number' || typeof ci[1] !== 'number') return null;
  return [ci[0], ci[1]];
}
/** The range of placebo seams, from a seam row's notes ("placebo90=[-0.240,0.047]"). */
function placebo(r: TestRow): [number, number] | null {
  const m = /placebo90=\[(-?[\d.]+),(-?[\d.]+)\]/.exec(r.notes ?? '');
  return m ? [Number(m[1]), Number(m[2])] : null;
}
/** An error in %: whole numbers from 100, one decimal below (two under 0.1). */
const pctNum = (v: number, lang: Lang) => (v >= 100 ? fmtNumber(v, lang) : v >= 0.1 ? fmtNumber(v, lang, 1) : fmtNumber(v, lang, 2));
const signed = (v: number, lang: Lang) => `${v >= 0 ? '+' : '−'}${fmtNumber(Math.abs(v), lang, 3)}`;

export function HowSure({ v }: { v: Validation }) {
  const tr = useTr();
  const lang = useLang();
  const to = tr('to', 'sampai');
  const and = tr('and', 'dan');
  const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ${and} ${xs[xs.length - 1]}`);
  const dec3 = (x: number) => `${x < 0 ? '−' : ''}${fmtNumber(Math.abs(x), lang, 3)}`;   // a true minus sign
  const range = (r: [number, number] | null) => (r ? `${dec3(r[0])} ${to} ${dec3(r[1])}` : null);
  const pc = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? '–' : pctNum(x, lang));

  const t = useMemo(() => trust(v), [v]);
  const chosen = v.meta?.chosen_method ?? 'M3';
  const abl = useMemo(() => (v.meta?.ablation ?? []) as Abl[], [v]);
  const run = dateOnly(v.meta?.run_utc, lang);
  const source = tr(
    `Source: our validation run (validation_results.json${run ? `, run ${run}` : ''}${v.meta?.n_boot ? `, ${fmtNumber(v.meta.n_boot, lang)} bootstrap draws` : ''}).`,
    `Sumber: validasi kami (validation_results.json${run ? `, dijalankan ${run}` : ''}${v.meta?.n_boot ? `, ${fmtNumber(v.meta.n_boot, lang)} ulangan bootstrap` : ''}).`);
  const counts = useMemo(() => {
    const c: Record<TestStatus, number> = { pass: 0, fail: 0, not_run: 0, na: 0, info: 0 };
    for (const r of v.results) c[testStatus(r)] += 1;
    return c;
  }, [v]);
  const listed = useMemo(() => v.results.map((r, i) => ({ r, i, s: testStatus(r) })).filter((x) => x.s !== 'info')
    .sort((a, b) => ORDER[a.s] - ORDER[b.s] || a.i - b.i), [v]);
  const find = (id: string, ...parts: string[]) => v.results.find((r) => r.test_id === id && parts.every((p) => r.metric.includes(p)));
  const seam2012 = find('V3', 'seam 2012-01', `${chosen}/switch2012`);
  const seam2022 = find('V3', 'seam 2022-01', `${chosen}/main`);
  const seam2022Fails = seam2022 != null && testStatus(seam2022) === 'fail';
  const featured: (TestRow | undefined)[] = [seam2022, seam2012];
  // the years the conversion was fitted on, as the file's own notes give them ("fitted in-sample 2012-2021")
  const fitYears = useMemo(() => {
    for (const r of v.results) {
      const m = /fitted in-sample (\d{4})-(\d{4})/.exec(r.notes ?? '');
      if (m) return [m[1]!, m[2]!] as const;
    }
    return null;
  }, [v]);

  // ---- 1. held-out years: uncorrected (M0) against the chosen method
  const sUn = tr('Uncorrected', 'Tanpa koreksi'), sConv = tr('Converted', 'Dikonversi');
  const bars = !t ? [] : HELD_KEYS.flatMap((k) => [
    { k: heldName(k, tr), s: sUn, v: t.raw[k] ?? NaN },
    { k: heldName(k, tr), s: sConv, v: t.harm[k] ?? NaN },
  ]).filter((x) => Number.isFinite(x.v) && x.v > 0);
  const loyoRaw = t?.raw.loyo_mdape, loyoHarm = t?.harm.loyo_mdape;

  // ---- 2. the chosen method beside the simpler ones
  const converted = abl.filter((a) => a.method !== 'M0');
  const best = (k: HeldKey): Abl | null => {
    const xs = converted.filter((a) => a[k] != null && Number.isFinite(a[k]!));
    return xs.length ? xs.reduce((m, a) => (a[k]! < m[k]! ? a : m)) : null;
  };
  const bestLoyo = best('loyo_mdape'), best2015 = best('ape_2015'), best2019 = best('ape_2019');
  const me = abl.find((a) => a.method === chosen) ?? null;
  const better = me?.loyo_mdape != null
    ? converted.filter((a) => a.method !== chosen && a.loyo_mdape != null && a.loyo_mdape < me.loyo_mdape!).sort((a, b) => a.loyo_mdape! - b.loyo_mdape!)
    : [];
  const betterNotM1 = better.filter((a) => a.method !== 'M1').map((a) => a.method);
  const v1Decision = find('V1', 'decision');
  const sunset = find('V5', 'decision');
  const m1 = abl.find((a) => a.method === 'M1') ?? null;
  const hasSunset = abl.some((a) => a.sunset_kge != null);

  // ---- 4. what each pre-written test decided for the chosen method, and what the pass count hides
  const decisions = useMemo(() => {
    const ids: string[] = [];
    for (const r of v.results) if (!ids.includes(r.test_id)) ids.push(r.test_id);
    ids.sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, '')));
    return ids.flatMap((id) => {
      const rows = v.results.filter((r) => r.test_id === id && (testStatus(r) === 'pass' || testStatus(r) === 'fail'));
      const d = rows.find((r) => r.metric.toLowerCase().includes('decision')) ?? (rows.length === 1 ? rows[0] : undefined);
      return d ? [{ id, row: d, s: testStatus(d) }] : [];
    });
  }, [v]);
  const passIds = decisions.filter((d) => d.s === 'pass').map((d) => d.id);
  const failIds = decisions.filter((d) => d.s === 'fail').map((d) => d.id);
  // a rank test that the uncorrected data passes too: "<name> Spearman M0" passes, and so do its sister rows
  const rank = useMemo(() => {
    const m0 = v.results.find((r) => testStatus(r) === 'pass' && /Spearman\s+M0\b/.test(r.metric));
    if (!m0) return null;
    const stem = m0.metric.replace(/M0\b.*$/, '');
    const group = v.results.filter((r) => r.test_id === m0.test_id && r.metric.startsWith(stem) && testStatus(r) === 'pass');
    const same = group.every((r) => r.value != null && m0.value != null && Math.abs(r.value - m0.value) < 1e-9);
    return { n: group.length, id: m0.test_id, rule: m0.rule ?? null, same };
  }, [v]);
  const m0Fails = useMemo(() => v.results.filter((r) => testStatus(r) === 'fail' && /\bM0\b/.test(r.metric)).length, [v]);
  const loroFails = v.results
    .filter((r) => r.test_id === 'V2' && testStatus(r) === 'fail' && r.value != null && r.metric.includes(chosen))
    .map((r) => `${r.metric.replace(/^.*\bM\d\w*\s+/, '')} ${pctNum(r.value!, lang)}%`);
  const loroAll = v.results.filter((r) => r.test_id === 'V2' && r.value != null && (testStatus(r) === 'pass' || testStatus(r) === 'fail')).length;
  const noBurnedArea = v.results.some((r) => /MCD64A1 not available/.test(r.notes ?? ''));

  const heldRow = (k: HeldKey) => [
    heldName(k, tr),
    pc(t?.raw[k]), pc(t?.harm[k]),
  ];

  return (
    <div className="ka-rec-sure">
      {t && bars.length ? (
        <PlotFigure
          title={loyoRaw != null && loyoHarm != null
            ? tr(`On a year left out of the fit, the yearly total is off by ${pctNum(loyoRaw, lang)}% uncorrected and ${pctNum(loyoHarm, lang)}% converted (median over each year in turn)`,
              `Pada tahun yang disisihkan dari kalibrasi, total tahunan meleset ${pctNum(loyoRaw, lang)}% tanpa koreksi dan ${pctNum(loyoHarm, lang)}% setelah dikonversi (median atas tiap tahun bergiliran)`)
            : tr('Error on a year left out of the fit: uncorrected against converted', 'Galat pada tahun yang disisihkan dari kalibrasi: tanpa koreksi dibanding dikonversi')}
          subtitle={tr(
            `How far the predicted yearly total is from Aqua MODIS's own count in a year the fit never saw (absolute percentage error, log scale): the median over leaving out each year of the fit in turn, then 2015 and 2019 alone. Uncorrected = VIIRS as recorded (method M0). Converted = the chosen method (${t.chosen}).`,
            `Seberapa jauh total tahunan hasil prediksi dari hitungan Aqua MODIS sendiri pada tahun yang tidak dipakai dalam kalibrasi (galat persentase absolut, skala log): median saat tiap tahun kalibrasi disisihkan bergiliran, lalu 2015 dan 2019 saja. Tanpa koreksi = VIIRS apa adanya (metode M0). Dikonversi = metode terpilih (${t.chosen}).`)}
          source={source}
          table={{ columns: [tr('Test', 'Uji'), tr('Uncorrected (%)', 'Tanpa koreksi (%)'), tr('Converted (%)', 'Dikonversi (%)')], rows: HELD_KEYS.map(heldRow) }}
          height={230}
          deps={[v, lang]}
          build={(width) => {
            // a log axis has no zero: the bars start at its left end
            const lo = Math.pow(10, Math.floor(Math.log10(Math.min(...bars.map((b) => b.v)))));
            const hi = Math.max(...bars.map((b) => b.v)) * (width < 520 ? 8 : 3);
            return {
              height: 230, marginLeft: width < 520 ? 128 : 200, marginRight: 16,
              x: { type: 'log', label: tr('error (%)', 'galat (%)'), grid: true, domain: [lo, hi], tickFormat: (n: number) => (n >= 1 ? fmtNumber(n, lang) : String(n)) },
              y: { label: null, axis: null, padding: 0.18, domain: [sUn, sConv] },
              fy: { label: null, padding: 0.2, domain: HELD_KEYS.map((k) => heldName(k, tr)) },
              color: { domain: [sUn, sConv], range: [cssVar('--text-3', '#a79b86'), cssVar('--harmonized', '#f05a28')] },
              marks: [
                Plot.barX(bars, { y: 's', x1: lo, x2: 'v', fy: 'k', fill: 's' }),
                Plot.text(bars, { y: 's', x: 'v', fy: 'k', text: (d: { s: string; v: number }) => `${d.s} ${pctNum(d.v, lang)}%`, dx: 6, textAnchor: 'start', fontSize: 11, fill: cssVar('--text-2', '#d6cab5') }),
              ],
            };
          }}
        />
      ) : (
        <p className="ka-rec-note">{tr(`The held-out-year errors (methods M0 and ${chosen}) are not in this validation file.`, `Galat tahun yang disisihkan (metode M0 dan ${chosen}) tidak ada dalam berkas validasi ini.`)}</p>
      )}

      {me && abl.length > 1 ? (
        <Card title={tr('The chosen method beside simpler ones', 'Metode terpilih di samping metode yang lebih sederhana')}
          subtitle={tr('The same held-out tests for every method the run compared', 'Uji yang sama untuk setiap metode yang dibandingkan')}>
          <p className="ka-sure-lead">
            {better.length ? (
              <><strong>{tr(`The chosen method (${chosen}) is not the best on held-out years.`, `Metode terpilih (${chosen}) bukan yang terbaik pada tahun yang disisihkan.`)}</strong>{' '}
                {tr(`Its median error is ${pctNum(me.loyo_mdape!, lang)}%; ${list(better.map((a) => `${a.method} (${methodName(a.method, tr).toLowerCase()}) has ${pctNum(a.loyo_mdape!, lang)}%`))}.`,
                  `Galat mediannya ${pctNum(me.loyo_mdape!, lang)}%; ${list(better.map((a) => `${a.method} (${methodName(a.method, tr).toLowerCase()}) ${pctNum(a.loyo_mdape!, lang)}%`))}.`)}</>
            ) : me.loyo_mdape != null ? (
              tr(`The chosen method (${chosen}) has the lowest median error on held-out years of the methods compared (${pctNum(me.loyo_mdape, lang)}%).`,
                `Metode terpilih (${chosen}) punya galat median terendah pada tahun yang disisihkan di antara metode yang dibandingkan (${pctNum(me.loyo_mdape, lang)}%).`)
            ) : null}
            {bestLoyo && best2015 && best2019 && new Set([bestLoyo.method, best2015.method, best2019.method]).size > 1
              ? tr(` No method is lowest in every column: ${bestLoyo.method} on the median (${pctNum(bestLoyo.loyo_mdape!, lang)}%), ${best2015.method} for 2015 (${pctNum(best2015.ape_2015!, lang)}%), ${best2019.method} for 2019 (${pctNum(best2019.ape_2019!, lang)}%).`,
                ` Tidak ada metode yang terendah di semua kolom: ${bestLoyo.method} pada median (${pctNum(bestLoyo.loyo_mdape!, lang)}%), ${best2015.method} untuk 2015 (${pctNum(best2015.ape_2015!, lang)}%), ${best2019.method} untuk 2019 (${pctNum(best2019.ape_2019!, lang)}%).`)
              : ''}
          </p>
          {sunset && testStatus(sunset) === 'fail' && me.sunset_kge != null && m1?.sunset_kge != null ? (
            <p className="ka-sure-lead">
              {tr(`On the sunset test (fit on the early years, rebuild the later years from VIIRS alone) ${chosen} scores ${fmtNumber(me.sunset_kge, lang, 3)}, below one ratio for everything (M1, ${fmtNumber(m1.sunset_kge, lang, 3)}), so it fails its rule`,
                `Pada uji setelah MODIS berhenti (kalibrasi pada tahun-tahun awal, lalu tahun-tahun berikutnya dibangun ulang dari VIIRS saja) ${chosen} mendapat ${fmtNumber(me.sunset_kge, lang, 3)}, di bawah satu rasio untuk semuanya (M1, ${fmtNumber(m1.sunset_kge, lang, 3)}), sehingga gagal memenuhi aturannya`)}
              {sunset.rule ? <> (<span className="ka-rec-rule">{sunset.rule}</span>)</> : null}.
            </p>
          ) : null}
          {v1Decision && testStatus(v1Decision) === 'pass' && v1Decision.rule ? (
            <p className="ka-sure-lead">
              {tr(`Why we kept ${chosen}: the rule we wrote before the run compares it with M1 only`, `Mengapa kami tetap memakai ${chosen}: aturan yang kami tulis sebelum pengujian hanya membandingkannya dengan M1`)}
              {' '}(<span className="ka-rec-rule">{v1Decision.rule}</span>){tr(', and it passes that rule.', ', dan metode ini lulus aturan itu.')}
              {betterNotM1.length ? tr(` ${list(betterNotM1)} was not part of the rule.`, ` ${list(betterNotM1)} tidak termasuk dalam aturan itu.`) : ''}
            </p>
          ) : null}
          <p className="ka-rec-note ka-sure-cols">
            {tr(
              `Columns: the error on a year left out of the fit, as the median over each year in turn, then for 2015 and for 2019 alone${hasSunset ? '; and the sunset test score (KGE, where 1 is best)' : ''}.`,
              `Kolom: galat pada tahun yang disisihkan dari kalibrasi, berupa median saat tiap tahun disisihkan bergiliran, lalu untuk 2015 dan 2019 saja${hasSunset ? '; serta skor uji setelah MODIS berhenti (KGE, 1 terbaik)' : ''}.`)}
          </p>
          <div className="ui-table-wrap ka-sure-table">
            <table className="ui-table">
              <thead>
                <tr>
                  <th scope="col">{tr('Method', 'Metode')}</th>
                  <th scope="col" className="ui-num">{tr('Median (%)', 'Median (%)')}</th>
                  <th scope="col" className="ui-num">{tr('2015 (%)', '2015 (%)')}</th>
                  <th scope="col" className="ui-num">{tr('2019 (%)', '2019 (%)')}</th>
                  {hasSunset ? <th scope="col" className="ui-num" data-col="sunset">{tr('Sunset (KGE)', 'Setelah MODIS (KGE)')}</th> : null}
                </tr>
              </thead>
              <tbody>
                {abl.map((a) => (
                  <tr key={a.method} data-chosen={a.method === chosen} data-best={bestLoyo?.method === a.method}>
                    <th scope="row">{a.method}{a.method === chosen ? tr(' (chosen)', ' (terpilih)') : ''}<span className="ka-rec-test-why">{methodName(a.method, tr)}</span></th>
                    <td className="ui-num" data-col="loyo">{pc(a.loyo_mdape)}</td>
                    <td className="ui-num">{pc(a.ape_2015)}</td>
                    <td className="ui-num">{pc(a.ape_2019)}</td>
                    {hasSunset ? <td className="ui-num" data-col="sunset">{a.sunset_kge == null ? '–' : fmtNumber(a.sunset_kge, lang, 3)}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="ui-figure-source">
            {source} {tr('Lower error is better; the lowest median of the converted methods is in bold.', 'Galat lebih rendah lebih baik; median terendah di antara metode konversi dicetak tebal.')}
          </p>
        </Card>
      ) : null}

      <Card title={tr('The seams', 'Sambungan')}
        subtitle={tr('Does the level of the record change where the satellite behind it changes?', 'Apakah tingkat rekaman berubah saat satelit di baliknya berganti?')}>
        {seam2022 && seam2022Fails ? (
          <p className="ka-sure-lead">
            <strong>{tr('The 2022 seam check fails.', 'Uji sambungan 2022 gagal.')}</strong>{' '}
            {tr(
              `In January 2022 the record goes from Aqua MODIS's own count to converted VIIRS. The level change there is ${seam2022.value == null ? 'not estimated' : signed(seam2022.value, lang)}${interval(seam2022) ? ` (90% interval ${range(interval(seam2022))})` : ''}${placebo(seam2022) ? `, outside the range of seams placed where no satellite changes (${range(placebo(seam2022))})` : ''}. Every value from 2022 on sits on this seam.`,
              `Pada Januari 2022 rekaman beralih dari hitungan Aqua MODIS sendiri ke VIIRS yang dikonversi. Perubahan tingkat di sana ${seam2022.value == null ? 'tidak diestimasi' : signed(seam2022.value, lang)}${interval(seam2022) ? ` (interval 90% ${range(interval(seam2022))})` : ''}${placebo(seam2022) ? `, di luar rentang sambungan semu yang ditempatkan saat tidak ada pergantian satelit (${range(placebo(seam2022))})` : ''}. Setiap nilai sejak 2022 berada di atas sambungan ini.`)}
          </p>
        ) : seam2022 ? (
          <p className="ka-sure-lead">{tr(`The 2022 seam check (Aqua MODIS's own count to converted VIIRS): ${statusWord(testStatus(seam2022), tr).toLowerCase()}.`, `Uji sambungan 2022 (dari hitungan Aqua MODIS sendiri ke VIIRS yang dikonversi): ${statusWord(testStatus(seam2022), tr).toLowerCase()}.`)}</p>
        ) : (
          <p className="ka-sure-lead">{tr('The 2022 seam check of the chosen method is not in this validation file.', 'Uji sambungan 2022 untuk metode terpilih tidak ada dalam berkas validasi ini.')}</p>
        )}
        {seam2012 ? (
          <p className="ka-sure-lead">
            {tr(
              `The 2012 check ${testStatus(seam2012) === 'pass' ? 'passes' : testStatus(seam2012) === 'fail' ? 'fails' : 'has no result'}${seam2012.value != null ? ` (${signed(seam2012.value, lang)}${placebo(seam2012) ? `, placebo range ${range(placebo(seam2012))}` : ''})` : ''}. It is run on a variant that switches to converted VIIRS in 2012${fitYears ? `, inside the years the conversion was fitted on (${fitYears[0]} to ${fitYears[1]})` : ''}, and its reference is Aqua MODIS itself: it is not a test on unseen data, and it does not cancel the 2022 result.`,
              `Uji 2012 ${testStatus(seam2012) === 'pass' ? 'lulus' : testStatus(seam2012) === 'fail' ? 'gagal' : 'tidak punya hasil'}${seam2012.value != null ? ` (${signed(seam2012.value, lang)}${placebo(seam2012) ? `, rentang sambungan semu ${range(placebo(seam2012))}` : ''})` : ''}. Uji ini dijalankan pada varian yang beralih ke VIIRS terkonversi pada 2012${fitYears ? `, di dalam tahun-tahun kalibrasi konversi (${fitYears[0]} sampai ${fitYears[1]})` : ''}, dan acuannya adalah Aqua MODIS sendiri: ini bukan uji pada data yang belum dilihat, dan tidak membatalkan hasil 2022.`)}
            {t && t.raw.delta_seam_2012 != null
              ? tr(` With no conversion (M0) the 2012 change is ${signed(t.raw.delta_seam_2012, lang)}.`, ` Tanpa konversi (M0), perubahan pada 2012 adalah ${signed(t.raw.delta_seam_2012, lang)}.`)
              : ''}
          </p>
        ) : null}
        <div className="ka-rec-featured-tests">
          {featured.map((r, i) => r ? (
            <article className="ka-rec-featured-test" data-status={testStatus(r)} key={r.test_id + '-' + i}>
              <div className="ka-rec-featured-head">
                <strong>{r.metric}</strong>
                <Badge tone={ST_TONE[testStatus(r)]}>{statusWord(testStatus(r), tr)}</Badge>
              </div>
              <p className="ka-rec-featured-value">{r.value == null ? tr('No estimate', 'Tanpa estimasi') : num(r.value, lang)}</p>
              {interval(r) ? <p className="ka-rec-featured-ci">{tr('90% interval', 'Interval 90%')}: {range(interval(r))}</p> : null}
              <p className="ka-rec-rule"><strong>{tr('Rule', 'Aturan')}:</strong> {r.rule ?? tr('No pass rule recorded.', 'Tidak ada aturan lulus yang tercatat.')}</p>
              {r.notes ? <p className="ka-rec-test-why">{r.notes}</p> : null}
            </article>
          ) : null)}
        </div>
        <p className="ui-figure-source">
          {source} {tr(
            'Level change: the mean of log(record + 1) minus log(Aqua MODIS + 1) over the 12 months after the seam, minus the 12 months before. Zero means no change.',
            'Perubahan tingkat: rata-rata log(rekaman + 1) dikurangi log(Aqua MODIS + 1) selama 12 bulan setelah sambungan, dikurangi 12 bulan sebelumnya. Nol berarti tidak ada perubahan.')}
        </p>
      </Card>

      <Card title={tr('What the pre-written tests decided', 'Apa yang diputuskan uji yang ditulis lebih dulu')}
        subtitle={tr('One decision per test for the chosen method, then every row', 'Satu keputusan per uji untuk metode terpilih, lalu setiap baris')}>
        {decisions.length ? (
          <>
            <p className="ka-sure-lead">
              {failIds.length
                ? tr(`The chosen method (${chosen}) fails ${list(failIds)}`, `Metode terpilih (${chosen}) gagal pada ${list(failIds)}`)
                : tr(`The chosen method (${chosen}) fails none of its decisions`, `Metode terpilih (${chosen}) tidak gagal pada satu pun keputusannya`)}
              {passIds.length ? tr(` and passes ${list(passIds)}.`, ` dan lulus pada ${list(passIds)}.`) : '.'}
            </p>
            <ul className="ka-sure-decisions">
              {decisions.map((d) => (
                <li key={d.id}>
                  <span>{d.id}{testName(d.id, tr) ? `, ${testName(d.id, tr)}` : ''}</span>
                  <Badge tone={ST_TONE[d.s]}>{statusWord(d.s, tr)}</Badge>
                  {d.row.rule ? <span className="ka-rec-rule">{d.row.rule}</span> : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <p className="ka-rec-note">
          {tr(
            `The file has ${fmtNumber(v.results.length, lang)} rows: ${counts.pass} pass, ${counts.fail} fail, ${counts.not_run} were not run, ${counts.na} do not apply and ${counts.info} are descriptive, with no pass rule. The pass count is not a score.`,
            `Berkas ini berisi ${fmtNumber(v.results.length, lang)} baris: ${counts.pass} lulus, ${counts.fail} gagal, ${counts.not_run} tidak dijalankan, ${counts.na} tidak berlaku, dan ${counts.info} deskriptif tanpa aturan lulus. Jumlah yang lulus bukanlah skor.`)}
          {rank && rank.n > 1 ? tr(
            ` ${rank.n} of the ${counts.pass} passes are one rank test (${rank.id}${rank.rule ? `, Spearman ${rank.rule}` : ''}) on ${rank.n} methods, and the uncorrected data (M0) passes it too${rank.same ? ', with the same value' : ''}: a rank test does not see a change of scale.`,
            ` ${rank.n} dari ${counts.pass} yang lulus adalah satu uji peringkat (${rank.id}${rank.rule ? `, Spearman ${rank.rule}` : ''}) pada ${rank.n} metode, dan data tanpa koreksi (M0) juga lulus${rank.same ? ' dengan nilai yang sama' : ''}: uji peringkat tidak melihat perubahan skala.`) : ''}
          {m0Fails ? tr(
            ` ${m0Fails} of the ${counts.fail} failures ${m0Fails === 1 ? 'is' : 'are'} the uncorrected data (M0) failing, as expected.`,
            ` ${m0Fails} dari ${counts.fail} yang gagal adalah data tanpa koreksi (M0), sesuai dugaan.`) : ''}
        </p>
        <p className="ui-figure-source">
          {source} <a href={import.meta.env.BASE_URL + 'ss-data/validation_results.json'} download>{tr('Download the full validation JSON', 'Unduh JSON validasi lengkap')}</a>.
        </p>
        <details className="ka-rec-all-tests">
          <summary>{tr(`Open every test with a pass rule (${listed.length} rows; the ${counts.info} descriptive rows are in the JSON)`, `Buka setiap uji yang punya aturan lulus (${listed.length} baris; ${counts.info} baris deskriptif ada di JSON)`)}</summary>
          {listed.length ? (
            <div className="ui-table-wrap ka-rec-tests">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th scope="col">{tr('Test', 'Uji')}</th><th scope="col">{tr('What it measures', 'Yang diukur')}</th>
                    <th scope="col" className="ui-num">{tr('Value', 'Nilai')}</th><th scope="col">{tr('Rule', 'Aturan')}</th><th scope="col">{tr('Result', 'Hasil')}</th>
                  </tr>
                </thead>
                <tbody>
                  {listed.map(({ r, s, i }) => (
                    <tr key={r.test_id + '-' + i} data-status={s}>
                      <th scope="row">{r.test_id}</th>
                      <td>{r.metric}{(s === 'fail' || s === 'not_run' || s === 'na') && r.notes ? <span className="ka-rec-test-why">{r.notes}</span> : null}</td>
                      <td className="ui-num">{num(r.value, lang)}</td>
                      <td className="ka-rec-rule">{r.rule ?? '–'}</td>
                      <td><Badge tone={ST_TONE[s]}>{statusWord(s, tr)}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="ka-rec-note">{tr('The file has no tests with a pass rule.', 'Berkas ini tidak berisi uji yang punya aturan lulus.')}</p>}
        </details>
      </Card>

      <Card title={tr('Limits that affect this result', 'Batasan yang memengaruhi hasil ini')}>
        <ul className="ka-rec-mind">
          <li>{tr(
            'To 2021 the harmonized record is Aqua MODIS\'s own count, so the long-run change shown above does not test our harmonization. Only the checks on this page test it.',
            'Sampai 2021, rekaman terharmonisasi adalah hitungan Aqua MODIS sendiri, sehingga perubahan jangka panjang di atas tidak menguji harmonisasi kami. Hanya uji di halaman ini yang mengujinya.')}</li>
          {seam2022Fails ? <li>{tr('Values from 2022 on are converted VIIRS and sit on the 2022 seam check, which fails.', 'Nilai sejak 2022 adalah VIIRS yang dikonversi dan berada di atas sambungan 2022, yang ujinya gagal.')}</li> : null}
          {loroFails.length ? <li>{tr(
            `Leaving a region out of the fit fails in ${loroFails.length} of ${loroAll} regions (${list(loroFails)}): a ratio fitted elsewhere does not transfer well.`,
            `Menyisihkan satu wilayah dari kalibrasi gagal di ${loroFails.length} dari ${loroAll} wilayah (${list(loroFails)}): rasio yang dikalibrasi di tempat lain tidak berpindah dengan baik.`)}</li> : null}
          {noBurnedArea ? <li>{tr(
            'Every seam check uses Aqua MODIS itself as the reference; no burned-area product was used (MCD64A1 was not available in the run).',
            'Setiap uji sambungan memakai Aqua MODIS sendiri sebagai acuan; tidak ada produk area terbakar yang dipakai (MCD64A1 tidak tersedia saat pengujian).')}</li> : null}
          <li>{tr(
            'The cloud layer covers nine Central Kalimantan months only. It flags cloud; thick smoke is not flagged. Peat labels are unknown, so the peat tests were not run, and we estimate no hidden-fire count.',
            'Lapisan awan hanya mencakup sembilan bulan di Kalimantan Tengah. Lapisan ini menandai awan; asap tebal tidak ditandai. Label gambut tidak diketahui, sehingga uji gambut tidak dijalankan, dan kami tidak mengestimasi jumlah api tersembunyi.')}</li>
          <li>{tr(
            'A fire cell-day is a 0.01 degree cell with a detected hotspot on a local date, counted per satellite and per day or night pass, so a cell that burns day and night counts twice. It is not a unique fire event or burned area. Provisional months may change.',
            'Satu sel-hari api adalah sel 0,01 derajat dengan titik panas terdeteksi pada satu tanggal lokal, dihitung per satelit dan per lintasan siang atau malam, sehingga sel yang terbakar siang dan malam terhitung dua kali. Ini bukan kejadian kebakaran tunggal atau luas terbakar. Bulan yang masih sementara dapat berubah.')}</li>
        </ul>
      </Card>
    </div>
  );
}
