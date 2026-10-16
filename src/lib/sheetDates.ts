import { isoDate, parseTextDate, type DateOrder } from './dateText';
import { toLocalISO } from './date';

const SLASH_DATE = /^(\d{1,2})[-/.](\d{1,2})[-/.]\d{4}$/;

/**
 * Tebak urutan tulisan tanggal ("9/28/2026" atau "28/9/2026") dari seluruh data sekaligus: satu
 * tanggal seperti 28/9 sudah cukup untuk memastikan. Kalau semua tanggalnya ambigu (hari dan bulan
 * sama-sama ≤ 12), dipakai bulan/hari/tahun, urutan bawaan tampilan Google Sheets.
 */
export function inferDateOrder(values: unknown[]): DateOrder {
  let dmy = 0;
  let mdy = 0;
  for (const v of values) {
    if (typeof v !== 'string') continue;
    const m = v.trim().match(SLASH_DATE);
    if (!m) continue;
    if (+m[1] > 12) dmy++;
    else if (+m[2] > 12) mdy++;
  }
  if (dmy > mdy) return 'dmy';
  return 'mdy';
}

/**
 * Tanggal dari satu sel yang dikirim Apps Script, menjadi yyyy-MM-dd, atau '' kalau tidak terbaca.
 * Code.gs terbaru sudah mengirim yyyy-MM-dd, tapi script lama atau sel berisi teks bisa mengirim
 * bentuk lain, jadi semua bentuk yang masuk akal diterima di sini.
 */
export function normalizeSheetDate(value: unknown, order: DateOrder): string {
  if (value === null || value === undefined) return '';

  if (typeof value === 'number') {
    if (value >= 20000 && value <= 80000) {
      // Nomor seri tanggal Excel/Sheets.
      const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
      return isoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) ?? '';
    }
    if (value > 1e11 && value < 5e12) return toLocalISO(new Date(value)); // epoch milidetik
    return '';
  }

  const s = String(value).trim();
  if (!s) return '';

  // Tanggal polos: bentuk yang dikirim Code.gs terbaru.
  const plain = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (plain) return isoDate(+plain[1], +plain[2], +plain[3]) ?? '';

  // Date yang diserialisasi JSON ("2026-09-27T17:00:00.000Z"): jam di dalamnya adalah tengah malam
  // zona waktu spreadsheet, jadi tanggalnya dibaca di zona waktu browser, bukan dipotong dari teks UTC.
  if (/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return toLocalISO(d);
  }

  return parseTextDate(s, { order, flexible: true }) ?? '';
}
