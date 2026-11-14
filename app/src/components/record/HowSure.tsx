// Project 4 (new file): "How sure" on the Indonesia record page, from Second Sight's validation_results.json
// (vendor/second-sight/app/src/yakin.ts): the error on held-out years, raw against harmonized, the level change at the
// 2012 seam, and every test with its result, failures first and in full. Nothing here is a placeholder: without the
// file the section says it is not built yet.
import { useMemo } from 'react';
import * as Plot from '@observablehq/plot';
import { Badge, Card, PlotFigure, cssVar } from '../ui';
import { dateOnly, fmtInt, fmt1, testStatus, trust, type TestStatus, type Validation } from '../../lib/record';

const HELD = { ape_2015: 'Held-out 2015', ape_2019: 'Held-out 2019', loyo_mdape: 'Every year (median)' } as const;
const ST_WORD: Record<TestStatus, string> = { pass: 'Pass', fail: 'Fail', not_run: 'Not run', na: 'Not applicable', info: 'Descriptive' };
const ST_TONE = { pass: 'good', fail: 'critical', not_run: 'neutral', na: 'neutral', info: 'neutral' } as const;
const ORDER: Record<TestStatus, number> = { fail: 0, pass: 1, not_run: 2, na: 3, info: 4 };

function num(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '–';
  const a = Math.abs(v);
  return a >= 100 ? fmtInt(v) : a >= 1 ? fmt1(v) : v.toFixed(3);
}
/** An error in % for the chart: whole numbers from 100, one decimal below (two under 0.1). */
const pctNum = (v: number) => (v >= 100 ? fmtInt(v) : v >= 0.1 ? fmt1(v) : v.toFixed(2));

export function HowSure({ v }: { v: Validation }) {
  const t = useMemo(() => trust(v), [v]);
  const run = dateOnly(v.meta?.run_utc);
  const source = `Source: Second Sight's validation run (validation_results.json${run ? `, run ${run}` : ''}${v.meta?.n_boot ? `, ${fmtInt(v.meta.n_boot)} bootstrap draws` : ''}).`;
  const counts = useMemo(() => {
    const c: Record<TestStatus, number> = { pass: 0, fail: 0, not_run: 0, na: 0, info: 0 };
    for (const r of v.results) c[testStatus(r)] += 1;
    return c;
  }, [v]);
  const listed = useMemo(() => v.results.map((r, i) => ({ r, i, s: testStatus(r) })).filter((x) => x.s !== 'info')
    .sort((a, b) => ORDER[a.s] - ORDER[b.s] || a.i - b.i), [v]);

  const bars = useMemo(() => {
    if (!t) return [];
    const keys = Object.keys(HELD) as (keyof typeof HELD)[];
    return keys.flatMap((k) => [
      { k: HELD[k], s: 'Raw', v: t.raw[k] ?? NaN },
      { k: HELD[k], s: 'Harmonized', v: t.harm[k] ?? NaN },
    ]).filter((x) => Number.isFinite(x.v) && x.v > 0);
  }, [t]);
  const mean = (s: string) => {
    const xs = bars.filter((b) => b.s === s).map((b) => b.v);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
  };

  return (
    <div className="ka-rec-sure">
      {t && bars.length ? (
        <PlotFigure
          title={`Error on years the fit never saw: ${fmtInt(mean('Raw'))}% raw, ${pctNum(mean('Harmonized'))}% harmonized (mean of the tests shown)`}
          subtitle={`Absolute percentage error of the yearly total on a year left out of the fit (2015, 2019, and the median over leaving out each year in turn), log scale. Raw = method M0, harmonized = ${t.chosen}.`}
          source={source}
          table={{ columns: ['Test', 'Raw (%)', 'Harmonized (%)'], rows: Object.values(HELD).map((k) => [k, num(bars.find((b) => b.k === k && b.s === 'Raw')?.v ?? null), num(bars.find((b) => b.k === k && b.s === 'Harmonized')?.v ?? null)]) }}
          height={230}
          deps={[bars]}
          build={(width) => {
            // a log axis has no zero: the bars start at its left end
            const lo = Math.pow(10, Math.floor(Math.log10(Math.min(...bars.map((b) => b.v)))));
            const hi = Math.max(...bars.map((b) => b.v)) * (width < 520 ? 4 : 2.5);
            return {
              height: 230, marginLeft: width < 520 ? 128 : 170, marginRight: 16,
              x: { type: 'log', label: 'error (%)', grid: true, domain: [lo, hi], tickFormat: (n: number) => (n >= 1 ? fmtInt(n) : String(n)) },
              y: { label: null, axis: null, padding: 0.18 },
              fy: { label: null, padding: 0.2 },
              color: { domain: ['Raw', 'Harmonized'], range: [cssVar('--text-3', '#7f908c'), cssVar('--harmonized', '#f2f3f5')] },
              marks: [
                Plot.barX(bars, { y: 's', x1: lo, x2: 'v', fy: 'k', fill: 's' }),
                Plot.text(bars, { y: 's', x: 'v', fy: 'k', text: (d: { s: string; v: number }) => `${d.s} ${pctNum(d.v)}%`, dx: 6, textAnchor: 'start', fontSize: 11, fill: cssVar('--text-2', '#a6b6b2') }),
              ],
            };
          }}
        />
      ) : (
        <p className="ka-rec-note">The held-out-year errors (the "ablation" of methods M0 and M3) are not in this validation file.</p>
      )}
      {t && t.raw.delta_seam_2012 != null && t.harm.delta_seam_2012 != null ? (
        <p className="ka-rec-note">
          Level change at the 2012 seam (MODIS to VIIRS, change of the log): raw {t.raw.delta_seam_2012.toFixed(2)},
          harmonized {t.harm.delta_seam_2012.toFixed(2)}. Zero would mean no jump at all.
        </p>
      ) : null}

      <Card title="Every test, as pre-written by Second Sight" subtitle="Rules written before the run; a failure is shown, not hidden">
        <p className="ka-rec-badges">
          <Badge tone="good">{counts.pass} passed</Badge>
          <Badge tone="critical">{counts.fail} failed</Badge>
          <Badge>{counts.not_run} not run</Badge>
          {counts.na ? <Badge>{counts.na} not applicable</Badge> : null}
          {counts.info ? <span className="ka-rec-note">{counts.info} descriptive results without a pass rule are not listed.</span> : null}
        </p>
        {listed.length ? (
          <div className="ui-table-wrap ka-rec-tests">
            <table className="ui-table">
              <thead>
                <tr><th scope="col">Test</th><th scope="col">What it measures</th><th scope="col" className="ui-num">Value</th><th scope="col">Rule</th><th scope="col">Result</th></tr>
              </thead>
              <tbody>
                {listed.map(({ r, s, i }) => (
                  <tr key={`${r.test_id}-${i}`} data-status={s}>
                    <th scope="row">{r.test_id}</th>
                    <td>{r.metric}{(s === 'fail' || s === 'not_run' || s === 'na') && r.notes ? <span className="ka-rec-test-why">{r.notes}</span> : null}</td>
                    <td className="ui-num">{num(r.value)}</td>
                    <td className="ka-rec-rule">{r.rule ?? '–'}</td>
                    <td><Badge tone={ST_TONE[s]}>{ST_WORD[s]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="ka-rec-note">The file has no tests with a pass rule.</p>}
        <p className="ui-figure-source">{source}</p>
      </Card>

      <Card title="Keep in mind">
        <ul className="ka-rec-mind">
          <li>A fire cell-day is a 0.01 degree cell (about 1 km) with at least one hotspot on a local date: not a fire event, not burned area.</li>
          <li>Fires under thick smoke, under cloud or smouldering in peat can be missed by every satellite. Where the calendar is hatched, a low count is not a measurement.</li>
          <li>Months marked provisional come from near-real-time data and may change.</li>
          <li>The VIIRS to MODIS ratio is assumed stable within each stratum, and years outside the calibration window (Aqua's drift from 2022) are less certain.</li>
        </ul>
      </Card>
    </div>
  );
}
