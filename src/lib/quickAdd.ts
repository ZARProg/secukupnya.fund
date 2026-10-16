import {
  ACCOUNT_CATALOG, EXPENSE_CATEGORIES, INCOME_CATEGORIES, isCreditAccount, isNonSpendingCategory,
} from './categories';
import { parseISODate, toLocalISO } from './date';
import { matchRule, type Rule } from './rules';
import type { Transaction } from './transactions';

/**
 * Quick Add: mengubah teks seperti "25000 kopi BCA hari ini" menjadi transaksi yang siap diperiksa.
 * Hasilnya hanya tebakan. Tidak ada yang disimpan sebelum pengguna memeriksa dan menyetujuinya.
 */

export const MAX_QUICK_AMOUNT = 1_000_000_000_000;
export const MAX_DESCRIPTION = 100;

export type QuickWarning =
  | 'noAmount'
  | 'multipleAmounts'
  | 'badDate'
  | 'futureDate'
  | 'noAccount'
  | 'noAccounts'
  | 'accountNotSelected'
  | 'noCategory'
  | 'debtHint';

export type Source = 'text' | 'rule' | 'learned' | 'keyword' | 'last' | 'only' | 'default' | 'none';

export interface QuickHints {
  /** Rekening yang dipilih pengguna. */
  accounts: string[];
  lastAccount?: string;
  lastCategory?: { expense?: string; income?: string };
  /** kata → kategori yang pernah dipakai pengguna. */
  learned?: Record<string, string>;
  /** Aturan kategori buatan pengguna. Kalah dari #tag, menang atas tebakan otomatis. */
  rules?: Rule[];
  /** yyyy-MM-dd */
  today: string;
}

export interface QuickRow {
  raw: string;
  ok: boolean;
  type: 'expense' | 'income';
  total: number;
  description: string;
  account: string;
  accountFrom: Source;
  category: string;
  categoryFrom: Source;
  /** Kata kunci aturan yang menentukan kategori (hanya kalau categoryFrom = 'rule'). */
  ruleKeyword?: string;
  date: string;
  dateFrom: 'text' | 'default';
  warnings: QuickWarning[];
}

// ---------- Kamus ----------

const KEYWORDS: Record<string, string[]> = {
  'Food & Drink': [
    'makan', 'makanan', 'minum', 'minuman', 'kopi', 'coffee', 'boba', 'teh', 'nasi', 'ayam', 'bakso', 'mie', 'mi', 'soto',
    'sate', 'resto', 'restoran', 'warung', 'kantin', 'gofood', 'grabfood', 'shopeefood', 'lunch', 'dinner', 'sarapan',
    'breakfast', 'cafe', 'kafe', 'starbucks', 'jus', 'susu', 'burger', 'pizza',
  ],
  Snacks: ['snack', 'jajan', 'cemilan', 'camilan', 'gorengan', 'keripik', 'roti', 'cokelat', 'coklat', 'permen', 'cilok'],
  Groceries: [
    'belanja', 'sayur', 'buah', 'groceries', 'indomaret', 'alfamart', 'supermarket', 'pasar', 'beras', 'telur', 'minyak',
    'sabun', 'shampo', 'sampo', 'sembako', 'minimarket',
  ],
  Transportation: [
    'grab', 'gojek', 'ojek', 'ojol', 'bensin', 'pertamax', 'pertalite', 'parkir', 'tol', 'krl', 'mrt', 'lrt', 'transjakarta',
    'busway', 'bus', 'taksi', 'taxi', 'kereta', 'angkot', 'ongkos', 'bbm',
  ],
  Entertainment: ['nonton', 'bioskop', 'netflix', 'spotify', 'game', 'steam', 'konser', 'youtube', 'disney', 'vidio', 'karaoke', 'wisata'],
  Service: [
    'listrik', 'pln', 'token', 'pulsa', 'kuota', 'internet', 'wifi', 'indihome', 'pdam', 'laundry', 'cukur', 'salon', 'servis',
    'service', 'langganan', 'ongkir', 'admin', 'pajak', 'asuransi', 'bpjs', 'sewa', 'kos', 'kontrakan',
  ],
};

const INCOME_KEYWORDS: Record<string, string[]> = {
  Salary: ['gaji', 'salary'],
  Bonus: ['bonus', 'thr'],
};
const INCOME_WORDS = ['gaji', 'salary', 'bonus', 'thr', 'pemasukan', 'income', 'diterima', 'terima', 'refund', 'cashback'];

const TAG_ALIASES: Record<string, string> = {
  food: 'Food & Drink', makan: 'Food & Drink', drink: 'Food & Drink', minum: 'Food & Drink',
  snack: 'Snacks', snacks: 'Snacks', jajan: 'Snacks',
  grocery: 'Groceries', groceries: 'Groceries', belanja: 'Groceries',
  transport: 'Transportation', transportasi: 'Transportation', transportation: 'Transportation',
  fun: 'Entertainment', hiburan: 'Entertainment', entertainment: 'Entertainment',
  service: 'Service', jasa: 'Service', tagihan: 'Service',
  paylater: 'Paylater',
  salary: 'Salary', gaji: 'Salary', bonus: 'Bonus', others: 'Others', lain: 'Others', lainnya: 'Others',
};

const STOP_WORDS = new Set([
  'bayar', 'beli', 'buat', 'bikin', 'untuk', 'dan', 'yang', 'dari', 'dengan', 'tadi', 'hari', 'ini', 'sama', 'pake',
  'pakai', 'via', 'total', 'biaya', 'lagi', 'the', 'for', 'and', 'with',
]);

const DEBT_HINT = /\b(paylater|spaylater|cicilan|cicil|kredivo|akulaku|pinjol|utang|hutang|kartu\s+kredit)\b/i;

const MONTHS: Record<string, number> = {
  januari: 1, january: 1, jan: 1, februari: 2, february: 2, feb: 2, maret: 3, march: 3, mar: 3, april: 4, apr: 4,
  mei: 5, may: 5, juni: 6, june: 6, jun: 6, juli: 7, july: 7, jul: 7, agustus: 8, august: 8, agu: 8, ags: 8, aug: 8,
  september: 9, sept: 9, sep: 9, oktober: 10, october: 10, okt: 10, oct: 10, november: 11, nov: 11, desember: 12,
  december: 12, des: 12, dec: 12,
};
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------- Tanggal ----------

function validDate(y: number, m: number, d: number): string | null {
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return toLocalISO(dt);
}

function shiftDays(iso: string, n: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toLocalISO(d);
}

interface DateHit {
  date: string | null;
  start: number;
  end: number;
}

function findDate(text: string, today: string): DateHit | null {
  const [ty, tm] = today.split('-').map(Number);
  const tryRe = (re: RegExp, make: (m: RegExpExecArray) => string | null): DateHit | null => {
    const m = re.exec(text);
    return m ? { date: make(m), start: m.index, end: m.index + m[0].length } : null;
  };
  return (
    tryRe(/\b(\d{4})-(\d{2})-(\d{2})\b/, (m) => validDate(+m[1], +m[2], +m[3])) ??
    tryRe(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, (m) => {
      const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : ty;
      const iso = validDate(y, +m[2], +m[1]);
      return iso && !m[3] && iso > today ? validDate(y - 1, +m[2], +m[1]) : iso;
    }) ??
    tryRe(new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_RE})\\b\\.?(?:\\s+(\\d{4}))?`, 'i'), (m) => {
      const mon = MONTHS[m[2].toLowerCase()];
      const iso = validDate(m[3] ? +m[3] : ty, mon, +m[1]);
      return iso && !m[3] && iso > today ? validDate(ty - 1, mon, +m[1]) : iso;
    }) ??
    tryRe(/\b(?:tgl|tanggal|tg)\.?\s*(\d{1,2})\b/i, (m) => validDate(ty, tm, +m[1])) ??
    tryRe(/\bkemarin\s+lusa\b|\blusa\s+kemarin\b/i, () => shiftDays(today, -2)) ??
    tryRe(/\b(\d{1,3})\s*(?:hari\s+lalu|hr\s+lalu|days?\s+ago)\b/i, (m) => shiftDays(today, -Number(m[1]))) ??
    tryRe(/\bkemarin\b|\byesterday\b/i, () => shiftDays(today, -1)) ??
    tryRe(/\bhari\s+ini\b|\bhr\s+ini\b|\btoday\b|\btadi\b|\bbarusan\b/i, () => today)
  );
}

// ---------- Nominal ----------

export function parseAmountToken(raw: string): { value: number; suffixed: boolean } | null {
  const t = raw.toLowerCase().replace(/^rp\.?/, '').replace(/[.,;:!?]+$/, '');
  if (!t) return null;
  let m = /^(\d+(?:[.,]\d+)?)(rb|ribu|k|jt|juta|mil|million)$/.exec(t);
  if (m) {
    const mult = ['jt', 'juta', 'mil', 'million'].includes(m[2]) ? 1_000_000 : 1_000;
    const v = Math.round(parseFloat(m[1].replace(',', '.')) * mult);
    return v > 0 && v <= MAX_QUICK_AMOUNT ? { value: v, suffixed: true } : null;
  }
  if (/^\d{1,3}(?:\.\d{3})+$/.test(t) || /^\d{1,3}(?:,\d{3})+$/.test(t)) {
    return { value: Number(t.replace(/[.,]/g, '')), suffixed: false };
  }
  m = /^(\d+)$/.exec(t);
  if (m) {
    const v = Number(m[1]);
    return v > 0 && v <= MAX_QUICK_AMOUNT ? { value: v, suffixed: false } : null;
  }
  return null;
}

// ---------- Kategori ----------

export function categoryTag(category: string): string {
  const alias = Object.entries(TAG_ALIASES).find(([, c]) => c === category);
  return alias ? alias[0] : norm(category);
}

function resolveTag(tag: string, type: 'expense' | 'income', known: string[]): string | null {
  const t = norm(tag);
  if (!t) return null;
  const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const alias = TAG_ALIASES[t];
  if (alias && list.includes(alias)) return alias;
  const pool = Array.from(new Set([...list, ...known]));
  const exact = pool.find((c) => norm(c) === t);
  if (exact) return exact;
  const prefix = pool.filter((c) => norm(c).startsWith(t));
  return t.length >= 3 && prefix.length === 1 ? prefix[0] : null;
}

export function learnableWords(description: string): string[] {
  const words = description.toLowerCase().match(/[a-z]{4,}/g) ?? [];
  return Array.from(new Set(words.filter((w) => !STOP_WORDS.has(w)))).slice(0, 3);
}

function guessCategory(
  words: string[], type: 'expense' | 'income', hints: QuickHints,
): { category: string; from: Source } {
  const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  for (const w of words) {
    const c = hints.learned?.[w];
    if (c && list.includes(c)) return { category: c, from: 'learned' };
  }
  const table = type === 'income' ? INCOME_KEYWORDS : KEYWORDS;
  for (const w of words) {
    for (const [cat, keys] of Object.entries(table)) if (keys.includes(w)) return { category: cat, from: 'keyword' };
  }
  const last = hints.lastCategory?.[type];
  if (last && list.includes(last)) return { category: last, from: 'last' };
  return type === 'income'
    ? { category: INCOME_CATEGORIES[0], from: 'default' }
    : { category: EXPENSE_CATEGORIES[1], from: 'default' };
}

// ---------- Rekening ----------

interface AccountNeedle {
  name: string;
  re: RegExp;
}

function accountNeedles(selected: string[]): AccountNeedle[] {
  const entries = new Map<string, Set<string>>();
  const add = (name: string, label: string) => {
    if (!entries.has(name)) entries.set(name, new Set());
    entries.get(name)?.add(label);
  };
  for (const a of ACCOUNT_CATALOG) {
    add(a.name, a.name);
    for (const al of a.aliases) add(a.name, al);
  }
  for (const s of selected) add(s, s);
  const out: AccountNeedle[] = [];
  for (const [name, labels] of entries) {
    for (const label of labels) {
      const pattern = label.split(/\s+/).map(escapeRe).join('[\\s-]?');
      out.push({ name, re: new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, 'iu') });
    }
  }
  return out;
}

// ---------- Parser ----------

function blank(s: string, start: number, end: number): string {
  return s.slice(0, start) + ' '.repeat(end - start) + s.slice(end);
}

export function parseQuickLine(line: string, hints: QuickHints): QuickRow {
  const warnings: QuickWarning[] = [];
  let s = line.trim();

  // Kategori lewat #tag.
  const tags: string[] = [];
  s = s.replace(/(^|\s)#([\p{L}\p{N}_-]+)/gu, (_m, pre: string, tag: string) => {
    tags.push(tag);
    return pre;
  });

  // Tanggal.
  let date = hints.today;
  let dateFrom: QuickRow['dateFrom'] = 'default';
  const dateHit = findDate(s, hints.today);
  if (dateHit) {
    s = blank(s, dateHit.start, dateHit.end);
    if (dateHit.date) {
      date = dateHit.date;
      dateFrom = 'text';
      if (date > hints.today) warnings.push('futureDate');
    } else {
      warnings.push('badDate');
    }
  }

  // Rekening: pilih yang muncul paling awal (yang lebih panjang kalau sama).
  let account = '';
  let accountFrom: Source = 'none';
  let best: { start: number; end: number; name: string } | null = null;
  for (const n of accountNeedles(hints.accounts)) {
    const m = n.re.exec(s);
    if (!m) continue;
    const cand = { start: m.index, end: m.index + m[0].length, name: n.name };
    if (!best || cand.start < best.start || (cand.start === best.start && cand.end > best.end)) best = cand;
  }
  if (best) {
    s = blank(s, best.start, best.end);
    if (hints.accounts.includes(best.name)) {
      account = best.name;
      accountFrom = 'text';
    } else {
      warnings.push('accountNotSelected');
    }
  }

  // Nominal.
  const parts = s.split(/\s+/).filter(Boolean);
  let sign: '+' | '-' | '' = '';
  const cands: { i: number; value: number; suffixed: boolean }[] = [];
  parts.forEach((p, i) => {
    const bare = p.replace(/^[+-]/, '');
    const a = parseAmountToken(bare);
    if (!a) return;
    if (!a.suffixed && a.value < 100) return; // angka kecil biasanya bagian dari deskripsi ("2 porsi")
    cands.push({ i, ...a });
  });
  let picked: (typeof cands)[number] | null = null;
  const suffixed = cands.filter((c) => c.suffixed);
  if (suffixed.length) picked = suffixed[0];
  else if (cands.length) picked = cands.reduce((a, b) => (b.value > a.value ? b : a));
  if (cands.length > 1) warnings.push('multipleAmounts');
  if (picked) {
    const tok = parts[picked.i];
    if (tok.startsWith('+')) sign = '+';
    else if (tok.startsWith('-')) sign = '-';
  } else {
    warnings.push('noAmount');
  }
  const total = picked ? picked.value : 0;

  const wordsLeft: string[] = [];
  parts.forEach((p, i) => {
    if (picked && i === picked.i) return;
    if (/^rp\.?$/i.test(p)) return;
    if (p === '+') { sign = sign || '+'; return; }
    if (p === '-') { sign = sign || '-'; return; }
    wordsLeft.push(p);
  });

  const lowerWords = wordsLeft.map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean);
  const type: 'expense' | 'income' =
    sign === '-' ? 'expense' : sign === '+' || lowerWords.some((w) => INCOME_WORDS.includes(w)) ? 'income' : 'expense';

  // Kategori.
  let category = '';
  let categoryFrom: Source = 'none';
  for (const tag of tags) {
    const c = resolveTag(tag, type, []);
    if (c) { category = c; categoryFrom = 'text'; break; }
  }
  let ruleName = '';
  if (!category && hints.rules?.length) {
    const m = matchRule(hints.rules, wordsLeft.join(' '), type);
    if (m) { category = m.rule.category; categoryFrom = 'rule'; ruleName = m.keyword; }
  }
  if (!category) {
    const g = guessCategory(lowerWords, type, hints);
    category = g.category;
    categoryFrom = g.from;
  }

  // Rekening cadangan.
  if (!account && !warnings.includes('accountNotSelected')) {
    if (hints.lastAccount && hints.accounts.includes(hints.lastAccount)) {
      account = hints.lastAccount;
      accountFrom = 'last';
    } else if (hints.accounts.length === 1) {
      account = hints.accounts[0];
      accountFrom = 'only';
    }
  }
  if (!account) warnings.push(hints.accounts.length ? 'noAccount' : 'noAccounts');
  if (DEBT_HINT.test(line)) warnings.push('debtHint');

  let description = wordsLeft.join(' ').replace(/\s+/g, ' ').trim();
  description = (description.charAt(0).toUpperCase() + description.slice(1)).slice(0, MAX_DESCRIPTION).trim();

  return {
    raw: line, ok: total > 0 && !!account && !!category, type, total, description, account, accountFrom,
    category, categoryFrom, ruleKeyword: ruleName || undefined, date, dateFrom, warnings,
  };
}

export function parseQuickText(text: string, hints: QuickHints): QuickRow[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 50)
    .map((l) => parseQuickLine(l, hints));
}

// ---------- Saran tombol cepat ----------

export interface Suggestion {
  type: 'expense' | 'income';
  description: string;
  category: string;
  account: string;
  total: number;
  count: number;
}

/** Transaksi yang sering diulang (deskripsi, kategori, rekening sama) dalam 90 hari terakhir. */
export function frequentSuggestions(transactions: Transaction[], today: string, limit = 6): Suggestion[] {
  const since = shiftDays(today, -90);
  const groups = new Map<string, { s: Suggestion; totals: Map<number, number>; last: string }>();
  for (const tx of transactions) {
    if (!tx.date || tx.date < since || tx.date > today) continue;
    if (isNonSpendingCategory(tx.category) || isCreditAccount(tx.account)) continue;
    const desc = tx.description.trim();
    if (!desc || !tx.account || tx.total < 100) continue;
    const key = [tx.type, desc.toLowerCase(), tx.category, tx.account].join('|');
    let g = groups.get(key);
    if (!g) {
      g = { s: { type: tx.type, description: desc, category: tx.category, account: tx.account, total: tx.total, count: 0 }, totals: new Map(), last: tx.date };
      groups.set(key, g);
    }
    g.s.count++;
    g.totals.set(tx.total, (g.totals.get(tx.total) ?? 0) + 1);
    if (tx.date >= g.last) g.last = tx.date;
  }
  return Array.from(groups.values())
    .filter((g) => g.s.count >= 2)
    .map((g) => {
      const [mode] = Array.from(g.totals).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
      return { ...g, s: { ...g.s, total: mode } };
    })
    .sort((a, b) => b.s.count - a.s.count || b.last.localeCompare(a.last))
    .slice(0, limit)
    .map((g) => g.s);
}

/** Baris teks yang kalau di-parse menghasilkan transaksi yang sama dengan saran ini. */
export function suggestionLine(s: { type: 'expense' | 'income'; description: string; category: string; account: string; total: number }): string {
  const sign = s.type === 'income' ? '+' : '';
  return [s.total >= 100 ? `${sign}${s.total}` : sign, s.description, s.account, `#${categoryTag(s.category)}`]
    .filter(Boolean)
    .join(' ');
}
