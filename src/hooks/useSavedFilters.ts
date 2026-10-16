import { useCallback, useState } from 'react';
import { MAX_FILTER_NAME, MAX_SAVED_FILTERS, cleanSavedFilters, type SavedFilter, type TxFilter } from '@/lib/filters';
import { newId } from '@/lib/plans';

const KEY = 'budgettracker.savedFilters.v1';

function load(): SavedFilter[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? cleanSavedFilters(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function persist(list: SavedFilter[]) {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch {
    // Diblokir: filter tetap ada selama halaman terbuka.
  }
}

/** Kombinasi filter transaksi yang disimpan di browser ini. */
export function useSavedFilters() {
  const [saved, setSaved] = useState<SavedFilter[]>(load);

  const save = useCallback((name: string, filter: TxFilter): boolean => {
    const clean = name.trim().slice(0, MAX_FILTER_NAME);
    if (!clean) return false;
    let ok = true;
    setSaved((prev) => {
      if (prev.length >= MAX_SAVED_FILTERS) {
        ok = false;
        return prev;
      }
      const next = [...prev, { id: newId(), name: clean, filter }];
      persist(next);
      return next;
    });
    return ok;
  }, []);

  const remove = useCallback((id: string) => {
    setSaved((prev) => {
      const next = prev.filter((s) => s.id !== id);
      persist(next);
      return next;
    });
  }, []);

  return { saved, save, remove, full: saved.length >= MAX_SAVED_FILTERS };
}
