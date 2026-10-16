import { accountBalances } from './summary';
import { dueBy, endOfMonth, type Debt, type NextDue } from './debts';
import { dueDateIn, monthKey, monthlyNeed, type Goal, type Recurring } from './plans';
import { isNonSpendingCategory } from './categories';
import type { Transaction } from './transactions';

/**
 * Safe-to-Spend: uang yang masih aman dipakai sampai akhir bulan.
 *
 *   aman = saldo − tagihan bulan ini yang belum terbayar − dana target yang sudah dicadangkan − setoran target bulan ini
 *
 * Aturan anti hitung ganda:
 *  - Tagihan yang sudah dicatat (ditekan Catat, atau ada transaksi yang cocok) sudah mengurangi saldo, jadi tidak dikurangi lagi.
 *  - Tagihan yang dilewati bulan ini tidak dikurangi.
 *  - Cicilan utang yang jatuh tempo bulan ini dikurangi hanya sebesar yang belum dibayar menurut catatan utang. Pembayaran yang
 *    sudah dicatat (bahkan sebagian) tidak dikurangi lagi.
 *  - Pemasukan berulang tidak pernah ditambahkan (hanya yang sudah benar-benar tercatat yang ada di saldo).
 *  - Dana target (`saved`) dikurangi hanya kalau masih berada di saldo. Kalau pengguna sudah memindahkannya keluar
 *    (mis. dicatat sebagai transfer), saldo sudah turun, jadi `savedInBalance` = false dan tidak dikurangi lagi.
 *  - Setoran bulan ini dihitung dari sisa target, jadi otomatis mengecil saat dana ditambah.
 */

export interface SafeSettings {
  /** Selisih saldo sebenarnya terhadap saldo catatan (mis. saldo awal yang belum dicatat). */
  adjust: number;
  savedInBalance: boolean;
}

export const DEFAULT_SAFE_SETTINGS: SafeSettings = { adjust: 0, savedInBalance: true };

export interface SafeBill {
  rule: Recurring;
  date: string;
  overdue: boolean;
}

export interface SafeDebtItem {
  debt: Debt;
  due: NextDue;
}

export interface SafeGoalItem {
  id: string;
  name: string;
  reserved: number;
  need: number;
}

export type SafeNotReady = 'noAccounts' | 'noData';

export interface SafeResult {
  ready: boolean;
  reason?: SafeNotReady;
  /** Saldo rekening yang dipakai (sudah termasuk penyesuaian). */
  balance: number;
  adjust: number;
  bills: SafeBill[];
  billsTotal: number;
  /** Tagihan yang sudah ada transaksinya tetapi belum ditandai: tidak dikurangi lagi. */
  paidMatched: number;
  debts: SafeDebtItem[];
  debtTotal: number;
  goalItems: SafeGoalItem[];
  reservedTotal: number;
  needTotal: number;
  safe: number;
  daysLeft: number;
  perDay: number;
}

export interface SafeInput {
  transactions: Transaction[];
  accounts: string[];
  rules: Recurring[];
  goals: Goal[];
  debts?: Debt[];
  today: string;
  settings?: SafeSettings;
}

function daysLeftIn(today: string): number {
  const [y, m, d] = today.split('-').map(Number);
  return new Date(y, m, 0).getDate() - d + 1;
}

export function computeSafeToSpend(input: SafeInput): SafeResult {
  const { transactions, accounts, rules, goals, today } = input;
  const settings = input.settings ?? DEFAULT_SAFE_SETTINGS;
  const ym = monthKey(today);
  const empty: SafeResult = {
    ready: false, balance: 0, adjust: settings.adjust, bills: [], billsTotal: 0, paidMatched: 0, debts: [], debtTotal: 0, goalItems: [],
    reservedTotal: 0, needTotal: 0, safe: 0, daysLeft: daysLeftIn(today), perDay: 0,
  };
  if (!accounts.length) return { ...empty, reason: 'noAccounts' };
  if (!transactions.length && settings.adjust === 0) return { ...empty, reason: 'noData' };

  const balance = accountBalances(transactions, accounts).reduce((s, a) => s + a.balance, 0) + settings.adjust;

  // Tagihan bulan ini yang belum selesai. Transaksi bulan ini yang cocok (jenis, rekening, nominal) dianggap sudah membayar.
  const pool = transactions.filter(
    (t) => t.type === 'expense' && t.date.slice(0, 7) === ym && !isNonSpendingCategory(t.category),
  );
  const used = new Set<string>();
  const bills: SafeBill[] = [];
  let paidMatched = 0;
  const pending = rules
    .filter((r) => r.type === 'expense' && r.lastDone !== ym)
    .map((rule) => ({ rule, date: dueDateIn(rule.day, ym) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const { rule, date } of pending) {
    const hit = pool.find(
      (t) => !used.has(t.id) && t.total === rule.total && t.account === rule.account && t.category === rule.category,
    );
    if (hit) {
      used.add(hit.id);
      paidMatched++;
      continue;
    }
    bills.push({ rule, date, overdue: date < today });
  }
  const billsTotal = bills.reduce((s, b) => s + b.rule.total, 0);

  const debts = dueBy(input.debts ?? [], today, endOfMonth(today));
  const debtTotal = debts.reduce((s, x) => s + x.due.amount, 0);

  const goalItems: SafeGoalItem[] = goals.map((g) => ({
    id: g.id,
    name: g.name,
    reserved: settings.savedInBalance ? g.saved : 0,
    need: monthlyNeed(g, today) ?? 0,
  }));
  const reservedTotal = goalItems.reduce((s, g) => s + g.reserved, 0);
  const needTotal = goalItems.reduce((s, g) => s + g.need, 0);

  const safe = balance - billsTotal - debtTotal - reservedTotal - needTotal;
  const daysLeft = daysLeftIn(today);
  return {
    ready: true, balance, adjust: settings.adjust, bills, billsTotal, paidMatched, debts, debtTotal, goalItems,
    reservedTotal, needTotal, safe, daysLeft, perDay: safe > 0 ? Math.floor(safe / daysLeft) : 0,
  };
}
