import { ACCOUNT_CATALOG, isCreditAccount, isNonSpendingCategory } from './categories';
import { toLocalISO } from './date';
import type { Transaction } from './transactions';

export interface Stats {
  /** Total pengeluaran, tanpa transfer. */
  totalExpense: number;
  /** Total pemasukan, tanpa transfer. */
  totalIncome: number;
  /** Saldo semua rekening: pemasukan − pengeluaran, termasuk transfer (mis. biaya admin yang ikut terpotong). */
  balance: number;
  todayExpense: number;
  monthBalance: number;
}

export function computeStats(transactions: Transaction[], now = new Date()): Stats {
  const today = toLocalISO(now);
  const month = today.slice(0, 7);

  let totalExpense = 0;
  let totalIncome = 0;
  let todayExpense = 0;
  let monthBalance = 0;
  let balance = 0;

  for (const tx of transactions) {
    // Pembelian dengan utang (rekening KREDIT) belum mengeluarkan uang, jadi tidak mengurangi saldo.
    if (!isCreditAccount(tx.account)) balance += tx.type === 'income' ? tx.total : -tx.total;
    if (isNonSpendingCategory(tx.category)) continue;
    if (tx.type === 'expense') {
      totalExpense += tx.total;
      if (tx.date === today) todayExpense += tx.total;
    } else {
      totalIncome += tx.total;
    }
    if (tx.date.slice(0, 7) === month) {
      monthBalance += tx.type === 'income' ? tx.total : -tx.total;
    }
  }

  return { totalExpense, totalIncome, balance, todayExpense, monthBalance };
}

export interface AccountBalance {
  account: string;
  balance: number;
}

/**
 * Saldo bersih per rekening dari transaksi yang tercatat (tanpa saldo awal), hanya untuk rekening yang
 * dipilih pengguna (urut sesuai katalog). Rekening yang tidak dipilih tidak tampil sama sekali, walaupun
 * masih punya transaksi di data. Transaksinya tetap ada di daftar dan tetap dihitung di saldo bersih.
 */
export function accountBalances(transactions: Transaction[], selected: string[]): AccountBalance[] {
  const order = ACCOUNT_CATALOG.map((a) => a.name);
  const map = new Map<string, number>(selected.map((a): [string, number] => [a, 0]));
  for (const tx of transactions) {
    if (!map.has(tx.account)) continue;
    map.set(tx.account, (map.get(tx.account) ?? 0) + (tx.type === 'income' ? tx.total : -tx.total));
  }
  const rank = (name: string) => {
    const i = order.indexOf(name);
    return i === -1 ? order.length : i;
  };
  return Array.from(map, ([account, balance]) => ({ account, balance })).sort(
    (a, b) => rank(a.account) - rank(b.account) || a.account.localeCompare(b.account),
  );
}

export interface DayTotal {
  date: string;
  day: number;
  total: number;
  isToday: boolean;
}

/** Total pengeluaran per hari untuk N hari terakhir . */
export function dailyExpenses(transactions: Transaction[], days = 14, now = new Date()): DayTotal[] {
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== 'expense' || isNonSpendingCategory(tx.category)) continue;
    totals.set(tx.date, (totals.get(tx.date) ?? 0) + tx.total);
  }

  const result: DayTotal[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const iso = toLocalISO(d);
    result.push({ date: iso, day: d.getDate(), total: totals.get(iso) ?? 0, isToday: i === 0 });
  }
  return result;
}
