import {
  Baby, BookOpen, Car, Coffee, Dumbbell, Gamepad2, Heart, Home, Music, PawPrint, Plane, Tag, type LucideIcon,
} from 'lucide-react';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_META, INCOME_CATEGORIES, INCOME_CATEGORY_META, type CategoryMeta } from './categories';

export const CUSTOM_KEY = 'budgettracker.cats.v1';
export const MAX_CUSTOM = 20;
export const MAX_NAME = 20;

export const CUSTOM_ICONS: Record<string, LucideIcon> = {
  tag: Tag, heart: Heart, plane: Plane, home: Home, car: Car, book: BookOpen,
  music: Music, gym: Dumbbell, baby: Baby, pet: PawPrint, game: Gamepad2, coffee: Coffee,
};

export interface CustomCategory { name: string; type: 'expense' | 'income'; icon: string }

export function cleanCustom(value: unknown): CustomCategory[] {
  if (!Array.isArray(value)) return [];
  const out: CustomCategory[] = [];
  const seen = new Set<string>();
  for (const v of value) {
    if (!v || typeof v !== 'object') continue;
    const c = v as Record<string, unknown>;
    if ((c.type !== 'expense' && c.type !== 'income') || typeof c.name !== 'string') continue;
    const name = c.name.trim().replace(/\s+/g, ' ');
    const key = name.toLowerCase();
    if (!name || name.length > MAX_NAME || /[#<>]/.test(name) || seen.has(key)) continue;
    seen.add(key);
    out.push({ name, type: c.type, icon: typeof c.icon === 'string' && c.icon in CUSTOM_ICONS ? c.icon : 'tag' });
    if (out.length >= MAX_CUSTOM) break;
  }
  return out;
}

export function loadCustom(): CustomCategory[] {
  try { return cleanCustom(JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? '[]')); } catch { return []; }
}
function save(list: CustomCategory[]): void {
  try { if (list.length) localStorage.setItem(CUSTOM_KEY, JSON.stringify(list)); else localStorage.removeItem(CUSTOM_KEY); } catch { /* abaikan */ }
}

function metaFor(c: CustomCategory): CategoryMeta {
  return c.type === 'expense'
    ? { label: c.name, icon: CUSTOM_ICONS[c.icon], color: 'text-brand-700', bg: 'bg-brand-100' }
    : { label: c.name, icon: CUSTOM_ICONS[c.icon], color: 'text-brand-800', bg: 'bg-brand-200' };
}

function register(c: CustomCategory): void {
  const list = c.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  if (list.includes(c.name)) return;
  const others = list.indexOf('Others');
  if (others >= 0) list.splice(others, 0, c.name); else list.push(c.name);
  (c.type === 'expense' ? EXPENSE_CATEGORY_META : INCOME_CATEGORY_META)[c.name] = metaFor(c);
}

function unregister(c: CustomCategory): void {
  const list = c.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const i = list.indexOf(c.name);
  if (i >= 0) list.splice(i, 1);
  delete (c.type === 'expense' ? EXPENSE_CATEGORY_META : INCOME_CATEGORY_META)[c.name];
}

/** Dipanggil sekali saat aplikasi dimuat, sebelum render pertama. */
export function initCustomCategories(): void {
  for (const c of loadCustom()) register(c);
}

export type AddResult = { ok: true } | { ok: false; reason: 'empty' | 'long' | 'chars' | 'dup' | 'max' };

export function addCustom(name: string, type: 'expense' | 'income', icon: string): AddResult {
  const n = name.trim().replace(/\s+/g, ' ');
  if (!n) return { ok: false, reason: 'empty' };
  if (n.length > MAX_NAME) return { ok: false, reason: 'long' };
  if (/[#<>]/.test(n)) return { ok: false, reason: 'chars' };
  const all = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, 'Transfer', 'Others'];
  if (all.some((x) => x.toLowerCase() === n.toLowerCase())) return { ok: false, reason: 'dup' };
  const cur = loadCustom();
  if (cur.length >= MAX_CUSTOM) return { ok: false, reason: 'max' };
  const c: CustomCategory = { name: n, type, icon: icon in CUSTOM_ICONS ? icon : 'tag' };
  save([...cur, c]);
  register(c);
  return { ok: true };
}

export function removeCustom(name: string, type: 'expense' | 'income'): void {
  const cur = loadCustom();
  const hit = cur.find((c) => c.name === name && c.type === type);
  if (!hit) return;
  save(cur.filter((c) => c !== hit));
  unregister(hit);
}
