import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { cleanDebts, type Debt, type DebtPayment } from '@/lib/debts';
import { newId } from '@/lib/plans';

const KEY = 'budgettracker.debts.v1';

function load(): Debt[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? cleanDebts(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function persist(list: Debt[]) {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch {
    // Diblokir: catatan berlaku selama halaman terbuka.
  }
}

interface DebtsValue {
  debts: Debt[];
  addDebt: (d: Omit<Debt, 'id'>) => string;
  removeDebt: (id: string) => void;
  addPayment: (id: string, p: DebtPayment) => void;
  removePayment: (id: string, paymentId: string) => void;
}

const noop = () => {};
const DebtsContext = createContext<DebtsValue>({ debts: [], addDebt: () => '', removeDebt: noop, addPayment: noop, removePayment: noop });

export function DebtsProvider({ children }: { children: ReactNode }) {
  const [debts, setDebts] = useState<Debt[]>(load);

  const update = useCallback((fn: (prev: Debt[]) => Debt[]) => {
    setDebts((prev) => {
      const next = fn(prev);
      persist(next);
      return next;
    });
  }, []);

  const value = useMemo<DebtsValue>(() => ({
    debts,
    addDebt: (d) => {
      const id = newId();
      update((prev) => [...prev, { ...d, id }]);
      return id;
    },
    removeDebt: (id) => update((prev) => prev.filter((d) => d.id !== id)),
    addPayment: (id, p) => update((prev) => prev.map((d) => (d.id === id ? { ...d, payments: [...d.payments, p] } : d))),
    removePayment: (id, paymentId) =>
      update((prev) => prev.map((d) => (d.id === id ? { ...d, payments: d.payments.filter((p) => p.id !== paymentId) } : d))),
  }), [debts, update]);

  return <DebtsContext.Provider value={value}>{children}</DebtsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDebts() {
  return useContext(DebtsContext);
}
