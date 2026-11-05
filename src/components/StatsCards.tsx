import { useMemo } from 'react';
import { ArrowDownLeft, ArrowDownRight, ArrowUpRight, BarChart3, Eye, EyeOff, TriangleAlert } from 'lucide-react';
import { MoneyText } from '@/components/MoneyText';
import { useDailyLimit } from '@/hooks/useDailyLimit';
import { usePrivacy } from '@/hooks/usePrivacy';
import { rupiahLabel as plain } from '@/lib/format';
import { computeStats } from '@/lib/summary';
import { monthReport } from '@/lib/report';
import { todayISO } from '@/lib/date';
import { useT } from '@/i18n';
import type { Transaction } from '@/lib/transactions';

interface StatsProps {
  transactions: Transaction[];
}

/** Ringkasan utama: saldo bersih besar di kiri, total masuk dan keluar di kanan, batas harian di bawah. */
export function StatsCards({ transactions }: StatsProps) {
  const { t } = useT();
  const { limit: DAILY_TARGET } = useDailyLimit();
  const { hidden, toggle, money: rupiahLabel } = usePrivacy();
  const stats = useMemo(() => computeStats(transactions), [transactions]);
  // Pemasukan dan pengeluaran ditampilkan untuk bulan berjalan (sama dengan Laporan), bukan total sejak awal.
  const month = useMemo(() => monthReport(transactions, todayISO().slice(0, 7)), [transactions]);
  const over = stats.todayExpense > DAILY_TARGET;
  const pct = Math.min(100, Math.round((stats.todayExpense / DAILY_TARGET) * 100));
  const monthPositive = stats.monthBalance >= 0;

  return (
    <section aria-label={t('shell.stats.label')} className="relative overflow-hidden rounded-3xl bg-brand p-6 text-white sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-white/85">{t('shell.stats.balance')}</p>
            <button
              onClick={toggle}
              aria-pressed={hidden}
              aria-label={t(hidden ? 'privacy.show' : 'privacy.hide')}
              title={t(hidden ? 'privacy.show' : 'privacy.hide')}
              className="grid h-9 w-9 place-items-center rounded-full text-white transition-colors hover:bg-white/10"
            >
              {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="font-display text-[2.6rem] font-bold leading-none tracking-tight tabular-nums sm:text-6xl" data-testid="hero-balance">
            <MoneyText value={`${stats.balance < 0 && !hidden ? '−' : ''}${rupiahLabel(Math.abs(stats.balance))}`} />
          </p>
          <p
            className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
              monthPositive ? 'bg-white/15 text-white' : 'bg-black/25 text-white'
            }`}
          >
            {monthPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {t('shell.stats.monthDelta', {
              sign: hidden ? '' : monthPositive ? '+' : '−',
              amount: rupiahLabel(Math.abs(stats.monthBalance)),
            })}
          </p>
        </div>
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/12 text-white/90">
          <BarChart3 className="h-5 w-5" />
        </span>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/10 px-4 py-3">
          <dt className="flex items-center gap-1.5 text-xs font-medium text-white/85"><ArrowDownLeft className="h-3.5 w-3.5" aria-hidden="true" />{t('ux.stats.monthIncome')}</dt>
          <dd className="mt-1 text-lg font-bold tabular-nums">{rupiahLabel(month.income)}</dd>
        </div>
        <div className="rounded-2xl bg-white/10 px-4 py-3">
          <dt className="flex items-center gap-1.5 text-xs font-medium text-white/85"><ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />{t('ux.stats.monthExpense')}</dt>
          <dd className="mt-1 text-lg font-bold tabular-nums">{rupiahLabel(month.expense)}</dd>
        </div>
      </dl>

      <div className="mt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
          <p className="font-medium text-white/90">
            {t('shell.stats.today')} <span className="font-bold text-white tabular-nums">{rupiahLabel(stats.todayExpense)}</span>
          </p>
          <p className={`flex items-center gap-1 text-xs ${over ? 'font-bold' : 'font-medium'} text-white/90`}>
            {over && <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
            {t(over ? 'shell.stats.overLimit' : 'shell.stats.limit', { amount: plain(DAILY_TARGET) })}
          </p>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={DAILY_TARGET}
          aria-valuenow={Math.min(stats.todayExpense, DAILY_TARGET)}
          aria-label={t('shell.stats.progress')}
        >
          <div className={`h-full rounded-full ${over ? 'bg-[#F5D573]' : 'bg-[#BFE0C4]'}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </section>
  );
}
