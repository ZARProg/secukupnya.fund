import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { cleanRules, MAX_RULES, type Rule } from '@/lib/rules';
import { newId } from '@/lib/plans';

const KEY = 'budgettracker.rules.v1';

function load(): Rule[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? cleanRules(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function persist(list: Rule[]) {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch {
    // Diblokir: aturan berlaku selama halaman terbuka.
  }
}

interface RulesValue {
  rules: Rule[];
  /** false kalau sudah mencapai batas jumlah aturan. */
  addRule: (r: Omit<Rule, 'id'>) => boolean;
  updateRule: (id: string, r: Omit<Rule, 'id'>) => void;
  removeRule: (id: string) => void;
  /** Geser aturan satu posisi (aturan paling atas menang kalau dua aturan cocok). */
  moveRule: (id: string, dir: -1 | 1) => void;
}

const noop = () => {};
const RulesContext = createContext<RulesValue>({ rules: [], addRule: () => false, updateRule: noop, removeRule: noop, moveRule: noop });

export function RulesProvider({ children }: { children: ReactNode }) {
  const [rules, setRules] = useState<Rule[]>(load);

  const update = useCallback((fn: (prev: Rule[]) => Rule[]) => {
    setRules((prev) => {
      const next = fn(prev);
      persist(next);
      return next;
    });
  }, []);

  const value = useMemo<RulesValue>(() => ({
    rules,
    addRule: (r) => {
      if (rules.length >= MAX_RULES) return false;
      update((prev) => [...prev, { ...r, id: newId() }]);
      return true;
    },
    updateRule: (id, r) => update((prev) => prev.map((x) => (x.id === id ? { ...r, id } : x))),
    removeRule: (id) => update((prev) => prev.filter((x) => x.id !== id)),
    moveRule: (id, dir) =>
      update((prev) => {
        const i = prev.findIndex((x) => x.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= prev.length) return prev;
        const next = [...prev];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      }),
  }), [rules, update]);

  return <RulesContext.Provider value={value}>{children}</RulesContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRules() {
  return useContext(RulesContext);
}
