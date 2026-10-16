import { useState } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import { useT, locale } from '@/i18n';
import { usePrivacy } from '@/hooks/usePrivacy';
import type { Recurring } from '@/lib/plans';
import { parseISODate } from '@/lib/date';

interface DueBannerProps {
  due: { rule: Recurring; date: string }[];
  onRecord: (rule: Recurring, date: string) => Promise<void>;
  onSkip: (rule: Recurring) => void;
}

/** Tawaran mencatat transaksi berulang yang sudah jatuh tempo. Tidak ada yang dicatat sebelum pengguna menekan Catat. */
export function DueBanner({ due, onRecord, onSkip }: DueBannerProps) {
  const { t, tp } = useT();
  const { money } = usePrivacy();
  const [busy, setBusy] = useState<string | null>(null);
  if (!due.length) return null;

  async function record(rule: Recurring, date: string) {
    if (busy) return;
    setBusy(rule.id);
    try {
      await onRecord(rule, date);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      aria-label={tp('due.title', due.length)}
      className="mb-5 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <h2 className="text-sm font-bold text-amber-900">{tp('due.title', due.length)}</h2>
          <p className="text-xs text-amber-800/80">{t('due.hint')}</p>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-amber-200/60">
        {due.map(({ rule, date }) => (
          <li key={rule.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{rule.description}</p>
              <p className="truncate text-xs text-slate-500">
                {parseISODate(date).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })} · {rule.category}
                {rule.account ? ` · ${rule.account}` : ''}
              </p>
            </div>
            <p className={`text-sm font-bold tabular-nums ${rule.type === 'expense' ? 'text-brand' : 'text-emerald-600'}`}>
              {rule.type === 'expense' ? '−' : '+'}{money(rule.total)}
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => record(rule, date)}
                disabled={busy !== null}
                aria-label={t('due.recordAria', { name: rule.description })}
                className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
              >
                {busy === rule.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t('due.record')}
              </button>
              <button
                onClick={() => onSkip(rule)}
                disabled={busy !== null}
                aria-label={t('due.skipAria', { name: rule.description })}
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50"
              >
                {t('due.skip')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
