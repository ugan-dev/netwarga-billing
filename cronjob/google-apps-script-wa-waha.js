/**
 * CRONJOB WA — varian WAHA only (self-host, Rp 0 untuk gateway-nya).
 * Sama seperti google-apps-script-wa.js di ZIP, tapi sudah diisi
 * WA_GATEWAY_TYPE = "WAHA" dan tanpa cabang Fonnte.
 * Tetap butuh: server WAHA yang nyala 24/7 + scan QR sekali di awal.
 * Isi CONFIG di bawah, lalu pasang Trigger harian 08:00-09:00.
 * Catatan: baca Firestore di bawah tanpa Auth — hanya jalan kalau
 * Firestore rules mengizinkan read publik untuk koleksi customers
 * (lihat firestore.rules). Kalau rules dikunci, script ini gagal baca.
 */
const CONFIG = {
  FIREBASE_PROJECT_ID: "GANTI_DENGAN_PROJECT_ID_FIREBASE",
  GITHUB_PAGES_URL: "https://GANTI_USERNAME.github.io/netwarga-billing/",
  WA_API_URL: "https://GANTI_DOMAIN_WAHA_ANDA/api/sendText",
  WA_API_TOKEN: "GANTI_API_KEY_WAHA_ANDA",
  NAMA_WIFI: "NetWarga RT/RW Net"
};

function kirimPengingatTagihanOtomatis() {
  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${CONFIG.FIREBASE_PROJECT_ID}/databases/(default)/documents/customers`;
  const response = UrlFetchApp.fetch(firestoreUrl, { muteHttpExceptions: true });
  const json = JSON.parse(response.getContentText());
  if (!json.documents || json.documents.length === 0) {
    Logger.log("Tidak ada data pelanggan di Firestore.");
    return;
  }
  const today = new Date();
  const currentDay = today.getDate();
  json.documents.forEach((doc) => {
    const f = doc.fields || {};
    const status = f.status ? f.status.stringValue : "";
    const dueDay = parseInt((f.dueDay && (f.dueDay.integerValue || f.dueDay.stringValue)) || "10", 10);
    const name = f.name ? f.name.stringValue : "Pelanggan";
    const rawPhone = f.phone ? f.phone.stringValue : "";
    const phone = rawPhone.replace(/\D/g, "");
    const amount = parseInt((f.amount && (f.amount.integerValue || f.amount.stringValue)) || "0", 10);
    const invCode = f.invoiceCode ? f.invoiceCode.stringValue : "";
    const isDueToday = dueDay === currentDay;
    const isHMinus2 = ((dueDay - 2 + 28) % 28 || 28) === currentDay;
    if (status !== "lunas" && phone && (isDueToday || isHMinus2)) {
      const targetPhone = phone.startsWith("0") ? "62" + phone.slice(1) : phone;
      const linkTagihan = `${CONFIG.GITHUB_PAGES_URL}?inv=${encodeURIComponent(invCode)}`;
      const keteranganTempo = isDueToday ? "jatuh tempo HARI INI" : "jatuh tempo 2 hari lagi";
      const pesan =
        `Halo Kak *${name}*,\n\n` +
        `Mengingatkan tagihan WiFi *${CONFIG.NAMA_WIFI}* sebesar *Rp${amount.toLocaleString("id-ID")}* (${keteranganTempo}).\n\n` +
        `Klik link berikut untuk rincian tagihan, transfer bank, atau scan QRIS:\n` +
        `${linkTagihan}\n\n` +
        `Terima kasih 🙏`;
      UrlFetchApp.fetch(CONFIG.WA_API_URL, {
        method: "post",
        contentType: "application/json",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": CONFIG.WA_API_TOKEN,
          Authorization: `Bearer ${CONFIG.WA_API_TOKEN}`
        },
        payload: JSON.stringify({ session: "default", chatId: `${targetPhone}@c.us`, text: pesan }),
        muteHttpExceptions: true
      });
      Logger.log(`Terkirim ke ${name} (${targetPhone})`);
      Utilities.sleep((6 + Math.floor(Math.random() * 9)) * 1000);
    }
  });
}
