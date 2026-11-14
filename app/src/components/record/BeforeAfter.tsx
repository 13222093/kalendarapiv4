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

export function BeforeAfterFigure({ area, ba, source, ratio, finding, pooled }: {
  area: string; ba: BA; source: string;
  ratio: { ratio: number; from: number; to: number } | null;
  finding: Finding | null;
  pooled: { ratio: number; from: number } | null;   // years converted with one national ratio and no interval
}) {
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
  const national = finding?.regions?.national?.trend_2001_2025 ?? null;

  const table = useMemo(() => ({
    columns: ['Year', 'Raw, stitched (fire cell-days)', 'Added together', 'Harmonized', '90% range'],
    rows: pts.map((p) => [
      p.provisional ? `${p.year} (so far)` : String(p.year), fmtInt(p.rawNaive), fmtInt(p.rawSummed), fmtInt(p.rawH),
      p.noBand ? 'no interval' : `${fmtInt(p.rawLo)} to ${fmtInt(p.rawHi)}`,
    ]),
  }), [pts]);

  return (
    <div className="ka-rec-ba">
      <StatGrid>
        <StatTile label="Raw, stitched as recorded" value={ba.changeNaive == null ? 'n/a' : signedPct(ba.changeNaive)}
          context="Mean of 2019 to 2023 against 2003 to 2007, MODIS before 2012 and VIIRS after" />
        <StatTile label="Harmonized, one scale" value={ba.changeH == null ? 'n/a' : signedPct(ba.changeH)}
          context={pooled && pooled.from <= 2023
            ? `The same years, with VIIRS put on the Aqua MODIS scale; from ${pooled.from} with one national ratio and no 90% range`
            : 'The same years, with VIIRS put on the Aqua MODIS scale'} />
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
              Plot.areaY(banded, { x: 'year', y1: 'lo', y2: 'hi', fill: c.H, fillOpacity: 0.14, curve: 'monotone-x' }),
              ...(firstNoBand != null ? [
                Plot.ruleX([firstNoBand - 0.5], { stroke: muted, strokeOpacity: 0.35 }),
                // (a phone has no room for it in the top margin: the note under the chart and the stat tile say it)
                ...(narrow ? [] : [Plot.text([firstNoBand - 0.5], { x: (d: number) => d, frameAnchor: 'top', dy: -16, dx: -4, textAnchor: 'end', text: () => `no 90% range from ${firstNoBand} →`, fill: muted, fontSize: 11 })]),
              ] : []),
              Plot.ruleY([100], { stroke: muted, strokeOpacity: 0.5 }),
              Plot.ruleX([SEAM_YEAR], { stroke: muted, strokeOpacity: 0.8 }),
              Plot.text([SEAM_YEAR], { x: (d: number) => d, frameAnchor: 'top', dy: narrow ? 2 : -16, dx: 4, textAnchor: 'start', text: () => (narrow ? 'VIIRS joins' : '2012: VIIRS joins'), fill: muted, fontSize: 11 }),
              line('summed', 1.2), line('naive', 2), line('H', 2.6),
              ...(tail.length ? [tailLine('summed', 1.2), tailLine('naive', 2), tailLine('H', 2.6)] : []),
              ...(lastProv ? [Plot.text([lastProv], { x: 'year', frameAnchor: 'top', dy: narrow ? 2 : -16, textAnchor: 'end', text: () => (narrow ? 'so far' : `${lastProv.year} so far`), fill: muted, fontSize: 11 })] : []),
              ...(labels ? [Plot.text(ends, { x: 'year', y: 'v', text: 'label', fill: (d: { k: Key }) => c[d.k], dx: 10, textAnchor: 'start', fontSize: 12, fontWeight: 600 })] : []),
              Plot.ruleX(pts, Plot.pointerX({ x: 'year', stroke: muted, strokeOpacity: 0.6 })),
              Plot.tip(long, Plot.pointerX({
                x: 'year', y: 'v', fill: cssVar('--surface-2', '#10191c'), stroke: cssVar('--border-strong', '#2a3a3d'),
                title: (d: { year: number; k: Key; v: number; p: YearPoint }) => {
                  const raw = d.k === 'naive' ? d.p.rawNaive : d.k === 'summed' ? d.p.rawSummed : d.p.rawH;
                  const band = d.p.noBand ? '\nno 90% range (one national ratio)' : `\n90%: ${fmtInt(d.p.rawLo)} to ${fmtInt(d.p.rawHi)}`;
                  return `${d.year}${d.p.provisional ? ' (so far, provisional)' : ''}\n${d.k === 'H' ? 'Harmonized' : LABEL[d.k]}: ${fmtInt(d.v)}\n${fmtInt(raw)} fire cell-days${d.k === 'H' ? band : ''}`;
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
      {pooled ? (
        <p className="ka-rec-note">
          No 90% range for {area} from {pooled.from}: Second Sight's export converts its VIIRS months with one national
          ratio ({pooled.ratio.toFixed(3)} Aqua MODIS fire cell-days per VIIRS one) and no interval, as it does for every
          province in this bundle. Indonesia and the island regions keep their ranges.
        </p>
      ) : null}
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
