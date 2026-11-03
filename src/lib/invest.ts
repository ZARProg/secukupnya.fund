import { ACCOUNT_CATALOG, TRANSFER_CATEGORY, getAccountMeta } from './categories';
import { daysBetween } from './debts';
import { MAX_AMOUNT } from './plans';
import type { TransactionPayload } from './transactions';

/**
 * Investasi = rekening platform (Bibit, Ajaib, Pluang, ...) yang menerima uang lewat transfer dari bank/e-wallet.
 *
 *  - Modal bersih = setoran − penarikan, dihitung dari transaksi Transfer di rekening platform (+ saldo awal bila diisi di Kekayaan bersih).
 *  - Nilai sekarang = angka yang diketik pengguna dari aplikasi platform (tanggal + nilai). Aplikasi tidak menebak harga pasar.
 *    Tanpa angka itu, nilai dianggap sama dengan modal (untung/rugi 0) dan diberi label "belum diperbarui".
 *  - Untung/rugi = nilai sekarang − modal bersih. Penarikan tidak mengubah untung/rugi karena nilai ikut berkurang.
 */

export const STALE_VALUE_DAYS = 30;
export const MAX_VALUATIONS = 120;

export interface Valuation {
  /** yyyy-MM-dd */
  date: string;
  /** Rupiah, bilangan bulat >= 0. */
  value: number;
}

export interface InvestData {
  /** Riwayat nilai per nama platform, terurut menurut tanggal. */
  valuations: Record<string, Valuation[]>;
}

export const EMPTY_INVEST: InvestData = { valuations: {} };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isMoney = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= MAX_AMOUNT;

export const INVEST_PLATFORMS = ACCOUNT_CATALOG.filter((a) => a.kind === 'invest').map((a) => a.name);
export const isInvestAccount = (name: string) => INVEST_PLATFORMS.includes(name);

export function cleanValuations(value: unknown): Valuation[] {
  if (!Array.isArray(value)) return [];
  const byDate = new Map<string, Valuation>();
  for (const v of value) {
    if (!v || typeof v !== 'object') continue;
    const o = v as Record<string, unknown>;
    if (typeof o.date !== 'string' || !DATE.test(o.date) || !isMoney(o.value)) continue;
    byDate.set(o.date, { date: o.date, value: o.value });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_VALUATIONS);
}

export function cleanInvest(value: unknown): InvestData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { valuations: {} };
  const raw = (value as Record<string, unknown>).valuations;
  const out: Record<string, Valuation[]> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!isInvestAccount(k)) continue;
      const list = cleanValuations(v);
      if (list.length) out[k] = list;
    }
  }
  return { valuations: out };
}

export const isEmptyInvest = (d: InvestData) => Object.keys(d.valuations).length === 0;

export function latestValuation(list: Valuation[] | undefined, onOrBefore?: string): Valuation | null {
  if (!list?.length) return null;
  const eligible = onOrBefore ? list.filter((v) => v.date <= onOrBefore) : list;
  return eligible.length ? eligible[eligible.length - 1] : null;
}

/** Simpan/ganti nilai untuk tanggal itu. */
export function upsertValuation(data: InvestData, platform: string, date: string, value: number): InvestData {
  if (!isInvestAccount(platform) || !DATE.test(date) || !isMoney(value)) return data;
  const list = (data.valuations[platform] ?? []).filter((v) => v.date !== date);
  list.push({ date, value });
  list.sort((a, b) => a.date.localeCompare(b.date));
  return { valuations: { ...data.valuations, [platform]: list.slice(-MAX_VALUATIONS) } };
}

export function removeValuation(data: InvestData, platform: string, date: string): InvestData {
  const list = (data.valuations[platform] ?? []).filter((v) => v.date !== date);
  const valuations = { ...data.valuations };
  if (list.length) valuations[platform] = list;
  else delete valuations[platform];
  return { valuations };
}

export interface Position {
  platform: string;
  /** Modal bersih: setoran − penarikan (+ saldo awal). */
  cost: number;
  /** Nilai yang dipakai: angka terakhir dari pengguna, atau sama dengan modal bila belum ada. */
  value: number;
  /** Ada angka dari pengguna? */
  hasValue: boolean;
  valueDate: string | null;
  /** Umur angka dalam hari; null bila belum ada. */
  ageDays: number | null;
  stale: boolean;
  gain: number;
  /** Persen terhadap modal; null bila modal <= 0. */
  gainPct: number | null;
}

/** balance = saldo rekening dari transaksi; opening = saldo awal dari Kekayaan bersih. */
export function positionOf(platform: string, balance: number, opening: number, list: Valuation[] | undefined, today: string): Position {
  const cost = balance + opening;
  const last = latestValuation(list, today) ?? latestValuation(list);
  const hasValue = !!last;
  const value = last ? last.value : Math.max(0, cost);
  const age = last ? Math.max(0, daysBetween(last.date, today)) : null;
  const gain = hasValue ? value - cost : 0;
  return {
    platform, cost, value, hasValue, valueDate: last?.date ?? null, ageDays: age,
    stale: age !== null && age > STALE_VALUE_DAYS,
    gain, gainPct: hasValue && cost > 0 ? (gain / cost) * 100 : null,
  };
}

export interface InvestSummary {
  cost: number;
  value: number;
  gain: number;
  gainPct: number | null;
  /** Ada platform yang nilainya belum diperbarui / sudah lama? */
  anyStale: boolean;
  anyMissing: boolean;
}

export function summarize(positions: Position[]): InvestSummary {
  const cost = positions.reduce((s, p) => s + p.cost, 0);
  const value = positions.reduce((s, p) => s + p.value, 0);
  const gain = positions.reduce((s, p) => s + p.gain, 0);
  const basis = positions.reduce((s, p) => s + (p.hasValue ? p.cost : 0), 0);
  return {
    cost, value, gain,
    gainPct: basis > 0 ? (gain / basis) * 100 : null,
    anyStale: positions.some((p) => p.stale),
    anyMissing: positions.some((p) => !p.hasValue && p.cost !== 0),
  };
}

/** Nilai platform untuk Kekayaan bersih (hanya yang ada angkanya dari pengguna). */
export function valuesForNetWorth(data: InvestData, today: string): Record<string, { value: number; date: string }> {
  const out: Record<string, { value: number; date: string }> = {};
  for (const [k, list] of Object.entries(data.valuations)) {
    const last = latestValuation(list, today) ?? latestValuation(list);
    if (last) out[k] = { value: last.value, date: last.date };
  }
  return out;
}

export type MoveKind = 'topup' | 'withdraw';

/**
 * Dua baris Transfer (sama seperti transfer biasa): uang keluar dari rekening asal dan masuk ke rekening tujuan.
 * Tidak dihitung sebagai pengeluaran atau pemasukan.
 */
export function movePayloads(kind: MoveKind, bank: string, platform: string, amount: number, date: string, note: string): TransactionPayload[] {
  const from = kind === 'topup' ? bank : platform;
  const to = kind === 'topup' ? platform : bank;
  const n = note.trim();
  return [
    { date, type: 'expense', category: TRANSFER_CATEGORY, account: from, description: n || (kind === 'topup' ? `Top up investasi ke ${platform}` : `Tarik dana dari ${platform}`), total: amount },
    { date, type: 'income', category: TRANSFER_CATEGORY, account: to, description: n || (kind === 'topup' ? `Top up investasi dari ${bank}` : `Penarikan investasi ke ${bank}`), total: amount },
  ];
}

/** Nilai baru setelah setoran/penarikan, supaya untung/rugi tidak berubah hanya karena uang masuk atau keluar. */
export function valueAfterMove(current: number, kind: MoveKind, amount: number): number {
  return Math.max(0, kind === 'topup' ? current + amount : current - amount);
}

/** Titik grafik: nilai per tanggal (maks `n` terakhir). */
export function valueSeries(list: Valuation[] | undefined, n = 24): Valuation[] {
  return (list ?? []).slice(-n);
}

/** Warna segmen grafik, diambil dari warna lencana platform (kelas bg-[#...]) supaya cocok dengan logonya. */
export const platformColor = (name: string) => /bg-\[#[0-9A-Fa-f]{6}\]/.exec(getAccountMeta(name).avatar)?.[0] ?? 'bg-brand';
