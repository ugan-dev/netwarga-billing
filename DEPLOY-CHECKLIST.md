# NetWarga Billing — Checklist Pasang (v5)

Urutan penting: **publikasikan aturan Firestore yang baru sebelum data dipakai.**
Aturan lama mengizinkan siapa pun menulis data.

## 1. Firebase
- [ ] Console Firebase → project `netwarga-manager` (atau project baru).
- [ ] Authentication → Sign-in method → aktifkan **Google**. Tambahkan domain GitHub Pages di *Authorized domains*.
- [ ] Firestore Database sudah dibuat (mode production, lokasi `asia-southeast1`).
- [ ] Firestore → Rules → tempel isi `firestore.rules` → **Publish**.
- [ ] (Disarankan) Google Cloud Console → API Keys → batasi API key hanya untuk domain GitHub Pages.

## 2. GitHub Pages
- [ ] Upload semua isi folder ini ke repo (`index.html`, `sw.js`, `manifest.json`, `icons/`, `.nojekyll`, `firestore.rules`, `cronjob/`, `README.md`).
- [ ] Settings → Pages → branch `main`, folder `/ (root)`.
- [ ] Buka URL-nya di HP, login dengan akun admin. Halaman harus langsung masuk ke Beranda.

## 3. Data lama (kalau sudah ada pelanggan)
- [ ] Pertama kali buka app v5, data otomatis dimigrasikan ke format baru. Ini berjalan sekali.
- [ ] Link tagihan lama (`?inv=INV-...`) **tidak lagi berlaku**. Setiap pelanggan dapat token baru. Kirim ulang link tagihan lewat tombol "Tagih WA" atau "Salin link".
- [ ] Sebelum migrasi, sebaiknya Export cadangan JSON dulu dari menu Lainnya.

## 4. Pengingat WhatsApp (opsional)
Pilih satu gateway:
- **WAHA** (self-host, gratis gateway-nya): jalankan `docker run -p 3000:3000 devlikeapro/waha`, scan QR sekali, lalu isi `WA_API_URL` dan `WA_API_KEY`. Risiko: WhatsApp bisa memblokir nomor yang kirim pesan otomatis terlalu banyak.
- **Fonnte** (berbayar): isi `WA_GATEWAY: "FONNTE"`, `WA_API_URL: "https://api.fonnte.com/send"`, dan token di `WA_API_KEY`.

Langkah Apps Script:
- [ ] script.google.com → Proyek baru. Login dengan **akun admin** (pemilik script harus admin, karena aturan Firestore memakai akun ini).
- [ ] Tempel `cronjob/google-apps-script-wa.js`. Isi `CONFIG`: `APP_URL` (URL GitHub Pages), gateway, dan API key.
- [ ] Project Settings → centang *Show "appsscript.json" manifest* → isi dengan `cronjob/appsscript.json`.
- [ ] Jalankan `pasangTrigger()` sekali dan setujui izin akses.
- [ ] Jalankan `kirimPengingatTagihanOtomatis(true)` untuk uji coba. Cek Execution log, pastikan pesan yang tampil sudah benar dan tidak ada pesan terkirim.
- [ ] Jalankan `kirimPengingatTagihanOtomatis()` (tanpa argumen) untuk kirim sungguhan sekali, lalu cek hasil di log.

## 5. Verifikasi akhir
- [ ] Tambah 1 pelanggan tes (nomor kamu sendiri). Buka link tagihannya di HP lain atau mode incognito, pastikan tampil.
- [ ] Terima pembayaran tes, lalu batalkan lewat riwayat pelanggan. Pastikan saldo kas ikut berubah.
- [ ] Buka app tanpa internet. Data terakhir harus tetap tampil dan perubahan tersinkron saat online lagi.
