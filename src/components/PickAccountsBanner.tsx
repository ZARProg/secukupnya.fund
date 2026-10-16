import { Landmark } from 'lucide-react';
import { useT } from '@/i18n';

/** Muncul selama belum ada bank atau e-wallet yang dipilih. */
export function PickAccountsBanner({ onPick }: { onPick: () => void }) {
  const { t } = useT();
  return (
    <section className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border border-rose-200 bg-rose-50/70 p-4 sm:p-5">
      <Landmark className="h-5 w-5 shrink-0 text-brand" />
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-bold text-slate-900">{t('accounts.pick.title')}</h2>
        <p className="text-xs text-slate-600">{t('accounts.pick.text')}</p>
      </div>
      <button onClick={onPick} className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-dark">
        {t('accounts.pick.button')}
      </button>
    </section>
  );
}
