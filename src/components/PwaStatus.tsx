import { RefreshCw, WifiOff } from 'lucide-react';
import { useT } from '@/i18n';
import { applyUpdate, dismissUpdate, useOnline, useUpdateReady } from '@/lib/pwa';

/** Pemberitahuan kecil di pojok bawah: versi baru siap, atau sedang offline. Tidak muncul kalau tidak ada keduanya. */
export function PwaStatus() {
  const { t } = useT();
  const updateReady = useUpdateReady();
  const online = useOnline();
  if (online && !updateReady) return null;

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-28 z-[70] space-y-2 lg:bottom-4 lg:left-auto lg:right-4 lg:w-96">
      {updateReady && (
        <div role="status" data-testid="pwa-update" className="pointer-events-auto rounded-2xl border border-slate-200 bg-card p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">{t('pwa.update.title')}</p>
              <p className="mt-0.5 text-xs text-slate-500">{t('pwa.update.body')}</p>
              <div className="mt-3 flex gap-2">
                <button onClick={applyUpdate} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-dark">
                  {t('pwa.update.reload')}
                </button>
                <button onClick={dismissUpdate} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100">
                  {t('pwa.update.later')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {!online && (
        <div role="status" data-testid="pwa-offline" className="pointer-events-auto flex items-start gap-2.5 rounded-2xl border border-amber-200/80 bg-amber-50 p-3 shadow-md">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <p className="text-xs font-medium text-amber-900">{t('pwa.offline')}</p>
        </div>
      )}
    </div>
  );
}
