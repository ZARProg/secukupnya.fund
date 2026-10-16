import { isCreditAccount } from './categories';
import type { Transaction, TransactionPayload, TxSource, TxType } from './transactions';

/**
 * Riwayat aktivitas: catatan perubahan data supaya selisih saldo bisa ditelusuri.
 *
 * Yang tercatat:
 *  - perubahan lewat aplikasi ini (dibuat, diubah, dihapus, dipulihkan, impor), lengkap dengan data sebelum dan sesudah;
 *  - perubahan di Google Sheets yang dilakukan DI LUAR aplikasi (diedit langsung di spreadsheet), yang terdeteksi dengan
 *    membandingkan isi sheet dengan kondisi terakhir yang dilihat aplikasi. Waktunya adalah saat terdeteksi, bukan saat diedit.
 * Yang tidak tercatat: perubahan data lokal di browser atau perangkat lain, karena aplikasi tidak punya server.
 */

export type ActivityAction =
  | 'create' | 'update' | 'delete' | 'restore' | 'import'
  | 'external_add' | 'external_remove' | 'external_update';

export interface TxSnap {
  date: string;
  type: TxType;
  category: string;
  account: string;
  description: string;
  total: number;
}

export interface ActivityEntry {
  id: string;
  /** Waktu ISO (UTC). */
  at: string;
  action: ActivityAction;
  source: TxSource;
  before?: TxSnap;
  after?: TxSnap;
  /** Hanya untuk impor: jumlah baris dan total pemasukan/pengeluaran. */
  count?: number;
  income?: number;
  expense?: number;
  /** Untuk 'restore': aksi apa yang dipulihkan. */
  restores?: 'delete' | 'update';
  /** Entri ini sudah dipulihkan (waktu ISO). */
  restoredAt?: string;
}

export const MAX_ENTRIES = 1000;
export const MAX_EXTERNAL_PER_SYNC = 40;

export function snapOf(t: Pick<Transaction, 'date' | 'type' | 'category' | 'account' | 'description' | 'total'> | TransactionPayload): TxSnap {
  return { date: t.date, type: t.type, category: t.category, account: t.account, description: t.description, total: t.total };
}

/** Pengaruh satu transaksi terhadap total saldo kas. Rekening KREDIT tidak menggerakkan kas. */
export function balanceDelta(s: TxSnap | undefined): number {
  if (!s || isCreditAccount(s.account)) return 0;
  return s.type === 'income' ? s.total : -s.total;
}

/** Pengaruh bersih satu entri terhadap saldo kas. */
export function entryEffect(e: ActivityEntry): number {
  switch (e.action) {
    case 'create':
    case 'restore':
    case 'external_add':
      return balanceDelta(e.after) - (e.restores === 'update' ? balanceDelta(e.before) : 0);
    case 'delete':
    case 'external_remove':
      // Penghapusan massal (kosongkan data lokal) hanya menyimpan ringkasan.
      return e.before ? -balanceDelta(e.before) : -((e.income ?? 0) - (e.expense ?? 0));
    case 'update':
    case 'external_update':
      return balanceDelta(e.after) - balanceDelta(e.before);
    case 'import':
      return (e.income ?? 0) - (e.expense ?? 0);
  }
}

export type SnapField = keyof TxSnap;
const FIELDS: SnapField[] = ['date', 'type', 'account', 'category', 'description', 'total'];

export function changedFields(a: TxSnap | undefined, b: TxSnap | undefined): SnapField[] {
  if (!a || !b) return [];
  return FIELDS.filter((f) => a[f] !== b[f]);
}

// ---------- Deteksi perubahan di luar aplikasi ----------

/** Kunci tetap untuk satu baris sheet. Panjang teks dipotong 200 seperti yang dilakukan Code.gs saat menyimpan. */
export function snapKey(s: TxSnap): string {
  return JSON.stringify([s.date, s.type, s.account.slice(0, 200), s.category.slice(0, 200), s.description.slice(0, 200), s.total]);
}

export function snapFromKey(key: string): TxSnap {
  const [date, type, account, category, description, total] = JSON.parse(key) as [string, TxType, string, string, string, number];
  return { date, type, account, category, description, total };
}

export function keysOf(list: Array<Pick<Transaction, 'date' | 'type' | 'category' | 'account' | 'description' | 'total'>>): string[] {
  return list.map((t) => snapKey(snapOf(t)));
}

/** Selisih dua daftar kunci sebagai multiset (urutan baris tidak berpengaruh). */
export function diffKeys(prev: string[], next: string[]): { added: string[]; removed: string[] } {
  const counts = new Map<string, number>();
  for (const k of prev) counts.set(k, (counts.get(k) ?? 0) + 1);
  const added: string[] = [];
  for (const k of next) {
    const c = counts.get(k) ?? 0;
    if (c > 0) counts.set(k, c - 1);
    else added.push(k);
  }
  const removed: string[] = [];
  for (const [k, c] of counts) for (let i = 0; i < c; i++) removed.push(k);
  return { added, removed };
}

export interface ExternalChange {
  kind: 'add' | 'remove' | 'update';
  before?: TxSnap;
  after?: TxSnap;
}

/**
 * Satu baris hilang dan satu baris muncul pada tanggal, jenis, dan rekening yang sama dianggap SATU perubahan (edit di sheet).
 * Selain itu dilaporkan sebagai tambah/hapus. Ini tebakan yang masuk akal, bukan kepastian.
 */
export function pairChanges(added: string[], removed: string[]): ExternalChange[] {
  const a = added.map(snapFromKey);
  const r = removed.map(snapFromKey);
  const group = (s: TxSnap) => `${s.date}|${s.type}|${s.account}`;
  const ga = new Map<string, TxSnap[]>();
  const gr = new Map<string, TxSnap[]>();
  for (const s of a) ga.set(group(s), [...(ga.get(group(s)) ?? []), s]);
  for (const s of r) gr.set(group(s), [...(gr.get(group(s)) ?? []), s]);
  const out: ExternalChange[] = [];
  const paired = new Set<string>();
  for (const [g, adds] of ga) {
    const rems = gr.get(g);
    if (rems && adds.length === 1 && rems.length === 1) {
      out.push({ kind: 'update', before: rems[0], after: adds[0] });
      paired.add(g);
    }
  }
  for (const [g, adds] of ga) if (!paired.has(g)) for (const s of adds) out.push({ kind: 'add', after: s });
  for (const [g, rems] of gr) if (!paired.has(g)) for (const s of rems) out.push({ kind: 'remove', before: s });
  return out;
}

export function externalEntries(changes: ExternalChange[], nowIso: string, makeId: () => string): ActivityEntry[] {
  const out: ActivityEntry[] = [];
  for (const c of changes.slice(0, MAX_EXTERNAL_PER_SYNC)) {
    out.push({
      id: makeId(), at: nowIso, source: 'sheet',
      action: c.kind === 'add' ? 'external_add' : c.kind === 'remove' ? 'external_remove' : 'external_update',
      before: c.before, after: c.after,
    });
  }
  const rest = changes.slice(MAX_EXTERNAL_PER_SYNC);
  if (rest.length) {
    // Terlalu banyak untuk dirinci satu per satu: ringkas dalam satu entri bertipe impor.
    let income = 0;
    let expense = 0;
    for (const c of rest) {
      const eff = c.kind === 'add' ? balanceDelta(c.after) : c.kind === 'remove' ? -balanceDelta(c.before) : balanceDelta(c.after) - balanceDelta(c.before);
      if (eff >= 0) income += eff;
      else expense += -eff;
    }
    out.push({ id: makeId(), at: nowIso, source: 'sheet', action: 'import', count: rest.length, income, expense });
  }
  return out;
}

export function trimEntries(list: ActivityEntry[]): ActivityEntry[] {
  return list.length > MAX_ENTRIES ? list.slice(list.length - MAX_ENTRIES) : list;
}

const ACTIONS: ActivityAction[] = ['create', 'update', 'delete', 'restore', 'import', 'external_add', 'external_remove', 'external_update'];

function cleanSnap(v: unknown): TxSnap | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  if (typeof o.date !== 'string' || (o.type !== 'expense' && o.type !== 'income') || typeof o.total !== 'number' || !Number.isFinite(o.total)) return undefined;
  return {
    date: o.date.slice(0, 10), type: o.type, total: o.total,
    category: String(o.category ?? '').slice(0, 200), account: String(o.account ?? '').slice(0, 200), description: String(o.description ?? '').slice(0, 200),
  };
}

/** Baca data tersimpan atau backup. */
export function cleanEntries(raw: unknown): ActivityEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: ActivityEntry[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    if (typeof o.id !== 'string' || typeof o.at !== 'string' || Number.isNaN(Date.parse(o.at))) continue;
    if (!ACTIONS.includes(o.action as ActivityAction)) continue;
    const e: ActivityEntry = { id: o.id.slice(0, 80), at: o.at, action: o.action as ActivityAction, source: o.source === 'sheet' ? 'sheet' : 'local' };
    const before = cleanSnap(o.before);
    const after = cleanSnap(o.after);
    if (before) e.before = before;
    if (after) e.after = after;
    for (const k of ['count', 'income', 'expense'] as const) if (typeof o[k] === 'number' && Number.isFinite(o[k] as number)) e[k] = o[k] as number;
    if (o.restores === 'delete' || o.restores === 'update') e.restores = o.restores;
    if (typeof o.restoredAt === 'string') e.restoredAt = o.restoredAt;
    out.push(e);
  }
  return trimEntries(out);
}
