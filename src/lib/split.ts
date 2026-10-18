import { parseRupiah } from './format';
import type { TransactionPayload } from './transactions';

/** Satu belanja dipisah ke beberapa kategori, mis. satu struk berisi makanan dan kebutuhan rumah. */
export const MIN_PARTS = 2;
export const MAX_PARTS = 6;

export interface SplitPart {
  category: string;
  amount: number;
}

export type SplitProblem = 'noTotal' | 'tooFew' | 'zeroPart' | 'mismatch';

export function splitSum(parts: SplitPart[]): number {
  return parts.reduce((s, p) => s + (Number.isFinite(p.amount) ? p.amount : 0), 0);
}

/** Selisih total dikurangi jumlah bagian. Positif = masih ada sisa, negatif = kelebihan. */
export function splitRemainder(total: number, parts: SplitPart[]): number {
  return total - splitSum(parts);
}

/** null = siap disimpan. Jumlah bagian harus pas dengan total, supaya laporan tidak bergeser. */
export function splitProblem(total: number, parts: SplitPart[]): SplitProblem | null {
  if (!(total > 0)) return 'noTotal';
  if (parts.length < MIN_PARTS) return 'tooFew';
  // Rupiah selalu bilangan bulat; pecahan ditolak supaya jumlah bagian tidak bergantung pada pembulatan floating point.
  if (parts.some((p) => !Number.isInteger(p.amount) || p.amount <= 0 || !p.category)) return 'zeroPart';
  if (splitRemainder(total, parts) !== 0) return 'mismatch';
  return null;
}

/** Satu baris per bagian, tanggal, rekening, dan keterangan sama. Selalu pengeluaran. */
export function buildSplitPayloads(
  base: { date: string; account: string; description: string },
  parts: SplitPart[],
): TransactionPayload[] {
  return parts.map((p) => ({
    date: base.date,
    type: 'expense' as const,
    category: p.category,
    account: base.account,
    description: base.description,
    total: p.amount,
  }));
}

/** Baris di layar (jumlah sebagai teks berformat) → bagian dengan angka. */
export interface SplitRow {
  category: string;
  display: string;
}

export const rowsToParts = (rows: SplitRow[]): SplitPart[] =>
  rows.map((r) => ({ category: r.category, amount: parseRupiah(r.display) }));
