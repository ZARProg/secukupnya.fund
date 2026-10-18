import { MAX_AMOUNT, newId } from './plans';
import { daysBetween, isSettled, remaining, type Debt } from './debts';

/**
 * Kekayaan bersih = total aset − total kewajiban.
 *
 * Sumber angka:
 *  - Saldo rekening (otomatis): dihitung dari transaksi yang tercatat + "saldo awal" yang diisi pengguna.
 *    Tanpa saldo awal angkanya hanya selisih transaksi tercatat, jadi diberi label estimasi.
 *  - Aset dan kewajiban manual: nilai + tanggal terakhir diperbarui. Nilai yang lebih tua dari STALE_DAYS, atau yang
 *    ditandai pengguna sebagai perkiraan, diberi label estimasi.
 *  - Utang dari Pelacak Utang (otomatis): sisa kewajiban yang belum lunas.
 *
 * Aplikasi tidak pernah menebak nilai: semua angka berasal dari transaksi, input pengguna, atau Pelacak Utang.
 */

export const STALE_DAYS = 30;
export const MAX_HISTORY = 400;
export const MAX_ITEMS = 200;

export const ASSET_KINDS = ['cash', 'savings', 'investment', 'property', 'vehicle', 'receivable', 'other'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];
export const LIABILITY_KINDS = ['loan', 'mortgage', 'card', 'other'] as const;
export type LiabilityKind = (typeof LIABILITY_KINDS)[number];

export interface NetItem<K extends string = string> {
  id: string;
  name: string;
  kind: K;
  /** Rupiah, bilangan bulat >= 0. */
  value: number;
  /** yyyy-MM-dd: kapan nilai ini terakhir dikonfirmasi pengguna. */
  updatedAt: string;
  /** Ditandai pengguna sebagai perkiraan (mis. harga pasar rumah), terlepas dari umur datanya. */
  estimate: boolean;
}

export interface NetSnapshot {
  /** yyyy-MM-dd */
  date: string;
  assets: number;
  liabilities: number;
  net: number;
  /** Jumlah (aset + kewajiban) yang berstatus estimasi saat itu. */
  estimated: number;
}

export interface NetWorthData {
  assets: NetItem<AssetKind>[];
  liabilities: NetItem<LiabilityKind>[];
  history: NetSnapshot[];
  /** Saldo awal per rekening (rupiah, boleh negatif untuk rekening yang minus). */
  openings: Record<string, number>;
  includeAccounts: boolean;
  includeDebts: boolean;
}

export const EMPTY_NET_WORTH: NetWorthData = {
  assets: [], liabilities: [], history: [], openings: {}, includeAccounts: true, includeDebts: true,
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isMoney = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= MAX_AMOUNT;
const isSigned = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && Math.abs(n) <= MAX_AMOUNT;

function cleanItems<K extends string>(value: unknown, kinds: readonly K[], fallback: K): NetItem<K>[] {
  if (!Array.isArray(value)) return [];
  const out: NetItem<K>[] = [];
  const seen = new Set<string>();
  for (const v of value) {
    if (out.length >= MAX_ITEMS) break;
    if (!v || typeof v !== 'object') continue;
    const o = v as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim().slice(0, 60) : '';
    if (!name || !isMoney(o.value) || typeof o.updatedAt !== 'string' || !DATE.test(o.updatedAt)) continue;
    const id = typeof o.id === 'string' && o.id && o.id.length <= 64 && !seen.has(o.id) ? o.id : newId();
    seen.add(id);
    const kind = (kinds as readonly string[]).includes(o.kind as string) ? (o.kind as K) : fallback;
    out.push({ id, name, kind, value: o.value, updatedAt: o.updatedAt, estimate: o.estimate === true });
  }
  return out;
}

export function cleanHistory(value: unknown): NetSnapshot[] {
  if (!Array.isArray(value)) return [];
  const byDate = new Map<string, NetSnapshot>();
  for (const v of value) {
    if (!v || typeof v !== 'object') continue;
    const o = v as Record<string, unknown>;
    if (typeof o.date !== 'string' || !DATE.test(o.date)) continue;
    if (!isSigned(o.assets) || !isSigned(o.liabilities) || !isSigned(o.net) || !isSigned(o.estimated)) continue;
    byDate.set(o.date, { date: o.date, assets: o.assets, liabilities: o.liabilities, net: o.net, estimated: o.estimated });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_HISTORY);
}

export function cleanNetWorth(value: unknown): NetWorthData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...EMPTY_NET_WORTH, openings: {} };
  const o = value as Record<string, unknown>;
  const openings: Record<string, number> = {};
  if (o.openings && typeof o.openings === 'object' && !Array.isArray(o.openings)) {
    for (const [k, v] of Object.entries(o.openings as Record<string, unknown>)) {
      if (k.length <= 40 && isSigned(v) && v !== 0 && Object.keys(openings).length < 50) openings[k] = v;
    }
  }
  return {
    assets: cleanItems(o.assets, ASSET_KINDS, 'other'),
    liabilities: cleanItems(o.liabilities, LIABILITY_KINDS, 'other'),
    history: cleanHistory(o.history),
    openings,
    includeAccounts: o.includeAccounts !== false,
    includeDebts: o.includeDebts !== false,
  };
}

export function isEmptyNetWorth(d: NetWorthData): boolean {
  return !d.assets.length && !d.liabilities.length && !d.history.length && !Object.keys(d.openings).length
    && d.includeAccounts && d.includeDebts;
}

// ---------- Perhitungan ----------

export type EstimateReason = 'stale' | 'flagged' | 'noOpening' | 'noActivity' | 'oldActivity';

export interface NetRow {
  key: string;
  source: 'account' | 'manual' | 'debt';
  id?: string;
  name: string;
  kind: string;
  value: number;
  estimate: boolean;
  reason: EstimateReason | null;
  /** Umur data dalam hari (untuk 'stale', 'oldActivity'). */
  ageDays: number | null;
}

export interface AccountInput {
  account: string;
  /** Saldo dari transaksi tercatat. */
  balance: number;
  /** Tanggal transaksi terakhir di rekening ini (yyyy-MM-dd), atau null kalau belum ada. */
  lastTx: string | null;
}

export interface NetWorthResult {
  assetRows: NetRow[];
  liabilityRows: NetRow[];
  assets: number;
  liabilities: number;
  net: number;
  estimatedAssets: number;
  estimatedLiabilities: number;
  /** Bagian dari (aset + kewajiban) yang berstatus estimasi, 0..1. */
  estimatedShare: number;
  hasEstimate: boolean;
}

export function manualEstimate(item: NetItem, today: string): { estimate: boolean; reason: EstimateReason | null; ageDays: number } {
  const age = Math.max(0, daysBetween(item.updatedAt, today));
  if (age > STALE_DAYS) return { estimate: true, reason: 'stale', ageDays: age };
  if (item.estimate) return { estimate: true, reason: 'flagged', ageDays: age };
  return { estimate: false, reason: null, ageDays: age };
}

export function computeNetWorth(data: NetWorthData, accounts: AccountInput[], debts: Debt[], today: string): NetWorthResult {
  const assetRows: NetRow[] = [];
  const liabilityRows: NetRow[] = [];

  if (data.includeAccounts) {
    for (const a of accounts) {
      const opening = data.openings[a.account];
      const value = a.balance + (opening ?? 0);
      let reason: EstimateReason | null = null;
      let age: number | null = null;
      if (opening === undefined) reason = 'noOpening';
      else if (!a.lastTx) reason = 'noActivity';
      else {
        age = Math.max(0, daysBetween(a.lastTx, today));
        if (age > STALE_DAYS) reason = 'oldActivity';
      }
      assetRows.push({ key: `acc:${a.account}`, source: 'account', name: a.account, kind: 'account', value, estimate: reason !== null, reason, ageDays: age });
    }
  }
  for (const item of data.assets) {
    const e = manualEstimate(item, today);
    assetRows.push({ key: `a:${item.id}`, source: 'manual', id: item.id, name: item.name, kind: item.kind, value: item.value, estimate: e.estimate, reason: e.reason, ageDays: e.ageDays });
  }

  if (data.includeDebts) {
    for (const d of debts) {
      if (isSettled(d)) continue;
      liabilityRows.push({ key: `d:${d.id}`, source: 'debt', id: d.id, name: d.name, kind: d.kind, value: remaining(d), estimate: false, reason: null, ageDays: null });
    }
  }
  for (const item of data.liabilities) {
    const e = manualEstimate(item, today);
    liabilityRows.push({ key: `l:${item.id}`, source: 'manual', id: item.id, name: item.name, kind: item.kind, value: item.value, estimate: e.estimate, reason: e.reason, ageDays: e.ageDays });
  }

  const sum = (rows: NetRow[], onlyEstimate = false) => rows.reduce((s, r) => (onlyEstimate && !r.estimate ? s : s + r.value), 0);
  const assets = sum(assetRows);
  const liabilities = sum(liabilityRows);
  const estimatedAssets = sum(assetRows, true);
  const estimatedLiabilities = sum(liabilityRows, true);
  // Pembagi memakai nilai absolut supaya saldo rekening negatif tidak membuat persentase melewati 100%.
  const gross = assetRows.reduce((s, r) => s + Math.abs(r.value), 0) + liabilities;
  const est = assetRows.reduce((s, r) => (r.estimate ? s + Math.abs(r.value) : s), 0) + estimatedLiabilities;
  return {
    assetRows, liabilityRows, assets, liabilities, net: assets - liabilities,
    estimatedAssets, estimatedLiabilities,
    estimatedShare: gross > 0 ? Math.min(1, est / gross) : 0,
    hasEstimate: assetRows.some((r) => r.estimate) || liabilityRows.some((r) => r.estimate),
  };
}

// ---------- Riwayat ----------

export function snapshotOf(r: NetWorthResult, today: string): NetSnapshot {
  return {
    date: today,
    assets: r.assets,
    liabilities: r.liabilities,
    net: r.net,
    estimated: r.estimatedAssets + r.estimatedLiabilities,
  };
}

const sameSnapshot = (a: NetSnapshot, b: NetSnapshot) =>
  a.assets === b.assets && a.liabilities === b.liabilities && a.net === b.net && a.estimated === b.estimated;

/** Simpan/ganti catatan untuk tanggal itu. Mengembalikan daftar yang sama (referensi sama) kalau tidak ada perubahan. */
export function upsertSnapshot(history: NetSnapshot[], snap: NetSnapshot): NetSnapshot[] {
  const existing = history.find((h) => h.date === snap.date);
  if (existing && sameSnapshot(existing, snap)) return history;
  const next = history.filter((h) => h.date !== snap.date);
  next.push(snap);
  next.sort((a, b) => a.date.localeCompare(b.date));
  return next.slice(-MAX_HISTORY);
}

export interface NetChange {
  /** Tanggal catatan pembanding. */
  since: string;
  delta: number;
}

/**
 * Perubahan kekayaan bersih. Pembanding: catatan terakhir sebelum awal bulan ini; kalau tidak ada,
 * catatan paling awal yang lebih tua dari hari ini. Null kalau belum ada pembanding.
 */
export function netChange(history: NetSnapshot[], currentNet: number, today: string): NetChange | null {
  const monthStart = today.slice(0, 7) + '-01';
  const before = history.filter((h) => h.date < monthStart);
  const base = before.length ? before[before.length - 1] : history.find((h) => h.date < today);
  if (!base) return null;
  return { since: base.date, delta: currentNet - base.net };
}
