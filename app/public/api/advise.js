// KalenderApi: drafts action advice for a district from numbers the app has already computed.
// A Vercel serverless function (Node 18+, CommonJS, no dependencies). The page posts facts; an OpenAI model writes
// three short messages from them. The model never produces numbers of its own: everything it may cite arrives in
// `facts`, validated below. The API key is read from the Vercel project's environment (OPENAI_API_KEY); nothing
// secret is in this file. OPENAI_MODEL can name a model; otherwise the efficient models are tried in order.

const SYSTEM = `You draft short action advice for Indonesian district fire officers. The KalenderApi app sends you facts about one district as JSON: satellite hotspot counts, how this month compares with the usual month, how often cloud hid the district in past seasons, and how many peat sites are worth re-checking.

The officer reads your text beside those numbers and may forward parts of it to residents, the district disaster office (BPBD) and a Manggala Agni fire crew. A wrong number, or advice that sounds more certain than the data is, could send a crew to the wrong place or stand one down too early. So:

- Use only the facts in the JSON. Add no numbers, places, names, phone numbers, dates, regulations or official statuses that are not in it. When a fact is null, say it is not available rather than guessing.
- Satellites detect heat only at the times they pass, and cloud and thick smoke hide fires. Do not say there is no fire. Say what was detected and when, and recommend a check on the ground whenever the level is "watch" or "high", or the cloud history shows the district is often hidden.
- Give no forecast and no cause. This is not an official warning.
- Write in the language named in "lang": "id" is Bahasa Indonesia, "en" is English. Plain words and short sentences that someone can act on.
- "level" is KalenderApi's own rule (calm, watch or high), not an official government status. When you name it, write the word in "level_name" and say it is the app's own level. Do not write the English value of "level" in Indonesian text.
- "peat_cells_where_fire_came_back_in_past_seasons" counts peat locations (about 1 km each) where fire returned in earlier seasons. It is a pool, not a list of places burning now. When it is provided, tell the crew to start with the peat sites the page lists with coordinates, and give the number only as background. Never tell anyone to visit all of them.
- Write exactly three sections, each with a one-line heading and two to four sentences: one for residents and the village, one for the district disaster office (BPBD), one for the Manggala Agni crew.
- Plain text only: no Markdown symbols, no bullet characters.
- Finish with one line saying this text was drafted by AI from the app's numbers and must be checked before it is sent.`;

const MODELS = ['gpt-6-luna', 'gpt-5.6-luna', 'gpt-5.4-mini', 'gpt-5-mini'];
const LEVELS = new Set(['calm', 'watch', 'high']);
// The words the page itself shows for each level (lib/now.ts), so the draft and the page agree.
const LEVEL_NAMES = { calm: { en: 'Calm', id: 'Tenang' }, watch: { en: 'Watch', id: 'Waspada' }, high: { en: 'High', id: 'Tinggi' } };
const NAME = /^[\p{L}\p{M} .,'()-]{1,60}$/u;

function count(value, max = 10000000) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Keeps only the fields the prompt expects, with their types checked. Returns null when the request is unusable. */
function clean(body) {
  if (!body || typeof body !== 'object') return null;
  const f = body.facts;
  if (!f || typeof f !== 'object') return null;
  if (typeof f.district !== 'string' || !NAME.test(f.district)) return null;
  if (typeof f.province !== 'string' || !NAME.test(f.province)) return null;
  if (!LEVELS.has(f.level)) return null;
  const month = typeof f.month === 'string' && /^\d{4}-\d{2}$/.test(f.month) ? f.month : null;
  const asOf = typeof f.as_of === 'string' && !Number.isNaN(Date.parse(f.as_of)) ? new Date(f.as_of).toISOString() : null;
  const lang = body.lang === 'en' ? 'en' : 'id';
  return {
    lang,
    facts: {
      district: f.district,
      province: f.province,
      data_time: asOf,
      hotspots_last_24_hours: count(f.hotspots_24h),
      hotspots_last_7_days: count(f.hotspots_7d),
      viirs_hotspots_last_24_hours: count(f.viirs_24h),
      modis_hotspots_last_24_hours: count(f.modis_24h),
      month,
      month_count_on_one_scale: count(f.month_count),
      usual_count_for_this_month: count(f.month_median),
      times_the_usual_month: count(f.month_ratio, 100000),
      month_is_provisional: f.month_provisional === true,
      level: f.level,
      level_name: LEVEL_NAMES[f.level][lang],
      past_district_days_mostly_under_cloud: count(f.cloud_days_above),
      past_district_days_counted: count(f.cloud_days_total),
      peat_cells_where_fire_came_back_in_past_seasons: count(f.peat_sites, 100000),
    },
  };
}

/** One request to one model. Returns { status, data }; status 0 means the request never got an answer. */
async function ask(model, key, input) {
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: JSON.stringify(input) },
        ],
        // Three brief messages; the ceiling leaves room for a model that reasons before it writes.
        max_completion_tokens: 4096,
      }),
      signal: AbortSignal.timeout(40000),
    });
    return { status: r.status, data: await r.json().catch(() => null) };
  } catch {
    return { status: 0, data: null };
  }
}

/** OpenAI's machine-readable error code, e.g. "model_not_found", "invalid_api_key", "insufficient_quota". */
function errorCode(data) {
  return (data && data.error && (data.error.code || data.error.type)) || null;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    res.status(503).json({ error: 'not_configured' });
    return;
  }
  const input = clean(typeof req.body === 'string' ? safeParse(req.body) : req.body);
  if (!input) {
    res.status(400).json({ error: 'bad_facts' });
    return;
  }

  const models = process.env.OPENAI_MODEL ? [process.env.OPENAI_MODEL, ...MODELS] : MODELS;
  let last = { status: 0, data: null };
  for (const model of models) {
    last = await ask(model, key, input);
    if (last.status === 401) break;
    // This model is not offered to this key (404, or 400/403 naming the model): try the next one.
    if (last.status === 404 || last.status === 400 || last.status === 403) continue;
    if (last.status !== 200) break;

    const choice = last.data && last.data.choices && last.data.choices[0];
    const message = (choice && choice.message) || {};
    const text = typeof message.content === 'string' ? message.content.trim() : '';
    if (!text) {
      res.status(200).json({ ok: false, reason: message.refusal ? 'refusal' : 'empty' });
      return;
    }
    res.status(200).json({
      ok: true,
      text,
      model: (last.data && last.data.model) || model,
      truncated: choice.finish_reason === 'length',
      generated_at: new Date().toISOString(),
    });
    return;
  }

  const code = errorCode(last.data);
  if (last.status === 401 || code === 'invalid_api_key') res.status(503).json({ error: 'not_configured' });
  else if (last.status === 429) res.status(429).json({ error: code === 'insufficient_quota' ? 'quota_used_up' : 'rate_limited' });
  else if (last.status === 0) res.status(502).json({ error: 'upstream_unreachable' });
  else res.status(502).json({ error: 'upstream_error', status: last.status });
};
