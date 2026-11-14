# 06 · Pendekatan Teknis Lanjutan: Fisika, Statistik, Benchmark, AI/Agent, dan Stack

> Dokumen ini menjawab: *"Kalau mau benar-benar bagus secara teknis, pendekatan apa yang bisa dipakai?"*
> Sumber detail: [_raw/pendekatan-fisika-statistik.md](_raw/pendekatan-fisika-statistik.md) (fisika deteksi, 10 ide harmonisasi, benchmark) dan [_raw/pendekatan-ai-agent-teknis.md](_raw/pendekatan-ai-agent-teknis.md) (ML, LLM agent, stack, matriks keputusan 22 baris).
> Dasar sains umum ada di [05-sains-dan-data.md](05-sains-dan-data.md).
> **Catatan aturan 2026:** AI ("Super Intelligence") tidak boleh dipakai untuk menghasilkan ide solusi, dan kode/data buatan AI wajib diakui. Dokumen ini adalah bahan riset. Pilihan pendekatan final adalah keputusan tim.

## 0. Ringkasan dalam satu tabel

| Lapisan | Pendekatan unggulan | Kenapa membedakan | Effort 48 jam |
|---|---|---|---|
| Fisika | **Observation operator Sofiev & Kouznetsov 2026**: "lihat VIIRS dengan mata MODIS" | Harmonisasi berbasis fisika sensor yang sudah peer-reviewed, bukan sekadar rasio empiris | Sedang (8-10 jam) |
| Fisika | **Common FRP floor**: hanya hitung api yang cukup kuat untuk terlihat kedua sensor | Indeks "aktivitas api besar" yang hampir bebas seam, grafiknya mudah dibaca juri | Rendah (3-4 jam) |
| Fisika | **Koreksi drift orbit + siklus diurnal** | **"Seam tersembunyi" yang belum ditangani pesaing mana pun** | Sedang |
| Fisika | **Normalisasi awan/overpass** (formula resmi MODIS CMG) | Menangani asap/awan Indonesia; semua pesaing mengakuinya sebagai gap | Sedang (4-6 jam) |
| Statistik | **Bayesian gamma-Poisson** rasio per provinsi × gambut/mineral × siang/malam | Credible interval jujur + temuan gambut orisinal | Rendah (2-3 jam) |
| Statistik | **Change-point pada seri rasio vs referensi** (Pettitt/PELT + placebo) | Bukti statistik bahwa seam hilang, bukan sekadar "terlihat mulus" | Rendah (2 jam) |
| Validasi | **"Simulated MODIS sunset"** + LOYO/LORO + KGE + ranking El Niño | Menjawab "apakah valid setelah MODIS mati 2027?" | Rendah-sedang |
| ML | **Conformal prediction** (Mondrian per gambut/mineral) | Coverage empiris interval, angka Validity yang jarang dimiliki tim lain | Rendah-sedang |
| AI | **LLM sebagai setir, bukan mesin**: query bahasa alami → JSON → pipeline deterministik; brief BPBD dengan verifier angka | AI terukur dengan eval set, bukan chatbot | Sedang (4-6 jam) |
| Stack | **DuckDB + Parquet, precompute statis, duckdb-wasm** | Demo andal offline, AOI bebas tanpa backend berat | Rendah-sedang |

Kalimat inti untuk juri (dari riset fisika): *"Kami tidak menebak rasio. Kami memodelkan **mengapa** MODIS melihat lebih sedikit (ukuran piksel, FRP, siang/malam, awan, jam lintas), memakai operator deteksi yang sudah dipublikasi, lalu membuktikan secara statistik bahwa seam hilang, dan tetap hilang ketika MODIS mati."*

---

## 1. Fisika deteksi api: yang perlu dipahami tim

### 1.1 Kenapa satelit melihat api

- **Hukum Planck:** api (~800-1400 K) memancarkan radiasi jauh lebih kuat di **4 µm (MIR)** daripada latar belakang (~300 K), sementara di 11 µm (TIR) bedanya kecil. Algoritma mendeteksi api dari **lonjakan suhu kecerahan di 4 µm relatif terhadap 11 µm dan terhadap piksel tetangga** (algoritma kontekstual).
- **Api sub-piksel:** api sebesar beberapa ratus m² di dalam piksel 1 km tetap bisa terlihat karena sinyal 4 µm sangat nonlinier terhadap suhu. Tetapi makin besar piksel, makin "tercairkan" sinyalnya. **Inilah inti perbedaan MODIS vs VIIRS.**
- **Ambang MODIS C6** (Giglio et al. 2016, terverifikasi): api jika T4 > 360 K (siang) / 320 K (malam), ditambah uji kontekstual.
- **VIIRS 375 m** (Schroeder et al. 2014): kanal I4 jenuh di 367 K dan I5 di 380 K; uji siang/malam berbeda.

### 1.2 Fire Radiative Power (FRP)

- FRP (MW) = ukuran intensitas radiasi api, dihitung dari radiansi MIR (metode Wooster 2003). Konstanta MODIS a = 3,0e-9. **FRP C6 rata-rata ~16% lebih rendah dari C5**, jadi jangan campur koleksi.
- **VIIRS FRP berasal dari kanal M13 750 m dan dibagi rata ke piksel 375 m yang berbagi piksel M13.** Akibatnya FRP VIIRS per piksel **tidak boleh dibandingkan langsung**: jumlahkan dulu per sel grid atau klaster.
- Konversi energi ke bahan bakar: **0,368 ± 0,015 kg/MJ** (Wooster 2005). Metode FRP akurat ±12% hanya untuk emitter 665-1365 K dan **underestimate di bawah ~650 K**, sehingga relevan untuk gambut membara.

### 1.3 Geometri piksel

- Luas piksel MODIS naik dari 1 km² (nadir) sampai **9,66 km²** di tepi swath; VIIRS I-band hanya ~4,5×.
- Kolom `scan × track` di FIRMS memberi ukuran piksel setiap deteksi, sehingga koreksi geometri bisa dilakukan per deteksi.

### 1.4 Batas deteksi kuantitatif (Sofiev & Kouznetsov 2026, GMD 19:10123)

| Sensor | Siang (tengah swath) | Malam (tengah swath) | Tepi swath |
|---|---|---|---|
| MODIS C6.1 | **5,7 MW** | **3,7 MW** | ~42 MW (siang), ~39 MW (malam) |
| VIIRS C2 | **3,7 MW** | **~0,5-0,7 MW** | Jauh lebih seragam |

- Model: kurva logistik `P_det(F, A) = σ(r(A)·(F − D_p(A)))`, dengan **D_p (FRP saat ~50% api terlewat) naik linear terhadap luas piksel A**, koefisien siang dan malam terpisah.
- POD global untuk api kuat: 78% (MODIS) / 88% (VIIRS). Di sebagian wilayah ekuatorial berawan: **<30% / <40%**.
- **Kode terbuka:** github.com/fmidev/FRP_OOp. Koefisien diambil dari Tabel 1-2 paper atau repo (ekstraksi teks koefisien oleh agen riset rusak, **belum terverifikasi**).

---

## 2. Sepuluh ide harmonisasi berbasis fisika dan statistik

| # | Ide | Rasional | Formula / sketsa | Data | Effort | Nilai |
|---|---|---|---|---|---|---|
| a | **MODIS-equivalent VIIRS** (observation operator) | Turunkan VIIRS ke "apa yang akan dilihat MODIS" | Agregasi FRP VIIRS ke sel 1 km → `E[N] = Σ P_det(F_cell, A)` dengan A disampel dari distribusi swath Aqua; varians `Σ P(1−P)` = **ketidakpastian fisik** | FIRMS (`frp, scan, track, daynight, acq_time`) + koefisien Sofiev | Sedang | ★★★ |
| b | **Common FRP floor** | Di atas FRP tertentu kedua sensor mendeteksi ~100%. Analog "magnitude of completeness" katalog gempa | Plot rasio `N_V(≥F)/N_M(≥F)` vs F; titik mendatar ≈1 adalah F*. Batasi scan ≤30-40° | FIRMS saja | **Rendah** | ★★★ |
| c | **FRP → FRE (energi)** | Energi adalah besaran fisik; total FRP didominasi api besar yang terlihat kedua sensor | `FRE = ∫FRP dt` dengan model diurnal; label "radiated fire energy", **bukan karbon** untuk gambut | FIRMS | Rendah (ΣFRP) / Sedang (FRE) | ★★ |
| d | Normalisasi luas teramati | Satu deteksi tepi swath mewakili area ~10× lebih luas | `ρ = N_fire / Σ A_observed` | Butuh fire mask L2/L3 | Sedang | ★★ |
| e1 | **Normalisasi awan + overpass** | Formula resmi produk MODIS CMG | `N'' = N' / (1 − f_cloud)`; layer `CloudCorrFirePix`, `CloudPix`, `TotalPix` di **MOD14CMQ/MYD14CMQ** (0,25°, bulanan/8-harian). Untuk VIIRS pakai f_cloud Aqua sebagai proxy (selisih <50 menit) | CMG (SFTP UMD) | Sedang | ★★★ |
| e2 | **Koreksi siklus diurnal + drift orbit** | Puncak api tropis 13:00-18:30 (Giglio 2007). Perubahan jam sampling **menghasilkan tren palsu besar** | Model Gaussian `f(t) = b + exp(−(t−h)²/2s²)`; `N_corr = N_obs · f(13:30)/f(t_obs)`; t_obs dari `acq_time` → waktu matahari lokal | FIRMS + parameter dari rasio Terra/Aqua 2003-2019 | Sedang | ★★★ **wow** |
| f | **Bayesian hierarchical** | Rasio per sel sedikit data sangat bising | Cepat: `θ_r ~ Gamma(a,b)`, posterior `Gamma(a + ΣV, b + ΣM)`. Penuh: NegBin dengan efek region, bulan, siang/malam, **gambut**, awan (PyMC/bambi) | FIRMS + peta gambut | Rendah (cepat) / Sedang (penuh) | ★★★ |
| g | **Change-point** | Klaim "seam hilang" harus diuji statistik | Uji **seri rasio** `z_t = log(H_t) − log(R_t)` vs referensi (Aqua-only, MCD64A1), bukan seri langsung (karena El Niño 2015 adalah break nyata). Pettitt, PELT (`ruptures`), SNHT, + **placebo seams** | Seri hasil | Rendah | ★★★ |
| h | Uji tren Theil-Sen + Mann-Kendall (modified) | Tren raw didominasi seam palsu | Bandingkan slope M0 vs harmonized; regresikan Niño3.4/DMI dulu | Seri hasil | Rendah | ★★ |
| i | Event-based counting | Satu api besar = 1 piksel MODIS tetapi 5-10 piksel VIIRS | ST-DBSCAN dengan eps dalam km (sama untuk kedua sensor) | FIRMS | Sedang | ★★ |

### Seam nyata yang harus diuji (daftar lengkap)

| Tanggal | Peristiwa |
|---|---|
| Nov 2000 | Terra mulai |
| Jul 2002 | Aqua masuk |
| Jan 2012 | S-NPP VIIRS mulai |
| 2018 | NOAA-20 mulai |
| 16 Agu-2 Sep 2020 | Outage FMU Aqua (MOD14 User Guide §7.2.4) |
| 2020+ | **Drift Terra** ke pagi |
| 2021/2022+ | **Drift Aqua** ke sore (~15:30-15:45 pada 2026) |
| 2023 | NOAA-21 |
| 2 Nov 2026 | S-NPP berhenti di FIRMS |
| akhir 2026-2027 | Terra/Aqua berhenti (tanggal sumber bertentangan) |

### "Seam tersembunyi" orbit drift (wow factor sains nomor 1)

- Terra bergeser ke jam lebih pagi sejak 2020, Aqua ke sore sejak ~2021-2022.
- Akibatnya **hitungan Terra pasca-2020 bisa turun bukan karena api berkurang, tetapi karena Terra melihat pada jam yang lebih "sepi api"**. Aqua sebaliknya.
- Ini artefak yang **bisa dibuktikan secara kuantitatif** dan relevan langsung dengan berakhirnya MODIS.
- Model diurnal yang sama juga menyelesaikan seam Terra-only (2000-2002), yang di repo pesaing ditangani dengan rasio empiris.
- Demo: grafik "jam lintas Terra vs waktu" ditumpuk dengan "rasio Terra/Aqua mentah vs terkoreksi".

---

## 3. Fisika khusus gambut: hipotesis yang bisa diuji tim

| Fakta | Sumber |
|---|---|
| Gambut membara puncak ~600 °C di dalam lapisan; permukaan yang teramati lebih dingin (tertutup arang, abu, asap) | Rein 2009 (via presentasi) |
| Membara persisten berminggu-minggu dan **tidak padam di malam hari** | Literatur gambut |
| MODIS melewatkan front api gambut intensitas rendah di bawah asap tebal (Sebangau 2015) | Atwood et al. 2016 |
| VIIRS ~80% sesuai Landsat untuk api kecil; ~90% dengan buffer klaster + siang/malam | Sofan et al. 2020 |
| Produk burned area MODIS menangkap hanya 38-48% BA di Indonesia | Vetrita et al. 2021 |
| Gambut ~71% PM2.5 primer kebakaran Sep-Okt 2015 | Kiely et al. 2019 |
| Lonjakan api saat curah hujan musim kering **<4 mm/hari** | Field et al. 2016 (PNAS) |

**Hipotesis yang bisa diuji dalam ≤3 jam** (overlay FIRMS dengan peta gambut, rasio per strata dengan CI bootstrap):

- **H1:** rasio VIIRS:MODIS **lebih tinggi di gambut** daripada di tanah mineral.
- **H2:** rasio **malam ≫ siang**, terutama di gambut (ambang malam VIIRS ~0,5-0,7 MW vs MODIS 3,7 MW).
- **H3:** rasio naik pada tahun asap berat (2015, 2019). Arah efek **belum pasti**, karena asap juga menekan VIIRS.

Jika H1/H2 terbukti, ini **temuan ilmiah orisinal untuk Indonesia** (belum ada rasio peer-reviewed khusus gambut, lihat [05](05-sains-dan-data.md)) dan bisa menjadi cerita utama.

Peta gambut: Kementan/BBSDLP (Anda et al. 2021, ~13,4 Mha) [akses belum dicek] atau PEATMAP (Xu et al. 2018) sebagai alternatif global.

---

## 4. Benchmark dan evaluasi: cara membuktikan harmonisasi bekerja

### 4.1 Prinsip

1. **Setiap metrik punya baseline** (M0 raw concat), supaya juri melihat besarnya perbaikan.
2. **Out-of-sample:** LOYO (leave-one-year-out), LORO (leave-one-region-out), **leave-one-fire-season-out**. **Jangan random K-fold** (autokorelasi spasial-temporal membuat skor terlalu optimistis). Hitung median historis **di dalam** fold (hindari leakage).
3. **"Simulated MODIS sunset"**: kalibrasi pada 2012-2018, prediksi MODIS-equivalent 2019-2025 dari VIIRS saja, bandingkan dengan MODIS aktual. Ini meniru kondisi nyata 2027+.
4. **Uji fisik:** hubungan nonlinier api vs curah hujan (<4 mm/hari) harus konsisten **sebelum dan sesudah 2012**. Jika slope respons berubah tepat di 2012, harmonisasi gagal.
5. **Jujur soal referensi:** GFED5 memakai active fire MODIS untuk burned area gambut, jadi tidak independen penuh.

### 4.2 Metrik

| Kelompok | Metrik |
|---|---|
| Kesesuaian overlap | Pearson r (log1p), Spearman ρ, bias %, RMSE log, **KGE** (Gupta et al. 2009) |
| Ketidakpastian | Coverage interval 90% (target ~0,9), CRPS, PIT histogram |
| Seam | p-value Pettitt dan Δ_seam ± CI pada seri rasio, dibandingkan distribusi placebo |
| Variabilitas antar-tahun | Spearman ranking total tahunan; top-k overlap tahun ekstrem; korelasi Niño3.4/DMI |
| Untuk pengguna | Bias total bulanan per provinsi; **kesepakatan flag anomali** (bulan "di atas p90" menurut MODIS asli vs MODIS-equivalent) dengan F1/Cohen's κ |
| Tren | Theil-Sen slope M0 vs harmonized |

### 4.3 Template tabel benchmark untuk juri (isi dengan angka nyata, jangan dikarang)

| ID | Metode | KGE overlap | Bias % | LOYO r | LORO r | Sunset KGE | Pettitt p @2012 | Δ_seam | Drift dihapus? | Coverage 90% | ρ vs MCD64A1 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| M0 | Raw concat | | | | | | | | ✗ | n/a | |
| M1 | Rasio global konstan | | | | | | | | ✗ | | |
| M2 | Rasio per wilayah × bulan | | | | | | | | ✗ | | |
| M3 | Bayesian (+gambut, siang/malam) | | | | | | | | ✗ | | |
| M4 | M3 + awan/overpass + diurnal | | | | | | | | ✓ | | |
| M5 | Fisika: FRP floor + operator MODIS-equivalent | | | | | | | | ✓ | | |
| M5-E | Event-based di atas M5 | | | | | | | | ✓ | | |

Tambahkan kolom "jumlah parameter yang di-fit". M5 memakai operator yang dikalibrasi pihak lain, sehingga parameter lokalnya sedikit, dan ini argumen anti-overfitting.

### 4.4 Tiga grafik ablation paling meyakinkan

1. **Seam plot:** `z_t = log(H/R)` 2008-2016 untuk M0, M2, M5, dengan pita placebo.
2. **FRP-floor plot:** rasio `N_V(≥F)/N_M(≥F)` vs F, siang dan malam, gambut vs mineral.
3. **Drift plot:** jam lintas Terra vs waktu + rasio Terra/Aqua mentah vs terkoreksi diurnal.

### 4.5 Referensi independen

| Referensi | Periode | Catatan |
|---|---|---|
| MCD64A1 C6.1 (500 m) | 2000-2026 | Omisi tinggi di gambut (Vetrita 2021); VNP64A1 sebagai lanjutan |
| GFED5 | 1997-2020 | Tidak independen untuk gambut |
| **SiPongi (luas terbakar resmi)** | ~2015-kini | **Paling relevan untuk juri BRIN/lokal**; gunakan korelasi rank |
| CO/AOD satelit (MOPITT, IASI) | 2000- | Proxy independen intensitas musim |
| CHIRPS/IMERG + Niño3.4/DMI | 1981- | Uji fisik respons kekeringan |

---

## 5. ML yang bermakna (bukan dekorasi)

### 5.1 Hirarki model: bangun dari bawah, berhenti saat waktu habis

| Level | Model | Kenapa |
|---|---|---|
| L0 | Rasio terstratifikasi (gambut × bulan × siang/malam × satelit) | Bisa dijelaskan dalam 1 slide |
| L1 | Observation operator fisika (FRP > batas deteksi MODIS) | Validity tertinggi per jam kerja |
| L2 (opsional) | LightGBM / **GAM** prediksi log1p(MODIS) dari fitur VIIRS + kovariat (gambut, MCD12Q1, awan ERA5, era drift) | Menangkap nonlinier. GAM menghasilkan kurva parsial yang bisa ditunjukkan ("efek fraksi gambut") |
| L3 | **Conformal prediction** (CQR, Mondrian per gambut/mineral; EnbPI/ACI untuk deret waktu, MAPIE) | Interval dengan **coverage empiris** ("interval 90% mencakup 88,7% bulan uji") |

### 5.2 Anomali kalender

- **Utama: persentil terhadap baseline 2003-2022** dalam satuan yang sudah diharmonisasi + interval bootstrap. Untuk AOI kecil yang banyak nol, pakai persentil empiris atau Poisson/NegBin, bukan z-score.
- Opsional: STL robust untuk panel provinsi.
- **Hindari Isolation Forest sebagai metode utama** (alasannya sulit dijelaskan ke BPBD).

### 5.3 Outlook/prakiraan: jangan bersaing di kecanggihan model

- Pesaing sudah membawa LightGBM Tweedie, PatchTST, dan forecast 72 jam.
- Literatur Indonesia: Field 2016 (ambang 4 mm/hari), Spessa 2015 (NHESS, skill musiman ECMWF untuk Kalimantan), Shawki 2017 (CFSv2 + Drought Code memprediksi 2015), **ProbFire** (Nikonovas 2022: skill lead 2-4 bulan di Kalsel, Sumsel, Papua selatan, **tanpa skill di Kalbar**), Mezbahuddin 2023 (muka air gambut simulasi menaikkan R² 0,4 → 0,8).
- **Rekomendasi:** panel **konteks kekeringan** (curah hujan 30/90 hari vs 4 mm/hari, ONI/DMI, Drought Code GEFF-ERA5) yang langsung bisa dibaca BPBD. Outlook ML hanya opsional, dengan validasi forward-chaining dan Brier skill score vs klimatologi.
- Data muka air gambut (TMAT SiPPEG) hanya untuk pengguna terdaftar, **tidak realistis dalam 48 jam** (sebut sebagai future work).

### 5.4 Yang sebaiknya dihindari

| Pendekatan | Alasan |
|---|---|
| Prithvi burn-scar / foundation model | Dilatih di AS, memetakan burned area (bukan hotspot), domain shift ke gambut berawan, butuh GPU, juri akan bertanya "apa hubungannya?" |
| Backcast "VIIRS-equivalent" pra-2012 disajikan seperti observasi | Api kecil yang tak terlihat MODIS tidak bisa direkonstruksi. Risiko Validity tinggi |
| Retrieval Dozier suhu/luas per piksel | Tidak stabil |
| Pemrosesan Himawari mentah | Data besar. Pakai literatur saja untuk bentuk siklus diurnal |
| Klaim emisi karbon gambut dari FRP | Bias rendah yang sudah diketahui |
| Mencampur MODIS C5/C6/C6.1 atau VIIRS C1/C2 | FRP C6 ≈ −16% vs C5 |

---

## 6. LLM agent yang benar: "sains adalah mesinnya, AI adalah setirnya"

### 6.1 Pola sistem EO serius

Earth Copilot (NASA-Microsoft), Google Earth AI Geospatial Reasoning agent, GeoLLM-Engine, ThinkGeo, ESA Φ-lab IC-EO dan EVE: semuanya menempatkan **LLM sebagai perencana/penerjemah yang memanggil tools deterministik, dan mengukur akurasinya dengan benchmark**.

### 6.2 Tiga fitur yang bernilai

| Fitur | Desain | Nilai |
|---|---|---|
| **Query bahasa alami → kalender** ("tampilkan kalender karhutla KHG Sungai Kampar 2015-2025 vs median") | LLM hanya mengisi **JSON schema** → resolver gazetteer deterministik (rapidfuzz) → **chip hasil parsing yang bisa diedit** sebelum dieksekusi → fallback form dropdown bila LLM gagal | BPBD tidak perlu menggambar poligon atau mengenal istilah sensor |
| **Brief situasi Bahasa Indonesia untuk BPBD** | **Facts-first, LLM-second, verifier-last**: kode menghitung fact table → LLM menulis dengan **placeholder** → verifier numerik menolak angka yang tidak ada di fact table → fallback template murni. Kosakata terkendali ("titik panas", "konsisten dengan", bukan "disebabkan oleh") | Langsung bisa ditempel ke laporan siaga |
| **Penjelas anomali** | Aturan atribusi deterministik berbasis literatur (mis. hujan 90 hari <4 mm/hari dan ONI ≥ +0,5 → "konsisten dengan pola kekeringan El Niño (Field 2016)"; lonjakan bertepatan dengan pergantian sensor → "kemungkinan artefak sensor"). LLM hanya memverbalkan dengan **sitasi tetap** | Mencegah salah tafsir artefak sensor, sekaligus cerita Validity |

### 6.3 Evaluasi agen (ditampilkan di README dan 1 slide)

| Uji | Cara | Target |
|---|---|---|
| Parsing NL→JSON | 40-60 query uji (formal, singkatan "Kalteng", typo, campur Inggris) | Exact-match AOI + rentang ≥90% |
| Konsistensi angka | Verifier pada 100 brief | **0 angka tak terlacak** |
| Groundedness klaim | Setiap kalimat kausal memetakan ke aturan yang terpicu | 100% |
| Robustness | Query di luar cakupan ("prediksi 2030", AOI di luar Indonesia) | Menolak dengan sopan |

### 6.4 Gimmick vs nilai

- **Terlihat gimmick:** chatbot sebagai fitur utama, jawaban LLM berisi angka, "AI memprediksi kebakaran" tanpa skill score, multi-agent tanpa alasan, persona/avatar. Kiln Watch (MCP 31 tools), IGNIS (LLM SITREP), dan flare-chronos (LangGraph) sudah membawa AI, jadi **AI per se tidak membedakan**.
- **Terlihat bernilai:** LLM sebagai interface ke pipeline yang bisa diaudit, brief yang langsung dipakai, tabel eval, tombol "lihat angka sumber" di setiap kalimat.
- **Alokasi demo:** ~70% kalender + validasi + ketidakpastian, ~30% interface bahasa alami + brief.
- **Multi-agent LLM untuk ingestion: hindari** (non-deterministik). QA data cukup berbasis aturan: `/api/missing_data/`, `/api/data_availability/`, change-point yang dicocokkan dengan tanggal event sensor, lalu **banner "kesehatan data"** di kalender.

---

## 7. Stack teknis untuk 48 jam

### 7.1 Volume dan akuisisi data

- Estimasi Indonesia 2000-2026: **~5-12 juta baris**, ~150-400 MB Parquet zstd [estimasi, verifikasi setelah unduh]. Cukup di laptop dengan DuckDB.
- **Jalur utama:** FIRMS Archive Download Indonesia (ajukan request **sebelum hackathon**), atau CSV tahunan per negara (teruji tersedia 2000-2025), atau mirror GeoParquet `portolan-mirrors/firms-catalog` (query bbox remote; pihak ketiga, cek lisensi).
- **Top-up NRT:** API area, `DAY_RANGE ≤ 5`, sumber `VIIRS_NOAA20_NRT`, `VIIRS_NOAA21_NRT`, `MODIS_NRT`; kuota 5.000 transaksi/10 menit.
- **CSV FIRMS tidak mengirim header CORS**, sehingga lapisan NRT di browser butuh proxy kecil.
- Data pendukung: ONI/DMI (CSV kecil), CHIRPS bulanan, GEFF-ERA5 Drought Code (CDS bisa antre lama, mulai unduh di jam pertama), MOD14CMQ/MYD14CMQ untuk koreksi awan, peta gambut, batas admin (geoBoundaries/GADM/BIG), KHG (ketersediaan publik belum dicek, siapkan fallback bbox).

### 7.2 Penyimpanan dan komputasi

- **DuckDB + Parquet/GeoParquet**, ekstensi `spatial` (point-in-polygon) dan komunitas `h3`.
- **Grid model 0,25° lat-lon** (selaras ERA5/GEFF/CMG/ProbFire) untuk sains; grid 0,01° untuk fire cell-days; H3 hanya untuk tampilan peta. Jangan menjalankan dua grid di model yang sama.
- Precompute: `daily_cell`, `daily_aoi` (provinsi, kab/kota, KHG), `baseline` (median/persentil), `harmonized` + interval.

### 7.3 Frontend

- Kalender: **ECharts** (calendar/heatmap) atau **Observable Plot** (`cell`).
- Peta: **MapLibre GL JS + PMTiles** (vector tiles statis tanpa tile server) + deck.gl.
- Toggle MODIS asli / VIIRS asli / harmonisasi ± interval, anotasi event sensor, banner kesehatan data, unduh CSV dengan metadata (versi data, filter, baseline).
- AOI bebas: **duckdb-wasm** di browser membaca Parquet via HTTP range request.

### 7.4 Hosting dan keandalan demo

- **Offline-first:** semua agregat diprecompute menjadi file statis (Parquet/JSON/PMTiles) di GitHub Pages/Cloudflare Pages/Netlify.
- Satu backend tipis (FastAPI di Render/Fly.io/HF Spaces) **hanya untuk proxy LLM**, dengan cache respons demo dan fallback template.
- **Rekam video demo cadangan.** Jangan commit MAP_KEY/LLM key.
- Reproducibility: `make data && make model && make site`, versi data (tanggal unduh + hash) di footer, notebook validasi di repo.

### 7.5 Arsitektur rekomendasi (ringkas)

```
OFFLINE (laptop)
  FIRMS archive SP (MODIS C6.1, VIIRS S-NPP/NOAA-20/21) + NRT top-up
    → ingest (filter type, confidence, day/night, satelit, flag SP/NRT)
    → QA rule-based (missing data, change-point vs event sensor) → data_health.json
    → grid (fire cell-days 0,01° → agregat 0,25°)
    → harmonize: L0 rasio Bayesian (gambut × bulan × siang/malam)
                 L1 operator fisika (FRP vs batas deteksi MODIS)
                 + koreksi awan/overpass + diurnal/drift
                 L3 conformal → interval + coverage
    → validasi: LOYO/LORO, sunset backtest, seam + placebo, vs SiPongi/MCD64A1
    → agregat AOI (provinsi, kab/kota, KHG) + baseline 2003-2022 + anomali persentil
    → static bundle (Parquet/JSON/PMTiles) + notebook validasi

ONLINE (demo)
  Frontend statis: MapLibre + PMTiles + deck.gl | kalender ECharts/Plot
    toggle sensor, anotasi seam, banner kesehatan data, CSV, duckdb-wasm untuk AOI bebas
  Backend tipis (LLM saja): /parse (NL→JSON→chip) | /brief (fact table→placeholder→verifier)
                            | /explain (aturan atribusi → verbalisasi + sitasi tetap)
  eval/: 50 query + 100 brief → laporan akurasi
```

---

## 8. Paket rekomendasi berdasarkan ambisi

| Paket | Isi | Untuk siapa |
|---|---|---|
| **Minimum defensible** | Fire cell-days + rasio Bayesian per wilayah × bulan × siang/malam (kalibrasi 2012-2021) + jembatan Terra + kalender median/persentil + LOYO + seam test + CSV | Tim yang ingin aman dan fokus pada UX/dampak |
| **Pembeda sains** | + stratifikasi **gambut vs mineral** (uji H1/H2) + **common FRP floor** + change-point vs referensi + placebo + **sunset backtest** + korelasi SiPongi | Target Best Use of Science + Local Impact |
| **Maksimal** | + operator fisika Sofiev (MODIS-equivalent dengan ketidakpastian fisik) + **koreksi drift/diurnal** + koreksi awan CMG + conformal + LLM brief BPBD dengan verifier + eval set | Tim kuat dengan pembagian peran jelas; risiko scope creep tinggi |

Pelajaran dari pesaing (Fire Harmony 60 GB, IGNIS 11 tab): **kompleksitas yang tidak bisa dijelaskan dalam 30 detik justru melemahkan.** Pilih paling banyak 2-3 "momen sains" yang bisa divisualisasikan, dan sisanya masuk dokumen metodologi.

## 9. Hal yang belum terverifikasi

1. Koefisien tabel Sofiev & Kouznetsov 2026 (ambil langsung dari paper/repo FRP_OOp).
2. Jam lintas Terra saat ini (halaman NASA menampilkan 8:32 dan 9:59), tanggal akhir pengumpulan data Aqua (~Agu 2026?) dan Terra (~Jan 2027?).
3. Ketersediaan produk CMG VIIRS 375 m.
4. Kredensial SFTP UMD untuk MOD14CMQ.
5. Akses peta gambut BBSDLP dan shapefile KHG publik.
6. Apakah CSV NOAA-21 memuat kolom `type`.
7. Lama antrean Archive Download FIRMS.
8. Rentang suhu tepat gambut membara dan angka sekunder Sofan (PoD dasar ~71%).
