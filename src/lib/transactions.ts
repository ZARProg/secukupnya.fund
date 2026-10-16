import { canonicalAccount } from './categories';
import { inferDateOrder, normalizeSheetDate } from './sheetDates';
import type { DateOrder } from './dateText';
import { tr } from '@/i18n';
import { getSheetToken } from './config';

export type TxType = 'expense' | 'income';
export type TxSource = 'sheet' | 'local';

export interface Transaction {
  id: string;
  /** Nomor baris di sheet (dipakai untuk hapus). Untuk data lokal hanya dipakai sebagai urutan. */
  row: number;
  /** yyyy-MM-dd, atau kosong kalau tanggal di spreadsheet tidak bisa dibaca. */
  date: string;
  /** Tanggal persis seperti yang dikirim spreadsheet. Dipakai saat hapus, supaya cocok dengan isi barisnya. */
  rawDate?: string;
  type: TxType;
  category: string;
  account: string;
  description: string;
  total: number;
  source: TxSource;
}

export interface TransactionPayload {
  date: string;
  category: string;
  account: string;
  description: string;
  total: number;
  type: TxType;
}

/** Versi Code.gs minimal yang mendukung impor massal (action "addMany"). */
export const MIN_BATCH_VERSION = 2;
/** Script versi 3+ menyisipkan transaksi baru sesuai tanggal (terbaru di atas); sebelumnya selalu di bawah. */
export const NEWEST_FIRST_VERSION = 3;
/** Script versi 4+ menyimpan batas pengeluaran harian dari website dan memakainya di popup spreadsheet. */
export const LIMIT_SYNC_VERSION = 4;
/** Script versi 5+ bisa mengubah satu transaksi (action "update"). */
export const EDIT_VERSION = 5;
/** Script versi 6+ mendukung token akses, pembacaan lewat POST, dan simpan/ambil pengaturan. */
export const SECURITY_VERSION = 6;
export const SETTINGS_SYNC_VERSION = 6;
export const IMPORT_BATCH_SIZE = 200;

/** Script menolak permintaan karena token kosong atau salah. */
export class SheetAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SheetAuthError';
  }
}

interface SheetRow {
  id?: string;
  row?: number;
  date?: unknown;
  category?: string;
  account?: string;
  description?: string;
  total?: number | string;
  amount?: number | string;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const n = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function normalize(raw: SheetRow, type: TxType, index: number, dateOrder: DateOrder): Transaction {
  const row = Number(raw.row) || Number(String(raw.id ?? '').split('-').pop()) || index + 2;
  return {
    id: raw.id || `${type === 'expense' ? 'exp' : 'inc'}-${row}`,
    row,
    date: normalizeSheetDate(raw.date, dateOrder),
    rawDate: raw.date === undefined || raw.date === null ? undefined : String(raw.date),
    type,
    category: String(raw.category ?? ''),
    account: canonicalAccount(String(raw.account ?? '')),
    description: String(raw.description ?? ''),
    total: toNumber(raw.total ?? raw.amount),
    source: 'sheet',
  };
}

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    if (text.includes('doGet')) {
      throw new Error(tr('forms.err.noDoGet'));
    }
    throw new Error(tr('forms.err.notJson'));
  }
}

async function request(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error(tr('forms.err.unreachable'));
  }
}

export interface FetchResult {
  transactions: Transaction[];
  /** Versi Code.gs yang ter-deploy. Script lama tidak melaporkan versi, dianggap 1. */
  version: number;
  /** Batas harian yang tersimpan di script (v4+), null kalau belum pernah diatur. */
  dailyLimit: number | null;
  /** Script ini memakai token akses (v6+). */
  secured: boolean;
}

export async function fetchTransactions(url: string, tokenOverride?: string): Promise<FetchResult> {
  if (!url) throw new Error(tr('forms.err.noUrl'));

  const response = await request(`${url}?t=${Date.now()}`, { cache: 'no-store' });
  let data = await readJson(response);
  if (data.status !== 'success') {
    throw new Error(data.message || tr('forms.err.fetchFailed'));
  }
  // Script yang memakai token tidak memberi data lewat GET. Baca lewat POST supaya token tidak ikut di URL.
  if (data.authRequired) {
    const token = (tokenOverride ?? getSheetToken()).trim();
    if (!token) throw new SheetAuthError(tr('forms.err.tokenRequired'));
    data = await post(url, { action: 'read' }, token);
  }

  const expenses: SheetRow[] = Array.isArray(data.expenses) ? data.expenses : [];
  const incomes: SheetRow[] = Array.isArray(data.incomes) ? data.incomes : [];

  const dateOrder = inferDateOrder([...expenses, ...incomes].map((r) => r.date));
  const version = Number(data.version) || 1;
  // Tanggal sama: di sheet baru (v3+) baris paling atas = paling baru, di sheet lama sebaliknya.
  const rowSign = version >= NEWEST_FIRST_VERSION ? -1 : 1;
  const transactions = [
    ...expenses.map((r, i) => normalize(r, 'expense', i, dateOrder)),
    ...incomes.map((r, i) => normalize(r, 'income', i, dateOrder)),
  ].sort((a, b) => b.date.localeCompare(a.date) || rowSign * (b.row - a.row));

  const limit = Number(data.dailyLimit);
  return { transactions, version, dailyLimit: Number.isInteger(limit) && limit > 0 ? limit : null, secured: Boolean(data.secured) };
}

async function post(url: string, body: object, tokenOverride?: string) {
  if (!url) throw new Error(tr('forms.err.noUrl'));
  const token = (tokenOverride ?? getSheetToken()).trim();

  const response = await request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    // Token ikut di badan permintaan, bukan di URL, supaya tidak tercatat di riwayat browser atau log.
    body: JSON.stringify(token ? { ...body, token } : body),
  });

  const data = await readJson(response);
  if (data.status !== 'success') {
    if (data.code === 'AUTH') throw new SheetAuthError(tr('forms.err.tokenWrong'));
    throw new Error(data.message || tr('forms.err.requestFailed'));
  }
  return data;
}

/** Ambil pengaturan website yang tersimpan di spreadsheet (script v6+). */
export async function fetchSettingsBlob(url: string): Promise<{ at: string | null; blob: string | null }> {
  const r = await post(url, { action: 'getSettings' });
  return { at: typeof r.at === 'string' ? r.at : null, blob: typeof r.blob === 'string' ? r.blob : null };
}

export async function pushSettingsBlob(url: string, blob: string): Promise<string> {
  const r = await post(url, { action: 'putSettings', blob });
  return String(r.at ?? '');
}

/** Kirim batas harian ke script (butuh versi 4+). */
export function setSheetLimit(url: string, limit: number) {
  return post(url, { action: 'setLimit', limit });
}

export function addTransaction(url: string, payload: TransactionPayload) {
  return post(url, payload);
}

/** Dilempar saat impor ke Sheets berhenti di tengah jalan; `imported` = baris yang sudah masuk. */
export class PartialImportError extends Error {
  imported: number;
  constructor(message: string, imported: number) {
    super(message);
    this.name = 'PartialImportError';
    this.imported = imported;
  }
}

/** Urutan pengiriman impor ke Sheets: tanggal terlama dulu. Dipakai juga untuk tahu baris mana yang sudah masuk saat impor berhenti di tengah. */
export function orderForSend(payloads: TransactionPayload[]): TransactionPayload[] {
  return [...payloads].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Kirim banyak transaksi sekaligus. Hanya aman untuk Code.gs versi 2+: script lama
 * tidak mengenal "addMany" dan akan menulis satu baris sampah, jadi pemanggil wajib
 * memeriksa `version` dari fetchTransactions lebih dulu.
 */
export async function addTransactions(
  url: string,
  payloads: TransactionPayload[],
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  // Kirim dari tanggal terlama: tiap kelompok disisipkan di atas, jadi yang terakhir
  // dikirim (terbaru) berakhir di baris paling atas. Urutan sort stabil menjaga urutan file.
  const ordered = orderForSend(payloads);
  let done = 0;
  for (let i = 0; i < ordered.length; i += IMPORT_BATCH_SIZE) {
    const chunk = ordered.slice(i, i + IMPORT_BATCH_SIZE);
    try {
      const result = await post(url, { action: 'addMany', rows: chunk });
      if (Number(result.added) !== chunk.length) {
        throw new Error(tr('forms.err.rowMismatch'));
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : tr('forms.err.generic');
      throw new PartialImportError(reason, done);
    }
    done += chunk.length;
    onProgress?.(done, payloads.length);
  }
  return done;
}

export function updateTransaction(url: string, tx: Transaction, next: TransactionPayload) {
  return post(url, {
    action: 'update',
    type: tx.type,
    row: tx.row,
    date: tx.rawDate ?? tx.date,
    total: tx.total,
    description: tx.description,
    newDate: next.date,
    newCategory: next.category,
    newAccount: next.account,
    newDescription: next.description,
    newTotal: next.total,
  });
}

export function deleteTransaction(url: string, tx: Transaction) {
  return post(url, {
    action: 'delete',
    type: tx.type,
    row: tx.row,
    date: tx.rawDate ?? tx.date,
    total: tx.total,
    description: tx.description,
  });
}
