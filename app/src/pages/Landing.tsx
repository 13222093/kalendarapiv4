import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { LANDING_BRAND, LANDING_ROUTES, loadLandingData, type LandingCheck, type LandingData } from './landing-data.ts';
import '../styles/landing.css';

const NAV = [
  { id: 'evidence', label: 'The evidence' },
  { id: 'method', label: 'How it works' },
  { id: 'validation', label: 'Validation' },
  { id: 'observability', label: 'What satellites miss' },
];

function jumpTo(id: string, event: MouseEvent<HTMLAnchorElement>, close?: () => void) {
  event.preventDefault();
  close?.();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      setVisible(true);
      return undefined;
    }
    const node = ref.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.12 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className={'ka-home-reveal ' + (visible ? 'is-visible ' : '') + className}>{children}</div>;
}

function LandingChart({ data }: { data: LandingData }) {
  const width = 860;
  const height = 360;
  const pad = { left: 54, right: 24, top: 24, bottom: 42 };
  const points = data.points;
  const first = points[0]?.year ?? 2003;
  const last = points[points.length - 1]?.year ?? 2025;
  const yMax = Math.max(120, ...points.map((p) => Math.max(p.raw, p.fair, p.low, p.high))) * 1.08;
  const x = (year: number) => pad.left + ((year - first) / Math.max(1, last - first)) * (width - pad.left - pad.right);
  const y = (value: number) => pad.top + (1 - value / yMax) * (height - pad.top - pad.bottom);
  const path = (key: 'raw' | 'fair') => points.map((p, i) => (i ? 'L' : 'M') + x(p.year).toFixed(1) + ',' + y(p[key]).toFixed(1)).join('');
  const band = points.map((p, i) => (i ? 'L' : 'M') + x(p.year).toFixed(1) + ',' + y(p.high).toFixed(1)).join('')
    + [...points].reverse().map((p) => 'L' + x(p.year).toFixed(1) + ',' + y(p.low).toFixed(1)).join('') + 'Z';
  const ticks = Array.from({ length: 5 }, (_, i) => (yMax * i) / 4);

  return (
    <figure className="ka-home-chart" aria-labelledby="ka-home-chart-caption">
      <svg viewBox={'0 0 ' + width + ' ' + height} role="img" aria-labelledby="ka-home-svg-title ka-home-svg-desc">
        <title id="ka-home-svg-title">Indonesia fire cell-days, on a shared baseline</title>
        <desc id="ka-home-svg-desc">Annual raw stitched and harmonized fire cell-day series. Each series is indexed to its own 2003 to 2011 mean. A vertical line marks when VIIRS joins in 2012.</desc>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className="ka-home-gridline" />
            <text x={pad.left - 10} y={y(tick) + 4} textAnchor="end" className="ka-home-axis-label">{Math.round(tick)}</text>
          </g>
        ))}
        {[first, 2012, last].filter((yr, i, xs) => xs.indexOf(yr) === i).map((yr) => (
          <text key={yr} x={x(yr)} y={height - 12} textAnchor="middle" className="ka-home-axis-label">{yr}</text>
        ))}
        {first <= 2012 && last >= 2012 ? (
          <g>
            <line x1={x(2012)} x2={x(2012)} y1={pad.top} y2={height - pad.bottom} className="ka-home-seam" />
            <text x={x(2012) + 6} y={pad.top + 12} className="ka-home-seam-label">2012 · VIIRS joins</text>
          </g>
        ) : null}
        <path d={band} className="ka-home-band" />
        <path d={path('raw')} pathLength={1} className="ka-home-line ka-home-line--raw" />
        <path d={path('fair')} pathLength={1} className="ka-home-line ka-home-line--fair" />
      </svg>
      <figcaption id="ka-home-chart-caption">
        Annual fire cell-days in Indonesia, each series indexed to its own 2003–2011 mean (=100). The shaded band sums monthly 90% calibration bounds as an approximation.
      </figcaption>
      <div className="ka-home-chart-legend" aria-label="Chart legend">
        <span><i className="ka-home-legend-raw" /> Raw MODIS-to-VIIRS stitch</span>
        <span><i className="ka-home-legend-fair" /> Harmonized to the Aqua MODIS scale</span>
        <span><i className="ka-home-legend-band" /> 90% harmonization range</span>
      </div>
    </figure>
  );
}

function checkState(check: LandingCheck | null): string {
  if (!check) return 'unavailable';
  if (check.status === 'not_run') return 'not-run';
  if (check.status === 'not_applicable') return 'not-applicable';
  if (check.passed === true) return 'pass';
  if (check.passed === false) return 'fail';
  return 'reported';
}

function checkLabel(check: LandingCheck | null): string {
  const state = checkState(check);
  if (state === 'pass') return 'Passed';
  if (state === 'fail') return 'Failed';
  if (state === 'reported') return 'Reported';
  if (state === 'not-applicable') return 'Not applicable';
  if (state === 'not-run') return 'Not run';
  return 'Unavailable';
}

function fmtSigned(value: number): string {
  return (value >= 0 ? '+' : '−') + Math.abs(value).toFixed(3);
}

function LandingCheckCard({ year, title, check }: { year: number; title: string; check: LandingCheck | null }) {
  const state = checkState(check);
  return (
    <article className="ka-home-check" data-state={state}>
      <div className="ka-home-check-top">
        <span className="ka-home-check-year">{year} seam</span>
        <span className={'ka-home-status ka-home-status--' + state}>{checkLabel(check)}</span>
      </div>
      <h3>{title}</h3>
      {check ? (
        <>
          <p className="ka-home-check-value">{check.value == null ? 'No estimate' : 'Δ = ' + fmtSigned(check.value)}</p>
          {check.ci ? <p className="ka-home-check-ci">90% interval: {fmtSigned(check.ci[0])} to {fmtSigned(check.ci[1])}</p> : null}
          {check.rule ? <p className="ka-home-check-rule">{check.rule}</p> : null}
        </>
      ) : (
        <p className="ka-home-check-rule">This check is not available in the current validation bundle.</p>
      )}
    </article>
  );
}

export function Landing() {
  const [data, setData] = useState<LandingData | null>(null);
  const [dataState, setDataState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    document.title = LANDING_BRAND + ' · Indonesia’s fire record, on one scale';
    window.scrollTo(0, 0);
    let live = true;
    loadLandingData()
      .then((next) => {
        if (!live) return;
        setData(next);
        setDataState(next ? 'ready' : 'unavailable');
      })
      .catch(() => { if (live) setDataState('unavailable'); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 10);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const navJump = (id: string) => (event: MouseEvent<HTMLAnchorElement>) => jumpTo(id, event, () => setMenuOpen(false));

  return (
    <div className="ka-home">
      <a className="ka-home-skip" href="#home-main" onClick={(event) => jumpTo('home-main', event)}>Skip to content</a>
      <div className="ka-home-announcement">
        <span className="ka-home-announcement-dot" />
        Indonesia fire record · preliminary research · 2001–2025
        <a href={LANDING_ROUTES.record}>Explore the evidence <span aria-hidden="true">↗</span></a>
      </div>

      <header className="ka-home-header" data-scrolled={scrolled ? 'true' : undefined}>
        <div className="ka-home-header-inner">
          <a className="ka-home-brand" href={LANDING_ROUTES.home} aria-label={LANDING_BRAND + ' home'}>
            <span className="ka-home-brand-mark" aria-hidden="true"><i /><i /><i /></span>
            <span>{LANDING_BRAND}</span>
          </a>
          <nav className={'ka-home-nav' + (menuOpen ? ' is-open' : '')} id="ka-home-navigation" aria-label="Main navigation">
            {NAV.map((item) => <a key={item.id} href={'#' + item.id} onClick={navJump(item.id)}>{item.label}</a>)}
            <a className="ka-home-nav-mobile-cta" href={LANDING_ROUTES.record}>Open the record <span aria-hidden="true">↗</span></a>
          </nav>
          <a className="ka-home-header-cta" href={LANDING_ROUTES.record}>Explore the record <span aria-hidden="true">↗</span></a>
          <button
            className="ka-home-menu-button"
            type="button"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            aria-controls="ka-home-navigation"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span /><span />
          </button>
        </div>
      </header>

      <main id="home-main">
        <section className="ka-home-hero" aria-labelledby="ka-home-title">
          <div className="ka-home-hero-noise" aria-hidden="true" />
          <div className="ka-home-hero-inner">
            <div className="ka-home-hero-copy">
              <p className="ka-home-eyebrow"><span className="ka-home-live-dot" /> NASA Space Apps Challenge · Indonesia</p>
              <h1 id="ka-home-title">A satellite changed.<br /><em>Did the fire record?</em></h1>
              <p className="ka-home-hero-lead">
                When VIIRS joined MODIS in 2012, Indonesia’s raw hotspot record shifted. KalenderApi puts both sensors on one comparable scale and shows where satellites could not see clearly.
              </p>
              <div className="ka-home-hero-actions">
                <a className="ka-home-button ka-home-button--primary" href={LANDING_ROUTES.record}>Explore the Indonesia record <span aria-hidden="true">↗</span></a>
                <a className="ka-home-button ka-home-button--quiet" href="#evidence" onClick={navJump('evidence')}>See the evidence <span aria-hidden="true">↓</span></a>
              </div>
              <p className="ka-home-hero-note">Hotspot cell-days, not a count of unique fires or burned area.</p>
            </div>
            <div className="ka-home-hero-visual" aria-hidden="true">
              <div className="ka-home-orbit ka-home-orbit--outer" />
              <div className="ka-home-orbit ka-home-orbit--inner" />
              <div className="ka-home-earth">
                <svg viewBox="0 0 480 480" role="presentation">
                  <defs>
                    <radialGradient id="ka-home-earth-fill" cx="42%" cy="36%">
                      <stop offset="0%" stopColor="#284d48" />
                      <stop offset="65%" stopColor="#132b2a" />
                      <stop offset="100%" stopColor="#071112" />
                    </radialGradient>
                    <pattern id="ka-home-earth-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                      <path d="M24 0H0V24" fill="none" stroke="#95c5ad" strokeOpacity=".12" strokeWidth="1" />
                    </pattern>
                    <clipPath id="ka-home-earth-clip"><circle cx="240" cy="240" r="176" /></clipPath>
                  </defs>
                  <circle cx="240" cy="240" r="176" fill="url(#ka-home-earth-fill)" stroke="#7bb49c" strokeOpacity=".52" />
                  <g clipPath="url(#ka-home-earth-clip)">
                    <rect x="60" y="60" width="360" height="360" fill="url(#ka-home-earth-grid)" />
                    <path d="M186 96l35 19 19 31-15 24 22 16 45-4 13 28-22 15 5 25-28 19-10 39-32 24-11-28-23-9 6-26-29-13 8-22-21-16 12-28-14-35z" fill="#77a98c" fillOpacity=".7" />
                    <path d="M292 279l26 15 10 30-18 32-24-14-3-28-17-18zM343 182l24 12-6 20-26-3z" fill="#77a98c" fillOpacity=".52" />
                    <path d="M63 238h354" stroke="#ef8b54" strokeOpacity=".76" strokeDasharray="4 9" />
                    <circle cx="282" cy="238" r="4" fill="#ffd2a1" />
                    <circle cx="298" cy="250" r="3" fill="#ef8b54" />
                    <circle cx="268" cy="260" r="3" fill="#ef8b54" />
                    <circle cx="310" cy="229" r="2.5" fill="#ffd2a1" />
                  </g>
                  <path d="M116 318c42 33 87 50 140 50 53 0 98-17 140-50" fill="none" stroke="#8fc5a5" strokeOpacity=".3" />
                </svg>
              </div>
              <div className="ka-home-satellite ka-home-satellite--a"><span /><b>MODIS</b></div>
              <div className="ka-home-satellite ka-home-satellite--b"><span /><b>VIIRS</b></div>
              <div className="ka-home-visual-caption"><span>2000—2011</span><i /><span>2012 handoff</span><i /><span>2012 onward</span></div>
              <p className="ka-home-visual-note">Illustration · not a data plot</p>
            </div>
          </div>
          <a className="ka-home-scroll-cue" href="#evidence" onClick={navJump('evidence')}><span />Scroll to the evidence</a>
        </section>

        <div className="ka-home-trust-rail" aria-label="Project sources">
          <span>NASA FIRMS</span><i />
          <span>MODIS + VIIRS</span><i />
          <span>Second Sight harmonization</span><i />
          <span>Indonesia · 2001–2025</span>
        </div>

        <section className="ka-home-section ka-home-evidence" id="evidence" aria-labelledby="ka-home-evidence-title">
          <div className="ka-home-section-inner">
            <Reveal className="ka-home-section-heading">
              <p className="ka-home-kicker">01 · The question</p>
              <h2 id="ka-home-evidence-title">When the instrument changes, the record can too.</h2>
              <p>VIIRS observes smaller hotspots than MODIS. A raw splice can make a sensor handoff look like a change in fire activity. This comparison puts the record on one Aqua-equivalent scale.</p>
            </Reveal>
            <Reveal className="ka-home-chart-wrap">
              <div className="ka-home-chart-head">
                <div>
                  <p className="ka-home-chart-label">Indonesia · annual record</p>
                  <h3>One baseline. Two ways to read the handoff.</h3>
                </div>
                <span className="ka-home-preliminary">{data?.status ?? 'PRELIMINARY'}</span>
              </div>
              {dataState === 'ready' && data ? (
                <LandingChart data={data} />
              ) : dataState === 'loading' ? (
                <div className="ka-home-loading-chart" role="status"><span />Loading the versioned record…</div>
              ) : (
                <div className="ka-home-unavailable" role="status">
                  <p>The evidence bundle could not be loaded here. No sample values are substituted.</p>
                  <a href={LANDING_ROUTES.record}>Open the full Indonesia record <span aria-hidden="true">↗</span></a>
                </div>
              )}
              <p className="ka-home-source-note">
                Underlying unit: 0.01° fire cell-days. Plot values are indexed to each series' 2003–2011 mean. Raw: MODIS through 2011, VIIRS from 2012. Harmonized: Second Sight M3, on the Aqua MODIS scale. The interval sums monthly 90% bounds.
                {data?.version ? ' Bundle ' + data.version + '.' : ''}
              </p>
            </Reveal>
            <Reveal className="ka-home-question-note">
              <span className="ka-home-note-mark" aria-hidden="true">↗</span>
              <p><strong>The question is about measurement.</strong> A change in detected hotspot cell-days does not by itself explain why fires changed, and it is not a burned-area estimate.</p>
            </Reveal>
          </div>
        </section>

        <section className="ka-home-section ka-home-method" id="method" aria-labelledby="ka-home-method-title">
          <div className="ka-home-section-inner">
            <Reveal className="ka-home-section-heading">
              <p className="ka-home-kicker">02 · The method</p>
              <h2 id="ka-home-method-title">Follow the signal through three steps.</h2>
              <p>Each step keeps the sensor transition visible so the comparison can be checked, not just trusted.</p>
            </Reveal>
            <div className="ka-home-steps">
              <Reveal className="ka-home-step">
                <span className="ka-home-step-number">01</span>
                <div className="ka-home-step-icon ka-home-step-icon--dots" aria-hidden="true"><i /><i /><i /><i /><i /></div>
                <h3>Count hotspot cell-days</h3>
                <p>NASA FIRMS detections are placed on a shared 0.01° grid and counted once per cell and local date.</p>
              </Reveal>
              <Reveal className="ka-home-step">
                <span className="ka-home-step-number">02</span>
                <div className="ka-home-step-icon ka-home-step-icon--seam" aria-hidden="true"><i /><i /><b /></div>
                <h3>Calibrate across the overlap</h3>
                <p>VIIRS is scaled to the Aqua MODIS record using the 2012–2021 calibration window and a bootstrap range.</p>
              </Reveal>
              <Reveal className="ka-home-step">
                <span className="ka-home-step-number">03</span>
                <div className="ka-home-step-icon ka-home-step-icon--range" aria-hidden="true"><i /><i /><i /></div>
                <h3>Keep the uncertainty visible</h3>
                <p>The harmonized series keeps its 90% bounds. The later 2022 sensor seam is still a known failure.</p>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="ka-home-section ka-home-validation" id="validation" aria-labelledby="ka-home-validation-title">
          <div className="ka-home-section-inner ka-home-validation-inner">
            <Reveal className="ka-home-validation-intro">
              <p className="ka-home-kicker">03 · The checks</p>
              <h2 id="ka-home-validation-title">A useful result includes the checks it failed.</h2>
              <p>{data
                ? 'The registered switch test is ' + checkLabel(data.checks.seam2012).toLowerCase() + ' at the 2012 handoff. The production series is ' + checkLabel(data.checks.seam2022).toLowerCase() + ' at the later seam. Read each result with its interval and rule.'
                : 'Sensor-seam results load from the current versioned validation file.'}</p>
              <a className="ka-home-text-link" href={LANDING_ROUTES.record}>See all validation results <span aria-hidden="true">↗</span></a>
            </Reveal>
            <div className="ka-home-check-grid">
              <Reveal><LandingCheckCard year={2012} title="M3 switch test: MODIS to VIIRS" check={data?.checks.seam2012 ?? null} /></Reveal>
              <Reveal><LandingCheckCard year={2022} title="M3 main series: S-NPP × kappa" check={data?.checks.seam2022 ?? null} /></Reveal>
            </div>
            <p className="ka-home-validation-foot">These are sensor-seam checks, not a test of policy impact or a causal explanation of the national trend.</p>
          </div>
        </section>

        <section className="ka-home-section ka-home-observe" id="observability" aria-labelledby="ka-home-observe-title">
          <div className="ka-home-section-inner ka-home-observe-grid">
            <Reveal className="ka-home-observe-visual">
              <svg viewBox="0 0 620 420" role="img" aria-labelledby="ka-home-cloud-title ka-home-cloud-desc">
                <title id="ka-home-cloud-title">A satellite cannot observe ground hidden by cloud</title>
                <desc id="ka-home-cloud-desc">Conceptual diagram. A cloud blocks the satellite's view of some ground cells; a missing detection under cloud is unobserved, not evidence of no fire.</desc>
                <defs>
                  <pattern id="ka-home-hatch" width="9" height="9" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="0" x2="0" y2="9" stroke="#f3a078" strokeOpacity=".52" strokeWidth="3" />
                  </pattern>
                  <linearGradient id="ka-home-scan" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#8bd8c2" stopOpacity=".22" />
                    <stop offset="1" stopColor="#8bd8c2" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M72 332c88-30 163-27 236-5 78 24 152 17 240-16v69H72z" fill="#173b37" stroke="#497b69" />
                <path d="M304 235h192l54 97H250z" fill="url(#ka-home-scan)" />
                <path d="M88 347h430" stroke="#42675d" strokeDasharray="3 8" />
                <rect x="254" y="332" width="152" height="36" rx="4" fill="url(#ka-home-hatch)" opacity=".88" />
                <circle cx="170" cy="337" r="7" fill="#f6a260" />
                <circle cx="455" cy="344" r="5" fill="#f6a260" />
                <g className="ka-home-cloud">
                  <path d="M220 193c0-22 18-40 40-40 7-27 31-46 60-46 35 0 63 28 63 63 24 2 42 21 42 45H220z" fill="#dfe9e2" />
                  <path d="M220 215h205" stroke="#fff" strokeOpacity=".35" strokeWidth="2" />
                </g>
                <path d="M478 84l38 31-38 31-38-31z" fill="#c2d8ce" stroke="#eff6ef" />
                <path d="M478 145v59" stroke="#9cd9c6" strokeDasharray="4 5" />
                <circle cx="478" cy="204" r="5" fill="#f6a260" />
                <text x="70" y="392" fill="#a9c7bb" fontSize="13">Clear view</text>
                <text x="287" y="392" fill="#f0b597" fontSize="13">No clear view</text>
                <text x="433" y="82" fill="#a9c7bb" fontSize="13">Satellite</text>
              </svg>
              <p>Conceptual illustration · not an estimate of hidden fires</p>
            </Reveal>
            <Reveal className="ka-home-observe-copy">
              <p className="ka-home-kicker">04 · The observation gap</p>
              <h2 id="ka-home-observe-title">A zero under cloud is not a clear observation.</h2>
              <p>Where Terra and Aqua do not see the ground, a missing hotspot is an observation gap. KalenderApi marks those gaps for the built Central Kalimantan seasons; it does not infer how many fires were hidden.</p>
              <div className="ka-home-observe-links">
                {LANDING_ROUTES.story ? <a className="ka-home-button ka-home-button--light" href={LANDING_ROUTES.story}>Follow the satellite story <span aria-hidden="true">↗</span></a> : null}
                {LANDING_ROUTES.season ? <a className="ka-home-text-link" href={LANDING_ROUTES.season}>Play a Central Kalimantan season <span aria-hidden="true">↗</span></a> : null}
              </div>
              <p className="ka-home-small-note">Cloud and smoke can obscure the view differently. This layer records clear-view gaps; it is not a hidden-fire count.</p>
            </Reveal>
          </div>
        </section>

        <section className="ka-home-final">
          <Reveal className="ka-home-final-inner">
            <p className="ka-home-kicker">Start with the record</p>
            <h2>See the comparison for yourself.</h2>
            <p>Choose an area, inspect the monthly series, and open the methods and validation behind each result.</p>
            <a className="ka-home-button ka-home-button--primary" href={LANDING_ROUTES.record}>Explore the Indonesia record <span aria-hidden="true">↗</span></a>
          </Reveal>
        </section>
      </main>

      <footer className="ka-home-footer">
        <div className="ka-home-footer-main">
          <a className="ka-home-brand" href={LANDING_ROUTES.home}><span className="ka-home-brand-mark" aria-hidden="true"><i /><i /><i /></span><span>{LANDING_BRAND}</span></a>
          <p>Indonesia’s fire record, compared across changing satellite instruments.</p>
        </div>
        <div className="ka-home-footer-meta">
          <p>Data: NASA FIRMS MODIS Collection 6.1 and VIIRS 375 m; harmonized series by Second Sight (MIT); MODIS daily FireMask for Central Kalimantan visibility.</p>
          <nav aria-label="Footer">
            <a href={LANDING_ROUTES.record}>Record</a><a href={LANDING_ROUTES.methods}>Methods</a><a href={LANDING_ROUTES.data}>Sources and data</a>
          </nav>
          <small>Preliminary analysis · Built for NASA Space Apps Challenge 2026</small>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
