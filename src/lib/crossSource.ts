import { similarText } from './importExcel';
import { isCreditAccount } from './categories';
import type { Transaction } from './transactions';

/**
 * Duplikat lintas sumber: transaksi yang sama ada di browser DAN di Google Sheets. Keduanya digabung di tampilan,
 * jadi saldo dan laporan menghitungnya dua kali. Di dalam satu sumber, transaksi kembar sering memang sah
 * (dua kopi di hari yang sama), jadi hanya pasangan lintas sumber yang diperiksa, satu lawan satu.
 * Tidak ada yang dihapus otomatis; pengguna yang memutuskan di halaman tinjau.
 */

export type DupLevel = 'exact' | 'likely';

export interface DupPair {
  /** Kunci isi pasangan (stabil walau nomor baris sheet bergeser). Dipakai untuk "bukan duplikat". */
  key: string;
  level: DupLevel;
  local: Transaction;
  sheet: Transaction;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function base(t: Transaction): string {
  return [t.date, t.type, norm(t.account), t.total].join('|');
}

function full(t: Transaction): string {
  return `${base(t)}|${norm(t.category)}|${norm(t.description)}`;
}

export function pairKey(local: Transaction, sheet: Transaction): string {
  return `${full(local)}#${full(sheet)}`;
}

/** Pasangkan satu lawan satu: yang persis sama dulu, lalu yang mirip. */
export function findCrossDuplicates(local: Transaction[], sheet: Transaction[], ignored: ReadonlySet<string> = new Set()): DupPair[] {
  const out: DupPair[] = [];
  const usedSheet = new Set<string>();
  const usedLocal = new Set<string>();

  const sheetByFull = new Map<string, Transaction[]>();
  for (const s of sheet) {
    if (!s.date) continue;
    const k = full(s);
    sheetByFull.set(k, [...(sheetByFull.get(k) ?? []), s]);
  }
  for (const l of local) {
    if (!l.date) continue;
    const list = sheetByFull.get(full(l));
    const hit = list?.find((s) => !usedSheet.has(s.id + s.type));
    if (!hit) continue;
    usedSheet.add(hit.id + hit.type);
    usedLocal.add(l.id);
    const key = pairKey(l, hit);
    if (!ignored.has(key)) out.push({ key, level: 'exact', local: l, sheet: hit });
  }

  const sheetByBase = new Map<string, Transaction[]>();
  for (const s of sheet) {
    if (!s.date || usedSheet.has(s.id + s.type)) continue;
    const k = base(s);
    sheetByBase.set(k, [...(sheetByBase.get(k) ?? []), s]);
  }
  for (const l of local) {
    if (!l.date || usedLocal.has(l.id)) continue;
    const hit = sheetByBase.get(base(l))?.find((s) => !usedSheet.has(s.id + s.type) && similarText(l.description, s.description));
    if (!hit) continue;
    usedSheet.add(hit.id + hit.type);
    usedLocal.add(l.id);
    const key = pairKey(l, hit);
    if (!ignored.has(key)) out.push({ key, level: 'likely', local: l, sheet: hit });
  }

  return out.sort((a, b) => b.local.date.localeCompare(a.local.date) || (a.level === b.level ? 0 : a.level === 'exact' ? -1 : 1));
}

/** Berapa banyak yang terhitung dua kali (salah satu salinan dari tiap pasangan), per jenis. Rekening KREDIT tidak memengaruhi kas. */
export function doubleCounted(pairs: DupPair[]): { expense: number; income: number } {
  let expense = 0;
  let income = 0;
  for (const p of pairs) {
    if (p.level !== 'exact' || isCreditAccount(p.local.account)) continue;
    if (p.local.type === 'income') income += p.local.total;
    else expense += p.local.total;
  }
  return { expense, income };
}

const KEY = 'budgettracker.dupignore.v1';
const MAX_IGNORED = 500;

export function loadIgnored(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string').slice(-MAX_IGNORED) : []);
  } catch {
    return new Set();
  }
}

export function saveIgnored(set: ReadonlySet<string>): void {
  try {
    const arr = [...set].slice(-MAX_IGNORED);
    if (arr.length) localStorage.setItem(KEY, JSON.stringify(arr));
    else localStorage.removeItem(KEY);
  } catch {
    // diblokir: berlaku selama halaman terbuka
  }
}
