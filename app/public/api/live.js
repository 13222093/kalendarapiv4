// KalenderApi: /api/live, a small Vercel Node function (CommonJS, Node 18+, no dependencies).
// NASA FIRMS publishes near-real-time hotspot files with no key and no CORS header, so a browser cannot read them.
// This function fetches the three South-East Asia files (VIIRS NOAA-20, VIIRS NOAA-21, MODIS), keeps the detections
// inside a box, drops low-confidence ones, and returns them as JSON. It stores nothing and sends nothing anywhere.
//
//   GET /api/live?range=24h|7d&bbox=w,s,e,n      (bbox defaults to Indonesia: 95,-11,141,6)
//
// Reply: { fetched_at, range, bbox, filter, sources: [{ sensor, name, file, last_modified, rows, kept, error? }],
//          failed: [sensor...], points: [[lon, lat, frp, "D"|"N", sensor, "YYYY-MM-DD", "HHMM"]] }
// sensor is "N20" (VIIRS NOAA-20), "N21" (VIIRS NOAA-21) or "MODIS" (Terra and Aqua). Dates and times are UTC.

const BASE = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/';
const SOURCES = [
  { sensor: 'N20', name: 'VIIRS NOAA-20', path: 'noaa-20-viirs-c2/csv/J1_VIIRS_C2_SouthEast_Asia_', viirs: true },
  { sensor: 'N21', name: 'VIIRS NOAA-21', path: 'noaa-21-viirs-c2/csv/J2_VIIRS_C2_SouthEast_Asia_', viirs: true },
  { sensor: 'MODIS', name: 'MODIS (Terra and Aqua)', path: 'modis-c6.1/csv/MODIS_C6_1_SouthEast_Asia_', viirs: false },
];
const INDONESIA = [95, -11, 141, 6];
const MODIS_MIN_CONFIDENCE = 30;
const TIMEOUT_MS = 25000;
const FILTER = 'VIIRS: confidence nominal or high. MODIS: confidence 30 or more.';

function parseBbox(text) {
  if (typeof text !== 'string' || !text) return INDONESIA;
  const p = text.split(',').map(Number);
  if (p.length !== 4 || p.some((x) => !Number.isFinite(x))) return null;
  const [w, s, e, n] = p;
  if (w >= e || s >= n || w < -180 || e > 180 || s < -90 || n > 90) return null;
  return [w, s, e, n];
}

/** The rows of one FIRMS CSV inside the box that pass the confidence rule. Columns are found by name. */
function parseCsv(text, src, bbox) {
  const lines = text.split(/\r?\n/);
  const head = (lines[0] || '').trim().split(',');
  const col = (name) => head.indexOf(name);
  const iLat = col('latitude'), iLon = col('longitude'), iDate = col('acq_date'), iTime = col('acq_time');
  const iConf = col('confidence'), iFrp = col('frp'), iDn = col('daynight');
  if (iLat < 0 || iLon < 0 || iDate < 0 || iTime < 0 || iConf < 0) throw new Error('unexpected columns: ' + head.join(',').slice(0, 120));
  const [w, s, e, n] = bbox;
  const points = [];
  let rows = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    rows++;
    const c = line.split(',');
    const lat = Number(c[iLat]), lon = Number(c[iLon]);
    if (!(lon >= w && lon <= e && lat >= s && lat <= n)) continue;
    const conf = (c[iConf] || '').trim().toLowerCase();
    if (src.viirs) {
      if (!(conf === 'n' || conf === 'h' || conf === 'nominal' || conf === 'high')) continue;
    } else if (!(Number(conf) >= MODIS_MIN_CONFIDENCE)) continue;
    const frp = iFrp >= 0 ? Number(c[iFrp]) : NaN;
    const dn = iDn >= 0 && (c[iDn] || '').trim().toUpperCase() === 'N' ? 'N' : 'D';
    const time = String(c[iTime] || '').trim().padStart(4, '0');
    points.push([Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5, Number.isFinite(frp) ? frp : null, dn, src.sensor, c[iDate], time]);
  }
  return { rows, points };
}

async function readSource(src, range, bbox) {
  const file = BASE + src.path + range + '.csv';
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(file, { signal: ctl.signal, headers: { 'User-Agent': 'KalenderApi-live/1.0' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const text = await r.text();
    const { rows, points } = parseCsv(text, src, bbox);
    const lm = r.headers.get('last-modified');
    return {
      source: { sensor: src.sensor, name: src.name, file, last_modified: lm ? new Date(lm).toISOString() : null, rows, kept: points.length },
      points,
    };
  } catch (err) {
    const message = err && err.name === 'AbortError' ? 'timed out after ' + TIMEOUT_MS / 1000 + ' s' : String((err && err.message) || err);
    return { source: { sensor: src.sensor, name: src.name, file, last_modified: null, rows: 0, kept: 0, error: message }, points: [] };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async (req, res) => {
  const send = (status, body, cache) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', cache);
    res.end(JSON.stringify(body));
  };
  try {
    const q = req.query || Object.fromEntries(new URL(req.url || '/', 'http://localhost').searchParams);
    const range = q.range === '7d' ? '7d' : q.range === undefined || q.range === '' || q.range === '24h' ? '24h' : null;
    if (!range) return send(400, { error: 'range must be 24h or 7d' }, 'no-store');
    const bbox = parseBbox(Array.isArray(q.bbox) ? q.bbox[0] : q.bbox);
    if (!bbox) return send(400, { error: 'bbox must be w,s,e,n in degrees, with w < e and s < n' }, 'no-store');

    const got = await Promise.all(SOURCES.map((s) => readSource(s, range, bbox)));
    const failed = got.filter((g) => g.source.error).map((g) => g.source.sensor);
    const points = got.flatMap((g) => g.points);
    points.sort((a, b) => (a[5] + a[6] < b[5] + b[6] ? -1 : a[5] + a[6] > b[5] + b[6] ? 1 : 0));
    const body = {
      fetched_at: new Date().toISOString(),
      range, bbox, filter: FILTER,
      times: 'acq_date and acq_time are UTC, as NASA FIRMS publishes them',
      sources: got.map((g) => g.source),
      failed,
      points,
    };
    // every source failed: say so with an error status, and do not let a cache keep it
    if (failed.length === SOURCES.length) return send(502, body, 'no-store');
    return send(200, body, failed.length ? 's-maxage=120, stale-while-revalidate=600' : 's-maxage=900, stale-while-revalidate=3600');
  } catch (err) {
    return send(500, { error: String((err && err.message) || err) }, 'no-store');
  }
};
