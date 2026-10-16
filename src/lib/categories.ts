import {
  Film, UtensilsCrossed, ShoppingCart, Cookie, Bus, Wrench,
  Briefcase, Gift, Coins, CircleDollarSign, ArrowLeftRight, CreditCard, Landmark,
  type LucideIcon,
} from 'lucide-react';

export interface CategoryMeta {
  label: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}

/**
 * Transfer antar rekening: uangnya hanya pindah tempat, jadi bukan pemasukan atau pengeluaran.
 * Transfer tidak tampil di daftar transaksi dan tidak masuk total, grafik, atau batas harian,
 * tapi tetap memengaruhi saldo rekening: Transfer di sheet Income menambah saldo rekening itu,
 * Transfer di sheet Expense mengurangi saldonya.
 */
export const TRANSFER_CATEGORY = 'Transfer';

export const isTransferCategory = (category: string) => category.trim().toLowerCase() === 'transfer';

/**
 * Pembayaran pokok utang (cicilan paylater, pinjaman). Uangnya benar-benar keluar dari rekening, jadi tampil di daftar dan
 * mengurangi saldo rekening, tetapi bukan konsumsi baru: pembelian yang dibayar dengan utang itu sudah dihitung sebagai
 * pengeluaran saat dibeli. Karena itu tidak masuk total pengeluaran, grafik, anggaran, laporan, dan batas harian.
 * Bunga atau biaya dicatat terpisah sebagai pengeluaran biasa (kategori Paylater).
 */
export const DEBT_PAYMENT_CATEGORY = 'Debt Payment';

export const isDebtPaymentCategory = (category: string) => category.trim().toLowerCase() === 'debt payment';

/** Bukan konsumsi: transfer antar rekening dan pembayaran pokok utang. */
export const isNonSpendingCategory = (category: string) => isTransferCategory(category) || isDebtPaymentCategory(category);

/**
 * Rekening bayangan untuk pembelian yang dibayar dengan utang (paylater, cicilan, kartu kredit). Pembelian tetap dihitung
 * sebagai pengeluaran, tetapi tidak mengurangi saldo bank atau e-wallet karena belum ada uang yang keluar.
 */
export const CREDIT_ACCOUNT = 'KREDIT';

export const isCreditAccount = (account: string) => account.trim().toUpperCase() === CREDIT_ACCOUNT;

export const EXPENSE_CATEGORIES: string[] = [
  'Entertainment',
  'Food & Drink',
  'Groceries',
  'Snacks',
  'Transportation',
  'Service',
  'Paylater',
];

export const INCOME_CATEGORIES: string[] = ['Salary', 'Bonus', 'Others'];

export const EXPENSE_CATEGORY_META: Record<string, CategoryMeta> = {
  Entertainment: { label: 'Entertainment', icon: Film, color: 'text-purple-600', bg: 'bg-purple-100' },
  'Food & Drink': { label: 'Food & Drink', icon: UtensilsCrossed, color: 'text-orange-600', bg: 'bg-orange-100' },
  Groceries: { label: 'Groceries', icon: ShoppingCart, color: 'text-green-600', bg: 'bg-green-100' },
  Snacks: { label: 'Snacks', icon: Cookie, color: 'text-pink-600', bg: 'bg-pink-100' },
  Transportation: { label: 'Transportation', icon: Bus, color: 'text-blue-600', bg: 'bg-blue-100' },
  Service: { label: 'Service', icon: Wrench, color: 'text-cyan-600', bg: 'bg-cyan-100' },
  Paylater: { label: 'Paylater', icon: CreditCard, color: 'text-indigo-600', bg: 'bg-indigo-100' },
};

export const INCOME_CATEGORY_META: Record<string, CategoryMeta> = {
  Salary: { label: 'Salary', icon: Briefcase, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  Bonus: { label: 'Bonus', icon: Gift, color: 'text-teal-600', bg: 'bg-teal-100' },
  Others: { label: 'Others', icon: Coins, color: 'text-amber-600', bg: 'bg-amber-100' },
};

const DEBT_PAYMENT_META: CategoryMeta = { label: 'Debt Payment', icon: Landmark, color: 'text-violet-600', bg: 'bg-violet-100' };
const TRANSFER_META: CategoryMeta = { label: 'Transfer', icon: ArrowLeftRight, color: 'text-slate-600', bg: 'bg-slate-100' };

export function getCategoryMeta(category: string, type: 'expense' | 'income'): CategoryMeta {
  if (isTransferCategory(category)) return TRANSFER_META;
  if (isDebtPaymentCategory(category)) return DEBT_PAYMENT_META;
  if (type === 'expense') {
    return EXPENSE_CATEGORY_META[category] ?? { label: category, icon: CircleDollarSign, color: 'text-slate-600', bg: 'bg-slate-100' };
  }
  return INCOME_CATEGORY_META[category] ?? { label: category, icon: Coins, color: 'text-amber-600', bg: 'bg-amber-100' };
}

export const DAILY_TARGET = 50000;

// ---------------------------------------------------------------------------
// Bank dan e-wallet
// ---------------------------------------------------------------------------

export interface AccountMeta {
  /** Nama yang disimpan di transaksi dan Google Sheets. */
  name: string;
  kind: 'bank' | 'ewallet';
  /** Singkatan di avatar. Bukan logo resmi, hanya monogram. */
  mono: string;
  /** Kelas Tailwind untuk avatar (latar + teks). Ditulis utuh supaya ikut terbaca Tailwind. */
  avatar: string;
  /** Lencana kecil di daftar transaksi. */
  soft: string;
  /** Alias penulisan lain yang dikenali saat impor Excel, sudah dinormalkan (huruf kecil tanpa spasi/tanda baca). */
  aliases: string[];
}

export const ACCOUNT_CATALOG: AccountMeta[] = [
  { name: 'BCA', kind: 'bank', mono: 'BCA', avatar: 'bg-blue-600 text-white', soft: 'bg-blue-50 text-blue-700', aliases: ['bankbca'] },
  { name: 'MANDIRI', kind: 'bank', mono: 'MDR', avatar: 'bg-blue-900 text-yellow-300', soft: 'bg-indigo-50 text-indigo-800', aliases: ['bankmandiri'] },
  { name: 'BNI', kind: 'bank', mono: 'BNI', avatar: 'bg-orange-500 text-white', soft: 'bg-orange-50 text-orange-700', aliases: ['bankbni'] },
  { name: 'BRI', kind: 'bank', mono: 'BRI', avatar: 'bg-sky-700 text-white', soft: 'bg-sky-50 text-sky-800', aliases: ['bankbri'] },
  { name: 'SEABANK', kind: 'bank', mono: 'SEA', avatar: 'bg-teal-500 text-white', soft: 'bg-teal-50 text-teal-700', aliases: ['seabank', 'sea'] },
  { name: 'BANK JAGO', kind: 'bank', mono: 'JGO', avatar: 'bg-amber-400 text-slate-900', soft: 'bg-amber-50 text-amber-800', aliases: ['jago', 'bankjago'] },
  { name: 'KROM', kind: 'bank', mono: 'KRM', avatar: 'bg-fuchsia-700 text-white', soft: 'bg-fuchsia-50 text-fuchsia-700', aliases: ['krombank', 'bankkrom'] },
  { name: 'DANA', kind: 'ewallet', mono: 'DNA', avatar: 'bg-sky-500 text-white', soft: 'bg-sky-50 text-sky-700', aliases: ['danaid'] },
  { name: 'OVO', kind: 'ewallet', mono: 'OVO', avatar: 'bg-violet-600 text-white', soft: 'bg-violet-50 text-violet-700', aliases: [] },
  { name: 'GOPAY', kind: 'ewallet', mono: 'GPY', avatar: 'bg-emerald-500 text-white', soft: 'bg-emerald-50 text-emerald-700', aliases: ['gopay'] },
  { name: 'SHOPEEPAY', kind: 'ewallet', mono: 'SPY', avatar: 'bg-[#EE4D2D] text-white', soft: 'bg-orange-50 text-orange-700', aliases: ['shopee', 'spay'] },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const CATALOG_BY_NAME = new Map(ACCOUNT_CATALOG.map((a) => [a.name, a]));

/** Nama kanonik dari tulisan bebas ("Bank Jago", "go-pay", "bca"). Tulisan yang tidak dikenal dikembalikan apa adanya. */
export function canonicalAccount(value: string): string {
  const n = norm(value);
  if (!n) return value.trim();
  for (const a of ACCOUNT_CATALOG) {
    if (norm(a.name) === n || a.aliases.includes(n)) return a.name;
  }
  return value.trim();
}

const FALLBACK_AVATAR = 'bg-slate-500 text-white';
const FALLBACK_SOFT = 'bg-slate-100 text-slate-600';

/** Info tampilan sebuah rekening. Rekening di luar katalog (mis. "Cash") tetap dapat tampilan netral. */
export function getAccountMeta(name: string): AccountMeta {
  const known = CATALOG_BY_NAME.get(name);
  if (known) return known;
  if (isCreditAccount(name)) {
    return { name, kind: 'bank', mono: 'KRD', avatar: 'bg-violet-600 text-white', soft: 'bg-violet-50 text-violet-700', aliases: [] };
  }
  const trimmed = name.trim();
  return {
    name,
    kind: 'bank',
    mono: (trimmed.replace(/[^A-Za-z0-9]/g, '').slice(0, 3) || '?').toUpperCase(),
    avatar: FALLBACK_AVATAR,
    soft: FALLBACK_SOFT,
    aliases: [],
  };
}
