import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { rupiahLabel, rupiahSigned } from '@/lib/format';

const KEY = 'budgettracker.hide.v1';
export const HIDDEN_TEXT = 'Rp ••••••';

function load(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

interface PrivacyValue {
  hidden: boolean;
  toggle: () => void;
  /** Nominal untuk ditampilkan; disamarkan kalau mode sembunyikan saldo aktif. */
  money: (n: number) => string;
  moneySigned: (n: number) => string;
}

const PrivacyContext = createContext<PrivacyValue>({
  hidden: false, toggle: () => {}, money: rupiahLabel, moneySigned: rupiahSigned,
});

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(load);
  const toggle = useCallback(() => {
    setHidden((prev) => {
      const next = !prev;
      try {
        if (next) localStorage.setItem(KEY, '1');
        else localStorage.removeItem(KEY);
      } catch {
        // Diblokir: pilihan berlaku sampai halaman ditutup.
      }
      return next;
    });
  }, []);
  const value = useMemo<PrivacyValue>(() => ({
    hidden,
    toggle,
    money: (n) => (hidden ? HIDDEN_TEXT : rupiahLabel(n)),
    moneySigned: (n) => (hidden ? HIDDEN_TEXT : rupiahSigned(n)),
  }), [hidden, toggle]);
  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePrivacy() {
  return useContext(PrivacyContext);
}
