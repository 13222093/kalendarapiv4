# 04 · Repo Karhutla, Tools Fire Analytics, dan Ekosistem Indonesia

> Proyek di luar challenge yang sama: dashboard karhutla Indonesia, tools FIRMS global, forecasting ML, proyek Space Apps lama, dan platform operasional.
> Tujuannya mencari ide yang bisa dipinjam dan memetakan apa yang **belum** dijawab ekosistem yang ada.
> Detail ~45 repo (link, ★, push terakhir, metode): [_raw/repo-terkait-karhutla.md](_raw/repo-terkait-karhutla.md). Benchmark platform tambahan: [_raw/aturan-pemenang-platform.md](_raw/aturan-pemenang-platform.md).

## 1. Kesimpulan utama

1. **Ekosistem Indonesia 2026 kuat di real-time, kosong di dimensi waktu panjang.** Puluhan repo karhutla muncul Agustus-November 2026 (musim Super El Niño, lomba JOINTS UGM, MIA 2026, tugas kuliah). Tetapi riwayat mereka dimulai Juli/Oktober 2026, atau 2012+ (VIIRS saja), atau MODIS saja.
2. **Tidak ada satu pun yang menjawab:** *"Apakah Agustus 2026 di Kalteng (atau KHG Sebangau) lebih buruk dari 2015 dan 2019, setelah perbedaan sensor dikoreksi?"*
3. **Platform resmi pun tidak konsisten.** SiPongi mencampur sensor tanpa koreksi, BRIN memakai VIIRS saja, dan GFW memisahkan MODIS dan VIIRS sebagai lapisan berbeda. Akibatnya angka hotspot antar-lembaga berbeda dan membingungkan publik. **Ini masalah harmonisasi nyata di Indonesia**, dan bisa menjadi pembuka narasi kita.

## 2. Repo Indonesia yang paling relevan

| Repo | Ide | Yang bisa dipinjam | Yang kurang |
|---|---|---|---|
| **pantaukarhutla/pantau-karhutla** | Tracker karhutla independen dengan metode terbuka; angka resmi vs estimasi sendiri | Panel **"angka resmi vs angka kita"**, statistik *repeat burn* (47% piksel api 2026, 63% di gambut, jatuh di lahan yang pernah terbakar 2012-2025), mask industri, tier bukti, tombol (i) metodologi di setiap angka, feed RSS per provinsi | Riwayat hanya sejak Jul 2026 / 2012+; **tidak ada kalender harmonisasi sejak 2000** |
| **mrramdn/titik-api** | Peringatan hotspot tingkat desa (4.837 desa Sumsel & Kalteng), alur BPBD → MPA → groundcheck | **Ekspor format groundcheck SiPongi+**, replay per tanggal, peran pengguna jelas | Arsip mulai 8 Okt 2026, 2 provinsi, tanpa baseline |
| harryrosianto/visualize-karhutla | "Karhutla Wrapped" per kabupaten (ala Spotify), shareable | Kartu **"Kalender Karhutla kabupatenmu 2001-2026"** + OG image | Data contoh (fiktif, dilabeli) |
| IsmailYanuar/karhutla-ops | Situs transparansi nasional (MIA 2026) | Rapor provinsi, panduan siaga asap, pipeline GitHub Actions | Tanpa harmonisasi/baseline |
| ramaikn/karhutla-watch | Peta + peringkat provinsi + CAMS + BMKG | **Snapshot data di repo** sebagai fallback demo offline | NRT saja |
| fajarwz/kawalasap | Monitor asap tanpa API key | **Pelajaran teknis: CSV FIRMS tidak kirim header CORS** → wajib proxy | NRT saja |
| anasysuf/sekitarku (21★) | PWA bencana multi-API resmi | Daftar endpoint resmi Indonesia (BMKG, SiPongi+, PVMBG) | Generalis |
| melplanetindonesiapartnership/sipongi-pt-sls-monitor | Monitor hotspot SiPongi dalam konsesi | Bukti ada **endpoint JSON SiPongi** (`.../api/opsroom/indoHotspot`) [izin pakai belum jelas] | 7 hari, 1 PT |
| bagaswibowo/peatfr | Web app paket R *peatfr* (Mahdiyasa dkk. 2025, *Ecological Informatics*) | **Referensi ilmiah lokal**, kemungkinan penulis dari ITB = calon narasumber/kolaborator [afiliasi belum dicek] | Forecast risiko, bukan kalender |
| rivaldigunawanyusuf/JejakApi | Peringatan dini gambut H-30, LightGBM + SHAP (JOINTS UGM) | Argumen "**SPARTAN BMKG hanya cuaca**, ~80% kebakaran gambut ditentukan faktor manusia" → aktivitas aktual penting | Prediktif |
| KrishnaAnnavaram/firecast-id | Benchmark forecast hotspot Indonesia 1-30 hari | **Disiplin baseline** (persistence/klimatologi) + uji Diebold-Mariano | Sensor campuran |
| XiaomanLu/Data4Manu_FireEmis_Drought_Indonesia | Data paper emisi api gambut vs non-gambut 2003-2025 | Referensi narasi "gambut × kekeringan" | README minim |
| MAMMOTHMAN34/haze-attribution | Atribusi asap Singapura ke api Indonesia | **Uji placebo** untuk memisahkan musim dari kausalitas | VIIRS saja |
| chndranndr/fire-tracker (MERATUS) | Lapisan bukti terpisah: satelit, konsesi, korporasi | Prinsip **memisahkan bukti dari tuduhan** | VIIRS saja |
| codebyalvinn/EmberLedger | Indeks risiko gambut Kalteng | Label jujur "decision support, not probability"; mode Snapshot/Live | Data disimulasikan |
| aldearizka99/Kumbara | Inventaris karhutla Kalteng 2014-2024 (dNBR + MODIS) | Pola "hotspot + bukti luka bakar" | MODIS saja, tidak aktif |

## 3. Tools global yang bisa dipakai langsung

| Repo | Kegunaan bagi kita |
|---|---|
| **portolan-mirrors/firms-catalog** | **Kandidat sumber data terbaik.** Mirror seluruh arsip FIRMS (MODIS+VIIRS, Nov 2000 sampai sekarang, ~631 juta baris) sebagai **GeoParquet**; DuckDB bisa query bbox Indonesia secara remote. Kiln Watch tampaknya memakai pola ini. Catatan: mirror pihak ketiga, cek lisensi/uptime; siapkan snapshot offline |
| meredithfranklin/MODIS-VIIRS-fires | Clustering untuk memisahkan **sumber persisten** (flare, industri), penting untuk smelter nikel Sulawesi/Maluku Utara, flare migas, PLTU |
| suvarchaw/Thermoscope | Contoh **pelaporan jujur dua angka**: balanced accuracy 0,935 (split temporal) vs 0,459 (holdout spasial) |
| patternizer/fire-atlas-app | Konsep **"tahun api" yang bisa digeser** (mis. Jul-Jun) |
| Ni-nuan/ENSO-related-regional-fire-variability | Kerangka "jumlah event vs ukuran event" terkait ENSO; ide **overlay ONI/IOD** |
| wri/gfw-fires-app | Pola i18n EN + **Indonesia** |
| burritojustice/viirs-modis-fire-map | Visual piksel sebagai **kotak sesuai ukuran footprint** |
| gagreene/cffdrs, josefmtd/gee-fwi | Hitung FWI bila ingin konteks bahaya cuaca |

## 4. Forecasting/ML: sudah padat, jangan jadi inti

- Repo terbanyak bintang (Orion-AI-Lab, SeasFire, ECMWF Code4Earth, pyronear) fokus Mediterania/global dan berat.
- **ProbFire** (Nikonovas et al. 2022): jaringan saraf kecil 0,25° bulanan untuk Indonesia; mengalahkan klimatologi pada lead 2-4 bulan di Kalimantan selatan, Sumatra selatan, Papua selatan, tetapi **tidak punya skill di Kalbar** (detail di [06](06-pendekatan-teknis-lanjutan.md)).
- Rekomendasi: **outlook berbasis klimatologi** (median dan persentil historis + overlay ENSO/IOD) sudah cukup dan jujur. Kiln Watch pun menegaskan "it compares with earlier years; it never forecasts".

## 5. Proyek kebakaran Space Apps lama (2017-2023)

Hampir semuanya **NRT + crowdsourcing + notifikasi** (Spot That Fire 2018-2020, Managing Fire 2023). Notifikasi SMS (ICFire, lolos final global) sering dinilai positif. **Tidak ada yang menangani kontinuitas data jangka panjang.** Challenge 2026 berbeda: fokusnya data science dan kontinuitas. Fitur alert boleh, tetapi hanya pelengkap.

## 6. Platform operasional Indonesia dan kekurangannya

| Platform | Pengelola | Yang ditawarkan | Sensor | Yang kurang (relatif ke kalender harmonisasi 2000-kini) |
|---|---|---|---|---|
| **SiPongi+** | KLHK / Kemenhut | Hotspot harian nasional, filter confidence, rekap provinsi, **luas terbakar resmi tahunan**, groundcheck | MODIS + VIIRS S-NPP/NOAA | Sensor berubah dari waktu ke waktu **tanpa koreksi**, sehingga tren antar-tahun bias oleh penambahan satelit (2012, 2018, 2023/24). Tidak ada anomali vs median yang konsisten. Angka luas resmi jauh di bawah estimasi independen |
| **BMKG SPARTAN** | BMKG | Fire Danger Rating (Canadian FWI terkalibrasi lokal), prakiraan 7 hari | Model cuaca + hotspot | **Hanya bahaya potensial berbasis cuaca**, bukan aktivitas api aktual; tanpa klimatologi aktivitas 20+ tahun |
| **BRIN Hotspot** | BRIN (eks-LAPAN) | Hotspot ~30 menit setelah akuisisi, filter tambang | **VIIRS saja** (menurut ringkasan DPR) | Fokus kecepatan NRT; angka berbeda dari SiPongi |
| **Pantau Gambut** | Koalisi sipil | Hotspot dalam KHG, termasuk confidence rendah/sedang | FIRMS + citra | Laporan berkala advokasi, bukan seri waktu interaktif terharmonisasi |
| **Nusantara Atlas FireWatch** | TheTreeMap | Hotspot + burned area bulanan, konsesi, KHG | **Menjumlahkan** hitungan MODIS + VIIRS | Hanya 360 hari terakhir; menjumlahkan bukan harmonisasi |
| **PRIMS** | BRGM | Monitoring restorasi gambut, muka air | Sensor TMA | Badan restorasi berakhir 2024; status sistem tidak jelas |
| **Global Nature Watch** (dulu Global Forest Watch, berganti nama Sep 2026) | WRI | Dashboard fires, AOI, EN/ID | **VIIRS saja sejak 2012**, alert confidence tinggi sebagai default | **Tidak ada riwayat pra-2012**; MODIS tidak dipakai untuk statistik |
| **ASMC** | ASEAN | Hotspot harian per pass Sumatra/Kalimantan | NOAA-20 (sejak 2019) | NRT regional, tanpa seri harmonisasi |
| **GWIS / EFFIS seasonal trend** | JRC (UE) | Tren musiman vs rata-rata dan rentang min-max historis | VIIRS dan MODIS dalam **grafik terpisah** | Baseline rata-rata 2012-2025 (bahkan untuk MODIS), **mean bukan median**, tanpa AOI gambar bebas |
| BMKG (halaman hotspot) | BMKG | Snapshot terkini | — | Tanpa riwayat, statistik, atau ekspor |
| NASA Worldview | NASA | Lapisan visual | MODIS, VIIRS | Tanpa statistik |
| **NASA FIRMS** | NASA | Arsip per sensor, peta global, unduhan, API | MODIS C6.1, VIIRS 375 m | Data mentah per sensor; pengguna menangani sendiri lompatan sensor |

**Tidak satu pun platform operasional mengharmonisasi MODIS dan VIIRS menjadi satu seri konsisten.** Yang sudah melakukannya masih berupa riset, bukan produk: tim MODIS NASA (Boschetti), preprint GFED5, dan paper MDPI 2026 tentang fusi FRP (Zheng et al.).

**Inti celah ekosistem:** semua platform unggul di NRT dan operasional, sementara **sisi historis yang konsisten kosong**. Selain itu, **kebingungan publik akibat angka SiPongi vs BRIN vs FIRMS** adalah masalah yang bisa dijelaskan dan diselesaikan dengan harmonisasi.

## 7. Ide yang layak dipinjam (diringkas)

**Data dan infrastruktur**
1. GeoParquet FIRMS + DuckDB untuk query bbox Indonesia 2000-2026; snapshot Parquet/JSON sebagai fallback demo offline.
2. Proxy kecil untuk lapisan NRT (CORS).
3. Mask sumber statis (smelter nikel, flare migas, PLTU, gunung api). Data SP punya kolom `type`, NRT tidak.

**Produk dan UX untuk Indonesia**
4. AOI siap pakai: provinsi, kabupaten, **KHG**, taman nasional (Sebangau, Tesso Nilo, Berbak), plus gambar sendiri.
5. Kalender bulan × tahun dengan **overlay ENSO (ONI) dan IOD**, sehingga 1997/2006/2015/2019/2023/2026 langsung terbaca. Opsi "tahun api" yang bisa digeser.
6. Panel **"Angka resmi vs harmonisasi"** dengan tombol (i) metodologi.
7. Ekspor CSV + format yang dikenali operator Indonesia (groundcheck SiPongi+), feed per provinsi.
8. Kartu shareable "Kalender Karhutla kabupatenmu 2001-2026" untuk dampak lokal dan People's Choice.
9. Statistik *repeat burn* yang diperpanjang sampai 2001 (Pantau Karhutla hanya 2012+).
10. Bahasa Indonesia default + toggle EN (juri global tetap butuh EN).

**Narasi dan kejujuran**
11. Bagian "di mana kami masih kurang" dan label tegas "hotspot ≠ api terkonfirmasi ≠ luas terbakar".
12. "Why now": S-NPP berhenti 2 Nov 2026, MODIS menjelang akhir misi, dan musim 2026 termasuk yang terbesar.

**Anti-pola**
- Matching per titik MODIS↔VIIRS sebagai inti (match rate rendah karena overpass berbeda).
- Data contoh yang tidak dilabeli.
- "AI agent/MCP" tanpa grounding (sudah dipakai pesaing, nilai tambah kecil).
- **Menyebut nama perusahaan** dalam analisis konsesi (risiko hukum; Pantau Karhutla sengaja tidak mempublikasikannya).
