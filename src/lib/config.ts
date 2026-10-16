import { tr } from '@/i18n';

const STORAGE_KEY = 'budgettracker.sheetUrl.v1';

/** Opsional: URL bawaan untuk development lokal lewat file .env (VITE_GOOGLE_WEB_APP_URL). */
const ENV_URL: string = (import.meta.env.VITE_GOOGLE_WEB_APP_URL as string | undefined)?.trim() ?? '';

/**
 * Hanya URL Web App Google Apps Script yang diterima. Ini mencegah data transaksi
 * terkirim ke alamat sembarangan kalau seseorang membagikan URL palsu.
 */
export const APPS_SCRIPT_URL_PATTERN =
  /^https:\/\/script\.google\.com\/(?:a\/macros\/[A-Za-z0-9.-]+\/|macros\/)s\/[A-Za-z0-9_-]+\/exec$/;

export function isValidAppsScriptUrl(value: string): boolean {
  return APPS_SCRIPT_URL_PATTERN.test(value.trim());
}

/** URL milik user ini (disimpan di browser). Tidak ada URL bawaan yang ikut ter-commit. */
export function getSheetUrl(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)?.trim();
    if (stored && isValidAppsScriptUrl(stored)) return stored;
  } catch {
    // localStorage bisa diblokir (mode privat, kebijakan browser); lanjut ke fallback.
  }
  return isValidAppsScriptUrl(ENV_URL) ? ENV_URL : '';
}

export function isUrlFromEnv(url: string): boolean {
  return Boolean(url) && url === ENV_URL;
}

export function saveSheetUrl(url: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, url.trim());
  } catch {
    throw new Error(tr('sources.storageBlocked'));
  }
}

export function clearSheetUrl(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // abaikan
  }
}

/** Tampilkan URL secara ringkas supaya ID deploy tidak terpampang penuh di layar. */
export function maskSheetUrl(url: string): string {
  const match = url.match(/\/s\/([^/]+)\/exec$/);
  if (!match) return url;
  const id = match[1];
  return `…/s/${id.slice(0, 4)}…${id.slice(-4)}/exec`;
}

// ---------- Token akses Apps Script ----------

const TOKEN_KEY = 'budgettracker.sheetToken.v1';

/** Token dibuat script (menu Secukupnya.fund → Buat atau ganti token akses): huruf/angka, 16 sampai 128 karakter. */
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

export function isValidToken(value: string): boolean {
  return TOKEN_PATTERN.test(value.trim());
}

/**
 * Token disimpan di browser ini saja (tidak pernah ikut di URL). Ini melindungi dari URL yang bocor atau tertebak,
 * tapi bukan dari kode jahat yang berjalan di halaman ini, jadi jangan dipakai di komputer yang tidak kamu percayai.
 */
export function getSheetToken(): string {
  try {
    const v = localStorage.getItem(TOKEN_KEY)?.trim() ?? '';
    return isValidToken(v) ? v : '';
  } catch {
    return '';
  }
}

export function saveSheetToken(token: string): void {
  try {
    const v = token.trim();
    if (v) localStorage.setItem(TOKEN_KEY, v);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    throw new Error(tr('sources.storageBlocked'));
  }
}

export function clearSheetToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // abaikan
  }
}
