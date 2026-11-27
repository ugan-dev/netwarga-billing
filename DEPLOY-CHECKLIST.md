# NetWarga Billing: Checklist Pasang (v6)

Ada dua jalur: **pasang dari nol** (bagian A) dan **upgrade dari v5** (bagian B).
Di jalur upgrade, **aturan Firestore dipublikasikan paling terakhir**. Kalau urutannya dibalik, app v5 dan link tagihan lama langsung berhenti bekerja.

## A. Pasang dari nol

### A1. Firebase
- [ ] Console Firebase → project `netwarga-manager` (atau project baru).
- [ ] Authentication → Sign-in method → aktifkan **Google**. Tambahkan domain GitHub Pages di *Authorized domains*.
- [ ] Firestore Database sudah dibuat (mode production, lokasi `asia-southeast1`).
- [ ] Firestore → Rules → tempel isi `firestore.rules` → **Publish**.
- [ ] Google Cloud Console → API Keys → batasi API key hanya untuk domain GitHub Pages.

### A2. GitHub Pages
- [ ] Upload semua isi folder ini ke repo (`index.html`, `sw.js`, `manifest.json`, `icons/`, `.nojekyll`, `firestore.rules`, `cronjob/`, `README.md`, `CHANGELOG.md`).
- [ ] Settings → Pages → branch `main`, folder `/ (root)`.
- [ ] Buka URL-nya di HP, login dengan akun admin. Halaman harus langsung masuk ke Beranda.

### A3. Pengingat WhatsApp (opsional)
Pilih satu gateway:
- **WAHA** (self-host): jalankan `docker run -p 3000:3000 devlikeapro/waha`, scan QR sekali, lalu isi `WA_API_URL` (harus `https`) dan `WA_API_KEY`. Risiko: WhatsApp bisa memblokir nomor yang kirim pesan otomatis terlalu banyak.
- **Fonnte** (berbayar): isi `WA_GATEWAY: "FONNTE"`, `WA_API_URL: "https://api.fonnte.com/send"`, dan token di `WA_API_KEY`.

Langkah Apps Script:
- [ ] script.google.com → Proyek baru. Login dengan **akun admin**.
- [ ] Tempel `cronjob/google-apps-script-wa.js`. Isi `CONFIG`: `APP_URL` (URL GitHub Pages), gateway, dan API key.
- [ ] Project Settings → centang *Show "appsscript.json" manifest* → isi dengan `cronjob/appsscript.json`.
- [ ] Jalankan `pasangTrigger()` sekali dan setujui izin akses.
- [ ] Jalankan `kirimPengingatTagihanOtomatis(true)` untuk uji coba. Cek Execution log, pastikan pesan sudah benar dan tidak ada pesan terkirim.
- [ ] Jalankan `kirimPengingatTagihanOtomatis()` (tanpa argumen) untuk kirim sungguhan sekali, lalu cek hasil di log.

## B. Upgrade dari v5

1. [ ] **Cadangan dulu.** Di app v5: Lainnya → Cadangan JSON. Simpan filenya.
2. [ ] **Upload file v6** ke GitHub (`index.html`, `sw.js`, `manifest.json`, `CHANGELOG.md`, `README.md`, `cronjob/`). Hapus `cronjob/google-apps-script-wa-waha.js` dari repo kalau masih ada. Aturan Firestore **belum** diganti di tahap ini.
3. [ ] **Buka app v6** sebagai admin. Tunggu sampai migrasi selesai: di Firebase Console → Firestore, dokumen `app_meta/settings` harus punya `schemaVersion: 4`, dan koleksi `invoices` serta `public_meta` sudah terisi.
4. [ ] Tes link tagihan lama: buka satu link `?inv=...` dari app di mode incognito, pastikan tampil lengkap dengan QRIS dan riwayat.
5. [ ] **Publish `firestore.rules` yang baru.** Ini langkah terakhir upgrade.
6. [ ] **Verifikasi aturan** (lihat bagian C).
7. [ ] Apps Script: buka proyek pengingat, jalankan `pasangTrigger()` lagi, dan setujui izin email yang baru (scope `userinfo.email` ditambahkan di v6). Tanpa ini, cronjob gagal membaca Firestore.
8. [ ] Jalankan `kirimPengingatTagihanOtomatis(true)` untuk uji coba.

Catatan: link tagihan lama dari v5 (`?inv=INV-...`) tidak berlaku. Setiap pelanggan punya token yang sama dengan v5 (token diambil dari data pelanggan), jadi link `?inv=TOKEN` yang sudah dikirim tetap berfungsi. Hanya link format lama `INV-...` yang perlu dikirim ulang lewat tombol "Tagih WA" atau "Salin link".

## C. Verifikasi aturan (wajib setelah publish)

Buka URL berikut di browser **tanpa login** (mode incognito). Hasil yang diharapkan:

| URL (ganti `TOKEN` dengan token pelanggan) | Hasil yang diharapkan |
|---|---|
| `https://firestore.googleapis.com/v1/projects/netwarga-manager/databases/(default)/documents/customers` | **403 / permission denied** |
| `https://firestore.googleapis.com/v1/projects/netwarga-manager/databases/(default)/documents/ledger` | **403 / permission denied** |
| `https://firestore.googleapis.com/v1/projects/netwarga-manager/databases/(default)/documents/invoices` | **403 / permission denied** (tidak bisa di-list) |
| `https://firestore.googleapis.com/v1/projects/netwarga-manager/databases/(default)/documents/invoices/TOKEN` | **200**, berisi data tagihan |
| Link `https://<domain-kamu>/?inv=TOKEN` | Tagihan tampil normal |

Kalau `customers` masih bisa dibuka tanpa login, aturan lama masih aktif. Publish ulang `firestore.rules`.

## D. Verifikasi akhir
- [ ] Tambah 1 pelanggan tes (nomor kamu sendiri). Buka link tagihannya di HP lain atau mode incognito, pastikan tampil.
- [ ] Terima pembayaran tes, lalu batalkan lewat riwayat pelanggan. Pastikan catatan di Kas berstatus "Dibatalkan" dan saldo kas tidak berubah.
- [ ] Logout, lalu login lagi. Pastikan data pelanggan dimuat ulang dari server.
- [ ] Buka app tanpa internet. Data terakhir harus tetap tampil dan perubahan tersinkron saat online lagi.
