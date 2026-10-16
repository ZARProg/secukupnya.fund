import { ACCOUNT_CATALOG } from './categories';

const STORAGE_KEY = 'budgettracker.accounts.v1';

/** Urutkan sesuai katalog dan buang nama yang tidak dikenal. */
export function normalizeSelection(names: unknown): string[] {
  if (!Array.isArray(names)) return [];
  const wanted = new Set(names.filter((n): n is string => typeof n === 'string'));
  return ACCOUNT_CATALOG.map((a) => a.name).filter((n) => wanted.has(n));
}

/** Bank dan e-wallet yang dipilih pengguna. Pengguna baru belum memilih apa pun, jadi daftarnya kosong. */
export function loadAccounts(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return normalizeSelection(JSON.parse(raw));
    }
  } catch {
    /* penyimpanan diblokir atau isinya rusak: anggap belum memilih */
  }
  return [];
}

export function saveAccounts(names: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeSelection(names)));
  } catch {
    /* tidak fatal: pilihan tetap berlaku sampai halaman dimuat ulang */
  }
}
