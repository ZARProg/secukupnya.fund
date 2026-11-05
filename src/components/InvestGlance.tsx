import { useMemo } from 'react';
import { BellRing, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react';
import { useT } from '@/i18n';
import { useInvest } from '@/hooks/useInvest';
import { useNetWorth } from '@/hooks/useNetWorth';
import { usePrivacy } from '@/hooks/usePrivacy';
import { todayISO } from '@/lib/date';
import { STALE_VALUE_DAYS, isInvestAccount, platformColor, positionOf, summarize } from '@/lib/invest';
import type { AccountBalance } from '@/lib/summary';

/** Ringkasan investasi di Beranda: total nilai, untung/rugi, dan komposisi per platform. Tidak tampil bila belum ada platform. */
export function InvestGlance({ accounts, onOpen }: { accounts: AccountBalance[]; onOpen: () => void }) {
  const { t } = useT();
  const { money, moneySigned } = usePrivacy();
  const { data } = useInvest();
  const { data: nw } = useNetWorth();
  const today = todayISO();
  const positions = useMemo(
    () => accounts.filter((a) => isInvestAccount(a.account)).map((a) => positionOf(a.account, a.balance, nw.openings[a.account] ?? 0, data.valuations[a.account], today)),
    [accounts, nw.openings, data.valuations, today],
  );
  const sum = useMemo(() => summarize(positions), [positions]);
  if (!positions.length) return null;
  const parts = positions.filter((p) => p.value > 0);
  const total = parts.reduce((s, p) => s + p.value, 0);
  const hasGain = positions.some((p) => p.hasValue);
  const stale = positions.filter((p) => p.stale).map((p) => p.platform);
  const missing = positions.filter((p) => !p.hasValue && p.cost > 0).map((p) => p.platform);
  const nudge = stale.length ? t('inv.glance.stale', { platform: stale.join(', '), days: STALE_VALUE_DAYS }) : missing.length ? t('inv.glance.missing', { platform: missing.join(', ') }) : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="invest-glance"
      className="group w-full rounded-2xl border border-line bg-card p-5 text-left shadow-card transition-all hover:border-brand/40 hover:shadow-md active:scale-[0.99] sm:p-6"
    >
      <span className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-900">
          <TrendingUp className="h-4 w-4 text-brand-600" aria-hidden="true" />
          {t('inv.glance.title')}
        </span>
        <span className="flex items-center gap-0.5 text-xs font-semibold text-brand-600">
          {t('inv.glance.hint')}
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </span>
      <span className="mt-3 block font-display text-3xl font-medium tabular-nums tracking-tight text-slate-900" data-testid="invest-glance-total">{money(sum.value)}</span>
      {hasGain && (
        <span className={`mt-1 flex items-center gap-1 text-sm font-semibold ${sum.gain < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
          {sum.gain < 0 ? <TrendingDown className="h-4 w-4" aria-hidden="true" /> : <TrendingUp className="h-4 w-4" aria-hidden="true" />}
          {moneySigned(sum.gain)}
          {sum.gainPct !== null && <span className="font-medium">({sum.gainPct > 0 ? '+' : ''}{sum.gainPct.toFixed(1)}%)</span>}
        </span>
      )}
      {parts.length > 0 && (
        <>
          <span className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
            {parts.map((p) => <span key={p.platform} className={`h-full ${platformColor(p.platform)}`} style={{ width: `${(p.value / total) * 100}%` }} />)}
          </span>
          <span className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            {parts.map((p) => (
              <span key={p.platform} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${platformColor(p.platform)}`} aria-hidden="true" />
                {p.platform} <span className="tabular-nums text-slate-500">{Math.round((p.value / total) * 100)}%</span>
              </span>
            ))}
          </span>
        </>
      )}
      {nudge && (
        <span className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900" data-testid="invest-nudge">
          <BellRing className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {nudge}
        </span>
      )}
    </button>
  );
}
