import { isNonSpendingCategory } from './categories';
import { shiftMonth } from './report';
import { dueDateIn, monthKey, type Goal, type Recurring } from './plans';
import type { Transaction } from './transactions';

/**
 * Status transaksi terjadwal di kalender. Semuanya proyeksi, bukan transaksi:
 * - handled: sudah dicatat atau dilewati bulan ini (bulan berjalan saja)
 * - due: tanggalnya sudah tiba (atau lewat) dan belum diselesaikan
 * - upcoming: belum jatuh tempo
 */
export type ScheduledStatus = 'handled' | 'due' | 'upcoming';

export interface ScheduledItem {
  rule: Recurring;
  status: ScheduledStatus;
}

export interface DayData {
  date: string;
  /** Transaksi sungguhan (tanpa transfer). */
  actual: Transaction[];
  income: number;
  expense: number;
  scheduled: ScheduledItem[];
  /** Target yang tenggatnya hari ini. */
  goals: Goal[];
}

export interface MonthCalendar {
  month: string;
  days: Map<string, DayData>;
  /** Total transaksi sungguhan bulan ini. */
  actualIncome: number;
  actualExpense: number;
  /** Total terjadwal yang masih belum terjadi (due + upcoming). Proyeksi saja. */
  scheduledIncome: number;
  scheduledExpense: number;
  /** Jumlah terjadwal yang sudah jatuh tempo tapi belum diselesaikan. */
  unfinished: number;
}

/** Sel kalender sebulan, minggu mulai Senin. null = sel kosong di luar bulan. */
export function monthGrid(month: string): (string | null)[][] {
  const [y, m] = month.split('-').map(Number);
  const first = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const total = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = Array(first).fill(null);
  for (let d = 1; d <= total; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function buildCalendar(
  transactions: Transaction[], rules: Recurring[], goals: Goal[], month: string, today: string,
): MonthCalendar {
  const days = new Map<string, DayData>();
  const day = (date: string): DayData => {
    let d = days.get(date);
    if (!d) {
      d = { date, actual: [], income: 0, expense: 0, scheduled: [], goals: [] };
      days.set(date, d);
    }
    return d;
  };

  let actualIncome = 0;
  let actualExpense = 0;
  for (const tx of transactions) {
    if (!tx.date || isNonSpendingCategory(tx.category) || monthKey(tx.date) !== month) continue;
    const d = day(tx.date);
    d.actual.push(tx);
    if (tx.type === 'income') {
      d.income += tx.total;
      actualIncome += tx.total;
    } else {
      d.expense += tx.total;
      actualExpense += tx.total;
    }
  }

  let scheduledIncome = 0;
  let scheduledExpense = 0;
  let unfinished = 0;
  const thisMonth = monthKey(today);
  // Bulan yang sudah lewat tidak diproyeksikan: riwayatnya hanya transaksi sungguhan.
  if (month >= thisMonth) {
    for (const rule of rules) {
      const date = dueDateIn(rule.day, month);
      let status: ScheduledStatus;
      if (month === thisMonth) {
        status = rule.lastDone === month ? 'handled' : date <= today ? 'due' : 'upcoming';
      } else {
        status = 'upcoming';
      }
      day(date).scheduled.push({ rule, status });
      if (status !== 'handled') {
        if (rule.type === 'income') scheduledIncome += rule.total;
        else scheduledExpense += rule.total;
      }
      if (status === 'due') unfinished++;
    }
  }

  for (const g of goals) {
    if (g.deadline && monthKey(g.deadline) === month) day(g.deadline).goals.push(g);
  }

  return { month, days, actualIncome, actualExpense, scheduledIncome, scheduledExpense, unfinished };
}

/** Kemunculan berikutnya sebuah aturan: bulan ini kalau belum diselesaikan, kalau sudah maka bulan depan. */
function nextDate(rule: Recurring, today: string): string {
  const ym = monthKey(today);
  return dueDateIn(rule.day, rule.lastDone === ym ? shiftMonth(ym, 1) : ym);
}

/** Tagihan (pengeluaran berulang) berikutnya dalam `withinDays` hari ke depan, termasuk awal bulan depan. Yang sudah lewat dan belum diselesaikan tidak termasuk (itu "jatuh tempo"). */
export function upcomingBills(rules: Recurring[], today: string, withinDays = 7): { rule: Recurring; date: string; inDays: number }[] {
  const [y, m, d] = today.split('-').map(Number);
  const start = Date.UTC(y, m - 1, d);
  const out: { rule: Recurring; date: string; inDays: number }[] = [];
  for (const rule of rules) {
    if (rule.type !== 'expense') continue;
    const date = nextDate(rule, today);
    if (date < today) continue;
    const [yy, mm, dd] = date.split('-').map(Number);
    const inDays = Math.round((Date.UTC(yy, mm - 1, dd) - start) / 86_400_000);
    if (inDays <= withinDays) out.push({ rule, date, inDays });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
