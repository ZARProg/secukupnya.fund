import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './categories';
import { MAX_QUICK_AMOUNT, learnableWords } from './quickAdd';
import { newId } from './plans';

/** Ingatan Quick Add: rekening dan kategori terakhir, kata yang pernah dikategorikan, dan favorit. */

export const MAX_LEARNED = 300;
export const MAX_FAVORITES = 8;
const KEY = 'budgettracker.quick.v1';

export interface Favorite {
  id: string;
  type: 'expense' | 'income';
  /** 0 = tanpa nominal tetap. */
  total: number;
  description: string;
  category: string;
  account: string;
}

export interface QuickMemory {
  lastAccount: string;
  lastCategory: { expense: string; income: string };
  learned: Record<string, string>;
  favorites: Favorite[];
}

export const EMPTY_MEMORY: QuickMemory = {
  lastAccount: '', lastCategory: { expense: '', income: '' }, learned: {}, favorites: [],
};

const str = (v: unknown, max = 100) => (typeof v === 'string' ? v.slice(0, max) : '');

export function cleanMemory(value: unknown): QuickMemory {
  if (!value || typeof value !== 'object') return EMPTY_MEMORY;
  const o = value as Record<string, unknown>;
  const lc = (o.lastCategory && typeof o.lastCategory === 'object' ? o.lastCategory : {}) as Record<string, unknown>;
  const learned: Record<string, string> = {};
  if (o.learned && typeof o.learned === 'object' && !Array.isArray(o.learned)) {
    for (const [w, c] of Object.entries(o.learned as Record<string, unknown>)) {
      if (/^[a-z]{4,}$/.test(w) && typeof c === 'string' && c.length <= 60) learned[w] = c;
    }
  }
  const favorites: Favorite[] = [];
  if (Array.isArray(o.favorites)) {
    for (const f of o.favorites) {
      if (!f || typeof f !== 'object') continue;
      const r = f as Record<string, unknown>;
      if (
        typeof r.id === 'string' && (r.type === 'expense' || r.type === 'income') &&
        typeof r.total === 'number' && Number.isInteger(r.total) && r.total >= 0 && r.total <= MAX_QUICK_AMOUNT &&
        typeof r.category === 'string' && typeof r.account === 'string'
      ) {
        favorites.push({
          id: r.id, type: r.type, total: r.total, description: str(r.description), category: str(r.category, 60), account: str(r.account, 60),
        });
      }
    }
  }
  return {
    lastAccount: str(o.lastAccount, 60),
    lastCategory: { expense: str(lc.expense, 60), income: str(lc.income, 60) },
    learned: Object.fromEntries(Object.entries(learned).slice(-MAX_LEARNED)),
    favorites: favorites.slice(0, MAX_FAVORITES),
  };
}

export function loadMemory(): QuickMemory {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? cleanMemory(JSON.parse(raw)) : EMPTY_MEMORY;
  } catch {
    return EMPTY_MEMORY;
  }
}

export function saveMemory(m: QuickMemory): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    // Diblokir: ingatan berlaku sampai halaman ditutup.
  }
}

export interface Saved {
  type: 'expense' | 'income';
  category: string;
  account: string;
  description: string;
}

/** Perbarui ingatan dari transaksi yang baru disimpan (setelah diperiksa pengguna, jadi koreksi ikut dipelajari). */
export function remember(mem: QuickMemory, saved: Saved[]): QuickMemory {
  let next: QuickMemory = { ...mem, lastCategory: { ...mem.lastCategory }, learned: { ...mem.learned } };
  for (const s of saved) {
    if (s.account) next.lastAccount = s.account;
    const list = s.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    if (list.includes(s.category)) {
      next.lastCategory[s.type] = s.category;
      for (const w of learnableWords(s.description)) {
        delete next.learned[w]; // pindah ke ujung supaya yang paling baru bertahan
        next.learned[w] = s.category;
      }
    }
  }
  const entries = Object.entries(next.learned);
  if (entries.length > MAX_LEARNED) next = { ...next, learned: Object.fromEntries(entries.slice(-MAX_LEARNED)) };
  return next;
}

const sameFav = (a: Omit<Favorite, 'id'>, b: Omit<Favorite, 'id'>) =>
  a.type === b.type && a.total === b.total && a.category === b.category && a.account === b.account &&
  a.description.toLowerCase() === b.description.toLowerCase();

export function addFavorite(mem: QuickMemory, fav: Omit<Favorite, 'id'>): QuickMemory | null {
  if (mem.favorites.some((f) => sameFav(f, fav))) return mem;
  if (mem.favorites.length >= MAX_FAVORITES) return null;
  return { ...mem, favorites: [...mem.favorites, { ...fav, id: newId() }] };
}

export function removeFavorite(mem: QuickMemory, id: string): QuickMemory {
  return { ...mem, favorites: mem.favorites.filter((f) => f.id !== id) };
}
