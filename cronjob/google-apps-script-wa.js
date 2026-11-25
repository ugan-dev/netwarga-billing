/**
 * CRONJOB OTOMATIS PENGINGAT TAGIHAN WHATSAPP ANTI-GANDA (GOOGLE APPS SCRIPT)
 */

const CONFIG = {
  FIREBASE_PROJECT_ID: "GANTI_DENGAN_PROJECT_ID_FIREBASE",
  GITHUB_PAGES_URL: "https://GANTI_USERNAME.github.io/netwarga-billing/",
  WA_GATEWAY_TYPE: "WAHA", // Pilihan: "WAHA" atau "FONNTE"
  WA_API_URL: "https://GANTI_ENDPOINT_WA_ANDA/api/sendText",
  WA_API_TOKEN: "GANTI_TOKEN_API_ANDA",
  NAMA_WIFI: "NetWarga RT/RW Net"
};

function kirimPengingatTagihanOtomatis() {
  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${CONFIG.FIREBASE_PROJECT_ID}/databases/(default)/documents/customers`;
  const response = UrlFetchApp.fetch(firestoreUrl, { muteHttpExceptions: true });
  const json = JSON.parse(response.getContentText());

  if (!json.documents || json.documents.length === 0) return;

  const today = new Date();
  const currentDay = today.getDate();
  const currentCycle = Utilities.formatDate(today, "Asia/Jakarta", "yyyy-MM");
  const todayStr = Utilities.formatDate(today, "Asia/Jakarta", "yyyy-MM-dd");

  json.documents.forEach((doc) => {
    const f = doc.fields || {};
    const status = f.status ? f.status.stringValue : "";
    const waSentCycle = f.waSentCycle ? f.waSentCycle.stringValue : "";
    const dueDay = parseInt((f.dueDay && (f.dueDay.integerValue || f.dueDay.stringValue)) || "20", 10);
    const name = f.name ? f.name.stringValue : "Pelanggan";
    const rawPhone = f.phone ? f.phone.stringValue : "";
    const phone = rawPhone.replace(/\D/g, "");
    const amount = parseInt((f.amount && (f.amount.integerValue || f.amount.stringValue)) || "0", 10);
    const invCode = f.invoiceCode ? f.invoiceCode.stringValue : "";

    if (status === "lunas" || waSentCycle === currentCycle) return;

    const isDueToday = dueDay === currentDay;
    const isHMinus2 = ((dueDay - 2 + 28) % 28 || 28) === currentDay;

    if (phone && (isDueToday || isHMinus2)) {
      const targetPhone = phone.startsWith("0") ? "62" + phone.slice(1) : phone;
      const linkTagihan = `${CONFIG.GITHUB_PAGES_URL}?inv=${encodeURIComponent(invCode)}`;
      const keteranganTempo = isDueToday ? "jatuh tempo HARI INI" : "jatuh tempo 2 hari lagi";

      const pesan =
        `Halo Kak *${name}*,\n\n` +
        `Mengingatkan tagihan WiFi *${CONFIG.NAMA_WIFI}* sebesar *Rp${amount.toLocaleString("id-ID")}* (${keteranganTempo}).\n\n` +
        `Klik link berikut untuk rincian tagihan, salin rekening, atau scan QRIS:\n` +
        `${linkTagihan}\n\n` +
        `Terima kasih 🙏`;

      const ok = kirimKeGateway(targetPhone, pesan);
      if (ok) markSentInFirestore(doc.name, currentCycle, todayStr, "cronjob");

      const delayMs = (6 + Math.floor(Math.random() * 9)) * 1000;
      Utilities.sleep(delayMs);
    }
  });
}

function markSentInFirestore(fullDocName, cycle, dateStr, method) {
  const patchUrl =
    `https://firestore.googleapis.com/v1/${fullDocName}` +
    `?updateMask.fieldPaths=waSentCycle&updateMask.fieldPaths=lastWaMethod&updateMask.fieldPaths=lastWaSentAt`;

  const body = {
    fields: {
      waSentCycle: { stringValue: cycle },
      lastWaMethod: { stringValue: method },
      lastWaSentAt: { stringValue: dateStr }
    }
  };

  UrlFetchApp.fetch(patchUrl, {
    method: "patch",
    contentType: "application/json",
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
}

function kirimKeGateway(phone, text) {
  let payload = {};
  let headers = {};

  if (CONFIG.WA_GATEWAY_TYPE === "FONNTE") {
    headers = { Authorization: CONFIG.WA_API_TOKEN };
    payload = { target: phone, message: text };
  } else {
    headers = {
      "Content-Type": "application/json",
      "X-Api-Key": CONFIG.WA_API_TOKEN,
      Authorization: `Bearer ${CONFIG.WA_API_TOKEN}`
    };
    payload = { session: "default", chatId: `${phone}@c.us`, text: text };
  }

  const res = UrlFetchApp.fetch(CONFIG.WA_API_URL, {
    method: "post",
    contentType: "application/json",
    headers: headers,
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  return res.getResponseCode() >= 200 && res.getResponseCode() < 300;
}
