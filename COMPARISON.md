# Perbandingan empat build (14 November 2026)

Empat build ini sengaja dibuat paralel supaya bisa dibandingkan. Skor di bawah adalah perkiraan, bukan skor juri.
Kriterianya kriteria resmi 2026 (Impact, Creativity, Validity, Relevance, Presentation, masing-masing 1 sampai 5).

| Build | Folder / repo | Snapshot yang dibandingkan |
|---|---|---|
| A. KalenderApi v1.0 | `kalenderapi/app`, github.com/13222093/kalendarapiv1 | commit `5c9b5cc` |
| B. KalenderApi v1.1 | `kalenderapi-v1.1`, akan didaftarkan di `13222093/kalendarapiv2` | commit `d929f4f` (masih dikerjakan) |
| C. Second Sight | github.com/Inforable/nasa-challenge-benchmark | commit `9fff725` |
| D. Proyek 4 (terpadu) | `kalenderapi-v4-integrated` (git lokal) | dibangun dari snapshot A dan C, lihat `INTEGRATION.md` |

## 1. Ketiganya menjawab pertanyaan yang berbeda

| | Pertanyaan inti | Peran |
|---|---|---|
| A. v1.0 | "Lihat: angka nol bisa bohong" | **Menunjukkan.** Presentasi dulu, di atas rekaman harmonisasi milik Fire Harmony |
| B. v1.1 | "Buktikan: berapa api yang tersembunyi, dan apakah perkiraannya lolos uji?" | **Membuktikan.** Sains dulu, sempit (Pulang Pisau, Agustus sampai Oktober 2019), pra-registrasi |
| C. Second Sight | "Perbaiki: berapa bagian dari kenaikan api Indonesia sejak 2012 yang hanya artefak ganti satelit?" | **Memperbaiki.** Harmonisasi sendiri, nasional, divalidasi |

Ini bukan tiga versi dari satu produk. A dan B membahas **nol yang buta** (Pilar 2). C membahas **lompatan sensor** (Pilar 1).
Keduanya adalah dua kebohongan dalam rekaman yang sama, pada satuan yang sama (sel-hari 0,01 derajat).

## 2. Skor per kriteria (perkiraan)

| Kriteria | A. v1.0 | B. v1.1 | C. Second Sight | Catatan |
|---|---|---|---|---|
| Impact | 3,5 | 4 | 4 | C menyasar BPBD, KHG/BRGM, Manggala Agni dengan bahasa Indonesia; B punya angka "api yang terlewat" kalau lolos |
| Creativity | 3,5 | 4 | 3 | Harmonisasi (C) adalah pilar yang paling ramai; nol buta harian (A, B) belum dibuat pesaing mana pun |
| Validity | 2,5 | 3 sekarang, 4,5 bila terdaftar dan diuji | 4,5 | C: 94 cek ditulis sebelum run, kegagalan dilaporkan. A: harmonisasinya milik Fire Harmony |
| Relevance | 4 | 4,5 | 5 | Statement challenge meminta alat harmonisasi; C mengerjakannya sendiri |
| Presentation | 4,5 | 4 | 2 | C: app masih "Data contoh" sintetis dan kartu validasi kosong |
| **Total sekarang** | **18** | **19,5** | **18,5** | |
| **Potensi sampai Minggu** | 19 | 22 | 20 (bila data asli masuk app) | |

Pembanding: kiln-watch sekitar 24 dan Fire Harmony sekitar 23 (H2H-00-sintesis.md). **Tidak ada satu build pun yang
sendirian mengalahkan keduanya.** A kuat di tampilan tapi meminjam inti sains; C kuat di sains tapi tampilannya belum siap.
Kelemahannya saling menutup.

## 3. Risiko fatal masing-masing

- **A. v1.0: inti yang dipinjam.** Permintaan utama challenge (harmonisasi) dikerjakan oleh kode dan data tim lain di
  challenge yang sama (Fire Harmony, Malaysia). Lisensinya sah (Apache-2.0, ada NOTICE), tetapi juri yang mengenal
  Fire Harmony bisa membaca app ini sebagai tampilan baru dari karya mereka. Data juga masih diambil dari hosting
  Fire Harmony.
- **B. v1.1: waktu dan satu uji.** Angka utama baru boleh dihitung setelah Release `prereg-v1` terbit. Kalau H2
  gagal, hero turun ke lapisan deskriptif (sudah diatur di tangga cadangan). Basis app sama dengan A.
- **C. Second Sight: app tanpa data asli.** Sekitar 30 jam sebelum tenggat, semua angka di app masih sintetis.
  Uji leave-one-region-out gagal untuk Kalimantan (galat 20%) dan seam 2022 gagal (drift Aqua), padahal Kalimantan
  wilayah fokus. Cakupannya juga melebar (agen LLM, brief, decision layer).

## 4. Yang hanya dimiliki satu build

| Hanya di | Aset |
|---|---|
| A. v1.0 | Story sinematik, Play the season (98.681 titik VIIRS asli), nol buta harian 0,01 derajat untuk 14 kabupaten Kalteng, kartu SiPongi, foto NASA hari itu |
| B. v1.1 | Pra-registrasi dengan cap waktu Release GitHub, `guard.py` yang menolak 2019 sebelum terdaftar, keadaan sel-hari di grid asli MODIS 1 km, jalur VIIRS VNP14A1, halaman `#/zero` dan `#/calendar`, unit test |
| C. Second Sight | Harmonisasi sendiri (kappa per strata, bootstrap 1000x, rantai NOAA-20 dan Terra), 94 cek validasi, temuan "kenaikan itu artefak" (tren mentah +1.740 vs harmonis -1.614 sel-hari/tahun, masih preliminer), temuan gambut siang/malam, UI dwibahasa, dokumen submission hampir lengkap (AI acknowledgement, credits, limitations, test report) |

Kelemahan bersama: belum ada perkiraan api tersembunyi, belum ada situs live, dan FireMask VIIRS butuh NASA Earthdata
Login.

## 5. Kenapa proyek 4 bukan sekadar "gabungan"

1. **Satu satuan.** Second Sight menghitung sel-hari api di grid 0,01 derajat. Nol buta v1.0 juga di grid 0,01
   derajat. Jadi angka harmonisasi dan keadaan nol (terlihat atau buta) jatuh di sel dan hari yang sama.
2. **Slot yang sudah disiapkan.** Ekspor Second Sight punya kolom `obs_class` yang masih kosong. Aturannya (TRI-04)
   sudah ditulis tim C sebelum run. Proyek 4 mengisinya dari FireMask MODIS dengan aturan mereka sendiri, bukan aturan
   baru.
3. **Satu cerita.** The jump (lompatan 2012, angka C) -> the fix (skala adil dengan pita 90%, angka C) -> the zero
   (nol buta per kabupaten dan per hari, data A) -> the proof (uji api tersembunyi, milik B, belum ada).
4. **B tetap jalur bukti terpisah.** Proyek 4 tidak menghitung statistik baru untuk Pulang Pisau atau Kalteng
   1 Januari sampai 31 Oktober 2019, dan tidak menjalankan H2/H4, supaya pra-registrasi B tidak tercemar.
5. **Mengurangi risiko inti yang dipinjam.** Rekaman Indonesia di proyek 4 memakai harmonisasi tim sendiri (C).
   Penjelajah global Fire Harmony tetap ada, tetapi diberi label "Global context (Fire Harmony)".

## 6. Cara membandingkan keempatnya besok

- **Naskah demo yang sama** untuk keempat build: 30 detik, satu kabupaten Kalteng, satu bulan berasap.
- **3 sampai 5 penguji** (bukan anggota tim). Setelah 60 detik, minta mereka menjelaskan dua hal dengan kata-kata
  sendiri: (1) kenapa rekaman api melompat di 2012, (2) kenapa nol bisa tidak berarti "tidak ada api". Catat benar/salah.
- **Kepercayaan:** "Seberapa percaya Anda pada angka ini, 1 sampai 5, dan kenapa?"
- **Juri-proxy:** skor lima kriteria di atas oleh dua orang secara terpisah, lalu dibandingkan.
- **Kesiapan submit:** situs live, README, AI_USE, references, video 30 detik.

## 7. Status proyek 4

Lihat `INTEGRATION.md` (rencana dan kontrak data) dan `docs/DATA.md`, `docs/APP.md` (catatan kerja). Tabel ini akan
diperbarui dengan kolom D setelah proyek 4 bisa dijalankan dengan data asli.
