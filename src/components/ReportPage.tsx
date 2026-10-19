import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react';
import { getCategoryMeta } from '@/lib/categories';
import { rupiahLabel, rupiahSigned } from '@/lib/format';
import { toLocalISO, parseISODate } from '@/lib/date';
import { useT, locale } from '@/i18n';
import {
  monthLabel, monthReport, monthlyTrend, monthsWithData, percentChange, shiftMonth,
  type Month,
} from '@/lib/report';
import { InsightsPanel } from '@/components/InsightsPanel';
import type { Transaction } from '@/lib/transactions';

interface ReportPageProps {
  /** Transaksi tanpa transfer sudah disaring di sini juga; transfer tidak pernah dihitung. */
  transactions: Transaction[];
}

export function ReportPage({ transactions }: ReportPageProps) {
  const { t } = useT();
  const currentMonth = useMemo(() => toLocalISO(new Date()).slice(0, 7), []);
  const months = useMemo(() => monthsWithData(transactions), [transactions]);
  const earliest = months.length ? months[months.length - 1] : currentMonth;

  const [month, setMonth] = useState<Month>(currentMonth);
  const canPrev = month > earliest;
  const canNext = month < currentMonth;

  const report = useMemo(() => monthReport(transactions, month), [transactions, month]);
  const previous = useMemo(() => monthReport(transactions, shiftMonth(month, -1)), [transactions, month]);
  const trend = useMemo(() => monthlyTrend(transactions, month, 6), [transactions, month]);

  const expenseChange = percentChange(report.expense, previous.expense);
  const incomeChange = percentChange(report.income, previous.income);
  const empty = report.count === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-2xl border border-line bg-card p-1 shadow-xs" role="group" aria-label={t('forms.report.pickMonth')}>
          <button
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            disabled={!canPrev}
            aria-label={t('forms.report.prevMonth')}
            className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[9.5rem] px-2 text-center text-sm font-bold text-slate-900" aria-live="polite">
            {monthLabel(month)}
          </span>
          <button
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            disabled={!canNext}
            aria-label={t('forms.report.nextMonth')}
            className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {month !== currentMonth && (
          <button
            onClick={() => setMonth(currentMonth)}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-brand-600 transition-colors hover:bg-rose-50"
          >
            {t('forms.report.backToCurrent')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={t('forms.report.income')} value={rupiahLabel(report.income)} tone="text-emerald-600" change={incomeChange} goodWhen="up" />
        <Tile label={t('forms.report.expense')} value={rupiahLabel(report.expense)} tone="text-brand-600" change={expenseChange} goodWhen="down" />
        <Tile
          label={t('forms.report.net')}
          value={rupiahSigned(report.net)}
          tone={report.net >= 0 ? 'text-slate-900' : 'text-red-600'}
          hint={empty ? undefined : t(report.net >= 0 ? 'forms.report.netIncomeHigher' : 'forms.report.netExpenseHigher')}
        />
        <Tile
          label={t('forms.report.savingsRate')}
          value={report.savingsRate === null ? '–' : `${report.savingsRate}%`}
          tone={report.savingsRate !== null && report.savingsRate < 0 ? 'text-red-600' : 'text-slate-900'}
          hint={t(report.savingsRate === null ? 'forms.report.noIncome' : 'forms.report.savingsLeft')}
        />
      </div>

      {empty && (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-card px-4 py-8 text-center text-sm text-slate-500">
          {t('forms.report.empty', { month: monthLabel(month) })}
        </p>
      )}

      <InsightsPanel transactions={transactions} month={month} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title={t('forms.report.trendTitle')}>
          <Trend points={trend} selected={month} onSelect={setMonth} />
        </Panel>

        <Panel title={t('forms.report.summaryTitle')}>
          {empty ? (
            <p className="py-6 text-center text-sm text-slate-500">{t('forms.report.noData')}</p>
          ) : (
            <dl className="divide-y divide-slate-100 text-sm">
              <Row label={t('forms.report.count')} value={`${report.count}`} />
              <Row label={t('forms.report.avgPerDay')} value={rupiahLabel(report.averagePerDay)} />
              <Row
                label={t('forms.report.peakDay')}
                value={
                  report.peakDay
                    ? `${parseISODate(report.peakDay.date).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })} · ${rupiahLabel(report.peakDay.total)}`
                    : '–'
                }
              />
              <Row
                label={t('forms.report.topCategory')}
                value={report.categories[0] ? `${report.categories[0].category} · ${rupiahLabel(report.categories[0].total)}` : '–'}
              />
              <Row
                label={t('forms.report.prevExpense', { month: monthLabel(shiftMonth(month, -1), 'short') })}
                value={previous.expense ? rupiahLabel(previous.expense) : '–'}
              />
            </dl>
          )}
        </Panel>
      </div>

      {report.topExpenses.length > 0 && (
        <Panel title={t('forms.report.topExpenses')}>
          <ul className="divide-y divide-slate-100">
            {report.topExpenses.map((tx) => {
              const meta = getCategoryMeta(tx.category, 'expense');
              const Icon = meta.icon;
              return (
                <li key={tx.id + tx.type} className="flex items-center gap-3 py-2.5">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.bg}`}>
                    <Icon className={`h-4 w-4 ${meta.color}`} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{tx.description || tx.category}</span>
                    <span className="block text-xs text-slate-500">
                      {tx.category} · {parseISODate(tx.date).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-brand-600">−{rupiahLabel(tx.total)}</span>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function Tile({
  label, value, tone, change, goodWhen, hint,
}: { label: string; value: string; tone: string; change?: number | null; goodWhen?: 'up' | 'down'; hint?: string }) {
  const { t } = useT();
  const hasChange = change !== undefined && change !== null && change !== 0;
  const good = hasChange && (goodWhen === 'up' ? change > 0 : change < 0);
  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-card">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`mt-1.5 text-lg font-display font-bold tabular-nums sm:text-xl ${tone}`}>{value}</p>
      {hasChange ? (
        <p className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${good ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {t('forms.report.changeVsLast', { change: `${change > 0 ? '+' : ''}${change}` })}
        </p>
      ) : (
        <p className="mt-1.5 text-[11px] text-slate-500">{hint ?? t(change === null ? 'forms.report.noBaseline' : 'forms.report.sameAsLast')}</p>
      )}
    </div>
  );
}


function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-card sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold tracking-tight text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}

function Trend({
  points, selected, onSelect,
}: { points: { month: Month; income: number; expense: number }[]; selected: Month; onSelect: (m: Month) => void }) {
  const { t } = useT();
  const max = Math.max(1, ...points.flatMap((p) => [p.income, p.expense]));
  return (
    <div>
      <div className="flex h-40 items-end gap-2" role="list" aria-label={t('forms.report.trendAria')}>
        {points.map((p) => {
          const active = p.month === selected;
          return (
            <button
              key={p.month}
              role="listitem"
              onClick={() => onSelect(p.month)}
              aria-pressed={active}
              title={t('forms.report.trendItem', { month: monthLabel(p.month), income: rupiahLabel(p.income), expense: rupiahLabel(p.expense) })}
              className={`group flex h-full flex-1 items-end justify-center gap-1 rounded-xl px-1 transition-colors ${active ? 'bg-rose-50' : 'hover:bg-slate-50'}`}
            >
              <span className="w-full max-w-[1.25rem] rounded-t-md bg-emerald-500" style={{ height: `${(p.income / max) * 100}%`, minHeight: p.income ? 3 : 0 }} />
              <span className="w-full max-w-[1.25rem] rounded-t-md bg-brand" style={{ height: `${(p.expense / max) * 100}%`, minHeight: p.expense ? 3 : 0 }} />
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        {points.map((p) => (
          <span key={p.month} className={`flex-1 text-center text-[11px] ${p.month === selected ? 'font-bold text-brand-600' : 'text-slate-500'}`}>
            {monthLabel(p.month, 'short')}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-emerald-500" />{t('forms.report.legendIncome')}</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-brand" />{t('forms.report.legendExpense')}</span>
      </div>
    </div>
  );
}
