// Salin seluruh isi file ini ke editor Apps Script (Extensions → Apps Script),
// lalu Deploy → Manage deployments → Edit → Version: "New version" → Deploy.
// Tanpa deploy versi baru, URL /exec tetap menjalankan kode lama.
//
// Saat deploy sebagai Web App: Execute as "Me", Who has access "Anyone".
// "Anyone" berarti SIAPA PUN yang tahu URL /exec bisa memanggil script ini. URL bukan kata sandi.
// Karena itu mulai versi 6 ada TOKEN AKSES: di spreadsheet buka menu "Secukupnya.fund" → "Buat atau ganti token akses",
// salin token yang muncul, lalu tempel di halaman Sumber data website. Selama token aktif, script menolak semua
// permintaan (baca, tambah, ubah, hapus) yang tidak membawa token yang benar. Tanpa token, perilakunya sama seperti dulu.
// Batas yang jujur: token melindungi dari URL yang bocor atau tertebak, bukan dari orang yang sudah memegang token
// (mis. lewat komputer yang disusupi). Untuk dipakai banyak orang, sebaiknya tiap orang memasang script di spreadsheetnya sendiri.

// Versi 6: token akses opsional (lihat atas), pembacaan lewat POST ("read") supaya token tidak ikut di URL, dan
//          simpan/ambil pengaturan website ("putSettings"/"getSettings") untuk pindah perangkat.
// Versi 5: menambah ubah transaksi ("update").
// Versi 2: menambah impor massal ("addMany") dan membuat sheet otomatis kalau belum ada.
// Versi 3: transaksi baru dimasukkan sesuai tanggal, jadi yang terbaru selalu di baris paling atas
//          (sebelumnya selalu ditulis di baris paling bawah). Ada juga menu "Secukupnya.fund".
//          Cuma menyentuh kolom A-E, jadi tabel lain di sheet yang sama tidak terganggu.
// Versi 4: batas pengeluaran harian disinkronkan dari website ("setLimit"), dan popup peringatan di
//          spreadsheet memakai batas itu (sebelumnya selalu Rp50.000).
var SCRIPT_VERSION = 6;
var TOKEN_KEY = "ACCESS_TOKEN";
var SETTINGS_SHEET = "_secukupnya_settings";
var MAX_SETTINGS_CHARS = 400000;
var SETTINGS_CHUNK = 40000;
var LIMIT_KEY = "dailyLimit";
var DEFAULT_LIMIT = 50000;
var MAX_LIMIT = 1000000000;
var SHEETS = { expense: "Expense", income: "Income" };
var HEADERS = ["Tanggal", "Kategori", "Account", "Deskripsi", "Total (Rp)"];
var MAX_BATCH = 500;

// ==========================================
// 1. READ API (Membaca Data untuk Website)
// ==========================================
function doGet(e) {
  try {
    // Kalau token aktif, GET tidak membocorkan data apa pun; website membaca lewat POST "read" dengan token.
    if (isSecured()) {
      return jsonResponse({ status: "success", version: SCRIPT_VERSION, secured: true, authRequired: true });
    }
    return jsonResponse(readAll());
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

function readAll() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var timezone = tzOf(ss);
  return {
    status: "success",
    version: SCRIPT_VERSION,
    secured: isSecured(),
    dailyLimit: readStoredLimit() || null,
    expenses: readSheet(ss.getSheetByName(SHEETS.expense), "expense", timezone),
    incomes: readSheet(ss.getSheetByName(SHEETS.income), "income", timezone)
  };
}

// ==========================================
// 1b. TOKEN AKSES
// ==========================================
function getToken() {
  return String(PropertiesService.getScriptProperties().getProperty(TOKEN_KEY) || "");
}

function isSecured() {
  return getToken().length >= 16;
}

// Perbandingan yang waktunya tidak bergantung pada posisi huruf pertama yang berbeda.
function safeEqual(a, b) {
  a = String(a == null ? "" : a);
  b = String(b == null ? "" : b);
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function requireToken(data) {
  if (!isSecured()) return;
  if (!safeEqual(data && data.token, getToken())) {
    var err = new Error("Token akses salah atau belum diisi.");
    err.code = "AUTH";
    throw err;
  }
}

function newToken() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "");
}

// Menu: buat token baru (token lama langsung tidak berlaku). Token ditampilkan SEKALI di sini; simpan di website.
function createAccessToken() {
  var ui = SpreadsheetApp.getUi();
  if (isSecured()) {
    var sure = ui.alert("Ganti token akses?", "Token lama langsung berhenti berlaku. Website yang masih memakai token lama harus diisi ulang.", ui.ButtonSet.OK_CANCEL);
    if (sure !== ui.Button.OK) return;
  }
  var token = newToken();
  PropertiesService.getScriptProperties().setProperty(TOKEN_KEY, token);
  ui.alert("Token akses baru", "Salin token ini lalu tempel di website (Sumber data → Token akses):\n\n" + token + "\n\nSiapa pun yang memegang token ini bisa membaca dan mengubah data spreadsheet. Jangan dibagikan.", ui.ButtonSet.OK);
}

function showAccessToken() {
  var ui = SpreadsheetApp.getUi();
  if (!isSecured()) {
    ui.alert("Token belum dibuat", "Pakai menu \"Buat atau ganti token akses\" dulu.", ui.ButtonSet.OK);
    return;
  }
  ui.alert("Token akses", getToken(), ui.ButtonSet.OK);
}

function removeAccessToken() {
  var ui = SpreadsheetApp.getUi();
  var sure = ui.alert("Matikan token akses?", "Siapa pun yang tahu URL /exec akan bisa membaca dan mengubah data lagi.", ui.ButtonSet.OK_CANCEL);
  if (sure !== ui.Button.OK) return;
  PropertiesService.getScriptProperties().deleteProperty(TOKEN_KEY);
  ui.alert("Token dimatikan", "Script kembali terbuka untuk siapa pun yang punya URL-nya.", ui.ButtonSet.OK);
}

// ==========================================
// 1c. PENGATURAN WEBSITE (anggaran, target, dll.) untuk pindah perangkat
// ==========================================
function settingsSheet(ss) {
  var sheet = ss.getSheetByName(SETTINGS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(SETTINGS_SHEET);
    sheet.hideSheet();
  }
  return sheet;
}

function putSettings(ss, data) {
  var blob = String(data.blob == null ? "" : data.blob);
  if (!blob || blob.length > MAX_SETTINGS_CHARS) throw new Error("Pengaturan kosong atau terlalu besar.");
  JSON.parse(blob); // harus JSON yang valid
  var at = new Date().toISOString();
  var sheet = settingsSheet(ss);
  sheet.clear();
  var rows = [["at", at]];
  for (var i = 0; i < blob.length; i += SETTINGS_CHUNK) rows.push(["chunk", blob.slice(i, i + SETTINGS_CHUNK)]);
  sheet.getRange(1, 1, rows.length, 2).setNumberFormat("@").setValues(rows);
  return jsonResponse({ status: "success", at: at, message: "Pengaturan disimpan." });
}

function getSettings(ss) {
  var sheet = ss.getSheetByName(SETTINGS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return jsonResponse({ status: "success", at: null, blob: null });
  var values = sheet.getRange(1, 1, sheet.getLastRow(), 2).getValues();
  var blob = "";
  for (var i = 1; i < values.length; i++) if (values[i][0] === "chunk") blob += String(values[i][1]);
  return jsonResponse({ status: "success", at: String(values[0][1] || "") || null, blob: blob || null });
}

function readSheet(sheet, type, timezone) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  var prefix = type === "expense" ? "exp-" : "inc-";
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();

  // Nomor baris dihitung sebelum filter supaya tetap akurat walau ada baris kosong.
  return values
    .map(function (row, index) {
      var rowNumber = index + 2;
      var total = Number(row[4]) || 0;
      return {
        id: prefix + rowNumber,
        row: rowNumber,
        date: formatDate(row[0], timezone),
        category: String(row[1] || ""),
        account: String(row[2] || ""),
        description: String(row[3] || ""),
        total: total,
        amount: total,
        type: type,
        _hasDate: !!row[0]
      };
    })
    .filter(function (tx) { return tx._hasDate; })
    .map(function (tx) { delete tx._hasDate; return tx; });
}

// Zona waktu spreadsheet; kalau kosong/tidak terbaca, pakai zona script lalu Asia/Jakarta,
// supaya Utilities.formatDate tidak melempar "Invalid argument: timeZone".
function tzOf(ss) {
  var tz = "";
  try { tz = ss.getSpreadsheetTimeZone(); } catch (err) { tz = ""; }
  if (typeof tz === "string" && tz) return tz;
  try { tz = Session.getScriptTimeZone(); } catch (err2) { tz = ""; }
  return typeof tz === "string" && tz ? tz : "Asia/Jakarta";
}

// Helper untuk format tanggal yyyy-MM-dd
function formatDate(dateVal, timezone) {
  if (!dateVal) return "";
  if (typeof dateVal === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateVal)) {
    return dateVal.slice(0, 10);
  }
  try {
    return Utilities.formatDate(new Date(dateVal), timezone, "yyyy-MM-dd");
  } catch (e) {
    return String(dateVal);
  }
}

// ==========================================
// 2. WRITE API (Tambah, Impor Massal & Hapus)
// ==========================================
// Pembungkus: apa pun yang gagal (termasuk di blok finally) tetap dijawab sebagai JSON dan dicatat di
// Executions → Cloud logs, bukan jadi halaman error Google tanpa header CORS yang membuat website
// hanya melihat "Tidak bisa menghubungi Apps Script".
function doPost(e) {
  try {
    return handlePost(e);
  } catch (err) {
    console.error("doPost gagal: " + (err && err.stack ? err.stack : err));
    return jsonResponse({ status: "error", message: String(err && err.message ? err.message : err) });
  }
}

function handlePost(e) {
  var lock = null;
  try {
    var data = JSON.parse(e.postData.contents);

    // Semua aksi, termasuk baca, butuh token kalau token aktif. Diperiksa SEBELUM mengambil kunci, supaya permintaan
    // tanpa token tidak bisa menahan kunci dan menghambat pengguna yang sah.
    requireToken(data);

    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (data.action === "read") {
      return jsonResponse(readAll());
    }

    if (data.action === "putSettings") {
      return putSettings(ss, data);
    }

    if (data.action === "getSettings") {
      return getSettings(ss);
    }

    if (data.action === "addMany") {
      return addMany(ss, data);
    }

    if (data.action === "setLimit") {
      var limit = Number(data.limit);
      if (!isFinite(limit) || limit <= 0 || limit > MAX_LIMIT || Math.floor(limit) !== limit) {
        throw new Error("Batas harian tidak valid: " + data.limit);
      }
      PropertiesService.getScriptProperties().setProperty(LIMIT_KEY, String(limit));
      return jsonResponse({ status: "success", dailyLimit: limit, message: "Batas harian disimpan!" });
    }

    if (data.action === "delete") {
      var type = isIncome(data.type) ? "income" : "expense";
      var sheet = ss.getSheetByName(SHEETS[type]);
      if (!sheet) {
        throw new Error("Sheet '" + SHEETS[type] + "' tidak ditemukan!");
      }
      return deleteRow(sheet, data, tzOf(ss));
    }

    if (data.action === "update") {
      return updateRow(ss, data);
    }

    if (data.action && data.action !== "add") {
      throw new Error("Aksi tidak dikenal: " + data.action);
    }

    // Tambah satu baris: Tanggal, Kategori, Account/Bank, Deskripsi, Total (Rp)
    var clean = cleanRow(data);
    mergeSorted(getOrCreateSheet(ss, SHEETS[clean.type]), [clean.values], tzOf(ss));

    return jsonResponse({
      status: "success",
      message: "Transaksi " + SHEETS[clean.type] + " berhasil dicatat!"
    });
  } catch (err) {
    if (!(err && err.code === "AUTH")) console.error("handlePost gagal: " + (err && err.stack ? err.stack : err));
    return jsonResponse({ status: "error", code: err && err.code ? err.code : undefined, message: String(err && err.message ? err.message : err) });
  } finally {
    if (lock) {
      try { lock.releaseLock(); } catch (releaseErr) { console.error("releaseLock gagal: " + releaseErr); }
    }
  }
}

// Diagnosis: jalankan fungsi ini dari editor Apps Script (pilih "selfTest" lalu Run). Hasilnya muncul di
// Execution log. Tidak menambah transaksi: tahap "tulis" hanya menulis ulang isi yang sudah ada.
function selfTest() {
  var out = [];
  function step(name, fn) {
    try {
      var r = fn();
      out.push("OK     " + name + (r ? ": " + r : ""));
    } catch (err) {
      out.push("GAGAL  " + name + ": " + (err && err.stack ? err.stack : err));
    }
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = tzOf(ss);
  step("zona waktu", function () { return tz; });
  step("versi script", function () { return String(SCRIPT_VERSION); });
  step("token", function () { return isSecured() ? "aktif" : "mati"; });
  step("kunci (LockService)", function () { var l = LockService.getScriptLock(); l.waitLock(5000); l.releaseLock(); });
  step("baca semua", function () { var d = readAll(); return d.expenses.length + " pengeluaran, " + d.incomes.length + " pemasukan"; });
  step("validasi baris baru", function () { cleanRow({ type: "expense", date: Utilities.formatDate(new Date(), tz, "yyyy-MM-dd"), category: "Snacks", account: "BCA", description: "uji", total: 1 }); });
  step("tulis ulang isi Expense", function () {
    var sheet = getOrCreateSheet(ss, SHEETS.expense);
    var used = readUsed(sheet);
    writeRows(sheet, used.rows, used.lastUsed);
    return used.rows.length + " baris";
  });
  step("rapikan urutan (mergeSorted tanpa baris baru)", function () { mergeSorted(getOrCreateSheet(ss, SHEETS.expense), [], tz); });
  var text = out.join("\n");
  console.log(text);
  Logger.log(text);
}

// Batas harian dari website; 0 kalau belum pernah diatur.
function readStoredLimit() {
  var n = Number(PropertiesService.getScriptProperties().getProperty(LIMIT_KEY));
  return isFinite(n) && n > 0 ? n : 0;
}

function isIncome(type) {
  return String(type || "").toLowerCase() === "income";
}

function text(v) {
  return String(v == null ? "" : v).slice(0, 200);
}

// Validasi satu baris dari website. Melempar error kalau datanya tidak masuk akal.
function cleanRow(d) {
  var type = isIncome(d.type) ? "income" : "expense";
  var date = String(d.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Tanggal tidak valid: " + d.date);
  }
  var total = Number(d.total);
  if (!isFinite(total) || total <= 0) {
    throw new Error("Total tidak valid: " + d.total);
  }
  return {
    type: type,
    values: [date, text(d.category), text(d.account), text(d.description), total]
  };
}

// Ambil sheet; buat (beserta header) kalau belum ada atau masih kosong.
function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

// Kunci pengurutan yyyy-MM-dd untuk satu sel tanggal ("" kalau tidak terbaca).
function dateKey(value, timezone) {
  var key = formatDate(value, timezone);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : "";
}

function isBlankRow(row) {
  for (var i = 0; i < row.length; i++) {
    if (row[i] !== "" && row[i] != null) return false;
  }
  return true;
}

// Baca isi kolom A-E. Sengaja TIDAK memakai getLastRow() untuk mencari "baris terakhir data":
// getLastRow() ikut menghitung kolom lain (mis. tabel Daily Total Report di kolom G-I) dan baris
// berformat dropdown, jadi bisa jauh di bawah data sebenarnya. Hasil: daftar baris yang ada
// isinya (urutan sama seperti di sheet) dan nomor baris terakhir yang benar-benar berisi.
function readUsed(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return { rows: [], lastUsed: 1 };
  var values = sheet.getRange(2, 1, last - 1, 5).getValues();
  var rows = [];
  var lastUsed = 1;
  for (var i = 0; i < values.length; i++) {
    if (!isBlankRow(values[i])) {
      rows.push(values[i]);
      lastUsed = i + 2;
    }
  }
  return { rows: rows, lastUsed: lastUsed };
}

// Sheet lama menyimpan transaksi dari terlama (di atas) ke terbaru (di bawah). Kalau begitu,
// balik dulu supaya transaksi tanggal sama tetap urut "yang lebih baru di atas".
function looksAscending(rows, timezone) {
  var first = "", last = "";
  for (var i = 0; i < rows.length; i++) {
    var key = dateKey(rows[i][0], timezone);
    if (!key) continue;
    if (!first) first = key;
    last = key;
  }
  return first !== "" && first < last;
}

// Gabungkan baris baru dengan isi sheet, urutkan terbaru -> terlama, lalu tulis ulang blok A-E
// mulai baris 2 tanpa celah. Hanya kolom A-E yang disentuh, jadi kolom lain (Daily Total Report,
// dst.) dan format/dropdown sel tidak ikut bergeser. Tanggal yang sama: baris baru di atas;
// untuk beberapa baris baru sekaligus, yang lebih akhir di daftar ada di atas.
// Tanggal yang tidak terbaca ditaruh paling bawah.
function mergeSorted(sheet, newRows, timezone) {
  var used = readUsed(sheet);
  var existing = used.rows;
  if (looksAscending(existing, timezone)) existing = existing.slice().reverse();

  var items = [];
  for (var n = newRows.length - 1; n >= 0; n--) items.push({ values: newRows[n] });
  for (var e = 0; e < existing.length; e++) items.push({ values: existing[e] });
  items.forEach(function (item, index) {
    item.key = dateKey(item.values[0], timezone);
    item.seq = index;
  });
  items.sort(function (a, b) {
    if (a.key !== b.key) {
      if (!a.key) return 1;
      if (!b.key) return -1;
      return a.key < b.key ? 1 : -1;
    }
    return a.seq - b.seq;
  });

  writeRows(sheet, items.map(function (item) { return item.values; }), used.lastUsed);
}

// Tulis `rows` ke A2:E, lalu kosongkan sisa baris yang tadinya berisi (sampai previousLast).
function writeRows(sheet, rows, previousLast) {
  var endRow = rows.length + 1;

  // setValues() tidak menambah baris otomatis. Tanpa ini, sheet yang barisnya sudah penuh
  // (default 1000 baris) gagal menerima transaksi baru.
  var missing = endRow - sheet.getMaxRows();
  if (missing > 0) sheet.insertRowsAfter(sheet.getMaxRows(), missing);

  if (rows.length) {
    // Kolom teks (Kategori, Account, Deskripsi) diformat plain text supaya isi yang diawali
    // "=", "+", "-" atau "@" (mis. dari file Excel orang lain) tidak dijalankan sebagai rumus.
    // Sheet yang diubah jadi "Table" punya kolom bertipe: di sana setNumberFormat ditolak
    // ("You can't set the number format of cells in a typed column"), dan errornya bisa baru muncul saat
    // flush, di luar try/catch. Karena itu dicoba di dalam try dan langsung di-flush. Kalau ditolak,
    // isi yang berawalan = + - @ dinetralkan dengan awalan apostrof (bukan jadi rumus).
    var plain = true;
    try {
      sheet.getRange(2, 2, rows.length, 3).setNumberFormat("@");
      SpreadsheetApp.flush();
    } catch (fmtErr) {
      plain = false;
      console.warn("setNumberFormat ditolak, memakai awalan apostrof: " + fmtErr);
    }
    if (!plain) {
      rows = rows.map(function (r) {
        var copy = r.slice();
        for (var c = 1; c <= 3; c++) {
          if (typeof copy[c] === "string" && /^[=+\-@]/.test(copy[c])) copy[c] = "'" + copy[c];
        }
        return copy;
      });
    }
    sheet.getRange(2, 1, rows.length, 5).setValues(rows);
    SpreadsheetApp.flush();
  }
  if (previousLast > endRow) {
    sheet.getRange(endRow + 1, 1, previousLast - endRow, 5).clearContent();
  }
}

// Menu: rapikan seluruh sheet terbaru -> terlama.
function sortNewestFirst(sheet, timezone) {
  mergeSorted(sheet, [], timezone);
}

function addMany(ss, data) {
  var rows = data.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Tidak ada baris untuk ditambahkan.");
  }
  if (rows.length > MAX_BATCH) {
    throw new Error("Maksimal " + MAX_BATCH + " baris per permintaan.");
  }

  // Validasi semua baris dulu; kalau ada satu saja yang salah, tidak ada yang ditulis.
  var grouped = { expense: [], income: [] };
  for (var i = 0; i < rows.length; i++) {
    try {
      var clean = cleanRow(rows[i]);
      grouped[clean.type].push(clean.values);
    } catch (err) {
      throw new Error("Baris " + (i + 1) + ": " + err.message);
    }
  }

  var timezone = tzOf(ss);
  if (grouped.expense.length) {
    mergeSorted(getOrCreateSheet(ss, SHEETS.expense), grouped.expense, timezone);
  }
  if (grouped.income.length) {
    mergeSorted(getOrCreateSheet(ss, SHEETS.income), grouped.income, timezone);
  }

  return jsonResponse({
    status: "success",
    added: rows.length,
    message: rows.length + " transaksi berhasil ditambahkan!"
  });
}

function removeVerifiedRow(sheet, data, timezone) {
  var row = Number(data.row);
  if (!row || row < 2 || row > sheet.getLastRow()) {
    throw new Error("Baris tidak ditemukan. Refresh halaman lalu coba lagi.");
  }

  // Pastikan isi baris masih sama dengan yang dilihat di website,
  // supaya tidak salah hapus kalau sheet sudah berubah.
  var values = sheet.getRange(row, 1, 1, 5).getValues()[0];
  var sameDate = formatDate(values[0], timezone) === String(data.date || "");
  var sameTotal = (Number(values[4]) || 0) === (Number(data.total) || 0);
  var sameDesc = String(values[3] || "") === String(data.description || "");
  if (!sameDate || !sameTotal || !sameDesc) {
    throw new Error("Data di spreadsheet sudah berubah. Refresh halaman lalu coba lagi.");
  }

  // Geser baris di bawahnya naik satu, hanya di kolom A-E. deleteRow() menghapus satu baris
  // utuh, termasuk kolom lain di baris itu (mis. Daily Total Report), dan memendekkan sheet.
  var used = readUsed(sheet);
  var last = used.lastUsed;
  if (row < last) {
    var below = sheet.getRange(row + 1, 1, last - row, 5).getValues();
    sheet.getRange(row, 1, below.length, 5).setValues(below);
  }
  sheet.getRange(last, 1, 1, 5).clearContent();
}

function deleteRow(sheet, data, timezone) {
  removeVerifiedRow(sheet, data, timezone);
  return jsonResponse({ status: "success", message: "Transaksi berhasil dihapus!" });
}

// Versi 5: ubah transaksi = hapus baris lama (setelah diverifikasi) lalu sisipkan versi baru
// di posisi tanggalnya. Semua dalam satu kunci, jadi tidak ada yang melihat keadaan setengah jadi.
// Data baru divalidasi dulu supaya baris lama tidak hilang kalau isian baru ditolak.
function updateRow(ss, data) {
  var timezone = tzOf(ss);
  var type = isIncome(data.type) ? "income" : "expense";
  var sheet = ss.getSheetByName(SHEETS[type]);
  if (!sheet) {
    throw new Error("Sheet '" + SHEETS[type] + "' tidak ditemukan!");
  }
  var fresh = cleanRow({
    type: type,
    date: data.newDate,
    category: data.newCategory,
    account: data.newAccount,
    description: data.newDescription,
    total: data.newTotal
  });
  removeVerifiedRow(sheet, data, timezone);
  mergeSorted(sheet, [fresh.values], timezone);
  return jsonResponse({ status: "success", message: "Transaksi berhasil diubah!" });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// 3. MENU: rapikan urutan (terbaru di atas)
// ==========================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Secukupnya.fund")
    .addItem("Urutkan terbaru di atas", "sortAllNewestFirst")
    .addSeparator()
    .addItem("Buat atau ganti token akses", "createAccessToken")
    .addItem("Lihat token akses", "showAccessToken")
    .addItem("Matikan token akses (tidak aman)", "removeAccessToken")
    .addToUi();
}

function sortAllNewestFirst() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var timezone = tzOf(ss);
  [SHEETS.expense, SHEETS.income].forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (sheet) sortNewestFirst(sheet, timezone);
  });
  ss.toast("Transaksi sudah diurutkan dari yang terbaru.", "Secukupnya.fund");
}

// ==========================================
// 4. ALERT POP-UP (Saat Edit Manual di Sheet)
// ==========================================
function onEdit(e) {
  var sheet = e.source.getActiveSheet();

  if (sheet.getName() === SHEETS.expense) {
    var range = e.range;
    var row = range.getRow();
    var col = range.getColumn();

    // Trigger saat mengisi/mengubah nominal di Kolom E (Total Rp)
    if (col === 5 && row >= 2) {
      var dateCell = sheet.getRange(row, 1).getValue();
      if (!dateCell) return;

      var totalForDay = 0;
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return;

      var data = sheet.getRange("A2:E" + lastRow).getValues();

      for (var i = 0; i < data.length; i++) {
        var rowDate = data[i][0];
        var category = data[i][1];
        var amount = data[i][4];

        if (rowDate && category !== "Transfer") {
          var d1 = new Date(rowDate).toDateString();
          var d2 = new Date(dateCell).toDateString();
          if (d1 === d2) {
            totalForDay += Number(amount);
          }
        }
      }

      var limit = readStoredLimit() || DEFAULT_LIMIT;
      if (totalForDay > limit) {
        var formattedTotal = "Rp " + totalForDay.toLocaleString("id-ID");
        var formattedLimit = "Rp" + limit.toLocaleString("id-ID");
        SpreadsheetApp.getUi().alert(
          "⚠️ PERINGATAN PENGELUARAN!\n\n" +
          "Total pengeluaranmu hari ini sudah mencapai " + formattedTotal + ".\n" +
          "Ini sudah melebihi batas " + formattedLimit + "/hari (Kategori: Boros).\n\n" +
          "Yuk, lebih hemat lagi untuk sisa hari ini! 😉"
        );
      }
    }
  }
}
