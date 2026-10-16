import { useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { useT } from '@/i18n';

const KEY = 'budgettracker.secdismiss.v1';

/** Peringatan satu baris kalau spreadsheet tersambung tapi scriptnya terbuka tanpa token. Bisa ditutup (per URL). */
export function SecurityBanner({ url, onOpen }: { url: string; onOpen: () => void }) {
  const { t } = useT();
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(KEY) === url; } catch { return false; }
  });
  if (hidden) return null;
  return (
    <section role="status" className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/80 p-4" data-testid="security-banner">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
      <p className="min-w-0 flex-1 text-sm text-red-900">{t('sec.banner')}</p>
      <button onClick={onOpen} className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white">{t('sec.banner.action')}</button>
      <button
        onClick={() => { try { localStorage.setItem(KEY, url); } catch { /* abaikan */ } setHidden(true); }}
        aria-label={t('sec.banner.dismiss')}
        className="shrink-0 rounded-lg p-1.5 text-red-400 hover:bg-red-100"
      >
        <X className="h-4 w-4" />
      </button>
    </section>
  );
}
