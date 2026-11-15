// KalenderApi (new file): the drawings of the home sections, as inline SVG coloured by the design tokens
// (styles/home.css, the .ka-d-* classes). No image files. Each drawing is hidden from screen readers and has its
// meaning in the text beside it, or carries role="img" with a label.
// The only numbers drawn are instrument facts that are public knowledge (a MODIS fire pixel is about 1 km wide, a
// VIIRS one 375 m, so about seven VIIRS pixels fit in one MODIS pixel) and the rule of the peat index (a gap is two
// days or more with no detection). Nothing here says that a fire was present under cloud: the cloud panel draws a
// question mark.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTr } from '../../lib/lang';

// ------------------------------------------------------------------------------------------------ parts

/** A small satellite: two solar panels, a body, and the instrument looking down. Drawn around (0, 0). */
function Sat({ x, y, tone }: { x: number; y: number; tone: 'modis' | 'viirs' | 'plain' }) {
  return (
    <g transform={`translate(${x} ${y})`} className={`ka-d-sat is-${tone}`}>
      <rect x={-36} y={-7} width={23} height={14} rx={1.5} className="ka-d-panel" />
      <rect x={13} y={-7} width={23} height={14} rx={1.5} className="ka-d-panel" />
      <path d="M-28.5 -7v14M-20.5 -7v14M20.5 -7v14M28.5 -7v14M-13 0h-1M13 0h1" className="ka-d-panel-line" />
      <rect x={-11} y={-10} width={22} height={20} rx={3} className="ka-d-body" />
      <path d="M-5 10h10l3 6h-16z" className="ka-d-eye" />
    </g>
  );
}

/** A small flame. Drawn around (0, 0), about 2s wide and 2.6s tall. */
function Flame({ x, y, s = 8 }: { x: number; y: number; s?: number }) {
  return (
    <path className="ka-d-flame" transform={`translate(${x} ${y}) scale(${s / 8})`}
      d="M0 -10c2 4 7 6 7 12a7 7 0 0 1-14 0c0-3 1.5-5 3-6.5.2 2 1 3.4 2.6 4C-1.6 -3 -1.2 -7 0 -10z" />
  );
}

// ------------------------------------------------------------------------------------------------ 1. two satellites

/** The same square of ground under each satellite: one MODIS pixel of about 1 km, and VIIRS pixels of 375 m (the grid
 *  lines sit at 375 m and 750 m, so about seven pixels cover the square). The same small fire is in both. */
function PixelPanel({ tone }: { tone: 'modis' | 'viirs' }) {
  const x0 = 40, y0 = 104, side = 140, cell = side * 0.375;
  const fx = x0 + cell / 2, fy = y0 + cell * 1.5;   // the fire: in the first column, second row
  return (
    <div className={`ka-d-stage is-${tone}`} aria-hidden="true">
    <Sat3d />
    <svg className={`ka-d ka-d-pix is-${tone}`} viewBox="0 0 220 280" focusable="false">
      <path className="ka-d-beam" d={`M110 44 L${x0} ${y0} L${x0 + side} ${y0} Z`} />
      <rect className="ka-d-ground" x={x0} y={y0} width={side} height={side} />
      {/* MODIS: the whole 1 km pixel answers, faintly, when the scan passes */}
      {tone === 'modis' ? <rect className="ka-d-lit" x={x0} y={y0} width={side} height={side} /> : null}
      {tone === 'viirs' ? (
        <>
          <rect className="ka-d-hit" x={x0} y={y0 + cell} width={cell} height={cell} />
          <path className="ka-d-gridline" d={`M${x0 + cell} ${y0}v${side}M${x0 + 2 * cell} ${y0}v${side}M${x0} ${y0 + cell}h${side}M${x0} ${y0 + 2 * cell}h${side}`} />
        </>
      ) : null}
      <rect className="ka-d-cell" x={x0} y={y0} width={side} height={side} />
      <Flame x={fx} y={fy + 2} s={9} />
      {/* the scan line that sweeps the ground */}
      <rect className="ka-d-scan" x={x0} y={y0} width={side} height={12} />
      {/* the width of one pixel */}
      {tone === 'modis' ? (
        <>
          <path className="ka-d-dim" d={`M${x0} ${y0 + side + 10}h${side}M${x0} ${y0 + side + 6}v8M${x0 + side} ${y0 + side + 6}v8`} />
          <text className="ka-d-label" x={x0 + side / 2} y={y0 + side + 29} textAnchor="middle">1 km</text>
        </>
      ) : (
        <>
          <path className="ka-d-dim" d={`M${x0} ${y0 + side + 10}h${cell}M${x0} ${y0 + side + 6}v8M${x0 + cell} ${y0 + side + 6}v8`} />
          <text className="ka-d-label" x={x0 + cell / 2} y={y0 + side + 29} textAnchor="middle">375 m</text>
        </>
      )}
    </svg>
    </div>
  );
}

/** A satellite built from CSS 3D boxes (a body of six faces, two solar panels, the instrument underneath). It tumbles
 *  slowly and drifts along its track; under reduced motion it is one still pose. Styles: home.css, .ka-sat3d. */
function Sat3d() {
  return (
    <div className="ka-sat3d">
      <div className="ka-sat3d-drift">
        <div className="ka-sat3d-spin">
          <i className="ka-sat3d-f is-front" /><i className="ka-sat3d-f is-back" /><i className="ka-sat3d-f is-left" />
          <i className="ka-sat3d-f is-right" /><i className="ka-sat3d-f is-top" /><i className="ka-sat3d-f is-bottom" />
          <i className="ka-sat3d-p is-l" /><i className="ka-sat3d-p is-r" />
          <i className="ka-sat3d-eye" />
        </div>
      </div>
    </div>
  );
}

export function SatellitePixels({ modisSince, viirsSince }: { modisSince: number | null; viirsSince: number }) {
  const tr = useTr();
  // the motion runs only while the drawing is on screen (home.css pauses it otherwise), so it costs nothing elsewhere
  const pair = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    const el = pair.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setLive(true); return undefined; }
    const watch = new IntersectionObserver((entries) => setLive(entries.some((e) => e.isIntersecting)));
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  return (
    <div ref={pair} className={`ka-d-pair is-sats${live ? ' is-live' : ''}`}>
      {/* the sky the two satellites fly in: a few stars, and the curve of the Earth with its airglow */}
      <div className="ka-d-sky" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><span /></div>
      <figure className="ka-d-fig">
        <PixelPanel tone="modis" />
        <figcaption>
          <b className="is-modis">MODIS</b>
          <span className="ka-d-meta">Terra, Aqua{modisSince ? ` · ${tr('since', 'sejak')} ${modisSince}` : ''}</span>
          <span>{tr('One pixel is about 1 km wide. A small fire is a small part of it, and can go undetected.',
            'Satu piksel lebarnya sekitar 1 km. Api kecil hanya sebagian kecil darinya, dan bisa tidak terdeteksi.')}</span>
        </figcaption>
      </figure>
      <figure className="ka-d-fig">
        <PixelPanel tone="viirs" />
        <figcaption>
          <b className="is-viirs">VIIRS</b>
          <span className="ka-d-meta">Suomi NPP, NOAA-20 · {tr('since', 'sejak')} {viirsSince}</span>
          <span>{tr('Pixels are 375 m wide: about seven cover the same square. The same small fire fills one.',
            'Pikselnya selebar 375 m: sekitar tujuh menutup petak yang sama. Api kecil yang sama memenuhi satu piksel.')}</span>
        </figcaption>
      </figure>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ 2. the challenge icons

export type AskIcon = 'harmonize' | 'calendar' | 'region' | 'latlon' | 'range' | 'median' | 'anomaly' | 'download' | 'csv' | 'ramp' | 'reported';

const ICONS: Record<AskIcon, ReactNode> = {
  harmonize: <><path className="is-modis" d="M3 7c7 0 6 5 12 5" /><path className="is-viirs" d="M3 17c7 0 6-5 12-5" /><path className="is-harm" d="M15 12h6" /><circle className="is-harm-fill" cx="15" cy="12" r="1.8" /></>,
  calendar: <><path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" /><path className="is-harm" d="M7.5 13.5h2M11 13.5h2M14.5 13.5h2M7.5 16.8h2M11 16.8h2" /></>,
  region: <><path d="M5 9l5-5 8 3 1 8-6 5-7-3z" /><circle className="is-harm-fill" cx="12" cy="12" r="1.8" /></>,
  latlon: <><circle cx="12" cy="12" r="5" /><path d="M12 2v5M12 17v5M2 12h5M17 12h5" /><circle className="is-harm-fill" cx="12" cy="12" r="1.6" /></>,
  range: <><path d="M5 6v12M19 6v12" /><path className="is-harm" d="M5 12h14M8.5 9L5.5 12l3 3M15.5 9l3 3-3 3" /></>,
  median: <><path d="M5 20v-6M10 20V9M15 20v-4" /><path className="is-harm" d="M20 20V5" /><path className="is-dash" d="M3 12h18" /></>,
  anomaly: <><path d="M3 17h4l3-4 2 2" /><path className="is-harm" d="M12 15l3-11 3 13h3" /><circle className="is-harm-fill" cx="15" cy="4" r="1.6" /></>,
  download: <><path className="is-harm" d="M12 4v11M7.5 10.5L12 15l4.5-4.5" /><path d="M4 20h16" /></>,
  csv: <><path d="M4 5h16v14H4zM4 10h16M4 14.5h16M10 5v14" /><circle className="is-harm-fill" cx="7" cy="12.3" r="1.3" /><circle className="is-harm-fill" cx="7" cy="16.8" r="1.3" /></>,
  ramp: <><rect className="is-ramp1" x="3" y="13" width="4" height="7" /><rect className="is-ramp2" x="8" y="10" width="4" height="10" /><rect className="is-ramp3" x="13" y="7" width="4" height="13" /><rect className="is-ramp4" x="18" y="4" width="3.5" height="16" /></>,
  reported: <><path d="M5 4h9l4 4v12H5zM14 4v4h4" /><path className="is-harm" d="M8 13h7" /><path d="M8 16.5h5" /></>,
};

export function AskGlyph({ icon }: { icon: AskIcon }) {
  return <svg className="ka-d-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{ICONS[icon]}</svg>;
}

// ------------------------------------------------------------------------------------------------ 3. two zeros

/** A side view: the satellite looks down at the ground. `cloud`: a cloud stops the look, and a question mark stands
 *  under it (never a flame: under cloud the satellite could not see). */
function ZeroPanel({ cloud }: { cloud: boolean }) {
  return (
    <svg className={`ka-d ka-d-zero${cloud ? ' is-cloud' : ''}`} viewBox="0 0 300 200" aria-hidden="true" focusable="false">
      <Sat x={64} y={30} tone="plain" />
      {/* the ground, with a few trees */}
      <rect className="ka-d-soil" x={0} y={170} width={300} height={30} />
      <path className="ka-d-tree" d="M24 170l7-16 7 16zM48 170l6-13 6 13zM238 170l7-16 7 16zM262 170l6-13 6 13zM120 170l5-11 5 11z" />
      {cloud ? (
        <>
          <path className="ka-d-look" d="M70 46L128 100" />
          <path className="ka-d-shade" d="M112 124L96 170h196L262 124z" />
          <g className="ka-d-cloud">
            <ellipse cx={150} cy={112} rx={44} ry={17} /><ellipse cx={205} cy={110} rx={52} ry={20} /><ellipse cx={176} cy={96} rx={36} ry={20} /><ellipse cx={236} cy={116} rx={30} ry={13} />
          </g>
          <path className="ka-d-stop" d="M121 93l14 14M135 93l-14 14" />
          <text className="ka-d-q" x={196} y={164} textAnchor="middle">?</text>
        </>
      ) : (
        <>
          <path className="ka-d-look" d="M70 46L196 168" />
          <circle className="ka-d-spot" cx={196} cy={169} r={9} />
          <path className="ka-d-tick" d="M210 150l6 6 11-13" />
        </>
      )}
      {/* what the record says, the same in both: zero */}
      <g className="ka-d-chip">
        <rect x={218} y={14} width={64} height={40} rx={6} />
        <text x={250} y={43} textAnchor="middle">0</text>
      </g>
    </svg>
  );
}

export function ZeroSideView() {
  const tr = useTr();
  return (
    <div className="ka-d-pair is-zero">
      <figure className="ka-d-fig">
        <ZeroPanel cloud={false} />
        <figcaption>
          <b>{tr('0 = looked, and saw no fire', '0 = melihat, dan tidak ada api terlihat')}</b>
          <span>{tr('Clear sky: the satellite had a cloud-free look.', 'Langit cerah: satelit mendapat pandangan bebas awan.')}</span>
        </figcaption>
      </figure>
      <figure className="ka-d-fig">
        <ZeroPanel cloud />
        <figcaption>
          <b>{tr('0 = could not see', '0 = tidak dapat melihat')}</b>
          <span>{tr('Under cloud: the satellite could not see. The page marks it, and does not say what was there.',
            'Di bawah awan: satelit tidak dapat melihat. Halaman ini menandainya, tanpa menyatakan apa yang ada di sana.')}</span>
        </figcaption>
      </figure>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ 4. the officer's flow

type FlowIcon = 'sat' | 'check' | 'level' | 'message';

function FlowGlyph({ icon }: { icon: FlowIcon }) {
  return (
    <svg className="ka-d ka-d-flowicon" viewBox="0 0 72 56" aria-hidden="true" focusable="false">
      {icon === 'sat' ? (
        <>
          <Sat x={36} y={15} tone="plain" />
          <path className="ka-d-look" d="M36 30v12" />
          <Flame x={36} y={50} s={6} />
        </>
      ) : null}
      {icon === 'check' ? (
        <>
          {/* this month against its usual level, and a cloud */}
          <path className="ka-d-bar" d="M12 48V34M22 48V28M32 48V36" />
          <path className="ka-d-bar is-hot" d="M42 48V14" />
          <path className="ka-d-dashline" d="M6 30h44" />
          <g className="ka-d-cloud is-small"><ellipse cx={56} cy={18} rx={10} ry={5} /><ellipse cx={62} cy={14} rx={7} ry={5} /></g>
        </>
      ) : null}
      {icon === 'level' ? (
        <>
          <rect className="ka-d-step is-1" x={10} y={36} width={14} height={12} rx={2} />
          <rect className="ka-d-step is-2" x={29} y={24} width={14} height={24} rx={2} />
          <rect className="ka-d-step is-3" x={48} y={10} width={14} height={38} rx={2} />
        </>
      ) : null}
      {icon === 'message' ? (
        <>
          {/* a plain speech bubble */}
          <path className="ka-d-bubble" d="M10 10h52a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H30l-10 9v-9h-10a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4z" />
          <path className="ka-d-bubble-line" d="M16 20h38M16 28h26" />
        </>
      ) : null}
    </svg>
  );
}

export function OfficerFlow() {
  const tr = useTr();
  const steps: { icon: FlowIcon; title: string; text: string }[] = [
    { icon: 'sat', title: tr('Satellites detect', 'Satelit mendeteksi'), text: tr('MODIS and VIIRS hotspots, on one scale.', 'Titik panas MODIS dan VIIRS, pada satu skala.') },
    { icon: 'check', title: tr('The page checks', 'Halaman memeriksa'), text: tr('Is it usual for this month? Was cloud in the way?', 'Apakah biasa untuk bulan ini? Apakah awan menghalangi?') },
    { icon: 'level', title: tr('One level', 'Satu tingkat'), text: tr('A plain level for the district, with its reason.', 'Satu tingkat yang jelas untuk kabupaten/kota, beserta alasannya.') },
    { icon: 'message', title: tr('A message', 'Sebuah pesan'), text: tr('Ready for the village, the disaster office and the fire crew.', 'Siap untuk desa, kantor penanggulangan bencana, dan regu pemadam.') },
  ];
  return (
    <ol className="ka-d-flow">
      {steps.map((s, i) => (
        <li key={s.icon}>
          <FlowGlyph icon={s.icon} />
          <span className="ka-d-flow-n" aria-hidden="true">{i + 1}</span>
          <b>{s.title}</b>
          <span>{s.text}</span>
        </li>
      ))}
    </ol>
  );
}

// ------------------------------------------------------------------------------------------------ 5. the peat rule

/** One peat cell, day by day: detected, a gap of two days or more with nothing detected, detected again. That is one
 *  come-back. */
export function PeatTimeline() {
  const tr = useTr();
  const days: ('fire' | 'quiet')[] = ['fire', 'fire', 'quiet', 'quiet', 'quiet', 'fire', 'fire'];
  const w = 40, gap = 8, x0 = 14, y0 = 46;
  const at = (i: number) => x0 + i * (w + gap);
  const label = tr(
    'The rule, on one peat cell: fire detected on two days, then three days with nothing detected, then detected again. Detected again after a gap of two days or more counts as one come-back.',
    'Aturannya, pada satu sel gambut: api terdeteksi dua hari, lalu tiga hari tanpa deteksi, lalu terdeteksi lagi. Terdeteksi lagi setelah jeda dua hari atau lebih dihitung sebagai satu kemunculan kembali.',
  );
  return (
    <svg className="ka-d ka-d-peat" viewBox="0 0 360 150" role="img" aria-label={label}>
      <text className="ka-d-label" x={at(0)} y={16}>{tr('detected', 'terdeteksi')}</text>
      <text className="ka-d-label is-strong" x={at(6) + w} y={16} textAnchor="end">{tr('detected again', 'terdeteksi lagi')}</text>
      {days.map((d, i) => (
        <g key={i}>
          <rect className={`ka-d-day is-${d}`} x={at(i)} y={y0} width={w} height={w} rx={4} />
          {d === 'fire' ? <Flame x={at(i) + w / 2} y={y0 + w / 2 + 3} s={8} /> : null}
        </g>
      ))}
      {/* the gap */}
      <path className="ka-d-dim" d={`M${at(2)} ${y0 + w + 12}h${3 * w + 2 * gap}M${at(2)} ${y0 + w + 7}v10M${at(4) + w} ${y0 + w + 7}v10`} />
      <text className="ka-d-label" x={at(3) + w / 2} y={y0 + w + 32} textAnchor="middle">{tr('gap: 2 days or more', 'jeda: 2 hari atau lebih')}</text>
      {/* the come-back */}
      <path className="ka-d-arrow" d={`M${at(4) + w / 2} ${y0 - 6}C${at(4) + w / 2} ${y0 - 19} ${at(5) + w / 2 - 6} ${y0 - 19} ${at(5) + w / 2} ${y0 - 5}M${at(5) + w / 2 - 6} ${y0 - 11}l6 6 5-7`} />
      <text className="ka-d-label is-fire" x={at(6) + w} y={y0 + w + 52} textAnchor="end">{tr('= 1 come-back', '= 1 kemunculan kembali')}</text>
    </svg>
  );
}
