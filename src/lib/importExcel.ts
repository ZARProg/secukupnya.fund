import { tr } from '@/i18n';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, TRANSFER_CATEGORY, canonicalAccount, isTransferCategory } from './categories';
import { isoDate as iso, parseTextDate } from './dateText';
import type { Transaction, TransactionPayload, TxType } from './transactions';

/** Satu sel hasil pembacaan file Excel. */
export type Cell = string | number | boolean | Date | null | undefined;
export interface RawSheet {
  sheet: string;
  data: Cell[][];
}

export interface ImportRow {
  /** Nomor baris di file Excel (mulai dari 1), supaya user mudah menemukannya. */
  line: number;
  sheet: string;
  payload: TransactionPayload;
}

export interface ImportIssue {
  sheet: string;
  /** 0 berarti masalahnya di level sheet, bukan di baris tertentu. */
  line: number;
  message: string;
}

export interface ParseResult {
  rows: ImportRow[];
  issues: ImportIssue[];
  /** Jumlah baris berkategori Transfer di dalam `rows`. Ikut diimpor dan memengaruhi saldo, tapi tidak tampil di daftar. */
  transferCount: number;
}

export const MAX_IMPORT_ROWS = 5000;
const MAX_DESCRIPTION = 100;
const HEADER_SCAN_ROWS = 10;

/** Sheet pendamping (panduan, ringkasan) yang memang bukan data transaksi: dilewati tanpa peringatan. */
const IGNORED_SHEETS = ['panduan', 'guide', 'instructions', 'petunjuk', 'readme', 'info', 'dashboard', 'summary', 'ringkasan'];

type Field = 'date' | 'type' | 'category' | 'account' | 'description' | 'total';

const FIELD_ALIASES: Record<Field, string[]> = {
  date: ['tanggal', 'tgl', 'date', 'waktu'],
  type: ['jenis', 'tipe', 'type'],
  category: ['kategori', 'category'],
  account: ['account', 'akun', 'rekening', 'bank'],
  description: ['deskripsi', 'keterangan', 'description', 'catatan', 'note', 'memo'],
  total: ['total', 'jumlah', 'nominal', 'amount', 'nilai', 'rp'],
};

const EXPENSE_WORDS = ['expense', 'exp', 'pengeluaran', 'keluar', 'out', 'debit'];
const INCOME_WORDS = ['income', 'inc', 'pemasukan', 'masuk', 'in', 'credit', 'kredit'];

/** Huruf kecil tanpa spasi/tanda baca: "Total (Rp)" → "totalrp". */
function norm(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '');
}

function matchField(header: unknown): Field | null {
  const n = norm(header);
  if (!n) return null;
  for (const field of Object.keys(FIELD_ALIASES) as Field[]) {
    if (FIELD_ALIASES[field].some((a) => n === a || n.startsWith(a))) return field;
  }
  return null;
}

type Columns = Partial<Record<Field, number>>;

function findHeader(data: Cell[][]): { row: number; columns: Columns } | null {
  const limit = Math.min(HEADER_SCAN_ROWS, data.length);
  for (let r = 0; r < limit; r++) {
    const columns: Columns = {};
    (data[r] ?? []).forEach((cell, c) => {
      const field = matchField(cell);
      if (field && columns[field] === undefined) columns[field] = c;
    });
    if (columns.date !== undefined && columns.total !== undefined) {
      return { row: r, columns };
    }
  }
  return null;
}

function typeFromSheetName(name: string): TxType | null {
  const n = norm(name);
  if (EXPENSE_WORDS.some((w) => w.length > 3 && n.includes(w))) return 'expense';
  if (INCOME_WORDS.some((w) => w.length > 3 && n.includes(w))) return 'income';
  return null;
}

function parseType(value: unknown): TxType | null {
  const n = norm(value);
  if (!n) return null;
  if (EXPENSE_WORDS.includes(n)) return 'expense';
  if (INCOME_WORDS.includes(n)) return 'income';
  return null;
}

function isEmptyCell(c: Cell): boolean {
  return c === null || c === undefined || (typeof c === 'string' && c.trim() === '');
}

/**
 * Tanggal dari sel Excel. Sel bertipe tanggal dibaca sebagai tengah malam UTC oleh library,
 * jadi komponen UTC yang dipakai (komponen lokal bisa bergeser sehari di zona waktu tertentu).
 * Teks "08/10/2026" dibaca sebagai hari/bulan/tahun, sesuai kebiasaan di Indonesia.
 */
export function parseDateCell(value: Cell): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return iso(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  if (typeof value === 'number') {
    // Nomor seri tanggal Excel (sel angka yang tidak diformat sebagai tanggal).
    if (value < 20000 || value > 80000) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  if (typeof value !== 'string') return null;

  // Teks "08/10/2026" dibaca hari/bulan/tahun, sesuai kebiasaan di Indonesia.
  return parseTextDate(value, { order: 'dmy' });
}

/** Angka dari sel: menerima 1500000, "1.500.000", "Rp 1.500.000", "1,500,000.50", dll. */
export function parseAmountCell(value: Cell): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  const s = value.trim().replace(/^rp\.?/i, '').replace(/\s/g, '');
  if (!/^-?[\d.,]+$/.test(s) || !/\d/.test(s)) return null;

  const negative = s.startsWith('-');
  const body = negative ? s.slice(1) : s;
  const lastDot = body.lastIndexOf('.');
  const lastComma = body.lastIndexOf(',');
  let normalized: string;

  if (lastDot > -1 && lastComma > -1) {
    // Pemisah yang muncul terakhir adalah desimal, yang lain pemisah ribuan.
    const decimal = lastDot > lastComma ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    normalized = body.split(thousands).join('').replace(decimal, '.');
  } else if (lastDot > -1 || lastComma > -1) {
    const sep = lastDot > -1 ? '.' : ',';
    const parts = body.split(sep);
    const looksLikeThousands =
      parts.length > 2 || (parts[1].length === 3 && parts[0].length >= 1 && parts[0].length <= 3 && parts[0] !== '0');
    normalized = looksLikeThousands ? parts.join('') : `${parts[0]}.${parts[1]}`;
  } else {
    normalized = body;
  }

  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

function canonical(value: string, list: string[]): string {
  const lower = value.toLowerCase();
  return list.find((item) => item.toLowerCase() === lower) ?? value;
}

function textOf(c: Cell): string {
  if (isEmptyCell(c)) return '';
  if (c instanceof Date) return parseDateCell(c) ?? '';
  return String(c).trim();
}

export function parseWorkbook(sheets: RawSheet[]): ParseResult {
  const rows: ImportRow[] = [];
  const issues: ImportIssue[] = [];
  let transferCount = 0;

  for (const { sheet, data } of sheets) {
    if (IGNORED_SHEETS.includes(norm(sheet))) continue;
    const sheetType = typeFromSheetName(sheet);
    let header = findHeader(data);
    let firstDataRow: number;

    if (header) {
      firstDataRow = header.row + 1;
    } else if (sheetType) {
      // Sheet bergaya Google Sheets lama tanpa header: kolom A–E = Tanggal, Kategori, Account, Deskripsi, Total.
      const first = data.find((r) => r.some((c) => !isEmptyCell(c)));
      if (first && parseDateCell(first[0]) !== null && parseAmountCell(first[4]) !== null) {
        header = { row: -1, columns: { date: 0, category: 1, account: 2, description: 3, total: 4 } };
        firstDataRow = 0;
      } else {
        issues.push({ sheet, line: 0, message: tr('importer.issue.noHeader') });
        continue;
      }
    } else {
      if (data.some((r) => r.some((c) => !isEmptyCell(c)))) {
        issues.push({ sheet, line: 0, message: tr('importer.issue.noHeader') });
      }
      continue;
    }

    const { columns } = header;
    if (columns.type === undefined && !sheetType) {
      issues.push({
        sheet,
        line: 0,
        message: tr('importer.issue.noTypeColumn'),
      });
      continue;
    }

    const get = (row: Cell[], field: Field): Cell => {
      const index = columns[field];
      return index === undefined ? undefined : row[index];
    };

    for (let r = firstDataRow; r < data.length; r++) {
      const raw = data[r] ?? [];
      if (raw.every(isEmptyCell)) continue;
      const line = r + 1;

      if (rows.length >= MAX_IMPORT_ROWS) {
        issues.push({ sheet, line: 0, message: tr('importer.issue.maxRows', { max: MAX_IMPORT_ROWS }) });
        return { rows, issues, transferCount };
      }

      const date = parseDateCell(get(raw, 'date'));
      if (!date) {
        issues.push({ sheet, line, message: tr('importer.issue.badDate', { value: textOf(get(raw, 'date')) }) });
        continue;
      }

      const amount = parseAmountCell(get(raw, 'total'));
      if (amount === null) {
        issues.push({ sheet, line, message: tr('importer.issue.badTotal', { value: textOf(get(raw, 'total')) }) });
        continue;
      }
      const total = Math.round(amount);
      if (total <= 0) {
        issues.push({ sheet, line, message: tr('importer.issue.totalNotPositive') });
        continue;
      }
      if (total > 1e12) {
        issues.push({ sheet, line, message: tr('importer.issue.totalTooLarge') });
        continue;
      }

      let type: TxType | null = sheetType;
      if (columns.type !== undefined) {
        const fromColumn = parseType(get(raw, 'type'));
        if (fromColumn) type = fromColumn;
        else if (!sheetType) {
          issues.push({ sheet, line, message: tr('importer.issue.badType', { value: textOf(get(raw, 'type')) }) });
          continue;
        }
      }
      if (!type) {
        issues.push({ sheet, line, message: tr('importer.issue.unknownType') });
        continue;
      }

      const categoryText = textOf(get(raw, 'category'));
      const account = canonicalAccount(textOf(get(raw, 'account')));
      const isTransfer = isTransferCategory(categoryText);
      if (isTransfer && !account) {
        // Tanpa rekening, transfer tidak punya efek ke saldo mana pun.
        issues.push({ sheet, line, message: tr('importer.issue.transferNeedsAccount') });
        continue;
      }
      const category = isTransfer
        ? TRANSFER_CATEGORY
        : categoryText
          ? canonical(categoryText, type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES)
          : 'Others';
      if (isTransfer) transferCount++;
      const description = textOf(get(raw, 'description')).slice(0, MAX_DESCRIPTION);

      rows.push({ line, sheet, payload: { date, type, category, account, description, total } });
    }
  }

  return { rows, issues, transferCount };
}

/** Kunci untuk mendeteksi transaksi yang sama persis. */
export function transactionKey(t: TransactionPayload | Transaction): string {
  return [
    t.date,
    t.type,
    t.category.trim().toLowerCase(),
    t.account.trim().toLowerCase(),
    t.description.trim().toLowerCase(),
    t.total,
  ].join('|');
}

/**
 * Pisahkan baris yang sudah ada di tujuan. Dihitung per jumlah kemunculan: kalau file berisi
 * dua kopi yang sama persis dan tujuan baru punya satu, hanya satu yang dianggap duplikat
 * (dua kopi di hari yang sama itu wajar).
 */
export function splitDuplicates(rows: ImportRow[], existing: Transaction[]) {
  const counts = new Map<string, number>();
  for (const tx of existing) {
    const key = transactionKey(tx);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const fresh: ImportRow[] = [];
  const duplicates: ImportRow[] = [];
  for (const row of rows) {
    const key = transactionKey(row.payload);
    const left = counts.get(key) ?? 0;
    if (left > 0) {
      counts.set(key, left - 1);
      duplicates.push(row);
    } else {
      fresh.push(row);
    }
  }
  return { fresh, duplicates };
}

export const rowKey = (r: ImportRow) => `${r.sheet}-${r.line}`;

const normText = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Keterangan dianggap serupa kalau sama setelah dirapikan, atau salah satunya memuat yang lain (minimal 4 huruf). */
export function similarText(a: string, b: string): boolean {
  const x = normText(a);
  const y = normText(b);
  if (x === y) return true;
  if (!x || !y) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 4 && long.includes(short);
}

/**
 * Baris yang tidak sama persis tapi mirip dengan transaksi yang sudah ada: tanggal, jenis, jumlah, dan
 * rekening sama, serta kategori sama atau keterangan serupa. Hasilnya hanya petunjuk untuk dicek
 * pengguna; dua pembelian yang sama di hari yang sama bisa saja memang berbeda.
 */
export function findSimilar(rows: ImportRow[], existing: Transaction[]): Map<string, Transaction> {
  const index = new Map<string, Transaction[]>();
  const keyOf = (t: TransactionPayload | Transaction) => [t.date, t.type, t.total, t.account.trim().toLowerCase()].join('|');
  for (const tx of existing) {
    const k = keyOf(tx);
    const list = index.get(k);
    if (list) list.push(tx);
    else index.set(k, [tx]);
  }
  const out = new Map<string, Transaction>();
  for (const row of rows) {
    const p = row.payload;
    const match = index.get(keyOf(p))?.find(
      (tx) => tx.category.trim().toLowerCase() === p.category.trim().toLowerCase() || similarText(tx.description, p.description),
    );
    if (match) out.set(rowKey(row), match);
  }
  return out;
}

/** Jumlah baris di dalam file itu sendiri yang kembar persis dengan baris sebelumnya. */
export function countFileTwins(rows: ImportRow[]): number {
  const seen = new Set<string>();
  let twins = 0;
  for (const r of rows) {
    const k = transactionKey(r.payload);
    if (seen.has(k)) twins++;
    else seen.add(k);
  }
  return twins;
}
