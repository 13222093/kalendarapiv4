# 13 · Audit Produk Second Sight terhadap Pola Pemenang 2025

> **Waktu audit:** Sabtu 14 Nov 2026, 09:27-09:50 WIB (H1 hackathon). Basis: `origin/main` `a299fb0`, lalu di-merge ulang ke `40550a2` pada 09:33 (menambah `docs/validation_report.md`, `docs/physics_results.md`, `pipeline/run/`, `pipeline/physics/run.py`, `pipeline/decision/run.py`).
> **Sifat:** read-only. Tidak ada kode yang diubah. Semua angka di §5 adalah **PRELIMINARY**: dihitung dari `bundle/monthly_IDN.json` dan `derived/validation_results.json` yang ada pagi ini, belum melewati SUB-07 (QA angka) dan belum boleh dipakai di project page sebelum dihitung ulang oleh pipeline.
> **Sumber bukti:** kode di `pipeline/`, `api/brief/`, `app/src/`; output nyata di `D:/Lomba/Hackathon/nasa/second-sight-data/` (`derived/validation_results.json`, `derived/physics/physics_summary.json`, `derived/physics/decision_summary.json`, `bundle/index.json`, `bundle/monthly_IDN.json`).

> **KOREKSI PENTING (09:42, setelah merge `a43d88f`):** kandidat **F1 di versi awal audit ini SALAH dan ditarik**. Saya membandingkan S-NPP 2023 dengan Aqua 2015, padahal penyambungan naif memakai S-NPP untuk kedua tahun itu (keduanya setelah 2012). Hitungan resmi `pipeline/run/finding.py` (`docs/finding.md:8-12`) memberi 2023/2015 = 0,31× mentah dan 0,33× adil: **tidak ada pembalikan**. Temuan yang benar dan sekarang dihitung resmi adalah **F2 (pembalikan arah tren)**, lihat §5. Tim sudah menangkap kesalahan ini sendiri; ini bukti proses QA angka bekerja. Juga baru: **VAL-09 jalan, H1 gambut DITOLAK** (`docs/peat_results.md:79-91`), lihat §8.

---

## 1. Ringkasan eksekutif

**Posisi hari ini.** Mesin sainsnya sudah nyata dan jujur: 6,36 juta deteksi 2000-2025 diolah menjadi fire cell-days, κ VIIRS→Aqua dikalibrasi per 30 strata dengan EB shrinkage dan bootstrap 1000×, validasi pra-registrasi dijalankan dan **kegagalannya dilaporkan** (LORO dan sunset gagal, seam 2022-01 gagal). Ini modal terkuat kita. Tapi produk yang dilihat juri **belum ada**: frontend masih memakai data sintetis (`app/public/data/demo_monthly.json`, `app/src/i18n.ts:20` "Kalender memakai data contoh sintetis"), belum ada demo publik, project page, video, atau satu temuan yang dirumuskan.

**Empat jalur menang 2025 vs kita:**

| Jalur | Contoh 2025 | Kecocokan kita | Catatan |
|---|---|---|---|
| (a) Temuan ilmiah spesifik dari data nyata | SpaceGenes+ (Best Use of Science) | **Tinggi, belum dirumuskan** | Data dan validasi sudah cukup untuk satu temuan (lihat §5). Tinggal dipilih, dihitung resmi, dan dijadikan kalimat pertama |
| (b) Metode baru + bukti fisik | Resonant Exoplanets (Best Use of Data) | Sedang | Drift orbit Terra/Aqua terukur (±37-42 menit), tapi parameter diurnal masih `[UNVERIFIED] placeholder` (`physics_summary.json:783-788`) dan V4 belum jalan |
| (c) Produk dalam alur kerja harian | SkySense (Best Use of Technology) | Rendah | Kita tidak punya pengguna yang terintegrasi; "Wanareksa/Terra Harmonia" sudah lebih jauh (WhatsApp, PDF untuk Manggala Agni) |
| (d) Masalah lokal + aksi nyata | QUEÑARIS (Local Impact) | Rendah-sedang | Belum ada praktisi, belum ada keputusan nyata yang terdokumentasi (SUB-01 ⬜) |

**Jalur yang sebenarnya sedang kita jalani:** secara kode, jalur (a)+(b); secara framing dokumen, kita masih di jalur "platform". PRD (`docs/08` §7.1 baris 918-925) menjanjikan 8 layar, 4 persona, brief PDF/WhatsApp, kartu kabupaten, prioritas KHG, kalender kesiagaan, operator Sofiev, uji transfer. README (`README.md:3,17`) dibuka dengan tagline produk dan daftar pengguna (BPBD, KHG/BRGM, Manggala Agni), bukan dengan pertanyaan ilmiah.

**Risiko terbesar "comprehensive platform":** dengan 42 tiket tersisa (tracker `docs/11` baris 22), tim akan tergoda menutup FE-10..FE-21, AI-06, EXT-01/02 sehingga hasilnya terlihat seperti 100+ nominee Meteor Madness/Healthy Cities: banyak modul standar, tanpa satu angka yang diingat. Fitur yang sama (grid bersama, kalibrasi overlap, cell-days, pita ketidakpastian, toggle raw vs harmonised, kalender) sudah dimiliki hampir semua pesaing 2026 (§4). Yang belum dimiliki pesaing mana pun adalah **satu temuan tentang Indonesia yang dapat diverifikasi dan dibalik oleh harmonisasi** (§5).

**Rekomendasi satu kalimat (diperbarui 09:42):** target **Best Use of Science** dengan satu temuan "penyambungan MODIS→VIIRS membuat aktivitas api Indonesia tampak naik ~98% (2003-07 → 2019-23); di skala setara Aqua justru turun ~63%, dan tren adil negatif di keenam wilayah" (`docs/trend_results.md:23-45`, `docs/finding.md:14-19`, preliminary, §5 F2). F1 lama (2023 vs 2015) ditarik. Fallback pertama **Best Use of Data** (drift orbit terukur + seam 2012 yang hilang setelah harmonisasi); fallback **Local Impact** hanya jika tim bisa mendapatkan satu bukti praktisi (BPBD/Manggala Agni) sebelum submit, karena itulah syaratnya dan saat ini nihil. Turunkan prioritas semua fitur operasional yang tidak menjawab pertanyaan itu.

---

## 2. Inventaris produk saat ini (diverifikasi)

Legenda: **Jalan** = ada kode dan ada output nyata di `second-sight-data`. **Kode saja** = kode + tes, belum ada output nyata. **Stub/demo** = berjalan dengan data sintetis atau parameter placeholder. **Hilang** = belum ada.

| Lapis | Jalan (bukti) | Kode saja / stub | Hilang |
|---|---|---|---|
| **Data** (`pipeline/data`) | Ingest SP 2000-2025 MODIS, S-NPP, NOAA-20 (`raw/source=*/year=*/part.parquet`), NRT 2026 (`derived/nrt_report.json`), clean + static mask (`derived/clean_report.json`, `static_mask_report.json`), cells, aggregate, grid 0,05° per tahun (`bundle/index.json:216-392`, 9,2 MB total) | NOAA-21 hanya di NRT (`pipeline/data/nrt.py`) | Label gambut belum di-join ke `monthly_stratum` (`validation_results.json:10-15`: `peat_values ["unknown"]`, `peat_joined false`) walau `support/peat/gfw_indonesia_peat_lands.geojson` sudah ada. Label provinsi/KHG belum dipakai di strata. CMG awan (DAT-10) 🟡 |
| **Science** (`pipeline/science`) | κ M3 30 strata, semua 0<κ<1, pooled 0,193 (`validation_results.json:176-185`); chain Terra→Aqua 2,58, NOAA20→SNPP 0,971 (`:186-205`); ablation M0-M3x (`:22-72`); ENSO (6 tahun El Niño, `:207-215`); seri H dengan H_lo/H_hi | `dynamic.py` (κ dinamis U1), `peat.py` (V9) siap tapi tidak bisa jalan | Strata efektif hanya region × musim × siang/malam; dimensi gambut = "unknown" untuk semua baris. Interval H_lo=H_hi di 2003-2021 karena H = Aqua native (lihat §8) |
| **Physics** (`pipeline/physics`) | Overpass LST per satelit per tahun: Terra D −38,1 mnt, Aqua D +37,2 mnt (2023-2025 vs awal) (`physics_summary.json:7-207`); F\* sensitivitas D 7,67 / N 5,11 MW (`:212-221`), tetapi **F\* pra-registrasi tidak ada** (rasio R(F) mendatar di 2,7/3,1, tidak pernah mendekati 1; `docs/physics_results.md:35-46`); triangulasi A/B/C: porsi "A" turun dari 94% (2012-2021) ke 82% (2022+) nasional (`docs/physics_results.md:55-66`) | Drift R_pred memakai parameter diurnal placeholder `[UNVERIFIED]` (`physics_summary.json:782-805`, `pipeline/physics/diurnal.py:54-58`); `phy01_f_star` D/N = null (`:208-211`); observability (`observability.py`) tanpa output | Operator Sofiev (PHY-04/05 ⬜). V4/V13/V14/V16 `not_run` (`validation_results.json:972-1041`) |
| **Decision** (`pipeline/decision`, runner baru `pipeline/decision/run.py`) | `decision_summary.json` berisi kelas ENSO dan P(H > p90 \| ENSO) Sep/Okt per AOI; backtest LOYO (DEC-03) sudah jalan: **hit rate gabungan 0,39, false-alarm ratio 0,53**, Sumatra 0 hit dari 3 kejadian (`docs/physics_results.md:92-106`) | `priority.py` (DEC-01) **tidak jalan**: `build_series` tidak mengeluarkan replikat bootstrap (`docs/physics_results.md:108-110`) | V11 di `validation_results.json` masih `not_run`. Belum ada pengguna yang memvalidasi keputusan. Kalender kesiagaan saat ini **lebih lemah dari yang layak ditampilkan** sebagai fitur |
| **Export** (`pipeline/export`) | Bundle nyata: 6 AOI (IDN + 5 region), 302 bulan, ~76 KB/AOI (`bundle/index.json:142-215`) | `csv_export.py` | `obs_class` dan `agreement` masih kosong (`bundle/index.json:138-141`, "not_yet_filled"). Bundle berhenti di **2025-12**: musim 2026 (alasan "why now") belum masuk walau NRT 2026 sudah diunduh |
| **Brief** (`api/brief`) | Rules → fact table → LLM dengan placeholder → verifier digit (`api/brief/llm.py:1-8, 91, 127`); 41 tes lulus; eval 0 angka tak terlacak (tracker) | PDF butuh GTK, fallback HTML→print | Belum dijalankan dengan bundle nyata; tidak menjawab pertanyaan ilmiah (lihat §6 CUT) |
| **Frontend** (`app/src`) | Vite + TS, peta, kalender, i18n ID/EN, URL state. **Update 09:40:** `data.ts:105-124` kini memuat `index.json` + bundle nyata (`synthetic: false`); layar baru `beforeafter.ts` (FND-03), `yakin.ts`, `unduh.ts`, `bulan.ts`, `aoipanel.ts` | Versi 09:27 masih sintetis (`demo_monthly.json`, `i18n.ts:56`); setelah merge, demo tetap ada sebagai fallback. Build pasca-merge belum saya uji | FE-06 (data nyata) ⛔ menunggu bundle, padahal bundle sudah ada pagi ini. Belum ada deploy publik. Layar temuan/"before vs after" belum ada |
| **Docs** | `methodology.md`, `validation_plan.md` (pra-registrasi SET-05 di-commit sebelum hasil), `limitations.md`, `ai_acknowledgement.md`, `credits.md`; **baru (merge 09:33)**: `validation_report.md` (94 entri: 15 pass, 11 fail, 55 deskriptif, 4 N/A, 9 not run), `physics_results.md` | README dan limitations masih kerangka (`README.md:11-13` link pending, `:54` "Commands are placeholders") | `test_report.md` belum ada. Figur EXP-05 (`figures/national_raw_vs_harmonized`, `seam_plot`) ada di data dir tapi tidak di-commit. Project page, video, slide, tag release belum ada |

Catatan verifikasi: `cd app && npm install && npm run build` **berhasil** pada 09:32 WIB (Vite, 8 s; JS utama 1,18 MB / 328 KB gzip, worker MapLibre 518 KB). Tampilan tidak direview visual (1366×850 dan 375×812 belum dicek) karena batas waktu. Status data frontend disimpulkan dari source: `app/src/data.ts:43` hanya memuat `data/${name}.json` dari `public/data/`, satu-satunya file di sana `demo_monthly.json`; headline layar utama masih *"Dalam data contoh ini, {tahun} adalah tahun terparah di {aoi}"* (`app/src/i18n.ts:56`). Headline itu sendiri adalah pola "kalender" yang dimiliki semua pesaing; setelah FE-06, ganti dengan kalimat temuan F1.

---

## 3. Audit terhadap insight benchmark

| # | Insight | Status kita | Bukti | Gap | Rekomendasi | Effort | Dampak award |
|---|---|---|---|---|---|---|---|
| 1 | Juri hanya membaca page + video ≤30 s/≤7 slide + repo, tanpa pitch | ⬜ Belum ada page/video/slide | `README.md:11-13` link pending; SUB-04/05/06 ⬜ | Seluruh nilai kita saat ini tidak terlihat juri | Page ditulis **sebelum** fitur tambahan; draft pertama H1 sore (SUB-06) | 3 jam R5 | Prasyarat semua kategori |
| 2 | Empat jalur menang; pecundang = "platform komprehensif" | Kode jalur (a)/(b), framing jalur platform | PRD 8 layar, 4 persona (`docs/08` §7.3-7.5); README tagline produk | Tidak ada temuan; terlalu banyak modul | Reframe ke satu pertanyaan ilmiah; potong scope (§6) | 1 jam R5 + keputusan tim | Besar: menentukan masuk HM/finalis atau berhenti di nominee |
| 3 | "Will It Rain On My Parade?": 6 finalis membuat hal sama; kalender benar ≠ menang | Kalender adalah inti produk kita | `docs/08` §7.5 Layar 2 "Kalender (inti challenge)" | Kalender tidak membedakan | Kalender jadi bukti pendukung, bukan headline. Headline = temuan | 0 jam (framing) | Sedang-besar |
| 4 | Finalis data menyebut tempat + pertanyaan spesifik | Tempat = "Indonesia"/5 pulau; pertanyaan belum ada | `bundle/index.json:142-215` hanya IDN + 5 region; README tidak punya pertanyaan | Tidak ada provinsi gambut bernama (Riau, Kalteng) | Tambah AOI Riau dan Kalimantan Tengah dari ADM1 yang sudah diunduh (`support/boundaries/...ADM1...geojson`); rumuskan pertanyaan | 2-3 jam R1 | Besar untuk Science/Local |
| 5 | Indonesia 2025: 0 dari 6 nominee sampai HM | Risiko sama | — | Nominee Indonesia 2025 (AIM-X, Bloomee) bergaya platform | Hindari gaya itu; satu angka | — | Konteks |
| 6 | Pemenang jarang menautkan repo; tak ada yang wawancara; AI bukan pembeda | Kita berinvestasi besar di AI brief + verifier | `api/brief/*`, 41 tes, `eval/brief_eval.py` | Effort AI tidak menambah peluang | Bekukan AI (tidak ada pekerjaan baru); tampilkan hanya sebagai "AI use statement" | Hemat 2-4 jam R6 | Netral-positif (waktu dialihkan) |
| 7a | Pertanyaan ilmiah tajam di wilayah bernama | ⬜ | — | Lihat #4 | §5 F2 (F1 ditarik) | 2 jam R2+R3 | Besar |
| 7b | Kalibrasi overlap sejak 2012 | ✅ 2012-2021 | `bundle/index.json:5-8, 43-77` | Overlap dipotong 2021 karena drift: bagus, jelaskan | Jelaskan di page alasannya (drift) | 0,5 jam R5 | Sedang |
| 7c | Tahun uji held-out | ✅ LOYO, LORO, sunset | `validation_results.json:217-545` | LOYO lulus (M3 7,2%); LORO gagal 3 region; sunset gagal (KGE M3 0,889 < M1 0,900) | Laporkan apa adanya + interpretasi | 1 jam R3 | Positif bila jujur |
| 7d | Bandingkan dengan baseline sederhana | ✅ ablation M0-M3x | `validation_results.json:22-72` | Baseline M1 (κ global) **menang** di sunset dan LORO JNBM/Sulawesi; M2 menang di LOYO (2,3%) | Pernyataan jujur: "stratifikasi tidak terbukti lebih baik dari κ global di luar sampel"; pilih metode produksi berdasarkan aturan pra-registrasi | 1 jam R2 | Positif (kejujuran) tapi harus diumumkan |
| 7e | Rentang ketidakpastian | 🟡 | H_lo/H_hi ada, tapi = H di 2003-2021 (`monthly_IDN.json`, mis. 2015 91448/91448/91448) | Pita kosong di era referensi; tidak ada ketidakpastian κ terhadap "seharusnya" | Tampilkan interval κ dan interval seri 2022+; di era Aqua jelaskan "referensi, tanpa koreksi" | 1 jam R2 | Sedang |
| 7f | Kondisi gagal ditulis di depan | ✅ | `docs/validation_plan.md` (SET-05 sebelum hasil); aturan di setiap baris `rule` | — | Tautkan commit pra-registrasi di page (timestamp) | 0,25 jam R5 | Besar untuk Science (jarang ada) |
| 7g | Jangan jumlahkan MODIS+VIIRS | ✅ | Unit cell-days per satelit (`bundle/index.json:15`) | — | Tunjukkan di page apa yang terjadi kalau dijumlahkan (tabel F2: summed +136% vs fair −63%) | 0,5 jam | Pembeda vs Terra Harmonia |
| 7h | Drift Terra/Aqua 2022-2026, S-NPP end 2 Nov 2026 | 🟡 drift terukur; transisi S-NPP→NOAA-20 κ 0,971 | `physics_summary.json:7-207`, `validation_results.json:196-205` | Model diurnal placeholder; seam 2026-11 "insufficient data" | Pakai drift sebagai fakta terukur (menit), bukan model; F3 | 2 jam R3 | Best Use of Data |
| 7i | Peta "seberapa percaya pada nol" (observability) | ⬜ | `obs_class` kosong (`bundle/index.json:138-141`); V13 not_run | Pembeda yang dijanjikan belum ada | P1 jika CMG selesai; jika tidak, potong dan sebutkan di limitations | 3-4 jam R1+R3 | Sedang |
| 7j | Akuntabilitas lintas era (putusan, industri vs rakyat) | ⬜ | — | Sensitif hukum; butuh data konsesi | **CUT** untuk hackathon; sebut sebagai "future use" tanpa nama perusahaan | 0 | Hindari risiko |
| 7k | Page bisa dinilai tanpa pitch | ⬜ | — | — | Checklist §7 | 3 jam R5 | Prasyarat |
| 7l | Demo publik hidup sampai Jan 2027 | ⬜ | Tidak ada deploy | Butuh hosting statis | GitHub Pages / Cloudflare Pages dari `app/` + bundle statis (tanpa backend) | 1-2 jam R4 | Prasyarat |
| 7m | Video pendek before/after + angka validasi + temuan | ⬜ | SUB-05 ⬜ | — | Storyboard §7 | 3 jam R5 | Prasyarat |
| 7n | Release tag "submission" | ⬜ | — | — | `git tag submission-2026-11-15` di commit final | 0,1 jam R5 | Kecil tapi wajib |
| 7o | Hindari: klaim prediksi kebakaran | ⚠️ | `decision_summary.json` `p_exceed`, `alert_calendar.json`; PRD "kalender kesiagaan" | Bisa terbaca sebagai prediksi; backtest hit rate 0,39, FAR 0,53 (`docs/physics_results.md:104-106`) | **CUT dari headline**. Bila tetap ditampilkan: "frekuensi historis pada kondisi ENSO serupa" + angka backtest apa adanya | 0,5 jam | Menghindari penalti |
| 7p | Hindari: angka headline dari kasus termudah | ⚠️ | LOYO nasional (kasus mudah) lulus, LORO/sunset gagal | Godaan memakai "7% error" | Headline wajib menyertakan hasil LORO/sunset | — | Kredibilitas |
| 8 | Pesaing 2026 punya fitur standar yang sama | Sama | §4 | Tidak ada pembeda fitur | Bersaing di temuan + kejujuran validasi | — | — |
| 9 | Pola top-5 lokal: masalah high-stakes, data nyata, demo terlihat, SATU angka, akui keterbatasan | 2 dari 5 (data nyata, keterbatasan) | — | Demo dan satu angka | §5 dan §6 P0 | — | Konfirmasi arah |

---

## 4. Audit terhadap pesaing (README, belum diverifikasi)

| Pesaing | Mereka lebih kuat | Kita lebih kuat | Seri |
|---|---|---|---|
| **Wanareksa / Terra Harmonia** (Indonesia gambut, **pesaing langsung baru**) | Fitur dan tampilan paling lengkap; bilingual; PDF; WhatsApp untuk Manggala Agni; kemungkinan sudah ada demo | Mereka **menjumlahkan FRP kedua sensor** dan memakai **koefisien tetap tanpa validasi**, tanpa NOAA-21. Kita: unit cell-days per satelit, κ per strata dengan bootstrap, validasi pra-registrasi dengan kegagalan dilaporkan, ablation terhadap baseline, drift terukur | Fokus Indonesia, gambut, bilingual |
| fire-harmony (global) | Seam/placebo, inter-sensor rate, 90% range, kalibrasi 2012-2019 | Konteks lokal, ENSO, SiPongi, drift | Seam test, kalibrasi overlap |
| Kiln Watch | Cloud-free cell-days (kita belum: DAT-10 🟡), jujur soal hipotesis gagal, dibangun sebelum event | Wilayah bernama + data resmi pembanding | Kejujuran pra-registrasi |
| FireCal | 208 negara, CSV + API | Data sampai 2025 + NRT 2026 + NOAA-20 (mereka S-NPP saja, sampai 2024) | — |
| Emberline | 5 satelit, outlook 1-4 minggu | Tidak mengklaim prediksi | Percentile bands |
| Chronofire, Flare-Chronos, FireChronicle, FireLens, Icarus, Vtheonly | Bervariasi (tampilan) | — | Grid, kalender, toggle raw/harmonised |

**Cara membedakan dari Terra Harmonia (tanpa menyerang nama):**
1. **Jangan berlomba di fitur operasional.** WhatsApp/PDF untuk Manggala Agni sudah mereka miliki; versi kita tidak akan lebih baik dalam 36 jam dan tidak menjawab pertanyaan harmonisasi. Brief kita dibekukan (§6 CUT).
2. **Tunjukkan secara generik mengapa menjumlahkan sensor itu salah.** Satu panel/tabel: "Jika MODIS + VIIRS dijumlahkan, aktivitas 2019-2023 tampak 2,36× periode 2003-2007 (+136%); di skala setara Aqua 0,37× (−63%)" (`docs/trend_results.md:24-25`, preliminary, §5 F2). Juri yang membaca kedua page akan menarik kesimpulan sendiri.
3. **Angka validasi di kalimat kedua page**, termasuk yang gagal. Pesaing dengan koefisien tetap tidak bisa menampilkan LOYO/LORO.
4. **NOAA-20 dan transisi S-NPP** (κ NOAA20→SNPP 0,971, `validation_results.json:196-205`): kita satu-satunya Indonesia yang siap setelah 2 Nov 2026.
5. Bila tim punya kontak Manggala Agni/BPBD, kutip satu keputusan nyata yang berubah karena skala adil (bukan fitur), untuk fallback Local Impact.

---

## 5. Kandidat "SATU temuan" (dengan angka preliminary)

Semua angka di bawah: **PRELIMINARY**, dihitung read-only dari `bundle/monthly_IDN.json` (generated 2026-11-14T02:25Z, manifest `f2849b7b…`) dengan menjumlahkan bulan per tahun. "Naif" = Aqua sampai 2011 lalu S-NPP mentah mulai 2012 (cara orang biasa menyambung "sensor terbaik yang tersedia"). "Jumlah" = A_raw + V_raw. "Adil" = H (skala setara Aqua-MODIS).

Tabel tahunan (fire cell-days, Indonesia):

| Tahun | H adil | Aqua mentah | S-NPP mentah | NOAA-20 mentah |
|---|---|---|---|---|
| 2006 | 91.249 | 91.249 | — | — |
| 2015 | 91.448 | 91.448 | 496.510 | — |
| 2019 | 47.684 | 47.684 | 242.791 | 244.185 |
| 2023 | 30.197 (28.769-31.031) | 30.943 | 155.333 | 156.868 |
| 2024 | 12.938 (12.324-13.325) | 14.139 | 66.007 | 75.369 |
| 2025 | 13.090 (12.548-13.449) | 11.266 | 62.535 | 62.115 |

> **F1 DITARIK (09:42).** Kolom "naif" untuk 2023/2015 di bawah keliru: membandingkan S-NPP 2023 dengan Aqua 2015. Penyambungan naif memakai S-NPP untuk 2015 dan 2023, sehingga rasionya 0,31× (mentah) vs 0,33× (adil), tanpa pembalikan (`docs/finding.md:8-12, 56-66`). Kolom "Tren" dan "jumlah A+V" di tabel region tetap benar dan sejalan dengan hasil resmi FND-04. Bagian F1 disimpan di bawah hanya sebagai jejak audit; **jangan dipakai**.

### ~~F1 · "El Niño 2023 vs 2015 pada skala yang adil"~~ (DITARIK)
- **Hitung:** Σ bulan H(2023)/H(2015) dari `monthly_IDN.json`; bandingkan V_raw(2023)/A_raw(2015) (penyambungan naif) dan luas terbakar resmi SiPongi 2023/2015 (sudah ada di V6, `validation_results.json:882-900`). Ulangi per region (Sumatra, Kalimantan) dan, setelah AOI provinsi ditambah, Riau dan Kalteng.
- **Angka preliminary:** naif 155.333 / 91.448 = **1,70×** (2023 tampak 70% lebih besar). Adil 30.197 / 91.448 = **0,33×** (interval 0,31-0,34). SiPongi luas terbakar 1.161.193 / 2.611.411 ha = **0,44×**. Peringkat 2015 > 2019 > 2023: H setuju dengan SiPongi (Spearman 1,0), mentah tidak (−0,5), n = 3 (deskriptif).
- **Robust per region (preliminary, dari `monthly_region-*.json`):**

  | AOI | 2023/2015 adil (interval) | 2023/2015 naif | Tren 2003-07→2019-23 adil | naif | jumlah A+V |
  |---|---|---|---|---|---|
  | Indonesia | 0,33 (0,31-0,34) | 1,70 | 0,37 | 1,98 | 2,36 |
  | Sumatra | 0,25 (0,23-0,26) | 1,18 | 0,27 | 1,29 | 1,56 |
  | Kalimantan | 0,32 (0,30-0,33) | 1,36 | 0,36 | 1,62 | 1,99 |
  | Sulawesi | 0,37 (0,34-0,39) | 2,29 | 0,42 | 2,83 | 3,23 |
  | Papua | 0,36 (0,34-0,38) | 1,74 | 0,73 | 3,69 | 4,44 |
  | Jawa-NT-Bali-Maluku | 0,68 (0,63-0,73) | 5,57 | 0,71 | 6,24 | 6,95 |

  Di **semua** region tanda perbandingan terbalik (naif > 1, adil < 1). Sumatra dan Kalimantan (provinsi gambut) punya efek paling kecil tapi tetap terbalik; JNBM (yang LORO-nya gagal) punya efek terbesar dan paling tidak pasti, jadi jangan dijadikan headline.
- **Risiko:** (1) n = 3 tahun SiPongi, hanya deskriptif. (2) H 2023 memakai S-NPP×κ, sementara Aqua 2023 sendiri sudah drift +14 menit (Aqua D median 13:45 LST 2023 vs 13:31 awal, `physics_summary.json:34`); Aqua mentah 2023 (30.943) nyaris sama dengan H, jadi temuan ini kuat terhadap pilihan metode, tapi juga berarti "harmonisasi" di sini pada dasarnya = "jangan pakai VIIRS mentah". (3) Juri bisa menilai temuan "VIIRS melihat 5× lebih banyak" sebagai sudah diketahui; nilai baru ada pada **konsekuensinya untuk Indonesia** (perbandingan El Niño, tren).
- **Kalimat page:** *"On the raw satellite record, Indonesia's 2023 El Niño fire season looks 70% bigger than 2015. Put on one fair MODIS-equivalent scale, it was about one third of 2015, pointing the same way as official burned-area figures (44% of 2015)."* Jangan menulis "matches" atau "validated by": 0,33 vs 0,44 berbeda dan n = 3.

### F2 (REKOMENDASI, sekarang dihitung resmi) · "Arah tren 25 tahun terbalik"
- **Status resmi (FND-04, `docs/trend_results.md:21-45`):** Theil-Sen fair IDN **−4,3%/th [−8,7; −1,5]**, MK Hamed-Rao p = 0,004; naif +1,7%/th [−0,7; +5,3] p = 0,23 (tidak signifikan: kenaikan naif terutama *step* 2012, bukan tren). Fair negatif di **6/6 AOI**, juga saat tahun El Niño dikeluarkan; CI mengecualikan 0 kecuali Papua. Artefact share nasional 1,93 (sign flip) (`docs/finding.md:68-74`). Bukti independen bahwa kenaikan naif adalah artefak: seam 2012 M0 gagal (Δ 1,52), M3 lulus (Δ −0,057).
- **Kalimat page yang disarankan:** *"Splice MODIS and VIIRS naively and Indonesia's fire activity roughly doubles from the mid-2000s to 2019-23 (+98%); on one MODIS-equivalent scale it fell by about 63%, and the fair trend is downward in all six regions we tested."* Tambahkan langsung: *"This describes satellite fire detections, not burned area, and we do not attribute the decline to any policy."* (`docs/trend_results.md:51-55`).
- **Risiko tersisa:** M1/M2 refit sensitivity belum (`docs/trend_results.md:16`); 2022-2025 bergantung pada era S-NPP×κ yang seam 2022-01-nya gagal, tapi pembalikan didorong oleh splice 2012, bukan 2022+.

Catatan versi awal (angka preliminary saya, konsisten dengan hasil resmi):
- **Hitung:** rata-rata tahunan 2003-2007 vs 2019-2023 untuk H, naif, dan jumlah A+V.
- **Angka preliminary:** H 54.129 → 20.135 = **0,37×** (turun 63%). Naif 54.129 → 107.420 = **1,99×** (naik 99%). Jumlah A+V 54.129 → 127.501 = **2,36×**. Artinya **lebih dari 100% "kenaikan" pada catatan naif adalah artefak pergantian sensor**: tanda trennya terbalik.
- **Risiko:** pemilihan jendela sensitif (2006 dan 2015 tahun ekstrem). Wajib Theil-Sen + Mann-Kendall dan beberapa jendela (2001-2005 vs 2021-2025: H 0,27×, naif 1,64×). Tren turun pasca-2015 punya penjelasan kebijakan (moratorium, BRG) yang tidak kita uji; jangan klaim penyebab.
- **Kalimat page:** *"Stitch MODIS and VIIRS naively and Indonesia's fire activity doubled since the mid-2000s; on a fair scale it fell by about 60%. The 'increase' is a satellite artefact."* (Diperbarui: F2 kini headline; lihat kalimat resmi di atas.)

### F3 · "Efek drift orbit" (jalur Best Use of Data)
- **Hitung:** LST median per tahun Aqua/Terra (`physics_summary.json:7-207`): Aqua siang 13:31 → 14:40 LST pada 2025 (+69 menit), Terra siang 10:32 → 09:19 (−73 menit). Efek terhadap hitungan: R_obs = Aqua/(S-NPP×κ) bulanan 2022+ median 0,954 (IQR 0,815-1,076), korelasi dengan R_pred r = 0,53 (p = 1,3e-4) (`:782-805`).
- **Catatan aturan:** menurut `docs/validation_plan.md` §3, V4 lulus bila r > 0 dengan p < 0,10 **dan** MdAPE(M3x) > MdAPE(M3). Kedua syarat terpenuhi di output yang ada (r = 0,53, p = 1,3e-4; M3x 7,32% > M3 7,23%, `validation_results.json:962-971`), tetapi runner menandai V4 `not_run` karena R_pred belum di-wire. Menyambungkan `physics_summary.json` ke runner (0,5-1 jam R3) kemungkinan besar menghasilkan V4 "pass", dengan catatan parameter diurnal belum terverifikasi.
- **Risiko:** R_pred memakai parameter diurnal **placeholder [UNVERIFIED]**; efek 4-5% berada dalam IQR. Lebih serius: dengan puncak placeholder 14,5 h, drift Aqua ke 14,7 h memprediksi R > 1, sedangkan median observasi < 1 (`docs/physics_results.md:75`), dan korelasi bisa sebagian musiman. Jadi yang boleh diklaim hanya **drift jam lintas (terukur)** dan "kalibrasi dihentikan di 2021", bukan "model fisika menjelaskan drift". Seam 2022-01 yang gagal bisa jadi efek drift referensi Aqua, tapi tidak bisa dipisahkan dari error κ (`docs/validation_report.md:74-76`). Belum bisa disebut temuan, baru "bukti bahwa kalibrasi harus berhenti di 2021".
- **Kalimat page:** *"Since 2022 Aqua crosses Indonesia over an hour later than it used to; we stop calibration in 2021 and show why."*

### F4 · Rasio deteksi gambut vs mineral
- **Hitung:** join `grid005_YYYY.parquet` (g_lat, g_lon) dengan `support/peat/gfw_indonesia_peat_lands.geojson`, hitung κ_peat dan κ_mineral pada 2012-2021 per siang/malam; uji H1 (κ_peat < κ_mineral) dengan bootstrap tahun (`pipeline/science/peat.py`).
- **Status:** **tidak bisa dihitung read-only sekarang**: `is_peat = unknown` di semua strata. Butuh DAT-03 join (2-3 jam R1) + rerun calibrate (1 jam R2).
- **Risiko:** tinggi (hasil bisa null; resolusi 0,05° mencampur gambut/mineral). Bila lulus, ini temuan terkuat untuk "api yang luput dari MODIS"; bila null, laporkan null (`docs/08` risiko R4).
- **Kalimat page (jika lulus):** *"MODIS sees only X of every 100 VIIRS fire cell-days on peat, versus Y on mineral soil."*

### F5 · Musim 2026 vs 2015 pada skala adil
- **Status:** bundle berhenti 2025-12 (`bundle/index.json:153`); NRT 2026 sudah ada (`derived/nrt_report.json`) tapi belum diharmonisasi. NOAA-21 hanya NRT; S-NPP berhenti 2 Nov 2026. **Tidak bisa dihitung sekarang.**
- **Risiko:** NRT ≠ SP, static mask NRT, chain NOAA-20/21 belum tervalidasi, seam 2026-11 "insufficient data". Angka bisa berubah setelah SP dirilis.
- **Kalimat page:** *"2026 so far is N% of 2015 on the same scale (provisional NRT)."* Hanya jika lolos QA; ini paling menarik media tapi paling rapuh ilmiah.

### F6 · ENSO saja melewatkan tahun api besar (IOD)
- **Dari output:** backtest DEC-03 melewatkan 2006 dan 2019 (ENSO-netral menurut ONI JAS, tapi IOD positif kuat) (`docs/physics_results.md:106`).
- **Risiko:** hubungan IOD-api Indonesia sudah dikenal di literatur (kebaruan rendah); n kecil. Cocok sebagai kalimat keterbatasan, **bukan** temuan utama.

**Update F4 (VAL-09 jalan 09:30, `docs/peat_results.md:79-91`):** H1 (MODIS melewatkan gambut lebih banyak) **ditolak**: siang log-selisih −0,003 [−0,147; 0,088], malam −0,552 (arah berlawanan). H2 (malam vs siang di gambut) **diterima**: ρ malam ≈ 2,1× siang. H3 **ditolak, tanda berlawanan** (ρ gambut 2015 +33%). F4 bukan headline; H2 bisa jadi kalimat metode ("VIIRS sees about twice as many night peat fires relative to MODIS as day ones").

**Update F5 (`docs/finding.md:53-66`, provisional NRT):** Jan-Okt 2026 = 0,71× 2015 adil [0,66-0,74] nasional; Kalimantan Aug-Okt 0,79×; Sumatra 0,40×. Menarik tapi bergantung pada era S-NPP×κ yang seam-nya gagal; hanya di aplikasi dengan label "provisional".

**Pilihan akhir:** **F2 sebagai headline** (satu-satunya temuan yang sudah dihitung resmi, robust di 6 AOI, dan didukung seam test independen). F3 dan H2 di bagian metode. F5 di aplikasi berlabel provisional. F1 ditarik.

---

## 6. Backlog prioritas sisa hackathon

Jam = estimasi kerja efektif. ID baru memakai prefix `FND` (finding) dan `PG` (page) untuk ditambahkan ke `docs/11`.

### P0 (wajib, H1 hari ini)

| ID baru | Pekerjaan | Pemilik | Jam | Peta ke tiket lama |
|---|---|---|---|---|
| FND-01 | ✅ selesai 09:40 (`pipeline/run/finding.py`, `pipeline/run/trend.py`). Sisa: sensitivitas refit M1/M2 untuk tren dan CI slope via bootstrap tahun | R2 | 1 | baru; memakai output CAL-04, VAL-06 |
| FND-02 | Tambah AOI provinsi gambut (Riau, Kalimantan Tengah, Sumatera Selatan) dari ADM1 yang sudah ada; ulangi F2 per provinsi (`pipeline/science/aoi.py` baru di-merge, cek dulu) | R1 | 2-3 | CAL-05 (dipersempit ke 3 AOI tetap), DAT-03 |
| FE-06 | Hubungkan frontend ke bundle nyata, hapus badge sintetis | R4 | 2 | FE-06 (blokir sudah hilang: bundle ada) |
| FND-03 | Satu layar "Before vs after": naif vs jumlah vs adil, 2003-2025, + kalimat temuan + angka validasi | R4 | 2-3 | menggantikan FE-12/FE-14 |
| PG-01 | Draft project page v1 (struktur §7), README dibuka dengan pertanyaan + temuan | R5 | 3 | SUB-02, SUB-06 |
| PG-02 | Deploy statis publik (GitHub/Cloudflare Pages), tanpa backend | R4 | 1-2 | baru |
| VAL-12+ | `docs/validation_report.md` sudah ada (merge 09:33). Sisa: wire V4 dari `physics_summary.json` ke runner; salin figur EXP-05 (`national_raw_vs_harmonized`, `seam_plot`) ke `docs/figures/` untuk page dan video | R3 | 1 | VAL-05, EXP-05 |
| FND-05 | Keputusan tim tertulis di `docs/decisions.md`: metode produksi (M3 sesuai pra-registrasi walau M2 lebih baik di LOYO/sunset) dan cara menyebutnya di page | R2 + R5 | 0,5 | baru |

### P1 (H2 pagi)

| ID | Pekerjaan | Pemilik | Jam | Peta |
|---|---|---|---|---|
| DAT-03 / VAL-09 | Join gambut → rerun κ → uji H1-H3 (F4) | R1 + R2 | 3-4 | DAT-03, VAL-09 |
| FND-04 | Tren Theil-Sen/MK untuk F2 dengan beberapa jendela; sensitivitas metode M1/M2/M3 | R2 | 1,5 | baru |
| VAL-05 | Drift: ganti parameter placeholder dengan nilai literatur terverifikasi, atau laporkan drift hanya sebagai LST terukur | R3 | 2 | VAL-05, PHY-03 |
| SUB-05 | Video 30 s (storyboard §7) | R5 | 3 | SUB-05 |
| SUB-04 | 7 slide (cadangan bila video gagal) | R5 | 2 | SUB-04 |
| SUB-07 | QA angka lintas page/video/app/README | R5 + R3 | 1,5 | SUB-07 |
| FE-15 | "Seberapa yakin" disederhanakan: satu panel validasi | R4 | 1,5 | FE-15 |

### P2 (hanya jika P0/P1 selesai)

| ID | Pekerjaan | Pemilik | Jam |
|---|---|---|---|
| FE-11 | Gantt satelit kecil di layar before/after | R4 | 1 |
| F5 | Harmonisasi NRT 2026 berlabel provisional | R1 + R2 | 3 |
| V13 | Observability ("seberapa percaya nol") bila DAT-10 selesai | R3 | 3 |
| SUB-01 | Satu kutipan praktisi (fallback Local Impact) | R5 | 1 |

### CUT (hentikan atau bekukan untuk mencegah platform-sprawl)

| Fitur | Tiket | Alasan |
|---|---|---|
| **`api/agent` (planner 519 baris, `eval/agent_eval.py`) yang baru di-merge 09:40** | AI-06 / baru | Sinyal platform-sprawl paling nyata hari ini. Jangan dikembangkan lagi; jangan tampil di page/video selain AI use statement |
| Brief siaga PDF/WhatsApp, query bahasa alami | AI-06, kerja baru di `api/brief` | Terra Harmonia sudah punya; tidak menjawab pertanyaan ilmiah; AI bukan pembeda (insight 6). Biarkan kode yang ada, jangan tampilkan di headline |
| Prioritas KHG & kalender kesiagaan (UI) | FE-19, DEC-02/03 UI | Mendekati klaim prediksi; tidak tervalidasi (V11 not_run) |
| Slider operator Sofiev, kalkulator sub-piksel | FE-20, PHY-04, PHY-05 | P2 tanpa bukti; menambah modul |
| Mode gelap, tabel "Kenapa?", layar "Bulan ini vs sejarah" | FE-21, FE-13, FE-12 | Fitur standar pesaing |
| Uji transfer Amazon | EXT-01, EXT-02, V17 | Data belum diingest; mengaburkan fokus Indonesia |
| AOI kustom bebas | CAL-05 (versi penuh) | Ganti dengan 3 provinsi tetap |
| Akuntabilitas konsesi/putusan pengadilan | — | Sensitif hukum, tanpa data |

---

## 7. Checklist project page, video, repo (untuk juri yang hanya membaca page)

**Project page (urutan isi):**
- [ ] Kalimat 1: masalah + tempat + pengguna. Contoh: *"Indonesia's peat-fire record spans five satellites; when they change, the record lies, and fire agencies in Riau and Central Kalimantan compare seasons on the wrong scale."*
- [ ] Kalimat 2: SATU temuan (F2) dengan angka dan rentang (+98% naif vs −63% adil; −4,3%/th [−8,7; −1,5]).
- [ ] Kalimat 3: angka validasi held-out (LOYO MdAPE) **dan** pengakuan kegagalan (LORO/sunset).
- [ ] Dataset persis: FIRMS MODIS C6.1 MCD14ML (Terra, Aqua) SP 2000-2025; VIIRS 375 m C2 S-NPP (VNP14IMG) dan NOAA-20 (VJ114IMG) SP; NRT 2026 termasuk NOAA-21; ONI NOAA CPC; SiPongi KLHK; GFW peat; geoBoundaries ADM1. Sebut versi dan tanggal unduh.
- [ ] Diagram metode satu gambar: deteksi → cell-days per satelit → κ per strata pada 2012-2021 → chain → seri H + interval → validasi.
- [ ] Tabel validasi: metode M0-M3 × (LOYO, LORO, sunset, seam), dengan kolom lulus/gagal dan tautan ke commit pra-registrasi.
- [ ] Gambar before/after (naif vs jumlah vs adil).
- [ ] Keterbatasan (lihat §8), ditulis sebelum juri menemukannya.
- [ ] AI use statement (`docs/ai_acknowledgement.md`), termasuk "AI tidak dipakai untuk ide".
- [ ] Sitasi: Giglio 2016 (MODIS C6), Schroeder 2014 (VIIRS 375 m), Wolfe/drift Terra-Aqua, data SiPongi.
- [ ] Tautan demo publik + repo + tag release.
- [ ] Tidak ada kata "platform", "monitoring", "predict". Tidak ada angka ilustratif.

**Video 30 detik (EN, subtitle):**
- [ ] 0-5 s: grafik naif naik tajam di 2012, teks "Indonesia's fire record has a lie in it."
- [ ] 5-15 s: transisi ke skala adil; garis naik berubah menjadi turun (+98% menjadi −63%, angka final dari `docs/trend_results.md`).
- [ ] 15-22 s: satu angka validasi + "pre-registered, including the tests we failed".
- [ ] 22-30 s: peta provinsi gambut + "Second Sight: one honest scale for 25 years of fire history" + URL.

**Repo/release:**
- [ ] README dibuka dengan pertanyaan + temuan; perintah run yang benar (`README.md:54` masih placeholder).
- [ ] `docs/validation_report.md` dari `validation_results.json`.
- [ ] Data bundle kecil di repo atau tautan unduhan + manifest SHA.
- [ ] Tag `submission-2026-11-15` sebelum 23:59 WIB 15 Nov; tidak ada commit ke tag sesudahnya.
- [ ] Demo tetap hidup sampai Jan 2027 (hosting statis gratis, tanpa kunci API).

---

## 8. Risiko dan catatan jujur

**Yang lulus dan layak ditonjolkan (agar kejujuran tidak terbaca sebagai kegagalan total):**
- Seam 2012-01 varian `switch2012`: M0 (sambung mentah) **gagal** dengan Δ = 1,52 dan Pettitt p = 4e-8; M3 **lulus** dengan Δ = −0,057 di dalam placebo 90% [−0,240; 0,181] (`validation_results.json:694-705, 763-774`). Ini bukti langsung bahwa harmonisasi menghapus lompatan 2012, dan cocok sebagai gambar "before vs after".
- LOYO: M3 MdAPE 7,2% ≤ M1 8,4% dan ≤ 25%, Spearman 1,0 (`:316-325`).
- V10 flag agreement F1 0,84, Cohen κ 0,83 (`:842-871`); V12 peringkat tahun ekstrem identik (`:873-881`).
- V6 SiPongi: ρ(H) = 1,0 ≥ ρ(mentah) = −0,5; menurut aturan V6 ini "pass", tapi ditandai deskriptif karena n = 3.

**Yang gagal atau belum:**

1. **LORO gagal** untuk M3 di Jawa-NT-Bali-Maluku (89%), Sulawesi (42%), Kalimantan (20,3% > 2×7,2%) (`validation_results.json:426-485`). Metode tidak tertransfer antar-region dengan aktivitas rendah.
2. **Sunset backtest gagal**: KGE M3 0,889 < M1 0,900 (`:536-545`); M2 (0,938) lebih baik dari keduanya. Stratifikasi M3 belum terbukti lebih baik dari baseline sederhana di luar sampel. Pilihan metode produksi harus mengikuti aturan pra-registrasi, bukan dipilih ulang setelah melihat hasil.
3. **Seam test degeneratif**: dengan referensi Aqua-only, seri H = Aqua di 2012-2021 sehingga Δ = 0 menurut konstruksi; seam 2012-01 dan 2018-04 "not_applicable" (`:556-582`). Seam 2022-01 (pindah ke S-NPP×κ) **gagal** dengan Pettitt p ≤ 0,001 (`:584-593, 653-662`): ada lompatan saat referensi pindah. Uji seam yang bermakna butuh MCD64A1 (belum diunduh).
4. **Interval kosong di era Aqua**: H_lo = H_hi untuk 2003-2021, jadi "pita ketidakpastian di setiap nilai" (README) belum benar untuk 19 tahun. Harus dijelaskan atau diperbaiki.
5. **Gambut: label sudah dibuat, H1 ditolak** (`docs/peat_results.md:79-91`). Label gambut baru ada di `monthly_stratum_labeled.parquet`; κ produksi dan bundle masih `is_peat = unknown`. Yang lebih penting: premis tagline lama *"Seeing the fires MODIS missed"* dan PRD "gambut paling sering luput dari MODIS" (`docs/08` §7.1) **tidak didukung data siang hari**. README baru (`README.md:3`) sudah tidak memakai tagline itu; pastikan page, video, slide, dan nama/tagline juga tidak.
6. **Kotak island_region perkiraan**: Kepulauan Aru dan Kei masuk Papua (tracker temuan 3). Angka per region ikut terpengaruh; lebih aman memakai ADM1.
7. **Drift model placeholder**: parameter diurnal `[UNVERIFIED]`; V4 not_run. Jangan sebut R_pred sebagai bukti fisik.
8. **SiPongi n = 3**: korelasi hanya deskriptif.
9. **Bundle tanpa 2026**: alasan "why now" (musim 2026, S-NPP berhenti) belum tercermin di data aplikasi.
10. **Frontend sintetis**: risiko terbesar secara eksekusi; tanpa FE-06 + deploy, juri tidak melihat apa pun.
11. **Angka di dokumen ini preliminary**: dihitung dari bundle pagi ini (manifest `f2849b7b…`). Setiap rerun pipeline (mis. setelah join gambut) bisa mengubah κ dan H 2022+, dan F2 harus dihitung ulang sebelum dipakai.
12. **Sensitivitas hukum**: hindari menyebut perusahaan/konsesi; data hotspot bukan bukti pembakaran.
13. **F\* pra-registrasi tidak ditemukan**: R(F) mendatar di 2,7 (siang) / 3,1 (malam) karena MODIS dibatasi piksel dekat nadir; F\* 7,67/5,11 MW adalah sensitivitas **tidak pra-registrasi** (`docs/physics_results.md:39-46`). Klaim "ambang FRP fisik bersama" di PRD (`docs/08` §7.1 Kebaruan butir 3) harus dihapus dari page.
14. **Kalender kesiagaan lemah**: backtest LOYO hit rate 0,39, FAR 0,53; Sumatra 0/3 (`docs/physics_results.md:96-106`). Jangan jadikan fitur unggulan.
15. **Prioritas (DEC-01) tidak jalan** karena replikat bootstrap tidak diekspor.
