import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { newId } from '@/lib/plans';
import {
  EMPTY_NET_WORTH, cleanHistory, cleanNetWorth, isEmptyNetWorth, upsertSnapshot,
  type AssetKind, type LiabilityKind, type NetItem, type NetSnapshot, type NetWorthData,
} from '@/lib/networth';

const KEY = 'budgettracker.networth.v1';
/** Riwayat terpisah dari pengaturan: bukan bagian sinkron, jadi pencatatan harian tidak dianggap perubahan pengaturan. */
const HKEY = 'budgettracker.nwhistory.v1';

function load(): NetWorthData {
  try {
    const raw = localStorage.getItem(KEY);
    const base = raw ? cleanNetWorth(JSON.parse(raw)) : { ...EMPTY_NET_WORTH, openings: {} };
    const h = localStorage.getItem(HKEY);
    return { ...base, history: h ? cleanHistory(JSON.parse(h)) : [] };
  } catch {
    return { ...EMPTY_NET_WORTH, openings: {} };
  }
}

function persist(d: NetWorthData) {
  try {
    const main = { ...d, history: [] };
    if (isEmptyNetWorth(main)) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(main));
    if (d.history.length) localStorage.setItem(HKEY, JSON.stringify(d.history));
    else localStorage.removeItem(HKEY);
  } catch {
    // Diblokir: catatan berlaku selama halaman terbuka.
  }
}

export type NewItem<K extends string> = Omit<NetItem<K>, 'id'>;

interface NetWorthValue {
  data: NetWorthData;
  addAsset: (i: NewItem<AssetKind>) => void;
  addLiability: (i: NewItem<LiabilityKind>) => void;
  /** Perbarui nilai dan tanggal konfirmasi. */
  updateItem: (list: 'assets' | 'liabilities', id: string, value: number, today: string) => void;
  removeItem: (list: 'assets' | 'liabilities', id: string) => void;
  setOpening: (account: string, value: number) => void;
  setInclude: (key: 'includeAccounts' | 'includeDebts', value: boolean) => void;
  recordSnapshot: (snap: NetSnapshot) => void;
}

const noop = () => {};
const NetWorthContext = createContext<NetWorthValue>({
  data: EMPTY_NET_WORTH, addAsset: noop, addLiability: noop, updateItem: noop, removeItem: noop, setOpening: noop, setInclude: noop, recordSnapshot: noop,
});

export function NetWorthProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<NetWorthData>(load);

  const update = useCallback((fn: (prev: NetWorthData) => NetWorthData) => {
    setData((prev) => {
      const next = fn(prev);
      if (next === prev) return prev;
      persist(next);
      return next;
    });
  }, []);

  const value = useMemo<NetWorthValue>(() => ({
    data,
    addAsset: (i) => update((p) => ({ ...p, assets: [...p.assets, { ...i, id: newId() }] })),
    addLiability: (i) => update((p) => ({ ...p, liabilities: [...p.liabilities, { ...i, id: newId() }] })),
    updateItem: (list, id, v, today) =>
      update((p) => ({
        ...p,
        [list]: (p[list] as NetItem[]).map((x) => (x.id === id ? { ...x, value: v, updatedAt: today, estimate: false } : x)),
      })),
    removeItem: (list, id) => update((p) => ({ ...p, [list]: (p[list] as NetItem[]).filter((x) => x.id !== id) })),
    setOpening: (account, v) =>
      update((p) => {
        const openings = { ...p.openings };
        if (v === 0) delete openings[account];
        else openings[account] = v;
        return { ...p, openings };
      }),
    setInclude: (key, v) => update((p) => (p[key] === v ? p : { ...p, [key]: v })),
    recordSnapshot: (snap) =>
      update((p) => {
        const history = upsertSnapshot(p.history, snap);
        return history === p.history ? p : { ...p, history };
      }),
  }), [data, update]);

  return <NetWorthContext.Provider value={value}>{children}</NetWorthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNetWorth() {
  return useContext(NetWorthContext);
}
