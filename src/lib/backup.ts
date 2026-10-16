import { normalizeSelection } from './accounts';
import { cleanEntries } from './activity';
import { cleanDebts } from './debts';
import { cleanSavedFilters } from './filters';
import { cleanLocal } from './localStore';
import { cleanBudgets, cleanGoals, cleanRecurring } from './plans';
import { cleanMemory } from './quickMemory';
import { cleanRules } from './rules';

/**
 * Backup dan pindah perangkat. Data aplikasi ada di localStorage browser, jadi tidak ikut pindah ke perangkat lain.
 *  - Backup lengkap: satu file JSON berisi semua data di browser ini (transaksi lokal, anggaran, target, utang, aturan, riwayat, dst.).
 *    Sambungan Google Sheets (URL dan token) TIDAK ikut kecuali diminta, karena itu rahasia.
 *  - Sinkron pengaturan: hanya pengaturan portabel (rekening, batas harian, anggaran, target, tagihan berulang, utang, aturan kategori,
 *    pengaturan Aman dipakai, filter tersimpan) yang dikirim/diambil lewat spreadsheet. Transaksi lokal sengaja tidak ikut.
 * Data yang masuk selalu disaring lagi (pembersih yang sama dengan saat aplikasi memuat), jadi file yang rusak atau diubah tangan tidak bisa
 * memasukkan bentuk data yang tidak dikenal.
 */

export const APP_ID = 'secukupnya.fund';
export const BACKUP_FORMAT = 1;
export const MAX_VALUE_CHARS = 6_000_000;
export const MAX_FILE_CHARS = 12_000_000;
export const MAX_SYNC_CHARS = 380_000;

const P = 'budgettracker.';

/** Pengaturan yang ikut sinkron antar perangkat lewat spreadsheet. */
export const SYNC_KEYS = [
  `${P}accounts.v1`, `${P}dailyLimit.v1`, `${P}budgets.v1`, `${P}recurring.v1`, `${P}goals.v1`,
  `${P}debts.v1`, `${P}rules.v1`, `${P}safe.v1`, `${P}savedFilters.v1`,
] as const;

/** Tambahan khusus backup: data yang hanya ada di browser ini. */
const BACKUP_ONLY_KEYS = [
  `${P}local.v1`, `${P}hide.v1`, `${P}lang.v1`, `${P}engage.v1`, `${P}quick.v1`, `${P}recordtab.v1`, `${P}activity.v1`, `${P}dupignore.v1`,
] as const;

export const BACKUP_KEYS: readonly string[] = [...SYNC_KEYS, ...BACKUP_ONLY_KEYS];
export const CONNECTION_KEYS: readonly string[] = [`${P}sheetUrl.v1`, `${P}sheetToken.v1`];

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export interface BackupFile {
  app: typeof APP_ID;
  format: number;
  createdAt: string;
  includesConnection: boolean;
  data: Record<string, string>;
}

export function collect(storage: StorageLike, keys: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = storage.getItem(k);
    if (v !== null && v !== '') out[k] = v;
  }
  return out;
}

export function buildBackup(storage: StorageLike, includeConnection: boolean, now = new Date()): BackupFile {
  return {
    app: APP_ID,
    format: BACKUP_FORMAT,
    createdAt: now.toISOString(),
    includesConnection: includeConnection,
    data: collect(storage, includeConnection ? [...BACKUP_KEYS, ...CONNECTION_KEYS] : BACKUP_KEYS),
  };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * Saring satu nilai tersimpan. Mengembalikan teks yang aman ditulis, atau null kalau tidak valid
 * (atau kosong setelah disaring, artinya kuncinya sebaiknya dihapus).
 */
export function cleanValue(key: string, raw: string): string | null {
  if (typeof raw !== 'string' || raw.length > MAX_VALUE_CHARS) return null;
  const k = key.startsWith(P) ? key.slice(P.length) : key;
  const json = (v: unknown) => (v === undefined ? null : JSON.stringify(v));
  const list = (v: unknown[]) => (v.length ? JSON.stringify(v) : null);

  switch (k) {
    case 'sheetUrl.v1':
      return /^https:\/\/script\.google\.com\/(?:a\/macros\/[A-Za-z0-9.-]+\/|macros\/)s\/[A-Za-z0-9_-]+\/exec$/.test(raw.trim()) ? raw.trim() : null;
    case 'sheetToken.v1':
      return /^[A-Za-z0-9_-]{16,128}$/.test(raw.trim()) ? raw.trim() : null;
    case 'lang.v1':
      return raw === 'id' || raw === 'en' ? raw : null;
    case 'recordtab.v1':
      return raw === 'quick' || raw === 'full' ? raw : null;
    case 'hide.v1':
      return raw === '1' || raw === 'true' || raw === '0' || raw === 'false' ? raw : null;
    case 'dailyLimit.v1': {
      const n = Number(raw);
      return Number.isInteger(n) && n > 0 && n <= 1_000_000_000 ? String(n) : null;
    }
    default:
      break;
  }

  const v = parseJson(raw);
  if (v === undefined) return null;
  switch (k) {
    case 'accounts.v1': return list(normalizeSelection(v));
    case 'budgets.v1': {
      const b = cleanBudgets(v);
      return Object.keys(b).length ? JSON.stringify(b) : null;
    }
    case 'recurring.v1': return list(cleanRecurring(v));
    case 'goals.v1': return list(cleanGoals(v));
    case 'debts.v1': return list(cleanDebts(v));
    case 'rules.v1': return list(cleanRules(v));
    case 'savedFilters.v1': return list(cleanSavedFilters(v));
    case 'local.v1': return list(cleanLocal(v));
    case 'activity.v1': return list(cleanEntries(v));
    case 'quick.v1': return json(cleanMemory(v));
    case 'dupignore.v1': return Array.isArray(v) ? list(v.filter((x): x is string => typeof x === 'string').slice(-500)) : null;
    case 'safe.v1':
    case 'engage.v1':
      // Pemuatnya sendiri menyaring isinya; di sini cukup pastikan bentuknya objek biasa.
      return v && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : null;
    default:
      return null; // kunci yang tidak dikenal tidak pernah ditulis
  }
}

export type BackupError = 'json' | 'app' | 'format' | 'size' | 'empty';

export function parseBackup(text: string): { ok: true; file: BackupFile } | { ok: false; error: BackupError } {
  if (text.length > MAX_FILE_CHARS) return { ok: false, error: 'size' };
  const v = parseJson(text);
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { ok: false, error: 'json' };
  const o = v as Record<string, unknown>;
  if (o.app !== APP_ID) return { ok: false, error: 'app' };
  if (o.format !== BACKUP_FORMAT) return { ok: false, error: 'format' };
  if (!o.data || typeof o.data !== 'object' || Array.isArray(o.data)) return { ok: false, error: 'json' };
  const known = new Set<string>([...BACKUP_KEYS, ...CONNECTION_KEYS]);
  const data: Record<string, string> = {};
  for (const [k, raw] of Object.entries(o.data as Record<string, unknown>)) {
    if (!known.has(k) || typeof raw !== 'string') continue;
    const cleaned = cleanValue(k, raw);
    if (cleaned !== null) data[k] = cleaned;
  }
  if (!Object.keys(data).length) return { ok: false, error: 'empty' };
  const at = typeof o.createdAt === 'string' && !Number.isNaN(Date.parse(o.createdAt)) ? o.createdAt : new Date(0).toISOString();
  return { ok: true, file: { app: APP_ID, format: BACKUP_FORMAT, createdAt: at, includesConnection: CONNECTION_KEYS.some((k) => k in data), data } };
}

export interface BackupSummary {
  transactions: number;
  budgets: number;
  goals: number;
  recurring: number;
  debts: number;
  rules: number;
  activity: number;
  accounts: number;
  hasConnection: boolean;
}

function count(data: Record<string, string>, key: string): number {
  const raw = data[`${P}${key}`];
  const v = raw ? parseJson(raw) : undefined;
  if (Array.isArray(v)) return v.length;
  if (v && typeof v === 'object') return Object.keys(v).length;
  return 0;
}

export function summarize(data: Record<string, string>): BackupSummary {
  return {
    transactions: count(data, 'local.v1'),
    budgets: count(data, 'budgets.v1'),
    goals: count(data, 'goals.v1'),
    recurring: count(data, 'recurring.v1'),
    debts: count(data, 'debts.v1'),
    rules: count(data, 'rules.v1'),
    activity: count(data, 'activity.v1'),
    accounts: count(data, 'accounts.v1'),
    hasConnection: CONNECTION_KEYS.some((k) => k in data),
  };
}

/**
 * Tulis data ke storage. Kunci dalam `scope` yang tidak ada di data dihapus (restore = ganti, bukan campur),
 * kecuali kunci sambungan yang hanya disentuh kalau `withConnection`. Mengembalikan kunci yang ditulis.
 */
export function applyData(
  storage: StorageLike, data: Record<string, string>, scope: readonly string[], withConnection = false,
): string[] {
  const keys = withConnection ? [...scope, ...CONNECTION_KEYS] : [...scope];
  const written: string[] = [];
  // Siapkan semua nilai dulu; kalau ada yang gagal ditulis, sisanya tidak dilanjutkan dalam keadaan setengah jadi.
  const prev = collect(storage, keys);
  try {
    for (const k of keys) {
      if (k in data) {
        const cleaned = cleanValue(k, data[k]);
        if (cleaned === null) storage.removeItem(k);
        else { storage.setItem(k, cleaned); written.push(k); }
      } else {
        storage.removeItem(k);
      }
    }
  } catch (err) {
    for (const k of keys) {
      if (k in prev) { try { storage.setItem(k, prev[k]); } catch { /* abaikan */ } } else { try { storage.removeItem(k); } catch { /* abaikan */ } }
    }
    throw err;
  }
  return written;
}

// ---------- Sinkron pengaturan lewat spreadsheet ----------

export interface SyncBlob {
  app: typeof APP_ID;
  format: number;
  /** Waktu ISO saat dikirim dari perangkat. */
  pushedAt: string;
  data: Record<string, string>;
}

export function buildSyncBlob(storage: StorageLike, now = new Date()): string {
  const blob: SyncBlob = { app: APP_ID, format: BACKUP_FORMAT, pushedAt: now.toISOString(), data: collect(storage, SYNC_KEYS) };
  return JSON.stringify(blob);
}

export function parseSyncBlob(text: string): { ok: true; blob: SyncBlob } | { ok: false } {
  const v = parseJson(text);
  if (!v || typeof v !== 'object') return { ok: false };
  const o = v as Record<string, unknown>;
  if (o.app !== APP_ID || o.format !== BACKUP_FORMAT || !o.data || typeof o.data !== 'object' || Array.isArray(o.data)) return { ok: false };
  const allowed = new Set<string>(SYNC_KEYS);
  const data: Record<string, string> = {};
  for (const [k, raw] of Object.entries(o.data as Record<string, unknown>)) {
    if (!allowed.has(k) || typeof raw !== 'string') continue;
    const cleaned = cleanValue(k, raw);
    if (cleaned !== null) data[k] = cleaned;
  }
  const at = typeof o.pushedAt === 'string' && !Number.isNaN(Date.parse(o.pushedAt)) ? o.pushedAt : new Date(0).toISOString();
  return { ok: true, blob: { app: APP_ID, format: BACKUP_FORMAT, pushedAt: at, data } };
}

/** Sidik jari sederhana isi pengaturan lokal, untuk tahu apakah ada perubahan sejak sinkron terakhir. */
export function settingsFingerprint(storage: StorageLike): string {
  const data = collect(storage, SYNC_KEYS);
  const text = SYNC_KEYS.map((k) => `${k}=${data[k] ?? ''}`).join('\n');
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + ':' + text.length;
}

export interface SyncMeta {
  /** Waktu pushedAt milik versi di Sheets yang terakhir dikirim/diambil perangkat ini. */
  remoteAt: string;
  /** Sidik jari pengaturan lokal saat itu. */
  fingerprint: string;
}

const META_KEY = `${P}syncmeta.v1`;

export function loadSyncMeta(storage: StorageLike): SyncMeta | null {
  const v = parseJson(storage.getItem(META_KEY) ?? '');
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  return typeof o.remoteAt === 'string' && typeof o.fingerprint === 'string' ? { remoteAt: o.remoteAt, fingerprint: o.fingerprint } : null;
}

export function saveSyncMeta(storage: StorageLike, meta: SyncMeta): void {
  try { storage.setItem(META_KEY, JSON.stringify(meta)); } catch { /* abaikan */ }
}

export type SyncState = 'in_sync' | 'local_changed' | 'remote_newer' | 'both_changed' | 'never';

/** Bandingkan keadaan perangkat ini dengan yang di Sheets, tanpa mengubah apa pun. */
export function syncState(meta: SyncMeta | null, localFingerprint: string, remoteAt: string | null): SyncState {
  if (!remoteAt) return 'never';
  if (!meta) return 'both_changed';
  const localChanged = meta.fingerprint !== localFingerprint;
  const remoteNewer = Date.parse(remoteAt) > Date.parse(meta.remoteAt);
  if (localChanged && remoteNewer) return 'both_changed';
  if (remoteNewer) return 'remote_newer';
  if (localChanged) return 'local_changed';
  return 'in_sync';
}
