import { monthOf } from './report';
import type { Transaction } from './transactions';

export type TypeFilter = 'all' | 'expense' | 'income';

export interface TxFilter {
  type: TypeFilter;
  account: string;
  /** yyyy-MM, atau kosong. */
  month: string;
  category: string;
  query: string;
  /** Rentang tanggal (yyyy-MM-dd), batas kedua ujung ikut. Kosong = tanpa batas. */
  from: string;
  to: string;
  /** Rentang nominal (Rp), batas kedua ujung ikut. null = tanpa batas. */
  min: number | null;
  max: number | null;
  /** Hanya pengeluaran di kategori yang total bulannya melewati anggaran. */
  overBudget: boolean;
  /** Hanya transaksi tanpa deskripsi. */
  noDescription: boolean;
}

export const EMPTY_FILTER: TxFilter = {
  type: 'all', account: '', month: '', category: '', query: '', from: '', to: '',
  min: null, max: null, overBudget: false, noDescription: false,
};

/** Jumlah filter lanjutan yang aktif (di luar jenis, rekening, bulan, kategori, dan pencarian). */
export function advancedCount(f: TxFilter): number {
  return [f.from, f.to].filter(Boolean).length + (f.min !== null ? 1 : 0) + (f.max !== null ? 1 : 0) + (f.overBudget ? 1 : 0) + (f.noDescription ? 1 : 0);
}

export function hasAnyFilter(f: TxFilter): boolean {
  return f.type !== 'all' || f.account !== '' || f.month !== '' || f.category !== '' || f.query.trim() !== '' || advancedCount(f) > 0;
}

/** Rentang yang mustahil: tanggal awal setelah tanggal akhir, atau nominal minimum di atas maksimum. */
export function rangeProblem(f: TxFilter): 'date' | 'amount' | null {
  if (f.from && f.to && f.from > f.to) return 'date';
  if (f.min !== null && f.max !== null && f.min > f.max) return 'amount';
  return null;
}

/**
 * Id transaksi pengeluaran pada kategori yang total bulannya melewati anggaran.
 * Dikelompokkan per (bulan, kategori) dengan anggaran bulanan kategori itu.
 */
export function overBudgetIds(transactions: Transaction[], budgets: Record<string, number>): Set<string> {
  const totals = new Map<string, number>();
  const keyOf = (tx: Transaction) => `${monthOf(tx.date)}|${tx.category}`;
  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.date || !(budgets[tx.category] > 0)) continue;
    totals.set(keyOf(tx), (totals.get(keyOf(tx)) ?? 0) + tx.total);
  }
  const ids = new Set<string>();
  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.date || !(budgets[tx.category] > 0)) continue;
    if ((totals.get(keyOf(tx)) ?? 0) > budgets[tx.category]) ids.add(tx.id + tx.type);
  }
  return ids;
}

export const txKey = (tx: Transaction) => tx.id + tx.type;

export function applyFilter(transactions: Transaction[], f: TxFilter, budgets: Record<string, number>): Transaction[] {
  const q = f.query.trim().toLowerCase();
  const over = f.overBudget ? overBudgetIds(transactions, budgets) : null;
  const dated = f.from !== '' || f.to !== '' || f.month !== '';
  return transactions.filter((tx) => {
    if (f.type !== 'all' && tx.type !== f.type) return false;
    if (f.account && tx.account !== f.account) return false;
    if (f.category && tx.category !== f.category) return false;
    if (dated && !tx.date) return false; // tanggal tak terbaca tidak bisa dicocokkan dengan filter tanggal
    if (f.month && monthOf(tx.date) !== f.month) return false;
    if (f.from && tx.date < f.from) return false;
    if (f.to && tx.date > f.to) return false;
    if (f.min !== null && tx.total < f.min) return false;
    if (f.max !== null && tx.total > f.max) return false;
    if (f.noDescription && tx.description.trim() !== '') return false;
    if (over && !over.has(txKey(tx))) return false;
    if (q && !`${tx.description} ${tx.category}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

// ---- Kombinasi filter yang disimpan ----

export interface SavedFilter {
  id: string;
  name: string;
  filter: TxFilter;
}

export const MAX_SAVED_FILTERS = 12;
export const MAX_FILTER_NAME = 40;

function cleanFilter(v: unknown): TxFilter | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const str = (x: unknown) => (typeof x === 'string' ? x : '');
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : null);
  const type = o.type === 'expense' || o.type === 'income' ? o.type : 'all';
  return {
    type, account: str(o.account), month: /^\d{4}-\d{2}$/.test(str(o.month)) ? str(o.month) : '',
    category: str(o.category), query: str(o.query),
    from: /^\d{4}-\d{2}-\d{2}$/.test(str(o.from)) ? str(o.from) : '',
    to: /^\d{4}-\d{2}-\d{2}$/.test(str(o.to)) ? str(o.to) : '',
    min: num(o.min), max: num(o.max), overBudget: o.overBudget === true, noDescription: o.noDescription === true,
  };
}

export function cleanSavedFilters(value: unknown): SavedFilter[] {
  if (!Array.isArray(value)) return [];
  const out: SavedFilter[] = [];
  for (const v of value) {
    if (!v || typeof v !== 'object') continue;
    const o = v as Record<string, unknown>;
    const filter = cleanFilter(o.filter);
    if (typeof o.id === 'string' && typeof o.name === 'string' && o.name.trim() && filter) {
      out.push({ id: o.id, name: o.name.trim().slice(0, MAX_FILTER_NAME), filter });
    }
  }
  return out.slice(0, MAX_SAVED_FILTERS);
}

/**
 * Siapkan filter tersimpan untuk dipakai: pilihan yang sudah tidak ada (rekening dihapus, bulan atau
 * kategori tanpa data) dikosongkan supaya tidak ada filter "tersembunyi" yang membuat daftar kosong.
 */
export function sanitizeForUse(f: TxFilter, available: { accounts: string[]; months: string[]; categories: string[] }): TxFilter {
  return {
    ...f,
    account: available.accounts.includes(f.account) ? f.account : '',
    month: available.months.includes(f.month) ? f.month : '',
    category: available.categories.includes(f.category) ? f.category : '',
  };
}
