import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { DAILY_TARGET } from '@/lib/categories';

const STORAGE_KEY = 'budgettracker.dailyLimit.v1';
export const MAX_DAILY_LIMIT = 1_000_000_000;

/** Batas yang tersimpan, atau null kalau pengguna belum pernah mengaturnya. */
function load(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 && n <= MAX_DAILY_LIMIT ? n : null;
  } catch {
    return null;
  }
}

interface DailyLimitValue {
  limit: number;
  /** True kalau pengguna pernah mengatur batas sendiri (termasuk mengembalikannya ke bawaan). */
  isStored: boolean;
  /** Pakai batas dari spreadsheet kalau pengguna belum mengaturnya sendiri. */
  adopt: (n: number) => void;
  /** Simpan batas baru. Nilai tidak valid (0, negatif, terlalu besar) ditolak dan mengembalikan false. */
  setLimit: (n: number) => boolean;
  reset: () => void;
}

const DailyLimitContext = createContext<DailyLimitValue>({
  limit: DAILY_TARGET, isStored: false, adopt: () => {}, setLimit: () => false, reset: () => {},
});

export function DailyLimitProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<number | null>(load);
  const limit = stored ?? DAILY_TARGET;

  const persist = useCallback((n: number) => {
    setStored(n);
    try {
      localStorage.setItem(STORAGE_KEY, String(n));
    } catch {
      // Penyimpanan diblokir: batas tetap berlaku selama halaman terbuka.
    }
  }, []);

  const setLimit = useCallback(
    (n: number) => {
      if (!Number.isInteger(n) || n <= 0 || n > MAX_DAILY_LIMIT) return false;
      persist(n);
      return true;
    },
    [persist],
  );
  const reset = useCallback(() => persist(DAILY_TARGET), [persist]);

  const adopt = useCallback(
    (n: number) => {
      if (Number.isInteger(n) && n > 0 && n <= MAX_DAILY_LIMIT) persist(n);
    },
    [persist],
  );

  const value = useMemo(
    () => ({ limit, isStored: stored !== null, adopt, setLimit, reset }),
    [limit, stored, adopt, setLimit, reset],
  );
  return <DailyLimitContext.Provider value={value}>{children}</DailyLimitContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDailyLimit() {
  return useContext(DailyLimitContext);
}
