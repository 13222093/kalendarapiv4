# 02 · Cara Berpikir Pemenang: Kenapa Proyek Menang (dan Kenapa Tidak)

> Sumber utama: riset sekunder tim (tiga laporan benchmark pemenang 2023-2025) ditambah verifikasi agen riset 13 Nov 2026 ([_raw/aturan-pemenang-platform.md](_raw/aturan-pemenang-platform.md)).
> Analisis "kenapa menang" adalah **inferensi dari pola**. NASA tidak mempublikasikan skor per kriteria.

## 1. Struktur kompetisi: dua juri, dua logika

| Tahap | Siapa menilai | Apa yang dilihat | Implikasi |
|---|---|---|---|
| Lokal (Bandung) | Juri lokal | Pitch live, demo, kesan produk | Produk yang dipoles dan pitch kuat menang (pola Bloomee, AIM-X) |
| Global Nominee | Dipilih juri lokal | — | 1.294 nominee dari 18.860 tim (2025) |
| Global Finalist | Pakar NASA dan Space Agency Partner | **Project page, video/slide, repo** (tanpa pitch live) | Validitas ilmiah dan dampak yang terdokumentasi menentukan |
| Global Winner | Executive committee NASA dan mitra | Sama | 10 pemenang kategori |

Funnel 2025: 114.094 peserta → 18.860 tim → 11.511 proyek → 1.294 Global Nominee → 45 Global Finalist (+23 Honorable Mention) → 10 Global Winner.

**Konsekuensinya: kita harus menang dua kali dengan dua "bahasa" berbeda.** Untuk juri lokal: demo memukau. Untuk juri global: halaman proyek yang membuktikan sains valid dan dampak spesifik.

## 2. Aturan dan penilaian 2026 (terverifikasi dari Judging Guide & Submission Guide resmi, 12 Nov 2026)

| Aspek | Ketentuan 2026 |
|---|---|
| Kriteria | **Impact, Creativity, Validity, Relevance, Presentation**, masing-masing skor 1-5 di semua level. **Validity mencakup usability.** **Relevance mensyaratkan data NASA menjadi inti proyek**, bukan tempelan |
| Demo | **Maksimal 7 slide (termasuk judul) atau video maksimal 30 detik.** Melebihi batas = **tidak eligible untuk penjurian global**. Semua dalam bahasa Inggris (video berbahasa lain wajib subtitle Inggris) |
| Link proyek | "Link to Final Project" harus publik tanpa login. Repo publik tidak diwajibkan secara eksplisit |
| Data NASA | Minimal satu dataset/resource NASA wajib untuk eligible global |
| Pra-event | FAQ: "Teams are not allowed to begin working on the challenges prior to the hackathon." Batas riset vs mengerjakan tidak didefinisikan. **Aman: tidak menulis kode sebelum 14 Nov 09:00 WIB** |
| AI ("Super Intelligence/SI", istilah baru sejak Executive Order AS 29 Sep 2026) | Boleh dipakai, **tetapi tidak untuk menghasilkan ide solusi**. Kode dan data buatan SI **wajib diakui** di teks dan metadata. Gambar buatan SI wajib watermark terlihat. Branding NASA tidak boleh muncul di konten buatan SI |
| Tenggat | Submission tutup **15 Nov 23:59 waktu lokal** |
| Pengumuman | Global Nominee **3 Des 2026**, Finalist & Honorable Mention **17 Des 2026**, Winner **26 Jan 2027** |
| Resources tab challenge kita | Saat ini hanya FIRMS (bisa bertambah). Tab Details meminta pembanding **median historis**, AOI yang bisa digambar atau input lat/lon, dan unduhan CSV |

### Event lokal Bandung 2026

- Hackathon berlangsung **online** (14-15 Nov).
- **Pitching live dan awarding: 21 Nov 2026**, hybrid, venue belum diumumkan.
- Host partner: **ITENAS**. **Judging partner: BRIN.** Ini penting: juri lokal kemungkinan paham penginderaan jauh dan hotspot (BRIN mengelola sistem hotspot nasional yang **memakai VIIRS saja**). Siapkan jawaban validasi ilmiah yang kuat dan hindari klaim berlebihan.
- Bandung 2025: 13 tim, hanya **1** yang menjadi Global Nominee (Ganespace/Bloomee). Tidak ada tim Indonesia di 45 Global Finalist atau 23 Honorable Mention 2025.
- Format pitch lokal belum terverifikasi. Cek ulang halaman event dan Resources tab pada 14 Nov.

Detail dan URL sumber: [_raw/aturan-pemenang-platform.md](_raw/aturan-pemenang-platform.md).

Kategori award yang paling cocok untuk challenge ini:

| Award | Deskripsi resmi | Kecocokan |
|---|---|---|
| **Local Impact** | "greatest potential for local impact" | **Target utama.** Karhutla gambut Indonesia |
| **Best Use of Science** | "most valid use of science and/or the scientific method" | Target sekunder. Validasi harmonisasi yang ketat |
| **Best Use of Data** | "best makes space data accessible or leverages it for a unique application" | Target sekunder. Data FIRMS jadi bisa dipakai non-ahli |
| Best Use of Technology | — | **Hindari.** Banyak pesaing sudah membawa ML, forecasting, dan rekonstruksi footprint |

## 3. Lima pola kemenangan (diurutkan dari bukti terkuat)

### Pola 1: Masalah lokal spesifik + pengguna yang disebut namanya (bukti kuat)

Local Impact dimenangkan proyek Earth science berkonteks lokal tajam **tiga tahun berturut-turut**:

| Tahun | Tim | Lokasi | Masalah yang dijawab |
|---|---|---|---|
| 2023 | $quality_over_quantity (nama tim asli) | Kaohsiung, Taiwan | Prioritas area perlindungan hotspot biodiversitas lokal (imaging spectroscopy) |
| 2024 | Team I.O. (G.R.O.W.) | Florianópolis, Brasil | **Kebakaran**: data NASA real-time disampaikan ke petani dan warga desa yang selama ini tidak bisa mengaksesnya |
| 2025 | QUEÑARIS | Arequipa, Peru | Krisis air kota akibat degradasi hutan queñua; output konkret berupa zona tanam dan target bibit, mitra lapangan SERFOR/Tecsup/Rotary |

### Pola 2: Satu variabel yang tepat untuk satu keputusan (bukti kuat)

Pada challenge pertanian 2024, **dua** pemenang global datang dari challenge yang sama:
- GaamaRamma (Best Use of Data): OpenET → grafik air 7 hari **per lahan petani**.
- NVS-knot (Galactic Impact): soil moisture + evapotranspirasi → **kapan aman menanam**.

Non-pemenang di challenge yang sama (AgriSphere, Lunar Harvest) memakai banyak sumber data untuk banyak klaim ("facilitating", "AI-powered companion" serba bisa).

### Pola 3: Menutup celah akses atau komunikasi data (bukti sedang sampai kuat)

G.R.O.W. (2024) tidak menjual algoritma, melainkan menutup celah antara data GIS yang rumit dan warga desa. ISDApp (Filipina, Galactic Impact 2018) menyampaikan data ke nelayan bahkan tanpa internet. Polanya: **data yang sudah ada tetapi tidak sampai ke pengguna rentan**.

### Pola 4: Presentasi yang patuh batas dan langsung (bukti sedang, dari panduan resmi)

Panduan resmi memperingatkan bahwa banyak tim kuat di empat kriteria pertama tetapi lemah di Presentation. Demo yang melebihi batas, link yang butuh login, atau tidak menyebut data NASA secara eksplisit adalah penyebab gugur yang terdokumentasi.

### Pola 5: Validitas yang ditampilkan, termasuk keterbatasan (bukti sedang)

Validity adalah kriteria resmi. Ironisnya, **repo pemenang yang terverifikasi jarang punya tabel validasi**. Storm Prophet (Best Use of Data 2023) mengklaim akurasi 90-95% lewat media, bukan lewat repo. Ini **celah**: validasi yang jujur dan terdokumentasi bisa menjadi pembeda di challenge yang sangat teknis.

### Anti-pola: kecanggihan AI/ML (bukti lemah sebagai pembeda)

Banyak non-pemenang memakai AI. Pemenang memakai AI hanya jika melayani keputusan pengguna. Chatbot tidak membantu Validity.

## 4. Studi kasus paling relevan: Bloomee vs QUEÑARIS (challenge yang sama, BloomWatch 2025)

| Dimensi | Bloomee (Team Ganespace, **Bandung**) | QUEÑARIS (Arequipa) |
|---|---|---|
| Framing | Platform fenologi bunga global (sakura Jepang sampai superbloom California) | Satu hutan, satu kota, satu krisis air |
| Pengguna | Empat segmen (pertanian, konservasi, perencanaan kota, riset) | Restorasi hutan dan keamanan air Arequipa |
| Teknologi | Sangat tinggi: globe 3D, 5+ model ML ensemble, chatbot agentik, 4 dataset NASA | Sedang tetapi lintas disiplin: satelit + drone + bioteknologi |
| Output | Forecast NDVI + chatbot | Zona reforestasi (<300 m dari air, lereng sesuai), 7 ribu bibit pilot |
| Hasil | **Juara + Best Innovation Bandung**, Global Nominee, tidak masuk finalis | **Global Winner, Local Impact** |

**Pelajaran inti untuk tim Bandung:**
- **Kecanggihan teknis membantu lolos lokal. Spesifisitas dampak yang menang global.**
- Juri Bandung 2025 menghargai produk teknis yang dipoles. Juri global menghargai proyek yang bisa diringkas dalam 30 detik: "untuk siapa, keputusan apa, seberapa yakin".

## 5. Studi kasus ITB: AIM-X (2025)

- Tim STEI ITB (Thalita Zahra Sutejo, Attara Majesta Ayub, Jason Fernando, Daryl John Sayangbati), simulasi tumbukan asteroid berbasis data NASA.
- Hasil: Best Pitch (Jakarta), Local Winner + Global Nominee, Best Use of Data (Nominee/Winner, sumber tidak konsisten).
- **Pembeda di level lokal:** kualitas pitch dan kedalaman fisika (kawah, shockwave, tsunami, seismik, mitigasi), pembagian peran terstruktur (data & fisika, UI/3D, integrasi).
- **Kenapa berhenti di nominee (inferensi):** fitur AIM-X adalah fitur standar challenge Meteor Madness. Banyak simulator asteroid serupa di seluruh dunia, bahkan di Jakarta ada setidaknya dua proyek asteroid yang menjadi Global Nominee. Unggul di eksekusi, tetapi idenya tidak unik.
- **Relevansi untuk 2026:** challenge MODIS/VIIRS juga sudah ramai (lihat [03-benchmark-repo-pesaing.md](03-benchmark-repo-pesaing.md)). Pipeline dasar sudah jadi komoditas, sehingga risikonya sama seperti AIM-X: eksekusi bagus tetapi tidak berbeda.

## 6. Pola repo: pemenang vs non-pemenang

| Aspek | Repo pemenang terverifikasi | Repo non-pemenang terbaik |
|---|---|---|
| README | Pendek sampai sedang, menautkan demo dan team page | Kadang sangat lengkap (backtest, badge ROC AUC, tests) |
| Validasi | Jarang ada di repo | Kadang lebih baik |
| Output untuk pengguna | **Konkret** (500 lokasi bibit, forecast Dst) | Sering generik (peta, chatbot) |
| Pemolesan pascahackathon | Ada (Connected Earth sampai Juli 2025) | Jarang |

Kesimpulan: **repo yang rapi bukan penentu kemenangan**, tetapi repo yang rapi + output konkret + cerita dampak + demo yang jalan adalah kombinasi yang belum dimiliki siapa pun di challenge kebakaran sebelumnya.

## 7. Proyek kebakaran di Space Apps sebelumnya

| Proyek | Tahun | Status | Isi |
|---|---|---|---|
| NasaOnFire | 2019 | Local People's Choice, Global Nominee | FIRMS NRT + laporan warga dengan ranking anti-hoaks |
| ICFire | 2019 | Global Nominee | Pelaporan warga + FIRMS |
| FireCast | 2019 | Global Nominee saja | Spot That Fire V2 |
| Fierr | 2020 | Global Nominee saja | Spot That Fire V3 |
| Firefly, PyroFyro, Rocket Hacks | 2023 | Global Finalist (challenge Managing Fire tidak menghasilkan pemenang) | — |
| Phoenix Eye | 2023 | Tidak terkonfirmasi | ML penjalaran api Sonora; VIIRS + MODIS |
| G.R.O.W. (Team I.O.) | 2024 | **Global Winner, Local Impact** | Akses data kebakaran untuk warga desa Brasil (challenge Community Mapping) |

**G.R.O.W. adalah satu-satunya proyek bertema kebakaran yang terkonfirmasi menang global.** Pola dominan proyek kebakaran: **peta real-time + crowdsourcing**. Tidak ada yang ditemukan melakukan harmonisasi MODIS/VIIRS, baseline median historis, atau validasi terhadap data resmi. Untuk 2026, celah ini sebagian sudah diisi pesaing (lihat dokumen 03), tetapi belum ada yang menggabungkannya dengan konteks gambut Indonesia.

## 8. Cara berpikir yang perlu ditiru (ringkasan)

1. **Mulai dari keputusan, bukan dari data.** "Apakah musim bakar bulan ini di KHG X di atas normal historis?" lebih kuat daripada "kami mengharmonisasi MODIS dan VIIRS".
2. **Sempitkan wilayah, perdalam dampak.** Satu provinsi gambut dengan pengguna bernama mengalahkan peta dunia.
3. **Harmonisasi adalah alat, tren palsu adalah masalahnya.** Ceritakan bahaya salah baca tren, lalu tunjukkan cara kita menghilangkannya.
4. **Validasi adalah fitur.** Panel "Seberapa yakin kami" di aplikasi, bukan lampiran PDF.
5. **Jujur soal keterbatasan.** Kegagalan yang dilaporkan dengan jujur menambah poin Validity. Klaim berlebihan menguranginya.
6. **Dua lapis presentasi.** Pitch lokal yang memukau + project page/video 30 detik untuk juri global yang hanya membaca.
7. **Patuhi aturan.** Jangan menulis kode sebelum 14 November 09:00 WIB. Repo dengan commit pra-event berisiko diskualifikasi. Akui penggunaan AI (SI) sesuai aturan 2026, dan jangan memakai AI untuk menghasilkan ide solusi.
8. **Siapkan juri BRIN.** Juri lokal Bandung 2026 bermitra dengan BRIN, yang mengoperasikan sistem hotspot nasional. Pertanyaan teknis soal confidence, VIIRS-only, dan validasi hampir pasti muncul.
