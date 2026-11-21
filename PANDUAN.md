# Panduan Dashboard Cuaca Aziz 4.1

*Guide in English: GUIDE.md*

## 0. App web (cara utama)

Alamat: **https://azizdigital.github.io/dashboard-cuaca/**

**Pasang:**
- PC (Chrome / Edge): menu ⋮ → **Pasang Dashboard Cuaca Aziz**.
- iPad / iPhone (Safari): Kongsi → **Tambah ke Skrin Utama**.
- Android / Mi Pad (Chrome): menu ⋮ → **Pasang app**.

Rupa sama seperti app lama. Yang baru dalam 4.1:
- **Ramalan 7 / 14 / 28 hari:**
  - 7 & 14 hari: ramalan harian.
  - 28 hari: trend dari 31 larian model GFS. Minggu 3–4 hanya menunjukkan lebih / kurang hujan & angin, bukan hari yang tepat.
- **Laut: ombak & swell:** tinggi, tempoh & arah, sehingga ~10 hari.
- **Pasang surut:** jadual Cukai (dari Tide Forecast) + graf paras laut.
- **Paras air & hujan JPS (Kemaman):**
  - Dibaca oleh GitHub setiap ~15 minit (mirror). Tiada relay, tiada setup.
  - Dalam kad paras air dan hujan, tekan **Jadual penuh JPS** untuk lihat jadual dengan lajur sama seperti laman asal.
  - Tekan *Semua negeri* untuk semua stesen Terengganu.
- **Tab Water Level Kemaman & Rainfall Kemaman (4.5, web & iPad):** halaman khas app sendiri, bukan lagi lompat ke kad dashboard.
  - Data: bacaan 5 minit JPS untuk 8 stesen paras air dan 17 stesen hujan Kemaman, 30 hari, dibaca oleh mirror GitHub setiap ~15 minit (folder `kemaman/` cawangan `data`).
  - Paras air: ringkasan status, peta (OpenStreetMap) atau skema sungai sebenar dengan main semula 24 jam, graf semua stesen berbanding ambang, % ke Bahaya, kad setiap stesen.
  - Hujan: peta gelembung, kedudukan & jumlah 1/3/6/24 jam & 7 hari, heatmap stesen × jam, hujan sebenar berbanding ramalan 5 model.
  - Tekan stesen: nombor besar, hidrograf 1–30 hari (seret untuk zoom), hujan berdekatan, ramalan 5 model dan anggaran paras 4 / 24 jam.
  - Butang **PDF** (A4) dan **Gambar** (PNG untuk WhatsApp); boleh dipilih dalam Mod dinding.
  - **App PC (4.5.4):** halaman yang sama; PC baca JPS terus setiap 3 minit. **Laman asal** = laman infobanjir dalam tab yang sama, **← Halaman app** untuk kembali (diingat bagi setiap tab / pane Mod dinding).
  - Kedudukan stesen: koordinat JPS (data.gov.my) atau kampung / jambatan stesen di sungai OpenStreetMap (anggaran, bulatan putus-putus).
- **Laman yang tidak benarkan dipaparkan dalam app lain:**
  - Kalau ada versi dari sumber yang sama, ia dibuka di dalam app dengan bar "Laman ganti" dan butang **Laman asal ↗**. Contoh: Windy (versi embed), RainViewer, dan kad JPS / MET / pasang surut di Dashboard.
  - Kalau tiada, laman itu dibuka di tab baru.
- **Relay Cloudflare tidak diperlukan lagi.** Worker di Cloudflare boleh dipadam.

**Mirror GitHub:**
- Masa bacaan terakhir ditunjuk di setiap kad.
- Jika repo tiada aktiviti selama 60 hari, GitHub hentikan bacaan berjadual (GitHub akan hantar emel dulu).
- Untuk hidupkan semula: repo → Actions → *Mirror data* → *Enable workflow*.

**Peranti lain:**
1. Di peranti asal: Tetapan › Peranti lain › **Salin pautan tetapan**.
2. Hantar pautan kepada diri sendiri (WhatsApp / emel).
3. Di peranti lain:
   - **PC / Android:** buka pautan itu.
   - **iPad / iPhone:** buka app → Tetapan › Peranti lain › **Tampal pautan dari peranti lain**.

## 1. Pasang & jalankan (PC Windows)

1. Pasang **Node.js 20 atau lebih baru** (sekali sahaja).
2. Dalam folder projek: `npm install`
3. Jalankan: `npm start`
4. Bina `.exe`: `npm run dist` → dalam `dist\`: `Dashboard Cuaca Aziz 4.4.2.exe` (portable) dan `Dashboard Cuaca Aziz Setup 4.4.2.exe` (installer)

App ini guna port **30040–30042**, berbeza dari OIM Wazira (30030–30032), jadi kedua-dua boleh dibuka serentak.

Bila dibuka, splash 5 saat dipaparkan dulu (sama seperti OIM Wazira), kemudian tetingkap utama.

**Dari versi 3.0 (Monitor Cuaca Kemaman):** tetapan, sejarah dan log alert disalin automatik ke folder baru `%APPDATA%\Dashboard Cuaca Aziz` pada kali pertama.

## 2. Bahasa (English / Bahasa Melayu)

App bermula dalam **English**.

- **Tukar:** butang **BM** di bar atas (ia tunjuk **EN** semasa Bahasa Melayu aktif). Juga **Tetapan › Bahasa / Language**, atau Ctrl+K → "Bahasa Melayu".
- Halaman dimuat semula sekali dalam bahasa baru.
- **Semua ikut bahasa:** menu, dashboard, alert, notifikasi Windows, menu ikon tray, splash dan halaman telefon.
- **MET Malaysia:** amaran guna teks English yang MET terbitkan. Frasa ramalan 7 hari diterjemah (contoh *Hujan di kebanyakan tempat* → *Rain in most places*).
- Nama tempat, sungai dan stesen tidak diterjemah.
- Pilihan disimpan di PC. Telefon yang bersambung ke PC guna bahasa yang sama. Telefon tanpa PC kekal dengan bahasa terakhir.

## 3. Profil lokasi

Butang **📍** di bar atas menunjukkan profil aktif. Klik untuk tukar.

| Profil asal | Jenis | Koordinat |
|---|---|---|
| Kemaman | darat | 4.2324, 103.4229 (Chukai) |
| Irong Barat (offshore) | offshore | 5.5501, 104.7745 |

- **Hanya profil aktif dipantau.** Alert profil lain tidak berbunyi sehingga anda tukar ke profil itu.
- Setiap profil ada **lokasi, sumber data dan ambang alert sendiri**. Tetapan umum (kekerapan kemas kini, bunyi, notifikasi, tray, bahasa) dikongsi semua profil.
- **Tambah profil:** Tetapan › Profil lokasi → isi nama, jenis (Darat / Offshore), latitud, longitud → **Tambah profil**. Profil baru terus aktif.
- **Ubah profil aktif:** kad "Lokasi" dan "Ambang alert" di Tetapan → **Simpan**.
- **Padam:** butang Padam pada senarai profil. Sejarahnya kekal dalam folder data.
- Sejarah setiap profil disimpan berasingan.

### Profil offshore

Dashboard bertukar. Kad sungai dan ramalan MET daerah disorok, dan diganti dengan:

- **Kad ringkas:** angin (knot), tiupan maks 6 jam, ombak, alun (swell), penglihatan minimum, risiko ribut petir (Rendah / Sederhana / Tinggi), amaran MET.
- **Keadaan offshore:** graf tinggi ombak dan tiupan angin (48 jam), dengan garis ambang, dan jadual 24 jam. Setiap baris jadual = **nilai paling teruk** dalam 3 jam itu, supaya puncak singkat tidak terlepas.
- **Alert:** tiupan angin, ombak, penglihatan rendah, ribut petir dijangka (6 jam), dan amaran laut MET (kata kunci asal: Terengganu, Condore, Reef North).

Risiko ribut petir: **Tinggi** = model meramal ribut petir. **Sederhana** = udara tidak stabil (CAPE ≥ 1000) dan peluang hujan ≥ 50%.

Semua data offshore ialah **ramalan model Open-Meteo**, bukan bacaan stesen di platform. Untuk keputusan operasi, rujuk sumber rasmi.

## 4. Apa yang ada

| Bahagian | Isi |
|---|---|
| **Dashboard** | Banner alert, kad ringkas, paras air sungai (darat), keadaan offshore (offshore), hujan setiap jam, hujan stesen, ramalan MET 7 hari, amaran MET, laut, status sumber, pautan semua laman |
| **Laman web** | 26 laman dalam app. Sehingga 6 tab kekal terbuka. Undur / maju / muat semula / zum / buka di pelayar. Auto muat semula 1–30 minit. Butang **Tutup semua** |
| **Mod dinding** | 2, 3, 4 atau 6 laman serentak. Panel dengan tarikh lama ditanda ⚠ |
| **Sejarah & graf** | Darat: paras air setiap stesen + ambang. Offshore: ombak, alun, tiupan, angin. Hujan 7 hari. CSV. 45 hari |
| **Alert** | Alert aktif, Akui, uji bunyi, senyap 1 jam, log |
| **Tetapan** | Profil lokasi, lokasi & ambang profil aktif, kekerapan, notifikasi, tray, mula bersama Windows, bahasa, diagnostik |

**Pintasan papan kekunci**

| Kekunci | Tindakan |
|---|---|
| Ctrl+K | Cari laman / arahan, termasuk tukar profil dan bahasa |
| Ctrl+H | Dashboard |
| Ctrl+L | Mod dinding |
| Ctrl+R / F5 | Muat semula laman |
| F9 | Kemas kini data |
| Alt+← / → | Undur / maju |
| Ctrl+W | Tutup tab |
| Ctrl+Shift+W | Tutup semua laman |
| Ctrl+P | QR telefon |

## 5a. Penyekat iklan (app desktop)

Iklan, pop-up iklan dan notis cookie disekat dalam semua laman di dalam app, dan ruang kosong yang ditinggalkan dibuang.

- **Nombor 🛡️** dalam bar laman = iklan yang disekat di laman itu.
- **Klik 🛡️** untuk matikan penyekat bagi laman itu sahaja (jika laman rosak atau minta matikan adblock). Klik lagi untuk hidupkan semula.
- **Tetapan › Penyekat iklan:** suis hidup/mati, senarai laman yang tidak disekat, bila senarai dikemas kini, **Kemas kini sekarang**.
- Senarai terbina dalam app dan dikemas kini sekali sehari di latar belakang. Hanya laman disekat, bukan sumber data.
- Tiada dalam app telefon / tablet: pelayar telefon tidak membenarkannya.

## 5. Laman (26)

| Kategori | Laman |
|---|---|
| Banjir & Paras Air | Water Level Kemaman, Rainfall Kemaman, Flood Hub Chukai, Info Banjir Terengganu, **JPS Aras Air Terengganu**, **JPS Peta Infobanjir** |
| Cuaca & Radar | Zoom Earth Chukai, Windy Kemaman, Ventusky, Rain Radar, Met Malaysia, **Radar MET Semenanjung**, **Satelit Himawari** |
| Offshore & Laut | **Windy Ombak**\*, **Windy Angin**\*, **Earth Nullschool Ombak**\*, **Peta Kilat Blitzortung**\*, **VesselFinder** |
| Pasang Surut | Tide Forecast, Tides Chart, Tides 4 Fishing |
| Kamera & Visual | Info Banjir Camera, Webcam Teladas, JalaNow Traffic Cams |
| Amaran & Kecemasan | Portal NADMA, **Ribut Tropika** (Zoom Earth Storms) |

**Tebal** = baru dalam 3.1. Semuanya percuma dan tidak perlu daftar. Dalam mod English, nama laman dan kategori dipaparkan dalam English (contoh *Radar MET Semenanjung* → *MET Peninsular Radar*). \* = ikut lokasi profil aktif: bila anda tukar profil, laman ini terus ke koordinat profil itu.

Titik di sebelah setiap laman: **hijau** = laman menjawab, **merah** = tidak dapat dicapai (disemak setiap 30 minit).

## 6. Kamera dan data lama

Sesetengah kamera berhenti dikemas kini oleh pemiliknya, dan masih menunjukkan gambar dari 2025. App tidak dapat membetulkan kamera itu, tetapi ia membantu anda **mengesannya**:

- Selepas laman dibuka, app membaca tarikh penuh yang tertulis di laman (contoh `12/03/2025 10:15`) dan menunjukkan tarikh paling baru di bar laman.
- **⚠ oren** = tarikh terkini lebih 2 hari lalu, iaitu kamera/data mungkin sudah tidak aktif. **✓ hijau** = baru.
- Laman kategori Kamera sentiasa dimuat semula **tanpa cache**.
- Had: tarikh yang **dicetak di dalam gambar** tidak dapat dibaca. Hanya teks di laman. Ciri ini untuk app desktop sahaja.

## 7. Dari mana data datang

| Data | Sumber |
|---|---|
| Cuaca, hujan, angin, penglihatan, ribut petir | Open-Meteo (model) di koordinat profil |
| Ombak, alun, paras laut | Open-Meteo Marine (model) di titik laut profil |
| Ramalan 7 hari | MET Malaysia (data.gov.my), kod daerah. Profil darat sahaja |
| Amaran cuaca & laut | MET Malaysia (data.gov.my), ditapis ikut kata kunci profil. Setiap kad amaran tunjuk jubin (angin, ombak, ribut petir, tempoh), jadual kawasan kata kunci anda, dan teks penuh MET di bawah "Tunjuk teks penuh" |
| Paras air & hujan stesen | infobanjir Terengganu (app desktop membaca jadual laman). Profil darat sahaja |
| Paras air (sumber kedua) | data.gov.my flood-warning. Data Kemaman di sini bertarikh Feb 2024, jadi ditanda "data lama" |

Jika kad Paras Air kosong: **Tetapan › Diagnostik**, kemudian hantar teks itu kepada saya.

## 8. Alert

Alert berbunyi dan keluar notifikasi Windows bila ambang profil aktif dilepasi. Alert yang sama tidak berbunyi berulang kali; ia berbunyi semula hanya jika tahap naik. Alert **Bahaya** yang belum diakui berbunyi setiap minit.

**Tutup tetingkap = app tutup terus** (mulai 3.3.1). Alert hanya berbunyi semasa app dibuka. Jika mahu app terus memantau selepas tetingkap ditutup, hidupkan **Tetapan › Kekal di tray bila ditutup**: app akan kekal di tray (sebelah jam); untuk keluar, klik kanan ikon tray → Keluar.

## 9. Telefon / tablet (QR)

1. PC: **Fail › Telefon / tablet (QR)** atau Ctrl+P.
2. Telefon: sambung ke Wi-Fi yang sama atau Mobile Hotspot PC.
3. Imbas QR 1 → percaya sijil **"Dashboard Cuaca Local CA"** (sekali sahaja).
4. Imbas QR 2 → **Add to Home Screen** (iPhone/iPad) / **Install app** (Android).

Halaman pemasangan telefon ikut bahasa PC, dan ada butang **English / Bahasa Melayu** sendiri di bawah.

**Telefon yang sudah pasang 3.0:** sijil baru perlu dipercayai sekali lagi (QR 1), kemudian pasang semula app (QR 2).

Profil yang dipilih di telefon (bila bersambung ke PC) ialah profil PC juga. Tanpa PC, telefon boleh tukar antara profil yang disimpannya, tetapi tambah atau padam profil perlu PC.

## 9a. Laman titik biru di iPad / telefon (relay laman)

Sesetengah laman tidak membenarkan dirinya dipaparkan di dalam app lain (X-Frame-Options / CSP). App desktop tetap
memaparkannya dalam pelayar sendiri; Safari di iPad tidak boleh. Dua cara, kedua-duanya tanpa PC:

- **Tanpa apa-apa tetapan:** tekan laman itu = terus dibuka dalam lembaran pelayar di atas app (tekan **Done** untuk kembali).
- **Relay sendiri (percuma, kira-kira 5 minit, perlu akaun Cloudflare percuma):** laman keluar di dalam app, seperti di PC.
  1. Daftar di **dash.cloudflare.com** (emel + kata laluan; pelan percuma tidak perlu kad).
  2. **Workers & Pages** → **Create** → **Hello World** → beri nama (cth `cuaca-relay`) → **Deploy**.
  3. Dalam app: **Tetapan › Relay laman** → **Salin skrip relay** (kunci rahsia dibuat kali pertama).
     Dalam Cloudflare: **Edit code** → padam semua → tampal → **Deploy**.
  4. Salin alamat worker (`https://cuaca-relay.<nama-anda>.workers.dev`) ke **Alamat relay** → **Simpan** → **Uji relay**.
  Relay hanya mengambil laman Dashboard Cuaca Aziz, perlu kunci, dan tidak menghantar cookie atau log masuk.
  Buat sekali di PC: telefon/iPad dapat tetapan relay bila bersambung ke PC kali seterusnya, dan menyimpannya.
  Laman ringkas (JPS, infobanjir) berfungsi baik; app peta yang sangat berat (Zoom Earth, Flood Hub) mungkin tidak - guna butang **↗** untuk laman itu.
  Pelan percuma membenarkan 100,000 permintaan sehari, lebih daripada cukup untuk seorang.
- **Laman ganti (3.5):** sesetengah laman kerajaan juga menolak Cloudflare (Uji relay tunjuk ✗). Untuk laman itu iPad
  memaparkan laman ganti dari sumber yang sama di dalam app, dengan bar "Laman ganti: …" dan pautan **Laman asal ↗**:
  Water Level / Rainfall Kemaman → halaman Kemaman app sendiri (4.5); Info Banjir Terengganu → JPS
  Infobanjir Map; MET Peninsular Radar → radar hujan Windy (data radar MET Malaysia); Met Malaysia → kad MET di Dashboard;
  VesselFinder → peta embed rasmi VesselFinder. Ganti Windy dan VesselFinder berfungsi walaupun tanpa relay.

- **Sandaran GitHub melalui relay (4.5.2):** jadual GitHub untuk akaun percuma sering dilangkau, jadi salinan JPS di GitHub boleh
  jadi lama. Dengan skrip relay v4 + token, setiap kali app baca JPS langsung, relay minta GitHub jalankan mirror (paling kerap
  setiap 10 minit). Sekali sahaja:
  1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → *Generate new token*.
     Nama: `dashboard-cuaca-relay`; Expiration: pilih (contoh 1 tahun); Repository access: **Only select repositories** →
     `dashboard-cuaca`; Permissions → Repository permissions → **Actions: Read and write**. *Generate* → salin token (`github_pat_…`).
  2. Cloudflare → Workers & Pages → worker relay awak → **Settings → Variables and Secrets → Add** → Type **Secret**,
     Name `GH_TOKEN`, Value = token tadi → *Deploy*.
  3. App → Tetapan › Relay laman → **Salin skrip** → Cloudflare → worker → *Edit code* → tampal ganti semua → *Deploy*
     (laman relay tunjuk "relay v4").
  Semak: buka halaman Water Level Kemaman → ⚡ Paksa kemas kini → mesej tunjuk "sandaran GitHub ✓".
  Token ini hanya boleh menjalankan Actions repo `dashboard-cuaca`; ia disimpan dalam Cloudflare, bukan dalam app.

## 10. Fail data

`%APPDATA%\Dashboard Cuaca Aziz` (Fail › Buka folder data):

- `config.json` – tetapan umum (termasuk bahasa) + profil
- `data\snapshot-<profil>.json` – data terakhir setiap profil
- `data\history\<profil>\YYYY-MM-DD.jsonl` – sejarah (45 hari)
- `data\alerts.jsonl` – log alert semua profil
- `cert\` – sijil telefon. Backup folder ini.

## 11. Ujian

```
npx playwright install chromium   (sekali sahaja)
npm test
```

- `tests/unit.js` – 33 ujian (termasuk: setiap teks ada versi English; alert dan amaran MET dalam dua bahasa)
- `tests/app.spec.js` – 21 ujian pelayar (termasuk: tiada perkataan Melayu tertinggal dalam mod English; tukar ke BM dan kembali; halaman telefon)
