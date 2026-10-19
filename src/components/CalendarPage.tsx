import { useMemo, useState } from 'react';
import { CalendarClock, ChevronLeft, ChevronRight, Loader2, Target } from 'lucide-react';
import { useT, locale } from '@/i18n';
import { usePlans } from '@/hooks/usePlans';
import { usePrivacy } from '@/hooks/usePrivacy';
import { buildCalendar, monthGrid, upcomingBills, type ScheduledItem } from '@/lib/calendar';
import { parseISODate, todayISO } from '@/lib/date';
import { goalPercent, type Recurring } from '@/lib/plans';
import { monthLabel, shiftMonth } from '@/lib/report';
import type { Transaction } from '@/lib/transactions';

interface CalendarPageProps {
  /** Transaksi tanpa transfer. */
  transactions: Transaction[];
  onRecord: (rule: Recurring, date: string) => Promise<void>;
  onSkip: (rule: Recurring) => void;
}

const DOT = {
  income: 'bg-emerald-500',
  expense: 'bg-brand',
  scheduled: 'bg-amber-400 ring-1 ring-amber-500/40',
  goal: 'bg-violet-500',
} as const;

function weekdayNames(): string[] {
  // 2024-01-01 adalah hari Senin.
  return Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 1 + i).toLocaleDateString(locale(), { weekday: 'short' }),
  );
}

export function CalendarPage({ transactions, onRecord, onSkip }: CalendarPageProps) {
  const { t, tp } = useT();
  const { money } = usePrivacy();
  const { recurring, goals } = usePlans();
  const today = todayISO();
  const thisMonth = today.slice(0, 7);

  const [month, setMonth] = useState(thisMonth);
  const [selected, setSelected] = useState(today);
  const [busy, setBusy] = useState<string | null>(null);

  const cal = useMemo(() => buildCalendar(transactions, recurring, goals, month, today), [transactions, recurring, goals, month, today]);
  const weeks = useMemo(() => monthGrid(month), [month]);
  const bills = useMemo(() => upcomingBills(recurring, today, 7), [recurring, today]);
  const names = weekdayNames();

  const activeDate = selected.startsWith(month) ? selected : `${month}-01`;
  const day = cal.days.get(activeDate);
  const isPast = month < thisMonth;

  function go(delta: number) {
    const next = shiftMonth(month, delta);
    setMonth(next);
    setSelected(next === thisMonth ? today : `${next}-01`);
  }

  async function record(item: ScheduledItem, date: string) {
    if (busy) return;
    setBusy(item.rule.id);
    try {
      await onRecord(item.rule, date);
    } finally {
      setBusy(null);
    }
  }

  function cellLabel(date: string): string {
    const d = cal.days.get(date);
    const parts: string[] = [];
    if (d?.actual.length) parts.push(tp('cal.cell.tx', d.actual.length));
    if (d?.scheduled.length) parts.push(tp('cal.cell.sched', d.scheduled.length));
    if (d?.goals.length) parts.push(tp('cal.cell.goal', d.goals.length));
    const long = parseISODate(date).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });
    return t('cal.cell', { date: long, summary: parts.length ? parts.join(', ') : t('cal.cell.none') });
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex items-center gap-1.5">
          <button onClick={() => go(-1)} aria-label={t('cal.prev')} className="rounded-xl border border-slate-200 bg-card p-2 text-slate-600 hover:bg-slate-50">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="min-w-36 text-center text-sm font-bold capitalize text-slate-800" aria-live="polite">{monthLabel(month)}</p>
          <button onClick={() => go(1)} aria-label={t('cal.next')} className="rounded-xl border border-slate-200 bg-card p-2 text-slate-600 hover:bg-slate-50">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => { setMonth(thisMonth); setSelected(today); }}
            disabled={month === thisMonth && selected === today}
            className="ml-1 rounded-xl border border-slate-200 bg-card px-3 py-2 text-xs font-semibold text-brand-600 hover:bg-rose-50 disabled:opacity-40"
          >
            {t('cal.today')}
          </button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-line bg-card p-4 shadow-card sm:p-5" aria-label={t('cal.title')}>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {names.map((n) => <span key={n}>{n}</span>)}
          </div>
          <div className="mt-1 space-y-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {week.map((date, ci) => {
                  if (!date) return <span key={ci} />;
                  const d = cal.days.get(date);
                  const isSel = date === activeDate;
                  const isToday = date === today;
                  return (
                    <button
                      key={date}
                      onClick={() => setSelected(date)}
                      aria-label={cellLabel(date)}
                      aria-pressed={isSel}
                      aria-current={isToday ? 'date' : undefined}
                      data-date={date}
                      className={`flex aspect-square flex-col items-center justify-between rounded-xl border p-1 text-sm transition-colors sm:p-1.5 ${
                        isSel ? 'border-brand bg-rose-50 text-brand-600' : 'border-transparent hover:bg-slate-50 text-slate-700'
                      } ${isToday ? 'ring-1 ring-brand/50' : ''}`}
                    >
                      <span className={`text-xs sm:text-sm ${isToday ? 'font-display font-bold' : 'font-semibold'}`}>{Number(date.slice(8))}</span>
                      <span className="flex h-2 items-center gap-0.5" aria-hidden>
                        {d && d.income > 0 && <i className={`h-1.5 w-1.5 rounded-full ${DOT.income}`} data-kind="income" />}
                        {d && d.expense > 0 && <i className={`h-1.5 w-1.5 rounded-full ${DOT.expense}`} data-kind="expense" />}
                        {d && d.scheduled.length > 0 && <i className={`h-1.5 w-1.5 rounded-full ${DOT.scheduled}`} data-kind="scheduled" />}
                        {d && d.goals.length > 0 && <i className={`h-1.5 w-1.5 rounded-full ${DOT.goal}`} data-kind="goal" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
            {(['income', 'expense', 'scheduled', 'goal'] as const).map((k) => (
              <li key={k} className="flex items-center gap-1.5">
                <i className={`h-2 w-2 rounded-full ${DOT[k]}`} aria-hidden />
                {t(`cal.legend.${k}` as const)}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-slate-500">{t('cal.legend.note')}</p>
        </section>

        <div className="space-y-5">
          <section className="rounded-2xl border border-line bg-card p-5 shadow-card" aria-labelledby="cal-summary">
            <h2 id="cal-summary" className="text-base font-bold tracking-tight text-slate-900">{t('cal.summary.title')}</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-xs font-semibold text-slate-500">{t('cal.summary.actual')}</dt>
                <dd className="mt-1 flex justify-between"><span>{t('cal.summary.income')}</span><b className="tabular-nums text-emerald-600" data-testid="cal-actual-income">{money(cal.actualIncome)}</b></dd>
                <dd className="flex justify-between"><span>{t('cal.summary.expense')}</span><b className="tabular-nums text-brand-600" data-testid="cal-actual-expense">{money(cal.actualExpense)}</b></dd>
              </div>
              {isPast ? (
                <p className="text-xs text-slate-500">{t('cal.summary.pastNote')}</p>
              ) : (
                <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-3">
                  <dt className="text-xs font-semibold text-amber-800">{t('cal.summary.scheduled')}</dt>
                  <dd className="mt-1 flex justify-between"><span>{t('cal.summary.income')}</span><b className="tabular-nums" data-testid="cal-sched-income">{money(cal.scheduledIncome)}</b></dd>
                  <dd className="flex justify-between"><span>{t('cal.summary.expense')}</span><b className="tabular-nums" data-testid="cal-sched-expense">{money(cal.scheduledExpense)}</b></dd>
                  {cal.unfinished > 0 && <dd className="mt-2 text-xs font-semibold text-amber-800">{tp('cal.summary.unfinished', cal.unfinished)}</dd>}
                </div>
              )}
            </dl>
          </section>

          <section className="rounded-2xl border border-line bg-card p-5 shadow-card" aria-labelledby="cal-bills">
            <h2 id="cal-bills" className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-900">
              <CalendarClock className="h-4 w-4 text-brand-600" />
              {t('cal.upcoming.title')}
            </h2>
            {bills.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">{t('cal.upcoming.none')}</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100 text-sm">
                {bills.map(({ rule, date, inDays }) => (
                  <li key={rule.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-800">{rule.description}</span>
                      <span className="text-xs text-slate-500">
                        {parseISODate(date).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })} · {inDays === 0 ? t('cal.upcoming.today') : tp('cal.upcoming.in', inDays)}
                      </span>
                    </span>
                    <b className="tabular-nums text-brand-600">−{money(rule.total)}</b>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="rounded-2xl border border-line bg-card p-5 shadow-card sm:p-6" aria-labelledby="cal-day">
        <h2 id="cal-day" className="text-base font-bold tracking-tight text-slate-900">
          {t('cal.day.title', { date: parseISODate(activeDate).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) })}
        </h2>
        {!day || (!day.actual.length && !day.scheduled.length && !day.goals.length) ? (
          <p className="mt-3 text-sm text-slate-500">{t('cal.day.empty')}</p>
        ) : (
          <div className="mt-3 space-y-4">
            {day.actual.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500">{t('cal.day.actual')}</h3>
                <ul className="mt-1 divide-y divide-slate-100">
                  {day.actual.map((tx) => (
                    <li key={tx.id + tx.type} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate"><b className="font-semibold text-slate-800">{tx.description || tx.category}</b> <span className="text-xs text-slate-500">{tx.category}{tx.account ? ` · ${tx.account}` : ''}</span></span>
                      <b className={`shrink-0 tabular-nums ${tx.type === 'expense' ? 'text-slate-900' : 'text-emerald-600'}`}>{tx.type === 'expense' ? '−' : '+'}{money(tx.total)}</b>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {day.scheduled.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-amber-800">{t('cal.day.scheduled')}</h3>
                <ul className="mt-1 space-y-2">
                  {day.scheduled.map((item) => (
                    <li key={item.rule.id} data-status={item.status} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-dashed border-amber-300 bg-amber-50/40 px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-slate-800">{item.rule.description}</span>
                        <span className="text-xs text-slate-500">{t(`cal.status.${item.status}` as const)}</span>
                      </span>
                      <b className={`tabular-nums ${item.rule.type === 'expense' ? 'text-slate-900' : 'text-emerald-600'}`}>{item.rule.type === 'expense' ? '−' : '+'}{money(item.rule.total)}</b>
                      {item.status === 'due' && (
                        <span className="flex gap-1.5">
                          <button
                            onClick={() => record(item, activeDate)}
                            disabled={busy !== null}
                            aria-label={t('due.recordAria', { name: item.rule.description })}
                            className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-dark disabled:opacity-50"
                          >
                            {busy === item.rule.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            {t('due.record')}
                          </button>
                          <button
                            onClick={() => onSkip(item.rule)}
                            disabled={busy !== null}
                            aria-label={t('due.skipAria', { name: item.rule.description })}
                            className="rounded-lg border border-amber-300 bg-card px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                          >
                            {t('due.skip')}
                          </button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {day.goals.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-violet-700">{t('cal.day.goals')}</h3>
                <ul className="mt-1 space-y-2">
                  {day.goals.map((g) => (
                    <li key={g.id} className="flex items-center gap-3 rounded-xl border border-dashed border-violet-300 bg-violet-50/40 px-3 py-2 text-sm">
                      <Target className="h-4 w-4 shrink-0 text-violet-600" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-slate-800">{g.name}</span>
                        <span className="text-xs text-slate-500">{t('cal.goal.progress', { saved: money(g.saved), target: money(g.target) })}</span>
                      </span>
                      <b className="tabular-nums text-violet-700">{goalPercent(g)}%</b>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
