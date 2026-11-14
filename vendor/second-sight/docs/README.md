# Knowledge Base: NASA Space Apps 2026, "Harmonization of MODIS and VIIRS Hot Spots"

> Disusun 13 Nov 2026, sehari sebelum hackathon (14-15 Nov, online; pitching lokal Bandung 21 Nov).
> Isi: hasil riset, **bukan kode**. Tidak ada pekerjaan solusi yang dimulai sebelum event.
> Penggunaan AI: riset, ide, dan PRD disusun dengan bantuan AI. Submission Guide resmi 2026 melarang AI untuk ide solusi, tetapi CP lokal Bandung mengonfirmasi ke tim (13 Nov) bahwa AI boleh untuk ide dan PRD. Simpan bukti tertulisnya, dan tetap akui penggunaan AI di submission.

## Cara membaca

| Urutan | Dokumen | Isi | Baca kalau... |
|---|---|---|---|
| 1 | [01-masalah-challenge.md](01-masalah-challenge.md) | Masalah sebenarnya: step change palsu, dua fase challenge, pengguna, konteks Indonesia, batasan scope, glosarium | Baru mulai |
| 2 | [02-pola-pemenang.md](02-pola-pemenang.md) | Aturan & penjurian 2026 (terverifikasi), cara berpikir pemenang 2023-2025, Bloomee vs QUEÑARIS, AIM-X, proyek kebakaran Space Apps lama | Menyusun strategi dan pitch |
| 3 | [03-benchmark-repo-pesaing.md](03-benchmark-repo-pesaing.md) | **43 repo pesaing** challenge yang sama: tier, metode, angka, kelemahan, risiko pre-build, fitur komoditas | Ingin tahu lawan |
| 4 | [04-repo-karhutla-dan-ekosistem.md](04-repo-karhutla-dan-ekosistem.md) | ~45 repo karhutla/fire lain + platform operasional (SiPongi, BRIN, BMKG, GNW, GWIS, ASMC, ...) dan kekurangannya | Mencari ide yang bisa dipinjam |
| 5 | [05-sains-dan-data.md](05-sains-dan-data.md) | Fakta sensor, status misi Nov 2026, literatur rasio, konteks gambut Indonesia, akses data, **metode baseline 48 jam** + rencana validasi | Merancang pipeline |
| 6 | [06-pendekatan-teknis-lanjutan.md](06-pendekatan-teknis-lanjutan.md) | Fisika deteksi, 10 ide harmonisasi fisika/statistik, benchmark suite, ML bermakna, LLM agent yang benar, stack 48 jam | Ingin pendekatan teknis yang kuat |
| 7 | [07-gap-analysis-dan-usp.md](07-gap-analysis-dan-usp.md) | Matriks kapabilitas, 12 celah, 8 kandidat USP, 3 opsi kombinasi, pertanyaan juri, risiko | Memutuskan arah |
| 8 | [08-blueprint-ide-dan-opsi-konsep.md](08-blueprint-ide-dan-opsi-konsep.md) | **Ide final setingkat PRD ("Second Sight")** + pustaka ~70 blok (data, fisika dengan rumus paper, statistik, validasi, AI, UX, engineering), teknologi pinjaman dari repo lain (dengan lisensi), 4 konsep alternatif berskor, demo 30 detik/7 slide/pitch, rencana 48 jam, risiko, Q&A juri, checklist | Dasar ide final |
| 9 | [09-second-sight-v2-upgrade-pipeline-dan-posisi.md](09-second-sight-v2-upgrade-pipeline-dan-posisi.md) | **Second Sight v2**: 11 upgrade (κ dinamis bersyarat FRP, prior fisika, triangulasi, kalender tiga keadaan, drift fisika, peluang keputusan, evidence ledger, validasi hidup, dataset terbuka, transfer global, repeat-burn), **pipeline 16 stage dengan quality gate**, **posisi vs 8 repo terkuat** (matriks, skor, head-to-head), ablation M0-M8, demo v2, dampak ke 48 jam | **Mulai di sini saat kickoff 14 Nov** (bersama 08) |
| 10 | [10-ui-ux-second-sight.md](10-ui-ux-second-sight.md) | **UI/UX dari pola terbukti**: peta asal-usul tiap pola (Kiln Watch, Fire Harmony, Burn Calendar, project-shift, Climate Reanalyzer, GWIS, OWID, Titik Api), layout & wireframe, spesifikasi layar, design system (token, font, ramp, lima keadaan sel, microcopy ID/EN), kode yang diadaptasi + lisensi + atribusi, posisi UI vs pesaing, checklist anti AI-slop, rencana build UI 48 jam | Untuk R4 (frontend) dan R5 (story) |
| 11 | [11-tiket-implementasi.md](11-tiket-implementasi.md) | **94 tiket implementasi** (47 P0, 39 P1, 8 P2) dalam 13 epic: setup, data, fisika, kalibrasi, triangulasi, anomali, validasi, keputusan, ekspor, frontend, AI, transfer, submission. Setiap tiket: prioritas, pemilik, estimasi, dependensi, kriteria selesai, output. Plus jalur kritis, checkpoint K0-K7, jadwal per jam, garis potong, definition of done | **Papan kerja hackathon** |

Catatan riset mentah (lebih detail, dengan URL sumber): folder [_raw/](_raw/)

| File | Isi |
|---|---|
| [_raw/repo-pesaing-batch1.md](_raw/repo-pesaing-batch1.md) | 14 repo pesaing (Kiln Watch, Icarus, FireLens, FireChronicle, ...) |
| [_raw/repo-pesaing-batch2.md](_raw/repo-pesaing-batch2.md) | 14 repo pesaing + 15 repo baru (EG FireTrack, Fire Harmony, flare-chronos, ...) |
| [_raw/repo-terkait-karhutla.md](_raw/repo-terkait-karhutla.md) | Repo karhutla Indonesia, tools FIRMS, forecasting ML, Space Apps lama, platform Indonesia |
| [_raw/sains-dan-data.md](_raw/sains-dan-data.md) | Sensor, status misi, literatur harmonisasi, Indonesia, akses data, metode |
| [_raw/aturan-pemenang-platform.md](_raw/aturan-pemenang-platform.md) | Aturan 2026 dari halaman resmi, pemenang, benchmark platform |
| [_raw/pendekatan-fisika-statistik.md](_raw/pendekatan-fisika-statistik.md) | Fisika deteksi, ide harmonisasi lanjutan, gambut, benchmark |
| [_raw/pendekatan-ai-agent-teknis.md](_raw/pendekatan-ai-agent-teknis.md) | ML, LLM agent, stack, matriks keputusan 22 baris, arsitektur |
| [_raw/ui-ux-audit-visual.md](_raw/ui-ux-audit-visual.md) | Audit visual 11 aplikasi live (pesaing, platform, app karhutla Indonesia), 28 pola, 13 anti-pola |
| [_raw/ui-ux-kode-dan-referensi.md](_raw/ui-ux-kode-dan-referensi.md) | Bedah kode frontend repo MIT/Apache, pustaka + versi + lisensi, referensi desain, checklist anti AI-slop |

## 10 temuan terpenting

1. **Challenge ini sangat ramai.** 43 repo pesaing ditemukan, mayoritas Bangladesh/India, dan banyak yang sudah membangun aplikasi lengkap **sebelum** event (risiko diskualifikasi bagi mereka). Pipeline dasar (grid bersama, rasio overlap, kalender median, CSV, AOI) sudah komoditas.
2. **Pesaing terkuat:** Kiln Watch (BD; uji "matikan MODIS", interval 95%), Fire Harmony (indikasi MY; ML per hexagon, PEATMAP, change-point + placebo, haze Sumatra/Borneo), EG FireTrack (indikasi MY; Borneo, kedalaman gambut, playbook BPBD/Manggala Agni), flare-chronos (indikasi VN; fisika footprint).
3. **Belum ada entri dari tim Indonesia**, dan wilayah Borneo hanya digarap dari sudut pandang Malaysia.
4. **Tidak ada platform operasional yang mengharmonisasi MODIS dan VIIRS.** SiPongi mencampur sensor tanpa koreksi, BRIN memakai VIIRS saja, Global Nature Watch hanya VIIRS sejak 2012, Nusantara Atlas menjumlahkan, GWIS memisahkan grafik dan memakai mean.
5. **Status misi mengubah desain:** S-NPP berhenti di FIRMS 2 Nov 2026; orbit Terra/Aqua drift sejak ~2020-2022 sehingga **kalibrasi sebaiknya hanya 2012-2021**; MODIS berakhir akhir 2026-2027.
6. **Rasio VIIRS:MODIS berkisar ~2× sampai >25×**, bergantung wilayah, musim, dan siang/malam. Rasio tunggal global tidak bisa dipertahankan, dan **belum ada rasio peer-reviewed khusus Indonesia/gambut**.
7. **Gambut adalah sudut ilmiah yang kosong:** api membara bersuhu rendah, aktif malam hari, tertutup asap. Hipotesis "rasio lebih tinggi di gambut dan malam hari" bisa diuji dalam beberapa jam dan belum diuji pesaing mana pun.
8. **Celah teknis yang belum diisi siapa pun:** koreksi drift orbit + siklus diurnal, ambang FRP fisik bersama / operator deteksi Sofiev 2026, koreksi awan per piksel, validasi terhadap SiPongi, baseline kondisional ENSO/IOD, unit KHG.
9. **Pola pemenang:** spesifisitas lokal + pengguna bernama + validitas yang ditampilkan > kecanggihan teknis. Bloomee (Bandung 2025, sangat teknis) kalah global dari QUEÑARIS (satu masalah lokal). G.R.O.W. 2024 adalah satu-satunya proyek kebakaran yang terkonfirmasi menang global.
10. **Aturan 2026 kritis:** demo maksimal 7 slide / 30 detik (melebihi = tidak eligible global), berbahasa Inggris, data NASA harus inti, tidak boleh mengerjakan sebelum event, AI tidak boleh untuk ide solusi dan wajib diakui. **Juri lokal Bandung bermitra dengan BRIN.**

## Tindakan sebelum 14 Nov 09:00 WIB (tanpa menulis kode)

- [ ] Ajukan **FIRMS Archive Download** Indonesia (MODIS C6.1, VIIRS S-NPP, NOAA-20, NOAA-21) karena antrean bisa lama.
- [ ] Siapkan akun Earthdata dan MAP_KEY FIRMS.
- [ ] Cek akses peta gambut (BBSDLP / PEATMAP) dan batas KHG, serta data luas terbakar SiPongi per provinsi.
- [ ] Tentukan pembagian peran (data & sains, harmonisasi & validasi, frontend, narasi/pitch).
- [ ] Hubungi satu praktisi (BPBD / Manggala Agni / peneliti) untuk wawancara singkat selama hackathon.
- [ ] Baca ulang aturan resmi dan Resources tab pada 14 Nov.

## Tanda kepercayaan sumber

- **[V]**: dicek ke dokumen primer.
- **[S]**: dari abstrak, ringkasan, atau media.
- **[UNVERIFIED]**: belum bisa dikonfirmasi.
- Semua angka repo pesaing adalah **klaim self-reported** dari README mereka.
