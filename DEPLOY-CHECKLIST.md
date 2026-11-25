# NetWarga Manager — Deploy Checklist (GitHub Pages + Firebase, gratis)

Status 25 Nov 2026 09:17 WIB: file v2 siap di `workspace/netwarga-billing/`.
Repo GitHub sudah dibuat: https://github.com/ugan-dev/netwarga-billing (publik, kosong, 0 commit).
Belum di-push, GitHub Pages belum aktif, Firebase belum dibuat, gateway WA belum dipilih.

## Versi 2 (baru, 25 Nov 09:17 WIB)
- Ada layar Login Admin: PIN Cepat (default **123456**) atau Firebase Auth (Email & Password).
- Ada tombol Keluar + ubah PIN di Pengaturan & Firebase.
- Halaman tagihan warga `?inv=...` tetap terbuka tanpa login.
- PERINGATAN: PIN itu hanya dicek di browser (JavaScript + localStorage), bukan
  keamanan server — siapa pun yang bisa buka kode halamannya bisa lewati.
  Segera ubah PIN default, dan untuk keamanan sungguhan pakai Firebase Auth
  (aktifkan Authentication Email/Password di Firebase Console).

## 1. GitHub (akun: gagan.70700@gmail.com)
- [ ] Buka link Connect GitHub dari Brio, login dengan gagan.70700@gmail.com
- [ ] Brio buat repo publik `netwarga-billing`, branch `main`
- [ ] Upload: `index.html`, `README.md`, `.nojekyll`, `cronjob/google-apps-script-wa.js`
- [ ] Settings → Pages → Branch `main`, folder `/ (root)` → Save
- [ ] URL hasil: `https://<username>.github.io/netwarga-billing/`
  (username GitHub belum dikonfirmasi — bukan otomatis gagan70700)

## 2. Firebase (disarankan project BARU, akun Google gagan.70700@gmail.com)
- [ ] console.firebase.google.com → Add project → nama `netwarga-billing`
- [ ] Build → Firestore Database → Create database → Production mode → lokasi `asia-southeast1` (Singapore, terdekat)
- [ ] Project Settings → Your apps → Web app (`</>`) → salin `firebaseConfig`
- [ ] Buka web GitHub Pages → Pengaturan & Firebase → tempel JSON → Hubungkan & Sinkronkan
- [ ] Firestore rules: lihat `firestore.rules` di folder ini.
  PERINGATAN: aplikasi ini + script Apps Script di ZIP membaca `customers` tanpa Auth,
  jadi butuh rules yang mengizinkan baca publik untuk koleksi itu. Itu cocok untuk
  link tagihan `?inv=...`, tapi jangan isi data sensitif lain di Firestore yang sama.
  Kalau mau dikunci, perlu tambah Firebase Auth dulu (belum ada di aplikasi ini).

## 3. WhatsApp cronjob — TIDAK ada yang 100% gratis untuk kirim otomatis
Script di ZIP butuh gateway. Pilih SATU:

### A. WAHA self-host (Rp 0, tapi butuh server 24/7 + risiko ban)
- Jalankan WAHA di server gratis (Altare ugan-server / Oracle A1 kalau dapat).
  `docker run -p 3000:3000 devlikeapro/waha` — lalu scan QR sekali dari HP.
- Isi di Apps Script: `WA_GATEWAY_TYPE: "WAHA"`, `WA_API_URL: https://<server>/api/sendText`,
  `WA_API_TOKEN: <api key WAHA>`.
- Risiko: WhatsApp bisa memblokir nomor yang kirim banyak pesan otomatis.
  Jeda 6–14 detik per pesan sudah ada di script.

### B. Meta WhatsApp Cloud API (resmi)
- 1.000 balasan service gratis/bulan. Pengingat tagihan = utility template,
  BAYAR per pesan + butuh kartu + template disetujui Meta. Bukan full gratis.

### C. Fonnte (contoh di script)
- Berbayar. Bukan opsi gratis.

### D. Manual wa.me (gratis, tanpa cronjob)
- Sudah ada di aplikasi: tombol "Buka WhatsApp & Kirim" per pelanggan.
- Tidak ada yang otomatis — admin klik satu-satu.

Setelah gateway dipilih:
- [ ] Buka script.google.com → proyek baru → tempel `cronjob/google-apps-script-wa.js`
      (atau versi WAHA di `cronjob/google-apps-script-wa-waha.js`)
- [ ] Isi `FIREBASE_PROJECT_ID`, `GITHUB_PAGES_URL`, `WA_API_URL`, `WA_API_TOKEN`
- [ ] Triggers → Add Trigger → `kirimPengingatTagihanOtomatis` → Time-driven → Day timer 08:00–09:00
- [ ] Uji manual: Run sekali, cek Execution log + HP pelanggan tes.

## 4. Verifikasi akhir
- [ ] Buka URL GitHub Pages di HP — dashboard tampil, tambah 1 pelanggan tes
- [ ] Buka `?inv=<kode invoice>` — halaman tagihan + QRIS tampil
- [ ] Tandai lunas → statistik berubah
- [ ] Cronjob jalan 1x tanpa error di log Apps Script
