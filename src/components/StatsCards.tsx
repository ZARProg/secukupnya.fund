import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Eye, EyeOff, TriangleAlert } from 'lucide-react';
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
    <section
      aria-label={t('shell.stats.label')}
      className="relative overflow-hidden rounded-3xl bg-brand p-6 text-white sm:p-8"
    >
      {/* Lingkaran konsentris berwarna lime (palet merek): satu-satunya hiasan di halaman, dan hanya di hero. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 400 400"
        className="pointer-events-none absolute -right-24 -top-28 h-[26rem] w-[26rem] text-[#B2BD7E]"
        fill="none"
        stroke="currentColor"
      >
        {[60, 100, 140, 180, 220].map((r, i) => (
          <circle key={r} cx="200" cy="200" r={r} strokeWidth="1.5" opacity={0.55 - i * 0.1} />
        ))}
      </svg>

      <div className="relative grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white">{t('shell.stats.balance')}</p>
            <button
              onClick={toggle}
              aria-pressed={hidden}
              aria-label={t(hidden ? 'privacy.show' : 'privacy.hide')}
              title={t(hidden ? 'privacy.show' : 'privacy.hide')}
              className="rounded-lg p-1.5 text-white transition-colors hover:bg-[#2E3826]/30"
            >
              {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1 font-display text-5xl font-bold leading-none tracking-tight tabular-nums sm:text-6xl">
            {stats.balance < 0 && !hidden ? '−' : ''}
            {rupiahLabel(Math.abs(stats.balance))}
          </p>
          <p
            className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              monthPositive ? 'bg-[#2E3826]/35 text-white' : 'bg-[#1F2519]/50 text-[#FCF3D0]'
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
            <dt className="text-xs font-semibold text-white">{t('ux.stats.monthIncome')}</dt>
            <dd className="mt-1 font-display text-xl font-bold tabular-nums">{rupiahLabel(month.income)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-white">{t('ux.stats.monthExpense')}</dt>
            <dd className="mt-1 font-display text-xl font-bold tabular-nums">{rupiahLabel(month.expense)}</dd>
          </div>
        </dl>
      </div>

      <div className="relative mt-7 border-t border-white/25 pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
          <p className="font-medium text-white">
            {t('shell.stats.today')} <span className="font-bold text-white tabular-nums">{rupiahLabel(stats.todayExpense)}</span>
          </p>
          <p className={`flex items-center gap-1 text-xs ${over ? 'font-bold' : 'font-medium'} text-white`}>
            {over && <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
            {t(over ? 'shell.stats.overLimit' : 'shell.stats.limit', { amount: plain(DAILY_TARGET) })}
          </p>
        </div>
        <div
          className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#1F2519]/35"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={DAILY_TARGET}
          aria-valuenow={Math.min(stats.todayExpense, DAILY_TARGET)}
          aria-label={t('shell.stats.progress')}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-[#F8E69F]' : 'bg-[#FCF0DA]'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </section>
  );
}
