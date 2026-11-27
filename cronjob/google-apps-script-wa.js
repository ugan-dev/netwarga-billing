/**
 * NetWarga — Pengingat tagihan WhatsApp otomatis (Google Apps Script).
 *
 * Cara pasang (ringkas, detail di DEPLOY-CHECKLIST.md):
 *  1. script.google.com → Proyek baru → tempel file ini.
 *  2. Ganti isi CONFIG di bawah.
 *  3. Project Settings → centang "Show appsscript.json" → isi sesuai appsscript.json di folder ini.
 *  4. Jalankan sekali fungsi pasangTrigger() (akan minta izin akses) lalu cek log dengan
 *     kirimPengingatTagihanOtomatis(true) = mode uji coba tanpa kirim pesan.
 *
 * Akun yang menjalankan script HARUS akun admin (email yang sama dengan ADMIN_EMAIL di index.html
 * dan isAdmin() di firestore.rules), karena Firestore hanya mengizinkan admin membaca data pelanggan.
 * Setelah mengganti manifest, jalankan pasangTrigger() lagi lalu setujui izin email yang baru.
 */
const CONFIG = {
  FIREBASE_PROJECT_ID: "netwarga-manager",
  APP_URL: "https://ugan-dev.github.io/netwarga-billing/",
  WA_GATEWAY: "WAHA",                // "WAHA" atau "FONNTE"
  WA_API_URL: "http://sg-sgp11.tryaltare.ai:27191/api/sendText", // server WAHA ini hanya HTTP (tanpa TLS), jadi WAJIB http.
  WA_API_KEY: "GANTI_API_KEY_WAHA",   // isi API key WAHA
  WA_SESSION: "default",
  TIMEZONE: "Asia/Jakarta",
  MAX_RUN_MS: 5 * 60 * 1000,         // berhenti sebelum batas 6 menit Apps Script
  JEDA_MIN_DETIK: 6,
  JEDA_MAX_DETIK: 12,
  NAMA_WIFI_CADANGAN: "NetWarga RT/RW Net"
};

/*LOGIC-START*/
// Logika tagihan bersama (app + cronjob pakai blok yang sama persis).
// Semua perhitungan pakai string "YYYY-MM-DD" dan angka hari, jadi tidak
// tergantung timezone perangkat.
const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
const DEFAULT_TPL = "Halo Kak *{nama}*,\n\nMengingatkan tagihan WiFi *{wifi}* ({paket}) untuk periode {periode} sebesar *{tagihan}*. Status: {keterangan}.\n\nSilakan buka link berikut untuk rincian, transfer, atau scan QRIS:\n{link}\n\nTerima kasih 🙏";
const DEFAULT_TPL_LUNAS = "Halo Kak *{nama}*,\n\nTerima kasih! Pembayaran WiFi *{wifi}* sebesar *{tagihan}* sudah kami terima.\n\nLihat rincian pembayaran di sini:\n{link}";

function pad2(n) { return String(n).padStart(2, "0"); }
function dnum(ymdStr) { const p = ymdStr.split("-"); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000; }
function dnumToYmd(n) { const d = new Date(n * 86400000); return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate()); }
function cycAdd(cyc, k) { const p = cyc.split("-"); const t = (+p[0]) * 12 + (+p[1] - 1) + k; return Math.floor(t / 12) + "-" + pad2(t % 12 + 1); }
function cycleOf(ymdStr) { return ymdStr.slice(0, 7); }
function daysInMonth(y, m1) { return new Date(Date.UTC(y, m1, 0)).getUTCDate(); }
// Tanggal jatuh tempo untuk satu siklus (YYYY-MM). Tanggal 31 dipasang ke tanggal terakhir bulan pendek.
function dueYmd(cyc, dueDay) {
  const p = cyc.split("-");
  const d = Math.min(Math.max(1, +dueDay || 20), daysInMonth(+p[0], +p[1]));
  return cyc + "-" + pad2(d);
}
function cycLabel(cyc) { const p = cyc.split("-"); return MONTHS_SHORT[+p[1] - 1] + " " + p[0]; }
function dateLong(ymdStr) { const p = ymdStr.split("-"); return (+p[2]) + " " + MONTHS_ID[+p[1] - 1] + " " + p[0]; }
function fmtRp(n) {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? "-" : "") + "Rp" + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
// Dipakai hanya untuk data lama (sebelum schema v3) yang belum punya lastPaidCycle.
function legacyLast(c, today) {
  const cur = cycleOf(today);
  if (c.billingCycle) return c.status === "lunas" ? c.billingCycle : cycAdd(c.billingCycle, -1);
  return c.status === "lunas" ? cur : cycAdd(cur, -1);
}
// Siklus terakhir yang sudah dibayar ("" = belum pernah bayar).
function effLast(c, today) {
  return (c.lastPaidCycle !== undefined && c.lastPaidCycle !== null) ? c.lastPaidCycle : legacyLast(c, today);
}
// Hitung status tagihan. Semua turunan dari data mentah, jadi tidak
// bergantung pada apakah app sempat dibuka hari itu.
function billing(c, today, cfg) {
  const R = Number(cfg.reminderDays ?? 5), G = Number(cfg.graceDays ?? 10);
  const last = effLast(c, today);
  const out = { active: c.active !== false, last: last, unpaid: [], owed: 0, dueYmd: "", late: 0, status: "lunas", stage: 0 };
  if (!out.active) { out.status = "nonaktif"; return out; }
  const t = dnum(today);
  const start = last ? cycAdd(last, 1) : (c.startCycle || cycleOf(today));
  // Siklus dianggap "tagihan terbuka" mulai H-R sebelum jatuh tempo.
  for (let cyc = start, i = 0; i < 36; cyc = cycAdd(cyc, 1), i++) {
    if (t < dnum(dueYmd(cyc, c.dueDay)) - R) break;
    out.unpaid.push(cyc);
  }
  out.owed = out.unpaid.length * (Number(c.amount) || 0);
  if (!out.unpaid.length) { out.status = c.paidAt ? "lunas" : "belum-tagih"; return out; }
  out.dueYmd = dueYmd(out.unpaid[0], c.dueDay);
  out.late = t - dnum(out.dueYmd);
  out.status = out.late <= 0 ? "belum" : (out.late >= G ? "putus" : "terlambat");
  out.stage = stageOf(out, today, cfg);
  return out;
}
// Tahap pengingat otomatis. 0 = tidak kirim otomatis hari ini.
// 1 = H-R, 2 = hari H, 3 = H+(G-1) sebelum layanan dinonaktifkan.
// Jadwal pengingat: offset hari terhadap jatuh tempo (negatif = sebelum, 0 = hari H, positif = sesudah).
function rawScheduleOf(cfg) {
  let arr = Array.isArray(cfg.reminderSchedule) ? cfg.reminderSchedule : null;
  if (!arr) arr = [-Number(cfg.reminderDays ?? 5), 0, Number(cfg.graceDays ?? 10) - 1];
  const out = [];
  arr.forEach(v => { const n = Number(v); if (Number.isInteger(n) && n >= -60 && n <= 60 && out.indexOf(n) < 0) out.push(n); });
  return out.sort((a, b) => a - b);
}
// Jadwal yang benar-benar aktif (kosong kalau pengingat otomatis dimatikan).
function scheduleOf(cfg) {
  return cfg.reminderAuto === false ? [] : rawScheduleOf(cfg);
}
// Berapa hari sebelum jatuh tempo tagihan mulai terbuka, supaya pengingat paling awal tetap di dalam periode tagihan.
function leadOf(cfg) {
  const neg = rawScheduleOf(cfg).filter(n => n < 0);
  return neg.length ? -neg[0] : 0;
}
// Offset jadwal yang jatuh pada hari ini untuk tagihan yang belum lunas. null kalau tidak ada.
function stageOf(b, today, cfg) {
  if (!b.unpaid || !b.unpaid.length) return null;
  const d = dnum(today) - dnum(b.dueYmd);
  return scheduleOf(cfg).indexOf(d) >= 0 ? d : null;
}
// Tahap untuk pesan manual (kapan saja): sebelum hari H = 1, sesudahnya = 2.
function manualStage(b, today) {
  if (!b.unpaid || !b.unpaid.length) return 0;
  return dnum(today) < dnum(b.dueYmd) ? 1 : 2;
}
function keterangan(b, today, stage) {
  const t = dnum(today), due = dnum(b.dueYmd);
  let s;
  if (t < due) s = "jatuh tempo " + (due - t) + " hari lagi (" + dateLong(b.dueYmd) + ")";
  else if (t === due) s = "jatuh tempo HARI INI";
  else s = "telat bayar " + (t - due) + " hari (jatuh tempo " + dateLong(b.dueYmd) + ")";
  if (stage === 3) s += "; layanan akan dinonaktifkan besok jika belum dibayar";
  return s;
}
// Siklus yang akan tercakup kalau pelanggan bayar n bulan sekarang.
function payCycles(c, today, n) {
  const last = effLast(c, today);
  const start = last ? cycAdd(last, 1) : (c.startCycle || cycleOf(today));
  const arr = [];
  for (let i = 0; i < n; i++) arr.push(cycAdd(start, i));
  return arr;
}
function buildMessage(c, b, cfg, today, link, stage) {
  const vals = {
    nama: c.name || "",
    wifi: cfg.bizName || "",
    paket: c.plan || "",
    tagihan: fmtRp(b.owed),
    tempo: b.dueYmd ? dateLong(b.dueYmd) : "",
    periode: b.unpaid.map(cycLabel).join(", "),
    bulan: b.unpaid.length + " bulan",
    keterangan: keterangan(b, today, stage),
    telat: b.dueYmd ? Math.max(0, dnum(today) - dnum(b.dueYmd)) : 0,
    link: link
  };
  const tpl = (cfg.waTemplate && String(cfg.waTemplate).trim()) ? cfg.waTemplate : DEFAULT_TPL;
  let out = tpl;
  Object.keys(vals).forEach(k => { out = out.split("{" + k + "}").join(vals[k]); });
  return out;
}
function receiptMessage(c, cfg, link, owedAmount) {
  let out = DEFAULT_TPL_LUNAS;
  const vals = { nama: c.name || "", wifi: cfg.bizName || "", tagihan: fmtRp(owedAmount || c.amount), link: link };
  Object.keys(vals).forEach(k => { out = out.split("{" + k + "}").join(vals[k]); });
  return out;
}
/*LOGIC-END*/

// ---------------------------------------------------------------
// Akses Firestore (REST) memakai OAuth akun pemilik script (admin).
// ---------------------------------------------------------------
function fsUrl(path) {
  return "https://firestore.googleapis.com/v1/projects/" + CONFIG.FIREBASE_PROJECT_ID + "/databases/(default)/documents/" + path;
}
function fsHeaders() {
  return { Authorization: "Bearer " + ScriptApp.getOAuthToken() };
}
function nilaiFs(v) {
  if (v === null || v === undefined) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(nilaiFs);
  if ("mapValue" in v) {
    const o = {}, f = v.mapValue.fields || {};
    Object.keys(f).forEach(k => { o[k] = nilaiFs(f[k]); });
    return o;
  }
  return null;
}
function dokumenKeObjek(doc) {
  const o = {}, f = doc.fields || {};
  Object.keys(f).forEach(k => { o[k] = nilaiFs(f[k]); });
  o.id = doc.name.split("/").pop();
  return o;
}
// Ambil SEMUA dokumen dalam satu koleksi (mengikuti nextPageToken).
function fsListAll(koleksi) {
  let out = [], token = "";
  do {
    const url = fsUrl(koleksi) + "?pageSize=300" + (token ? "&pageToken=" + encodeURIComponent(token) : "");
    const r = UrlFetchApp.fetch(url, { headers: fsHeaders(), muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) throw new Error("Gagal baca " + koleksi + ": " + r.getContentText());
    const j = JSON.parse(r.getContentText());
    out = out.concat(j.documents || []);
    token = j.nextPageToken || "";
  } while (token);
  return out;
}
function bacaPengaturan() {
  const cfg = { reminderDays: 5, graceDays: 10, reminderTime: "08:00", bizName: CONFIG.NAMA_WIFI_CADANGAN, waTemplate: DEFAULT_TPL };
  const r = UrlFetchApp.fetch(fsUrl("app_meta/settings"), { headers: fsHeaders(), muteHttpExceptions: true });
  if (r.getResponseCode() === 200) {
    const s = dokumenKeObjek(JSON.parse(r.getContentText()));
    Object.keys(s).forEach(k => { if (s[k] !== null && s[k] !== "" && s[k] !== undefined) cfg[k] = s[k]; });
  }
  cfg.reminderDays = Number(cfg.reminderDays ?? 5);
  cfg.graceDays = Number(cfg.graceDays ?? 10);
  cfg.reminderTime = String(cfg.reminderTime || "08:00");
  return cfg;
}
function tandaiTerkirim(docId, cycle, offset, prevOffsets, today) {
  const list = (prevOffsets || []).concat([offset]).filter((v, i, arr) => arr.indexOf(v) === i);
  const mask = "updateMask.fieldPaths=waCycle&updateMask.fieldPaths=waSentOffsets&updateMask.fieldPaths=waAt";
  const body = { fields: {
    waCycle: { stringValue: cycle },
    waSentOffsets: { arrayValue: { values: list.map(v => ({ integerValue: String(v) })) } },
    waAt: { stringValue: today }
  } };
  UrlFetchApp.fetch(fsUrl("customers/" + docId) + "?" + mask, {
    method: "patch", contentType: "application/json",
    headers: fsHeaders(), payload: JSON.stringify(body), muteHttpExceptions: true
  });
}

// ---------------------------------------------------------------
// WhatsApp
// ---------------------------------------------------------------
function normalisasiNomor(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.indexOf("0") === 0) d = "62" + d.slice(1);
  return /^62\d{8,13}$/.test(d) ? d : "";
}
function kirimWa(nomor, teks) {
  let headers, payload;
  if (CONFIG.WA_GATEWAY === "FONNTE") {
    headers = { Authorization: CONFIG.WA_API_KEY };
    payload = { target: nomor, message: teks };
  } else {
    headers = { "X-Api-Key": CONFIG.WA_API_KEY, Authorization: "Bearer " + CONFIG.WA_API_KEY };
    payload = { session: CONFIG.WA_SESSION, chatId: nomor + "@c.us", text: teks };
  }
  const r = UrlFetchApp.fetch(CONFIG.WA_API_URL, {
    method: "post", contentType: "application/json",
    headers: headers, payload: JSON.stringify(payload), muteHttpExceptions: true
  });
  const code = r.getResponseCode();
  if (code < 200 || code >= 300) Logger.log("HTTP " + code + ": " + r.getContentText());
  return code >= 200 && code < 300;
}

// ---------------------------------------------------------------
// Fungsi utama — dipasang trigger harian.
// ---------------------------------------------------------------
function kirimPengingatTagihanOtomatis(dryRun) {
  const mulai = Date.now();
  const today = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd");
  const cfg = bacaPengaturan();
  sesuaikanTrigger(cfg);
  cfg.reminderDays = leadOf(cfg);
  if (!scheduleOf(cfg).length) {
    Logger.log("Pengingat otomatis nonaktif atau jadwal kosong. Tidak ada pesan dikirim.");
    return;
  }
  const docs = fsListAll("customers");
  let terkirim = 0, gagal = 0, lewati = 0, sisa = 0;

  for (let i = 0; i < docs.length; i++) {
    if (Date.now() - mulai > CONFIG.MAX_RUN_MS) { sisa = docs.length - i; break; }
    const c = dokumenKeObjek(docs[i]);
    if (!c.publicToken) { lewati++; continue; }
    const b = billing(c, today, cfg);
    const off = stageOf(b, today, cfg);          // offset jadwal hari ini, atau null
    if (off === null) continue;
    // Anti-ganda per titik: titik yang sama untuk siklus yang sama tidak dikirim dua kali.
    const sudahTitikIni = c.waCycle === b.unpaid[0] && (c.waSentOffsets || []).indexOf(off) >= 0;
    if (sudahTitikIni) continue;
    const nomor = normalisasiNomor(c.phone);
    if (!nomor) { Logger.log("Nomor tidak valid, dilewati: " + c.name); lewati++; continue; }

    const link = CONFIG.APP_URL + "?inv=" + encodeURIComponent(c.publicToken);
    const adaPeringatanPutus = cfg.graceDays >= 2 && off === cfg.graceDays - 1;
    const pesan = buildMessage(c, b, cfg, today, link, adaPeringatanPutus ? 3 : 0);
    if (dryRun) {
      Logger.log("[UJI] " + c.name + " (" + nomor + ") titik " + off + ":\n" + pesan);
      continue;
    }
    const prev = c.waCycle === b.unpaid[0] ? (c.waSentOffsets || []) : [];
    if (kirimWa(nomor, pesan)) {
      tandaiTerkirim(c.id, b.unpaid[0], off, prev, today);
      terkirim++;
    } else {
      gagal++;
      Logger.log("Gagal kirim ke " + c.name + " (" + nomor + ")");
    }
    Utilities.sleep((CONFIG.JEDA_MIN_DETIK + Math.floor(Math.random() * (CONFIG.JEDA_MAX_DETIK - CONFIG.JEDA_MIN_DETIK + 1))) * 1000);
  }
  Logger.log("Selesai " + today + ": terkirim " + terkirim + ", gagal " + gagal + ", dilewati " + lewati +
    (sisa ? ", belum diproses " + sisa + " (dilanjut besok)" : "") + (dryRun ? " [mode uji]" : ""));
}

// Jam kirim dari pengaturan (format "HH:MM", bawaan 08:00).
function jamDariPengaturan(cfg) {
  const m = String(cfg.reminderTime || "08:00").match(/^(\d{1,2}):(\d{2})/);
  const jam = m ? Math.min(23, Math.max(0, Number(m[1]) || 8)) : 8;
  const menit = m ? Math.min(59, Math.max(0, Number(m[2]) || 0)) : 0;
  return { jam: jam, menit: menit };
}
function jamLabel(t) { return t.jam + ":" + (t.menit < 10 ? "0" : "") + t.menit; }
function buatTriggerJam(t) {
  return ScriptApp.newTrigger("kirimPengingatTagihanOtomatis").timeBased().everyDays(1).atHour(t.jam).nearMinute(t.menit).create();
}
// Samakan trigger harian dengan jam di pengaturan. Dipanggil di awal setiap jalan
// dan berkala oleh cekJamTrigger() supaya perubahan jam di aplikasi berlaku
// dalam hitungan menit (hari ini juga kalau jamnya belum lewat).
function sesuaikanTrigger(cfg) {
  try {
    const t = jamDariPengaturan(cfg);
    const kunci = jamLabel(t);
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty("jamTrigger") === kunci) return;
    const baru = buatTriggerJam(t);
    ScriptApp.getProjectTriggers().forEach(tr => {
      if (tr.getHandlerFunction() === "kirimPengingatTagihanOtomatis" && tr.getUniqueId() !== baru.getUniqueId()) ScriptApp.deleteTrigger(tr);
    });
    props.setProperty("jamTrigger", kunci);
    Logger.log("Trigger harian diubah ke jam " + kunci + " (" + CONFIG.TIMEZONE + ").");
  } catch (e) {
    Logger.log("Sesuaikan trigger gagal: " + e);
  }
}
// Pengecek berkala (tiap 15 menit): kalau jam di pengaturan berubah, pindahkan
// trigger harian segera supaya perubahan jam berlaku hari ini juga.
function cekJamTrigger() {
  try {
    sesuaikanTrigger(bacaPengaturan());
  } catch (e) {
    Logger.log("Cek jam trigger gagal: " + e);
  }
}
function pasangTrigger() {
  const cfg = bacaPengaturan();
  const t = jamDariPengaturan(cfg);
  ScriptApp.getProjectTriggers().forEach(tr => {
    if (tr.getHandlerFunction() === "kirimPengingatTagihanOtomatis") ScriptApp.deleteTrigger(tr);
  });
  buatTriggerJam(t);
  PropertiesService.getScriptProperties().setProperty("jamTrigger", jamLabel(t));
  Logger.log("Trigger harian dipasang jam " + jamLabel(t) + " (" + CONFIG.TIMEZONE + ").");
  // Pasang pengecek berkala supaya perubahan jam berlaku dalam hitungan menit.
  const adaPengecek = ScriptApp.getProjectTriggers().some(tr => tr.getHandlerFunction() === "cekJamTrigger");
  if (!adaPengecek) {
    ScriptApp.newTrigger("cekJamTrigger").timeBased().everyMinutes(15).create();
    Logger.log("Pengecek jam dipasang tiap 15 menit.");
  }
}
