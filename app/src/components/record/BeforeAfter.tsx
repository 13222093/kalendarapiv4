// Project 4 (new file): "Before and after" on the Indonesia record page. Second Sight's definitions
// (vendor/second-sight/app/src/beforeafter.ts, computed in lib/record.ts beforeAfter): the raw record stitched as
// recorded (MODIS to 2011, VIIRS from 2012), the two sensors added together (wrong), and the harmonized record with its
// 90% band, each indexed to its own 2003-2011 mean. Drawn in the house chart style (PlotFigure, DESIGN.md section 4).
import { useMemo } from 'react';
import * as Plot from '@observablehq/plot';
import { PlotFigure, StatGrid, StatTile, cssVar } from '../ui';
import {
  SEAM_YEAR, fmtInt, fmt1, signedPct, type BeforeAfter as BA, type Finding, type YearPoint,
} from '../../lib/record';

type Key = 'summed' | 'naive' | 'H';
const LABEL: Record<Key, string> = { summed: 'Added together (wrong)', naive: 'Raw, stitched as recorded', H: 'Harmonized, 90% range' };

function beforeAfterTitle(area: string, ba: BA): string {
  const n = ba.changeNaive, h = ba.changeH;
  if (n == null || h == null) return `${area}: the record before and after harmonization`;
  const verb = (x: number, rise: string, fall: string) => (x >= 0 ? rise : fall);
  return `${area}: stitched as recorded, fire seems to ${verb(n, 'rise', 'fall')} ${fmtInt(Math.abs(n))}%; on one scale it ${verb(h, 'rises', 'falls')} ${fmtInt(Math.abs(h))}%`;
}

export function BeforeAfterFigure({ area, ba, source, ratio, finding }: {
  area: string; ba: BA; source: string;
  ratio: { ratio: number; from: number; to: number } | null;
  finding: Finding | null;
}) {
  const pts = ba.points;
  const solid = useMemo(() => pts.filter((p) => !p.provisional), [pts]);
  const tail = useMemo(() => {
    const i = pts.findIndex((p) => p.provisional);
    return i > 0 ? pts.slice(i - 1) : [];
  }, [pts]);
  const lastProv = pts.find((p) => p.provisional) ?? null;
  const national = finding?.regions?.national?.trend_2001_2025 ?? null;

  const table = useMemo(() => ({
    columns: ['Year', 'Raw, stitched (fire cell-days)', 'Added together', 'Harmonized', '90% range'],
    rows: pts.map((p) => [
      p.provisional ? `${p.year} (so far)` : String(p.year), fmtInt(p.rawNaive), fmtInt(p.rawSummed), fmtInt(p.rawH),
      `${fmtInt(p.rawLo)} to ${fmtInt(p.rawHi)}`,
    ]),
  }), [pts]);

  return (
    <div className="ka-rec-ba">
      <StatGrid>
        <StatTile label="Raw, stitched as recorded" value={ba.changeNaive == null ? 'n/a' : signedPct(ba.changeNaive)}
          context="Mean of 2019 to 2023 against 2003 to 2007, MODIS before 2012 and VIIRS after" />
        <StatTile label="Harmonized, one scale" value={ba.changeH == null ? 'n/a' : signedPct(ba.changeH)}
          context="The same years, with VIIRS put on the Aqua MODIS scale" />
        <StatTile label="The jump in 2012" value={ratio ? `${fmt1(ratio.ratio)}×` : 'n/a'}
          context={ratio ? `VIIRS fire cell-days per MODIS Aqua fire cell-day, same months ${ratio.from} to ${ratio.to}` : 'Needs months where both satellites report'} />
      </StatGrid>
      <PlotFigure
        title={beforeAfterTitle(area, ba)}
        subtitle="Fire cell-days a year, each line indexed to its own 2003 to 2011 mean (= 100). Band: the harmonized line's 90% range (sum of the monthly bounds, an approximation)."
        source={source}
        table={table}
        height={300}
        deps={[pts]}
        build={(width) => {
          const narrow = width < 640;
          const c = { naive: cssVar('--sensor-snpp', '#e8693a'), summed: cssVar('--text-3', '#7f908c'), H: cssVar('--harmonized', '#f2f3f5') };
          const muted = cssVar('--text-3', '#7f908c');
          const endPt = solid[solid.length - 1];
          const ends = endPt ? (['summed', 'naive', 'H'] as Key[]).map((k) => ({ year: endPt.year, v: endPt[k], label: LABEL[k], k })) : [];
          const yMax = Math.max(100, ...pts.map((p) => Math.max(p.naive, p.summed, p.hi)));
          const sorted = ends.map((e) => e.v).sort((a, b) => a - b);
          const spread = sorted.every((v, i) => i === 0 || (v - sorted[i - 1]!) / yMax > 0.07);
          const labels = !narrow && spread;
          const long = pts.flatMap((p) => (['naive', 'summed', 'H'] as Key[]).map((k) => ({ year: p.year, k, v: p[k], p })));
          const line = (k: Key, w: number) => Plot.lineY(solid, { x: 'year', y: k, stroke: c[k], strokeWidth: w, curve: 'monotone-x' });
          const tailLine = (k: Key, w: number) => Plot.lineY(tail, { x: 'year', y: k, stroke: c[k], strokeWidth: w, strokeOpacity: 0.4, curve: 'monotone-x' });
          return {
            height: narrow ? 300 : 360,
            marginRight: labels ? 196 : 20, marginTop: 26,
            x: { label: null, tickFormat: (y: number) => String(y), ticks: narrow ? 5 : 12, domain: [ba.firstYear, ba.lastYear] },
            y: { label: 'index, 2003 to 2011 = 100', grid: true, zero: true, tickFormat: (v: number) => fmtInt(v) },
            marks: [
              Plot.areaY(solid, { x: 'year', y1: 'lo', y2: 'hi', fill: c.H, fillOpacity: 0.14, curve: 'monotone-x' }),
              Plot.ruleY([100], { stroke: muted, strokeOpacity: 0.5 }),
              Plot.ruleX([SEAM_YEAR], { stroke: muted, strokeOpacity: 0.8 }),
              Plot.text([SEAM_YEAR], { x: (d: number) => d, frameAnchor: 'top', dy: -16, dx: 4, textAnchor: 'start', text: () => '2012: VIIRS joins', fill: muted, fontSize: 11 }),
              line('summed', 1.2), line('naive', 2), line('H', 2.6),
              ...(tail.length ? [tailLine('summed', 1.2), tailLine('naive', 2), tailLine('H', 2.6)] : []),
              ...(lastProv ? [Plot.text([lastProv], { x: 'year', frameAnchor: 'top', dy: -16, textAnchor: 'end', text: () => `${lastProv.year} so far`, fill: muted, fontSize: 11 })] : []),
              ...(labels ? [Plot.text(ends, { x: 'year', y: 'v', text: 'label', fill: (d: { k: Key }) => c[d.k], dx: 10, textAnchor: 'start', fontSize: 12, fontWeight: 600 })] : []),
              Plot.ruleX(pts, Plot.pointerX({ x: 'year', stroke: muted, strokeOpacity: 0.6 })),
              Plot.tip(long, Plot.pointerX({
                x: 'year', y: 'v', fill: cssVar('--surface-2', '#10191c'), stroke: cssVar('--border-strong', '#2a3a3d'),
                title: (d: { year: number; k: Key; v: number; p: YearPoint }) => {
                  const raw = d.k === 'naive' ? d.p.rawNaive : d.k === 'summed' ? d.p.rawSummed : d.p.rawH;
                  return `${d.year}${d.p.provisional ? ' (so far, provisional)' : ''}\n${LABEL[d.k]}: ${fmtInt(d.v)}\n${fmtInt(raw)} fire cell-days${d.k === 'H' ? `\n90%: ${fmtInt(d.p.rawLo)} to ${fmtInt(d.p.rawHi)}` : ''}`;
                },
              })),
            ],
          };
        }}
      />
      <ul className="ka-rec-key" aria-label="Lines">
        <li><i className="ka-rec-sw ka-rec-sw-h" aria-hidden="true" />{LABEL.H}</li>
        <li><i className="ka-rec-sw ka-rec-sw-naive" aria-hidden="true" />{LABEL.naive}</li>
        <li><i className="ka-rec-sw ka-rec-sw-summed" aria-hidden="true" />{LABEL.summed}</li>
      </ul>
      {national && national.slope_raw_per_yr != null && national.slope_H_per_yr != null ? (
        <p className="ka-rec-note">
          Indonesia as a whole, 2001 to 2025 (Theil-Sen trend, Second Sight's finding run{finding?.meta?.status ? `, ${finding.meta.status.toLowerCase()}` : ''}):
          raw {national.slope_raw_per_yr >= 0 ? '+' : '−'}{fmtInt(Math.abs(national.slope_raw_per_yr))} fire cell-days a year,
          harmonized {national.slope_H_per_yr >= 0 ? '+' : '−'}{fmtInt(Math.abs(national.slope_H_per_yr))}
          {national.slope_H_lo != null && national.slope_H_hi != null
            ? ` (${fmtInt(national.slope_H_lo)} to ${fmtInt(national.slope_H_hi)} for the lower and upper 90% bounds)` : ''}.
        </p>
      ) : null}
    </div>
  );
}
