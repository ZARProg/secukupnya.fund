import { parseISODate } from '@/lib/date';

export const MAX_AMOUNT = 1_000_000_000_000;

export interface Recurring {
  id: string;
  type: 'expense' | 'income';
  description: string;
  category: string;
  account: string;
  total: number;
  /** Tanggal jatuh tempo tiap bulan (1-31). Di bulan yang lebih pendek dipakai hari terakhir bulan itu. */
  day: number;
  /** Bulan (yyyy-MM) terakhir yang sudah dicatat atau dilewati; kosong kalau belum pernah. */
  lastDone: string;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  /** yyyy-MM-dd, atau kosong kalau tanpa tenggat. */
  deadline: string;
}

const MONTH = /^\d{4}-\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isMoney(n: unknown, allowZero = false): n is number {
  return typeof n === 'number' && Number.isInteger(n) && (allowZero ? n >= 0 : n > 0) && n <= MAX_AMOUNT;
}

export function cleanRecurring(value: unknown): Recurring[] {
  if (!Array.isArray(value)) return [];
  const out: Recurring[] = [];
  for (const v of value) {
    if (!v || typeof v !== 'object') continue;
    const r = v as Record<string, unknown>;
    if (
      typeof r.id === 'string' &&
      (r.type === 'expense' || r.type === 'income') &&
      typeof r.description === 'string' &&
      typeof r.category === 'string' &&
      typeof r.account === 'string' &&
      isMoney(r.total) &&
      typeof r.day === 'number' && Number.isInteger(r.day) && r.day >= 1 && r.day <= 31 &&
      typeof r.lastDone === 'string' && (r.lastDone === '' || MONTH.test(r.lastDone))
    ) {
      out.push({
        id: r.id, type: r.type, description: r.description, category: r.category,
        account: r.account, total: r.total, day: r.day, lastDone: r.lastDone,
      });
    }
  }
  return out;
}

export function cleanGoals(value: unknown): Goal[] {
  if (!Array.isArray(value)) return [];
  const out: Goal[] = [];
  for (const v of value) {
    if (!v || typeof v !== 'object') continue;
    const g = v as Record<string, unknown>;
    if (
      typeof g.id === 'string' &&
      typeof g.name === 'string' && g.name.trim() &&
      isMoney(g.target) &&
      isMoney(g.saved, true) &&
      typeof g.deadline === 'string' && (g.deadline === '' || DATE.test(g.deadline))
    ) {
      out.push({ id: g.id, name: g.name, target: g.target, saved: g.saved, deadline: g.deadline });
    }
  }
  return out;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** Tanggal jatuh tempo (yyyy-MM-dd) aturan ini di bulan `ym`; tanggal 31 jadi hari terakhir di bulan pendek. */
export function dueDateIn(day: number, ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${ym}-${String(Math.min(day, last)).padStart(2, '0')}`;
}

/** Aturan yang sudah jatuh tempo bulan ini dan belum dicatat atau dilewati. */
export function dueRules(rules: Recurring[], today: string): { rule: Recurring; date: string }[] {
  const ym = monthKey(today);
  const out: { rule: Recurring; date: string }[] = [];
  for (const rule of rules) {
    const date = dueDateIn(rule.day, ym);
    if (rule.lastDone !== ym && date <= today) out.push({ rule, date });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Nilai awal `lastDone` untuk aturan baru: kalau tanggalnya bulan ini sudah lewat, mulai bulan depan. */
export function initialLastDone(day: number, today: string): string {
  const ym = monthKey(today);
  return dueDateIn(day, ym) < today ? ym : '';
}

export function goalPercent(g: Goal): number {
  return Math.min(100, Math.floor((g.saved / g.target) * 100));
}

/** Jumlah bulan kalender dari bulan `today` sampai bulan tenggat (minimal 1); null kalau tanpa tenggat atau sudah lewat. */
export function monthsLeft(deadline: string, today: string): number | null {
  if (!deadline || deadline < today) return null;
  const a = parseISODate(today);
  const b = parseISODate(deadline);
  return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth());
}

/** Setoran per bulan yang dibutuhkan; null kalau sudah tercapai atau tidak ada tenggat yang berlaku. */
export function monthlyNeed(g: Goal, today: string): number | null {
  const remaining = g.target - g.saved;
  if (remaining <= 0) return null;
  const n = monthsLeft(g.deadline, today);
  return n === null ? null : Math.ceil(remaining / n);
}

export function newId(): string {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

export const MAX_BUDGET = 1_000_000_000_000;

export type Budgets = Record<string, number>;

export function cleanBudgets(value: unknown): Budgets {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Budgets = {};
  for (const [category, n] of Object.entries(value as Record<string, unknown>)) {
    if (typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= MAX_BUDGET) out[category] = n;
  }
  return out;
}
