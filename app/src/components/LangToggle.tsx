// KalenderApi (new file): the English / Bahasa Indonesia switch shown in each KalenderApi page header.
import { setLang, useLang } from '../lib/lang.ts';
import '../styles/lang.css';

export function LangToggle({ className }: { className?: string }) {
  const lang = useLang();
  return (
    <div
      className={'ka-lang' + (className ? ' ' + className : '')}
      role="group"
      aria-label={lang === 'id' ? 'Bahasa' : 'Language'}
    >
      <button
        type="button"
        className="ka-lang-btn"
        aria-pressed={lang === 'en'}
        onClick={() => setLang('en')}
        lang="en"
        title="English"
      >
        EN
      </button>
      <button
        type="button"
        className="ka-lang-btn"
        aria-pressed={lang === 'id'}
        onClick={() => setLang('id')}
        lang="id"
        title="Bahasa Indonesia"
      >
        ID
      </button>
    </div>
  );
}
