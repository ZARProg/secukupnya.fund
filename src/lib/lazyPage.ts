import { lazy, type ComponentType } from 'react';

const FLAG = 'budgettracker.chunkreload';

/**
 * React.lazy untuk halaman. Setelah ada versi baru, tab yang masih terbuka bisa menunjuk ke berkas lama yang sudah diganti
 * dan pemuatan gagal. Kalau begitu, muat ulang satu kali supaya mengambil versi terbaru. Penanda di sessionStorage
 * mencegah perulangan; kalau sessionStorage diblokir, tidak memuat ulang sama sekali (biar ErrorBoundary yang menampilkan pesan).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyPage<C extends ComponentType<any>>(factory: () => Promise<{ default: C }>) {
  return lazy<C>(async (): Promise<{ default: C }> => {
    try {
      const mod = await factory();
      try { sessionStorage.removeItem(FLAG); } catch { /* diblokir */ }
      return mod;
    } catch (err) {
      let alreadyTried = true;
      try {
        alreadyTried = sessionStorage.getItem(FLAG) === '1';
        if (!alreadyTried) sessionStorage.setItem(FLAG, '1');
      } catch { /* diblokir: anggap sudah dicoba */ }
      if (!alreadyTried) {
        window.location.reload();
        return new Promise<never>(() => { /* halaman sedang dimuat ulang */ });
      }
      throw err;
    }
  });
}
