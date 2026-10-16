import { isNonSpendingCategory } from './categories';
import { addDays, dayMap } from './engage';
import { shiftMonth } from './report';
import { parseISODate, toLocalISO } from './date';
import type { Transaction } from './transactions';

export type RecapKind = 'week' | 'month';

export interface Range {
  kind: RecapKind;
  from: string;
  to: string;
  /** yyyy-MM untuk bulanan. */
  month?: string;
}

function monday(iso: string): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toLocalISO(d);
}

/** Rentang (minggu Senin-Minggu atau satu bulan kalender) yang memuat tanggal `anchor`. */
export function rangeFor(kind: RecapKind, anchor: string): Range {
  if (kind === 'week') {
    const from = monday(anchor);
    return { kind, from, to: addDays(from, 6) };
  }
  const month = anchor.slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  return { kind, from: `${month}-01`, to: `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`, month };
}

export function shiftRange(r: Range, delta: number): Range {
  if (r.kind === 'week') {
    const from = addDays(r.from, 7 * delta);
    return { kind: 'week', from, to: addDays(from, 6) };
  }
  return rangeFor('month', `${shiftMonth(r.month as string, delta)}-01`);
}

export interface RecapCategory {
  category: string;
  total: number;
  /** Persen dari total pengeluaran (0-100, dibulatkan). */
  share: number;
}

export interface RecapData {
  range: Range;
  /** Jumlah hari yang sudah berjalan di rentang ini (penuh untuk rentang yang sudah lewat). */
  elapsed: number;
  partial: boolean;
  expense: number;
  income: number;
  net: number;
  /** (pemasukan − pengeluaran) / pemasukan, persen; null kalau tidak ada pemasukan. */
  savingsRate: number | null;
  /** Perubahan pengeluaran dibanding periode sebelumnya pada jumlah hari yang sama; null kalau tidak ada pembanding. */
  change: number | null;
  prevExpense: number;
  categories: RecapCategory[];
  loggedDays: number;
  /** Hari tercatat yang pengeluarannya tidak melewati batas harian. */
  underLimitDays: number;
  hasData: boolean;
}

function sumRange(transactions: Transaction[], from: string, to: string) {
  let expense = 0;
  let income = 0;
  const cats = new Map<string, number>();
  for (const tx of transactions) {
    if (!tx.date || tx.date < from || tx.date > to || isNonSpendingCategory(tx.category)) continue;
    if (tx.type === 'income') {
      income += tx.total;
    } else {
      expense += tx.total;
      cats.set(tx.category, (cats.get(tx.category) ?? 0) + tx.total);
    }
  }
  return { expense, income, cats };
}

export function buildRecap(transactions: Transaction[], range: Range, today: string, limit: number): RecapData {
  const last = range.to < today ? range.to : today;
  const partial = range.to >= today && range.from <= today;
  const future = range.from > today;
  const to = future ? addDays(range.from, -1) : last;
  const elapsed = future ? 0 : Math.round((parseISODate(to).getTime() - parseISODate(range.from).getTime()) / 86_400_000) + 1;

  const cur = sumRange(transactions, range.from, to);
  const prevRange = shiftRange(range, -1);
  const prevTo = elapsed > 0 ? addDays(prevRange.from, Math.min(elapsed, daysIn(prevRange)) - 1) : prevRange.from;
  const prev = elapsed > 0 ? sumRange(transactions, prevRange.from, prevTo) : { expense: 0, income: 0 };

  const days = dayMap(transactions);
  let loggedDays = 0;
  let underLimitDays = 0;
  for (let d = range.from; d <= to && elapsed > 0; d = addDays(d, 1)) {
    const info = days.get(d);
    if (!info?.logged) continue;
    loggedDays++;
    if (limit > 0 && info.expense <= limit) underLimitDays++;
  }

  const categories = Array.from(cur.cats, ([category, total]) => ({
    category, total, share: cur.expense > 0 ? Math.round((total / cur.expense) * 100) : 0,
  })).sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));

  return {
    range, elapsed, partial, expense: cur.expense, income: cur.income, net: cur.income - cur.expense,
    savingsRate: cur.income > 0 ? Math.round(((cur.income - cur.expense) / cur.income) * 100) : null,
    change: prev.expense > 0 ? Math.round(((cur.expense - prev.expense) / prev.expense) * 100) : null,
    prevExpense: prev.expense,
    categories, loggedDays, underLimitDays,
    hasData: cur.expense > 0 || cur.income > 0,
  };
}

function daysIn(r: Range): number {
  return Math.round((parseISODate(r.to).getTime() - parseISODate(r.from).getTime()) / 86_400_000) + 1;
}

export function rangeDays(r: Range): number {
  return daysIn(r);
}
