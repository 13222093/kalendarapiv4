// KalenderApi (new file): a short conversation with an AI assistant on the Today page, for a resident or an officer.
// A question goes to POST /api/ask (public/api/ask.js) with the numbers this page already shows for the district; the
// model answers from those numbers only. Nothing is stored: the conversation lives in this component and is gone when
// the page is left. When the site has no AI key, or is a copy without the function, the panel says so and stays quiet.
// Styles: styles/askassistant.css (tokens of brand.css only).
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTr, type Lang } from '../../lib/lang';
import '../../styles/askassistant.css';

const BASE = import.meta.env.BASE_URL;
const MAX_QUESTION = 400;     // as public/api/ask.js
const TURNS_SENT = 6;         // earlier turns sent with a question, as public/api/ask.js
const WAIT_MS = 45_000;

/** The district's numbers as the page holds them (pages/Now.tsx builds it); the function checks every field. */
export type AskFacts = Record<string, unknown>;

interface Turn { role: 'user' | 'assistant'; text: string }
type Status = 'idle' | 'working' | 'failed' | 'busy' | 'off' | 'unavailable';

/** `variant`: 'card' is the classic page's card; 'panel' is the same conversation without the card frame, fitted to the
 *  command view's Assistant tab (styles/nowconsole.css). */
export function AskAssistant({ facts, lang, place, hasPeat, variant = 'card' }: { facts: AskFacts; lang: Lang; place: string; hasPeat: boolean; variant?: 'card' | 'panel' }) {
  const tr = useTr();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;   // the newest turn stays in view
  }, [turns, status]);

  const closed = status === 'off' || status === 'unavailable';
  const send = async (question: string) => {
    const q = question.replace(/\s+/g, ' ').trim().slice(0, MAX_QUESTION);
    if (q.length < 2 || status === 'working' || closed) return;
    const history = turns.slice(-TURNS_SENT);
    setTurns((prev) => [...prev, { role: 'user', text: q }]);
    setText('');
    setStatus('working');
    const ctl = new AbortController();
    const timer = window.setTimeout(() => ctl.abort(), WAIT_MS);
    try {
      const r = await fetch(`${BASE}api/ask`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang, facts, question: q, history }), signal: ctl.signal,
      });
      if (r.status === 429) { setStatus('busy'); return; }
      if (!(r.headers.get('content-type') ?? '').includes('json')) { setStatus('unavailable'); return; }
      const body = await r.json() as { ok?: boolean; text?: unknown; error?: unknown };
      if (r.status === 503 && body.error === 'not_configured') { setStatus('off'); return; }
      if (r.ok && body.ok === true && typeof body.text === 'string' && body.text.trim()) {
        const answer = body.text.trim();
        setTurns((prev) => [...prev, { role: 'assistant', text: answer }]);
        setStatus('idle');
      } else if (r.ok && body.ok === false) setStatus('failed');
      else setStatus('unavailable');
    } catch {
      setStatus('failed');   // no reply at all (network, or the time limit): the box stays, to ask again
    } finally {
      window.clearTimeout(timer);
    }
  };
  const submit = (e: FormEvent) => { e.preventDefault(); void send(text); };

  const suggestions: string[] = [
    tr('What does this level mean?', 'Apa arti tingkat ini?'),
    tr('Where is the newest hotspot?', 'Titik panas terbaru di mana?'),
    tr('Today shows zero hotspots. Is the fire out?', 'Hari ini nol titik panas. Apakah apinya sudah padam?'),
    tr('What should I do now?', 'Apa yang harus saya lakukan sekarang?'),
    ...(hasPeat ? [tr('Which peat sites should be checked again?', 'Lokasi gambut mana yang perlu dicek ulang?')] : []),
  ];

  return (
    <section className={variant === 'panel' ? 'ka-ask ka-ask-panel' : 'now-card ka-ask'} id="now-ask" aria-labelledby="now-h-ask">
      <p className="now-kicker">{tr('AI assistant', 'Asisten AI')}</p>
      <h2 id="now-h-ask">{tr('Ask about this district', 'Tanya tentang kabupaten ini')}</h2>
      <p>
        {tr(`For residents and officers in ${place}. The assistant answers only from the numbers on this page. It does not forecast, and its answers are not an official warning.`,
          `Untuk warga dan petugas di ${place}. Asisten menjawab hanya dari angka di halaman ini. Ia tidak meramal, dan jawabannya bukan peringatan resmi.`)}
      </p>
      <div className="ka-ask-chips" role="group" aria-label={tr('Example questions', 'Contoh pertanyaan')}>
        {suggestions.map((q) => (
          <button key={q} type="button" className="ka-ask-chip" disabled={status === 'working' || closed} onClick={() => { void send(q); }}>{q}</button>
        ))}
      </div>
      <div className="ka-ask-log" ref={log} role="log" aria-live="polite" aria-label={tr('Conversation', 'Percakapan')} tabIndex={0}>
        {turns.length === 0 && status !== 'working' ? (
          <div className="ka-ask-empty">{tr('Pick a question above or write your own.', 'Pilih pertanyaan di atas atau tulis sendiri.')}</div>
        ) : null}
        {turns.map((t, i) => (
          <div key={i} className={`ka-ask-bubble${t.role === 'user' ? ' is-mine' : ''}`}>
            <span className="ka-ask-who">{t.role === 'user' ? tr('You', 'Anda') : tr('AI assistant', 'Asisten AI')}</span>
            {t.text}
          </div>
        ))}
        {status === 'working' ? <div className="ka-ask-bubble ka-ask-wait">{tr('Reading the numbers… (up to 20 seconds)', 'Membaca angkanya… (hingga 20 detik)')}</div> : null}
      </div>
      <div role="status">
        {status === 'failed' ? <p className="now-note">{tr('The assistant could not answer that. You can ask again; everything it would use is on this page.', 'Asisten tidak dapat menjawab itu. Anda dapat bertanya lagi; semua yang ia pakai ada di halaman ini.')}</p> : null}
        {status === 'busy' ? <p className="now-note">{tr('The assistant is busy; try again in a minute.', 'Asisten sedang sibuk; coba lagi sebentar lagi.')}</p> : null}
        {status === 'off' ? <p className="now-note">{tr('The AI assistant is switched off on this site. The numbers and the messages on this page are complete without it.', 'Asisten AI sedang dimatikan di situs ini. Angka dan pesan di halaman ini lengkap tanpa asisten.')}</p> : null}
        {status === 'unavailable' ? <p className="now-note">{tr('The AI assistant is not available on this copy of the site. The numbers and the messages on this page are complete without it.', 'Asisten AI tidak tersedia di salinan situs ini. Angka dan pesan di halaman ini lengkap tanpa asisten.')}</p> : null}
      </div>
      <form className="ka-ask-form" onSubmit={submit}>
        <label className="ka-ask-label" htmlFor="now-ask-input">{tr('Your question', 'Pertanyaan Anda')}</label>
        <input id="now-ask-input" className="ka-ask-input" type="text" value={text} maxLength={MAX_QUESTION} autoComplete="off" enterKeyHint="send"
          placeholder={tr('For example: is there fire near the river?', 'Misalnya: apakah ada api di dekat sungai?')}
          onChange={(e) => setText(e.target.value)} disabled={closed} />
        <button type="submit" className="now-btn now-btn-primary" disabled={status === 'working' || closed || text.trim().length < 2}>{tr('Ask', 'Tanya')}</button>
      </form>
      <p className="now-small">
        {tr('Your question and the numbers on this page (district, counts, level, coordinates of hotspots and peat sites) go to an AI model through this site. Do not write names, phone numbers or addresses. In an emergency, move away from fire and smoke and tell the village head or the district disaster office.',
          'Pertanyaan Anda dan angka di halaman ini (kabupaten, jumlah, tingkat, koordinat titik panas dan lokasi gambut) dikirim ke sebuah model AI melalui situs ini. Jangan menulis nama, nomor telepon, atau alamat. Dalam keadaan darurat, jauhi api dan asap lalu beri tahu kepala desa atau BPBD.')}
      </p>
    </section>
  );
}
