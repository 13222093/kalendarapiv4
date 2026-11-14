# 07 · Gap Analysis dan Kandidat USP

> Sintesis dari dokumen 01-06 dan semua catatan `_raw/`.
> **Penting (aturan 2026):** AI tidak boleh dipakai untuk menghasilkan ide solusi. Daftar di bawah adalah **peta celah dan opsi hasil riset**, bukan keputusan. Pemilihan, penggabungan, dan perumusan USP final harus dilakukan tim sendiri saat hackathon.

## 1. Posisi kompetitif dalam satu gambar

```
                     Kedalaman sains / validasi
                                ▲
                                │   Fire Harmony (MY)      Kiln Watch (BD)
                                │   [global, haze MY]      [global, kiln]
                                │          flare-chronos (VN)
                                │          [fisika footprint, Mekong]
                                │   Icarus, project-shift, burn-calendar
                                │
                                │                 ┌───────────────────────────┐
                                │                 │  RUANG KOSONG:            │
                                │                 │  sains setara Tier S      │
                                │                 │  + operasional Indonesia  │
                                │                 │  + gambut + data resmi ID │
                                │                 └───────────────────────────┘
                                │   IGNIS (BD), FireLens, NPC        EG FireTrack (MY)
                                │   [banyak fitur, harmonisasi       [Borneo, BPBD playbook,
                                │    sederhana]                       sains tidak dipublikasi]
                                │
                                │   Dashboard karhutla Indonesia (Pantau Karhutla, Titik Api, ...)
                                │   [operasional kuat, tanpa riwayat harmonisasi]
                                └──────────────────────────────────────────────────────────►
                                   Relevansi operasional untuk pengguna Indonesia
```

**Kesimpulan:** pesaing terkuat secara sains tidak berfokus ke Indonesia, sedangkan proyek Indonesia kuat di operasional tetapi tidak punya riwayat yang konsisten. **Kuadran kanan atas masih kosong.**

## 2. Matriks kapabilitas: siapa melakukan apa

✓ = ada, ◐ = sebagian/lemah, ✗ = tidak ada (berdasarkan README, self-reported)

| Kapabilitas | Kiln Watch | Fire Harmony | EG FireTrack | flare-chronos | Icarus | IGNIS | Pantau Karhutla (ID) | SiPongi | GNW/GFW | **Peluang** |
|---|---|---|---|---|---|---|---|---|---|---|
| Kalender 2000-sekarang | ✓ | ✓ | ✗ (2017+) | ✓ (2 AOI) | ✓ | ✓ | ✗ | ✗ | ✗ (2012+) | Komoditas |
| Harmonisasi lintas sensor | ✓ | ✓ | ◐ | ✓ | ◐ | ◐ | ✗ | ✗ | ✗ | Komoditas |
| Rasio terpisah siang/malam | ✓ | ◐ | ✗ | ◐ | ✗ | ✗ | — | — | — | Jarang |
| **Kalibrasi distratifikasi gambut** | ✗ | ◐ (fitur ML) | ◐ (hanya risk score) | ✗ | ✗ | ✗ | — | — | — | **Kosong** |
| **Koreksi awan/asap per piksel** | ◐ (per satelit) | ◐ (MOD14A1 disebut) | ✗ | ◐ (effort Ω) | ◐ | ✗ | — | — | — | **Hampir kosong** |
| **Koreksi drift orbit + diurnal** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | — | — | — | **Kosong** |
| **Operator deteksi fisik (FRP vs batas MODIS)** | ✗ | ◐ (fisika di 10 tile) | ✗ | ◐ (footprint) | ✗ | ✗ | — | — | — | **Hampir kosong** |
| Change-point + placebo | ◐ (placebo) | ✓ | ✗ | ✗ | ◐ | ◐ (CUSUM) | — | — | — | Sudah ada |
| Uji "MODIS mati" | ✓ | ◐ | ✗ | ✗ | ✗ | ✗ | — | — | — | Sudah ada |
| **Validasi vs statistik resmi Indonesia (SiPongi)** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ◐ (angka berdampingan) | — | — | **Kosong** |
| **Rekonsiliasi SiPongi vs BRIN vs FIRMS** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ◐ | ✗ | ✗ | **Kosong** |
| **Unit Indonesia (KHG, kabupaten, desa)** | ✗ | ✗ | ◐ (provinsi Borneo) | ✗ | ✗ | ✗ | ✓ | ✓ | ◐ | **Kosong di sisi harmonisasi** |
| **Sumatra (Riau, Jambi, Sumsel) sebagai fokus** | ✗ | ◐ (sumber haze) | ✗ | ✗ | ✗ | ✗ | ◐ | ✓ | ✓ | **Kosong di sisi harmonisasi** |
| **Baseline dikondisikan ENSO/IOD** | ✗ | ◐ (driver) | ◐ (ENSO data) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **Kosong** |
| Bahasa Indonesia | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | Kosong di sisi harmonisasi |
| Pengguna resmi Indonesia (BPBD, Manggala Agni) | ✗ | ✗ | ✓ (playbook) | ✗ | ✗ | ✗ | ◐ | ✓ | ✗ | Ada pesaing (EG FireTrack) |
| **Backtest early warning** | ✗ (diakui) | ◐ (Brier outlook) | ◐ (forecast 72 jam) | ✗ | ✗ | ◐ | ◐ (hit-rate desa) | ✗ | ✗ | Hampir kosong |
| **Cross-check Himawari AHI** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **Kosong** (tapi mahal) |
| AI/LLM | ✓ (MCP 31) | ✗ | ✗ | ✓ (LangGraph) | ✗ | ✓ (SITREP) | ◐ | ✗ | ✗ | Komoditas, kecuali yang **diukur** |
| Eval AI terukur (verifier angka, eval set) | ✗ | — | — | ◐ ("grounded") | — | ✗ | — | — | — | **Kosong** |
| Risiko pre-build | **Sangat tinggi** | Tinggi | Tinggi | Tinggi | Sangat tinggi | Tinggi | n/a | n/a | n/a | **Kita: bersih** |

## 3. Daftar celah (gap), diurutkan dari nilai × kelayakan

| # | Celah | Bukti celah | Kenapa penting | Kelayakan 48 jam | Award yang terdampak |
|---|---|---|---|---|---|
| G1 | **Harmonisasi untuk Indonesia, dari sisi Indonesia** | Tidak ada entri Space Apps dari tim Indonesia; pesaing Borneo dibingkai dari Malaysia | Local Impact menuntut masalah lokal spesifik dengan pengguna nyata | Tinggi | Local Impact |
| G2 | **Kalibrasi gambut vs mineral (+ siang/malam)** | Tidak ada yang menguji; literatur belum punya rasio gambut | Gambut = 53% api 2015 di 12% lahan; fisika membara menurunkan deteksi MODIS | Tinggi (≤3 jam uji hipotesis) | Best Use of Science, Local Impact |
| G3 | **Validasi terhadap angka resmi Indonesia (SiPongi)** | Pesaing hanya memakai MCD64A1/Fire_cci/GFED | Juri lokal bermitra BRIN; relevansi bagi pemerintah | Tinggi (korelasi rank tahunan) | Best Use of Science, Local Impact |
| G4 | **Menjelaskan dan merekonsiliasi angka resmi yang berbeda (SiPongi MODIS+VIIRS vs BRIN VIIRS-only vs FIRMS)** | Belum disentuh siapa pun | Kebingungan publik nyata; harmonisasi adalah solusi langsungnya | Sedang (butuh data SiPongi/BRIN) | Local Impact, Best Use of Data |
| G5 | **Koreksi drift orbit Terra/Aqua + siklus diurnal** | Tidak ada di 43 repo | "Seam tersembunyi" yang bisa dibuktikan; relevan dengan berakhirnya MODIS | Sedang | Best Use of Science |
| G6 | **Unit pengelolaan Indonesia (KHG, kabupaten) + Bahasa Indonesia** | Harmonisasi pesaing hanya bbox/provinsi | KHG adalah unit kebijakan gambut nasional | Sedang (tergantung data batas KHG) | Local Impact |
| G7 | **Baseline kondisional ENSO/IOD** ("normal untuk tahun El Niño") | Hanya Fire Harmony punya driver, bukan baseline | 2026 adalah tahun El Niño kuat; BPBD perlu tahu apakah ini "lebih buruk dari El Niño biasanya" | Tinggi | Best Use of Science, Local Impact |
| G8 | **Koreksi awan/asap per piksel (CMG)** | Semua mengakui sebagai gap | Asap Indonesia paradoksnya menurunkan hitungan saat terparah | Sedang | Best Use of Science |
| G9 | **Common FRP floor / operator fisika deteksi** | Tidak ada yang memakai ambang fisik bersama atau paper GMD 2026 | Harmonisasi berbasis fisika yang sudah dipublikasi | Tinggi (floor) / Sedang (operator) | Best Use of Science |
| G10 | **AI yang terukur** (brief BPBD dengan verifier angka + eval set) | Pesaing memakai AI tanpa evaluasi | Mengubah AI dari gimmick menjadi komponen teruji | Sedang | Best Use of Technology (sekunder) |
| G11 | **Backtest early warning** | Kiln Watch mengakui belum | Menjawab "apakah alat ini berguna sebelum puncak musim?" | Sedang | Impact |
| G12 | Cross-check Himawari AHI | Tidak ada | Satu-satunya sensor geostasioner yang meliput Indonesia tiap 10 menit | **Rendah** (data besar) | Future work |

## 4. Fitur yang **tidak** bisa dijadikan USP (sudah komoditas)

Heatmap tahun × bulan · anomali vs median · AOI gambar · CSV · peta NRT · globe 3D · toggle raw vs harmonized · LOYO · narasi "S-NPP berhenti 2 Nov 2026" · rasio per bulan · quantile mapping · forecast LightGBM · chatbot/MCP · alert email/Telegram.

Semua ini tetap **wajib ada** (syarat dasar), tetapi tidak boleh menjadi kalimat pembuka pitch.

## 5. Kandidat USP (opsi untuk didiskusikan tim)

Setiap kandidat diberi penilaian: **Keunikan** (apakah pesaing punya), **Defensibility** (bisa dipertahankan di depan juri BRIN/NASA), **Demoability** (bisa ditunjukkan dalam 30 detik), **Feasibility** (48 jam).

| Kandidat | Inti | Keunikan | Defensibility | Demoability | Feasibility | Catatan risiko |
|---|---|---|---|---|---|---|
| **U1. "Gambut membuat MODIS lebih buta"** | Rasio VIIRS:MODIS terpisah gambut vs mineral × siang/malam, dengan CI. Temuan ilmiah lokal | Tinggi | Tinggi jika diuji dengan data; **bisa gagal** (hipotesis H1/H2 belum terbukti) | Tinggi (satu grafik batang dengan CI) | Tinggi | Jika hipotesis tidak terbukti, laporkan jujur. Hasil null tetap bernilai Validity |
| **U2. "Satu skala untuk angka hotspot Indonesia"** | Menjelaskan kenapa SiPongi, BRIN, dan FIRMS memberi angka berbeda, lalu menyajikan satu seri harmonisasi + panel "angka resmi vs harmonisasi" | Tinggi | Sedang-tinggi (butuh data resmi; hati-hati tidak menyerang lembaga) | Tinggi | Sedang | Juri berasal dari BRIN: bingkai sebagai **komplemen**, bukan koreksi terhadap lembaga |
| **U3. "Seam tersembunyi: drift orbit"** | Membuktikan hitungan MODIS pasca-2020 bias akibat drift jam lintas, lalu mengoreksinya dengan model diurnal | Sangat tinggi | Tinggi (Giglio 2007) | Sedang (butuh penjelasan) | Sedang | Fisika rumit untuk 30 detik; cocok untuk project page dan juri global |
| **U4. "Kalender per KHG"** | Kalender harmonisasi 2001-2026 per Kesatuan Hidrologis Gambut dan kabupaten, Bahasa Indonesia, ekspor format operator | Tinggi | Tinggi | Tinggi | Sedang (data batas KHG belum pasti) | Fallback: kabupaten + peta gambut |
| **U5. "Normal untuk tahun El Niño"** | Baseline kondisional ENSO/IOD: September 2026 dibandingkan dengan September tahun El Niño lain (2015, 2019, 2023), bukan dengan semua tahun | Tinggi | Tinggi (Field 2009/2016) | **Sangat tinggi** (satu kalimat: "2026 lebih buruk dari 2015?") | Tinggi | Sampel tahun El Niño sedikit, jadi interval lebar. Tampilkan jujur |
| **U6. "Siap untuk dunia tanpa MODIS"** | Sunset backtest + rantai NOAA-20/21 + bukti statistik seam hilang | Rendah-sedang (Kiln Watch sudah punya denial test) | Tinggi | Sedang | Tinggi | Bukan pembeda, tetapi wajib setara pesaing |
| **U7. "Lihat VIIRS dengan mata MODIS"** | Operator deteksi fisika (Sofiev 2026) dengan visual interaktif kurva deteksi | Tinggi | Sangat tinggi | Tinggi (slider) | Sedang | Koefisien harus diverifikasi |
| **U8. "Brief siaga BPBD yang angkanya terverifikasi"** | LLM menulis brief Bahasa Indonesia, setiap angka diverifikasi otomatis terhadap fact table, dengan eval set | Sedang | Tinggi (karena diukur) | Tinggi | Sedang | Jangan jadikan pembuka; posisikan sebagai lapisan akses |

### Kombinasi yang saling menguatkan (opsi, bukan keputusan)

| Opsi | Kombinasi | Narasi | Award target | Risiko |
|---|---|---|---|---|
| **A. Lokal-ilmiah** | U5 + U1 + U4 (+U6 sebagai syarat dasar) | "Apakah musim 2026 di KHG X lebih buruk dari El Niño sebelumnya, dengan skala yang adil lintas sensor, dan dengan koreksi khusus gambut?" | Local Impact + Best Use of Science | Bergantung data KHG dan hasil uji gambut |
| **B. Kepercayaan data publik** | U2 + U5 + U8 | "Tiga lembaga, tiga angka. Kami memberi satu skala yang bisa dijelaskan, dan brief yang angkanya terverifikasi." | Local Impact + Best Use of Data | Sensitivitas politik terhadap lembaga; juri dari BRIN |
| **C. Sains mendalam** | U7 + U3 + U1 + U6 | "Kami memodelkan mengapa MODIS melihat lebih sedikit, dan membuktikannya secara statistik." | Best Use of Science | Sulit dipitch dalam 30 detik; bersaing langsung dengan Fire Harmony |

Pola pemenang ([02](02-pola-pemenang.md)) menunjukkan bahwa **spesifisitas lokal + validitas** lebih sering menang daripada kecanggihan teknis murni. Opsi A paling dekat dengan pola QUEÑARIS/G.R.O.W., dan elemen C bisa ditempatkan di project page dan dokumen metodologi untuk juri global.

## 6. Pertanyaan juri yang harus siap dijawab (terutama juri BRIN)

1. "Kenapa tidak cukup memakai VIIRS saja seperti BRIN?" → riwayat 2000-2011 hanya ada di MODIS; tanpa harmonisasi, baseline 20 tahun hilang.
2. "Confidence threshold apa yang dipakai, dan kenapa?" → siapkan uji sensitivitas (semua / nominal+tinggi / tinggi saja).
3. "Hotspot itu bukan kebakaran. Bagaimana kalian membedakannya?" → mask `type`, sumber statis, label "hotspot ≠ kejadian ≠ luas terbakar".
4. "Bagaimana dengan awan dan asap tebal di musim puncak?" → koreksi CMG atau setidaknya flag ketidakpastian.
5. "Bagaimana kalian tahu harmonisasinya benar?" → LOYO, seam test + placebo, sunset backtest, korelasi SiPongi.
6. "Bagaimana setelah S-NPP dan MODIS mati?" → rantai NOAA-20/21 + sunset backtest.
7. "Kenapa angkanya berbeda dari SiPongi?" → perbedaan sensor, filter, dan unit; panel rekonsiliasi.
8. "Siapa yang akan memakai ini, dan keputusan apa yang dibantu?" → idealnya ada kutipan wawancara singkat dengan praktisi (BPBD, Manggala Agni, peneliti).
9. "Apa yang dibuat dengan AI?" → pengakuan penggunaan AI sesuai aturan 2026.

## 7. Risiko dan mitigasi

| Risiko | Mitigasi |
|---|---|
| Pre-build melanggar aturan | Tidak menulis kode sebelum 14 Nov 09:00 WIB; riwayat commit dimulai saat event |
| Hipotesis gambut tidak terbukti | Laporkan hasil null dengan jujur; tetap pakai stratifikasi jika CI berbeda |
| Data KHG/peta gambut tidak bisa diunduh | Fallback ke PEATMAP global + batas kabupaten |
| Unduh arsip FIRMS lambat | Ajukan request sebelum event; cadangan CSV tahunan per negara dan mirror GeoParquet |
| Scope creep (pola Fire Harmony/IGNIS) | Kunci 2-3 momen sains; sisanya ke dokumen metodologi |
| Demo gagal saat pitching 21 Nov | Static bundle offline, video cadangan, LLM dengan fallback template |
| Melebihi batas demo (7 slide / 30 detik) | Langsung tidak eligible global; latih dan ukur waktu |
| Sensitivitas terhadap lembaga resmi | Bingkai sebagai komplemen; jangan menyebut nama perusahaan konsesi |
| Angka 2026 berasal dari media | Verifikasi dari sumber resmi atau tandai jelas |

## 8. Hal yang perlu dicek tim pada 14 Nov pagi

1. Resources tab challenge (mungkin bertambah dataset baru).
2. Halaman event Bandung (format pitch 21 Nov, venue).
3. Status Archive Download FIRMS yang diajukan.
4. Ketersediaan peta gambut BBSDLP/PEATMAP dan batas KHG.
5. Data luas terbakar resmi SiPongi per provinsi per tahun.
6. Kemungkinan wawancara singkat dengan satu praktisi (BPBD/Manggala Agni/peneliti BRIN/ITB) selama hackathon.
