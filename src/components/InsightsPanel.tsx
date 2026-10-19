import { AlertTriangle, CheckCircle2, Info, Lightbulb, OctagonAlert } from 'lucide-react';
import { useMemo } from 'react';
import { useT, type MessageKey } from '@/i18n';
import { buildInsights, type Insight, type InsightTone } from '@/lib/insights';
import { useBudgets } from '@/hooks/useBudgets';
import { useDailyLimit } from '@/hooks/useDailyLimit';
import { usePrivacy } from '@/hooks/usePrivacy';
import type { Transaction } from '@/lib/transactions';

const TONE: Record<InsightTone, { box: string; icon: typeof Info }> = {
  bad: { box: 'bg-red-50 text-red-900', icon: OctagonAlert },
  warn: { box: 'bg-amber-50 text-amber-900', icon: AlertTriangle },
  good: { box: 'bg-brand-100 text-brand-800', icon: CheckCircle2 },
  info: { box: 'bg-slate-100/70 text-slate-700', icon: Info },
};

interface InsightsPanelProps {
  transactions: Transaction[];
  month: string;
  /** Tampilkan paling banyak sekian wawasan; kosong = semua. */
  max?: number;
  onSeeAll?: () => void;
  /** Sembunyikan panel kalau tidak ada yang bisa dianalisis. */
  hideWhenEmpty?: boolean;
}

export function InsightsPanel({ transactions, month, max, onSeeAll, hideWhenEmpty }: InsightsPanelProps) {
  const { t } = useT();
  const { budgets } = useBudgets();
  const { limit } = useDailyLimit();
  const { money } = usePrivacy();

  const all = useMemo(
    () => buildInsights(transactions, month, { budgets, dailyLimit: limit }),
    [transactions, month, budgets, limit],
  );
  const shown = max ? all.slice(0, max) : all;
  if (hideWhenEmpty && all.every((i) => i.kind === 'noData')) return null;

  function text(i: Insight): string {
    const params: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(i.params)) {
      params[k] = k.startsWith('rp') && typeof v === 'number' ? money(v) : v;
    }
    if (i.params.scope) {
      params.scope = t(i.params.scope === 'partial' ? 'insight.scope.partial' : 'insight.scope.full', { day: i.params.day ?? 0 });
    }
    return t(`insight.${i.kind}` as MessageKey, params);
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-card sm:p-6" aria-labelledby="insights-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="insights-title" className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-900">
          <Lightbulb className="h-4 w-4 text-brand-600" />
          {t('insight.title')}
        </h2>
        {onSeeAll && all.length > shown.length && (
          <button onClick={onSeeAll} className="rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-rose-50">
            {t('insight.all')}
          </button>
        )}
      </div>
      <ul className="space-y-2">
        {shown.map((i) => {
          const { box, icon: Icon } = TONE[i.tone];
          return (
            <li key={i.id} data-tone={i.tone} className={`flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm ${box}`}>
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{text(i)}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] text-slate-500">{t('insight.note')}</p>
    </section>
  );
}
