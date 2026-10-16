import { isNonSpendingCategory } from './categories';
import { budgetStatus, monthOf, monthReport, percentChange, shiftMonth, type Month } from './report';
import type { Transaction } from './transactions';

export type InsightTone = 'bad' | 'warn' | 'good' | 'info';

export interface Insight {
  /** Kunci unik; juga menentukan teks (`insight.<kind>`). */
  id: string;
  kind: string;
  tone: InsightTone;
  /** Nilai untuk teks. Kunci berawalan `rp` adalah nominal rupiah (diformat di tampilan). */
  params: Record<string, string | number>;
}

export interface InsightOptions {
  /** Anggaran bulanan per kategori. */
  budgets: Record<string, number>;
  /** Batas pengeluaran harian. */
  dailyLimit: number;
  now?: Date;
}

/** Kenaikan kategori baru dianggap berarti kalau sekurang-kurangnya sebesar ini (persen dan rupiah). */
export const SHIFT_MIN_PERCENT = 30;
export const SHIFT_MIN_AMOUNT = 50_000;
/** Perubahan total pengeluaran di bawah ini dianggap "sama saja". */
export const FLAT_PERCENT = 5;
/** Proyeksi akhir bulan baru ditampilkan setelah sekian hari berjalan. */
export const PROJECTION_MIN_DAYS = 7;
export const SAVINGS_GOAL_PERCENT = 20;

const TONE_ORDER: Record<InsightTone, number> = { bad: 0, warn: 1, good: 2, info: 3 };

function expensesByCategory(transactions: Transaction[], month: Month, upToDay: number | null): Map<string, number> {
  const out = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.date || isNonSpendingCategory(tx.category) || monthOf(tx.date) !== month) continue;
    if (upToDay !== null && Number(tx.date.slice(8, 10)) > upToDay) continue;
    out.set(tx.category, (out.get(tx.category) ?? 0) + tx.total);
  }
  return out;
}

const sum = (m: Map<string, number>) => Array.from(m.values()).reduce((a, b) => a + b, 0);

/**
 * Wawasan keuangan untuk satu bulan, murni berdasarkan aturan di atas (tanpa tebakan).
 * Untuk bulan berjalan, pembandingnya adalah bulan lalu sampai tanggal yang sama, supaya
 * bulan yang baru separuh jalan tidak dibandingkan dengan bulan penuh.
 */
export function buildInsights(transactions: Transaction[], month: Month, opts: InsightOptions): Insight[] {
  const now = opts.now ?? new Date();
  const report = monthReport(transactions, month, now);
  const out: Insight[] = [];
  const add = (kind: string, tone: InsightTone, params: Insight['params'] = {}, suffix = '') =>
    out.push({ id: kind + suffix, kind, tone, params });

  if (report.count === 0) {
    add('noData', 'info');
    return out;
  }

  const [y, m] = month.split('-').map(Number);
  const isCurrent = now.getFullYear() === y && now.getMonth() + 1 === m;
  const daysInMonth = new Date(y, m, 0).getDate();
  const day = isCurrent ? now.getDate() : null;

  const prevMonth = shiftMonth(month, -1);
  const cur = expensesByCategory(transactions, month, null);
  const prev = expensesByCategory(transactions, prevMonth, day);
  const prevTotal = sum(prev);
  const scope = day === null ? 'full' : 'partial';

  // 1. Total pengeluaran dibanding bulan sebelumnya.
  if (report.expense > 0 && prevTotal > 0) {
    const pct = percentChange(report.expense, prevTotal) ?? 0;
    const params = { pct: Math.abs(pct), rpNow: report.expense, rpPrev: prevTotal, scope, day: day ?? 0 };
    if (Math.abs(pct) < FLAT_PERCENT) add('spendFlat', 'info', params);
    else if (pct > 0) add('spendUp', 'warn', params);
    else add('spendDown', 'good', params);
  }

  // 2. Kategori terbesar.
  if (report.categories.length) {
    const top = report.categories[0];
    add('topCategory', 'info', {
      category: top.category,
      rpAmount: top.total,
      pct: Math.round((top.total / report.expense) * 100),
    });
  }

  // 3. Anggaran per kategori.
  for (const { category, total } of report.categories) {
    const budget = opts.budgets[category];
    const status = budgetStatus(total, budget);
    if (status === 'over') add('budgetOver', 'bad', { category, rpOver: total - budget, rpBudget: budget }, ':' + category);
    else if (status === 'warn') add('budgetNear', 'warn', { category, pct: Math.round((total / budget) * 100), rpLeft: budget - total }, ':' + category);
  }

  // 4. Sisa pemasukan.
  if (report.savingsRate !== null) {
    const pct = report.savingsRate;
    if (pct < 0) add('savingsNegative', 'bad', { rpOver: report.expense - report.income });
    else if (pct >= SAVINGS_GOAL_PERCENT) add('savingsGood', 'good', { pct });
    else {
      add('savingsLow', 'warn', { pct });
      add('recSave', 'info', { rpTarget: Math.round((report.income * SAVINGS_GOAL_PERCENT) / 100), goal: SAVINGS_GOAL_PERCENT });
    }
  }

  // 5. Perubahan pola: kategori dengan kenaikan dan penurunan terbesar (dalam rupiah).
  let rise: { category: string; now: number; before: number } | null = null;
  let drop: { category: string; now: number; before: number } | null = null;
  for (const category of new Set([...cur.keys(), ...prev.keys()])) {
    const now1 = cur.get(category) ?? 0;
    const before = prev.get(category) ?? 0;
    const diff = now1 - before;
    if (before > 0 && diff >= SHIFT_MIN_AMOUNT && (diff / before) * 100 >= SHIFT_MIN_PERCENT && (!rise || diff > rise.now - rise.before)) {
      rise = { category, now: now1, before };
    }
    if (before > 0 && -diff >= SHIFT_MIN_AMOUNT && (-diff / before) * 100 >= SHIFT_MIN_PERCENT && (!drop || -diff > drop.before - drop.now)) {
      drop = { category, now: now1, before };
    }
  }
  if (rise) {
    add('categoryUp', 'warn', {
      category: rise.category, pct: Math.round(((rise.now - rise.before) / rise.before) * 100), rpNow: rise.now, rpPrev: rise.before, scope, day: day ?? 0,
    });
  }
  if (drop) {
    add('categoryDown', 'good', {
      category: drop.category, pct: Math.round(((drop.before - drop.now) / drop.before) * 100), rpNow: drop.now, rpPrev: drop.before, scope, day: day ?? 0,
    });
  }

  // 6. Rekomendasi sederhana.
  if (report.categories.length) {
    const top = report.categories[0].category;
    if (opts.budgets[top] === undefined) add('recBudget', 'info', { category: top });
  }
  if (report.averagePerDay > opts.dailyLimit && opts.dailyLimit > 0) {
    add('recDaily', 'warn', {
      rpAvg: report.averagePerDay, rpLimit: opts.dailyLimit, category: report.categories[0]?.category ?? '',
    });
  }
  if (isCurrent && now.getDate() >= PROJECTION_MIN_DAYS && report.expense > 0) {
    const projected = Math.round(report.averagePerDay * daysInMonth);
    if (report.income > 0 && projected > report.income) add('projectionOver', 'warn', { rpProjected: projected, rpIncome: report.income });
    else add('projection', 'info', { rpProjected: projected });
  }

  return out.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}
