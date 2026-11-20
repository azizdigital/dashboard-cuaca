# App iPad / iPhone - Dashboard Cuaca Aziz

App iPad ni membuka setiap laman dalam paparan pelayarnya sendiri, macam Electron di PC. Jadi tiada laman yang boleh menolak dipaparkan. infobanjir Terengganu dan met.gov.my pun terbuka, sebab iPad awak berada di Malaysia. Dashboard di dalamnya ialah app web yang sama di GitHub, jadi ia sentiasa versi terbaru tanpa perlu pasang semula.

**Fail app:** https://github.com/azizdigital/dashboard-cuaca/releases/download/ipad-app/DashboardCuaca.ipa
GitHub membinanya semula sendiri setiap kali kod iPad berubah.

## Pasang kali pertama (di PC Windows, ±20 minit)

1. **Pasang iTunes dan iCloud dari laman Apple** (bukan versi Microsoft Store):
   - iTunes: https://www.apple.com/itunes/download/win64
   - iCloud: https://support.apple.com/en-us/HT204283 (pautan "Download iCloud for Windows" versi apple.com)
2. **Pasang Sideloadly:** https://sideloadly.io (percuma, tiada pendaftaran).
3. **Muat turun** `DashboardCuaca.ipa` dari pautan di atas.
4. **Sambung iPad ke PC dengan kabel USB.** Di iPad, tekan **Trust / Percaya**, kemudian masukkan kod laluan.
5. **Buka Sideloadly:**
   - seret `DashboardCuaca.ipa` ke dalamnya;
   - di ruang *Apple account*, isi Apple ID awak;
   - tekan **Start**;
   - masukkan kata laluan Apple ID, dan kod 6 digit jika diminta.
   - Lebih selamat guna Apple ID kedua (percuma) khas untuk ini.
6. **Di iPad, benarkan app:**
   - **Settings → General → VPN & Device Management** → tekan Apple ID awak → **Trust**.
   - iPadOS 16 ke atas: **Settings → Privacy & Security → Developer Mode → On**. iPad akan restart; selepas itu tekan **Turn On**.
7. Buka ikon **Cuaca Aziz** di Skrin Utama.

Tetapan app web di Safari tidak dibawa masuk. Untuk salin tetapan, di app lama atau PC tekan **Settings › Other devices › Copy settings link**. Kemudian di app iPad baru, tekan **Settings › Other devices › Paste link from another device**.

## Setiap 7 hari (had Apple untuk Apple ID percuma)

App akan berhenti dibuka selepas 7 hari. Untuk sambung semula:
- sambung iPad ke PC;
- buka Sideloadly, seret `DashboardCuaca.ipa`, tekan **Start**.

Tetapan dan data dalam app kekal. Sideloadly juga ada pilihan **auto-refresh**: ia memperbaharui sendiri melalui Wi-Fi bila PC hidup dan berada dalam rangkaian yang sama.

## Guna

- Tekan jubin laman: laman dibuka penuh skrin.
  - **Selesai**: kembali ke dashboard.
  - ‹ ›: belakang / depan.
  - ⌂: halaman mula.
  - ⬆︎: kongsi.
  - 🧭: buka di Safari.
- Laman yang pernah dibuka diingat; buka semula dan ia di tempat yang sama.
- Tarik dashboard ke bawah untuk muat semula.
