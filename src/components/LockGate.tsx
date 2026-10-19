import type { ReactNode } from 'react';
import { useLocked } from '@/hooks/useLock';
import { LockScreen } from '@/components/LockScreen';

/** Saat terkunci, aplikasi tidak dirender sama sekali sehingga datanya tidak ada di halaman. */
export function LockGate({ children }: { children: ReactNode }) {
  return useLocked() ? <LockScreen /> : <>{children}</>;
}
