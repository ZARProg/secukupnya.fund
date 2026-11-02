import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { EMPTY_INVEST, cleanInvest, isEmptyInvest, removeValuation, upsertValuation, type InvestData } from '@/lib/invest';

export const INVEST_KEY = 'budgettracker.invest.v1';

function load(): InvestData {
  try {
    const raw = localStorage.getItem(INVEST_KEY);
    return raw ? cleanInvest(JSON.parse(raw)) : { valuations: {} };
  } catch {
    return { valuations: {} };
  }
}

function persist(d: InvestData) {
  try {
    if (isEmptyInvest(d)) localStorage.removeItem(INVEST_KEY);
    else localStorage.setItem(INVEST_KEY, JSON.stringify(d));
  } catch {
    // Diblokir: catatan berlaku selama halaman terbuka.
  }
}

interface InvestValue {
  data: InvestData;
  /** Simpan nilai platform pada tanggal tertentu (mengganti nilai di tanggal yang sama). */
  setValue: (platform: string, date: string, value: number) => void;
  removeValue: (platform: string, date: string) => void;
}

const noop = () => {};
const InvestContext = createContext<InvestValue>({ data: EMPTY_INVEST, setValue: noop, removeValue: noop });

export function InvestProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<InvestData>(load);
  const update = useCallback((fn: (p: InvestData) => InvestData) => {
    setData((prev) => {
      const next = fn(prev);
      if (next === prev) return prev;
      persist(next);
      return next;
    });
  }, []);
  const value = useMemo<InvestValue>(() => ({
    data,
    setValue: (platform, date, v) => update((p) => upsertValuation(p, platform, date, v)),
    removeValue: (platform, date) => update((p) => removeValuation(p, platform, date)),
  }), [data, update]);
  return <InvestContext.Provider value={value}>{children}</InvestContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useInvest = () => useContext(InvestContext);
