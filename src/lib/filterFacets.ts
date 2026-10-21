import { applyFilter, type TxFilter } from './filters';
import { monthOf } from './report';
import type { Transaction } from './transactions';

type Facet = 'account' | 'month' | 'category';

/**
 * Jumlah hasil bila satu pilihan dipasang, dengan filter lain tetap berlaku
 * (hitungan "berfacet", seperti angka pada chip filter aplikasi properti/makanan).
 * Nilai '' = tanpa batasan pada facet itu.
 */
export function facetCounts(
  transactions: Transaction[],
  filter: TxFilter,
  facet: Facet,
  values: string[],
  budgets: Record<string, number>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const v of values) {
    out.set(v, applyFilter(transactions, { ...filter, [facet]: v }, budgets).length);
  }
  return out;
}

export interface Histogram {
  /** Tinggi tiap batang, 0..1. */
  bars: number[];
  /** Batas bawah/atas nominal tiap batang (Rp); batang terakhir menampung semua yang lebih besar. */
  edges: number[];
  total: number;
}

/** Sebaran nominal dalam `bins` batang dari 0 sampai persentil ke-95 (agar satu transaksi raksasa tidak meratakan grafik). */
export function amountHistogram(amounts: number[], bins = 24): Histogram {
  const xs = amounts.filter((a) => Number.isFinite(a) && a >= 0).sort((a, b) => a - b);
  if (!xs.length) return { bars: Array(bins).fill(0), edges: Array.from({ length: bins + 1 }, () => 0), total: 0 };
  const cap = xs[Math.floor((xs.length - 1) * 0.95)] || xs[xs.length - 1] || 1;
  const step = cap / bins || 1;
  const counts = Array(bins).fill(0) as number[];
  for (const x of xs) counts[Math.min(bins - 1, Math.floor(x / step))] += 1;
  const peak = Math.max(...counts) || 1;
  return {
    bars: counts.map((c) => c / peak),
    edges: Array.from({ length: bins + 1 }, (_, i) => Math.round(i * step)),
    total: xs.length,
  };
}

/** Apakah batang ke-i beririsan dengan rentang [min, max] (null = tanpa batas). */
export function barInRange(h: Histogram, i: number, min: number | null, max: number | null): boolean {
  const lo = h.edges[i];
  const last = i === h.bars.length - 1;
  const hi = last ? Infinity : h.edges[i + 1];
  if (min !== null && hi <= min) return false;
  if (max !== null && lo > max) return false;
  return true;
}

/** Bulan yang ada di data, terbaru dulu (untuk chip bulan). */
export function monthsOf(transactions: Transaction[]): string[] {
  return Array.from(new Set(transactions.map((t) => monthOf(t.date)).filter(Boolean))).sort().reverse();
}
