import { useMemo, useState } from 'react';
import { useDailyLimit } from '@/hooks/useDailyLimit';
import { parseISODate } from '@/lib/date';
import { rupiahLabel } from '@/lib/format';
import { dailyExpenses } from '@/lib/summary';
import { useT, locale } from '@/i18n';
import type { Transaction } from '@/lib/transactions';

const compact = (n: number) =>
  `Rp ${new Intl.NumberFormat(locale(), { notation: 'compact', maximumFractionDigits: 1 }).format(n)}`;

export function DailyChart({ transactions }: { transactions: Transaction[] }) {
  const { t, tp } = useT();
  const { limit: DAILY_TARGET } = useDailyLimit();
  const days = useMemo(() => dailyExpenses(transactions), [transactions]);
  const [active, setActive] = useState<number | null>(null);

  const sum = days.reduce((s, d) => s + d.total, 0);
  const average = Math.round(sum / days.length);
  const scaleMax = Math.max(DAILY_TARGET * 1.2, ...days.map((d) => d.total));
  const targetBottom = (DAILY_TARGET / scaleMax) * 100;
  const overDays = days.filter((d) => d.total > DAILY_TARGET).length;

  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => parseISODate(iso).toLocaleDateString(locale(), opts);
  const period = t('ux.daily.period', {
    from: fmt(days[0].date, { day: 'numeric', month: 'short' }),
    to: fmt(days[days.length - 1].date, { day: 'numeric', month: 'short', year: 'numeric' }),
  });
  const shown = days[active ?? days.length - 1];
  const caption = t('ux.daily.bar', {
    date: fmt(shown.date, { weekday: 'long', day: 'numeric', month: 'long' }),
    amount: rupiahLabel(shown.total),
  });

  if (sum === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center" data-testid="daily-empty">
        <p className="text-sm text-slate-500">{t('ux.daily.empty')}</p>
        <p className="mt-1 text-xs text-slate-500">{period}</p>
      </div>
    );
  }

  const ticks = [scaleMax, scaleMax / 2, 0];

  return (
    <div>
      <p className="text-sm text-slate-500">
        {t('shell.daily.average', { amount: rupiahLabel(average) })}
        {overDays > 0 ? tp('shell.daily.over', overDays) : ''}
      </p>
      <p className="mb-4 text-xs text-slate-500">{period} · {t('ux.daily.axisTop')}</p>

      <div className="flex gap-2">
        <div className="flex h-36 w-12 shrink-0 flex-col justify-between text-right text-[10px] leading-none tabular-nums text-slate-500" aria-hidden="true">
          {ticks.map((v) => <span key={v}>{v === 0 ? 'Rp 0' : compact(v)}</span>)}
        </div>

        <div className="min-w-0 flex-1">
          <div
            className="relative h-36 border-b border-slate-200"
            role="group"
            aria-label={t('shell.daily.aria', { days: days.length, amount: rupiahLabel(average) })}
          >
            <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-slate-100" aria-hidden="true" />
            <div
              className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-slate-700/60"
              style={{ bottom: `${targetBottom}%` }}
              aria-hidden="true"
            />

            <div className="relative flex h-full items-end gap-1 sm:gap-2">
              {days.map((d, i) => {
                const height = d.total ? Math.max(3, (d.total / scaleMax) * 100) : 0;
                const color = d.total > DAILY_TARGET ? 'bg-ochre' : d.isToday ? 'bg-brand-700' : 'bg-brand';
                const label = `${fmt(d.date, { day: 'numeric', month: 'long' })}: ${rupiahLabel(d.total)}`;
                return (
                  <button
                    type="button"
                    key={d.date}
                    className={`group flex h-full min-w-0 flex-1 items-end rounded-t outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${active === i ? 'opacity-100' : ''}`}
                    title={label}
                    aria-label={label}
                    onMouseEnter={() => setActive(i)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    onClick={() => setActive(i)}
                  >
                    <span className={`block w-full rounded-t transition-opacity ${color} ${active !== null && active !== i ? 'opacity-50' : ''}`} style={{ height: `${height}%` }} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-1.5 flex gap-1 sm:gap-2" aria-hidden="true">
            {days.map((d) => (
              <span key={d.date} className={`min-w-0 flex-1 text-center text-[11px] ${d.isToday ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
                {d.day}
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm font-semibold text-slate-700" aria-live="polite" data-testid="daily-caption">{caption}</p>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-slate-500">
        <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand" />{t('ux.daily.legend.under')}</li>
        <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-ochre" />{t('ux.daily.legend.over')}</li>
        <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-700" />{t('ux.daily.legend.today')}</li>
        <li className="flex items-center gap-1.5"><span className="h-0 w-4 border-t border-dashed border-slate-700/60" />{t('shell.daily.limit', { amount: rupiahLabel(DAILY_TARGET) })}</li>
      </ul>
    </div>
  );
}
