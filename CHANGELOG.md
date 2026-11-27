# Changelog

## v6
### Keamanan
- `firestore.rules`: `customers`, `ledger`, dan `app_meta` sekarang hanya bisa diakses akun admin. Sebelumnya terbuka untuk siapa pun.
- Halaman tagihan publik tidak lagi membaca koleksi `customers`. Ia membaca `invoices/{token}` (tanpa nomor HP, tidak bisa di-list) dan `public_meta/settings`.
- Cache offline Firestore dihapus saat logout (berguna di HP yang dipakai bersama).
- Cronjob: URL WAHA diganti ke https. Email admin dihapus dari komentar. Scope `userinfo.email` ditambahkan agar aturan admin berfungsi untuk cronjob.

### Perbaikan
- Penulisan data memakai batch (atomik). Pembayaran, pelanggan, dan salinan tagihan tidak lagi bisa tertulis setengah-setengah.
- Pembatalan pembayaran menandai catatan sebagai "Dibatalkan" (tidak dihapus). Total kas tidak menghitungnya.
- Hapus pelanggan dan pulihkan cadangan ikut membersihkan/menulis salinan tagihan publik.
- Cronjob WAHA versi lama (field `status`/`invoiceCode`) dihapus. Hanya satu cronjob: `google-apps-script-wa.js`.
- Dokumentasi (README, checklist) disesuaikan dengan kode.

### Fitur dan UI
- Tagih massal: tombol di Beranda membuka daftar pelanggan yang belum bayar, dengan satu tombol kirim per pelanggan.
- Cara bayar (Tunai, Transfer, QRIS, Lainnya) dicatat di setiap pembayaran dan ikut di ekspor CSV.
- Daftar pelanggan menampilkan "✓ pengingat terkirim" untuk tagihan yang sudah diingatkan.
- Impor pelanggan dari CSV (pemisah koma atau titik koma).
- Perbaikan aksesibilitas kecil (label pencarian dan urutan).

### Migrasi
- Saat pertama dibuka, app v6 membuat salinan tagihan publik untuk semua pelanggan (sekali). Lihat checklist.
