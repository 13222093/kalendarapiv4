# 12 · Rancangan Testing Second Sight

> Rencana uji untuk semua komponen hasil tiket di [11-tiket-implementasi.md](11-tiket-implementasi.md).
> Hasil eksekusi dicatat di [test_report.md](test_report.md). Aturan validasi ilmiah yang dipra-registrasi ada di [validation_plan.md](validation_plan.md).

---

## 1. Tujuan dan cakupan

**Tujuan:**
1. Memastikan setiap tiket yang berstatus Done benar-benar memenuhi kriteria selesainya.
2. Memastikan angka yang tampil di aplikasi, brief, CSV, dan materi pitch **identik dan bisa dilacak** ke hasil pipeline.
3. Memastikan aplikasi bisa dipakai juri dan pengguna (BPBD, pengelola KHG) tanpa error, di desktop dan mobile, dalam bahasa Indonesia dan Inggris.
4. Memastikan tidak ada pelanggaran kepatuhan: rahasia di repo, data contoh tanpa label, logo NASA, atau batas demo yang terlampaui.

**Dalam cakupan:**

| Komponen | Folder |
|---|---|
| Pipeline data | `pipeline/data/` |
| Data pendukung | `pipeline/support/` |
| Sains | `pipeline/science/` |
| Fisika & triangulasi | `pipeline/physics/` |
| Keputusan | `pipeline/decision/` |
| Ekspor | `pipeline/export/` |
| Runner validasi | `pipeline/run/` |
| Brief & verifier | `api/brief/` |
| Eval AI | `eval/` |
| Frontend | `app/` |
| Dokumentasi yang memuat angka | `README.md`, `docs/validation_report.md`, `docs/physics_results.md` |

**Di luar cakupan:** kebenaran data sumber FIRMS itu sendiri, layanan pihak ketiga (basemap, CDN font), dan performa jaringan juri.

---

## 2. Tingkatan uji

| Tingkat | Jenis | Pendekatan | Alat | Siapa |
|---|---|---|---|---|
| L1 | **Unit (white-box)** | Menguji fungsi satu per satu dengan fixture sintetis kecil; menelusuri cabang logika (era seri, shrinkage, kelas observabilitas, aturan brief) | pytest, pytest-cov | Pemilik modul |
| L2 | **Invariant & property (white-box)** | Sifat yang harus selalu benar untuk input apa pun (konservasi massa, κ ∈ (0,1), interval lo ≤ nilai ≤ hi, persentil ∈ [0,1]) | pytest, hypothesis (opsional) | QA |
| L3 | **Integrasi** | Modul berurutan pada data nyata: clean → cells → aggregate → calibrate → series → baseline → export | pytest (marker `integration`), skrip runner | QA + R1 |
| L4 | **Sistem / CLI (black-box)** | Menjalankan entry point dari luar tanpa melihat kode; cek exit code, file output, skema, format angka | Bash, pytest + subprocess | QA |
| L5 | **E2E web (black-box)** | Pengguna simulasi di browser headless: navigasi, bahasa, kalender, AOI, unduh | **Playwright** (Chromium); Selenium sebagai alternatif | QA + R4 |
| L6 | **Validasi ilmiah** | Uji pra-registrasi V1-V17 pada data nyata; ablation M0-M8 | `pipeline/run/validate_all.py` | R3 |
| L7 | **Non-fungsional** | Kinerja, aksesibilitas, keamanan, kompatibilitas, kepatuhan | Playwright timing, axe-core, Lighthouse, grep rahasia | QA + R4 + R5 |
| L8 | **Uji penerimaan (UAT)** | Skenario pengguna nyata dijalankan anggota tim (atau praktisi bila sempat) | Checklist manual | R5 |

**Perbedaan white-box dan black-box di proyek ini:**
- **White-box** (L1-L3): penguji melihat kode dan menulis tes untuk setiap cabang, rumus, dan invarian internal.
- **Black-box** (L4-L5, L8): penguji hanya melihat spesifikasi (tiket, PRD, dokumen UI) dan antarmuka (CLI, file output, halaman web), lalu memeriksa perilaku yang diharapkan.

---

## 3. Lingkungan dan data uji

| Lingkungan | Isi |
|---|---|
| Lokal Windows (Git Bash) | Python 3.12 (`.venv`), Node 22, Chromium Playwright |
| Data sintetis | Fixture kecil di `tests/**/conftest.py`, **wajib berlabel SYNTHETIC**; tidak pernah dipakai sebagai hasil |
| Data nyata | `${SS_DATA_DIR}` (default `D:/Lomba/Hackathon/nasa/second-sight-data`): arsip FIRMS SP 2000-2025, NRT 2026, `derived/` |
| Subset cepat | Satu tahun atau satu pulau untuk uji integrasi <2 menit |
| Build web | `app/` → `npm run build` → `vite preview` (port bebas) |
| Viewport | Desktop 1366×850, mobile 375×812 |

---

## 4. Kriteria masuk dan keluar

**Kriteria masuk (sebelum uji dijalankan):**
- Branch sudah di-merge ke `main` dan build tidak gagal.
- Data `derived/` ada (untuk L3, L4, L6).
- `docs/validation_plan.md` sudah di-commit sebelum hasil validasi pertama (cek timestamp git).

**Kriteria keluar (siap submit):**

| Kriteria | Ambang |
|---|---|
| Unit + invariant (L1-L2) | 100% lulus; tidak ada tes yang di-skip tanpa ID tiket |
| Coverage modul inti (`pipeline/science`, `pipeline/data`, `api/brief`) | ≥70% baris (target), ≥50% (minimum) |
| Integrasi (L3) | Semua tahap pipeline berjalan pada data nyata tanpa error |
| CLI black-box (L4) | 100% skenario P0 lulus |
| E2E (L5) | Semua skenario P0 lulus di desktop dan mobile |
| Validasi ilmiah (L6) | Semua uji P0 punya status (lulus / gagal / not_run + alasan); **tidak ada yang hilang** |
| Bug | Tidak ada bug **kritis** atau **tinggi** yang terbuka |
| Konsistensi angka | Semua angka pitch = angka pipeline (SUB-07) |
| Kepatuhan | Checklist §8 lulus |

---

## 5. Kasus uji per komponen

Format: **ID · Jenis · Tiket · Deskripsi · Hasil yang diharapkan**. WB = white-box, BB = black-box.

### 5.1 Pipeline data (`pipeline/data/`)

| ID | Jenis | Tiket | Deskripsi | Diharapkan |
|---|---|---|---|---|
| TD-01 | WB | DAT-01 | Ingest satu tahun fixture CSV | Parquet berpartisi `satellite/year`, jumlah baris sama dengan input |
| TD-02 | BB | DAT-01 | Jumlah baris per satelit-tahun pada data nyata | Tidak ada tahun kosong tak terduga; MODIS 2000 hanya Nov-Des |
| TD-03 | WB | DAT-04 | Manifest | Setiap file punya URL, tanggal, sha256 yang cocok dengan file |
| TD-04 | WB | DAT-06 | Filter `type`, confidence, Terra <Nov 2000 | Baris yang tidak memenuhi syarat terbuang; `conf_class` tersimpan |
| TD-05 | WB | DAT-06 | `local_date` dan LST di dekat batas tanggal dan bujur | LST ∈ [0,24); tanggal lokal benar untuk deteksi dekat tengah malam UTC |
| TD-06 | WB | DAT-06 | `A_pix = scan × track` | Nilai positif; MODIS ≤ ~10 km², VIIRS ≤ ~0,7 km² |
| TD-07 | WB | DAT-07 | Mask statis dengan N berbeda | Jumlah sel menurun saat N naik; lokasi smelter yang diketahui tertutup |
| TD-08 | L2 | DAT-08 | Tidak ada duplikat kunci `daily_cell` | Kunci (tanggal, sel, satelit, siang/malam) unik |
| TD-09 | L2 | DAT-09 | Konservasi massa | Total nasional = Σ pulau = Σ sel grid untuk setiap bulan-satelit |
| TD-10 | BB | DAT-02 | NRT 2026 | Kolom sama dengan SP; `quality = NRT`; mask statis diterapkan; `flag_nrt` muncul di agregat |
| TD-11 | BB | SET-04 | `bash scripts/pipeline.sh <target>` | Exit code 0; output di `derived/` |

### 5.2 Data pendukung (`pipeline/support/`)

| ID | Jenis | Tiket | Deskripsi | Diharapkan |
|---|---|---|---|---|
| TS-01 | WB | DAT-03 | Label gambut titik uji | Titik di dalam poligon gambut = True; di luar = False |
| TS-02 | BB | DAT-03 | Batas ADM1/ADM2 | GeoJSON valid; lisensi tercatat; bukan file ODbL |
| TS-03 | BB | DAT-03 | CSV SiPongi | Setiap baris punya sumber + status verifikasi; tidak ada angka tanpa sumber |
| TS-04 | WB | DAT-05 | Deteksi break pada seri sintetis dengan lompatan di tanggal sensor | Break terdeteksi dan dicocokkan ke event sensor |
| TS-05 | WB | DAT-11 | Agregasi hujan sintetis | Rata-rata 1 dan 3 bulan (mm/hari) benar |

### 5.3 Sains (`pipeline/science/`)

| ID | Jenis | Tiket | Deskripsi | Diharapkan |
|---|---|---|---|---|
| TC-01 | WB | CAL-01 | Ratio of sums per strata | Sama dengan perhitungan manual pada fixture |
| TC-02 | WB | CAL-01 | Shrinkage EB | Strata kecil tertarik ke induk; strata besar hampir tidak berubah |
| TC-03 | L2 | CAL-01 | Rentang κ | 0 < κ < 1 untuk semua strata (VIIRS ≥ Aqua) |
| TC-04 | WB | CAL-02 | Bootstrap dengan seed tetap | Hasil deterministik; κ_lo ≤ κ ≤ κ_hi |
| TC-05 | WB | CAL-03 | Rantai satelit | `r_N20→SNPP` dihitung hanya pada periode overlap |
| TC-06 | WB | CAL-04 | Batas era seri | Terra×r s.d. 2002-06; Aqua 2002-07..2021-12; SNPP×κ 2022-01..2026-11-02; NOAA-20 setelahnya |
| TC-07 | L2 | CAL-04 | Interval | H_lo ≤ H ≤ H_hi; Σ strata = total AOI |
| TC-08 | WB | ANO-01 | Baseline | Median 2003-2022; persentil ∈ [0,1]; baseline di dalam fold tidak memakai tahun uji |
| TC-09 | WB | ANO-02 | Kelas ENSO | Tahun dengan ONI JAS ≥ +0,5 berlabel El Niño; DMI SON ≥ +0,4 berlabel IOD+ |
| TC-10 | WB | VAL-01..03 | Fungsi validasi pada seri sintetis dengan lompatan buatan | Seam terdeteksi pada raw, hilang setelah koreksi; KGE = 1 untuk prediksi sempurna |
| TC-11 | WB | VAL-09 | Uji gambut sintetis | Rasio gambut > mineral terdeteksi bila dibuat begitu; null bila tidak |
| TC-12 | WB | CAL-06 | GLM κ dinamis | Koefisien β1 terestimasi dekat nilai sintetis yang ditanam |

### 5.4 Fisika, triangulasi, keputusan

| ID | Jenis | Tiket | Deskripsi | Diharapkan |
|---|---|---|---|---|
| TP-01 | WB | PHY-02 | LST melintasi tengah malam | Median aman terhadap wraparound |
| TP-02 | WB | PHY-01 | R(F) sintetis yang mendatar di F tertentu | F\* terpilih tepat; `None` bila tidak ada |
| TP-03 | WB | PHY-03 | Model diurnal | f(t) maksimum di h; R_pred = 1 bila LST sama |
| TP-04 | WB | TRI-01..03 | Badge A/B/C | Tiga seri sepakat → A; dua → B; tidak → C; data hilang → None |
| TP-05 | WB | TRI-04 | Kelas observabilitas | Batas 0,3 dan 0,6 sesuai spesifikasi |
| TP-06 | WB | DEC-02 | Estimator Laplace | (k+1)/(n+2) benar untuk n kecil |
| TP-07 | WB | DEC-03 | Backtest LOYO | Tahun uji tidak ikut menentukan p90 dan peluang |
| TP-08 | L2 | DEC-01 | Peluang peringkat | Σ P(top-K) seluruh unit = K |

### 5.5 Ekspor (`pipeline/export/`)

| ID | Jenis | Tiket | Deskripsi | Diharapkan |
|---|---|---|---|---|
| TE-01 | BB | EXP-01 | Bundle | `index.json` + `monthly_<aoi>.json` sesuai skema frontend; `harmonized: false` bila sains belum tersedia (tidak ada nilai karangan) |
| TE-02 | BB | EXP-02 | CSV agregat | Header komentar lengkap (versi data, filter, baseline, kalibrasi, sitasi, lisensi, pengakuan AI); kolom sesuai 08 §7.9.3 |
| TE-03 | BB | EXP-02 | CSV titik deteksi untuk bbox | Semua titik di dalam bbox dan rentang tanggal |
| TE-04 | BB | EXP-01 | Ukuran file browser | Tiap file grid per tahun cukup kecil untuk dimuat (<~2 MB target) |

### 5.6 Brief & AI (`api/brief/`, `eval/`)

| ID | Jenis | Tiket | Deskripsi | Diharapkan |
|---|---|---|---|---|
| TB-01 | WB | AI-01 | Fact table | Setiap angka punya `evidence_id` |
| TB-02 | WB | AI-04 | Aturan penjelas | Hujan <4 mm/hari + ONI ≥0,5 memicu kalimat El Niño + sitasi; tidak ada kata "disebabkan oleh" |
| TB-03 | WB | AI-02 | Format angka | id: `12.345`, `3,1×`; en: `12,345`, `3.1×` |
| TB-04 | WB | AI-03 | Verifier | Teks template → 0 angka tak terlacak; teks dimanipulasi → tertangkap |
| TB-05 | BB | AI-02 | `python -m api.brief record.json --locale id --format html` | Exit 0; HTML valid; tanpa logo NASA; catatan kaki evidence ID ada |
| TB-06 | BB | AI-05 | `eval/brief_eval.py` | `eval/report.md` menunjukkan 0 angka tak terlacak |
| TB-07 | BB | AI-03 | LLM tanpa kunci API | Fallback ke template tanpa error |

### 5.7 Frontend (`app/`) — E2E black-box (Playwright)

| ID | Tiket | Skenario | Diharapkan |
|---|---|---|---|
| TW-01 | FE-01 | Buka halaman utama | Tidak ada error konsol; judul "Second Sight" |
| TW-02 | FE-01 | Klik ketujuh tab | Setiap tab menampilkan kontennya; URL berubah |
| TW-03 | FE-01 | Ganti bahasa ID ↔ EN | Label berubah; format angka berubah (titik/koma) |
| TW-04 | FE-02 | Peta | Canvas MapLibre tampil; atribusi OpenStreetMap terlihat |
| TW-05 | FE-03 | Muat ulang dengan URL berparameter | AOI, bulan, mode, tab, bahasa sama seperti sebelum reload |
| TW-06 | FE-04 | Kalender | 26 baris tahun × 12 kolom bulan + kolom total + baris median; angka terlihat |
| TW-07 | FE-04 | Keyboard | Panah memindah fokus sel; PageUp/PageDown pindah tahun; Enter memilih |
| TW-08 | FE-05 | Lima keadaan sel | Sel nol, sebagian, tidak teramati, provisional punya tampilan berbeda (cek kelas/atribut) |
| TW-09 | FE-05 | Era sensor | Label pill di antara 2011 dan 2012 terlihat |
| TW-10 | FE-04 | Data contoh | Badge "DATA CONTOH" muncul bila memakai demo data; hilang dengan data nyata |
| TW-11 | FE-07 | Toggle raw → harmonisasi | Warna sel berubah; `prefers-reduced-motion` mematikan animasi |
| TW-12 | FE-08 | Tooltip | Hover/fokus sel menampilkan nilai, interval, rasio, peringkat, sensor |
| TW-13 | FE-09 | AOI | Preset, gambar, bbox, titik + radius menghasilkan AOI; input lat/lon tidak valid ditolak |
| TW-14 | FE-16 | Unduh | File CSV/PNG terunduh dan tidak kosong |
| TW-15 | FE-18 | Mobile 375×812 | Tidak ada scroll horizontal halaman; kalender bisa digeser di wadahnya |
| TW-16 | — | Kepatuhan | Tidak ada gambar logo NASA; tidak ada teks rahasia/kunci di bundle JS |

Skenario fitur yang belum dibangun ditandai **skip dengan ID tiket**, bukan dihapus.

---

## 6. Uji validasi ilmiah (L6)

Dijalankan oleh `pipeline/run/validate_all.py` pada data nyata. Aturan lulus/gagal **hanya** dari `docs/validation_plan.md`.

| Uji | Isi | Output |
|---|---|---|
| V1, V2 | LOYO, LORO | MdAPE, Spearman, bias |
| V3 | Seam test 5 sambungan + placebo | Δ_seam, Pettitt p |
| V4 | Drift berbasis fisika | slope, r R_obs vs R_pred |
| V5 | MODIS sunset | KGE |
| V6 | SiPongi | Spearman (deskriptif bila tahun sedikit) |
| V7 | Sensitivitas | Perubahan kelas anomali 2026 |
| V8 | Field 2016 | Parameter kurva sebelum/sesudah 2012 |
| V9 | Hipotesis gambut | H1-H3 diterima/ditolak |
| V10, V12 | Flag anomali, ranking ENSO | F1, Cohen's κ, Spearman |
| V11 | Backtest kesiagaan | Hit/miss/alarm palsu |
| V13, V14 | Observabilitas, triangulasi | ρ per kelas O, proporsi A/B/C per era |
| Ablation | M0-M8 | Tabel di `docs/validation_report.md` |

**Aturan:** setiap uji wajib punya status (`passed: true/false` atau `not_run` + alasan). Uji yang gagal tetap ditampilkan di aplikasi (panel "Seberapa yakin kami").

---

## 7. Uji non-fungsional (L7)

| Aspek | Uji | Ambang | Alat |
|---|---|---|---|
| Kinerja | Waktu render kalender preset | <500 ms | Playwright `performance` |
| Kinerja | AOI gambar setingkat provinsi | <5 detik | Playwright |
| Kinerja | Halaman awal | <3 detik (lokal) | Lighthouse / Playwright |
| Aksesibilitas | Pelanggaran WCAG otomatis | 0 kritis | axe-core (`@axe-core/playwright`) |
| Aksesibilitas | Kontras teks | ≥4,5:1 | axe-core |
| Aksesibilitas | Buta warna | Lima keadaan sel tetap terbedakan | Emulasi `vision deficiency` Chromium DevTools / screenshot grayscale |
| Keamanan | Rahasia di repo/bundle | Tidak ada `MAP_KEY`, kunci API, token | `git grep` pola kunci; grep pada `dist/` |
| Keamanan | Data besar ter-commit | Tidak ada `.parquet`/CSV besar di git | `git ls-files` |
| Kompatibilitas | Chromium, Firefox (opsional), mobile emulasi | Fungsi P0 jalan | Playwright projects |
| Kepatuhan | Logo NASA, data contoh, atribusi | Lihat §8 | Manual + E2E TW-10, TW-16 |
| Reproducibility | Pipeline dari nol | Output identik (hash agregat sama) | Jalankan ulang + bandingkan hash |

---

## 8. Checklist kepatuhan (cek sebelum submit)

- [ ] Tidak ada commit kode sebelum 14 Nov 09:00 WIB.
- [ ] Tidak ada baris Co-Authored-By/atribusi AI di pesan commit (sesuai permintaan tim); pengakuan penggunaan AI tetap ada di `docs/ai_acknowledgement.md` dan project page (aturan Space Apps).
- [ ] `THIRD_PARTY_LICENSES/` lengkap; header atribusi ada di setiap file adaptasi.
- [ ] Tidak ada data contoh tanpa label "DATA CONTOH"/SYNTHETIC di aplikasi dan dokumen.
- [ ] Tidak ada logo/branding NASA.
- [ ] Video ≤30 detik; slide ≤7; semua bahasa Inggris (subtitle bila perlu).
- [ ] Link publik dibuka dari browser incognito tanpa login.

---

## 9. Konsistensi angka lintas artefak (SUB-07)

1. Buat daftar semua angka yang dipakai di video, slide, project page, README, dan layar utama aplikasi.
2. Untuk setiap angka, catat `evidence_id` atau path file pipeline + kunci.
3. Dua orang mencocokkan secara independen.
4. Angka yang tidak bisa dilacak **dihapus** dari materi.

---

## 10. Klasifikasi bug

| Tingkat | Definisi | Contoh | Tindakan |
|---|---|---|---|
| **Kritis** | Merusak kebenaran hasil atau kepatuhan | Angka harmonisasi salah era; rahasia di repo; data contoh tampil sebagai hasil | Hentikan rilis; perbaiki segera |
| **Tinggi** | Fitur P0 tidak berfungsi | Kalender tidak render; CSV kosong | Perbaiki sebelum submit |
| **Sedang** | Fitur P1 bermasalah atau UX buruk | Tooltip salah format; mobile berantakan | Perbaiki bila waktu cukup |
| **Rendah** | Kosmetik | Spasi, ejaan | Catat |

Setiap bug ditulis di `docs/test_report.md` dengan: ID, tingkat, file:baris, langkah reproduksi, hasil diharapkan vs aktual, tiket terkait.

---

## 11. Jadwal eksekusi

| Kapan | Uji | Catatan |
|---|---|---|
| Setiap merge ke `main` | L1-L2 (pytest cepat) | `bash scripts/test_all.sh --fast` |
| Setelah pipeline data nyata berjalan | L3 integrasi + L6 validasi | Runner validasi |
| Setelah frontend tersambung data nyata | L5 E2E + L7 | Playwright + axe |
| H2 18:00 (freeze) | Semua suite + checklist §8 + konsistensi angka §9 | Wajib sebelum rekam video |
| Sebelum submit (≤21:30) | Smoke test link publik + TW-01..06 | Dari perangkat lain |
| Sebelum pitch 21 Nov | E2E penuh + latihan demo offline | Bundle offline |

---

## 12. Peran

| Peran | Tanggung jawab uji |
|---|---|
| Pemilik modul (R1-R4, R6) | Menulis tes unit untuk kode sendiri; memperbaiki bug modulnya |
| QA (agent QA / anggota yang ditunjuk) | Invariant, integrasi, CLI black-box, E2E, non-fungsional, laporan |
| R3 | Validasi ilmiah L6, menjaga aturan pra-registrasi |
| R5 | UAT, checklist kepatuhan, konsistensi angka |

---

## 13. Matriks keterlacakan (ringkas)

| Epic | Tiket P0 | Kasus uji |
|---|---|---|
| SET | SET-01..05 | §8 kepatuhan, TD-11 |
| DAT | DAT-01..09 | TD-01..11, TS-01..05 |
| CAL | CAL-01..05 | TC-01..07 |
| ANO | ANO-01..02 | TC-08..09 |
| VAL | VAL-01..04, VAL-09 | TC-10..11, §6 |
| EXP | EXP-01..02 | TE-01..04 |
| FE | FE-01..09, 12, 15, 16 | TW-01..16 |
| SUB | SUB-02..08 | §8, §9 |
| P1/P2 | PHY, TRI, DEC, AI, CAL-06 | TP-01..08, TB-01..07, TC-12 |
