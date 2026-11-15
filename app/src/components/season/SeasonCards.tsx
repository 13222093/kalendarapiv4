// KalenderApi (new file): the two cards of "Play the season" (#/season). A hotspot card says what a dot is in plain
// words; a district card is the "then what": the district's VIIRS hotspots for the day on screen, whether MODIS could see
// the district that day, the reporting rule when it mostly could not, and the district's own pages. Every number is
// handed in by pages/Season.tsx, which computes it from the loaded files. Nothing here says fire was present under
// cloud, and nothing looks ahead.
import { fmtNumber, type Lang, type Tr } from '../../lib/lang';

export interface Hotspot {
  date: string;
  weekday: string;
  lon: number;
  lat: number;
  frp: number;
  night: boolean;
  /** share (%) of the day's hotspots with a lower FRP, or null when the day has a single hotspot */
  below: number | null;
  nDay: number;
  /** the district's name; null when the point lies outside the 14 districts; undefined while the borders load */
  district: string | null | undefined;
}

export type Cloud =
  | { kind: 'share'; pct: number }   // % of the district's no-fire land under cloud all day (MODIS Terra and Aqua)
  | { kind: 'nodata' }               // no usable MODIS look that day
  | { kind: 'locked' }               // 2019: held for a registered test
  | { kind: 'missing' };             // the visibility file is not loaded

export interface DistrictView {
  name: string;
  date: string;
  year: number;
  today: number;
  soFar: number;
  cloud: Cloud;
  /** the district's id in the record (ss-data/districts/index.json): null while it loads or when it failed */
  aoiId: string | null;
  aoiFailed: boolean;
  /** only Pulang Pisau has the cell-by-cell page */
  zero: boolean;
}

/** More than this share of the district's no-fire land under cloud all day: the reporting rule is shown. */
export const MOSTLY_CLOUD = 50;

function coords(lat: number, lon: number, lang: Lang, tr: Tr) {
  const ns = lat < 0 ? tr('S', 'LS') : tr('N', 'LU');
  const ew = lon < 0 ? tr('W', 'BB') : tr('E', 'BT');
  return `${fmtNumber(Math.abs(lat), lang, 3)}° ${ns}, ${fmtNumber(Math.abs(lon), lang, 3)}° ${ew}`;
}

function HotspotFacts({ h, tr, lang, brief }: { h: Hotspot; tr: Tr; lang: Lang; brief?: boolean }) {
  return (
    <dl className="ka-season-facts">
      <div>
        <dt>{tr('Date', 'Tanggal')}</dt>
        <dd><time dateTime={h.date}>{h.date}</time>, {h.weekday} (UTC)</dd>
      </div>
      <div>
        <dt>{tr('Pass', 'Lintasan')}</dt>
        <dd>{h.night ? tr('Night pass (after midnight, local time)', 'Lintasan malam (lewat tengah malam, waktu setempat)')
          : tr('Day pass (early afternoon, local time)', 'Lintasan siang (awal sore, waktu setempat)')}</dd>
      </div>
      <div>
        <dt>{tr('Fire radiative power', 'Daya radiatif api')}</dt>
        <dd>
          <b>{fmtNumber(h.frp, lang, 1)} MW</b>
          <small>
            {tr('The heat the fire gave off as the satellite passed: higher means a more intense fire.',
              'Panas yang dipancarkan api saat satelit melintas: makin tinggi, makin kuat apinya.')}
            {h.below !== null ? ` ${tr(`Higher than ${fmtNumber(h.below, lang)}% of the ${fmtNumber(h.nDay, lang)} hotspots on the map this day.`,
              `Lebih tinggi dari ${fmtNumber(h.below, lang)}% dari ${fmtNumber(h.nDay, lang)} titik panas di peta pada hari ini.`)}` : ''}
          </small>
        </dd>
      </div>
      {brief ? null : (
        <div>
          <dt>{tr('Coordinates', 'Koordinat')}</dt>
          <dd>{coords(h.lat, h.lon, lang, tr)}</dd>
        </div>
      )}
      <div>
        <dt>{tr('District', 'Kabupaten/kota')}</dt>
        <dd>{h.district === undefined ? tr('Loading the district borders...', 'Memuat batas kabupaten/kota...')
          : h.district ?? tr('Outside the 14 districts of Central Kalimantan (the data area is a box)',
            'Di luar 14 kabupaten/kota Kalimantan Tengah (area data berupa kotak)')}</dd>
      </div>
    </dl>
  );
}

const HOTSPOT_TITLE: [string, string] = ['VIIRS detected fire here', 'VIIRS mendeteksi api di sini'];
const HOTSPOT_SUB: [string, string] = ['Suomi NPP satellite, one 375 m pixel', 'Satelit Suomi NPP, satu piksel 375 m'];

/** The small card that follows the pointer over a hotspot (mouse only; a click pins the full card). */
export function HoverTip({ x, y, h, tr, lang }: { x: number; y: number; h: Hotspot; tr: Tr; lang: Lang }) {
  const W = 248, H = 190;
  const left = x > window.innerWidth - W - 24 ? x - W - 14 : x + 16;
  const top = y > window.innerHeight - H - 24 ? y - H - 10 : y + 16;
  return (
    <div className="ka-season-tip" style={{ left: Math.max(8, left), top: Math.max(8, top), width: W }} aria-hidden="true">
      <p className="ka-season-card-title">{tr(...HOTSPOT_TITLE)}</p>
      <HotspotFacts h={h} tr={tr} lang={lang} brief />
      <p className="ka-season-tip-foot">{tr('Click to keep this card and open the district.', 'Klik untuk menahan kartu ini dan membuka kabupaten/kotanya.')}</p>
    </div>
  );
}

export function HotspotCard({ h, tr, lang }: { h: Hotspot; tr: Tr; lang: Lang }) {
  return (
    <section className="ka-season-card-sec ka-season-card-hot" aria-label={tr('Hotspot', 'Titik panas')}>
      <p className="ka-season-card-kicker"><span className="ka-sw ka-sw-today" aria-hidden="true" />{tr(...HOTSPOT_SUB)}</p>
      <h2 className="ka-season-card-title">{tr(...HOTSPOT_TITLE)}</h2>
      <HotspotFacts h={h} tr={tr} lang={lang} />
    </section>
  );
}

export function DistrictCard({ d, tr, lang }: { d: DistrictView; tr: Tr; lang: Lang }) {
  const c = d.cloud;
  const mostly = c.kind === 'share' && c.pct > MOSTLY_CLOUD;
  return (
    <section className="ka-season-card-sec ka-season-card-dist" aria-label={tr('District', 'Kabupaten/kota')}>
      <p className="ka-season-card-kicker">{tr('District', 'Kabupaten/kota')} . <time dateTime={d.date}>{d.date}</time></p>
      <h2 className="ka-season-card-title">{d.name}</h2>
      <dl className="ka-season-card-nums">
        <div>
          <dt>{tr('VIIRS hotspots this day', 'Titik panas VIIRS hari ini')}</dt>
          <dd>{fmtNumber(d.today, lang)}</dd>
        </div>
        <div>
          <dt>{tr(`This season so far (from 1 Aug ${d.year})`, `Musim ini sejauh ini (sejak 1 Agu ${d.year})`)}</dt>
          <dd>{fmtNumber(d.soFar, lang)}</dd>
        </div>
      </dl>
      <div className={`ka-season-card-cloud${mostly ? ' is-mostly' : ''}`}>
        <p className="ka-season-card-q">{tr('Could the satellite see it?', 'Apakah satelit bisa melihatnya?')}</p>
        {c.kind === 'share' ? (
          <>
            <p className="ka-season-card-share">
              <span className="ka-sw ka-sw-blind" aria-hidden="true" />
              <b>{fmtNumber(c.pct, lang, 1)}%</b> {tr('under cloud all day', 'tertutup awan seharian')}
            </p>
            <p className="ka-season-card-small">
              {tr('Share of the district\'s land with no fire detected, from the MODIS cloud map (Terra and Aqua).',
                'Bagian dari lahan kabupaten/kota tanpa deteksi api, dari peta awan MODIS (Terra dan Aqua).')}
              {mostly ? '' : ` ${tr('Terra or Aqua had a cloud-free look at the rest at least once this day.',
                'Terra atau Aqua mendapat pandangan bebas awan atas sisanya setidaknya sekali pada hari ini.')}`}
            </p>
            {mostly ? (
              <p className="ka-season-card-rule" role="note">
                {tr('Most of this district was under cloud today. Do not report "no hotspots": the satellite could not see.',
                  'Sebagian besar kabupaten/kota ini tertutup awan hari ini. Jangan laporkan "tidak ada titik panas": satelit tidak bisa melihat.')}
              </p>
            ) : null}
          </>
        ) : c.kind === 'locked' ? (
          <p className="ka-season-card-small">
            {tr('Cloud share for this district: held for a registered test (1 January to 31 October 2019).',
              'Bagian tertutup awan kabupaten/kota ini: ditahan untuk uji terdaftar (1 Januari sampai 31 Oktober 2019).')}
          </p>
        ) : c.kind === 'nodata' ? (
          <p className="ka-season-card-small">
            {tr('No usable MODIS look at this district this day (no data).', 'Tidak ada pengamatan MODIS yang dapat dipakai atas kabupaten/kota ini pada hari ini (tanpa data).')}
          </p>
        ) : (
          <p className="ka-season-card-small">
            {tr('The MODIS cloud map is not loaded for this season.', 'Peta awan MODIS belum dimuat untuk musim ini.')}
          </p>
        )}
      </div>
      <p className="ka-season-card-small ka-season-card-back">
        {tr('This looks back at a past day. It is not a forecast and not an early warning.',
          'Ini melihat ke hari yang sudah lewat. Bukan prakiraan dan bukan peringatan dini.')}
      </p>
      <div className="ka-season-card-actions">
        {d.aoiId ? (
          <>
            {/* the live page of the district (hotspots now, whether this month is usual, messages to send), then its record */}
            <a className="ka-season-card-go is-main" href={`#/now?aoi=${d.aoiId}`}>{tr('Today in this district', 'Hari ini di kabupaten ini')}</a>
            <a className="ka-season-card-go" href={`#/record?aoi=${d.aoiId}`}>{tr('Open this district\'s fire calendar', 'Buka kalender api kabupaten/kota ini')}</a>
            <a className="ka-season-card-go" href={`#/brief?aoi=${d.aoiId}`}>{tr('One-page brief', 'Ringkasan satu halaman')}</a>
          </>
        ) : d.aoiFailed ? (
          <p className="ka-season-card-small">{tr('The links to this district\'s pages could not be loaded.', 'Tautan ke halaman kabupaten/kota ini gagal dimuat.')}</p>
        ) : (
          <p className="ka-season-card-small" role="status">{tr('Loading this district\'s pages...', 'Memuat halaman kabupaten/kota ini...')}</p>
        )}
        {d.zero ? <a className="ka-season-card-go" href="#/zero">{tr('Inspect the day cell by cell', 'Periksa hari ini sel demi sel')}</a> : null}
      </div>
    </section>
  );
}
