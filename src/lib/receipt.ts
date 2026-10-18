import { MONTHS, isoDate } from './dateText';

/**
 * Membaca teks hasil OCR struk belanja menjadi tanggal, toko, total, dan daftar barang.
 *
 * Prinsip: hasil OCR bisa salah, jadi setiap bidang membawa tingkat keyakinan dan alasannya. Fungsi ini tidak
 * pernah mengarang nilai: kalau tidak ketemu, nilainya null dan pengguna mengisinya sendiri di layar pemeriksaan.
 * Tidak memakai regex lookbehind (Safari lama tidak mendukungnya).
 */

export type Confidence = 'high' | 'medium' | 'low';

export interface Found<T> {
  value: T | null;
  confidence: Confidence;
  /** Baris OCR yang menjadi sumber nilai (untuk ditampilkan saat pemeriksaan). */
  line?: string;
}

export interface ReceiptItem {
  name: string;
  qty: number | null;
  amount: number;
}

export type ReceiptWarning =
  | 'noTotal' | 'totalGuessed' | 'totalMismatch' | 'discountOrTax'
  | 'noDate' | 'dateAmbiguous' | 'dateFuture' | 'dateOld'
  | 'noMerchant' | 'noItems' | 'lowOcr' | 'emptyText';

export interface ReceiptParse {
  merchant: Found<string>;
  date: Found<string>;
  total: Found<number>;
  items: ReceiptItem[];
  /** Kategori yang disarankan dari nama toko (hanya untuk toko yang dikenal), atau null. */
  categoryHint: string | null;
  warnings: ReceiptWarning[];
  lines: string[];
}

export const MIN_AMOUNT = 100;
export const MAX_RECEIPT_AMOUNT = 1_000_000_000;

// ---------- Angka ----------

/** Perbaiki salah baca OCR yang umum (O→0, l/I/|→1) hanya pada token yang hampir seluruhnya angka. */
function fixDigitToken(tok: string): string {
  if (!/^[0-9OoIl|.,:\-/]+$/.test(tok)) return tok;
  if (!/\d/.test(tok)) return tok;
  return tok.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1');
}

/** Satu token → rupiah bulat (positif), atau null kalau bukan nominal yang masuk akal. */
export function parseAmountToken(raw: string): number | null {
  let s = raw.trim().replace(/^(?:rp\.?|idr)\s*/i, '').replace(/[,.]-$/, '').replace(/^[(:*'"“”]+|[):*'"“”;:]+$/g, '').replace(/(\d)[.,]+$/, '$1');
  if (!s) return null;
  s = fixDigitToken(s);
  let digits: string;
  if (/^\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?$/.test(s)) {
    // Pemisah ribuan; dua digit terakhir setelah pemisah (",00" / ".50") adalah desimal.
    const m = /^(.*?)(?:[.,](\d{1,2}))?$/.exec(s);
    const body = m && m[2] !== undefined && /[.,]/.test(m[1]) ? m[1] : s;
    digits = body.replace(/[.,]/g, '');
  } else if (/^\d+(?:[.,]\d{1,2})?$/.test(s)) {
    digits = s.replace(/[.,]\d{1,2}$/, '');
  } else {
    return null;
  }
  const n = Number(digits);
  return Number.isFinite(n) && n >= MIN_AMOUNT && n <= MAX_RECEIPT_AMOUNT ? n : null;
}

interface AmountHit { value: number; negative: boolean; index: number }

/** Semua nominal pada satu baris, dari kiri ke kanan. Token berawalan "-" atau dalam kurung dianggap negatif (diskon). */
export function amountsIn(line: string): AmountHit[] {
  const out: AmountHit[] = [];
  const toks = line.split(/\s+/).filter(Boolean);
  toks.forEach((tok, index) => {
    const negative = /^[-−(]/.test(tok) || /\)$/.test(tok) && /^\(/.test(tok);
    const v = parseAmountToken(tok.replace(/^[-−]/, ''));
    if (v !== null) out.push({ value: v, negative, index });
  });
  return out;
}

// ---------- Tanggal ----------

interface DateHit { iso: string; ambiguous: boolean; line: string; hasTime: boolean }

function monthFromName(name: string): number | null {
  const k = name.toLowerCase();
  return MONTHS[k] ?? MONTHS[k.slice(0, 3)] ?? null;
}

function fixLine(line: string): string {
  return line.split(/(\s+)/).map((t) => (/\s/.test(t) ? t : fixDigitToken(t))).join('');
}

export function datesIn(rawLine: string, today: string): DateHit[] {
  const line = fixLine(rawLine);
  const hasTime = /\b\d{1,2}[:.]\d{2}(?::\d{2})?\b/.test(line);
  const hits: DateHit[] = [];
  const push = (iso: string | null, ambiguous: boolean) => { if (iso) hits.push({ iso, ambiguous, line: rawLine, hasTime }); };

  // yyyy-mm-dd
  for (const m of line.matchAll(/\b(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})\b/g)) push(isoDate(+m[1], +m[2], +m[3]), false);
  // dd/mm/yyyy atau dd/mm/yy (urutan Indonesia). Kalau mm/dd/yyyy masuk akal sebagai tanggal yang sudah lewat padahal dd/mm jatuh di masa depan, pakai itu.
  for (const m of line.matchAll(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4}|\d{2})\b/g)) {
    const a = +m[1], b = +m[2];
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    const dmy = isoDate(y, b, a);
    const mdy = isoDate(y, a, b);
    if (dmy && mdy && dmy !== mdy) {
      if (dmy > today && mdy <= today) push(mdy, true);
      else push(dmy, true);
    } else {
      push(dmy ?? mdy, false);
    }
  }
  // 8 Okt 2026 / 08-Oct-2026 / 8 Oktober 26
  for (const m of line.matchAll(/\b(\d{1,2})[\s\-/.]*([A-Za-z]{3,9})[\s\-/.,]*(\d{4}|\d{2})\b/g)) {
    const mon = monthFromName(m[2]);
    if (!mon) continue;
    push(isoDate(m[3].length === 2 ? 2000 + +m[3] : +m[3], mon, +m[1]), false);
  }
  return hits;
}

function pickDate(lines: string[], today: string): { found: Found<string>; warnings: ReceiptWarning[] } {
  const all: DateHit[] = [];
  for (const l of lines) all.push(...datesIn(l, today));
  if (!all.length) return { found: { value: null, confidence: 'low' }, warnings: ['noDate'] };
  const best = all.find((d) => d.hasTime) ?? all[0];
  const warnings: ReceiptWarning[] = [];
  let confidence: Confidence = best.ambiguous ? 'medium' : 'high';
  if (best.ambiguous) warnings.push('dateAmbiguous');
  const todayMs = Date.parse(today);
  const ms = Date.parse(best.iso);
  if (ms - todayMs > 86_400_000) { warnings.push('dateFuture'); confidence = 'low'; }
  else if (todayMs - ms > 366 * 86_400_000) { warnings.push('dateOld'); confidence = 'low'; }
  return { found: { value: best.iso, confidence, line: best.line }, warnings };
}

// ---------- Toko ----------

const KNOWN: { re: RegExp; name: string; category: string | null }[] = [
  { re: /indomaret/i, name: 'Indomaret', category: 'Groceries' },
  { re: /alfamart/i, name: 'Alfamart', category: 'Groceries' },
  { re: /alfamidi/i, name: 'Alfamidi', category: 'Groceries' },
  { re: /superindo/i, name: 'Superindo', category: 'Groceries' },
  { re: /hypermart/i, name: 'Hypermart', category: 'Groceries' },
  { re: /transmart/i, name: 'Transmart', category: 'Groceries' },
  { re: /lotte\s*mart/i, name: 'Lotte Mart', category: 'Groceries' },
  { re: /family\s*mart/i, name: 'FamilyMart', category: 'Groceries' },
  { re: /circle\s*k/i, name: 'Circle K', category: 'Groceries' },
  { re: /starbucks/i, name: 'Starbucks', category: 'Food & Drink' },
  { re: /kopi\s*kenangan/i, name: 'Kopi Kenangan', category: 'Food & Drink' },
  { re: /janji\s*jiwa/i, name: 'Janji Jiwa', category: 'Food & Drink' },
  { re: /\bchatime\b/i, name: 'Chatime', category: 'Food & Drink' },
  { re: /\bkfc\b/i, name: 'KFC', category: 'Food & Drink' },
  { re: /mc\s*donald/i, name: "McDonald's", category: 'Food & Drink' },
  { re: /burger\s*king/i, name: 'Burger King', category: 'Food & Drink' },
  { re: /pizza\s*hut/i, name: 'Pizza Hut', category: 'Food & Drink' },
  { re: /dunkin/i, name: "Dunkin'", category: 'Food & Drink' },
  { re: /pertamina|shell\b|\bbp\b|vivo\s*energy/i, name: 'SPBU', category: 'Transportation' },
  { re: /\bxxi\b|\bcgv\b|cinepolis/i, name: 'Bioskop', category: 'Entertainment' },
  { re: /guardian/i, name: 'Guardian', category: null },
  { re: /watsons/i, name: 'Watsons', category: null },
  { re: /kimia\s*farma/i, name: 'Kimia Farma', category: null },
];

const NOT_MERCHANT = /(struk|kasir|cashier|npwp|telp|tel\b|phone|\bhp\b|jalan|\bjl\b|\bjln\b|alamat|terima\s*kasih|thank|selamat\s*datang|welcome|nota|invoice|receipt|no\.?\s*\d|order|\bid\b|www\.|http|@|tgl|tanggal|jam\b|shift|meja|table|antrian|queue|member|kode|faktur|pajak|pb1|ppn)/i;

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s\-/&.])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase())
    .replace(/\b(Pt|Cv|Tbk|Ud)\b/g, (w) => w.toUpperCase());
}

function pickMerchant(lines: string[]): { found: Found<string>; category: string | null } {
  const head = lines.slice(0, 14);
  for (const l of head) {
    const k = KNOWN.find((x) => x.re.test(l));
    if (k) return { found: { value: k.name, confidence: 'high', line: l }, category: k.category };
  }
  for (const l of lines.slice(0, 7)) {
    const clean = l.replace(/[^A-Za-z0-9&'.\-/ ]/g, ' ').replace(/\s+/g, ' ').trim();
    const letters = (clean.match(/[A-Za-z]/g) ?? []).length;
    if (clean.length < 3 || clean.length > 40) continue;
    if (letters / clean.length < 0.65) continue;
    if (NOT_MERCHANT.test(clean)) continue;
    if (datesIn(l, '2100-01-01').length) continue;
    if (amountsIn(l).length) continue;
    return { found: { value: titleCase(clean), confidence: 'medium', line: l }, category: null };
  }
  return { found: { value: null, confidence: 'low' }, category: null };
}

// ---------- Total ----------

const TIER1 = /grand\s*total|total\s*bayar|total\s*belanja|total\s*tagihan|total\s*pembayaran|total\s*akhir|total\s*harga|amount\s*due|jumlah\s*bayar|net\s*total|netto|total\s*pembelian/i;
const SUBTOTAL = /sub\s*-?\s*total/i;
const TIER2 = /\btotal\b|\bjumlah\b|\bttl\b|\btot\b/i;
const NOT_TOTAL = /total\s*(item|qty|barang|disc|diskon|hemat|ppn|pajak|tax|service|potongan|poin|point)|jumlah\s*(item|qty|barang)|jml\s*(item|qty|brg)|item\s*total/i;
const PAYMENT = /tunai|cash|\bbayar\b|debit|kredit|credit|qris|gopay|ovo|\bdana\b|shopeepay|e-?money|flazz|brizzi|kartu|card|transfer/i;
const CHANGE = /kembali|change|kembalian/i;
const DISCOUNT_TAX = /diskon|disc\b|discount|potongan|promo|hemat|voucher|ppn|pajak|tax|pb1|service|servis|ongkir|biaya\s*kirim|pembulatan|rounding/i;
const SKIP_ITEM = /(total|subtotal|tunai|cash|kembali|change|ppn|pajak|tax|pb1|diskon|disc\b|discount|potongan|service|servis|member|poin|point|kartu|card|debit|kredit|ref\b|no\.|tgl|tanggal|kasir|struk|terima\s*kasih|npwp|telp|alamat|jml|qty\s*:|item\s*:|harga\s*jual|voucher|rounding|pembulatan|bayar|barang\s*:|\bpcs\b\s*$|jam\b|shift)/i;

function lastAmount(line: string): number | null {
  const a = amountsIn(line).filter((x) => !x.negative);
  return a.length ? a[a.length - 1].value : null;
}

function amountOnOrAfter(lines: string[], i: number): number | null {
  const own = lastAmount(lines[i]);
  if (own !== null) return own;
  const next = lines[i + 1];
  if (next !== undefined) {
    const toks = next.split(/\s+/).filter(Boolean);
    if (toks.length <= 3) return lastAmount(next);
  }
  return null;
}

interface TotalResult { found: Found<number>; warnings: ReceiptWarning[] }

function pickTotal(lines: string[], itemsSum: number | null): TotalResult {
  const t1: { v: number; line: string; i: number }[] = [];
  const t2: { v: number; line: string; i: number }[] = [];
  const t3: { v: number; line: string; i: number }[] = [];
  let paid: number | null = null;
  let change: number | null = null;

  lines.forEach((l, i) => {
    if (CHANGE.test(l)) { const v = amountOnOrAfter(lines, i); if (v !== null) change = v; return; }
    if (NOT_TOTAL.test(l)) return;
    if (TIER1.test(l)) { const v = amountOnOrAfter(lines, i); if (v !== null) t1.push({ v, line: l, i }); return; }
    if (SUBTOTAL.test(l)) { const v = amountOnOrAfter(lines, i); if (v !== null) t3.push({ v, line: l, i }); return; }
    if (TIER2.test(l)) { const v = amountOnOrAfter(lines, i); if (v !== null) t2.push({ v, line: l, i }); return; }
    if (PAYMENT.test(l)) { const v = amountOnOrAfter(lines, i); if (v !== null && (paid === null || v >= paid)) paid = v; }
  });

  const explainedByPayment = (v: number) => paid !== null && change !== null && Math.abs(paid - change - v) <= 1;
  const explainedByItems = (v: number) => itemsSum !== null && Math.abs(itemsSum - v) <= 1;
  const warnings: ReceiptWarning[] = [];

  let pick: { v: number; line: string } | null = null;
  let confidence: Confidence = 'high';
  if (t1.length) pick = t1[t1.length - 1];
  else if (t2.length) { pick = t2.reduce((a, b) => (b.v > a.v ? b : a)); confidence = explainedByPayment(pick.v) || explainedByItems(pick.v) ? 'high' : 'medium'; }
  else if (t3.length) { pick = t3[t3.length - 1]; confidence = explainedByPayment(pick.v) || explainedByItems(pick.v) ? 'medium' : 'low'; }

  if (!pick) {
    // Tanpa kata kunci total: nominal terbesar di luar baris pembayaran/kembalian, hanya sebagai tebakan.
    let best: { v: number; line: string } | null = null;
    lines.forEach((l) => {
      if (CHANGE.test(l) || PAYMENT.test(l) || NOT_TOTAL.test(l)) return;
      const v = lastAmount(l);
      if (v !== null && (!best || v > best.v)) best = { v, line: l };
    });
    if (paid !== null && change !== null && paid > change) {
      // Tunai − kembali = yang benar-benar dibayar.
      warnings.push('totalGuessed');
      return { found: { value: paid - change, confidence: 'low' }, warnings };
    }
    if (best) {
      const b: { v: number; line: string } = best;
      warnings.push('totalGuessed');
      return { found: { value: b.v, confidence: 'low', line: b.line }, warnings };
    }
    warnings.push('noTotal');
    return { found: { value: null, confidence: 'low' }, warnings };
  }

  if (itemsSum !== null && !explainedByItems(pick.v)) {
    const hasAdj = lines.some((l) => DISCOUNT_TAX.test(l));
    if (hasAdj) warnings.push('discountOrTax');
    else { warnings.push('totalMismatch'); if (confidence === 'high') confidence = 'medium'; }
  }
  if (confidence === 'high' && paid !== null && change !== null && !explainedByPayment(pick.v) && !explainedByItems(pick.v)) {
    // Total berbeda dari tunai − kembali dan tidak cocok dengan barang: kurang yakin.
    confidence = 'medium';
  }
  return { found: { value: pick.v, confidence, line: pick.line }, warnings };
}

// ---------- Barang ----------

function cleanName(s: string): string {
  return s.replace(/^[\s\d.*#-]+(?=[A-Za-z])/, '').replace(/[|_~^]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

const QTY_PRICE = /^(\d{1,3})\s*[xX×@*]{1,2}\s*([\d.,]+)\s+([\d.,]+)[\s:;'".,]*$/;
const NAME_QTY_PRICE_AMT = /^(.*?[A-Za-z].*?)\s+(\d{1,3})\s*[xX×@*]{1,2}\s*([\d.,]+)\s+([\d.,]+)[\s:;'".,]*$/;

export function parseItems(lines: string[], stopAt: number): ReceiptItem[] {
  const items: ReceiptItem[] = [];
  const end = stopAt >= 0 ? stopAt : lines.length;
  for (let i = 0; i < end; i++) {
    const l = lines[i];
    if (SKIP_ITEM.test(l)) continue;
    if (datesIn(l, '2100-01-01').length) continue;

    const full = NAME_QTY_PRICE_AMT.exec(l);
    if (full) {
      const amount = parseAmountToken(full[4]);
      const name = cleanName(full[1]);
      if (amount !== null && name.length >= 2) { items.push({ name, qty: Number(full[2]), amount }); continue; }
    }
    // Gaya Indomaret/Alfamart: nama di satu baris, "2 x 5.000   10.000" di baris berikutnya.
    const qp = QTY_PRICE.exec(l);
    if (qp && i > 0) {
      const amount = parseAmountToken(qp[3]);
      const prev = cleanName(lines[i - 1]);
      if (amount !== null && prev.length >= 2 && /[A-Za-z]/.test(prev) && !SKIP_ITEM.test(lines[i - 1])) {
        const last = items[items.length - 1];
        if (last && last.name === prev) items.pop();
        items.push({ name: prev, qty: Number(qp[1]), amount });
        continue;
      }
    }
    const amts = amountsIn(l).filter((a) => !a.negative);
    if (!amts.length) continue;
    const lastTok = amts[amts.length - 1];
    const toks = l.split(/\s+/).filter(Boolean);
    const name = cleanName(toks.slice(0, lastTok.index).join(' ').replace(/\s+\d+\s*$/, ''));
    if (name.length >= 2 && /[A-Za-z]{2}/.test(name) && toks.length >= 2) {
      // Hindari menghitung baris yang namanya hanya nominal lain.
      items.push({ name, qty: null, amount: lastTok.value });
    }
  }
  return items.slice(0, 60);
}

// ---------- Utama ----------

export interface ParseOptions {
  /** yyyy-MM-dd hari ini. */
  today: string;
  /** Rata-rata keyakinan OCR 0..100 kalau tersedia. */
  ocrConfidence?: number | null;
}

/** Salah baca OCR yang umum pada kata kunci penting (T0TAL, TUNA1, KEMBAL1, SUBT0TAL). */
function fixKeywords(l: string): string {
  return l
    .replace(/\bSUBT[O0]TA[LI1|]\b/gi, 'SUBTOTAL')
    .replace(/\bT[O0]TA[LI1|]\b/gi, 'TOTAL')
    .replace(/\bTUNA[LI1|]\b/gi, 'TUNAI')
    .replace(/\bKEMBAL[LI1|]\b/gi, 'KEMBALI');
}

export function normalizeLines(text: string): string[] {
  return text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => fixKeywords(l.replace(/[\t\u00a0]+/g, ' ').replace(/^[“”"'`~|.:;_\s]+(?=[A-Za-z0-9(])/, '').replace(/\s{2,}/g, ' ').trim()))
    .filter((l) => l.length > 0);
}

export function parseReceipt(text: string, opts: ParseOptions): ReceiptParse {
  const lines = normalizeLines(text);
  const warnings: ReceiptWarning[] = [];
  if (!lines.length) {
    return {
      merchant: { value: null, confidence: 'low' }, date: { value: null, confidence: 'low' }, total: { value: null, confidence: 'low' },
      items: [], categoryHint: null, warnings: ['emptyText'], lines,
    };
  }
  if (opts.ocrConfidence != null && opts.ocrConfidence < 60) warnings.push('lowOcr');

  const m = pickMerchant(lines);
  if (m.found.value === null) warnings.push('noMerchant');

  const d = pickDate(lines, opts.today);
  warnings.push(...d.warnings);

  // Barang berhenti di baris total/subtotal pertama yang sudah punya barang sebelumnya.
  let stop = -1;
  for (let i = 0; i < lines.length; i++) {
    if ((TIER1.test(lines[i]) || SUBTOTAL.test(lines[i]) || (TIER2.test(lines[i]) && !NOT_TOTAL.test(lines[i]))) && i > 1) { stop = i; break; }
  }
  const items = parseItems(lines, stop);
  const sum = items.length ? items.reduce((s, x) => s + x.amount, 0) : null;
  if (!items.length) warnings.push('noItems');

  const t = pickTotal(lines, sum);
  warnings.push(...t.warnings);

  return { merchant: m.found, date: d.found, total: t.found, items, categoryHint: m.category, warnings: Array.from(new Set(warnings)), lines };
}
