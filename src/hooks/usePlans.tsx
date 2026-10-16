import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { MAX_AMOUNT, cleanGoals, cleanRecurring, newId, type Goal, type Recurring } from '@/lib/plans';

const RECURRING_KEY = 'budgettracker.recurring.v1';
const GOALS_KEY = 'budgettracker.goals.v1';

function load<T>(key: string, clean: (v: unknown) => T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? clean(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function persist(key: string, list: unknown[]) {
  try {
    if (list.length) localStorage.setItem(key, JSON.stringify(list));
    else localStorage.removeItem(key);
  } catch {
    // Penyimpanan diblokir: data tetap berlaku selama halaman terbuka.
  }
}

interface PlansValue {
  recurring: Recurring[];
  goals: Goal[];
  addRecurring: (r: Omit<Recurring, 'id'>) => void;
  removeRecurring: (id: string) => void;
  markDone: (id: string, month: string) => void;
  addGoal: (g: Omit<Goal, 'id'>) => void;
  removeGoal: (id: string) => void;
  /** Tambah (positif) atau tarik (negatif) dana; hasilnya dijaga di antara 0 dan batas. */
  adjustGoal: (id: string, delta: number) => void;
}

const noop = () => {};
const PlansContext = createContext<PlansValue>({
  recurring: [], goals: [], addRecurring: noop, removeRecurring: noop, markDone: noop,
  addGoal: noop, removeGoal: noop, adjustGoal: noop,
});

export function PlansProvider({ children }: { children: ReactNode }) {
  const [recurring, setRecurring] = useState<Recurring[]>(() => load(RECURRING_KEY, cleanRecurring));
  const [goals, setGoals] = useState<Goal[]>(() => load(GOALS_KEY, cleanGoals));

  const updateRecurring = useCallback((fn: (prev: Recurring[]) => Recurring[]) => {
    setRecurring((prev) => {
      const next = fn(prev);
      persist(RECURRING_KEY, next);
      return next;
    });
  }, []);
  const updateGoals = useCallback((fn: (prev: Goal[]) => Goal[]) => {
    setGoals((prev) => {
      const next = fn(prev);
      persist(GOALS_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<PlansValue>(() => ({
    recurring,
    goals,
    addRecurring: (r) => updateRecurring((prev) => [...prev, { ...r, id: newId() }]),
    removeRecurring: (id) => updateRecurring((prev) => prev.filter((r) => r.id !== id)),
    markDone: (id, month) => updateRecurring((prev) => prev.map((r) => (r.id === id ? { ...r, lastDone: month } : r))),
    addGoal: (g) => updateGoals((prev) => [...prev, { ...g, id: newId() }]),
    removeGoal: (id) => updateGoals((prev) => prev.filter((g) => g.id !== id)),
    adjustGoal: (id, delta) =>
      updateGoals((prev) =>
        prev.map((g) => (g.id === id ? { ...g, saved: Math.min(MAX_AMOUNT, Math.max(0, g.saved + delta)) } : g)),
      ),
  }), [recurring, goals, updateRecurring, updateGoals]);

  return <PlansContext.Provider value={value}>{children}</PlansContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePlans() {
  return useContext(PlansContext);
}
