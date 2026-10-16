import { useCallback, useState } from 'react';
import { DEFAULT_SAFE_SETTINGS, type SafeSettings } from '@/lib/safeToSpend';

const KEY = 'budgettracker.safe.v1';
const LIMIT = 1_000_000_000_000;

function clean(v: unknown): SafeSettings {
  if (!v || typeof v !== 'object') return DEFAULT_SAFE_SETTINGS;
  const o = v as Record<string, unknown>;
  const adjust = typeof o.adjust === 'number' && Number.isInteger(o.adjust) && Math.abs(o.adjust) <= LIMIT ? o.adjust : 0;
  return { adjust, savedInBalance: o.savedInBalance !== false };
}

function load(): SafeSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? clean(JSON.parse(raw)) : DEFAULT_SAFE_SETTINGS;
  } catch {
    return DEFAULT_SAFE_SETTINGS;
  }
}

export function useSafeSettings() {
  const [settings, setState] = useState<SafeSettings>(load);
  const update = useCallback((patch: Partial<SafeSettings>) => {
    setState((prev) => {
      const next = clean({ ...prev, ...patch });
      try {
        if (next.adjust === 0 && next.savedInBalance) localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Diblokir: pengaturan berlaku sampai halaman ditutup.
      }
      return next;
    });
  }, []);
  return { settings, update };
}
