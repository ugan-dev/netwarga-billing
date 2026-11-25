# NetWarga Manager v2 - Siap Upload (Dengan Login Admin + Light/Dark Mode)

## Pembaruan di Versi 2
- **Layar Login Admin:** Mendukung **PIN Cepat** (default `123456`, bisa diubah di menu Pengaturan) maupun **Firebase Authentication (Email & Password)**.
- **Halaman Tagihan Warga (`?inv=...`) Tetap Terbuka Tanpa Login:** Warga yang mengklik link dari WhatsApp langsung melihat tagihan dan QRIS tanpa terhadang layar login admin.
- **Tema Identik (Light & Dark Mode ON/OFF):** Konsisten dengan versi sebelumnya.

## Cara Upload
1. Upload `index.html` ke repositori GitHub Anda dan aktifkan **GitHub Pages** (`Settings -> Pages`).
2. Login ke dashboard admin memakai PIN awal `123456` (segera ubah PIN di tab **Pengaturan & Firebase**).
3. Tempel `firebaseConfig` JSON di tab **Pengaturan & Firebase** dan klik **Hubungkan & Sinkronkan Firebase**.
4. Pasang `cronjob/google-apps-script-wa.js` di **script.google.com** dengan Trigger harian.
