# UI/UX: teardown kode pesaing, building blocks, referensi desain, anti AI-slop

Disusun 13 Nov 2026 untuk **Second Sight** (kalender aktivitas kebakaran terharmonisasi MODIS+VIIRS, gambut Indonesia).
Metode: blobless `git clone --depth 1` lalu membaca file langsung (`git show HEAD:path`), npm registry untuk versi/lisensi,
raw.githubusercontent.com untuk file LICENSE. GitHub API tidak dipakai. Item yang tidak bisa dicek langsung ditandai **[UNVERIFIED]**.

> Ringkasan keputusan: **jangan pakai "kulit" visual pesaing.** Yang layak diambil adalah **logika dan pola interaksi**
> (skala warna adaptif per-AOI, grid keyboard kalender, URL hash state, AreaPicker 5 mode, ekspor PNG/CSV dari data,
> aturan warna "no data ≠ no fire"). Tema mereka (near-black + ember glow + Inter/JetBrains Mono; atau Plex + Tailwind
> hasil "Claude Design") justru termasuk ciri AI-slop di bagian D, dan juri akan melihat demo mereka juga.

---

## A) Teardown frontend per repo + tabel komponen yang bisa dipakai ulang

### A1. Warren-530/fire-harmony (Apache-2.0, tanpa file NOTICE, copyright line di LICENSE tidak diisi)

- **Framework:** React 19.3 + Vite 8 + TypeScript 7 (folder `app/`), lint oxlint, test vitest + skrip Playwright (`app/scripts/test_*.mjs`).
- **Library:** `maplibre-gl ^6.17`, `@deck.gl/{core,layers,geo-layers,mapbox} ^9.4.1` (H3HexagonLayer lewat `MapboxOverlay`), `@observablehq/plot ^0.6.19`,
  `@duckdb/duckdb-wasm ^1.33.1-dev57.0`, `apache-arrow ^21.2`, `h3-js ^4.5`. **Tanpa** Tailwind/shadcn/D3 langsung, tanpa library draw
  (gambar rectangle/polygon ditulis sendiri). Basemap: OpenFreeMap style yang di-recolor saat load (`explorer/basemap.ts`).
- **Struktur:** `app/src/{pages,components,components/{dashboard,explorer,methods,pages,period,rankings},lib,styles}`; desain didokumentasikan di
  `app/DESIGN.md` (aturan token, interaksi, chart, layout, kata-kata) dan `style/` (brand Quarto + matplotlib style → laporan dan web satu identitas).
- **Kalender** (`app/src/components/Calendar.tsx`, 306 baris): SVG custom, tahun ke bawah × bulan ke samping, ukuran sel dihitung dari lebar
  (ResizeObserver), dua mode `count` / `anomaly`. Skala warna **adaptif per area**: `countScale()` = log-steps antara kuantil 2% dan 98% bulan
  berapi, dibulatkan ke angka "rapi", minimal faktor 3; `ratioLimit()` memilih batas rasio bulat (1.25/1.5/2/3/4/8/16×) yang menutup 90% bulan;
  `ratioClass()` = log2(nilai/normal) → 9 kelas (pusat = normal). Hatching untuk "no data", hatching lain untuk "dimodelkan tanpa MODIS".
  **Aksesibilitas bagus:** `role="grid"`/`row`/`gridcell`, `aria-label` per sel berisi kalimat ("Oktober 2015: 12.300 hotspot, 4,2× normal"),
  `aria-selected`, keyboard ← → (bulan), ↑ ↓ (tahun), Home/End, PageUp/PageDown (±5 tahun), Enter/Space (pilih). Satu sel `tabIndex=0` di SVG.
- **Legend** (`components/Legend.tsx`): colour bar SVG (ikut terunduh), palet dari CSS var `--ember-100..900` (9 kelas sekuensial) dan
  `--anom-b4..r4` (9 kelas divergen biru↔merah). Nilai hex dark/light ada di `styles/theme.css` (mis. light anomaly `#0b4c92 … #f0efec … #862723`).
- **duckdb-wasm** (`lib/db.ts`, 147 baris): satu instance, bundle mvp/eh via `?url` Vite, ekstensi `parquet`/`json` di-host sendiri di
  `public/duckdb-ext/` (fallback ke host DuckDB). **Temuan penting:** GitHub Pages mengompres `.parquet` on-the-fly sehingga **HTTP range request
  tidak bisa dipakai** → file kecil diambil utuh dan diregistrasi sebagai buffer; file besar (hotspot) ditaruh di Hugging Face dataset yang melayani
  byte-range sungguhan dan diregistrasi via URL. (Untuk Cloudflare Pages/R2 perilaku range + kompresi perlu diuji sendiri **[UNVERIFIED]**.)
- **Data kecil per tempat** (`lib/web.ts`): tiap tempat bernama = 1 file JSON, tanpa database. Pola yang bagus untuk preset AOI.
- **i18n** (`lib/i18n.ts`, 1.645 baris): kamus bertipe (`interface Dict`) + `useI18n()` context + `formatMonth/formatNumber/formatTimes` via `Intl`.
  Saat ini EN saja (Malay direncanakan). Tidak memakai i18next.
- **URL state:** hash, contoh `#/?area=state:IDN-1931&month=202610&mode=anomaly&view=3d`. Semua halaman (Dashboard, Rankings) menaruh filter di link.
- **Keyboard global:** Ctrl/Cmd+K command palette, Space play, ←/→ bulan, Shift+←/→ tahun, D 2D/3D, C/A/R mode, T tema, ? daftar shortcut.
- **Download:** `lib/download.ts` (`fileSlug` + `saveFile` via `<a download>`), `components/Downloads.tsx` (menu-button ARIA penuh: CSV bulanan +
  rentang 90% + normal, PNG kalender & chart yang **digambar ulang dari data**, bukan screenshot, lengkap judul/subjudul/sumber: `explorer/exportImages.ts`).
- **Tema:** dark-first "Mission Control", light via `html[data-theme="light"]`; token di `styles/tokens.css` (skala tipe 12–30, spasi 4px, durasi motion,
  z-layer). Font Inter + JetBrains Mono (keduanya OFL, file lisensi ikut disertakan).
- **Aturan chart yang patut ditiru** (DESIGN.md §4): judul = temuan, subjudul = satuan; garis 2 px, harmonized 2,6 px + band 90%; tanpa frame, tanpa
  dual axis, tanpa pie; tooltip saat hover **dan** focus; **table view untuk setiap chart**; angka untuk manusia ("1,33 juta", "0,94× normal");
  satu kata vonis tren yang sama di semua halaman ("naik/turun/tidak jelas/tidak diuji").

### A2. the-aris-club/flare-chronos (MIT, "Copyright (c) 2026 Xiro The Dev")

- **Framework:** Next.js 16.4 (app router) + React 19.3 + React Compiler, Bun, **Tailwind v4** (`@theme inline` token), `next-intl 4.14` (EN/VI, locale via
  cookie), `next-themes`, `recharts 3.10`, `three 0.184` (globe landing), `d3-geo` + `topojson-client` (dev, untuk build data), `lucide-react`. **Tanpa MapLibre**:
  peta adalah SVG custom dengan relief raster + heksagon H3 yang dibinned di klien (`components/workbench/workbench-map.tsx`, `lib/workbench/h3.ts`).
- **Struktur:** `apps/workbench/src/{app,components/{globe,review,ui,workbench},i18n,lib/{calendar,globe,review,service,workbench}}`.
- **Kalender:** `components/workbench/{burning-calendar,calendar-grid,calendar-legend,calendar-summary}.tsx` + `lib/calendar/*` — tahun × **73 pentad**,
  ~1.900 sel di-memo, ring fokus digambar terpisah, pointer → sel dihitung dari koordinat (`refFromPoint`).
- **Warna:** `lib/calendar/ramp.ts` — **ramp OKLCH prosedural** (sekuensial: L 0,25→0,93, hue 25→90 di dark; divergen: hue 255 biru / 35 oranye,
  intensitas = |z|/3). Ringkas (40 baris) dan theme-aware — ide bagus untuk ramp yang mulus di dua tema.
- **Font:** IBM Plex Sans + Plex Mono (`next/font/google`). Skala teks sangat kecil (9–15 px) → padat.
- **Catatan desain:** `docs/design/claude-design-*.md`, `workbench-claude-design-prompt.md`, `design-contract.json` → UI dibuat lewat alur
  "Claude Design → prod". Artinya tampilannya cenderung mirip output AI lain; hindari meniru gaya.
- **Yang bisa diambil:** `ramp.ts` (ide OKLCH), pola `messages/en.json` + `vi.json` (struktur kunci), `calendar/pentad.ts` jika ingin resolusi sub-bulanan.
  Komponen React-nya terikat Next/next-intl/Tailwind sehingga tidak mudah dipindah ke Vite polos.

### A3. tttamannaanand/burn-calendar (MIT, "Copyright (c) 2026 tttamannaanand")

- **Framework:** **vanilla JS satu file** (`docs/app.js`, ~30 KB) + `docs/index.html` + `docs/style.css`, Leaflet 1.9.4 dari cdnjs, Google Fonts
  (Inter + Space Grotesk). Canvas 2D untuk kalender/klimatologi/time-series (base canvas + overlay canvas untuk hover).
- **Kalender:** `drawCal()` — tahun × 52 minggu, garis horizontal + pill label "MODIS, harmonized / VIIRS, measured" **tepat di tahun pergantian sensor**
  (anotasi langsung di grafik, bukan di legend; layak ditiru untuk 2012).
- **Warna:** `SC.light.heat = #fff4e4 → #fcd6a2 → #f6a05a → #e2572b → #a11f10 → #470e08` dengan gamma 0,45; dark dibalik
  (`#1a2029 → … → #fff1c6`); divergen z/3 dari `mid` ke biru `#2563eb`/oranye `#d9480f`. `zWord()` mengubah z menjadi kata
  ("Unusually high / Above normal / About normal ...") — pola teks yang bagus untuk bilingual.
- **AOI draw:** klik dua sudut → `L.rectangle` (tanpa plugin), preset per region, Esc membatalkan.
- **URL state:** `#california&aoi=w,s,e,n` via `history.replaceState`. **Tema:** `prefers-color-scheme` + override `data-theme` + localStorage.
  **Keyboard:** panah di kalender, Esc.
- **Yang bisa diambil:** `ramp()`/`diverge()`/`niceMax()`/`weekRange()` (utilitas murni ~20 baris), pola CSS token light/dark yang benar
  (`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {...} }` + `:root[data-theme="dark"]`).

### A4. squadronzero/project-shift (Apache-2.0, tanpa NOTICE; copyright line di LICENSE masih template)

- **Framework:** React 18.3 + Vite 5.4, **JSX tanpa TypeScript**, `maplibre-gl 5.24` (2D Mercator + 3D globe dalam satu peta), `topojson-client`,
  `world-atlas`, font `@fontsource-variable/archivo` (self-hosted, offline). Tanpa library chart: chart SVG/canvas tulisan sendiri.
- **Struktur yang rapi untuk tim campuran:** `web/UI_GUIDE.md` memisahkan file yang aman diedit desainer (`src/theme/tokens.css`, `src/content/text.js`,
  `src/content/places.js`, `src/styles/layout.css`) dari "ENGINE" (`src/lib/*`). **Pola ini sangat layak ditiru** untuk tim hackathon.
- **AreaPicker** (`src/components/AreaPicker.jsx` + `src/lib/area.js`): **5 mode** — preset, negara, kotak koordinat diketik (W/S/E/N),
  titik + radius km, kotak digambar di peta — paling cocok dengan kebutuhan Second Sight (preset/draw/lat-lon).
- **Kalender** (`src/components/Calendar.jsx`): tahun × hari-dalam-tahun; bin magnitudo dari kuantil hari non-nol area itu sendiri (40/65/82/93/98%);
  `MonthGrid.jsx` untuk tahun × bulan; garis pergantian sensor 2012-01-20.
- **Token warna** (`src/theme/tokens.css`) dengan **aturan ilmiah tertulis**: `--ramp-1..6` (`#FBE6D2 … #7E2A12`), kelas bulan
  `--class-low #4F7FB8 / normal #D4D8D6 / unusual #E58A55 / critical #A63A18`, `--chart-band` untuk 95% range, hatching no-data
  terpisah dari `--chart-zero`, `--recent-1..4` (deteksi NRT mentah) sengaja beda skema dari record terharmonisasi, `--cloud-mark`.
- **URL state:** `src/lib/url.js` (14 baris) — `#explore?area=preset:bangladesh&v=cells&from=...&m=2026-09` via `URLSearchParams` + `replaceState`.
- **Download:** `src/lib/downloads.js` — `dailyCSV`, `monthlyCSV`, `cellCSV`, `firmsLink` (link balik ke FIRMS untuk area/tanggal), `saveSVG`,
  `saveSVGasPNG`, `saveCanvasPNG` (judul + legend ditanam ke gambar). Ada juga "print or save a one-page brief" via CSS print.
- **i18n:** semua teks di `src/content/text.js` (EN). Mudah dijadikan `text.id.js`/`text.en.js`.
- **Perhatian lisensi data:** `web/public/geo/adm2/odbl/` = turunan geoBoundaries **ODbL 1.0 (share-alike)**; bukan Apache. Jangan disalin
  tanpa memenuhi ODbL. Untuk Indonesia lebih aman ambil batas administrasi sendiri (mis. geoBoundaries IDN langsung, dengan atribusi).

### A5. portolan-mirrors/firms-catalog (Apache-2.0, tanpa NOTICE)

- **Bukan app kalender** tetapi mirror GeoParquet FIRMS (631 juta baris, partisi `year=YYYY`, urut `(_month, _hilbert)`, row group 100k, zstd 15) di
  Source Cooperative + explorer peta statis.
- **Frontend** (`apps/firms-explorer/`): HTML + ES modules **tanpa build**, MapLibre 4.7.1 + `pmtiles 3.2.0` + `protomaps-themes-base 4.5.0`
  (sekarang **deprecated**, pindah ke `@protomaps/basemaps`) dari unpkg; basemap Protomaps PMTiles di source.coop; varian `deck.html` dengan deck.gl 9.4.
- **`timeline.js`** (46 KB, dengan `timeline.test.mjs`): komponen timeline adaptif (7 hari sampai 27 tahun) di canvas, **framework-agnostic** (tidak tahu
  MapLibre/fire), bucket key `YYYYMM`/`YYYYMMDD`, aritmetika tanggal tanpa `Date` (algoritma Hinnant, bebas bug zona waktu). `COUNT_RAMP` bertingkat
  (`#2c3d5a → #3f6d8f → #59a1a0 → #a8c268 → #f2b134 → #e8722c → #d1382a`, ambang 1/5/20/75/250/1000/4000).
- **Yang bisa diambil:** `timeline.js` (brush rentang waktu di bawah peta), `map-size.js`, pola PMTiles + Protomaps. Data GeoParquet-nya sendiri
  bisa jadi sumber query duckdb-wasm (cek lisensi data di `catalog/detections/README.md` sebelum dipakai; FIRMS sendiri data terbuka NASA).

### A6. Repo TANPA lisensi (hanya ide, re-implementasi dari nol, jangan salin kode/aset)

Tanpa LICENSE = "all rights reserved" secara default; membaca boleh, menyalin tidak.

| Repo | Status lisensi (dicek 13 Nov) | Stack UI | Ide yang boleh di-reimplementasi |
|---|---|---|---|
| Aalvee-Aarham/kiln-watch | Tidak ada LICENSE di root (hanya `web/src/lib/iso-kit.LICENSE` milik pihak ketiga) | React 19 + MapLibre 5.6 + three + **gsap + lenis** (scroll-jacking) | MODIS-denial test sebagai "story chart", globe outlook, halaman Warning dengan aturan tercetak |
| EdisonShiny/eg-firetrack | **Repo sekarang 404** (private/dihapus); sebelumnya tidak tercatat berlisensi | React/Vite (dari catatan batch2) | Playbook respons per yurisdiksi (BPBD/Manggala Agni), kedalaman gambut di skor risiko, perbandingan Jan–Sep antartahun yang adil |
| mdhabibullahmahmudncs13/Icarus-… | Tidak ada LICENSE di root (hanya lisensi skill di `.agents/`) | React 18 + d3-scale/d3-array + three; `web/src/components/CalendarHeatmap.tsx`, `RegionMap.tsx` | Mode offline/PWA dengan tes "no third party", provenance + hash parameter di UI, "critical period" (10–90% massa kumulatif) |

### A7. Tabel komponen yang bisa diadaptasi

| Repo | File / komponen | Fungsi | Lisensi | Cara pakai / atribusi |
|---|---|---|---|---|
| fire-harmony | `app/src/lib/stats.ts` → `countScale`, `countClass`, `classEdges`, `ratioLimit`, `ratioClass`, `RATIO_LIMITS` | Skala warna log adaptif per AOI + kelas anomali rasio-terhadap-normal (9 kelas) | Apache-2.0 | Salin fungsi (murni, tanpa dependensi). Pertahankan komentar, tambah header "Adapted from Warren-530/fire-harmony (Apache-2.0); modified by Second Sight team, 2026". Sertakan salinan Apache-2.0 di `THIRD_PARTY_LICENSES/` |
| fire-harmony | `app/src/components/Calendar.tsx` (bagian `onKey`, struktur `role=grid`, `describe()`) | Navigasi keyboard + ARIA kalender | Apache-2.0 | Adaptasi pola (bukan JSX utuh, terlalu terikat ke hook mereka). Atribusi sama |
| fire-harmony | `app/src/lib/db.ts` | Singleton duckdb-wasm + bundle Vite + ekstensi self-host + strategi buffer vs URL | Apache-2.0 | Salin hampir utuh; ganti `dataUrl`. Atribusi sama |
| fire-harmony | `app/src/lib/download.ts`, `components/explorer/exportImages.ts` | Save blob; PNG kalender/chart dari data dengan judul+sumber | Apache-2.0 | Salin `download.ts` (17 baris); `exportImages` sebagai referensi pola |
| fire-harmony | `app/DESIGN.md` §3–§4 | Aturan interaksi & chart | Apache-2.0 (teks) | Jadikan checklist internal; jangan salin tema warnanya |
| project-shift | `web/src/components/AreaPicker.jsx` + `web/src/lib/area.js` | AOI: preset/negara/kotak diketik/titik+radius/gambar | Apache-2.0 | Port ke TS; header "Adapted from squadronzero/project-shift (Apache-2.0); modified" + salinan lisensi |
| project-shift | `web/src/lib/url.js` | Hash state + `URLSearchParams` | Apache-2.0 | Salin utuh (14 baris) + atribusi |
| project-shift | `web/src/lib/downloads.js` | CSV harian/bulanan/sel, `firmsLink`, SVG/PNG export dengan legend | Apache-2.0 | Adaptasi; atribusi |
| project-shift | `web/UI_GUIDE.md` + pemisahan `theme/ content/ lib/` | Struktur repo ramah desainer | Apache-2.0 | Tiru struktur folder (struktur bukan ekspresi yang dilindungi, tapi tetap sebut sebagai inspirasi) |
| project-shift | `web/src/theme/tokens.css` (komentar aturan) | Aturan warna ilmiah (ramp monoton, no-data ≠ zero, NRT beda skema) | Apache-2.0 | Ambil **aturannya**, pilih hex sendiri |
| burn-calendar | `docs/app.js` → `ramp`, `diverge`, `niceMax`, `zWord`, `weekRange` | Interpolasi warna, angka "rapi", z → kata | MIT | Salin + sertakan "Copyright (c) 2026 tttamannaanand" + teks izin MIT di header file atau `THIRD_PARTY_LICENSES` |
| burn-calendar | `drawCal()` (anotasi pill di garis pergantian sensor) | Anotasi langsung di heatmap | MIT | Re-implementasi ringan; atribusi MIT bila menyalin kode |
| flare-chronos | `apps/workbench/src/lib/calendar/ramp.ts` | Ramp OKLCH sekuensial & divergen, theme-aware | MIT | Salin + "Copyright (c) 2026 Xiro The Dev" + teks MIT |
| firms-catalog | `apps/firms-explorer/timeline.js` (+ test) | Timeline/brush adaptif framework-agnostic | Apache-2.0 | Salin sebagai modul; atribusi "portolan-mirrors/firms-catalog (Apache-2.0)" |
| firms-catalog | pola `index.html` MapLibre + PMTiles + Protomaps | Basemap vektor tanpa server tile | Apache-2.0 (kode); basemap © OpenStreetMap (ODbL) + Protomaps | Pakai `@protomaps/basemaps` (bukan paket deprecated). Atribusi OSM wajib tampil di peta |

**Template atribusi minimal**
- `THIRD_PARTY_LICENSES/` berisi `fire-harmony-LICENSE` (Apache-2.0), `project-shift-LICENSE`, `firms-catalog-LICENSE`, `burn-calendar-LICENSE` (MIT), `flare-chronos-LICENSE` (MIT).
- Header file yang diadaptasi dari Apache-2.0: `// Adapted from <repo>/<path> (Apache License 2.0). Changes: <ringkas>. Modified by Second Sight, Nov 2026.` (Apache §4(b) mewajibkan pemberitahuan perubahan.)
- Tidak ada NOTICE di ketiga repo Apache → tidak ada teks NOTICE yang wajib diteruskan (dicek via `git ls-tree`).
- README bagian "Credits / third-party code" menyebut kelima repo. **Risiko kompetisi:** ini repo pesaing di challenge yang sama; atribusi
  terbuka mencegah tuduhan plagiarisme, tetapi juri bisa melihat kemiripan. Ambil utilitas & pola, bukan halaman/tema utuh.

---

## B) Building blocks yang direkomendasikan

Versi = `latest` di registry.npmjs.org per 13 Nov 2026 (dicek langsung).

| Lib | Versi | Lisensi | Kegunaan | Catatan |
|---|---|---|---|---|
| **maplibre-gl** | 6.18.0 (rilis 11 Nov 2026; `latest-5` = 5.24.1) | BSD-3-Clause | Peta | 6.18 baru 2 hari; untuk demo lebih aman pin **6.17.x** (yang dipakai fire-harmony) atau 5.24.1 |
| **pmtiles** | 4.5.0 | BSD-3-Clause | Basemap/overlay tanpa tile server | |
| **@protomaps/basemaps** | 5.7.2 | BSD-3-Clause | Style basemap (pengganti `protomaps-themes-base` yang deprecated) | Atribusi © OpenStreetMap |
| **terra-draw** + **terra-draw-maplibre-gl-adapter** | 1.39.0 + 1.5.0 | MIT | Gambar rectangle/polygon AOI | Pilihan modern; `@watergis/maplibre-gl-terradraw` 1.17.0 (MIT) bila mau tombol kontrol siap pakai |
| (alternatif) `@mapbox/mapbox-gl-draw` | 1.5.2 (Sep 2026) | ISC | Draw klasik, jalan di MapLibre dengan patch CSS kelas | `maplibre-gl-draw` 1.6.9 terakhir rilis 2023 → hindari |
| **@observablehq/plot** | 0.6.19 | ISC | Chart lab (line, band, cell, tip, crosshair) | Ringan, ekspor SVG mudah; dipakai fire-harmony |
| d3-scale / d3-scale-chromatic / d3-format / d3-array | 4.0.3 / 3.1.1 / 3.1.3 / 3.2.5 | ISC | Skala, palet (`interpolateYlOrRd`, `interpolateRdBu`, `schemeRdBu[9]`), format angka | Plot sudah membawa sebagian |
| echarts (alternatif Plot) | 6.1.0 | Apache-2.0 | Calendar/heatmap + toolbox saveAsImage + aria decal | Lebih berat (~60 MB unpacked); pilih **salah satu** Plot atau ECharts |
| cal-heatmap | 4.2.4 (rilis terakhir Des 2023) | MIT | Heatmap gaya GitHub harian | **Tidak disarankan**: pola hari×minggu, stale, bukan tahun×bulan |
| @nivo/heatmap / @visx/heatmap | 0.99.0 / 4.0.0 | MIT | Heatmap React | Overkill; kalender 26×12 lebih baik SVG custom (~150 baris) seperti semua pesaing |
| **hyparquet** | 1.33.0 | MIT | Baca Parquet di browser tanpa WASM (~300 KB) | Cukup untuk agregat preset; jauh lebih ringan dari duckdb-wasm |
| @duckdb/duckdb-wasm | 1.33.1-dev57.0 (tag `latest` masih "dev") | MIT | SQL atas Parquet remote (AOI custom) | Bundle besar (paket 149 MB unpacked; wasm puluhan MB) → lazy-load hanya di "lab" **[UNVERIFIED ukuran gzip]** |
| apache-arrow | 21.2.0 | Apache-2.0 | Hasil query duckdb | Hanya bila pakai duckdb-wasm |
| h3-js | 4.5.0 | Apache-2.0 | Grid heksagon (jika dipakai) | |
| @deck.gl/core + @deck.gl/mapbox | 9.4.1 | MIT | Layer GPU di atas MapLibre | Perlu hanya jika titik/heksagon > ~50 ribu |
| **i18next** (+ `i18next-browser-languagedetector`) | 27.1.1 (+ 8.3.0) | MIT | ID/EN | Alternatif lebih kecil: kamus bertipe + `Intl` seperti fire-harmony. Untuk 2 bahasa, kamus TS sudah cukup |
| papaparse | 5.7.1 | MIT | Tulis/baca CSV | Atau `Array.join` sendiri (CSV kita sederhana) |
| @turf/area, @turf/boolean-point-in-polygon | 7.4.0 | MIT | Luas AOI (km²), filter titik | Modular, kecil |
| tinykeys | 4.0.1 | MIT | Shortcut keyboard | |
| colorbrewer | 1.7.0 | Apache-2.0 | Palet ColorBrewer mentah | `d3-scale-chromatic` sudah memuat ColorBrewer |
| cmocean (palet) | Python; lisensi MIT (Copyright 2015 Kristen M. Thyng, dicek) | MIT | `thermal`, `matter`, `balance` | Tidak ada paket npm resmi; salin array hex 256-stop |
| Crameri Scientific Colour Maps (`lajolla`, `batlow`, `vik`, `roma`) | v8.0.1 (Zenodo 10.5281/zenodo.1243862) | MIT menurut paket turunan **[UNVERIFIED di Zenodo]** | Palet perseptual-seragam, aman CVD | Sitasi Crameri 2023 di halaman Methods |
| Font: Plus Jakarta Sans / Source Sans 3 / Public Sans / Atkinson Hyperlegible Next | fontsource 5.3.x | OFL-1.1 | Tipografi | Lihat C3. Self-host via `@fontsource-variable/*` |
| @nasa-hds/core | 0.10.0 | CC0-1.0 (sebagian OFL/Apache) | Referensi token NASA Horizon | **Jangan dipakai sebagai tema**: README menyatakan hanya untuk situs NASA-branded `*.nasa.gov`; non-NASA → USWDS |
| @uswds/uswds | 3.14.0 | CC0 (modifikasi GSA) + OFL/Apache untuk font/ikon | Komponen form/tabel aksesibel, vernakular "pemerintah" | Ambil secukupnya (tabel, form) atau hanya tokennya |

**Set minimal yang disarankan (Vite + TS, tanpa React pun bisa):**
1. `maplibre-gl@6.17.x` + `pmtiles@4.5.0` + `@protomaps/basemaps@5.7.2`
2. `terra-draw@1.39.0` + `terra-draw-maplibre-gl-adapter@1.5.0` (AOI rectangle/polygon) + input lat/lon/radius ala project-shift
3. Kalender: **SVG custom** (pola fire-harmony: grid ARIA + skala adaptif) + `d3-scale-chromatic`/palet Crameri
4. `@observablehq/plot@0.6.19` untuk lab chart & "bulan ini vs median vs El Niño"
5. `hyparquet@1.33.0` untuk agregat; `@duckdb/duckdb-wasm` hanya lazy untuk AOI custom (atau precompute grid sel lalu jumlahkan di klien)
6. Kamus i18n bertipe + `Intl.NumberFormat('id-ID'|'en-GB')` (i18next hanya jika butuh pluralisasi/namespace)
7. `@turf/area`, `tinykeys`; deck.gl opsional

---

## C) Referensi desain & aturan konkret

### C1. Status lisensi referensi (dicek)

| Referensi | Kode/desain terbuka? | Bisa dipakai? |
|---|---|---|
| **Our World in Data Grapher** (owid/owid-grapher) | **Lisensi berubah 2026**: `LICENSE.md` kini "view and study only", dilarang copy/modify/use tanpa izin GCDL. Versi lama MIT tetap MIT untuk commit sebelum perubahan (commit acuan `a139fcf…`) | **Jangan salin kode Grapher versi sekarang.** Ide/konvensi desain boleh diamati. Data OWID tetap CC BY (terpisah dari kode) |
| **NASA Horizon Design System** (`nasa/hds-core`, npm `@nasa-hds/core` 0.10.0) | CC0 untuk bagian GSA/NASA; font OFL; tema di atas USWDS 3.14+ | Secara hukum boleh, tetapi **ditujukan hanya untuk situs NASA-branded**. Space Apps melarang kesan endorsement NASA → pakai sebagai **referensi aturan dataviz**, bukan tema. Aturan HDS: Inter (heading/UI), Public Sans (body), DM Mono (data); target kontras AAA 7:1 teks; grid 8 px; "takeaway title"; label kedua sumbu; legend di bawah (desktop) / atas (mobile); ≤4–5 garis per line chart; kategorikal beda hue **dan** lightness |
| **USWDS** | CC0 (+ OFL/Apache untuk aset pihak ketiga) | Ya. Netral, aksesibel, tetapi terlihat "situs pemerintah AS" bila dipakai mentah |
| **Global Forest Watch** (wri/gfw) | MIT, "Copyright (c) 2023-2025 Vizzuality" | Ya (Next.js/Mapbox; berat). Referensi pola layer-panel + widget analisis area. "Global Nature Watch": status kode tidak ditemukan **[UNVERIFIED]** |
| **Copernicus Climate Pulse** (ECMWF/C3S) | Tidak ditemukan repo publik; data ERA5 berlisensi Copernicus | Hanya referensi visual: line harian per tahun, tahun berjalan ditebalkan, rekor ditandai **[UNVERIFIED detail]** |
| **Climate Reanalyzer** (UMaine) | Bukan open source **[UNVERIFIED]** | Referensi pola "spaghetti" semua tahun abu-abu tipis + tahun ini tebal + rata-rata klimatologi putus-putus → sangat cocok untuk "bulan ini vs median & El Niño" |
| **GWIS/EFFIS** (JRC) | Aplikasi tidak open source; laporan PDF "seasonal trend": minggu kumulatif, band min–max (2012–2023), garis rata-rata, garis tahun berjalan (dicek dari judul legend PDF) | Pola band historis + tahun berjalan → tiru untuk panel "musim ini" |
| Windy, NYT, Reuters, Berkeley Earth, ECMWF OpenCharts | Proprietary (desain) | Referensi konvensi saja |

### C2. Pola yang paling relevan untuk Second Sight
1. **Kalender tahun × bulan** (heatmap) sebagai hero, bukan KPI tile. Tahun pergantian sensor (Jan 2012) ditandai garis + label langsung di grid (burn-calendar).
2. **"Bulan ini vs normal"**: line/dot-strip per bulan kalender — semua tahun abu-abu, median tebal, band p10–p90, tahun El Niño
   (1997 di luar rentang; 2002, 2004, 2006, 2009, 2015, 2019*, 2023) diwarnai satu warna dengan label langsung, tahun berjalan aksen
   (pola Climate Reanalyzer + GWIS). *2019 secara ONI adalah El Niño lemah; tandai sesuai definisi yang dipakai (ONI/NOAA).*
3. **Kalimat vonis** di atas chart, satu kosakata konsisten: "Oktober 2026: 3,1× median 2001–2025 — tertinggi ke-4 sejak 2001" (judul = temuan).
4. **Validasi** sebagai panel sendiri dengan angka yang diberi konteks ("pada tahun yang tidak dipakai kalibrasi").

### C3. Aturan desain konkret
**Tipografi**
- Maksimal 2 keluarga. Usulan yang berakar pada subjek: **Plus Jakarta Sans** (Tokotype, Indonesia, OFL) untuk judul + **Source Sans 3** atau
  **Public Sans** untuk body/UI; angka pakai `font-variant-numeric: tabular-nums lining-nums` dari font body (**bukan** monospace terpisah).
  Hindari Inter-untuk-semua, Space Grotesk, IBM Plex (dipakai flare-chronos), JetBrains Mono (fire-harmony).
- Skala tipe tegas (mis. 13/15/18/24/32), body 15–16 px, panjang baris ≤ 75 karakter, sentence case (tanpa ALL-CAPS eyebrow).

**Format angka (bilingual)**
- ID: `Intl.NumberFormat('id-ID')` → `12.345`, `3,1×`, `1,2 juta`; EN: `en-GB` → `12,345`, `3.1×`, `1.2 million`. Jangan campur.
- Rasio "×", persen dengan 0–1 desimal, tanggal "Okt 2026"/"Oct 2026", tidak pernah `2026-10` di UI (boleh di URL/CSV).
- Bulatkan untuk manusia (2–3 angka signifikan) di teks; nilai eksak di tooltip/tabel/CSV.
- Satuan selalu tertulis: "hotspot terharmonisasi (skala VIIRS S-NPP 375 m)" atau sejenis, sekali di subjudul.

**Warna**
- Satu palet sekuensial untuk "jumlah" (log, adaptif per AOI) dan satu divergen untuk "vs normal" (log2 rasio, pusat netral = normal).
  Kandidat: Crameri `lajolla` (sekuensial api) / `vik` atau ColorBrewer `RdBu` (divergen); cmocean `thermal`/`balance`.
- "No data" = hatching; "nol api" = warna netral; "dimodelkan/terisi" = pola lain. Tiga hal ini tidak boleh berbagi warna.
- NRT mentah vs record terharmonisasi beda skema (aturan project-shift).
- Satu warna aksen UI yang **tidak** sama dengan warna data api (supaya tombol tidak dibaca sebagai data). Hindari oranye/ember sebagai aksen UI.
- Uji CVD (deuteranopia) dan kontras ≥ 4,5:1 (teks kecil), dua tema.

**Anotasi**
- Label langsung pada garis/tahun penting (El Niño, 2015, 2019, 2023) alih-alih legend jauh.
- Garis/teks anotasi tipis, warna teks sekunder, posisi tidak menutupi data; sumber + metode di footer setiap figur ("Sumber: NASA FIRMS MODIS C6.1 + VIIRS 375 m; harmonisasi Second Sight").
- Tooltip berisi kalimat lengkap (bulan, nilai, rasio vs median, peringkat), bisa dibuka lewat keyboard.

**Densitas & layout**
- Desktop: peta + panel AOI di kiri/atas, kalender lebar penuh, lab di bawah; satu layar harus menjawab "bagaimana bulan ini dibanding biasanya?".
- Gutter 16 px di mobile, tidak ada scroll horizontal kecuali di dalam kalender (dengan fade).
- Tabel data (table view) tersedia untuk setiap chart; tombol unduh CSV/PNG di dekat figur, bukan di menu tersembunyi.
- Kartu hanya bila konten memang terpisah; variasikan hierarki (tidak semua blok jadi kartu radius sama + bayangan sama).

---

## D) Checklist anti AI-slop

**Sumber:** skill resmi Anthropic `frontend-design` (raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md, dibaca langsung);
README `pbakaus/impeccable` (Apache-2.0, detektor 62 aturan, berangkat dari skill Anthropic); artikel dev.to "Why Every AI-Built Website Looks the Same
(Blame Tailwind's Indigo-500)" (Adam Wathan soal `bg-indigo-500`, Agustus 2025); kompilasi blog lain (noqta.tn, superdesign.dev, 925studios,
world.hey.com/kostac, forum Cursor) yang hanya terlihat via hasil pencarian **[UNVERIFIED isi lengkap]**.

### D1. Ciri yang paling sering disebut
- Inter/Roboto/system untuk semua teks; Space Grotesk sebagai "alternatif" yang kini juga klise.
- Gradien indigo→ungu, teks bergradien, glow/aurora di background, glassmorphism di semua panel.
- "SaaS card kit": konten dipotong jadi kartu identik, radius sama di semua elemen, bayangan abu-abu lembut yang sama, kartu di dalam kartu.
- Hero "angka besar + label kecil + aksen gradien" (KPI tile row) sebagai pembuka default.
- Kluster yang disebut eksplisit oleh skill Anthropic: (1) background krem ~#F4F1EA + serif display + aksen terakota ~#D97757;
  (2) **near-black + satu aksen terang vermilion/acid-green**; (3) layout koran hairline tanpa radius; (4) SaaS card kit;
  (5) template chrome: eyebrow ALL-CAPS di atas setiap heading, meta "A · B · C", label "WORD — fragmen", near-black #0B0B0B/#111 alih-alih hitam,
  **monospace untuk label data kecil**, panah "→" di teks tombol/link.
- Satu kata di-highlight warna/italic dalam headline; label tipografis tak perlu di atas konten; penomoran 01/02/03 untuk konten yang bukan urutan.
- Animasi fade-and-slide-up di setiap section, hover-lift di setiap kartu; ikon dalam kotak rounded di atas setiap heading; emoji sebagai ikon.
- Copy generik ("Unlock insights", "Powered by AI", "real-time" padahal bukan).
- **Khusus dashboard:** pie/donut, dual axis, legend jauh dari data, rainbow/jet colormap, angka tanpa satuan/konteks, chart dekoratif tanpa takeaway.

**Catatan pesaing:** fire-harmony (near-black `#07090d` + ember `#ff7a3d` + glow + glass + Inter/JetBrains Mono) dan flare-chronos (near-black `#070b14` +
Plex Mono + desain via "Claude Design") memenuhi kluster (2) dan (5). Second Sight bisa membedakan diri dengan **tidak** dark-first-glow.

### D2. Aturan konkret untuk Second Sight
- [ ] Tulis design plan dulu (4–6 hex bernama, 2 font + perannya, wireframe ASCII), lalu tanyakan "apakah ini default yang akan muncul untuk brief serupa?"; revisi bagian yang generik (proses dari skill Anthropic).
- [ ] Hero = **kalender kebakaran** sungguhan untuk AOI default (mis. KHG Kalimantan Tengah), bukan KPI tiles atau globe berputar.
- [ ] Font bukan Inter/Plex/Space Grotesk/JetBrains Mono; angka tabular dari font body; tanpa ALL-CAPS eyebrow; tanpa "→" di tombol.
- [ ] Tanpa gradien dekoratif, glow, glass, noise. Background netral solid; light-first (dark tersedia, bukan default) agar beda dari pesaing.
- [ ] Warna aksen UI ≠ warna data; tidak ada ungu/indigo; ember hanya untuk data api.
- [ ] Radius dan bayangan bervariasi menurut hierarki (panel peta ≠ chip ≠ dialog); tidak ada kartu di dalam kartu.
- [ ] Setiap chart: judul = temuan, subjudul = satuan, sumber di bawah, label langsung, table view + unduh CSV/PNG.
- [ ] Motion hanya untuk menjelaskan perubahan (bulan berganti, peta terbang ke AOI); hormati `prefers-reduced-motion`.
- [ ] Ikon satu set (outline), tanpa emoji; ikon tidak ditempel di atas setiap heading.
- [ ] Copy konkret, bilingual sejajar, berbunyi seperti BMKG/BRGM/KLHK (operasional), bukan pitch startup: "Oktober 2026 3,1× median; tertinggi sejak 2019".
- [ ] Vernakular lokal sebagai sumber identitas visual: istilah KHG, BRGM, Manggala Agni, ONI/El Niño; peta dengan batas provinsi/kabupaten Indonesia
      dan label Bahasa Indonesia; foto/ilustrasi tidak diperlukan.
- [ ] Jalankan detektor otomatis (mis. `impeccable` atau checklist ini) sebelum freeze; ambil screenshot dua tema + mobile dan kritik sendiri
      ("lepaskan satu aksesori").
- [ ] Jangan pakai logo NASA/meatball (aturan Space Apps; juga ditulis di UI_GUIDE project-shift).

---

## Sumber
- Repo dibaca langsung: github.com/Warren-530/fire-harmony, github.com/the-aris-club/flare-chronos, github.com/tttamannaanand/burn-calendar,
  github.com/squadronzero/project-shift, github.com/portolan-mirrors/firms-catalog, github.com/Aalvee-Aarham/kiln-watch,
  github.com/mdhabibullahmahmudncs13/Icarus-Harmonization-of-MODIS-and-VIIRS-Hot-Spots; github.com/EdisonShiny/eg-firetrack (404 per 13 Nov).
- Lisensi: raw.githubusercontent.com/owid/owid-grapher/master/LICENSE.md; raw.githubusercontent.com/uswds/uswds/develop/LICENSE.md;
  raw.githubusercontent.com/nasa/hds-core/main/{README.md,LICENSE.md}; nasa.github.io/hds-core/llms.txt (+ foundations-data-visualization.md, foundations-typography.md);
  raw.githubusercontent.com/wri/gfw/develop/LICENSE; raw.githubusercontent.com/matplotlib/cmocean/main/LICENSE.txt; raw.githubusercontent.com/tokotype/PlusJakartaSans/master/OFL.txt.
- Versi: registry.npmjs.org (`/<pkg>/latest`, 13 Nov 2026).
- Anti-slop: github.com/anthropics/skills (skills/frontend-design/SKILL.md); github.com/pbakaus/impeccable; dev.to/alanwest/why-every-ai-built-website-looks-the-same-blame-tailwinds-indigo-500-3h2p;
  noqta.tn/blog/ai-design-slop-overused-ui-patterns-fix-2026; superdesign.dev/blog/why-ai-design-looks-generic; www.925studios.co/blog/ai-slop-design-tells; world.hey.com/kostac/spot-the-slop-a-ui-designer-s-guide-to-fixing-ai-defaults-4c448c9c.
- GWIS: gwis.jrc.ec.europa.eu/applications; api2.effis.emergency.copernicus.eu/api/gwis/seasonaltrend/pdf/UN_EUR/2024/CO2. Climate Pulse: climate.copernicus.eu (berita C3S).
- Crameri: zenodo.org/record/1243862; pypi.org/project/cmcrameri.
