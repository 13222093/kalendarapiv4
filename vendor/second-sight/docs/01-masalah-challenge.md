# 01 · Masalah Sebenarnya di Challenge Ini

> Challenge: **Harmonization of MODIS and VIIRS Hot Spots**, NASA Space Apps Challenge 2026
> Halaman resmi: https://www.spaceappschallenge.org/2026/challenges/harmonization-of-modis-and-viirs-hot-spots/
> Tingkat: Intermediate sampai Advanced · Subjek: Earth Science, Software
> Hackathon: 14-15 November 2026 (lokal Bandung)

## 1. Ringkasan satu paragraf

Satelit sudah mencatat titik panas (*hotspot*) di permukaan bumi selama lebih dari 20 tahun, tetapi catatan itu terbelah menjadi dua generasi sensor. **MODIS** (2000 sampai sekarang, piksel ~1 km) punya riwayat panjang tetapi sudah mendekati akhir misi. **VIIRS** (2012 sampai sekarang, piksel 375 m) lebih detail dan akan terus berjalan, tetapi riwayatnya pendek. Karena resolusi, kepekaan, dan jadwal lintasnya berbeda, **hitungan hotspot dari keduanya tidak bisa langsung disambung**. Challenge meminta kita (1) menyetarakan keduanya menjadi satu deret waktu yang konsisten, lalu (2) membangun web app yang menampilkan **kalender aktivitas pembakaran** (tahun × bulan) untuk area pilihan pengguna, lengkap dengan perbandingan terhadap pola historis dan unduhan CSV.

## 2. Akar masalah: "step change" palsu

```
jumlah hotspot / tahun (ilustrasi, bukan data)
        │                              ████
        │                        ████  ████  ████      ← era VIIRS: angka melompat
        │                  ████  ████  ████  ████
        │  ██  ██  ██  ██  ████  ████  ████  ████
        │  ██  ██  ██  ██  ████  ████  ████  ████
        └──────────────────┬──────────────────────
          2003 … 2011      2012 (VIIRS masuk)
```

- Untuk kebakaran yang sama, VIIRS **mendeteksi jauh lebih banyak titik** daripada MODIS. Penyebabnya: piksel lebih kecil (satu kebakaran besar terpecah menjadi banyak piksel) dan kepekaan lebih tinggi (api kecil dan api malam ikut tertangkap).
- Literatur dan repo pesaing melaporkan rasio VIIRS:MODIS mulai **~2× sampai >25×** (biasanya 3-6× untuk hitungan bulanan; jauh lebih tinggi untuk malam hari dan api kecil), tergantung wilayah (lihat [03-benchmark-repo-pesaing.md](03-benchmark-repo-pesaing.md) dan [05-sains-dan-data.md](05-sains-dan-data.md)). Rasio ini **tidak konstan**: berubah menurut wilayah, musim, siang/malam, jenis api, tutupan awan, dan sudut pindai.
- Ada juga **seam tersembunyi**: orbit Terra dan Aqua sudah bergeser (drift) sejak ~2020-2022, sehingga jam lintasnya berubah dan hitungan MODIS ikut bias. S-NPP berhenti di FIRMS pada 2 Nov 2026. Satu deret 2000-sekarang punya **beberapa titik sambungan**, bukan hanya 2012.
- Jika data mentah disambung begitu saja, grafik akan menunjukkan **"kebakaran meningkat tajam sejak 2012"** padahal yang berubah hanya alat ukurnya. Akibatnya pengambil keputusan bisa salah membaca tren, salah mengalokasikan sumber daya, atau salah menilai keberhasilan kebijakan pencegahan.
- Masalahnya makin mendesak karena **MODIS akan berhenti**. Ke depan hanya VIIRS yang tersedia, jadi satu-satunya cara memakai 12 tahun riwayat pra-VIIRS (2000-2011) adalah dengan harmonisasi.

## 3. Yang diminta challenge (dibagi dua fase)

### Fase 1: Harmonisasi data

Tujuan: "pada akhir fase ini, sensor asal tidak lagi penting; pola, tren, dan anomali menjadi fokus."

Ini menuntut keputusan metodologis yang harus bisa dipertahankan di depan juri ahli NASA:

| Keputusan | Pertanyaan yang harus dijawab |
|---|---|
| Unit hitung | Apa yang dihitung: deteksi mentah, sel grid berapi per hari (*fire cell-days*), atau kejadian? |
| Arah konversi | VIIRS dikonversi ke "setara MODIS", atau MODIS ke "setara VIIRS"? |
| Data acuan | Periode tumpang tindih (2012 sampai sekarang) dipakai sebagai data kalibrasi |
| Granularitas kalibrasi | Satu faktor global, per wilayah, per bulan, atau per kelas tutupan lahan? |
| Penyaringan | Ambang confidence, buang deteksi statis/industri/gunung api (field `type`), siang/malam |
| Ketidakpastian | Seberapa yakin hasil harmonisasi? Pita ketidakpastian dan validasi silang |

### Fase 2: Web app

| Fitur yang disebut challenge | Status |
|---|---|
| Pilih area: gambar di peta atau masukkan lat/long | Disarankan |
| Pilih rentang tanggal | Diminta |
| **Kalender aktivitas pembakaran** (tahun × bulan, jumlah hotspot, awal 2000-an sampai sekarang) | **Inti** |
| Bandingkan bulan berjalan dengan **median historis** | Diminta secara eksplisit |
| Anomali terhadap rata-rata multi-tahun | Disarankan |
| Color ramp yang **aksesibel** | Disarankan |
| **Unduh CSV** hotspot hasil pencarian | Disarankan |
| Unduh analitik dan visualisasi | Diminta |

### Pertanyaan pengguna yang harus bisa dijawab aplikasi

Challenge menyebutnya secara eksplisit:
1. Periode mana dalam setahun yang paling banyak kebakaran? (musim)
2. Tahun mana yang aktivitas pembakarannya paling tinggi? (tahun ekstrem)
3. Bagaimana kebakaran saat ini dibandingkan dengan sebelumnya? (anomali)

## 4. Siapa pengguna sasaran

Disebut challenge: petugas peringatan dini dan tanggap darurat, ilmuwan, manajer lahan, pemadam kebakaran.

Padanan di Indonesia (perlu divalidasi lewat wawancara, belum dikonfirmasi):

| Pengguna | Keputusan yang mungkin dibantu |
|---|---|
| BPBD provinsi/kabupaten | Kapan menetapkan status siaga darurat karhutla, alokasi posko |
| Manggala Agni (KLHK) | Penempatan regu patroli per bulan dan wilayah |
| BRGM / pengelola KHG (Kesatuan Hidrologis Gambut) | Prioritas pembasahan gambut sebelum musim kering |
| Perusahaan HTI/perkebunan (kewajiban pencegahan) | Kesiagaan konsesi, pelaporan |
| Peneliti (ITB, IPB, BRIN) | Analisis tren karhutla jangka panjang tanpa bias sensor |
| Jurnalis data / LSM (mis. Pantau Gambut, Auriga) | Mengecek klaim "karhutla menurun" dengan data yang adil |

## 5. Kenapa ini relevan untuk Indonesia

- Indonesia termasuk wilayah dengan aktivitas karhutla terbesar di dunia, terutama di lahan **gambut** Sumatra (Riau, Jambi, Sumsel) dan Kalimantan (Kalteng, Kalbar, Kalsel).
- Tahun-tahun ekstrem terkait El Niño (2006, 2015, 2019, 2023) terlihat jelas di catatan satelit. Tahun 2015 sering disebut sebagai salah satu bencana kabut asap terburuk di Asia Tenggara.
- **Kebakaran gambut** punya karakter khusus yang membuat harmonisasi lebih sulit: sering membara (*smouldering*) di bawah permukaan, panasnya rendah, dan tertutup asap tebal. Akibatnya deteksi MODIS dan VIIRS sama-sama bisa meleset, dan rasio VIIRS:MODIS di gambut bisa berbeda dari rata-rata global. Rincian ada di [05-sains-dan-data.md](05-sains-dan-data.md).
- Data resmi pembanding tersedia (statistik luas terbakar dan hotspot SiPongi/KLHK), sehingga validasi lokal bisa dilakukan.

## 6. Yang **bukan** masalah challenge ini (jangan sampai melebar)

- Bukan memprediksi kebakaran besok (*forecasting*). Boleh sebagai tambahan, tetapi bukan inti.
- Bukan memetakan luas area terbakar (*burned area*, mis. MCD64A1). Hotspot ≠ area terbakar.
- Bukan sistem pelaporan warga atau chatbot.
- Bukan sekadar peta hotspot real-time. FIRMS sudah menyediakannya.

Inti penilaian ada pada **konsistensi deret waktu lintas sensor** dan **kalender yang membantu keputusan**.

## 7. Definisi istilah singkat

| Istilah | Arti |
|---|---|
| Hotspot / active fire | Piksel yang suhunya jauh lebih tinggi dari sekitarnya pada saat satelit lewat. Bukan selalu api hutan (bisa flare gas, gunung api, industri) |
| FIRMS | Fire Information for Resource Management System (NASA), portal distribusi data hotspot MODIS dan VIIRS |
| MODIS C6.1 | Versi algoritma (Collection 6.1) produk api MODIS |
| VNP14IMG / VJ114IMG | Produk api VIIRS 375 m dari Suomi-NPP / NOAA-20 |
| FRP | Fire Radiative Power (MW), ukuran intensitas radiasi api |
| Confidence | Tingkat keyakinan deteksi (MODIS 0-100; VIIRS low/nominal/high) |
| Overlap period | Periode ketika MODIS dan VIIRS sama-sama aktif (2012 sampai sekarang), dipakai untuk kalibrasi |
| Burning activity calendar | Heatmap tahun × bulan yang warnanya menunjukkan intensitas aktivitas pembakaran |
| Anomali | Selisih nilai bulan tertentu terhadap baseline historis (median/rata-rata) bulan yang sama |
| AOI | Area of Interest, wilayah yang dipilih pengguna |
| KHG | Kesatuan Hidrologis Gambut, unit pengelolaan ekosistem gambut di Indonesia |
