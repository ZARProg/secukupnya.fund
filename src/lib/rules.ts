import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, isNonSpendingCategory } from './categories';
import type { Transaction } from './transactions';

/**
 * Aturan kategori otomatis buatan pengguna: "keterangan mengandung X → kategori Y".
 * Aturan hanya MENYARANKAN kategori. Tidak ada transaksi yang diubah diam-diam, dan pilihan yang sudah dibuat pengguna
 * (kategori yang dipilih sendiri, #tag di Quick Add) selalu menang.
 */

export type RuleType = 'expense' | 'income';

export interface Rule {
  id: string;
  /** Satu atau beberapa kata kunci (cocok kalau salah satunya ada di keterangan). */
  keywords: string[];
  category: string;
  type: RuleType;
}

export const MAX_RULES = 200;
export const MAX_KEYWORDS = 10;
export const MAX_KEYWORD_LENGTH = 40;
export const MIN_KEYWORD_LENGTH = 2;

/** Huruf kecil, tanpa aksen, spasi dirapikan. Dipakai untuk membandingkan kata kunci dengan keterangan. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function categoriesFor(type: RuleType): string[] {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

/** "gojek, grab" → ['gojek','grab']. Duplikat dan kata terlalu pendek dibuang. */
export function parseKeywords(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of input.split(/[,\n;|]/)) {
    const kw = part.trim().replace(/\s+/g, ' ').slice(0, MAX_KEYWORD_LENGTH);
    const key = normalizeText(kw);
    if (key.length < MIN_KEYWORD_LENGTH || seen.has(key)) continue;
    seen.add(key);
    out.push(kw);
    if (out.length >= MAX_KEYWORDS) break;
  }
  return out;
}

/** Baca data tersimpan/backup. Aturan yang rusak atau kategorinya tidak dikenal dibuang. */
export function cleanRules(raw: unknown): Rule[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set<string>();
  const out: Rule[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const type: RuleType = o.type === 'income' ? 'income' : 'expense';
    const category = typeof o.category === 'string' ? o.category : '';
    if (!categoriesFor(type).includes(category)) continue;
    const keywords = Array.isArray(o.keywords) ? parseKeywords(o.keywords.filter((k): k is string => typeof k === 'string').join(',')) : [];
    if (!keywords.length) continue;
    let id = typeof o.id === 'string' && o.id ? o.id.slice(0, 80) : '';
    if (!id || ids.has(id)) id = `r-${out.length}-${Math.random().toString(36).slice(2, 8)}`;
    ids.add(id);
    out.push({ id, keywords, category, type });
    if (out.length >= MAX_RULES) break;
  }
  return out;
}

export interface RuleMatch {
  rule: Rule;
  keyword: string;
}

/** Aturan pertama (urutan daftar) yang cocok. Jenis transaksi harus sama dengan jenis aturan. */
export function matchRule(rules: Rule[], description: string, type: RuleType): RuleMatch | null {
  const text = normalizeText(description);
  if (!text) return null;
  for (const rule of rules) {
    if (rule.type !== type) continue;
    for (const kw of rule.keywords) {
      const key = normalizeText(kw);
      if (key.length >= MIN_KEYWORD_LENGTH && text.includes(key)) return { rule, keyword: kw };
    }
  }
  return null;
}

/** Kata kunci yang sama dipakai dua aturan dengan kategori berbeda: hanya yang paling atas yang berlaku. */
export function findConflicts(rules: Rule[]): Map<string, string> {
  const first = new Map<string, Rule>();
  const conflicts = new Map<string, string>(); // id aturan → kata kunci yang tertutup aturan di atasnya
  for (const rule of rules) {
    for (const kw of rule.keywords) {
      const k = `${rule.type}:${normalizeText(kw)}`;
      const prev = first.get(k);
      if (!prev) first.set(k, rule);
      else if (prev.category !== rule.category && !conflicts.has(rule.id)) conflicts.set(rule.id, kw);
    }
  }
  return conflicts;
}

/** Berapa transaksi yang sudah ada akan dapat kategori dari tiap aturan (hanya hitungan, tidak mengubah apa pun). */
export function ruleHits(rules: Rule[], transactions: Transaction[]): Map<string, { total: number; differs: number }> {
  const out = new Map<string, { total: number; differs: number }>();
  for (const tx of transactions) {
    if (isNonSpendingCategory(tx.category)) continue;
    const m = matchRule(rules, tx.description, tx.type);
    if (!m) continue;
    const cur = out.get(m.rule.id) ?? { total: 0, differs: 0 };
    cur.total++;
    if (tx.category !== m.rule.category) cur.differs++;
    out.set(m.rule.id, cur);
  }
  return out;
}

/** Kategori dianggap "belum ada" kalau kosong atau bukan salah satu kategori aplikasi (mis. teks bebas dari file Excel). */
export function isUnknownCategory(category: string, type: RuleType): boolean {
  const c = category.trim();
  if (!c) return true;
  if (isNonSpendingCategory(c)) return false;
  return !categoriesFor(type).includes(c);
}

export interface RuleSuggestion {
  category: string;
  rule: Rule;
  keyword: string;
  /** True kalau menggantikan kategori yang sudah ada di data (bukan mengisi yang kosong/tidak dikenal). */
  overrides: boolean;
}

/**
 * Saran untuk satu baris impor. Secara bawaan hanya baris yang kategorinya kosong atau tidak dikenal yang disarankan;
 * `overrideExisting` juga menyarankan pengganti untuk kategori yang valid. Transfer dan Debt Payment tidak pernah disentuh.
 */
export function suggestForImport(
  rules: Rule[],
  p: { description: string; type: RuleType; category: string },
  overrideExisting: boolean,
): RuleSuggestion | null {
  if (isNonSpendingCategory(p.category)) return null;
  const unknown = isUnknownCategory(p.category, p.type);
  if (!unknown && !overrideExisting) return null;
  const m = matchRule(rules, p.description, p.type);
  if (!m || m.rule.category === p.category) return null;
  return { category: m.rule.category, rule: m.rule, keyword: m.keyword, overrides: !unknown };
}
