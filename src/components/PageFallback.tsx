import { Loader2 } from 'lucide-react';

/** Sekilas tampil saat halaman dimuat pertama kali. Tinggi minimum mencegah layar melompat. */
export function PageFallback() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[40vh] items-center justify-center text-slate-400" data-testid="page-loading">
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
      <span className="sr-only">…</span>
    </div>
  );
}
