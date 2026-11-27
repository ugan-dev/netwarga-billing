# NetWarga Billing (v6)

Aplikasi tagihan WiFi RT/RW Net: pelanggan, pembayaran, buku kas, dan pengingat WhatsApp.
Front-end satu file (`index.html`) di GitHub Pages, data di Firebase Firestore.

## Isi folder
- `index.html`: aplikasi admin + halaman tagihan pelanggan (`?inv=TOKEN`).
- `firestore.rules`: aturan keamanan. Wajib dipublikasikan (lihat checklist, urutannya penting).
- `cronjob/google-apps-script-wa.js`: pengingat WA otomatis (WAHA atau Fonnte).
- `cronjob/appsscript.json`: manifest Apps Script (zona waktu dan izin akses).
- `sw.js`, `manifest.json`, `icons/`: PWA.
- `DEPLOY-CHECKLIST.md`: langkah pasang dari nol dan langkah upgrade dari v5.
- `CHANGELOG.md`: daftar perubahan per versi.

## Struktur data
- `customers/{id}`: data pelanggan lengkap (termasuk nomor HP). Hanya admin.
- `ledger/{id}`: buku kas (pemasukan, pengeluaran). Hanya admin.
- `app_meta/settings`: pengaturan internal (template WA, jadwal pengingat, dll). Hanya admin.
- `invoices/{token}`: salinan tagihan untuk halaman publik. Tanpa nomor HP. Bisa di-get, tidak bisa di-list.
- `public_meta/settings`: bank, QRIS, nama usaha, dan aturan tenggang untuk halaman publik. Bisa di-get, tidak bisa di-list.

Salinan `invoices` dan `public_meta` dibuat dan diperbarui otomatis oleh app admin setiap ada perubahan.

## Cara kerja tagihan (ringkas)
- Setiap pelanggan menyimpan `lastPaidCycle` (bulan terakhir yang sudah dibayar).
- Tagihan terbuka mulai H-(pengingat) sebelum jatuh tempo. Semua bulan yang belum dibayar ikut tertagih, jadi tunggakan tidak hilang.
- Status (Lunas, Belum bayar, Terlambat, Wajib putus, Nonaktif) dihitung dari data, bukan disimpan manual.
- Pengingat otomatis punya 3 tahap: H-N, hari H, dan sehari sebelum layanan dinonaktifkan. Tiap tahap hanya dikirim sekali.
- Logika tagihan di app dan di cronjob identik (blok `LOGIC` di kedua file). Jangan diubah di salah satu saja.
- Pembatalan pembayaran tidak menghapus catatan kas. Catatan ditandai "Dibatalkan" dan tidak dihitung dalam total.

## Keamanan
- Data internal (`customers`, `ledger`, `app_meta`) hanya bisa dibaca dan ditulis oleh akun admin. Aturan ini ditegakkan di server (`firestore.rules`), bukan hanya di browser.
- Halaman tagihan pelanggan membaca `invoices/{token}` dengan token acak. Dokumen tidak bisa di-list, jadi token lain tidak bisa ditemukan dengan menelusuri data.
- Config Firebase di `index.html` memang publik (normal untuk Firebase). Keamanan bergantung pada aturan Firestore, bukan pada kerahasiaan config.
- Cache offline di perangkat dihapus saat logout.
- Batasi API key di Google Cloud Console ke domain GitHub Pages (lihat checklist).
- Jangan menaruh data sensitif di `invoices` atau `public_meta`. Keduanya bisa dibaca siapa pun yang punya tokennya.
- Aturan Firestore memeriksa email akun (tidak memeriksa `email_verified`). Ini aman untuk akun Google `@gmail.com`. Kalau ganti ke domain lain, pastikan akun itu terverifikasi.
