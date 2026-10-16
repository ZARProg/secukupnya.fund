import { isNonSpendingCategory } from './categories';
import type { Transaction } from './transactions';
import { locale } from '@/i18n';

/** Bulan dalam format yyyy-MM. */
export type Month = string;

export const monthOf = (isoDate: string): Month => isoDate.slice(0, 7);

/** Geser bulan: shiftMonth('2026-01', -1) = '2025-12'. */
export function shiftMonth(month: Month, delta: number): Month {
  const [y, m] = month.split('-').map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export function monthLabel(month: Month, style: 'long' | 'short' = 'long'): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale(), {
    month: style === 'long' ? 'long' : 'short',
    ...(style === 'long' ? { year: 'numeric' as const } : {}),
  });
}

/** Daftar bulan yang punya transaksi (tanpa transfer dan tanggal tak terbaca), terbaru dulu. */
export function monthsWithData(transactions: Transaction[]): Month[] {
  const set = new Set<Month>();
  for (const tx of transactions) {
    if (!tx.date || isNonSpendingCategory(tx.category)) continue;
    set.add(monthOf(tx.date));
  }
  return Array.from(set).sort().reverse();
}

export interface CategoryTotal {
  category: string;
  total: number;
}

export interface MonthReport {
  month: Month;
  income: number;
  expense: number;
  /** Pemasukan − pengeluaran. */
  net: number;
  /** Bagian pemasukan yang tidak terpakai (0–100+), null kalau tidak ada pemasukan. */
  savingsRate: number | null;
  count: number;
  /** Per kategori pengeluaran, terbesar dulu. */
  categories: CategoryTotal[];
  /** Pengeluaran terbesar, terbesar dulu (maksimal 5). */
  topExpenses: Transaction[];
  /** Rata-rata pengeluaran per hari; bulan berjalan dihitung sampai hari ini. */
  averagePerDay: number;
  /** Hari dengan pengeluaran terbesar. */
  peakDay: { date: string; total: number } | null;
}

export function monthReport(transactions: Transaction[], month: Month, now = new Date()): MonthReport {
  let income = 0;
  let expense = 0;
  let count = 0;
  const cats = new Map<string, number>();
  const days = new Map<string, number>();
  const expenses: Transaction[] = [];

  for (const tx of transactions) {
    if (!tx.date || monthOf(tx.date) !== month || isNonSpendingCategory(tx.category)) continue;
    count++;
    if (tx.type === 'income') {
      income += tx.total;
    } else {
      expense += tx.total;
      cats.set(tx.category, (cats.get(tx.category) ?? 0) + tx.total);
      days.set(tx.date, (days.get(tx.date) ?? 0) + tx.total);
      expenses.push(tx);
    }
  }

  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const isCurrent = now.getFullYear() === y && now.getMonth() + 1 === m;
  const elapsed = isCurrent ? now.getDate() : daysInMonth;

  let peakDay: MonthReport['peakDay'] = null;
  for (const [date, total] of days) if (!peakDay || total > peakDay.total) peakDay = { date, total };

  return {
    month,
    income,
    expense,
    net: income - expense,
    savingsRate: income > 0 ? Math.round(((income - expense) / income) * 100) : null,
    count,
    categories: Array.from(cats, ([category, total]) => ({ category, total })).sort(
      (a, b) => b.total - a.total || a.category.localeCompare(b.category),
    ),
    topExpenses: expenses.sort((a, b) => b.total - a.total || b.date.localeCompare(a.date)).slice(0, 5),
    averagePerDay: Math.round(expense / elapsed),
    peakDay,
  };
}

/** Perubahan dalam persen dari `previous` ke `current`; null kalau tidak ada pembanding (previous = 0). */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export interface TrendPoint {
  month: Month;
  income: number;
  expense: number;
}

/** Pemasukan dan pengeluaran per bulan untuk `count` bulan yang berakhir di `endMonth`. */
export function monthlyTrend(transactions: Transaction[], endMonth: Month, count = 6): TrendPoint[] {
  const points = new Map<Month, TrendPoint>();
  for (let i = count - 1; i >= 0; i--) {
    const month = shiftMonth(endMonth, -i);
    points.set(month, { month, income: 0, expense: 0 });
  }
  for (const tx of transactions) {
    if (!tx.date || isNonSpendingCategory(tx.category)) continue;
    const point = points.get(monthOf(tx.date));
    if (!point) continue;
    if (tx.type === 'income') point.income += tx.total;
    else point.expense += tx.total;
  }
  return Array.from(points.values());
}

export type BudgetStatus = 'none' | 'ok' | 'warn' | 'over';

/** ok < 80% ≤ warn ≤ 100% < over. */
export function budgetStatus(spent: number, budget: number | undefined): BudgetStatus {
  if (!budget || budget <= 0) return 'none';
  const ratio = spent / budget;
  if (ratio > 1) return 'over';
  if (ratio >= 0.8) return 'warn';
  return 'ok';
}
