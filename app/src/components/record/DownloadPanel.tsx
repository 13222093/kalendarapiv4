// KalenderApi (new file): the downloads of the Indonesia record page, for the picked area and range. CSV of the monthly
// series and of "the same months in every year" (each file starts with "#" lines: project, area, unit, data version,
// method, date, and that fire cell-days are not burned area); PNG of the calendar and of the before and after chart
// (the chart's SVG drawn into a canvas); and, for Central Kalimantan, the real VIIRS detections of the built seasons
// (ka-data/kalteng_<Y>_season.json, the points Play the season draws) for the days inside the range. For any other area
// or date the page says plainly that the point file is not bundled and links to the NASA FIRMS archive download.
// The page texts are in English and Bahasa Indonesia (lib/lang.ts); the CSV files stay in English.
import { AskGlyph } from '../home/Drawings';
import { useState } from 'react';
import { cssVar } from '../ui';
import { currentTheme } from '../../lib/theme';
import { useLang, useTr } from '../../lib/lang';
import { figurePng, fileSlug, saveFile, saveText, svgString } from '../../lib/download';
import {
  KALTENG, hotspotCsv, loadSeasonPoints, monthlyCsv, rangeLabel, sameMonthsCsv, seasonDaysInRange, windowsInRange,
  type CsvMeta, type MonthRange, type MonthRow, type SameMonths, type SeasonWindow, type Series,
} from '../../lib/record';
import { calendarSvg, type CalendarPalette } from './DownloadFigures';

export const FIRMS_DOWNLOAD = 'https://firms.modaps.eosdis.nasa.gov/download/';

function palette(): CalendarPalette {
  const dark = currentTheme() === 'dark';
  const steps = [cssVar('--surface-2', '#1a1f27'), ...Array.from({ length: 9 }, (_, i) => cssVar(`--ember-${(i + 1) * 100}`, '#c8552b'))];
  // text on the ramp, as styles/record.css: dark theme, steps 1 to 5 are dark; light theme, steps 5 to 9 are dark
  const ink = steps.map((_, s) => (s === 0 ? cssVar('--text-3', '#8a8f98')
    : dark ? (s <= 5 ? '#f4ece4' : '#1d0f08') : (s <= 4 ? '#3a1a0e' : '#fff6ee')));
  return {
    steps, ink, text: cssVar('--text', '#f2f3f5'), text2: cssVar('--text-2', '#b4b9c2'), text3: cssVar('--text-3', '#8a8f98'),
    surface: cssVar('--surface', '#11151c'), border: cssVar('--border-strong', '#3a4250'), accent: cssVar('--accent', '#ff7a3d'),
  };
}
const figureColors = () => ({ bg: cssVar('--surface', '#11151c'), text: cssVar('--text', '#f2f3f5'), text2: cssVar('--text-2', '#b4b9c2') });
const bodyFont = () => getComputedStyle(document.body).fontFamily;

type Job = { state: 'busy' | 'done' | 'error'; text: string } | null;

export function DownloadPanel({ rows, area, fileArea, aoiId, range, picked, series, computed, same, held, meta, windows, source, unit, onRange }: {
  rows: MonthRow[];
  area: string;                      // the area's name in the page's language
  fileArea: string;                  // its English name, for file names
  aoiId: string;
  range: MonthRange;                 // the range shown (the whole record when none is picked)
  picked: boolean;                   // a range is picked (the calendar picture fades the other months)
  series: Series; computed: Set<string> | null;
  same: SameMonths | null; held: boolean;
  meta: Omit<CsvMeta, 'generated'>;
  windows: SeasonWindow[] | null;    // the built point files and their months (null while checking)
  source: string; unit: string;
  onRange: (r: MonthRange) => void;
}) {
  const tr = useTr();
  const lang = useLang();
  const [job, setJob] = useState<Job>(null);
  const slug = `kalenderapi_${fileSlug(fileArea)}_${range.from}_${range.to}`;
  const today = () => new Date().toISOString().slice(0, 10);
  const run = async (what: string, make: () => Promise<string> | string) => {
    setJob({ state: 'busy', text: tr(`Making ${what}...`, `Membuat ${what}...`) });
    try {
      const file = await make();
      setJob({ state: 'done', text: tr(`Saved ${file}`, `Tersimpan: ${file}`) });
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e);
      setJob({ state: 'error', text: tr(`${what[0]!.toUpperCase()}${what.slice(1)} could not be made: ${why}. Try again.`, `${what[0]!.toUpperCase()}${what.slice(1)} tidak dapat dibuat: ${why}. Coba lagi.`) });
    }
  };
  const busy = job?.state === 'busy';

  const saveMonthly = () => run(tr('the monthly series', 'seri bulanan'), () => {
    const file = `${slug}_monthly.csv`;
    saveText(monthlyCsv(rows, range, { ...meta, generated: today() }, computed), file);
    return file;
  });
  const saveSame = () => run(tr('the same-months table', 'tabel bulan yang sama'), () => {
    if (!same) throw new Error(tr('the range is longer than 12 months', 'rentang lebih dari 12 bulan'));
    const file = `${slug}_same_months.csv`;
    saveText(sameMonthsCsv(same, range, { ...meta, generated: today() }, held), file);
    return file;
  });
  const foot = () => [
    source,
    tr(`Fire cell-days are not burned area. Data version ${meta.dataVersion?.slice(0, 8) ?? 'not stated'}. Made ${today()} with KalenderApi.`,
      `Sel-hari api bukan luas terbakar. Versi data ${meta.dataVersion?.slice(0, 8) ?? 'tidak disebutkan'}. Dibuat ${today()} dengan KalenderApi.`),
  ];
  const saveCalendar = () => run(tr('the calendar picture', 'gambar kalender'), async () => {
    const cal = calendarSvg(rows, series, picked ? range : null, computed, palette(), lang);
    const y0 = rows[0]!.year, y1 = rows[rows.length - 1]!.year;
    const blob = await figurePng({
      title: tr(`${area}: every month, ${y0} to ${y1}${picked ? ` (${rangeLabel(range)} picked)` : ''}`,
        `${area}: setiap bulan, ${y0} sampai ${y1}${picked ? ` (${rangeLabel(range, 'id')} dipilih)` : ''}`),
      subtitle: `${series === 'harm' ? tr('Harmonized (VIIRS on the Aqua MODIS scale).', 'Terharmonisasi (VIIRS pada skala Aqua MODIS).') : tr('Raw, as recorded (MODIS to 2011, VIIRS from 2012).', 'Mentah, sebagaimana tercatat (MODIS sampai 2011, VIIRS sejak 2012).')} ${unit} ${tr(
        'Dot: cloud-free look; hatching: partly cloud-free or no cloud-free look; unmarked: cloud view not computed. Outline: provisional.',
        'Titik: pandangan bebas awan; arsiran: sebagian bebas awan atau tanpa pandangan bebas awan; tanpa tanda: pandangan awan tidak dihitung. Garis tepi: sementara.')}`,
      ...cal, foot: foot(), colors: figureColors(), font: bodyFont(),
    });
    const file = `${slug}_calendar_${series === 'harm' ? 'harmonized' : 'raw'}.png`;
    saveFile(blob, file);
    return file;
  });
  const saveChart = () => run(tr('the before and after picture', 'gambar sebelum dan sesudah'), async () => {
    const fig = document.querySelector('#jump .ka-rec-ba');
    // the main chart is the figure that is followed by the key of its lines
    const keyList = fig?.querySelector('.ka-rec-key');
    const el = (keyList?.previousElementSibling?.querySelector<SVGSVGElement>('.ui-figure-plot svg'))
      ?? fig?.querySelector<SVGSVGElement>('.ui-figure-plot svg');
    if (!fig || !el) throw new Error(tr('the chart is not drawn yet', 'grafik belum digambar'));
    const figure = el.closest('.ui-figure');
    const key = [...(keyList?.querySelectorAll<HTMLLIElement>('li') ?? [])].map((li) => ({
      label: li.textContent ?? '', color: getComputedStyle(li.querySelector('i') ?? li).borderTopColor,
    }));
    const blob = await figurePng({
      title: figure?.querySelector('.ui-figure-title')?.textContent ?? tr(`${area}: before and after harmonization`, `${area}: sebelum dan sesudah harmonisasi`),
      subtitle: figure?.querySelector('.ui-figure-subtitle')?.textContent ?? undefined,
      ...svgString(el), key, foot: foot(), colors: figureColors(), font: bodyFont(),
    });
    const file = `kalenderapi_${fileSlug(fileArea)}_before_after.png`;
    saveFile(blob, file);
    return file;
  });

  // hotspot points: only Central Kalimantan's built seasons are in the app
  const inSeasons = aoiId === KALTENG && windows ? windowsInRange(windows, range) : [];
  const seasonNames = (ws: SeasonWindow[]) => ws.map((w) => rangeLabel(w, lang)).join('; ');
  const saveHotspots = () => run(tr('the hotspot file', 'berkas titik panas'), async () => {
    const files = await Promise.all(inSeasons.map((w) => loadSeasonPoints(w.key)));
    if (!files.some((f) => seasonDaysInRange(f, range).length)) throw new Error(tr('no day of a built season is inside the range', 'tidak ada hari dari musim yang tersedia di dalam rentang'));
    const file = `kalenderapi_central_kalimantan_box_${range.from}_${range.to}_viirs_hotspots.csv`;
    saveText(hotspotCsv(files, range, today()), file);
    return file;
  });
  const firms = <a href={FIRMS_DOWNLOAD} target="_blank" rel="noreferrer">{tr('NASA FIRMS archive download', 'unduhan arsip NASA FIRMS')}</a>;
  const label = rangeLabel(range, lang);

  return (
    <div className="ka-rec-dl">
      <div className="ka-rec-dl-group">
        <p className="ka-rec-dl-title"><AskGlyph icon="csv" />{tr('Numbers (CSV)', 'Angka (CSV)')}</p>
        <div className="ka-rec-dl-btns">
          <button type="button" className="ui-btn" disabled={busy} onClick={saveMonthly}>{tr('Monthly series (CSV)', 'Seri bulanan (CSV)')}</button>
          <button type="button" className="ui-btn" disabled={busy || !same} onClick={saveSame}
            title={same ? undefined : tr('Needs a range of 12 months or fewer', 'Memerlukan rentang 12 bulan atau kurang')}>{tr('Same months in every year (CSV)', 'Bulan yang sama setiap tahun (CSV)')}</button>
        </div>
        <p className="ka-rec-note">
          {area}, {label}. {tr('Each file starts with lines marked # that give the area, the unit, the data version, the method and the date. The files are in English.',
            'Setiap berkas diawali baris bertanda # yang memuat wilayah, satuan, versi data, metode, dan tanggal. Berkas ditulis dalam bahasa Inggris.')}
          {same ? '' : tr(' The same-months table needs a range of 12 months or fewer.', ' Tabel bulan yang sama memerlukan rentang 12 bulan atau kurang.')}
        </p>
      </div>
      <div className="ka-rec-dl-group">
        <p className="ka-rec-dl-title"><AskGlyph icon="calendar" />{tr('Pictures (PNG)', 'Gambar (PNG)')}</p>
        <div className="ka-rec-dl-btns">
          <button type="button" className="ui-btn" disabled={busy} onClick={saveCalendar}>{tr('Calendar (PNG)', 'Kalender (PNG)')}</button>
          <button type="button" className="ui-btn" disabled={busy} onClick={saveChart}>{tr('Before and after chart (PNG)', 'Grafik sebelum dan sesudah (PNG)')}</button>
        </div>
        <p className="ka-rec-note">
          {tr('In the theme and language on screen, with the title, the unit and the source written in.', 'Dalam tema dan bahasa yang tampil di layar, dengan judul, satuan, dan sumber tertulis di dalamnya.')}
          {picked ? tr(' The calendar picture fades the months outside the range.', ' Gambar kalender memudarkan bulan di luar rentang.') : ''}
        </p>
      </div>
      <div className="ka-rec-dl-group">
        <p className="ka-rec-dl-title"><AskGlyph icon="download" />{tr('Hotspots of the search (CSV)', 'Titik panas hasil pencarian (CSV)')}</p>
        {aoiId !== KALTENG ? (
          <p className="ka-rec-note">
            {tr(`The hotspot point file is not bundled for ${area}: this app holds points only for Central Kalimantan's built seasons. Download the detections of any area and dates from the `,
              `Berkas titik panas tidak disertakan untuk ${area}: aplikasi ini hanya menyimpan titik untuk musim yang tersedia di Kalimantan Tengah. Unduh deteksi untuk wilayah dan tanggal mana pun dari `)}{firms}.
          </p>
        ) : windows === null ? (
          <p className="ka-rec-note" role="status">{tr('Checking which season files are built...', 'Memeriksa berkas musim yang tersedia...')}</p>
        ) : windows.length === 0 ? (
          <p className="ka-rec-note">{tr('The season point files are not built yet. Meanwhile, the detections are at the ', 'Berkas titik musim belum dibuat. Sementara itu, deteksinya tersedia di ')}{firms}.</p>
        ) : inSeasons.length ? (
          <>
            <div className="ka-rec-dl-btns">
              <button type="button" className="ui-btn ui-btn-primary" disabled={busy} onClick={saveHotspots}>{tr('Download hotspots (CSV)', 'Unduh titik panas (CSV)')}</button>
            </div>
            <p className="ka-rec-note">
              {tr(`NASA FIRMS VIIRS S-NPP 375 m detections (date, longitude, latitude, fire radiative power, day or night) for the days inside this range of: ${seasonNames(inSeasons)}. The points come from a box around Central Kalimantan, not the province outline. Days of the range outside a built point file are not in the file; get them from the `,
                `Deteksi NASA FIRMS VIIRS S-NPP 375 m (tanggal, bujur, lintang, daya radiatif api, siang atau malam) untuk hari-hari di dalam rentang ini dari: ${seasonNames(inSeasons)}. Titik berasal dari kotak di sekitar Kalimantan Tengah, bukan batas provinsi. Hari dalam rentang yang berada di luar berkas titik yang tersedia tidak ada dalam berkas; dapatkan dari `)}{firms}.
            </p>
          </>
        ) : (
          <>
            <p className="ka-rec-note">
              {tr('No bundled hotspot day falls in this range. The point files cover only the periods below (Central Kalimantan). For other dates, use the ',
                'Tidak ada hari titik panas yang disertakan dalam rentang ini. Berkas titik hanya mencakup periode di bawah ini (Kalimantan Tengah). Untuk tanggal lain, gunakan ')}{firms}
              {tr('. Or pick a built period:', '. Atau pilih periode yang tersedia:')}
            </p>
            <div className="ka-rec-dl-btns">
              {windows.map((w) => (
                <button key={w.key} type="button" className="ka-rec-chip" onClick={() => onRange({ from: w.from, to: w.to })}>{rangeLabel(w, lang)}</button>
              ))}
            </div>
          </>
        )}
      </div>
      <p className={`ka-rec-dl-status${job?.state === 'error' ? ' is-error' : ''}`} role={job?.state === 'error' ? 'alert' : 'status'}>
        {job?.text ?? ''}
      </p>
    </div>
  );
}
