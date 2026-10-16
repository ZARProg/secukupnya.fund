import { useSyncExternalStore } from 'react';
import {
  cleanEntries, diffKeys, externalEntries, keysOf, pairChanges, snapKey, trimEntries,
  type ActivityEntry, type TxSnap,
} from './activity';
import { newId } from './plans';
import type { Transaction } from './transactions';

const KEY = 'budgettracker.activity.v1';
const SNAP_KEY = 'budgettracker.sheetsnap.v1';

function read(): ActivityEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? cleanEntries(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

let entries: ActivityEntry[] = read();
const listeners = new Set<() => void>();

function commit(next: ActivityEntry[]) {
  entries = trimEntries(next);
  try {
    if (entries.length) localStorage.setItem(KEY, JSON.stringify(entries));
    else localStorage.removeItem(KEY);
  } catch {
    // Penyimpanan penuh: buang separuh entri tertua supaya pencatatan berikutnya tetap jalan.
    entries = entries.slice(Math.floor(entries.length / 2));
    try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch { /* biarkan di memori */ }
  }
  listeners.forEach((l) => l());
}

export function getEntries(): ActivityEntry[] {
  return entries;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Pencatatan tidak boleh pernah menggagalkan penyimpanan transaksi, jadi semua error ditelan di sini. */
export function logActivity(list: Array<Omit<ActivityEntry, 'id' | 'at'>>): ActivityEntry[] {
  try {
    const at = new Date().toISOString();
    const made = list.map((e) => ({ ...e, id: newId(), at }));
    commit([...entries, ...made]);
    return made;
  } catch (err) {
    console.error('Gagal mencatat riwayat:', err);
    return [];
  }
}

export function markRestored(id: string): void {
  commit(entries.map((e) => (e.id === id ? { ...e, restoredAt: new Date().toISOString() } : e)));
}

export function clearActivity(): void {
  commit([]);
}

/** Dipakai saat restore backup. */
export function replaceActivity(list: ActivityEntry[]): void {
  commit(list);
}

export function useActivity(): ActivityEntry[] {
  return useSyncExternalStore(subscribe, getEntries, getEntries);
}

// ---------- Kondisi terakhir spreadsheet yang dilihat aplikasi ----------

interface SheetSnap {
  url: string;
  keys: string[];
}

function readSnap(): SheetSnap | null {
  try {
    const raw = localStorage.getItem(SNAP_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as SheetSnap;
    return o && typeof o.url === 'string' && Array.isArray(o.keys) ? o : null;
  } catch {
    return null;
  }
}

function writeSnap(s: SheetSnap | null) {
  try {
    if (s) localStorage.setItem(SNAP_KEY, JSON.stringify(s));
    else localStorage.removeItem(SNAP_KEY);
  } catch {
    // Terlalu besar atau diblokir: deteksi perubahan luar dimatikan sampai berikutnya, tidak ada yang rusak.
    try { localStorage.removeItem(SNAP_KEY); } catch { /* abaikan */ }
  }
}

/** Setelah perubahan yang dilakukan aplikasi ini berhasil ditulis ke sheet, ikut perbarui kondisi terakhir agar tidak dianggap perubahan luar. */
export function snapApplyOwn(url: string, add: TxSnap[], remove: TxSnap[]): void {
  const snap = readSnap();
  if (!snap || snap.url !== url) return;
  const keys = [...snap.keys];
  for (const r of remove) {
    const i = keys.indexOf(snapKey(r));
    if (i >= 0) keys.splice(i, 1);
  }
  for (const a of add) keys.push(snapKey(a));
  writeSnap({ url, keys });
}

/**
 * Dipanggil setelah sheet berhasil dibaca. Membandingkan dengan kondisi terakhir; selisihnya berarti spreadsheet diubah
 * di luar aplikasi (atau dari perangkat lain), lalu dicatat sebagai entri. Pembacaan pertama hanya menjadi acuan.
 */
export function syncSheetSnapshot(url: string, fetched: Transaction[]): ActivityEntry[] {
  try {
    const next = keysOf(fetched);
    const prev = readSnap();
    writeSnap({ url, keys: next });
    if (!prev || prev.url !== url) return [];
    const { added, removed } = diffKeys(prev.keys, next);
    if (!added.length && !removed.length) return [];
    const at = new Date().toISOString();
    const made = externalEntries(pairChanges(added, removed), at, newId);
    commit([...entries, ...made]);
    return made;
  } catch (err) {
    console.error('Gagal membandingkan isi sheet:', err);
    return [];
  }
}

export function forgetSheetSnapshot(): void {
  writeSnap(null);
}
