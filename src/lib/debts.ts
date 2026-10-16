import { CREDIT_ACCOUNT, DEBT_PAYMENT_CATEGORY } from './categories';
import { parseISODate, toLocalISO } from './date';
import { MAX_AMOUNT, dueDateIn, monthKey, newId } from './plans';
import { shiftMonth } from './report';
import type { TransactionPayload } from './transactions';

/**
 * Pelacak utang dan cicilan.
 *
 * Tiga hal yang dibedakan supaya laporan tidak menghitung dua kali:
 *  1. Pembelian dengan utang  : pengeluaran biasa (kategori sebenarnya) di rekening KREDIT. Dihitung sebagai konsumsi sekali,
 *                               saat dibeli, dan tidak mengurangi saldo bank/e-wallet.
 *  2. Kewajiban utang         : dicatat di sini (pokok + bunga/biaya yang diketahui), bukan sebagai transaksi.
 *  3. Pembayaran              : uang keluar dari rekening. Bagian pokok dicatat sebagai "Debt Payment" (mengurangi saldo,
 *                               bukan pengeluaran konsumsi). Bagian bunga/biaya dicatat sebagai pengeluaran Paylater, karena
 *                               itu memang biaya baru.
 */

export type DebtKind = 'paylater' | 'installment' | 'card' | 'loan' | 'other';
export const DEBT_KINDS: DebtKind[] = ['paylater', 'installment', 'card', 'loan', 'other'];

export interface DebtPayment {
  id: string;
  /** yyyy-MM-dd */
  date: string;
  /** Mengurangi kewajiban (pokok + bagian bunga/biaya). */
  amount: number;
  /** Bagian dari `amount` yang merupakan bunga atau biaya. */
  feePart: number;
  /** True kalau juga dicatat sebagai transaksi oleh aplikasi. */
  recorded: boolean;
}

export interface Debt {
  id: string;
  name: string;
  kind: DebtKind;
  /** Pokok: harga barang atau pinjaman awal. */
  principal: number;
  /** Total bunga atau biaya yang sudah diketahui (0 kalau tidak ada). */
  fee: number;
  /** Cicilan per bulan. */
  monthly: number;
  /** Tanggal jatuh tempo tiap bulan (1-31). */
  dueDay: number;
  /** Tanggal mulai (opsional). Cicilan pertama jatuh tempo pada/setelah tanggal ini. */
  startDate: string;
  payments: DebtPayment[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isInt = (n: unknown, min: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= MAX_AMOUNT;

export function cleanDebts(value: unknown): Debt[] {
  if (!Array.isArray(value)) return [];
  const out: Debt[] = [];
  for (const v of value) {
    if (!v || typeof v !== 'object') continue;
    const d = v as Record<string, unknown>;
    if (
      typeof d.id !== 'string' || typeof d.name !== 'string' || !d.name.trim() ||
      !DEBT_KINDS.includes(d.kind as DebtKind) || !isInt(d.principal, 1) || !isInt(d.fee, 0) || !isInt(d.monthly, 1) ||
      typeof d.dueDay !== 'number' || !Number.isInteger(d.dueDay) || d.dueDay < 1 || d.dueDay > 31 ||
      typeof d.startDate !== 'string' || (d.startDate !== '' && !DATE.test(d.startDate))
    ) continue;
    const payments: DebtPayment[] = [];
    if (Array.isArray(d.payments)) {
      for (const p of d.payments) {
        if (!p || typeof p !== 'object') continue;
        const r = p as Record<string, unknown>;
        if (typeof r.id === 'string' && typeof r.date === 'string' && DATE.test(r.date) && isInt(r.amount, 1) && isInt(r.feePart, 0) && r.feePart <= r.amount) {
          payments.push({ id: r.id, date: r.date, amount: r.amount, feePart: r.feePart, recorded: r.recorded === true });
        }
      }
    }
    out.push({
      id: d.id, name: d.name.slice(0, 60), kind: d.kind as DebtKind, principal: d.principal, fee: d.fee, monthly: d.monthly,
      dueDay: d.dueDay, startDate: d.startDate, payments,
    });
  }
  return out;
}

// ---------- Hitungan dasar ----------

export const totalObligation = (d: Debt) => d.principal + d.fee;
export const totalPaid = (d: Debt) => d.payments.reduce((s, p) => s + p.amount, 0);
export const remaining = (d: Debt) => Math.max(0, totalObligation(d) - totalPaid(d));
export const isSettled = (d: Debt) => remaining(d) === 0;
export const installmentsLeft = (d: Debt) => (isSettled(d) ? 0 : Math.ceil(remaining(d) / d.monthly));
export const paidPercent = (d: Debt) => Math.min(100, Math.floor((totalPaid(d) / totalObligation(d)) * 100));
export const feePaid = (d: Debt) => d.payments.reduce((s, p) => s + p.feePart, 0);

function addMonthsIso(iso: string, n: number, day: number): string {
  return dueDateIn(day, shiftMonth(monthKey(iso), n));
}

export interface NextDue {
  date: string;
  /** Yang masih harus dibayar untuk jatuh tempo ini. */
  amount: number;
  overdue: boolean;
}

/** Jatuh tempo cicilan berikutnya; null kalau sudah lunas. */
export function nextDue(d: Debt, today: string): NextDue | null {
  const left = remaining(d);
  if (left === 0) return null;
  const ym = monthKey(today);
  const paidThisMonth = d.payments.filter((p) => monthKey(p.date) === ym).reduce((s, p) => s + p.amount, 0);
  const leftAtMonthStart = left + paidThisMonth;
  const dueThisMonth = Math.min(d.monthly, leftAtMonthStart);

  // Bulan pertama yang mungkin: bulan ini, atau bulan tanggal mulai kalau lebih akhir.
  let m = d.startDate && monthKey(d.startDate) > ym ? monthKey(d.startDate) : ym;
  let date = dueDateIn(d.dueDay, m);
  if (d.startDate && date < d.startDate) {
    m = shiftMonth(m, 1);
    date = dueDateIn(d.dueDay, m);
  }

  if (m === ym) {
    if (paidThisMonth >= dueThisMonth) {
      date = dueDateIn(d.dueDay, shiftMonth(ym, 1));
      return { date, amount: Math.min(d.monthly, left), overdue: false };
    }
    return { date, amount: dueThisMonth - paidThisMonth, overdue: date < today };
  }
  return { date, amount: Math.min(d.monthly, left), overdue: false };
}

/** Perkiraan tanggal lunas kalau membayar sesuai cicilan; null kalau sudah lunas. */
export function payoffDate(d: Debt, today: string): string | null {
  const n = installmentsLeft(d);
  const nd = nextDue(d, today);
  if (!n || !nd) return null;
  return n === 1 ? nd.date : addMonthsIso(nd.date, n - 1, d.dueDay);
}

// ---------- Pembayaran ----------

/**
 * Pecah pembayaran menjadi bagian bunga/biaya dan pokok, sebanding dengan komposisi total kewajiban.
 * Pembayaran yang melunasi sisa mengambil semua sisa bunga/biaya, supaya total bunga tepat tanpa selisih pembulatan.
 */
export function splitPayment(d: Debt, amount: number): { feePart: number; principalPart: number } {
  const left = remaining(d);
  const amt = Math.min(amount, left);
  const feeLeft = Math.max(0, d.fee - feePaid(d));
  const feePart = amt >= left ? feeLeft : Math.min(feeLeft, Math.round((amt * d.fee) / totalObligation(d)));
  return { feePart, principalPart: amt - feePart };
}

export function makePayment(d: Debt, amount: number, date: string, recorded: boolean): DebtPayment | null {
  const left = remaining(d);
  if (!Number.isInteger(amount) || amount < 1 || left === 0) return null;
  const amt = Math.min(amount, left);
  return { id: newId(), date, amount: amt, feePart: splitPayment(d, amt).feePart, recorded };
}

/** Transaksi untuk sebuah pembayaran: pokok sebagai Debt Payment, bunga/biaya sebagai pengeluaran Paylater. */
export function paymentTransactions(d: Debt, p: DebtPayment, account: string): TransactionPayload[] {
  const out: TransactionPayload[] = [];
  const principal = p.amount - p.feePart;
  if (principal > 0) {
    out.push({ date: p.date, type: 'expense', category: DEBT_PAYMENT_CATEGORY, account, description: `Cicilan ${d.name}`, total: principal });
  }
  if (p.feePart > 0) {
    out.push({ date: p.date, type: 'expense', category: 'Paylater', account, description: `Bunga/biaya ${d.name}`, total: p.feePart });
  }
  return out;
}

/** Pembelian dengan utang: pengeluaran konsumsi di rekening KREDIT (tidak mengurangi saldo bank). */
export function purchaseTransaction(d: Debt, date: string, category: string): TransactionPayload {
  return { date, type: 'expense', category, account: CREDIT_ACCOUNT, description: d.name, total: d.principal };
}

// ---------- Ringkasan ----------

export interface DebtSummary {
  remaining: number;
  paidThisMonth: number;
  active: number;
}

export function summarize(debts: Debt[], today: string): DebtSummary {
  const ym = monthKey(today);
  let rem = 0;
  let paid = 0;
  let active = 0;
  for (const d of debts) {
    const r = remaining(d);
    rem += r;
    if (r > 0) active++;
    paid += d.payments.filter((p) => monthKey(p.date) === ym).reduce((s, p) => s + p.amount, 0);
  }
  return { remaining: rem, paidThisMonth: paid, active };
}

/** Cicilan yang jatuh tempo (atau lewat) pada atau sebelum `until`. */
export function dueBy(debts: Debt[], today: string, until: string): { debt: Debt; due: NextDue }[] {
  const out: { debt: Debt; due: NextDue }[] = [];
  for (const debt of debts) {
    const due = nextDue(debt, today);
    if (due && due.amount > 0 && due.date <= until) out.push({ debt, due });
  }
  return out.sort((a, b) => a.due.date.localeCompare(b.due.date));
}

export function endOfMonth(today: string): string {
  const [y, m] = today.split('-').map(Number);
  return `${monthKey(today)}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
}

// ---------- Skenario pelunasan ----------

export interface ScenarioInput {
  /** Dibayar sekali sekarang. */
  lump: number;
  /** Cicilan per bulan setelahnya. */
  monthly: number;
  /** Bunga per bulan (%) atas sisa utang, opsional. 0 = bunga/biaya tetap seperti yang sudah dihitung di kewajiban. */
  ratePct: number;
}

export interface ScenarioResult {
  /** Jumlah cicilan bulanan setelah pembayaran sekaligus; null kalau tidak pernah lunas. */
  months: number | null;
  totalPaid: number;
  interest: number;
  payoffDate: string | null;
}

export const MAX_SIM_MONTHS = 600;

export function simulate(left: number, input: ScenarioInput, firstDue: string | null, today: string, dueDay: number): ScenarioResult {
  let balance = Math.max(0, left - Math.max(0, input.lump));
  let totalPaid = Math.min(left, Math.max(0, input.lump));
  let interest = 0;
  let months = 0;
  while (balance > 0) {
    if (months >= MAX_SIM_MONTHS || input.monthly <= 0) return { months: null, totalPaid, interest, payoffDate: null };
    const add = Math.round((balance * input.ratePct) / 100);
    if (input.monthly <= add) return { months: null, totalPaid, interest, payoffDate: null };
    balance += add;
    interest += add;
    const pay = Math.min(input.monthly, balance);
    balance -= pay;
    totalPaid += pay;
    months++;
  }
  const date = months === 0 ? today : firstDue ? (months === 1 ? firstDue : addMonthsIso(firstDue, months - 1, dueDay)) : null;
  return { months, totalPaid, interest, payoffDate: date };
}

export function isoToday(): string {
  return toLocalISO(new Date());
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}
