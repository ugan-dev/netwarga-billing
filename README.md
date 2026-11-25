# NetWarga Billing (v5)

Aplikasi tagihan WiFi RT/RW Net: pelanggan, pembayaran, buku kas, dan pengingat WhatsApp.
Front-end satu file (`index.html`) di GitHub Pages, data di Firebase Firestore.

## Isi folder
- `index.html` — aplikasi admin + halaman tagihan pelanggan (`?inv=TOKEN`).
- `firestore.rules` — aturan keamanan. Wajib dipublikasikan.
- `cronjob/google-apps-script-wa.js` — pengingat WA otomatis (WAHA atau Fonnte).
- `cronjob/appsscript.json` — manifest Apps Script (zona waktu dan izin akses).
- `sw.js`, `manifest.json`, `icons/` — PWA.
- `DEPLOY-CHECKLIST.md` — langkah pasang dari nol.

## Cara kerja tagihan (ringkas)
- Setiap pelanggan menyimpan `lastPaidCycle` (bulan terakhir yang sudah dibayar).
- Tagihan terbuka mulai H-(pengingat) sebelum jatuh tempo. Semua bulan yang belum dibayar ikut tertagih, jadi tunggakan tidak hilang.
- Status (Lunas, Belum bayar, Terlambat, Wajib putus, Nonaktif) dihitung dari data, bukan disimpan manual.
- Pengingat otomatis punya 3 tahap: H-N, hari H, dan sehari sebelum layanan dinonaktifkan. Tiap tahap hanya dikirim sekali.
- Logika tagihan di app dan di cronjob identik (blok `LOGIC` di kedua file).

## Keamanan
- Data pelanggan hanya bisa dibaca dan ditulis oleh akun admin (lewat Firebase Auth Google + aturan Firestore).
- Halaman tagihan pelanggan membaca dokumen `invoices/{token}` dengan token acak. Dokumen ini tidak bisa di-list.
- Jangan pernah menaruh data sensitif di koleksi `app_meta` atau `invoices`. Keduanya bisa dibaca publik.
