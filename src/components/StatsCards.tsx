import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Eye, EyeOff } from 'lucide-react';
import { useDailyLimit } from '@/hooks/useDailyLimit';
import { usePrivacy } from '@/hooks/usePrivacy';
import { rupiahLabel as plain } from '@/lib/format';
import { computeStats } from '@/lib/summary';
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
  const over = stats.todayExpense > DAILY_TARGET;
  const pct = Math.min(100, Math.round((stats.todayExpense / DAILY_TARGET) * 100));
  const monthPositive = stats.monthBalance >= 0;

  return (
    <section
      aria-label={t('shell.stats.label')}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#93102f] via-brand to-[#4a0014] p-6 text-white shadow-card sm:p-8"
    >
      {/* Lingkaran konsentris: pola koin/riak, sebagai satu-satunya hiasan di halaman. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 400 400"
        className="pointer-events-none absolute -right-24 -top-28 h-[26rem] w-[26rem] text-white"
        fill="none"
        stroke="currentColor"
      >
        {[60, 100, 140, 180, 220].map((r, i) => (
          <circle key={r} cx="200" cy="200" r={r} strokeWidth="1.5" opacity={0.12 - i * 0.02} />
        ))}
      </svg>

      <div className="relative grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white/75">{t('shell.stats.balance')}</p>
            <button
              onClick={toggle}
              aria-pressed={hidden}
              aria-label={t(hidden ? 'privacy.show' : 'privacy.hide')}
              title={t(hidden ? 'privacy.show' : 'privacy.hide')}
              className="rounded-lg p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl">
            {stats.balance < 0 && !hidden ? '−' : ''}
            {rupiahLabel(Math.abs(stats.balance))}
          </p>
          <p
            className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              monthPositive ? 'bg-emerald-400/20 text-emerald-100' : 'bg-rose-300/20 text-rose-100'
            }`}
          >
            {monthPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {t('shell.stats.monthDelta', {
              sign: hidden ? '' : monthPositive ? '+' : '−',
              amount: rupiahLabel(Math.abs(stats.monthBalance)),
            })}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-6 sm:gap-8">
          <div>
            <dt className="text-xs font-medium text-white/65">{t('shell.stats.totalIncome')}</dt>
            <dd className="mt-1 text-lg font-bold tabular-nums">{rupiahLabel(stats.totalIncome)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-white/65">{t('shell.stats.totalExpense')}</dt>
            <dd className="mt-1 text-lg font-bold tabular-nums">{rupiahLabel(stats.totalExpense)}</dd>
          </div>
        </dl>
      </div>

      <div className="relative mt-7 border-t border-white/15 pt-5">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <p className="font-medium text-white/85">
            {t('shell.stats.today')} <span className="font-bold text-white tabular-nums">{rupiahLabel(stats.todayExpense)}</span>
          </p>
          <p className={`text-xs ${over ? 'font-bold text-amber-200' : 'text-white/65'}`}>
            {t(over ? 'shell.stats.overLimit' : 'shell.stats.limit', { amount: plain(DAILY_TARGET) })}
          </p>
        </div>
        <div
          className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/15"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={DAILY_TARGET}
          aria-valuenow={Math.min(stats.todayExpense, DAILY_TARGET)}
          aria-label={t('shell.stats.progress')}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-amber-300' : 'bg-white'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </section>
  );
}
