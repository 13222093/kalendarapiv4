# 09 · Second Sight v2: Upgrade Ide, Pipeline per Stage, dan Posisi terhadap Repo Terkuat

> Versi lanjutan dari ide final di [08 §7](08-blueprint-ide-dan-opsi-konsep.md#7-rekomendasi-ide-final-prd). Dokumen 08 tetap berlaku sebagai dasar: persona, layar, skema data, demo, 48 jam, Q&A. Dokumen ini **mengganti dan menambah** bagian sains, pipeline, dan positioning.
> Dasar riset: [03](03-benchmark-repo-pesaing.md) (43 repo), [05](05-sains-dan-data.md), [06](06-pendekatan-teknis-lanjutan.md), [07](07-gap-analysis-dan-usp.md), `_raw/`.
> Semua klaim pesaing berasal dari README mereka (self-reported). Semua angka hasil Second Sight masih `[hasil]` sampai dihitung dari data selama hackathon.
> Penggunaan AI dalam penyusunan ide dan dokumen ini wajib diakui di submission (lihat [08 §12](08-blueprint-ide-dan-opsi-konsep.md#12-checklist-kepatuhan-submission)).

---

## 0. Ringkasan: apa yang berubah dari v1 ke v2

V1 (dokumen 08) sudah kuat di cerita lokal, tetapi inti sainsnya masih **satu jalur kalibrasi rasio statis**. Itu masih rentan pada tiga titik:
- **Rasio tidak stasioner.** Tahun ekstrem seperti 2015 punya distribusi api yang berbeda.
- **"Tidak ada deteksi" bercampur dengan "tidak bisa melihat"** (awan dan asap).
- **Belum ada lapisan keputusan** yang benar-benar dipakai BPBD/KHG.

V2 menutup ketiganya dan menambah satu lapisan kepercayaan data.

| # | Upgrade v2 | Masalah di v1 yang ditutup | Pesaing yang sudah melakukannya | Tier |
|---|---|---|---|---|
| U1 | **Kalibrasi dinamis berbasis distribusi FRP** ("FRP-conditioned κ"): faktor konversi berubah menurut proporsi api besar/kecil bulan itu | Rasio statis meleset di tahun ekstrem (2015/2019) | Tidak ada. Fire Harmony memakai ML per sel; Kiln Watch memakai rasio statis per bulan | **P0/P1** |
| U2 | **Prior fisika → posterior data** (Bayes dengan prior dari operator deteksi Sofiev 2026) | Strata kecil tidak stabil; tidak ada jangkar fisika | Tidak ada. Fire Harmony punya probabilitas deteksi empiris di 10 tile, bukan operator terpublikasi sebagai prior | P1/P2 |
| U3 | **Harmonisasi triangulasi**: tiga seri independen (count terkalibrasi, indeks api besar FRP-floor, energi radiatif) + **skor kesepakatan** per sel | Satu metode tidak bisa memeriksa dirinya sendiri | Tidak ada (pesaing memakai satu metode utama) | **P1** |
| U4 | **Kalender tiga keadaan**: *ada api* / *tidak ada api* / *tidak teramati* (awan, asap, data hilang) memakai fraksi awan MODIS CMG + missing_data | "Nol" palsu saat asap tebal, padahal itu justru saat terparah | Tidak ada di level sel-bulan (Kiln Watch hanya per satelit) | **P1** |
| U5 | **Waktu lintas efektif** dihitung dari data (`acq_time` + bujur) + uji drift berbasis fisika diurnal | Seam tersembunyi drift orbit | Sebagian: Kiln Watch membatasi kalibrasi S-NPP→Aqua ke 2012-2020 (sebelum drift), tetapi tidak ada yang mengukur jam lintas dari data atau menjelaskan drift dengan fisika diurnal | **P1** |
| U6 | **Lapisan keputusan berprobabilitas**: peluang KHG/kabupaten masuk 10 besar (rank probability), "kalender kesiagaan" P(bulan > p90 \| kelas ENSO) | Kalender belum menjadi keputusan | Tidak ada (EG FireTrack punya playbook, tanpa probabilitas berbasis sejarah harmonisasi) | **P1** |
| U7 | **Evidence ledger**: setiap angka di UI/brief/CSV punya ID bukti → query, versi data, hash, uji yang meloloskannya | Kepercayaan dan reproducibility | Sebagian (FireChronicle punya audit ledger, tanpa harmonisasi kuat) | P1 |
| U8 | **Validasi hidup** (living validation): suite uji dijalankan ulang tiap build, hasilnya tampil di app; aturan uji di-commit lebih dulu (pra-registrasi) | Validasi sebagai lampiran statis | Sebagian (Icarus, project-shift pra-registrasi; Kiln Watch denial test) | **P0** |
| U9 | **Dataset harmonisasi terbuka** + kartu data (datasheet) + API statis JSON | Best Use of Data ("makes space data accessible") | Sebagian (Fire Harmony di Hugging Face, global) | P1 |
| U10 | **Uji transfer global tanpa ubah kode** (Amazon barat) | Skalabilitas hanya klaim | Pesaing global tetapi tanpa validasi lokal mendalam | P2 |
| U11 | **Indeks persistensi pembakaran** (repeat-burn 2001-sekarang dalam skala harmonisasi) | Sejarah per lokasi untuk prioritas pembasahan | Pantau Karhutla (hanya 2012+, VIIRS) | P2 |

**Satu kalimat v2:**
> *"Second Sight tidak hanya mengalikan rasio. Second Sight memodelkan kenapa MODIS melihat lebih sedikit bulan ini, memeriksa dirinya dengan tiga cara independen, memisahkan 'tidak ada api' dari 'tidak bisa melihat', lalu mengubah 25 tahun sejarah menjadi peluang keputusan untuk setiap KHG di Indonesia."*

---

## 1. Second Sight v2 dalam satu halaman

| Elemen | Isi |
|---|---|
| **Nama** | **Second Sight**: mata kedua (VIIRS setelah MODIS), melihat yang luput (gambut, malam, di bawah asap), dan melihat ulang 25 tahun sejarah |
| **Tagline** | *"Seeing the fires MODIS missed."* · versi panjang: *"25 years of fire history, one honest scale, and it knows when it can't see."* |
| **Masalah** | Lima sambungan satelit (2002, 2012, 2018/2023, drift orbit 2020-an, S-NPP mati 2 Nov 2026 + MODIS berakhir) menciptakan tren palsu. Gambut paling sering luput. Asap tebal membuat hitungan turun justru saat paling parah. Tiga lembaga memberi tiga angka |
| **Inti sains** | (1) fire cell-days; (2) **κ dinamis bersyarat FRP** per strata wilayah × musim × siang/malam × gambut, dikalibrasi 2012-2021; (3) **prior fisika** dari operator deteksi; (4) **triangulasi** count/FRP-floor/energi; (5) **tiga keadaan** berbasis observabilitas; (6) baseline median + **analog El Niño** |
| **Keputusan** | Status siaga (BPBD), prioritas pembasahan (KHG), jadwal patroli siang/malam (Manggala Agni) |
| **Output** | Kalender dengan badge keyakinan, peluang peringkat KHG, kalender kesiagaan, brief terverifikasi, CSV + dataset terbuka + evidence ledger |
| **Bukti** | Suite validasi hidup (12+ uji), ablation M0-M8, uji transfer global |
| **Data NASA inti** | FIRMS MODIS C6.1 + VIIRS 375 m C2 (S-NPP, NOAA-20, NOAA-21), MODIS CMG (MOD14CMQ/MYD14CMQ), MCD64A1, FIRMS missing_data |
| **Posisi** | Bukan "terluas" (Kiln Watch/Fire Harmony global), tetapi **paling dalam di kasus tersulit di dunia** (gambut tropis berawan) **dan** satu-satunya yang mengubah sejarah menjadi peluang keputusan bagi lembaga Indonesia |

---

## 2. Upgrade rinci

Format setiap upgrade: **Masalah → Gagasan → Matematika → Data → Validasi → UX → Effort → Risiko & fallback**.

### U1. Kalibrasi dinamis bersyarat FRP ("FRP-conditioned κ") ★★★

**Masalah.**
- Rasio VIIRS:MODIS **bergantung pada distribusi intensitas api**. Bulan dengan banyak api kecil/membara (gambut, malam, awal musim) punya rasio sangat tinggi. Bulan dengan banyak api besar (puncak El Niño) punya rasio lebih rendah, karena api besar terlihat kedua sensor (Sofiev & Kouznetsov 2026; Fu 2020: commission/omission turun seiring naiknya FRP per piksel).
- Rasio statis yang dikalibrasi 2012-2021 akan **salah di tahun ekstrem**. Ini kelemahan yang diakui semua pesaing rasio (Kiln Watch: Paraná +27%, Punjab −7%).

**Gagasan.** Faktor konversi κ tidak konstan per strata, tetapi **fungsi dari "bentuk" api bulan itu**, yang bisa diamati dari VIIRS sendiri, bahkan setelah MODIS mati.

**Matematika.**
- Untuk strata `s` dan bulan `t`, hitung dari VIIRS (cell-overpass, ΣFRP per sel 1 km):
  - `φ_t` = proporsi cell-days VIIRS dengan ΣFRP ≥ F\* (F\* dari FRP floor, U3);
  - `η_t` = proporsi deteksi malam;
  - opsional `ψ_t` = median log ΣFRP.
- Model GLM Negative Binomial dengan offset (dilatih 2012-2021):

  `log E[A_{s,t}] = log V_{s,t} + β0_s + β1·logit(φ_t) + β2·η_t (+ β3·ψ_t)`

  dengan `β0_s` efek strata (wilayah × musim × siang/malam × gambut) yang di-shrink (efek acak, atau EB per strata seperti v1).
- Faktor dinamis: `κ_{s,t} = exp(β0_s + β1·logit(φ_t) + β2·η_t)`.
- Interval: bootstrap per tahun (refit model setiap resample) → `κ_lo`, `κ_hi`.
- **Interpretasi fisik yang bisa diuji:** `β1 > 0` (lebih banyak api besar → MODIS menangkap proporsi lebih besar → κ naik). Tanda koefisien adalah **prediksi fisika yang bisa salah**. Jika tandanya terbalik, itu temuan yang harus dilaporkan.

**Kenapa tetap valid setelah MODIS mati:** semua kovariat (`φ`, `η`, `ψ`) dihitung dari VIIRS. Model belajar *hubungan* dari era overlap, lalu bisa dipakai pada era tanpa MODIS.

**Data.** FIRMS VIIRS (frp, daynight), Aqua (cell-days), label strata. Tanpa data tambahan.

**Validasi.**
- **Ablation langsung:** M3 (κ statis, v1) vs M4 (κ dinamis) pada LOYO, **khususnya 2015 dan 2019**, serta sunset backtest.
- Uji koefisien: CI `β1` (fisika memprediksi > 0).
- Kalibrasi: apakah residu per tahun berkorelasi dengan `φ_t` di M3 tetapi tidak di M4 (bukti bahwa non-stasioneritas tertangkap).

**UX.** Di tooltip sel: "faktor konversi bulan ini: [hasil] (dinamis; [hasil]% api besar)". Di Lab Sains: grafik κ vs φ dengan titik per bulan dan garis model.

**Effort.** 4-6 jam (setelah κ statis v1 jadi). **Tier P0/P1:** jika waktu sempit, cukup satu kovariat `φ`.

**Risiko & fallback.** Overfit dengan strata terlalu banyak → kurangi kovariat atau gabungkan strata. Jika M4 tidak lebih baik dari M3 di LOYO, pakai M3 dan laporkan hasilnya ("non-stasioneritas tidak signifikan di Indonesia").

### U2. Prior fisika → posterior data ★★

**Masalah.** Strata dengan sedikit data (mis. gambut × malam × musim basah × Sulawesi) membuat κ bising. Shrinkage v1 menarik ke rata-rata **statistik**, bukan ke nilai yang **masuk akal secara fisika**.

**Gagasan.** Prior untuk κ tidak berasal dari rata-rata strata induk, tetapi dari **operator deteksi Sofiev & Kouznetsov 2026**: "dengan distribusi FRP VIIRS di strata ini, berapa proporsi yang akan dideteksi MODIS?"

**Matematika.**
- Untuk strata `s` (era overlap), dari cell-overpass VIIRS dengan ΣFRP `F_i`:
  `m_s = (1/N_s) Σ_i ∫ P_det^MODIS(F_i, A) p_s(A) dA`
  dengan `p_s(A)` distribusi luas piksel Aqua di strata `s` (dari `scan×track`) dan `P_det` operator Sofiev (siang/malam).
- `m_s` adalah prior mean κ (fraksi cell VIIRS yang "akan dilihat" MODIS).
- Prior Gamma: `κ_s ~ Gamma(n0·m_s, n0)`; posterior `κ̂_s = (n0·m_s + ΣA_s) / (n0 + ΣV_s)`.
- `n0` (kekuatan prior, dalam satuan "pseudo-cell-days") dipilih dengan LOYO, misalnya dari {0, 50, 200, 1000}.
- **Interpretasi:** fisika mendominasi saat data tipis; data mendominasi saat data kaya.

**Validasi tambahan yang sangat kuat (tanpa fitting):** bandingkan `m_s` (murni fisika, koefisien dari paper global) dengan κ empiris Indonesia. Kesesuaian = bukti eksternal. Ketidaksesuaian sistematis (mis. di gambut malam) = temuan ilmiah ("operator global meremehkan/melebihkan deteksi MODIS di gambut tropis").

**Effort.** 6-8 jam (termasuk verifikasi koefisien Tabel 1-2 paper / repo FRP_OOp). **Tier P1/P2.**

**Lisensi.** Implementasi ulang dari persamaan paper (kode FRP_OOp berlisensi GPL-3.0); repo boleh dibaca untuk verifikasi koefisien.

**Fallback.** Jika koefisien tidak bisa diverifikasi, U2 dihapus dan shrinkage v1 dipakai. Tidak ada fitur lain yang bergantung pada U2.

### U3. Harmonisasi triangulasi + skor kesepakatan ★★★

**Masalah.** Satu metode harmonisasi tidak bisa membuktikan dirinya sendiri di luar periode overlap (pra-2012 dan pasca-MODIS).

**Gagasan.** Bangun **tiga seri yang secara fisik berbeda sensitivitasnya terhadap resolusi**, lalu ukur apakah ketiganya sepakat soal anomali.

| Seri | Definisi | Sensitivitas resolusi | Kelebihan | Kelemahan |
|---|---|---|---|---|
| **H_count** | Fire cell-days setara Aqua (κ dinamis, U1) | Dikoreksi statistik | Mencakup semua api | Bergantung kalibrasi |
| **H_large** | Cell-days dengan ΣFRP ≥ F\* (FRP floor), **tanpa kalibrasi** | Hampir nol di atas F\* | Tidak butuh model | Membuang api kecil/gambut membara |
| **H_energy** | ΣFRP bulanan, rasio energi dikalibrasi ringan | Kecil (api besar mendominasi energi) | Besaran fisik | FRP gambut bias rendah (<650 K) |

**Skor kesepakatan per sel-bulan:**
- Hitung persentil masing-masing seri terhadap baseline-nya sendiri: `P_count`, `P_large`, `P_energy`.
- **Agreement** = 1 − (rentang persentil)/100, atau sederhananya kategori:
  - **A (kuat):** ketiga seri sepakat arah dan kelas anomali (mis. semua ≥ p90).
  - **B (sedang):** dua dari tiga sepakat.
  - **C (lemah):** tidak sepakat → tampilkan peringatan.
- Badge A/B/C muncul di setiap sel kalender dan di brief ("Anomali ini didukung tiga metode independen").

**Kenapa juri global akan menyukai ini:** ini pola "multi-model ensemble agreement" di ilmu iklim, diterapkan ke harmonisasi sensor. Juri tidak perlu mempercayai satu model.

**Validasi.** Proporsi sel A/B/C per era (pra-2012, overlap, pasca-2021). Era pasca-MODIS seharusnya tidak punya lebih banyak C daripada era overlap. Jika punya, itu sinyal masalah yang dilaporkan.

**Effort.** 3-4 jam (H_large dan H_energy hampir gratis setelah P5/P3). **Tier P1.**

### U4. Kalender tiga keadaan: ada api / tidak ada api / tidak teramati ★★★

**Masalah.**
- File titik FIRMS tidak memuat informasi awan atau no-data (MODIS UG §7.1.1).
- Di Indonesia, asap tebal dan awan bisa menurunkan hitungan saat kebakaran paling parah (Cochrane via ScienceDaily 2026; Atwood 2016).
- Semua pesaing menampilkan nilai rendah sebagai "rendah", padahal mungkin "tidak terlihat".

**Gagasan.** Hitung **indeks observabilitas** `O_{g,t}` per sel-bulan, lalu kalender membedakan tiga keadaan:
- **Teramati baik** (`O ≥ 0,6`): nilai ditampilkan normal.
- **Teramati sebagian** (`0,3 ≤ O < 0,6`): nilai + arsir tipis + interval diperlebar.
- **Tidak teramati** (`O < 0,3` atau data sensor hilang): sel berarsir; nilai disembunyikan atau ditampilkan sebagai batas bawah ("≥ X").

**Matematika.**
- Dari MOD14CMQ/MYD14CMQ (0,25°, bulanan): `f_cloud = CloudPix / TotalPix`.
- Dari FIRMS missing_data: `f_missing` = fraksi hari tanpa data sensor rujukan.
- `O = (1 − f_cloud) · (1 − f_missing)`.
- Opsional (P2): nilai terkoreksi CMG `N'' = N'/(1 − f_cloud)` sebagai **batas atas** dan nilai teramati sebagai **batas bawah**, menghasilkan pita "apa yang mungkin terjadi di balik awan".
- Untuk VIIRS, pakai `f_cloud` Aqua sebagai proxy (selisih lintas <50 menit), atau VNP14A1 fire mask bila sempat.

**Validasi.** Korelasi anomali harmonisasi dengan anomali luas terbakar resmi, dihitung terpisah untuk bulan observabilitas tinggi vs rendah. Diharapkan kesesuaian lebih tinggi pada bulan teramati baik. Ini membuktikan indeks O bermakna.

**UX.** Legenda kalender punya tiga keadaan. Brief otomatis menambah kalimat "Sebagian wilayah tertutup awan/asap; nilai sebenarnya mungkin lebih tinggi."

**Effort.** 4-5 jam (unduh CMG subset Indonesia + join). **Tier P1.** **Fallback:** hanya `f_missing` + proxy awan ERA5.

### U5. Waktu lintas efektif dari data + uji drift berbasis fisika ★★★

**Masalah.** Drift orbit Terra/Aqua (pagi/sore) adalah seam tersembunyi. Kiln Watch sudah menghindarinya dengan membatasi kalibrasi ke 2012-2020, tetapi belum ada pesaing yang **mengukur** drift dari data atau **menjelaskan** dampaknya dengan fisika. Nilai drift yang beredar hanya dari grafik proyeksi NASA.

**Gagasan.**
- Hitung **waktu matahari lokal efektif** tiap sensor per bulan langsung dari data: `LST = UTC(acq_time) + lon/15` (jam), lalu median per (satelit, bulan, siang/malam).
- Uji apakah perubahan rasio Aqua/VIIRS 2022-2026 bisa **diprediksi** oleh perubahan LST melalui model diurnal.

**Matematika.**
- Model diurnal: `f(t) = b + exp(−(t − h)² / (2s²))`.
- Parameter `(h, s, b)` diambil dari literatur hutan tropis (Giglio 2007: puncak 13:00-18:30, lebih awal di hutan lebat) atau di-fit dari rasio Terra/Aqua 2003-2019 dengan prior literatur.
- Prediksi: `R_pred(t) = f(LST_Aqua(t)) / f(LST_VIIRS(t))`. Observasi: `R_obs(t) = A(t) / (κ_t · V(t))`.
- Uji: regresi `R_obs ~ R_pred` pada 2022-2026; slope ≈ 1 dan korelasi positif = drift dijelaskan oleh fisika diurnal.

**Kenapa penting:** membenarkan keputusan **kalibrasi hanya 2012-2021** (D-3 di 08) secara kuantitatif. Ablation **M3x** (kalibrasi 2012-2025) seharusnya lebih buruk.

**UX.** Lab Sains panel "Seam yang tidak terlihat": dua grafik bertumpuk (LST per satelit vs waktu; R_obs vs R_pred).

**Effort.** 4-6 jam. **Tier P1.** **Fallback:** grafik LST saja + R_obs (tanpa prediksi diurnal). Ini sudah merupakan temuan yang kuat.

### U6. Lapisan keputusan berprobabilitas ★★★

**Masalah.** Kalender menjawab "apa yang terjadi", tetapi BPBD dan pengelola KHG memutuskan "apa yang harus dilakukan". Pesaing berhenti di kalender atau langsung melompat ke forecast ML.

**Gagasan.** Ubah sejarah harmonisasi + ketidakpastian menjadi **peluang**, tanpa membuat model prakiraan baru.

**(a) Peluang peringkat KHG/kabupaten (rank probability).**
- Untuk setiap resample bootstrap `b` (dari interval H), hitung total aktivitas musim kering di tahun-tahun El Niño untuk setiap unit, lalu urutkan.
- `P(unit u masuk 10 besar) = (1/B) Σ_b 1[rank_b(u) ≤ 10]`.
- Output: tabel prioritas KHG dengan peluang, bukan peringkat tunggal. Contoh format: "KHG X: 92% peluang masuk 10 besar pada tahun El Niño" (angka dari data).
- **Kenapa:** pengelola gambut punya anggaran terbatas. Peringkat yang jujur soal ketidakpastian mencegah salah prioritas.

**(b) Kalender kesiagaan (climatological alert calendar).**
- Untuk setiap unit dan bulan: `P(H > p90 | kelas ENSO = c)` dihitung dari tahun-tahun historis dalam kelas yang sama (dengan koreksi sampel kecil, mis. estimator Laplace `(k+1)/(n+2)`).
- Output: heatmap 12 bulan × kelas ENSO per unit: "Saat El Niño, September di KHG X: [hasil]% peluang di atas persentil 90."
- **Ini bukan forecast cuaca.** Ini klimatologi kondisional, yang bisa dipakai bulan-bulan sebelum musim begitu BMKG/NOAA mengumumkan status El Niño.

**(c) Backtest (V11).** Aturan "naikkan kesiagaan jika P ≥ 0,5 dan status El Niño diumumkan" diuji pada 2003-2025: berapa musim besar yang tertangkap sebelum puncak September, berapa alarm palsu.

**Effort.** 4-5 jam. **Tier P1.** **Fallback:** hanya (b) tanpa (a).

### U7. Evidence ledger ★★

**Masalah.** Juri, BPBD, dan peneliti perlu tahu dari mana setiap angka berasal. LLM brief rawan halusinasi. FireChronicle punya audit ledger, tetapi harmonisasinya lemah.

**Gagasan.** Setiap angka yang ditampilkan punya **ID bukti** (mis. `EV-2026-09-KHG123-H`) yang menyimpan:
- query/tabel sumber dan filter;
- versi data (tanggal unduh, hash file);
- versi pipeline (commit);
- uji validasi yang relevan dan statusnya (lulus/tidak).

**Implementasi.**
- `evidence.json` dibangun di tahap ekspor.
- UI: ikon kecil (i) di setiap angka → popup bukti.
- Brief: verifier angka (dari 08 A2) juga memeriksa bahwa setiap angka punya ID bukti; ID dicantumkan di catatan kaki PDF.
- CSV: kolom `evidence_id`.

**Effort.** 3 jam. **Tier P1.**

### U8. Validasi hidup + pra-registrasi ★★★

**Gagasan.**
- `validation_plan.md` ditulis dan di-commit **sebelum** uji pertama dijalankan (timestamp git sebagai bukti). Isinya: hipotesis, metrik, ambang lulus/gagal.
- Setiap build pipeline menjalankan ulang suite uji → `validation_results.json` → panel "Seberapa yakin kami" di app selalu sinkron dengan data.
- Jika ada uji gagal, banner merah di panel (bukan disembunyikan).

**Kenapa:** mengubah Validity dari "klaim" menjadi "proses". Pesaing terbaik (Kiln Watch, Icarus, project-shift) melakukan sebagian; menggabungkannya dengan tampilan langsung di app adalah langkah berikutnya.

**Effort.** 2 jam infrastruktur (uji-ujinya sendiri sudah dihitung di stage validasi). **Tier P0.**

### U9. Dataset harmonisasi terbuka + kartu data ★★

**Gagasan.** Selain app, publikasikan **produk data**: seri bulanan harmonisasi Indonesia 2001-2026 per provinsi/kabupaten/KHG/sel 0,25°, dengan interval, flag observabilitas, badge triangulasi, dan evidence ID.
- Format: Parquet + CSV, plus API statis JSON (`/api/v1/aoi/{id}/monthly.json`) di static host.
- **Kartu data (datasheet):** sumber, metode, versi, lisensi data, keterbatasan, cara sitasi.
- Opsional: unggah ke Zenodo/Hugging Face untuk sitasi.

**Kenapa:** definisi resmi Best Use of Data adalah "best makes space data accessible or leverages it for a unique application". Dataset terbuka + API adalah bukti langsung.

**Effort.** 2-3 jam. **Tier P1.**

### U10. Uji transfer global ★★

Sama dengan [08 §7.8](08-blueprint-ide-dan-opsi-konsep.md#78-bukti-skalabilitas-global-uji-transfer). Tambahan v2:
- Jalankan **seluruh suite validasi hidup** di wilayah transfer (Amazon barat), bukan hanya LOYO.
- Tampilkan tabel berdampingan Indonesia vs Amazon: κ gambut/mineral, `β1` (efek FRP), proporsi sel A/B/C.
- Jika koefisien fisika (`β1 > 0`, rasio malam > siang) konsisten di dua benua, itu bukti generalisasi yang sangat kuat.

**Effort.** 3-4 jam jika pipeline bersih. **Tier P2.**

### U11. Indeks persistensi pembakaran (repeat-burn 2001-sekarang) ★★

**Masalah.** Pengelola KHG perlu tahu lokasi yang **berulang** terbakar. Pantau Karhutla menghitung repeat-burn hanya sejak 2012 (VIIRS); sejarah MODIS tidak dipakai.

**Gagasan.**
- Pada grid 0,25° (atau 0,05° untuk KHG), hitung jumlah tahun dengan aktivitas harmonisasi di atas ambang selama 2001-2025: `RB_g = Σ_y 1[H_{g,y} > τ]`.
- Kelas: tidak pernah / sesekali (1-3 tahun) / berulang (4-7) / kronis (≥8).
- Bandingkan pola 2026 terhadap kelas: "[hasil]% aktivitas 2026 jatuh di sel kronis".

**Catatan validitas:** karena H dalam skala Aqua, ambang τ berlaku sama untuk era MODIS dan VIIRS. Inilah keuntungan harmonisasi dibanding pendekatan VIIRS-only.

**Effort.** 2-3 jam. **Tier P2.**

---

## 3. Pipeline per stage: masalah yang diselesaikan setiap tahap

### 3.1 Peta pipeline

```
 S0 Pra-registrasi ──► S1 Akuisisi ──► S2 Kesehatan data ──► S3 Pembersihan & atribut
                                                                     │
 S7 Kalibrasi dinamis ◄── S6 Fisika deteksi ◄── S5 Agregasi ◄── S4 Fire cell-days
        │
        ▼
 S8 Rantai satelit & seri ──► S9 Triangulasi & observabilitas ──► S10 Baseline, anomali, ENSO
                                                                          │
 S14 Publikasi ◄── S13 Evidence & ekspor ◄── S12 Keputusan berprobabilitas ◄── S11 Validasi hidup
        │
        ▼
 S15 Aplikasi & brief terverifikasi
```

Setiap stage punya **quality gate**: syarat yang harus dipenuhi sebelum lanjut. Jika gate gagal, ikuti tindakan fallback; jangan lanjut diam-diam.

### 3.2 Tabel stage

| Stage | Masalah yang diselesaikan | Metode | Input | Output | Quality gate | Pesaing yang melakukan | Keunggulan Second Sight | Effort | Tier |
|---|---|---|---|---|---|---|---|---|---|
| **S0 Pra-registrasi** | Bias konfirmasi; klaim validasi yang dibuat setelah melihat hasil | Tulis hipotesis (H1-H3, β1 > 0, drift), metrik, ambang lulus di `validation_plan.md`, commit sebelum S11 | — | Dokumen + hash commit | Commit S0 lebih awal dari commit hasil S11 | Icarus, project-shift (sebagian) | Digabung dengan validasi hidup (U8) | 1 jam | P0 |
| **S1 Akuisisi** | 25 tahun data multi-sensor; CORS; antrean arsip; S-NPP berhenti | CSV negara SP 2000-2025 / firms-catalog GeoParquet; NRT API 2026 (N20/N21); CMG; peta gambut; batas; ONI/DMI; SiPongi | URL resmi | Parquet mentah + `data_manifest` (URL, tanggal, sha256, jumlah baris) | Jumlah baris per tahun-sensor wajar (tidak ada tahun kosong yang tak terduga); hash tersimpan | Semua (bervariasi) | Manifest + hash sebagai dasar evidence ledger | 3-4 jam | P0 |
| **S2 Kesehatan data** | "Tidak ada data" dibaca sebagai "nol api"; seam tak terduga | FIRMS missing_data/data_availability; CUSUM/Pettitt per sensor dicocokkan dengan tanggal event sensor | S1 | `data_health.json`; daftar break tak terduga | Setiap break besar dijelaskan oleh event sensor yang diketahui, atau ditandai "tak terjelaskan" | Sebagian (project-shift no-data mask) | Dipakai di U4 dan banner app | 2 jam | P0 |
| **S3 Pembersihan & atribut** | Sumber statis (smelter, flare, gunung api); NRT tanpa `type`; Terra pra-Nov 2000 rusak; zona waktu; ukuran piksel | Filter `type=0`; mask statis historis untuk NRT; confidence MODIS ≥30 & VIIRS n/h (+ versi sensitivitas); `local_date`, `LST`, `A_pix = scan×track`; label gambut/wilayah/KHG | S1 | `detections` bersih | % deteksi terbuang per alasan dilaporkan; mask statis menangkap lokasi industri yang diketahui (mis. kawasan smelter) | Umum | Atribut LST dan A_pix disiapkan untuk U5 & U2 | 3 jam | P0 |
| **S4 Fire cell-days** | Inflasi piksel kecil VIIRS; duplikat bow-tie/overlap orbit | Snap ke grid 0,01°; sel unik per (tanggal lokal, satelit, siang/malam); simpan ΣFRP, maxFRP, mean A_pix | S3 | `daily_cell` | Rasio deteksi→sel per sensor dilaporkan; tidak ada sel ganda | Komoditas | ΣFRP per sel menjadi dasar U1/U3 | 2 jam | P0 |
| **S5 Agregasi** | Kalender instan; strata kalibrasi | Bulanan per strata (wilayah × musim × siang/malam × gambut × satelit) dan per AOI (provinsi, kabupaten, KHG, grid 0,25°) | S4 | `monthly_stratum`, `monthly_aoi` | Total nasional = jumlah provinsi (konservasi massa) | Komoditas | Strata gambut + siang/malam | 2 jam | P0 |
| **S6 Fisika deteksi** | Kenapa MODIS melihat lebih sedikit; ambang bersama | Kurva R(F) → F\*; distribusi A_pix Aqua per strata; (P1/P2) operator Sofiev → prior `m_s` | S4, S5 | `F_star`, `phi_t`, `eta_t`, `m_s` | R(F) mendatar dalam rentang ±15% di atas F\*; koefisien operator terverifikasi sebelum dipakai | Fire Harmony (prob. deteksi empiris); flare-chronos (footprint) | Operator terpublikasi sebagai **prior**, F\* sebagai seri independen | 4-8 jam | P1 |
| **S7 Kalibrasi dinamis** | Rasio tidak stasioner; strata kecil bising | GLM NegBin dengan offset log V, kovariat φ/η, efek strata di-shrink (prior fisika U2 bila ada); kalibrasi **2012-2021**; bootstrap per tahun | S5, S6 | `kappa(s,t)`, interval, koefisien β | Tanda β1 sesuai/tidak sesuai prediksi dicatat; LOYO M4 vs M3 dicatat; tidak ada κ ekstrem tak masuk akal | Kiln Watch (rasio statis + EB), Fire Harmony (ML per sel) | **κ dinamis bersyarat FRP + strata gambut + prior fisika** | 5-8 jam | P0/P1 |
| **S8 Rantai satelit & seri** | Terra-only 2000-02; jumlah VIIRS berubah; S-NPP mati; MODIS berakhir | r_T→A (2002-05), r_N20→SNPP (2018-26), chain-closure error; satu satelit per era; seri H | S5, S7 | `H(aoi, t)` + interval + dekomposisi gambut/mineral/siang/malam | Kontinuitas di setiap sambungan diperiksa di S11 | Kiln Watch, project-shift | Interval memuat error rantai | 3 jam | P0 |
| **S9 Triangulasi & observabilitas** | Satu metode tak bisa memeriksa diri; "nol" palsu karena awan/asap | H_count, H_large (F\*), H_energy; skor A/B/C; indeks O dari CMG + missing_data | S6, S8, CMG | `triangulation`, `observability` | Proporsi sel C per era dilaporkan; O tersedia untuk ≥90% sel-bulan Indonesia | Tidak ada | **Unik** | 4-6 jam | P1 |
| **S10 Baseline, anomali, ENSO** | "Normal" yang adil; konteks iklim | Median 2003-2022 per bulan-kalender; persentil; log-rasio; robust z; kelas ENSO/IOD; peringkat analog | S8, ONI/DMI | `baseline`, `anomaly`, `enso_class` | Baseline dihitung di dalam fold saat validasi (anti-leakage) | Median umum; analog ENSO tidak ada | **Analog El Niño** | 2-3 jam | P0 |
| **S11 Validasi hidup** | Validity terbukti, bukan diklaim | V1 LOYO, V2 LORO, V3 seam (seri rasio vs referensi + placebo), V4 drift (U5), V5 sunset, V6 SiPongi, V7 sensitivitas, V8 Field 2016, V9 gambut, V10 κ flag, V11 backtest kesiagaan, V12 ranking ENSO, V13 observabilitas (U4), V14 triangulasi per era | S7-S10 | `validation_results.json`, tabel ablation M0-M8 | Setiap uji punya status lulus/gagal sesuai S0; uji gagal tidak disembunyikan | Kiln Watch (denial, placebo), Fire Harmony (seam, placebo), Icarus (E1-E9) | **Seri rasio vs referensi di semua 5 seam**, uji fisik Field, SiPongi, observabilitas | 6-8 jam | P0 |
| **S12 Keputusan berprobabilitas** | Kalender → tindakan | Rank probability KHG/kabupaten; kalender kesiagaan P(H > p90 \| ENSO); backtest | S8, S10, S11 | `priority`, `alert_calendar` | Backtest dilaporkan (hit, miss, alarm palsu) | EG FireTrack (playbook, tanpa probabilitas) | **Unik** | 4-5 jam | P1 |
| **S13 Evidence & ekspor** | Kepercayaan; reproducibility; demo offline | `evidence.json`, static bundle (Parquet/JSON/PMTiles), CSV dengan evidence_id, kartu data | Semua | Bundle + ledger | Setiap angka di UI punya evidence ID; bundle jalan offline | FireChronicle (ledger) | Ledger terhubung ke uji validasi | 3 jam | P1 |
| **S14 Publikasi** | "Make space data accessible" | Dataset terbuka + API statis JSON + datasheet; (opsional) Zenodo/HF | S13 | URL dataset & API | Link publik tanpa login | Fire Harmony (HF) | Indonesia-spesifik + interval + observabilitas | 2-3 jam | P1 |
| **S15 Aplikasi & brief** | Data sampai ke keputusan | App (layar 08 §7.5 + panel v2); brief: fact table → LLM placeholder → verifier angka + evidence ID → PDF/WhatsApp; eval set | S13 | App publik, brief, eval report | 0 angka tak terlacak pada eval; demo jalan offline | Banyak app; brief terverifikasi tidak ada | **Verifier + evidence ID** | 12-16 jam | P0/P1 |

### 3.3 Quality gate yang paling sering gagal (dan tindakannya)

| Gate | Gejala gagal | Kemungkinan penyebab | Tindakan |
|---|---|---|---|
| S1 jumlah baris | Tahun tertentu jauh lebih sedikit | Unduhan terpotong; bbox salah | Unduh ulang tahun itu; bandingkan dengan sumber kedua |
| S2 break tak terjelaskan | Break di tanggal tanpa event sensor | Perubahan versi produk/koleksi; data hilang | Tandai di kalender; sebut di keterbatasan |
| S3 mask statis | Lokasi smelter masih muncul sepanjang tahun | Ambang N hari terlalu tinggi | Turunkan N; tambah daftar lokasi industri manual |
| S6 R(F) tidak mendatar | Tidak ada F\* yang memenuhi | Scan angle MODIS tidak dibatasi; VIIRS tidak diagregasi | Batasi A_pix MODIS; agregasi VIIRS 1 km; jika tetap gagal, hapus H_large |
| S7 κ ekstrem | κ > 1 atau ≈ 0 di strata tertentu | Strata terlalu kecil | Naikkan shrinkage/n0; gabungkan musim |
| S11 seam 2012 tetap ada | Δ_seam di luar distribusi placebo | Strata/kalibrasi kurang | Laporkan jujur; coba M4/M2b; tampilkan sebagai keterbatasan |
| S11 SiPongi korelasi rendah | Spearman rendah | Metode BA berbeda; tahun sedikit | Laporkan; tambahkan MCD64A1 sebagai referensi kedua |
| S15 verifier gagal | Brief ditolak terus | Format angka Indonesia (titik/koma) | Perbaiki parser; fallback template |

---

## 4. Posisi Second Sight v2 terhadap repo terkuat

### 4.1 Repo pembanding

Dipilih dari 43 repo berdasarkan kekuatan sains, kelengkapan produk, atau kedekatan wilayah (detail: [03](03-benchmark-repo-pesaing.md)):

| Kode | Repo | Asal (indikasi) | Kekuatan utama |
|---|---|---|---|
| KW | Aalvee-Aarham/kiln-watch | Bangladesh | MODIS-denial test, rasio siang/malam + EB, rantai NOAA-20/21, 9 AOI + any place, MCP 31 tools |
| FH | Warren-530/fire-harmony | Malaysia | 640 juta baris, LightGBM per hexagon, PEATMAP, seam/placebo/Pettitt/PELT, Fire_cci, haze |
| FC | the-aris-club/flare-chronos | Vietnam | Fisika footprint scan-angle, Ω effort, QM FRP 2 tahap |
| EG | EdisonShiny/eg-firetrack | Malaysia | Borneo, gambut (risk score), playbook BPBD/Manggala Agni, forecast 72 jam |
| IC | Icarus | Bangladesh | 9 eksperimen pra-registrasi, offline reproducible, MCD64A1 |
| PS | squadronzero/project-shift | — | Pra-registrasi aturan, rantai S-NPP→NOAA-20, global |
| BC | tttamannaanand/burn-calendar | — | Quantile mapping, holdout 0,88-1,01×, UX kalender bersih |
| IG | Hisernberg/ignis | Bangladesh | 11 tab statistik + AI, model HF |

### 4.2 Matriks kemampuan (✓ ada · ◐ sebagian · ✗ tidak · — tidak relevan)

| Kemampuan | KW | FH | FC | EG | IC | PS | BC | IG | **Second Sight v2** |
|---|---|---|---|---|---|---|---|---|---|
| Kalender 2000-sekarang | ✓ | ✓ | ◐ (2 AOI) | ✗ (2017+) | ✓ | ✓ | ✓ (3 region) | ✓ | ✓ |
| AOI di mana saja | ✓ | ✓ | ✗ | ✗ | ◐ | ✓ | ✗ | ◐ | ✓ |
| Unit administrasi/KHG Indonesia | ✗ | ✗ | ✗ | ◐ (provinsi Borneo) | ✗ | ✗ | ✗ | ✗ | **✓** |
| Fire cell-days / grid bersama | ✓ | ✓ (H3) | ✓ (H3) | ✓ | ✓ | ✓ | ✓ | ◐ | ✓ |
| Rasio siang/malam terpisah | ✓ | ◐ | ◐ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Strata gambut **dalam kalibrasi** | ✗ | ◐ (fitur ML) | ✗ | ✗ (hanya risk) | ✗ | ✗ | ✗ | ✗ | **✓ (+ diuji)** |
| Kalibrasi dinamis bersyarat intensitas api | ✗ | ◐ (ML implisit) | ◐ (QM FRP) | ✗ | ✗ | ✗ | ◐ (QM count) | ✗ | **✓ (eksplisit, bisa ditafsir)** |
| Prior/operator fisika terpublikasi | ✗ | ◐ (empiris 10 tile) | ◐ (footprint) | ✗ | ✗ | ✗ | ✗ | ✗ | **✓ (Sofiev 2026, P1/P2)** |
| Kalibrasi dibatasi pra-drift + bukti drift | ✓ (S-NPP→Aqua 2012-2020) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **✓ + uji fisika diurnal** |
| Triangulasi multi-metode | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **✓** |
| Observabilitas (awan/asap) per sel | ◐ (per satelit) | ◐ (MOD14A1 disebut) | ◐ (Ω) | ✗ | ◐ (coverage rule) | ◐ (cloud check) | ✗ | ✗ | **✓ (tiga keadaan)** |
| Interval ketidakpastian per nilai | ✓ (95%) | ✓ (90%) | ✗ | ✗ | ✓ (bootstrap) | ✓ (bootstrap) | ✗ | ◐ (CV rasio) | ✓ (+ chain error) |
| Seam test + placebo | ◐ (placebo) | ✓ | ✗ | ✗ | ◐ | ◐ | ✗ | ◐ (CUSUM) | ✓ (seri rasio vs referensi, 5 seam) |
| "MODIS mati" backtest | ✓ | ◐ | ✗ | ✗ | ✗ | ◐ | ◐ (holdout) | ✗ | ✓ |
| Validasi vs data resmi nasional | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **✓ (SiPongi)** |
| Uji fisik (respons kekeringan) | ✗ | ◐ (drivers) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **✓ (Field 2016)** |
| Baseline kondisional ENSO | ✗ | ◐ (driver) | ✗ | ◐ (data ENSO) | ✗ | ✗ | ✗ | ✗ | **✓ (analog)** |
| Lapisan keputusan berprobabilitas | ✗ | ◐ (outlook Brier) | ✗ | ◐ (rules) | ✗ | ✗ | ✗ | ◐ (outlook) | **✓ (rank prob. + kalender kesiagaan + backtest)** |
| Forecast ML | ✗ (sengaja) | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ (sengaja; klimatologi kondisional) |
| Brief terverifikasi + eval AI | ✗ (Gemini, MCP) | ✗ | ◐ (AI harness) | ✗ | ✗ | ✗ | ✗ | ✗ (SITREP) | **✓** |
| Evidence ledger | ✗ | ✗ | ✗ | ✗ | ◐ | ◐ | ✗ | ✗ | **✓** |
| Pra-registrasi uji | ◐ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ |
| Dataset terbuka + API | ◐ | ✓ (HF) | ✗ | ✗ | ◐ | ◐ | ✗ | ◐ (HF model) | ✓ |
| Bahasa Indonesia | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **✓** |
| Uji transfer lintas benua | ◐ (9 region, satu metode) | ✓ (global) | ✗ | ✗ | ✗ | ✓ (global) | ◐ (3 region) | ◐ | ✓ (Indonesia + Amazon, suite penuh) |
| Skala data global siap pakai | ✓ | **✓ (640 jt baris)** | ✗ | ✗ | ✗ | ✓ | ✗ | ◐ | ◐ (Indonesia penuh + 1 wilayah transfer) |
| Bersih dari risiko pre-build | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **✓ (dibangun 14-15 Nov)** |

### 4.3 Skor perkiraan per kriteria resmi

Skor 1-5 adalah **penilaian kualitatif** dari README pesaing dan rencana Second Sight v2 jika **P0+P1 selesai**. Bukan prediksi hasil. Pesaing bisa saja lebih baik di project page atau video mereka yang tidak kita lihat.

| Kriteria | KW | FH | FC | EG | IC | BC | IG | **Second Sight v2 (P0+P1)** | **Second Sight v2 (hanya P0)** |
|---|---|---|---|---|---|---|---|---|---|
| Impact | 4 | 4 | 3 | 4 | 3 | 3 | 3 | **5** | 4 |
| Creativity | 4 | 4 | 4 | 3 | 3 | 3 | 3 | **5** | 3 |
| Validity | 5 | 5 | 4 | 2 | 4 | 4 | 3 | **5** | 4 |
| Relevance | 5 | 5 | 4 | 4 | 5 | 5 | 4 | **5** | 5 |
| Presentation | 4 | 3 | 3 | 3 | 3 | 4 | 3 | **4-5** | 4 |
| **Total (maks 25)** | 22 | 21 | 18 | 16 | 18 | 19 | 16 | **24-25** | 20 |
| Risiko diskualifikasi pre-build | Tinggi | Tinggi | Tinggi | Tinggi | Tinggi | Tinggi | Tinggi | **Rendah** | Rendah |

**Cara membaca:**
- Dengan **hanya P0**, Second Sight berada di level pesaing kuat (setara Burn Calendar/Icarus), **belum di atas** Kiln Watch dan Fire Harmony. Artinya **P1 adalah pembeda yang wajib dikejar**, bukan bonus.
- Dengan **P0+P1**, Second Sight unggul di Impact (lapisan keputusan untuk lembaga nyata), Creativity (triangulasi, tiga keadaan, κ dinamis, analog ENSO), dan setara atau lebih baik di Validity (SiPongi + uji fisik + 5 seam).
- Presentation bergantung pada eksekusi video 30 detik. Riset menunjukkan pesaing kuat sering lemah di sini (Fire Harmony sangat kompleks, IGNIS feature soup).

### 4.4 Peta posisi

```
                  Kedalaman sains & validasi
                           ▲
                         5 │                              ★ Second Sight v2 (P0+P1)
                           │        FH ●        KW ●
                           │
                         4 │   FC ●       IC ●   BC ●     ○ Second Sight v2 (hanya P0)
                           │              PS ●
                         3 │                    IG ●
                           │
                         2 │                                 EG ●
                           │  Dashboard karhutla Indonesia ● (operasional, tanpa sejarah)
                         1 └──────────────────────────────────────────────────────────►
                              1        2        3        4        5
                          Relevansi keputusan untuk pengguna nyata (Indonesia)
```

### 4.5 Di mana Second Sight kalah, seri, dan menang (jujur)

| Status | Dimensi | Penjelasan | Strategi |
|---|---|---|---|
| **Kalah** | Skala data global | Fire Harmony memproses 640 juta baris global; Kiln Watch dan project-shift global | Jangan bersaing di skala. Bingkai: "kedalaman di kasus tersulit + metode bebas-wilayah + uji transfer" |
| **Kalah** | Kematangan produk saat ini | Pesaing sudah punya app jadi (karena membangun sebelum event) | Kualitas > fitur; tekankan kepatuhan aturan secara halus ("built entirely during the hackathon", commit history) |
| **Kalah** | Forecast | FH, EG, IG punya model prakiraan | Sengaja tidak bersaing; klimatologi kondisional + backtest lebih jujur |
| **Seri** | Grid bersama, interval, LOYO, sunset test, rantai NOAA-20 | Sudah dilakukan pesaing terbaik | Wajib setara; bukan pembeda |
| **Seri** | Seam/placebo | FH sudah punya | Lampaui dengan seri rasio vs referensi di 5 seam + drift |
| **Menang** | Strata gambut dalam kalibrasi + uji hipotesis | Tidak ada | Momen sains utama |
| **Menang** | κ dinamis bersyarat FRP dengan koefisien yang bisa ditafsir | Tidak ada yang eksplisit | Grafik κ vs φ |
| **Menang** | Drift orbit dibuktikan dengan fisika diurnal | Tidak ada | Panel "seam tak terlihat" |
| **Menang** | Triangulasi + badge A/B/C | Tidak ada | Badge di kalender & brief |
| **Menang** | Tiga keadaan (tidak teramati) | Tidak ada di level sel | Arsir di kalender |
| **Menang** | Validasi vs SiPongi + uji Field 2016 | Tidak ada | Tabel validasi |
| **Menang** | Peluang keputusan (KHG rank prob., kalender kesiagaan) | Tidak ada | Layar prioritas |
| **Menang** | Bahasa Indonesia + KHG + brief terverifikasi + evidence ledger | Tidak ada | Demo lokal |
| **Menang** | Bebas risiko pre-build | Hampir semua pesaing kuat berisiko | Commit history publik |

### 4.6 Head-to-head singkat (untuk menjawab "apa bedanya dengan tim X?")

Nada jawaban: menghargai pekerjaan mereka, lalu menyebut perbedaan konkret.

| Pesaing | Yang harus diakui | Perbedaan Second Sight dalam satu kalimat |
|---|---|---|
| **Kiln Watch** | Uji "matikan MODIS" dan rantai NOAA-20/21 mereka sangat baik | "Kami memakai uji serupa, tetapi faktor kami berubah menurut intensitas api bulan itu, dipisah untuk gambut, dan divalidasi terhadap data resmi Indonesia." |
| **Fire Harmony** | Skala global dan uji seam mereka kuat | "Kami memilih model yang bisa dijelaskan dengan fisika (κ dinamis + prior operator terpublikasi), menambahkan drift orbit sebagai seam kelima, dan mengubah hasilnya menjadi peluang keputusan untuk lembaga Indonesia." |
| **flare-chronos** | Fisika footprint mereka paling detail | "Kami memakai operator deteksi yang sudah dipublikasi sebagai prior, lalu memvalidasinya terhadap Aqua tanpa fitting, di seluruh Indonesia, bukan dua AOI." |
| **EG FireTrack** | Mereka paling dekat dengan pengguna Borneo | "Sejarah kami mulai 2001, bukan 2017, sudah divalidasi, mencakup Sumatra, dan memberi peluang berbasis sejarah, bukan aturan tetap." |
| **Icarus / project-shift** | Disiplin pra-registrasi mereka patut dicontoh | "Kami memakai disiplin yang sama, menampilkannya langsung di aplikasi (validasi hidup), dan menghubungkannya ke setiap angka lewat evidence ledger." |
| **Burn Calendar** | UX kalender mereka bersih | "Kalender kami menambahkan badge keyakinan triangulasi dan membedakan 'tidak ada api' dari 'tidak terlihat'." |
| **IGNIS** | Fitur statistik mereka sangat banyak | "Kami memilih sedikit fitur yang langsung menjawab keputusan, dan setiap angka bisa dilacak sumbernya." |

---

## 5. Validasi dan ablation v2

### 5.1 Suite validasi (tambahan v2 ditandai ★)

| ID | Uji | Metrik | Aturan lulus (usulan, tetapkan di S0) |
|---|---|---|---|
| V1 | LOYO 2012-2021 | MdAPE tahunan, Spearman, bias | M4 ≤ M3 ≤ M1 dalam MdAPE |
| V2 | LORO | Sama | Tidak memburuk drastis vs V1 |
| V3 | Seam (5 seam) pada `z_t = log H − log R` | Δ_seam ± CI, Pettitt p, posisi vs placebo | Δ_seam di dalam rentang placebo 90% |
| V4 ★ | Drift fisika (U5) | Slope dan r dari R_obs ~ R_pred 2022-2026 | r > 0 signifikan; M3x lebih buruk dari M3 |
| V5 | MODIS sunset (kalibrasi 2012-2016 → 2017-2021) | KGE | M4 > M1 |
| V6 | SiPongi (tahunan, nasional + provinsi) | Spearman | ρ(H) > ρ(raw) |
| V7 | Sensitivitas (confidence, grid, strata, n0) | Perubahan anomali 2026 | Kelas anomali 2026 stabil |
| V8 | Field 2016 (api vs hujan musim kering) | Parameter kurva 2003-11 vs 2012-25 | Tidak beda signifikan (H); beda (raw) |
| V9 | Hipotesis gambut H1-H3 | Rasio + CI | Sesuai aturan keputusan 08 §7.7 |
| V10 | Kesepakatan flag anomali | F1, Cohen's κ | κ ≥ [tetapkan] |
| V11 ★ | Backtest kalender kesiagaan (U6) | Hit/miss/alarm palsu sebelum September | Dilaporkan; tidak ada ambang lulus (deskriptif) |
| V12 | Ranking tahun ekstrem | Spearman peringkat tahunan | Terjaga |
| V13 ★ | Observabilitas bermakna (U4) | ρ vs luas terbakar pada O tinggi vs rendah | ρ(O tinggi) > ρ(O rendah) |
| V14 ★ | Triangulasi per era (U3) | Proporsi sel C pra-2012 / overlap / pasca-2021 | Pasca-2021 tidak lebih buruk dari overlap |
| V15 ★ | Koefisien fisika (U1) | Tanda dan CI β1, β2 | Dilaporkan sesuai prediksi atau tidak |
| V16 ★ | Prior fisika vs empiris (U2) | m_s vs κ_s per strata | Dilaporkan (kesesuaian atau temuan) |
| V17 ★ | Transfer global (U10) | V1, V3, V5 di Amazon | Dilaporkan berdampingan |

### 5.2 Tabel ablation M0-M8 (diisi dari data)

| ID | Metode | KGE overlap | LOYO MdAPE | LOYO 2015/2019 | Sunset KGE | Δ_seam 2012 | ρ SiPongi | Coverage 90% | Param |
|---|---|---|---|---|---|---|---|---|---|
| M0 | Raw concat | | | | | | | n/a | 0 |
| M1 | Rasio global tunggal | | | | | | | | 1 |
| M2 | Rasio per wilayah × musim | | | | | | | | |
| M2b | Quantile mapping (pola Burn Calendar) | | | | | | | | |
| M3 | v1: strata + gambut + siang/malam + EB, 2012-2021 | | | | | | | | |
| M3x | M3 dengan kalibrasi 2012-2025 (uji drift) | | | | | | | | |
| **M4** | **v2: κ dinamis bersyarat FRP (U1)** | | | | | | | | |
| M5 | M4 + prior fisika Sofiev (U2) | | | | | | | | |
| M6 | H_large (FRP floor, tanpa kalibrasi) | | | | | | | n/a | 1 |
| M7 | H_energy (ΣFRP) | | | | | | | | |
| M8 | Operator Sofiev murni (tanpa fitting lokal) | | | | | | | | 0 lokal |

**Tiga baris yang paling menentukan cerita:**
1. **M3 vs M4 di kolom "LOYO 2015/2019"**: apakah κ dinamis memperbaiki tahun ekstrem.
2. **M3 vs M3x**: apakah drift benar-benar merusak kalibrasi.
3. **M8 vs data**: apakah fisika global cocok dengan Indonesia tanpa fitting.

---

## 6. Demo v2

### 6.1 Momen wow yang diperbarui (urut prioritas)

1. **Toggle raw → harmonized** dengan animasi (lompatan 2012 hilang) dan **badge A/B/C** muncul di sel.
2. **Sel berarsir "tidak teramati"** di puncak 2015/2019: "di sini satelit tidak bisa melihat; nilai sebenarnya ≥ X".
3. **"September 2026: peringkat [n] dari [N] tahun El Niño"** + kalender kesiagaan.
4. **Tabel prioritas KHG dengan peluang** ("KHG X: [hasil]% peluang masuk 10 besar").
5. **Lab Sains:** κ vs φ (fisika intensitas api), gambut malam vs siang, drift orbit (R_obs vs R_pred).
6. **Brief siaga** dengan evidence ID di catatan kaki.

### 6.2 Storyboard video 30 detik v2 (EN)

| Waktu | Visual | Narasi |
|---|---|---|
| 0:00-0:02 | Judul "Second Sight" + tim + Bandung | "Second Sight, from Bandung, Indonesia." |
| 0:02-0:07 | Kalender mentah melompat di 2012; teks "5 hidden seams"; ikon satelit S-NPP "off: 2 Nov 2026" | "Every time satellites change, fire history lies. Indonesia's record has five hidden seams." |
| 0:07-0:12 | Gambut malam: titik VIIRS terang, MODIS kosong; sel berarsir "unobserved" di 2015 | "The lie is biggest in smouldering peat, and under smoke, where satellites go blind." |
| 0:12-0:20 | Toggle → harmonized; badge A/B/C; teks "NASA FIRMS MODIS + VIIRS · physics-informed · peat-aware · uncertainty everywhere" | "Second Sight rebuilds 25 years of NASA fire data on one honest scale, checks itself three ways, and knows when it can't see." |
| 0:20-0:26 | Tabel prioritas KHG dengan peluang + brief PDF | "So disaster agencies get decisions, not just maps: which peatlands to protect first, with odds." |
| 0:26-0:30 | Panel validasi (satu angka) + peta dunia (Indonesia + Amazon) | "Validated against official records, ready for a world without MODIS." |

### 6.3 Perubahan slide (dari 08 §8.2)

- **Slide 4 "How it works":** diagram 15 stage diringkas menjadi 5 kotak: *Clean → Cells → Physics-informed calibration → Triangulate & observability → Decisions*.
- **Slide 5 "What we found":** pilih dua: κ vs φ, gambut siang/malam, drift orbit.
- **Slide 6 "How sure are we":** baris M0, M3, M4 dari ablation + 3 uji kunci (seam, sunset, SiPongi) + transfer Amazon.

---

## 7. Dampak v2 pada rencana 48 jam

### 7.1 Tambahan effort

| Upgrade | Effort (jam-orang) | Pemilik | Kapan |
|---|---|---|---|
| U1 κ dinamis | 4-6 | R2 | H1 21:00-24:00 setelah κ statis |
| U2 prior fisika | 6-8 | R3 | H2 06:00-12:00 (P1/P2) |
| U3 triangulasi | 3-4 | R3 | H2 06:00-10:00 |
| U4 tiga keadaan | 4-5 | R1 | H2 06:00-10:00 (CMG diunduh H1) |
| U5 drift fisika | 4-6 | R3 | H1 13:00-21:00 (LST sudah dari S3) |
| U6 keputusan berprobabilitas | 4-5 | R2 | H2 10:00-14:00 |
| U7 evidence ledger | 3 | R1 + R4 | H2 10:00-14:00 |
| U8 validasi hidup | 2 | R3 | H1 (S0) + H2 |
| U9 dataset terbuka | 2-3 | R1 | H2 14:00-18:00 |
| U10 transfer global | 3-4 | R6/R1 | H2 10:00-14:00 (P2) |
| U11 repeat-burn | 2-3 | R2 | P2, jika ada waktu |
| **Total tambahan** | **37-49** | | |

Dengan 5-6 orang × ~36 jam kerja efektif ≈ 180-215 jam-orang, dan v1 sudah membutuhkan ~120-140 jam-orang, **v2 penuh mepet**. Karena itu urutan prioritas di bawah wajib dipatuhi.

### 7.2 Urutan prioritas v2

1. **P0 (wajib):** pipeline S0-S5, S7 versi statis (M3), S8, S10, S11 inti (V1, V3, V5, V9), S13 dasar, S15 app inti.
2. **P1 urutan 1:** U1 κ dinamis (M4) → U5 drift → U3 triangulasi → U6 kalender kesiagaan.
3. **P1 urutan 2:** U4 tiga keadaan → U7 evidence ledger → U9 dataset terbuka → V6 SiPongi → V8 Field.
4. **P2:** U2 prior fisika → U10 transfer → U11 repeat-burn → A1 query bahasa alami.

### 7.3 Garis potong v2

| Waktu | Jika tertinggal, potong | Tetap |
|---|---|---|
| H1 24:00 | U2, U10, U11 | M3 + V9 + V3 |
| H2 10:00 | U4 versi CMG → pakai missing_data saja; U6 rank prob. → hanya kalender kesiagaan | U1, U5, U3 |
| H2 14:00 | U7 → evidence hanya di CSV dan brief; U9 → CSV unduhan saja | Panel validasi |
| H2 18:00 | Semua fitur baru | Video, project page |

---

## 8. Risiko tambahan v2

| Risiko | Mitigasi | Fallback |
|---|---|---|
| U1 overfit (terlalu banyak kovariat) | Mulai dengan φ saja; LOYO sebagai penentu | Pakai M3 |
| U1 tanda β1 berlawanan dengan prediksi fisika | Itu temuan; periksa definisi φ dan F\* | Laporkan apa adanya |
| U2 koefisien Sofiev salah | Verifikasi ke repo/paper sebelum pakai | Hapus U2 |
| U3 seri tidak sepakat di banyak sel | Itu informasi; periksa F\* dan kalibrasi energi | Tampilkan badge tetapi jangan jadikan momen utama |
| U4 akses CMG gagal | Unduh di H1 | missing_data + ERA5 cloud |
| U6 sampel tahun El Niño kecil | Estimator Laplace + interval | Tampilkan sebagai peringkat, bukan peluang |
| Kompleksitas cerita meningkat | Video tetap satu pertanyaan + satu momen | Detail ke project page |
| Beban kerja melebihi kapasitas | Urutan prioritas §7.2 | Garis potong §7.3 |

---

## 9. Catatan kejujuran

1. Skor dan posisi pesaing berasal dari README mereka per 13 Nov 2026. Project page, video, dan versi akhir mereka bisa berbeda.
2. Semua keunggulan Second Sight v2 adalah **rencana**. Posisi "unggul" baru nyata jika P1 selesai dan uji lulus.
3. Beberapa upgrade (U1 tanda β1, U2 kecocokan operator, H1/H2 gambut) bisa menghasilkan hasil negatif. Rencana ini memperlakukan hasil negatif sebagai temuan yang dilaporkan, bukan kegagalan yang disembunyikan.
4. Klaim "unik" berarti tidak ditemukan pada 43 repo yang diperiksa. Repo baru bisa muncul selama hackathon.
5. Angka media tentang musim 2026 dipakai hanya sebagai konteks. Angka di pitch sebaiknya berasal dari data FIRMS yang diolah sendiri.
