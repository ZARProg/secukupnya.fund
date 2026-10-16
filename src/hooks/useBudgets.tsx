import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { cleanBudgets, MAX_BUDGET, type Budgets } from '@/lib/plans';

const STORAGE_KEY = 'budgettracker.budgets.v1';
function load(): Budgets {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? cleanBudgets(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

interface BudgetsValue {
  /** Anggaran bulanan per kategori pengeluaran (Rp). Kategori tanpa anggaran tidak ada di sini. */
  budgets: Budgets;
  /** Atur anggaran satu kategori; 0 atau kosong menghapusnya. Mengembalikan false kalau nilainya tidak valid. */
  setBudget: (category: string, amount: number) => boolean;
}

const BudgetsContext = createContext<BudgetsValue>({ budgets: {}, setBudget: () => false });

export function BudgetsProvider({ children }: { children: ReactNode }) {
  const [budgets, setState] = useState<Budgets>(load);

  const setBudget = useCallback((category: string, amount: number) => {
    if (!Number.isInteger(amount) || amount < 0 || amount > MAX_BUDGET) return false;
    setState((prev) => {
      const next = { ...prev };
      if (amount === 0) delete next[category];
      else next[category] = amount;
      try {
        if (Object.keys(next).length) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        else localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Penyimpanan diblokir: anggaran tetap berlaku selama halaman terbuka.
      }
      return next;
    });
    return true;
  }, []);

  const value = useMemo(() => ({ budgets, setBudget }), [budgets, setBudget]);
  return <BudgetsContext.Provider value={value}>{children}</BudgetsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBudgets() {
  return useContext(BudgetsContext);
}
