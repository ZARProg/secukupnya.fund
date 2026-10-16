import { useMemo } from 'react';
import { useDailyLimit } from '@/hooks/useDailyLimit';
import { rupiahLabel } from '@/lib/format';
import { dailyExpenses } from '@/lib/summary';
import { useT } from '@/i18n';
import type { Transaction } from '@/lib/transactions';

export function DailyChart({ transactions }: { transactions: Transaction[] }) {
  const { t, tp } = useT();
  const { limit: DAILY_TARGET } = useDailyLimit();
  const days = useMemo(() => dailyExpenses(transactions), [transactions]);

  const sum = days.reduce((s, d) => s + d.total, 0);
  const average = Math.round(sum / days.length);
  const scaleMax = Math.max(DAILY_TARGET * 1.2, ...days.map((d) => d.total));
  const targetBottom = (DAILY_TARGET / scaleMax) * 100;
  const overDays = days.filter((d) => d.total > DAILY_TARGET).length;

  return (
    <div>
      <p className="mb-6 text-sm text-slate-500">
        {t('shell.daily.average', { amount: rupiahLabel(average) })}
        {overDays > 0 ? tp('shell.daily.over', overDays) : ''}
      </p>

      <div
        className="relative h-36"
        role="img"
        aria-label={t('shell.daily.aria', { days: days.length, amount: rupiahLabel(average) })}
      >
        <div
          className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-slate-700/60"
          style={{ bottom: `${targetBottom}%` }}
        >
          <span className="absolute -top-2.5 right-0 rounded bg-white px-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
            {t('shell.daily.limit', { amount: rupiahLabel(DAILY_TARGET) })}
          </span>
        </div>

        <div className="relative flex h-full items-end gap-1.5 sm:gap-2">
          {days.map((d) => {
            const height = d.total ? Math.max(3, (d.total / scaleMax) * 100) : 0;
            const color = d.total > DAILY_TARGET ? 'bg-amber-500' : d.isToday ? 'bg-brand' : 'bg-brand/60';
            return (
              <div
                key={d.date}
                className="flex h-full flex-1 items-end"
                title={`${d.date}: ${rupiahLabel(d.total)}`}
              >
                <div className={`w-full rounded-t ${color}`} style={{ height: `${height}%` }} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex gap-1.5 sm:gap-2" aria-hidden="true">
        {days.map((d) => (
          <span
            key={d.date}
            className={`flex-1 text-center text-[11px] ${
              d.isToday ? 'font-bold text-slate-900' : 'text-slate-400'
            }`}
          >
            {d.day}
          </span>
        ))}
      </div>
    </div>
  );
}
