import type { Transaction, TransactionPayload } from './transactions';
import { tr } from '@/i18n';

const STORAGE_KEY = 'budgettracker.local.v1';

function isTransaction(v: unknown): v is Transaction {
  if (!v || typeof v !== 'object') return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.id === 'string' &&
    (t.type === 'expense' || t.type === 'income') &&
    typeof t.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
    typeof t.total === 'number' &&
    Number.isFinite(t.total) &&
    typeof t.category === 'string' &&
    typeof t.account === 'string' &&
    typeof t.description === 'string'
  );
}

/** Saring data tersimpan atau backup: hanya transaksi yang valid, id unik, sumber selalu 'local'. */
export function cleanLocal(parsed: unknown): Transaction[] {
  if (!Array.isArray(parsed)) return [];
  const seen = new Set<string>();
  const out: Transaction[] = [];
  for (const t of parsed) {
    if (!isTransaction(t) || seen.has(t.id)) continue;
    seen.add(t.id);
    out.push({ ...t, source: 'local' as const });
  }
  return out;
}

export function loadLocal(): Transaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? cleanLocal(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function saveLocal(list: Transaction[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    throw new Error(tr('forms.err.storageFull'));
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `loc-${crypto.randomUUID()}`;
  return `loc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Ubah payload menjadi transaksi lokal. `row` dipakai sebagai urutan input (makin baru makin besar). */
export function createLocal(payloads: TransactionPayload[]): Transaction[] {
  const base = Date.now() * 1000;
  return payloads.map((p, i) => ({ ...p, id: newId(), row: base + i, source: 'local' as const }));
}
