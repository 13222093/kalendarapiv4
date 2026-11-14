# 11 · Tiket Implementasi Second Sight

> Backlog siap kerja untuk hackathon **14 Nov 09:00 WIB - 15 Nov 23:59 WIB**.
> Sumber: [08](08-blueprint-ide-dan-opsi-konsep.md) (PRD), [09](09-second-sight-v2-upgrade-pipeline-dan-posisi.md) (upgrade v2 + pipeline 16 stage), [10](10-ui-ux-second-sight.md) (UI/UX).
> Setiap tiket bisa dikerjakan dan di-review sendiri, dengan kriteria selesai yang bisa dicek.

---

## Status tracker

> **Diperbarui:** 14 Nov 2026 09:25 WIB · commit `main` terakhir: `7705651`
> **Legenda:**
> - ✅ Done: di-commit dan di-merge ke `main`.
> - 🟡 Progres: sedang dikerjakan agent, atau kode sudah jadi tetapi belum dijalankan pada data nyata.
> - ⬜ Belum.
> - ⛔ Terblokir.
>
> Status "Done" berarti kriteria selesai diklaim terpenuhi oleh pengerjaan (berdasarkan tes yang dijalankan). Review manusia dan uji QA keseluruhan masih menyusul ([12-rancangan-testing.md](12-rancangan-testing.md)).

### Pembaruan 09:55 WIB (penutupan sesi, commit `main`: `ecd0e1f`)

- **UI dipoles 4 agent** mengikuti dok 10 + audit visual pesaing:
  - Sebelum vs sesudah: indeks 2003-2011 = 100, judul temuan per wilayah, preset cerita dipetakan ke provinsi.
  - Kalender: penuh lebar, bulan 2026 provisional, legenda swatch ramp, ramp dipotong sebelum ungu tua.
  - Bulan ini, Seberapa yakin (badge lulus/gagal, tabel seam 2012), Unduh (cara mengutip).
  - Tab yang belum jadi disembunyikan.
  - Mode gelap.
  - Halaman styleguide di app (`/styleguide.html`).
- **Bug QA diperbaiki:** B2 (CRLF skrip), B3 (ENSO di pandas 3), B4 (Pillow), B5 (versi data CSV).
- **Bug QA terbuka:**
  - **B9:** alias provinsi di agen analis; 2 tes agen gagal.
  - **B1:** `khg_id` kosong, butuh shapefile KHG.
  - 1 tes konsistensi data lokal.
- **pytest: 202 lulus, 3 gagal, 1 xfail.** E2E Playwright terakhir (09:39): 16 lulus.
- **Deploy:** https://second-sight-alpha.vercel.app (publik). Styleguide: https://second-sight-alpha.vercel.app/styleguide.html.
- **Belum dikerjakan:** SUB-04/05 slide dan video (ditunda tim), PG-03 tag rilis, DAT-10 data awan (butuh SFTP manual), FE-10/11/13/14/17/19-21 (sebagian dibekukan oleh audit).

### Pembaruan 09:46 WIB (commit `main`: `a99eaec`)

**Ringkasan: 68 dari 94 tiket asli ✅ (72%) · P0: 42 dari 47 ✅ (89%) · tiket audit: 8 dari 10 ✅ · total 76 dari 104 (73%)**

| Perubahan sejak 09:25 | Status |
|---|---|
| DAT-02 (NRT 2026 via mirror firms-catalog, 1,92 jt deteksi), DAT-03 (label gambut + provinsi + kabupaten, 99,3% sel berlabel), DAT-05, DAT-11 (CHIRPS 34 provinsi) | ✅ |
| DAT-10 (awan CMG) | 🟡 parser jadi; file HDF belum diunduh (butuh SFTP manual + pyhdf) |
| CAL-05 (AOI kustom; cek agregasi provinsi → wilayah selisih 0) | ✅ |
| VAL-04 (ablation), VAL-06 (SiPongi, deskriptif), VAL-07 (parsial), VAL-08 (Field 2016: nasional & Kalimantan lulus via klausul cadangan, Sumatra gagal), VAL-09 (gambut: H1 ditolak, H2 diterima, H3 ditolak), VAL-10, VAL-11 (backtest hit rate 0,39), VAL-12 | ✅ |
| VAL-05b (drift V4) | ✅ lulus bersyarat (parameter diurnal [UNVERIFIED]); gagal pada run strata gambut |
| PHY-01..03 run data nyata (drift Aqua +69 mnt, Terra −73 mnt pada 2025; F\* pra-registrasi tidak ditemukan) | ✅ |
| EXP-01 v2 (40 AOI: nasional, 5 pulau, 34 provinsi; seri sampai 2026-11 berlabel NRT/partial), EXP-02, EXP-05 | ✅ |
| FE-06 (data nyata), FE-09 (panel wilayah 5 mode), FE-12, FE-15, FE-16 | ✅ fungsi · 🟡 **poles UI sedang dikerjakan 3 agent** (mengikuti dok 10 + audit visual pesaing) |
| AI-06 (agen analis + trace ala Wasit, eval 43 pertanyaan) | ✅ kode · **2 tes gagal** setelah bundle punya 34 provinsi (alias "sumatera selatan" kini cocok ke provinsi, akurasi rencana turun 100% → 78%); perlu update tes/alias |
| FND-01 (F1 audit ditolak; headline F2), FND-03 (layar Sebelum vs sesudah), FND-04 (tren turun di 6/6 wilayah; nasional −4,3%/tahun [−8,7; −1,5], p=0,004), FND-05, FND-06 | ✅ |
| PG-01 (README + draf project page) | ✅ |
| PG-02 (deploy publik) | ✅ **https://second-sight-alpha.vercel.app** (proteksi Vercel dimatikan) |
| PG-03 (tag rilis) | ⬜ akhir 15 Nov |
| SUB-04, SUB-05 (slide, video) | ⏸ ditunda atas permintaan tim |
| Uji keseluruhan | 🟡 pytest: **167 lulus, 2 gagal** (tes agen, lihat AI-06). E2E Playwright oleh agent QA |

---

**Ringkasan lama (09:25): 52 dari 94 tiket ✅ (55%) · P0: 33 dari 47 ✅ (70%)**

| Epic | Tiket | Status | Catatan |
|---|---|---|---|
| SET | SET-01, SET-02, SET-03, SET-04, SET-05, SET-06 | ✅ ×6 | SET-05 (pra-registrasi) di-commit sebelum hasil validasi |
| DAT | DAT-01, 02, 03, 04, 05, 06, 07, 08, 09, 11 | ✅ ×10 | 6,36 jt deteksi 2000-2025 + 1,92 jt 2026 (SP/NRT via mirror). NOAA-21 hanya ada di NRT |
| DAT | DAT-10 (awan CMG) | 🟡 | Agent data pendukung |
| PHY | PHY-01, PHY-02, PHY-03 | ✅ kode · 🟡 run data nyata | Agent fisika-run menghitung F\*, drift, R_pred |
| PHY | PHY-04, PHY-05 (operator Sofiev) | ⬜ | P2 |
| CAL | CAL-01, 02, 03, 04, 06 | ✅ ×5 | Run provisional pada data nyata: 20 strata κ ∈ (0,1); faktor NOAA20→SNPP ≈0,95-1,00 |
| CAL | CAL-05 (AOI kustom) | ⬜ | |
| TRI | TRI-01, 02, 03, 04 | ✅ kode · 🟡 run | |
| ANO | ANO-01, 02, 03 | ✅ ×3 | Data resmi: 2015 satu-satunya El Niño di 2012-2021 (2019 tidak lolos ambang ONI) |
| VAL | VAL-01, 02, 03 | ✅ kode · hasil provisional | LOYO lulus; LORO, seam 2022-01, dan sunset **gagal** pada run awal (dilaporkan apa adanya) |
| VAL | VAL-09 (gambut) | ✅ kode · ⛔ run | Menunggu label gambut di-join ke data |
| VAL | VAL-04, 06, 07, 10, 12 | 🟡 | Agent integrasi validasi |
| VAL | VAL-05 (drift) | 🟡 | Agent fisika-run |
| VAL | VAL-08, 11, 13 | ⬜ | |
| DEC | DEC-01, 02, 03 | ✅ kode · 🟡 run | |
| EXP | EXP-01, EXP-02 | 🟡 | Agent ekspor |
| EXP | EXP-05 | 🟡 | Agent integrasi |
| EXP | EXP-03, EXP-04 | ⬜ | |
| FE | FE-01, 02, 03, 04, 05, 07, 08 | ✅ ×7 | Masih memakai data contoh berlabel |
| FE | FE-06 | ⛔ | Menunggu bundle data nyata (EXP-01) |
| FE | FE-09, 12, 15, 16 | 🟡 | Agent frontend ronde 2 |
| FE | FE-10, 11, 13, 14, 17, 18, 19, 20, 21 | ⬜ | |
| AI | AI-01, 02, 03, 04, 05 | ✅ ×5 | 41 tes lulus; eval: 0 angka tak terlacak; PDF butuh GTK (pakai HTML → print) |
| AI | AI-06 | ⬜ | P2 |
| EXT | EXT-01, EXT-02 | ⬜ | P2 |
| SUB | SUB-02, SUB-03 | ✅ ×2 | README dan limitations masih kerangka; diisi hasil akhir nanti |
| SUB | SUB-01, 04, 05, 06, 07, 08, 09 | ⬜ | Butuh tim (wawancara, video, slide, project page, submit) |
| QA | Rancangan testing | ✅ | `docs/12-rancangan-testing.md` |
| QA | Eksekusi uji white-box + black-box + E2E | 🟡 | Agent QA, laporan di `docs/test_report.md` |

**Temuan penting dari pengerjaan (perlu keputusan tim):**
1. Uji seam dengan referensi Aqua-only bersifat degeneratif di era Aqua (Δ = 0 menurut konstruksi). Uji seam yang bermakna di 2012 butuh referensi independen (MCD64A1). Detail ada di `docs/methodology.md`.
2. Kalibrasi M3 gagal di LORO (Jawa-NT-Bali-Maluku, Sulawesi, Kalimantan) dan di sunset backtest, sehingga strata perlu ditinjau setelah label gambut dan provinsi tersedia.
3. Kotak `island_region` masih perkiraan: Kepulauan Aru dan Kei masuk Papua.
4. Grid 0,05° nasional 9 MB, jadi perlu dipecah per tahun untuk browser.

### Tiket tambahan dari audit produk ([13-audit-produk.md](13-audit-produk.md), 14 Nov 09:35)

Audit menunjukkan bahwa mesin sains sudah kuat, tetapi framing masih "platform komprehensif", pola yang pada 2025 berhenti di nominee. Tiket di bawah **naik prioritasnya di atas tiket FE/AI lanjutan**. Tujuannya satu temuan ilmiah tentang Indonesia yang bisa dinilai juri hanya dari project page (pola SpaceGenes+, kategori Best Use of Science).

| ID | Prioritas | Pekerjaan | Pemilik | Jam | Status |
|---|---|---|---|---|---|
| **FND-01** | **P0** | Hitung resmi temuan lewat pipeline → `derived/finding.json` + `docs/finding.md` | R2 | 2 | ✅ F1 audit **ditolak** (tidak didukung); headline = F2 tren terbalik (+1.740 → −1.614 sel-hari/tahun) |
| **FND-02** | **P0** | AOI provinsi bernama (Riau, Kalimantan Tengah, Sumatera Selatan, Jambi, Kalimantan Barat) + musim 2026 (NRT, berlabel provisional) di bundle; ulangi F1 per provinsi | R1 | 2-3 | 🟡 agent berjalan |
| **FND-03** | **P0** | Satu layar **"Before vs after"**: seri naif vs dijumlahkan vs adil 2003-2026 + kalimat temuan + satu angka validasi. Layar ini menjadi pembuka aplikasi dan video (menggantikan FE-12 sebagai sorotan) | R4 | 2-3 | ⬜ |
| **FND-04** | P1 | Uji tren F2 yang kokoh: Theil-Sen + Mann-Kendall, beberapa jendela (2001-05 vs 2021-25), sensitivitas M1/M2/M3; tanpa klaim penyebab (moratorium/BRG tidak diuji) | R2 | 1,5 | ⬜ |
| **FND-05** | P1 | Tulis temuan gambut apa adanya (VAL-09 sudah jalan): H1 **ditolak** (di malam hari keunggulan VIIRS justru **lebih kecil** di gambut: ρ 7,9 vs 13,7), H2 **diterima** (ρ malam ≈ 2× siang di gambut), H3 ditolak (arah terbalik, n El Niño = 1). Masukkan ke project page sebagai temuan pendukung | R3 + R5 | 1 | ⬜ |
| **FND-06** | P1 | Rerun kalibrasi utama dengan `monthly_stratum_labeled` (strata gambut nyata), lalu perbarui `validation_results.json` dan ablation | R2 | 1 | ⬜ |
| **VAL-05b** | P1 | Sambungkan `physics_summary.json` ke runner validasi supaya V4 (drift) dinilai dengan aturan pra-registrasi; parameter diurnal tetap ditandai [UNVERIFIED] | R3 | 1 | ⬜ |
| **PG-01** | **P0** | README + draft project page dibuka dengan pertanyaan, tempat, pengguna, lalu temuan, dataset persis, diagram metode, tabel validasi **termasuk yang gagal**, keterbatasan, pernyataan AI, sitasi. Tanpa kata "platform/monitoring/predict" | R5 | 3 | 🟡 agent berjalan |
| **PG-02** | **P0** | Deploy statis publik (GitHub/Cloudflare Pages, tanpa backend, tanpa kunci) yang hidup sampai Jan 2027 | R4 | 1-2 | ⬜ (butuh persetujuan tim: publikasi) |
| **PG-03** | **P0** | Tag rilis `submission-2026-11-15` di commit final sebelum 23:59 WIB 15 Nov | R5 | 0,1 | ⬜ |

**Perubahan prioritas tiket lama (scope cut untuk mencegah "platform sprawl"):**

| Tiket | Keputusan | Alasan |
|---|---|---|
| FE-06 | **Naik ke P0, blokir dicabut** | Bundle nyata sudah ada |
| FE-12 (Bulan ini), FE-13 (Kenapa?) | Turun ke P2 | Fitur standar pesaing; diganti FND-03. Yang sudah dibangun dibiarkan, tidak ditonjolkan |
| FE-15 (Seberapa yakin) | Tetap, **disederhanakan** menjadi satu panel validasi | Validasi adalah pembeda |
| FE-19, DEC-02/03 di UI | Turun ke P2; istilah "kalender kesiagaan" diganti "frekuensi historis pada kondisi ENSO serupa" | Mendekati klaim prediksi; backtest hit rate 0,39 |
| AI-06 (agen analis) | Kode boleh selesai, **tidak ditampilkan di headline/video** (maks. satu baris di page) | AI bukan pembeda pemenang 2025; pesaing Indonesia sudah punya WhatsApp/PDF |
| FE-20, FE-21, PHY-04, PHY-05 | Dibekukan | Modul tambahan tanpa bukti |
| EXT-01, EXT-02 | Dibekukan | Mengaburkan fokus Indonesia |
| CAL-05 penuh (AOI bebas) | Diganti AOI provinsi tetap (FND-02); AOI gambar tetap ada di UI untuk memenuhi challenge | Fokus |
| Analisis konsesi/putusan pengadilan | **Tidak dikerjakan** | Sensitif hukum |

---

## 0. Cara memakai

### 0.1 Format tiket

```
### <ID> · <Judul>
Prioritas · Pemilik · Estimasi · Bergantung pada · Rujukan
Tujuan: satu kalimat.
Kerjakan: langkah inti.
Selesai jika: checklist yang bisa dicek.
Output: file/artefak.
```

- **Prioritas:**
  - **P0** = wajib ada saat submit.
  - **P1** = pembeda utama, dikejar setelah P0 aman.
  - **P2** = penguat, dikerjakan hanya jika ada waktu.
- **Pemilik (peran dari 08 §9.1):**

  | Peran | Bidang |
  |---|---|
  | R1 | Data engineer |
  | R2 | Scientist harmonisasi |
  | R3 | Scientist fisika & validasi |
  | R4 | Frontend |
  | R5 | Produk & story |
  | R6 | AI & transfer (opsional) |

- **Estimasi:** jam kerja satu orang.
- **Rujukan:** bagian dokumen yang menjelaskan "kenapa" dan "bagaimana".

### 0.2 Aturan kerja

1. **Satu tiket = satu branch/commit (atau satu PR kecil).** Pesan commit diawali ID tiket, mis. `DAT-03: snap detections to 0.01° grid`. Riwayat commit sekaligus menjadi bukti bahwa semua dibangun selama hackathon.
2. **Tidak ada commit sebelum 14 Nov 09:00 WIB.**
3. **Angka di UI hanya boleh berasal dari file hasil pipeline.** Tidak ada angka diketik manual.
4. **Data dummy wajib berlabel jelas** ("DATA CONTOH") dan dihapus sebelum freeze.
5. **Kode yang dibantu AI ditandai** (komentar header + `docs/ai_acknowledgement.md`).
6. **Kode adaptasi dari repo lain** wajib header atribusi + lisensi di `THIRD_PARTY_LICENSES/` (10 §5.4).
7. Jika sebuah quality gate gagal: catat di tiket, ikuti fallback, jangan lanjut diam-diam.

### 0.3 Status board (salin ke GitHub Projects / Notion / Trello)

Kolom yang disarankan: `Backlog → Ready → In progress → Review → Done`, dengan label `P0/P1/P2`, `R1-R6`, `blocked`.

---

## 1. Ringkasan backlog

| Epic | Kode | Isi | Jumlah tiket | P0 | P1 | P2 |
|---|---|---|---|---|---|---|
| Setup & kepatuhan | SET | Repo, lisensi, struktur, pra-registrasi | 6 | 5 | 1 | 0 |
| Data & kesehatan data | DAT | Akuisisi, manifest, pembersihan, cell-days, agregasi, awan, iklim | 11 | 9 | 2 | 0 |
| Fisika | PHY | FRP floor, jam lintas/drift, operator Sofiev | 5 | 0 | 3 | 2 |
| Kalibrasi & seri | CAL | κ statis, rantai satelit, seri H, AOI kustom, κ dinamis | 6 | 5 | 1 | 0 |
| Triangulasi & observabilitas | TRI | H_large, H_energy, badge A/B/C, indeks O | 4 | 0 | 4 | 0 |
| Baseline & anomali | ANO | Median, persentil, ENSO, analog | 3 | 2 | 1 | 0 |
| Validasi | VAL | V1-V17 + ablation + validasi hidup | 13 | 5 | 7 | 1 |
| Keputusan | DEC | Peluang peringkat KHG, kalender kesiagaan, backtest | 3 | 0 | 3 | 0 |
| Ekspor & publikasi | EXP | Bundle statis, CSV, evidence ledger, dataset terbuka, notebook | 5 | 2 | 3 | 0 |
| Frontend | FE | Kerangka, peta, AOI, kalender, layar, unduh, mobile | 21 | 12 | 7 | 2 |
| Brief & AI | AI | Fact table, brief, verifier, eval, NL query | 6 | 0 | 5 | 1 |
| Transfer & ekstra | EXT | Uji transfer Amazon, repeat-burn | 2 | 0 | 0 | 2 |
| Story & submission | SUB | Wawancara, README, metodologi, slide, video, project page, QA, submit, pitch | 9 | 7 | 2 | 0 |
| **Total** | | | **94** | **47** | **39** | **8** |

Estimasi kasar: P0 ≈ 95-105 jam kerja, P1 ≈ 75-85 jam, P2 ≈ 25 jam. Dengan 5-6 orang × ~36 jam efektif (≈180-215 jam), **P0 + P1 muat jika tidak ada hambatan besar**; P2 hampir pasti terpotong.

---

## 2. Jalur kritis

Jika salah satu tiket berikut terlambat, demo P0 terlambat. Prioritaskan review dan bantuan ke sini.

```
SET-01 ─► DAT-01 ─► DAT-04 ─► DAT-06 ─► DAT-07 ─► DAT-08 ─► CAL-01 ─► CAL-04 ─► CAL-05 ─► ANO-01 ─► EXP-01 ─► FE-06 ─► FE-07
                                                                                      │
SET-05 (pra-registrasi) ─────────────────────────────────────────────► VAL-01..03 ─────┴─► FE-12 ─► SUB-05 ─► SUB-08
FE-01 ─► FE-02 ─► FE-04 (paralel dengan jalur data, memakai data dummy berlabel)
```

**Checkpoint wajib:**

| Waktu (WIB) | Checkpoint | Isi |
|---|---|---|
| 14 Nov 10:00 | **K0** | Konsep, peran, wilayah fokus terkunci; repo dibuat (SET-01..03) |
| 14 Nov 17:00 | **K1** | Data mentah lengkap + `daily_cell` jadi (DAT-01..07) |
| 14 Nov 24:00 | **K2** | **Demo P0 end-to-end**: kalender harmonisasi nyata untuk 1 AOI, toggle raw/harmonisasi, LOYO + seam test awal |
| 15 Nov 10:00 | **K3** | P1 sains (CAL-06, PHY-02, TRI, VAL-06/08/09) + layar Bulan Ini |
| 15 Nov 14:00 | **K4** | Semua layar ada; brief jalan; validasi final |
| 15 Nov 18:00 | **K5** | **Freeze fitur**; mulai video & project page |
| 15 Nov 21:30 | **K6** | **Submit lengkap pertama** |
| 15 Nov 23:30 | **K7** | Resubmit terakhir (batas aman) |

---

## 3. Epic SET · Setup & kepatuhan

### SET-01 · Buat repo dan struktur folder
P0 · R5 (+semua) · 0,5 jam · — · 08 §7.10
- **Tujuan:** repo publik dengan struktur yang disepakati, dibuat setelah 09:00.
- **Kerjakan:** buat repo `second-sight` dengan folder `pipeline/`, `app/`, `api/`, `eval/`, `docs/`, `notebooks/`, `data/sample/`, `THIRD_PARTY_LICENSES/`; tambah `.gitignore` (data besar, `.env`).
- **Selesai jika:**
  - [ ] Commit pertama bertimestamp ≥ 14 Nov 09:00 WIB.
  - [ ] Semua anggota punya akses tulis.
  - [ ] `.env` dan file data besar di-ignore.
- **Output:** repo + `README.md` kerangka.

### SET-02 · Lisensi, atribusi, dan pengakuan AI
P0 · R5 · 0,5 jam · SET-01 · 08 §3H, 10 §5.4
- **Kerjakan:**
  - Pilih lisensi repo (MIT/Apache-2.0; GPL-3.0 hanya jika memakai kode FRP_OOp).
  - Salin lisensi fire-harmony, project-shift, firms-catalog (Apache-2.0), burn-calendar, flare-chronos (MIT) ke `THIRD_PARTY_LICENSES/`.
  - Buat `docs/ai_acknowledgement.md`.
- **Selesai jika:**
  - [ ] `LICENSE` ada.
  - [ ] 5 file lisensi pihak ketiga ada.
  - [ ] Template header atribusi tertulis di `docs/CONTRIBUTING.md`.
  - [ ] Bukti tertulis konfirmasi CP soal AI tersimpan (screenshot di folder tim, **bukan** di repo publik).

### SET-03 · Kickoff: kunci keputusan
P0 · R5 (+semua) · 1 jam · — · 08 §6, 09 §1
- **Kerjakan:** konfirmasi nama (Second Sight), pengguna utama, wilayah fokus (Kalteng + Riau), wilayah transfer (Amazon barat), satu momen sains untuk video, peran R1-R6, jalur komunikasi.
- **Selesai jika:**
  - [ ] Keputusan tertulis di `docs/decisions.md`.
  - [ ] Tes 30 detik (08 §6.3) lulus: jawaban semua anggota mirip.

### SET-04 · Lingkungan kerja & konvensi
P0 · R1 · 1 jam · SET-01
- **Kerjakan:** environment Python (uv/conda: pandas, pyarrow, duckdb, numpy, scipy, statsmodels, ruptures, pymannkendall, geopandas/shapely), Node (Vite + TS), perintah build per tahap (`make data`, `make model`, `make validate`, `make site` atau skrip setara), pre-commit sederhana (format + cek rahasia).
- **Selesai jika:**
  - [ ] Semua anggota bisa menjalankan `make help` (atau setara).
  - [ ] CI sederhana (opsional) menjalankan lint.

### SET-05 · Pra-registrasi rencana validasi (S0)
P0 · R3 · 1 jam · SET-03 · 09 §3.2 S0, 09 §5.1
- **Tujuan:** aturan uji ditulis **sebelum** hasil dilihat.
- **Kerjakan:** tulis `docs/validation_plan.md`:
  - Hipotesis: H1-H3 gambut, β1 > 0, drift.
  - Metrik dan aturan lulus untuk V1-V17.
  - Ambang dan parameter: F\*, N mask statis, kelas ENSO.
- **Selesai jika:**
  - [ ] Di-commit **sebelum** commit hasil validasi pertama (cek timestamp).
  - [ ] Setiap uji punya metrik + aturan keputusan.

### SET-06 · Rencana desain UI (sebelum coding UI)
P1 · R4 · 1 jam · SET-03 · 10 §4, §7
- **Kerjakan:** `docs/design.md` berisi token warna bernama, 2 font + perannya, wireframe ASCII layar utama, jawaban "apakah ini default yang akan muncul untuk brief serupa?".
- **Selesai jika:**
  - [ ] Token di 10 §4.2 dikonfirmasi atau direvisi.
  - [ ] Kontras teks ≥4,5:1 dicek.

---

## 4. Epic DAT · Data & kesehatan data

### DAT-01 · Akuisisi arsip FIRMS SP 2000-2025 (Indonesia)
P0 · R1 · 3 jam · SET-04 · 05 §6, 08 D1
- **Kerjakan:**
  - Unduh CSV tahunan per negara: MODIS 2000-2025, VIIRS S-NPP 2012-2025, NOAA-20 2018-2025 (dan NOAA-21 jika tersedia via Archive Download).
  - Cadangan: query bbox Indonesia di mirror `portolan-mirrors/firms-catalog` (GeoParquet, DuckDB).
  - Konversi ke Parquet berpartisi `satellite/year`.
- **Selesai jika:**
  - [ ] Semua tahun-sensor ada.
  - [ ] Tabel jumlah baris per tahun-satelit tersimpan.
  - [ ] Tidak ada tahun kosong yang tak terduga.
  - [ ] Tiga bulan acak dicocokkan antara CSV resmi dan mirror (jika memakai mirror).
- **Output:** `data/raw/*.parquet`.

### DAT-02 · Akuisisi NRT 2026 (Jan-Nov)
P0 · R1 · 2 jam · SET-04 · 05 §6
- **Kerjakan:** FIRMS API area bbox Indonesia, `DAY_RANGE ≤ 5`, sumber `MODIS_NRT`, `VIIRS_SNPP_NRT` (s.d. 2 Nov), `VIIRS_NOAA20_NRT`, `VIIRS_NOAA21_NRT`; kolom `quality = NRT`. MAP_KEY di `.env`.
- **Selesai jika:**
  - [ ] Seluruh 2026 sampai tanggal unduh tercakup.
  - [ ] Kuota API tidak terlampaui.
  - [ ] Tidak ada kunci di repo.

### DAT-03 · Data pendukung
P0 · R1 (+R2) · 2 jam · SET-04 · 08 §3A
- **Kerjakan:**
  - Peta gambut (BBSDLP; fallback PEATMAP).
  - Batas provinsi/kabupaten (geoBoundaries/BIG; **bukan** file ODbL dari project-shift).
  - KHG (jika tersedia; fallback digitasi indikatif berlabel).
  - ONI (NOAA CPC), DMI (NOAA PSL/BoM).
  - Luas terbakar SiPongi per tahun (nasional + provinsi).
- **Selesai jika:**
  - [ ] Setiap file punya sumber, tanggal, lisensi di manifest.
  - [ ] Fallback dipakai dan dicatat jika sumber utama gagal.

### DAT-04 · Manifest data
P0 · R1 · 0,5 jam · DAT-01..03 · 09 S1
- **Selesai jika:** `data_manifest.json` memuat URL, tanggal unduh, sha256, jumlah baris setiap file.

### DAT-05 · Kesehatan data (S2)
P0 · R1 · 2 jam · DAT-04 · 09 S2, 08 A5
- **Kerjakan:**
  - Panggil FIRMS `missing_data` / `data_availability`.
  - Deteksi break per sensor (CUSUM/Pettitt sederhana) lalu cocokkan dengan tanggal event sensor yang diketahui.
- **Selesai jika:**
  - [ ] `data_health.json` per tanggal × satelit.
  - [ ] Setiap break besar dijelaskan atau ditandai "tak terjelaskan".
- **Output:** `data_health.json`.

### DAT-06 · Pembersihan & atribut (S3)
P0 · R1 · 3 jam · DAT-04 · 09 S3
- **Kerjakan:**
  - Buang Terra < Nov 2000.
  - Filter `type = 0`.
  - Confidence: MODIS ≥30, VIIRS n/h; simpan `conf_class` untuk uji sensitivitas.
  - Hitung `local_date`, `LST = UTC + lon/15`, `A_pix = scan × track`.
  - Label `is_peat`, `province`, `regency`, `khg_id`, `island_region`.
- **Selesai jika:**
  - [ ] Persentase deteksi yang terbuang per alasan dilaporkan.
  - [ ] Kolom baru tidak berisi null tak terduga.
- **Output:** `detections.parquet`.

### DAT-07 · Mask sumber statis untuk NRT (S3)
P0 · R1 · 1,5 jam · DAT-06 · 08 S11
- **Kerjakan:** sel 0,01° dengan deteksi `type ∈ {1,2,3}` ≥ N hari pada 2012-2025 → `static_mask`; terapkan ke NRT; uji N ∈ {5, 10, 20}.
- **Selesai jika:**
  - [ ] Lokasi industri yang diketahui (mis. kawasan smelter Sulawesi, flare migas) tertutup mask.
  - [ ] Persentase NRT yang dimask dilaporkan.

### DAT-08 · Fire cell-days (S4)
P0 · R1 · 2 jam · DAT-06, DAT-07 · 09 S4
- **Kerjakan:** snap ke grid 0,01°; sel unik per (tanggal lokal, satelit, siang/malam); simpan `n_det`, `sum_frp`, `max_frp`, `mean_A_pix`, label.
- **Selesai jika:**
  - [ ] Tidak ada duplikat kunci.
  - [ ] Rasio deteksi→sel per satelit dilaporkan.
- **Output:** `daily_cell.parquet`.

### DAT-09 · Agregasi bulanan per strata & AOI (S5)
P0 · R1 · 2 jam · DAT-08 · 09 S5
- **Kerjakan:**
  - `monthly_stratum` (wilayah × musim × siang/malam × gambut × satelit).
  - `monthly_aoi` untuk provinsi, kabupaten, KHG, grid 0,05° (untuk AOI kustom di klien).
- **Selesai jika:**
  - [ ] Total nasional = jumlah provinsi (konservasi massa).
  - [ ] Ukuran file grid 0,05° dicatat (target cukup kecil untuk dimuat di browser).

### DAT-10 · Data observabilitas (CMG awan)
P1 · R1 · 3 jam · SET-04 · 09 U4
- **Kerjakan:** unduh MOD14CMQ/MYD14CMQ 2001-2026 subset Indonesia; ekstrak `CloudPix`, `TotalPix` → `f_cloud` per sel 0,25° × bulan. Fallback: ERA5 total cloud cover.
- **Selesai jika:**
  - [ ] `f_cloud` tersedia untuk ≥90% sel-bulan Indonesia.
  - [ ] Fallback dicatat jika dipakai.

### DAT-11 · Data iklim & hujan
P1 · R2 · 2 jam · SET-04 · 08 D9/D10
- **Kerjakan:** CHIRPS bulanan per provinsi/KHG (GEE atau unduhan); Drought Code GEFF-ERA5 (opsional, mulai unduh di jam pertama).
- **Selesai jika:** `climate_monthly.parquet` (hujan 30/90 hari, DC) per AOI preset.

---

## 5. Epic PHY · Fisika

### PHY-01 · Kurva FRP floor dan pemilihan F\* (S6)
P1 · R3 · 3 jam · DAT-08 · 08 P5, 09 S6
- **Kerjakan:** pada 2012-2021, hitung `R(F) = N_VIIRS(ΣFRP≥F) / N_MODIS(FRP≥F)` untuk F 1-200 MW (log), siang dan malam terpisah. VIIRS memakai ΣFRP per sel 1 km per overpass; MODIS dibatasi A_pix setara scan ≤ ~40°. Pilih F\* sesuai aturan di SET-05.
- **Selesai jika:**
  - [ ] Grafik R(F) tersimpan.
  - [ ] F\* siang dan malam tercatat.
  - [ ] Jika tidak ada F\* yang memenuhi: dicatat, dan TRI-01 ditunda.
- **Output:** `physics/f_star.json`, figur.

### PHY-02 · Jam lintas efektif per satelit (S6/U5)
P1 · R3 · 2 jam · DAT-06 · 09 U5
- **Kerjakan:** median `LST` per (satelit, bulan, siang/malam) 2003-2026.
- **Selesai jika:**
  - [ ] Grafik LST Terra/Aqua/S-NPP/NOAA-20 vs waktu.
  - [ ] Drift Aqua/Terra terlihat atau tidak (dicatat apa adanya).
- **Output:** `physics/overpass_time.parquet`.

### PHY-03 · Model diurnal dan prediksi rasio drift (U5)
P1 · R3 · 3 jam · PHY-02, CAL-04 · 09 U5
- **Kerjakan:** `f(t) = b + exp(−(t−h)²/(2s²))` dengan parameter literatur (atau fit Terra/Aqua 2003-2019 dengan prior); hitung `R_pred = f(LST_Aqua)/f(LST_VIIRS)` 2022-2026.
- **Selesai jika:**
  - [ ] Parameter + sumbernya tercatat.
  - [ ] Seri `R_pred` siap untuk VAL-05.

### PHY-04 · Operator deteksi Sofiev 2026 (U2/M8)
P2 · R3 · 6-8 jam · DAT-08 · 08 P4, 09 U2
- **Kerjakan:** implementasi ulang dari persamaan paper (bukan salin kode GPL); koefisien diverifikasi ke Tabel 1-2 paper / repo FRP_OOp; hitung `E[N_MODIS-eq]` ± `√ΣP(1−P)` per strata 2012-2021.
- **Selesai jika:**
  - [ ] Koefisien terverifikasi (sumber dicatat).
  - [ ] Unit test kurva sigmoid terhadap angka ringkasan paper (5,7/3,7 MW MODIS tengah swath).
  - [ ] Output `m_s` per strata.

### PHY-05 · Prior fisika dalam kalibrasi (U2/M5)
P2 · R2 · 2 jam · PHY-04, CAL-01 · 09 U2
- **Kerjakan:** `κ̂_s = (n0·m_s + ΣA_s) / (n0 + ΣV_s)`; pilih n0 ∈ {0, 50, 200, 1000} via LOYO.
- **Selesai jika:** baris M5 di ablation terisi; n0 terpilih tercatat.

---

## 6. Epic CAL · Kalibrasi & seri

### CAL-01 · κ statis berstrata + empirical Bayes (M3)
P0 · R2 · 3 jam · DAT-09 · 08 §7.6.2 langkah 6, 09 S7
- **Kerjakan:** per strata (wilayah × musim × siang/malam × gambut), `ΣA` (Aqua) dan `ΣV` (S-NPP) 2012-2021; hyperparameter (a, b) per induk; `κ̂_s = (a + ΣA_s)/(b + ΣV_s)`.
- **Selesai jika:**
  - [ ] Tidak ada κ ekstrem tak masuk akal (κ ≤ 0 atau ≥ 1).
  - [ ] Bobot shrinkage per strata tercatat.
- **Output:** `strata_factors.json`.

### CAL-02 · Bootstrap per tahun
P0 · R2 · 1,5 jam · CAL-01 · 08 S6
- **Kerjakan:** 1.000 resample tahun 2012-2021 → `κ_lo`, `κ_hi` (persentil 5/95); resample tahun yang sama untuk semua strata.
- **Selesai jika:** interval tersedia untuk semua strata; seed dicatat.

### CAL-03 · Rantai satelit (Terra→Aqua, NOAA-20→S-NPP)
P0 · R2 · 2 jam · DAT-09 · 09 S8
- **Kerjakan:** `r_T→A` (Jul 2002-Des 2005), `r_N20→SNPP` (Apr 2018-Okt 2026), ratio of sums + bootstrap; error chain-closure.
- **Selesai jika:** faktor + interval tersimpan; `r_N20→SNPP` dilaporkan (diharapkan ≈1).
- **Output:** `chain_factors.json`.

### CAL-04 · Susun seri harmonisasi H (M3)
P0 · R2 · 2 jam · CAL-01..03 · 08 §7.6.2 langkah 8
- **Kerjakan:**

  | Periode | Sumber |
  |---|---|
  | Nov 2000 - Jun 2002 | T × r |
  | Jul 2002 - Des 2021 | A |
  | Jan 2022 - 2 Nov 2026 | V_SNPP × κ |
  | Setelah 2 Nov 2026 | N20 × r × κ |

  Simpan nilai mentah per satelit + dekomposisi gambut/mineral/siang/malam + interval.
- **Selesai jika:**
  - [ ] `monthly_aoi` memuat `H, H_lo, H_hi, A_raw, T_raw, V_raw, N20_raw, sensor_used`.
  - [ ] Total strata = total AOI.

### CAL-05 · Seri harmonisasi untuk AOI kustom
P0 · R2 + R1 · 1,5 jam · CAL-04, DAT-09 · 10 §5.3
- **Kerjakan:** faktor κ dipetakan ke grid 0,05° (berdasarkan wilayah, gambut, siang/malam) sehingga klien cukup menjumlahkan sel di dalam poligon.
- **Selesai jika:** hasil AOI kustom yang menyamai satu provinsi cocok (±1%) dengan preset provinsi.

### CAL-06 · κ dinamis bersyarat FRP (U1/M4)
P1 · R2 · 5 jam · CAL-01, PHY-01 · 09 U1
- **Kerjakan:** GLM NegBin `log E[A] = log V + β0_s + β1·logit(φ_t) + β2·η_t`; latih 2012-2021; bootstrap tahun (refit); hasilkan `κ(s,t)`.
- **Selesai jika:**
  - [ ] Tanda dan CI β1, β2 tercatat.
  - [ ] Baris M4 ablation terisi.
  - [ ] Seri utama memakai M4 **hanya jika** LOYO M4 ≤ M3 (aturan SET-05); jika tidak, tetap M3 dan hasil dilaporkan.

---

## 7. Epic TRI · Triangulasi & observabilitas

### TRI-01 · Seri H_large (indeks api besar)
P1 · R3 · 1,5 jam · PHY-01, DAT-08 · 09 U3
- **Selesai jika:** cell-days dengan ΣFRP ≥ F\* untuk semua satelit, tanpa kalibrasi, per AOI-bulan; baris M6 ablation terisi.

### TRI-02 · Seri H_energy (ΣFRP)
P1 · R3 · 1,5 jam · DAT-08 · 08 P9
- **Selesai jika:**
  - [ ] ΣFRP bulanan per AOI; kalibrasi rasio energi ringan pada 2012-2021.
  - [ ] Label UI "energi radiatif api", **bukan** karbon.
  - [ ] Baris M7 terisi.

### TRI-03 · Skor kesepakatan A/B/C
P1 · R3 · 1 jam · TRI-01, TRI-02, ANO-01 · 09 U3
- **Kerjakan:** persentil masing-masing seri vs baseline-nya; A = tiga sepakat (kelas anomali sama), B = dua, C = tidak.
- **Selesai jika:** kolom `agreement` di `monthly_aoi`; proporsi A/B/C per era tercatat (untuk VAL-11).

### TRI-04 · Indeks observabilitas O dan tiga keadaan
P1 · R1 · 1,5 jam · DAT-10, DAT-05 · 09 U4
- **Kerjakan:** `O = (1 − f_cloud)·(1 − f_missing)`; kelas: baik (≥0,6), sebagian (0,3-0,6), tidak teramati (<0,3).
- **Selesai jika:** kolom `observability`, `obs_class` di `monthly_aoi`; persentase sel-bulan per kelas dilaporkan.

---

## 8. Epic ANO · Baseline & anomali

### ANO-01 · Baseline median dan anomali
P0 · R2 · 1,5 jam · CAL-04 · 08 S8
- **Kerjakan:** median per bulan-kalender 2003-2022, p10, p90, MAD; persentil, log-rasio, robust z (hanya jika median > ambang).
- **Selesai jika:** `baseline.parquet` + kolom anomali di `monthly_aoi`; fungsi baseline bisa dipanggil "di dalam fold" untuk validasi.

### ANO-02 · Kelas ENSO/IOD dan peringkat analog
P0 · R2 · 1,5 jam · DAT-03, ANO-01 · 08 S9
- **Kerjakan:** ONI rata-rata Jul-Sep ≥ +0,5 = El Niño; DMI Sep-Nov ≥ +0,4 = IOD+; kelas per tahun; peringkat bulan berjalan di antara tahun sekelas.
- **Selesai jika:**
  - [ ] `enso_class.json` dengan nilai ONI/DMI dan sumbernya.
  - [ ] Daftar tahun El Niño dicek ulang dengan data resmi (bukan daftar ingatan).

### ANO-03 · Klimatologi kondisional untuk kalender kesiagaan
P1 · R2 · 1 jam · ANO-02 · 09 U6(b)
- **Kerjakan:** `P(H > p90 | kelas)` per AOI × bulan dengan estimator Laplace `(k+1)/(n+2)`.
- **Selesai jika:** tabel siap untuk DEC-02.

---

## 9. Epic VAL · Validasi

Semua uji mengikuti aturan di SET-05 dan menulis ke `validation_results.json`, satu entri per uji: `test_id`, `metric`, `value`, `ci`, `rule`, `passed`, `notes`.

### VAL-01 · LOYO + LORO (V1, V2)
P0 · R3 · 2 jam · CAL-04, ANO-01 · 09 §5.1
- **Selesai jika:**
  - [ ] MdAPE tahunan, Spearman, bias untuk M1, M2, M3 (dan M4 jika ada).
  - [ ] Sorotan khusus 2015 dan 2019.
  - [ ] Baseline dihitung di dalam fold.

### VAL-02 · Seam test 5 sambungan + placebo (V3)
P0 · R3 · 3 jam · CAL-04 · 08 V3, 09 §5.1
- **Kerjakan:** `z_t = log(H+1) − log(R+1)` dengan R = Aqua-only (dan MCD64A1 bila ada); Pettitt + PELT (`ruptures`); Δ_seam ± CI block bootstrap di 2002-07, 2012-01, 2018, 2022-01, 2026-11; distribusi placebo dari tanggal tanpa event.
- **Selesai jika:** tabel seam M0 vs M3 (vs M4); figur seam plot.

### VAL-03 · MODIS sunset backtest (V5)
P0 · R3 · 1,5 jam · CAL-01 · 08 V5
- **Kerjakan:** kalibrasi 2012-2016, rekonstruksi 2017-2021 dari VIIRS saja, bandingkan dengan Aqua.
- **Selesai jika:** KGE untuk M1, M3 (M4).

### VAL-04 · Ablation M0-M8
P0 · R3 · 2 jam · VAL-01..03 · 09 §5.2
- **Kerjakan:** isi tabel ablation dari hasil uji.
- **Selesai jika:**
  - [ ] Semua sel tabel terisi dari data, atau bertanda "tidak dijalankan".
  - [ ] Baris M3x (kalibrasi 2012-2025) dijalankan.

### VAL-05 · Uji drift berbasis fisika (V4)
P1 · R3 · 1,5 jam · PHY-03, CAL-04 · 09 U5
- **Selesai jika:** regresi `R_obs ~ R_pred` 2022-2026 (slope, r, CI); hasil M3 vs M3x tercatat.

### VAL-06 · Validasi vs SiPongi (V6)
P1 · R3 · 1,5 jam · CAL-04, DAT-03 · 08 V6
- **Selesai jika:** Spearman tahunan nasional + provinsi untuk raw vs harmonisasi; sumber dan tahun angka SiPongi dicantumkan.

### VAL-07 · Sensitivitas (V7)
P1 · R3 · 1,5 jam · CAL-04 · 08 V7
- **Selesai jika:** perubahan kelas anomali 2026 untuk confidence (semua / n+h / h), grid (0,01° vs 0,05°), strata, n0.

### VAL-08 · Uji fisik Field 2016 (V8)
P1 · R3 · 2 jam · CAL-04, DAT-11 · 08 V8
- **Kerjakan:** kurva aktivitas Ags-Okt vs hujan musim kering, fit terpisah 2003-2011 dan 2012-2025, untuk raw dan harmonisasi.
- **Selesai jika:** parameter + CI kedua periode; kesimpulan sesuai aturan SET-05.

### VAL-09 · Uji hipotesis gambut H1-H3 (V9)
P0 · R2 · 2 jam · DAT-09 · 08 §7.7
- **Kerjakan:** rasio `ΣV/ΣA` per {gambut, mineral} × {siang, malam} × {El Niño, normal} 2012-2021, Sumatra + Kalimantan, CI bootstrap tahun; GLM opsional.
- **Selesai jika:** hasil H1/H2/H3 dinyatakan **diterima/ditolak** sesuai aturan pra-registrasi, termasuk jika hasilnya null.

### VAL-10 · Kesepakatan flag anomali + ranking ENSO (V10, V12)
P1 · R3 · 1 jam · ANO-01 · 08 V10, V12
- **Selesai jika:** F1/Cohen's κ untuk flag ≥p90 (Aqua asli vs VIIRS·κ 2012-2021); Spearman peringkat tahunan.

### VAL-11 · Validasi observabilitas & triangulasi (V13, V14)
P1 · R3 · 1 jam · TRI-03, TRI-04, VAL-06 · 09 §5.1
- **Selesai jika:** ρ vs luas terbakar pada O tinggi vs rendah; proporsi sel C per era.

### VAL-12 · Validasi hidup di pipeline (U8)
P1 · R3 + R1 · 1 jam · VAL-01..03 · 09 U8
- **Kerjakan:** perintah `make validate` menjalankan ulang semua uji dan memperbarui `validation_results.json`; ekspor membaca file ini.
- **Selesai jika:** satu perintah menghasilkan ulang semua hasil; uji gagal ditandai `passed: false`, bukan dihapus.

### VAL-13 · Koefisien fisika & prior (V15, V16)
P2 · R3 · 1 jam · CAL-06, PHY-04 · 09 §5.1
- **Selesai jika:** tanda/CI β1, β2 dan perbandingan `m_s` vs κ empiris dilaporkan.

---

## 10. Epic DEC · Lapisan keputusan

### DEC-01 · Peluang peringkat KHG/kabupaten
P1 · R2 · 2 jam · CAL-02, ANO-02 · 09 U6(a)
- **Kerjakan:** untuk setiap resample bootstrap, hitung total musim kering tahun El Niño per unit lalu urutkan; `P(top-10)`.
- **Selesai jika:** `priority.json` (unit, P(top-10), median peringkat, interval).

### DEC-02 · Kalender kesiagaan
P1 · R2 · 1 jam · ANO-03 · 09 U6(b)
- **Selesai jika:** `alert_calendar.json` (AOI × bulan × kelas ENSO → peluang).

### DEC-03 · Backtest kalender kesiagaan (V11)
P1 · R3 · 2 jam · DEC-02 · 09 U6(c)
- **Kerjakan:** aturan "naikkan kesiagaan bila P ≥ 0,5 dan status El Niño diumumkan" pada 2003-2025.
- **Selesai jika:** hit, miss, alarm palsu sebelum September per provinsi; dihitung tanpa memakai data tahun yang diuji (leave-one-year-out).

---

## 11. Epic EXP · Ekspor & publikasi

### EXP-01 · Static bundle untuk frontend
P0 · R1 · 2 jam · CAL-04, ANO-01 · 09 S13, 10 §5.3
- **Kerjakan:**
  - JSON/Parquet kecil per AOI preset.
  - Grid 0,05° bulanan untuk AOI kustom.
  - `validation_results.json`, `data_health.json`, `enso_class.json`.
  - PMTiles batas.
  - Host file besar di Cloudflare/HF (bukan GitHub Pages untuk Parquet range).
- **Selesai jika:**
  - [ ] Frontend memuat semua file dari bundle tanpa jaringan eksternal (kecuali basemap).
  - [ ] Range request diuji di host yang dipilih.

### EXP-02 · CSV unduhan (agregat + titik deteksi)
P0 · R1 · 1,5 jam · EXP-01 · 08 §7.9.3
- **Selesai jika:**
  - [ ] Header komentar (versi data, filter, baseline, periode kalibrasi, sitasi, lisensi, pengakuan AI).
  - [ ] Kolom sesuai skema 08 §7.9.3 + `evidence_id`.
  - [ ] CSV titik deteksi per AOI/rentang tersedia.

### EXP-03 · Evidence ledger (U7)
P1 · R1 · 2 jam · EXP-01, VAL-12 · 09 U7
- **Kerjakan:** `evidence.json`: ID → tabel/query sumber, filter, versi data (hash), commit pipeline, uji terkait + status.
- **Selesai jika:** setiap angka yang dirender UI dan brief punya `evidence_id` yang terselesaikan.

### EXP-04 · Dataset terbuka + API statis + datasheet (U9)
P1 · R1 · 2 jam · EXP-01 · 09 U9
- **Selesai jika:**
  - [ ] Parquet + CSV harmonisasi per provinsi/kabupaten/KHG/0,25° dapat diunduh publik.
  - [ ] Endpoint statis `/api/v1/aoi/{id}/monthly.json`.
  - [ ] `docs/datasheet.md` (sumber, metode, versi, lisensi, keterbatasan, sitasi).

### EXP-05 · Notebook validasi & figur
P1 · R3 · 1,5 jam · VAL-04 · 08 §7.10
- **Selesai jika:** notebook menghasilkan ulang figur seam, ablation, gambut, drift dari `validation_results.json` dan data; figur PNG/SVG untuk slide.

---

## 12. Epic FE · Frontend

### FE-01 · Kerangka aplikasi
P0 · R4 · 2 jam · SET-04, SET-06 · 10 §5.2
- **Kerjakan:** Vite + TS; token CSS (10 §4.2); font self-host (Plus Jakarta Sans, Source Sans 3, `tabular-nums`); kamus i18n ID/EN + `Intl.NumberFormat('id-ID'|'en-GB')`; routing 7 tab.
- **Selesai jika:** tab berpindah; bahasa berganti; angka berformat benar di kedua bahasa.

### FE-02 · Peta dasar
P0 · R4 · 2 jam · FE-01 · 10 §3.1
- **Kerjakan:** MapLibre 6.17.x + PMTiles + `@protomaps/basemaps` (abu-abu terang); lapisan batas provinsi/kabupaten, KHG, gambut; atribusi OSM tampil.
- **Selesai jika:** peta Indonesia tampil <3 detik; atribusi terlihat.

### FE-03 · State URL + shortcut
P0 · R4 · 1 jam · FE-01 · 10 §1
- **Kerjakan:** adaptasi `lib/url.js` project-shift (header atribusi Apache); tinykeys.
- **Selesai jika:** AOI, bulan, mode, tab, bahasa tersimpan di URL; tautan yang dibagikan membuka tampilan yang sama.

### FE-04 · Kalender SVG (grid dasar)
P0 · R4 · 4 jam · FE-01 · 10 §3.2
- **Kerjakan:**
  - Grid tahun × bulan, angka di sel, kolom total + peringkat, baris median.
  - Adaptasi `countScale`/`ratioClass` Fire Harmony (header atribusi).
  - ARIA grid + keyboard (pola `Calendar.tsx`).
- **Selesai jika:**
  - [ ] Render <500 ms untuk 26×12.
  - [ ] Navigasi keyboard penuh.
  - [ ] Data dummy berlabel "DATA CONTOH" sebelum EXP-01 siap.

### FE-05 · Kalender: era sensor & lima keadaan sel
P0 · R4 · 3 jam · FE-04 · 10 §3.2
- **Kerjakan:**
  - Garis era 2011/2012 + label pill (pola Burn Calendar, MIT) + titik tahun masuk satelit + label era drift.
  - Lima keadaan sel: ada / nol / sebagian / tidak teramati / provisional.
  - Ring anomali ≥p90.
- **Selesai jika:** lima keadaan bisa dibedakan dalam simulasi buta warna dan mode monokrom.

### FE-06 · Kalender: data nyata + mode + strata
P0 · R4 · 2 jam · FE-05, EXP-01 · 10 §3.2
- **Kerjakan:** muat data (hyparquet/JSON); toggle mode *Jumlah / vs median / vs El Niño*; strata *Semua / Gambut / Mineral / Siang / Malam*; kalimat temuan di atas dan "X dari Y sel teramati" di bawah.
- **Selesai jika:** semua angka berasal dari bundle; berganti mode <200 ms.

### FE-07 · Toggle raw → harmonisasi (animasi)
P0 · R4 · 1,5 jam · FE-06 · 10 §8
- **Kerjakan:** tiga posisi: *Mentah* / *Per sensor* / *Harmonisasi*; transisi warna ~1 detik; hormati `prefers-reduced-motion`.
- **Selesai jika:** lompatan 2012 terlihat jelas di Mentah dan hilang di Harmonisasi (dengan data nyata).

### FE-08 · Tooltip sel
P0 · R4 · 1,5 jam · FE-06 · 10 §3.2
- **Selesai jika:**
  - [ ] Tooltip 4-5 baris (nilai + interval "9 dari 10", rasio vs median, peringkat, sensor + observabilitas, badge triangulasi bila ada).
  - [ ] Bisa dibuka lewat keyboard.

### FE-09 · Panel AOI 5 mode
P0 · R4 · 3 jam · FE-02, FE-03 · 10 §3.1
- **Kerjakan:**
  - Port `AreaPicker` + `lib/area.js` project-shift ke TS (atribusi).
  - Preset bercerita (5 wilayah); cari (gazetteer); gambar kotak/poligon (terra-draw 1.39 + adapter 1.5); bbox desimal; titik + radius; "Wilayah saya" (localStorage dibungkus try/catch).
  - Konfirmasi luas km² (`@turf/area`).
- **Selesai jika:**
  - [ ] Kelima mode menghasilkan AOI valid.
  - [ ] AOI gambar setingkat provinsi selesai <5 detik.
  - [ ] Input lat/lon divalidasi.

### FE-10 · Toggle "Hanya lahan gambut" + sel bulan di peta
P1 · R4 · 1,5 jam · FE-09, FE-06 · 10 §3.1
- **Selesai jika:** peta menampilkan sel aktivitas bulan terpilih sebagai kotak; hover kalender → pratinjau peta; klik → kunci bulan; toggle gambut memfilter peta dan kalender.

### FE-11 · Timeline + Gantt satelit
P1 · R4 · 2 jam · FE-02 · 10 §3.1
- **Kerjakan:** adaptasi `timeline.js` firms-catalog (Apache); bar Terra/Aqua/S-NPP/NOAA-20/NOAA-21; ujung S-NPP berlabel "berhenti 2 Nov 2026"; era drift diarsir; scrubber + putar.
- **Selesai jika:** scrubber menggerakkan bulan di peta dan kalender.

### FE-12 · Layar "Bulan ini vs sejarah"
P0 · R4 · 3 jam · FE-06, ANO-02 · 10 §3.3
- **Kerjakan:** spaghetti (Observable Plot): tahun abu-abu, band p10-p90, median putus-putus, tahun El Niño satu warna berlabel, tahun berjalan aksen, "+ Tambah tahun"; grafik kumulatif; kalimat vonis (dari fact table).
- **Selesai jika:** perbandingan bulan berjalan memakai periode yang sama (mis. 1-13 Nov vs 1-13 Nov historis); sumber + tanggal di dalam grafik.

### FE-13 · Tabel "Kenapa?"
P1 · R4 · 1 jam · FE-12, DAT-11 · 10 §3.3
- **Selesai jika:** hujan 90 hari, ONI, DMI, Drought Code dengan nilai, normal, status; ambang 4 mm/hari bersitasi.

### FE-14 · Lab Sains (3 panel)
P1 · R4 + R3 · 3 jam · VAL-09, VAL-02, PHY-02 · 10 §3.4
- **Kerjakan:** panel gambut × siang/malam; tabel perubahan level di setiap satelit; grafik jam lintas + R_obs vs R_pred.
- **Selesai jika:** setiap panel punya judul = temuan, tombol (i), sitasi, dan membaca hasil dari `validation_results.json`.

### FE-15 · Seberapa Yakin + Angka Resmi
P0 · R4 · 2,5 jam · VAL-04, VAL-06 · 10 §3.5, §3.6
- **Kerjakan:** kartu raw vs harmonisasi + satu kalimat kelemahan; tabel uji (lulus/gagal); disclaimer 3 poin; "Di mana kami masih kurang"; grafik SiPongi vs FIRMS vs Second Sight + kartu "kenapa angka berbeda".
- **Selesai jika:** uji yang gagal tetap tampil; angka resmi bersumber dan bertanggal.

### FE-16 · Unduh
P0 · R4 · 2 jam · EXP-02 · 10 §3.7
- **Kerjakan:**
  - Menu dengan deskripsi isi file.
  - Dialog data lengkap vs ditampilkan (jumlah baris) + panduan sitasi.
  - PNG/SVG dari data (adaptasi `download.ts` Fire Harmony, `downloads.js` project-shift; atribusi).
- **Selesai jika:** semua unduhan bisa dibuka; gambar memuat judul, legenda, sumber, tanggal.

### FE-17 · Header: strip kesegaran data + banner musim
P1 · R4 · 1 jam · EXP-01, DAT-05 · 10 §2.1
- **Selesai jika:** strip menampilkan tanggal/jam data terakhir (WIB) + status satelit dari `data_health.json`; banner satu kalimat dari data, bukan teks statis.

### FE-18 · Mobile + aksesibilitas + anti-slop
P1 · R4 + R5 · 2 jam · semua FE P0 · 10 §2.2, §7
- **Kerjakan:** bottom sheet (atau layout bertumpuk sebagai fallback); gutter 16 px; tidak ada scroll horizontal halaman; uji CVD + kontras; jalankan checklist 10 §7 pada screenshot desktop + mobile.
- **Selesai jika:** checklist anti-slop lulus; masalah yang tersisa dicatat.

### FE-19 · Prioritas KHG & kalender kesiagaan (UI)
P1 · R4 · 2 jam · DEC-01, DEC-02 · 09 U6
- **Selesai jika:** tabel prioritas dengan peluang + interval; heatmap 12 bulan × kelas ENSO untuk AOI terpilih.

### FE-20 · Slider "VIIRS dilihat dengan mata MODIS" & kalkulator sub-piksel
P2 · R4 + R3 · 3 jam · PHY-04 · 08 X9, X10
- **Selesai jika:** slider mengubah opacity titik berdasarkan P_det; kalkulator menghitung ΔBT4 sesuai rumus Planck di 08 P1.

### FE-21 · Mode gelap
P2 · R4 · 1 jam · FE-18 · 10 §4.2
- **Selesai jika:** latar `#15181C`, tanpa glow; ramp tetap terbaca.

---

## 13. Epic AI · Brief & AI

### AI-01 · Fact table
P1 · R6 (atau R5) · 1,5 jam · ANO-02, EXP-03 · 08 A2
- **Selesai jika:** fungsi menghasilkan JSON fakta untuk AOI + bulan (nilai, interval, persentil, peringkat analog, hujan, ONI/DMI, kelas observabilitas, triangulasi, evidence_id).

### AI-02 · Brief template murni (tanpa LLM)
P1 · R5 · 2 jam · AI-01 · 08 A2
- **Tujuan:** fallback yang selalu jalan.
- **Selesai jika:** brief Bahasa Indonesia + Inggris dari template; PDF (WeasyPrint) dan teks WhatsApp; catatan kaki evidence ID; tanpa logo NASA.

### AI-03 · Brief LLM dengan placeholder + verifier angka
P1 · R6 · 3 jam · AI-02 · 08 A2
- **Kerjakan:** LLM menulis dengan `{{placeholder}}`; kode mengisi angka; verifier mengekstrak semua angka (format ID/EN) dan mencocokkan dengan fact table; 2 kali gagal → template.
- **Selesai jika:** kunci LLM hanya di env backend; respons demo di-cache; UI tetap jalan saat LLM mati.

### AI-04 · Penjelas anomali berbasis aturan
P1 · R6 · 1,5 jam · AI-01 · 08 A3
- **Selesai jika:** aturan (hujan <4 mm/hari + ONI ≥0,5; lonjakan di tanggal sensor; O rendah) menghasilkan kalimat dengan sitasi tetap; dipakai di layar Bulan Ini dan brief.

### AI-05 · Eval suite
P1 · R6 · 2 jam · AI-03 · 08 A4
- **Selesai jika:**
  - [ ] Verifier pada 100 brief: **0 angka tak terlacak**.
  - [ ] Groundedness kalimat kausal 100%.
  - [ ] Laporan `eval/report.md`.
  - [ ] Jika AI-06 dikerjakan: 40-60 query, exact-match ≥90%.

### AI-06 · Query bahasa alami → chip
P2 · R6 · 4 jam · AI-01, FE-09 · 08 A1
- **Selesai jika:** LLM hanya mengisi JSON schema; gazetteer menyelesaikan nama; chip bisa diedit sebelum eksekusi; fallback form.

---

## 14. Epic EXT · Transfer & ekstra

### EXT-01 · Uji transfer global (Amazon barat)
P2 · R6 / R1 · 4 jam · pipeline P0 stabil · 08 §7.8, 09 U10
- **Kerjakan:** jalankan pipeline yang sama (bbox, PEATMAP, indeks iklim diganti; **kode tidak diubah**); jalankan VAL-01..03 (+VAL-09).
- **Selesai jika:** tabel Indonesia vs Amazon berdampingan; diff kode = 0 selain konfigurasi.

### EXT-02 · Indeks repeat-burn 2001-sekarang
P2 · R2 · 2 jam · CAL-04 · 09 U11
- **Selesai jika:** kelas tidak pernah/sesekali/berulang/kronis per sel; persentase aktivitas 2026 di sel kronis.

---

## 15. Epic SUB · Story & submission

### SUB-01 · Wawancara pengguna singkat
P1 · R5 · 2 jam (tersebar) · SET-03 · 08 §7.3
- **Selesai jika:** minimal 1 praktisi (BPBD / Manggala Agni / BRGM / peneliti) diwawancarai; kutipan + izin pakai tersimpan; persona diperbarui.

### SUB-02 · README repo
P0 · R5 · 1,5 jam · semua P0 · 08 §8.3
- **Selesai jika:** satu kalimat, link demo/video/app, data NASA, cara menjalankan, ringkasan metode, tabel validasi, keterbatasan, credits pihak ketiga, pengakuan AI.

### SUB-03 · Metodologi & keterbatasan
P0 · R2 + R3 · 2 jam · VAL-04 · 08 §7.6, §7.12
- **Selesai jika:** `docs/methodology.md` (keputusan D-1..D-14 + rumus) dan `docs/limitations.md` sesuai hasil aktual.

### SUB-04 · Slide 7 halaman (EN)
P0 · R5 · 2 jam · VAL-04, FE P0 · 08 §8.2, 09 §6.3
- **Selesai jika:** ≤7 slide termasuk judul; semua angka dari pipeline dan sama dengan app; tanpa logo NASA.

### SUB-05 · Video demo 30 detik (EN)
P0 · R5 + R4 · 3 jam · K5 · 09 §6.2, 10 §8
- **Kerjakan:** rekam dari app asli 1920×1080; subtitle Inggris dibakar; narasi sesuai storyboard.
- **Selesai jika:** durasi ekspor **≤ 30,0 detik**; link publik (YouTube unlisted/publik) bisa diputar di incognito.

### SUB-06 · Project page
P0 · R5 · 2 jam · SUB-02..05 · 08 §8.3
- **Selesai jika:** semua field wajib terisi (High-Level Summary, Demo, Final Project, Detailed Description, Use of SI, NASA Data, References); gambar ≤10 MB; semua dalam bahasa Inggris.

### SUB-07 · QA angka lintas artefak
P0 · R2 + R3 · 1 jam · SUB-04..06 · 08 §13.2
- **Selesai jika:** setiap angka di video, slide, project page, README, dan app identik dan berasal dari pipeline; diperiksa dua orang.

### SUB-08 · Submit & cek kepatuhan
P0 · R5 · 1 jam · SUB-06, SUB-07 · 08 §12
- **Selesai jika:**
  - [ ] Checklist 08 §12.2 lengkap.
  - [ ] Submit pertama ≤ 21:30 WIB.
  - [ ] Resubmit terakhir ≤ 23:30 WIB.
  - [ ] Semua link dicek dari perangkat lain.

### SUB-09 · Persiapan pitch 21 Nov
P1 · R5 (+semua) · tersebar 16-20 Nov · SUB-08 · 08 §8.4, §11
- **Selesai jika:** naskah 5 menit + 3 menit; demo live dilatih ≥5 kali; video cadangan 2-3 menit; jawaban Q&A (08 §11) diisi angka hasil; konfirmasi ke CP apakah app boleh diperbaiki setelah deadline.

---

## 16. Jadwal per jam (pemetaan tiket)

| Waktu (WIB) | R1 Data | R2 Harmonisasi | R3 Fisika/Validasi | R4 Frontend | R5 Story | R6 AI/Transfer |
|---|---|---|---|---|---|---|
| 14 Nov 09-10 | SET-01, SET-03 (semua) | SET-03 | SET-03 | SET-03 | SET-01..03 | SET-03 |
| 10-13 | SET-04, DAT-01, DAT-02 | DAT-03, DAT-11 (mulai unduh) | **SET-05** | SET-06, FE-01 | SET-02, SUB-01 (kontak) | DAT-10 (mulai unduh CMG) |
| 13-17 | DAT-04..07 | Siapkan CAL-01 (kode) | PHY-02 | FE-02, FE-03, FE-04 (dummy berlabel) | SUB-02 kerangka | AI-01 kerangka |
| 17-21 | DAT-08, DAT-09 | CAL-01, CAL-02, CAL-03 | PHY-01, VAL-09 (dengan R2) | FE-05 | Persona, copy ID/EN | AI-02 |
| 21-24 | EXP-01 v1, DAT-05 | CAL-04, CAL-05, ANO-01, ANO-02 | VAL-01, VAL-02, VAL-03 | FE-06, FE-07, FE-08 | Copy layar | AI-02, AI-04 |
| **24:00 K2** | **Demo P0 end-to-end** | | | | | |
| 15 Nov 00-06 | Istirahat bergilir (≥4 jam/orang) | | | | | |
| 06-10 | DAT-10→TRI-04, EXP-02 | CAL-06, ANO-03 | PHY-03, VAL-05, VAL-06, VAL-08 | FE-09, FE-12 | SUB-03 draft | AI-01, AI-03 |
| **10:00 K3** | | | | | | |
| 10-14 | EXP-03, EXP-04 | DEC-01, DEC-02 | VAL-04, VAL-07, VAL-10, VAL-11, DEC-03, TRI-01..03 | FE-10, FE-11, FE-13, FE-14, FE-15 | Brief review | AI-05, EXT-01 |
| **14:00 K4** | | | | | | |
| 14-18 | VAL-12, EXP-05 (dengan R3) | EXT-02 (opsional), QA angka | EXP-05, SUB-03 | FE-16, FE-17, FE-19, FE-18 | SUB-04, SUB-02 | EXT-01 selesai |
| **18:00 K5 freeze** | | | | | | |
| 18-21 | Bantu QA | SUB-07 | SUB-07 | Bug fix, rekam layar | SUB-05, SUB-06 | Bantu QA |
| 21-21:30 | | | | | **SUB-08 submit pertama** | |
| 21:30-23:30 | Perbaikan kecil | | | | Resubmit terakhir | |

Jika tim hanya 5 orang, tiket R6 dibagi ke R5 (AI-01, AI-02, AI-04) dan R1 (EXT-01). AI-03, AI-05, AI-06, EXT-01 menjadi P2.

---

## 17. Garis potong (urut, dari yang pertama dipotong)

| Urutan potong | Tiket | Pengganti |
|---|---|---|
| 1 | FE-20, FE-21, AI-06, PHY-04, PHY-05, VAL-13 | — |
| 2 | EXT-01, EXT-02 | Sebut sebagai future work |
| 3 | AI-03, AI-05 | AI-02 (template murni, tetap terverifikasi) |
| 4 | DEC-01, FE-19 (rank prob.) | DEC-02 saja (kalender kesiagaan) |
| 5 | DAT-10, TRI-04 (CMG) | `f_missing` saja + proxy ERA5 |
| 6 | EXP-04 | CSV unduhan saja |
| 7 | FE-11, FE-17 | Teks status statis dari `data_health.json` |
| **Jangan dipotong** | SET-05, DAT-01..09, CAL-01..05, ANO-01..02, VAL-01..04, VAL-09, EXP-01..02, FE-01..09, FE-12, FE-15, FE-16, SUB-02..08 | — |

---

## 18. Definition of Done global

Proyek dianggap siap submit jika:

- [ ] Semua tiket P0 berstatus Done.
- [ ] Kalender harmonisasi untuk preset dan AOI kustom berjalan di URL publik tanpa login.
- [ ] Toggle raw → harmonisasi memperlihatkan lompatan 2012 yang hilang dengan data nyata.
- [ ] `validation_results.json` lengkap untuk V1, V3, V5, V9; ablation M0-M3 terisi.
- [ ] CSV agregat + titik deteksi bisa diunduh, dengan metadata.
- [ ] Video ≤30 detik dan/atau ≤7 slide, bahasa Inggris, link publik.
- [ ] Project page lengkap; data NASA dijelaskan; References memuat semua repo/pustaka; pengakuan AI tertulis.
- [ ] Tidak ada kunci/rahasia di repo; tidak ada data dummy tersisa; tidak ada logo NASA.
- [ ] Semua angka di semua artefak identik (SUB-07).
