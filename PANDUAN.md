# Panduan Dashboard Cuaca Aziz 4

## Buka & pasang
Alamat: **https://azizdigital.github.io/dashboard-cuaca/**

- **PC (Chrome / Edge):** buka alamat → menu ⋮ → *Pasang Dashboard Cuaca Aziz* (atau ikon pasang di bar alamat).
- **iPad / iPhone (Safari):** butang Kongsi → *Tambah ke Skrin Utama*.
- **Android / Mi Pad (Chrome):** menu ⋮ → *Pasang app* / *Tambah ke skrin utama*.

App mengemas kini dirinya sendiri. Kalau nampak versi lama, tutup app dan buka semula.

## Apa yang ada
- **Sekarang:** suhu, angin & tiupan (km/j + knot), ombak, swell.
- **Amaran MET:** amaran yang menyebut kawasan anda diserlahkan, dan teks penuh MET boleh dibuka.
- **Pasang surut:** waktu pasang & surut Cukai (dari Tide Forecast) + graf paras laut.
- **Ramalan 7 / 14 / 28 hari:**
  - 7 & 14 hari: ramalan harian.
  - 28 hari: trend dari 31 larian model GFS. Minggu 3–4 hanya menunjukkan lebih / kurang hujan, bukan hari yang tepat.
- **Laut:** ombak & swell (tinggi, tempoh, arah), sehingga ~10 hari.
- **Ramalan MET 7 hari** untuk daerah.
- **Paras air & hujan JPS:** jadual sama seperti laman asal JPS.
  - Warna mengikut ambang Waspada / Amaran / Bahaya.
  - Butang *Semua negeri* untuk lihat semua stesen.
- **Laman:** tekan jubin.
  - ▣ = laman dibuka di dalam app; tekan ← untuk kembali.
  - ↗ = laman dibuka di tab baru, sebab laman itu tidak benarkan dipaparkan dalam app lain.

## Data JPS & pasang surut (mirror GitHub)
Laman JPS dan Tide Forecast tidak membenarkan app lain membaca datanya. Jadi GitHub membacanya setiap ~15 minit dan app memaparkan salinan itu.
- Masa bacaan terakhir ditunjuk di bawah setiap jadual.
- Kadang-kadang GitHub lewat 5–20 minit.
- **GitHub akan berhenti menjalankan bacaan berjadual jika repo tiada aktiviti selama 60 hari.** GitHub akan hantar emel dulu. Untuk hidupkan semula: repo → Actions → *Mirror data* → *Enable workflow*.

## Amaran
Jalur merah / jingga di atas muncul bila:
- ada amaran MET untuk kawasan anda;
- stesen JPS mencapai paras Waspada / Amaran / Bahaya;
- hujan JPS sejam melebihi had;
- tiupan angin atau ombak melebihi had.

Bunyi berbunyi sekali bagi setiap amaran baru, semasa app dibuka. Tekan 🔔 untuk senyapkan. Had boleh diubah di ⚙ Tetapan.

## Lokasi
- Tekan **＋** di atas.
- Cari nama tempat dan pilih.
- Semak **titik laut**: ia mesti di laut untuk ombak, swell dan pasang surut.
- Kemudian simpan.
- Untuk ubah atau padam: ⚙ Tetapan → Lokasi.

## Peranti lain
Setiap peranti simpan tetapan sendiri.
1. Di peranti asal: ⚙ → **Salin pautan tetapan**.
2. Hantar pautan kepada diri sendiri (WhatsApp / emel).
3. Di peranti lain:
   - **PC / Android:** buka pautan itu.
   - **iPad / iPhone:** buka app dari skrin utama → ⚙ → **Tampal pautan**.

## Had
- infobanjir.terengganu.gov.my dan met.gov.my hanya membenarkan sambungan dari Malaysia. GitHub tidak boleh membacanya, jadi kedua-duanya dibuka di tab baru.
- Notifikasi hanya berfungsi semasa app dibuka.
- Ramalan hanyalah panduan. Ikut arahan rasmi MET, JPS & NADMA.

App lama (3.x, Windows Electron) masih ada dalam folder `legacy/`.
