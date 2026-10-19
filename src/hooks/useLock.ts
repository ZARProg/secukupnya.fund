import { useSyncExternalStore } from 'react';
import { isLockEnabled, getAutoLock } from '@/lib/lock';

/** Status terkunci hidup di memori saja: halaman dimuat ulang = terkunci lagi bila PIN aktif. */
let locked = isLockEnabled();
let hiddenAt = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function lockNow(): void {
  if (!isLockEnabled()) return;
  locked = true;
  emit();
}
export function unlockApp(): void {
  locked = false;
  hiddenAt = 0;
  emit();
}
/** Dipanggil setelah PIN dimatikan atau data dihapus. */
export function syncLockState(): void {
  if (!isLockEnabled()) { locked = false; emit(); }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!isLockEnabled()) return;
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      if (getAutoLock() === 0) lockNow();
    } else if (hiddenAt) {
      if (Date.now() - hiddenAt >= getAutoLock() * 1000) lockNow();
      hiddenAt = 0;
    }
  });
}

export function useLocked(): boolean {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => locked,
    () => false,
  );
}
