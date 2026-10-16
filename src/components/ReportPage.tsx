import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Check, TrendingDown, TrendingUp } from 'lucide-react';
import { EXPENSE_CATEGORIES, getCategoryMeta } from '@/lib/categories';
import { formatRupiah, parseRupiah, rupiahLabel, rupiahSigned } from '@/lib/format';
import { toLocalISO, parseISODate } from '@/lib/date';
import { useT, locale, type MessageKey } from '@/i18n';
import { rich } from '@/i18n/rich';
import {
  budgetStatus, monthLabel, monthReport, monthlyTrend, monthsWithData, percentChange, shiftMonth,
  type BudgetStatus, type Month,
} from '@/lib/report';
import { useBudgets } from '@/hooks/useBudgets';
import { MAX_BUDGET } from '@/lib/plans';
import { InsightsPanel } from '@/components/InsightsPanel';
import type { Transaction } from '@/lib/transactions';

interface ReportPageProps {
  /** Transaksi tanpa transfer sudah disaring di sini juga; transfer tidak pernah dihitung. */
  transactions: Transaction[];
}

const STATUS_STYLE: Record<BudgetStatus, { bar: string; text: string; label: MessageKey | null }> = {
  none: { bar: 'bg-brand', text: 'text-slate-400', label: null },
  ok: { bar: 'bg-emerald-500', text: 'text-emerald-700', label: 'forms.budget.ok' },
  warn: { bar: 'bg-amber-500', text: 'text-amber-700', label: 'forms.budget.warn' },
  over: { bar: 'bg-red-600', text: 'text-red-700', label: 'forms.budget.over' },
};

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
        <div className="flex items-center gap-1 rounded-2xl border border-line bg-white p-1 shadow-xs" role="group" aria-label={t('forms.report.pickMonth')}>
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
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-rose-50"
          >
            {t('forms.report.backToCurrent')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={t('forms.report.income')} value={rupiahLabel(report.income)} tone="text-emerald-600" change={incomeChange} goodWhen="up" />
        <Tile label={t('forms.report.expense')} value={rupiahLabel(report.expense)} tone="text-brand" change={expenseChange} goodWhen="down" />
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
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
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
            <p className="py-6 text-center text-sm text-slate-400">{t('forms.report.noData')}</p>
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

      <BudgetPanel spentByCategory={report.categories} month={month} />

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
                    <span className="block text-xs text-slate-400">
                      {tx.category} · {parseISODate(tx.date).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-brand">−{rupiahLabel(tx.total)}</span>
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
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`mt-1.5 text-lg font-extrabold tabular-nums sm:text-xl ${tone}`}>{value}</p>
      {hasChange ? (
        <p className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${good ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {t('forms.report.changeVsLast', { change: `${change > 0 ? '+' : ''}${change}` })}
        </p>
      ) : (
        <p className="mt-1.5 text-[11px] text-slate-400">{hint ?? t(change === null ? 'forms.report.noBaseline' : 'forms.report.sameAsLast')}</p>
      )}
    </div>
  );
}

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
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
          <span key={p.month} className={`flex-1 text-center text-[11px] ${p.month === selected ? 'font-bold text-brand' : 'text-slate-400'}`}>
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

function BudgetPanel({ spentByCategory, month }: { spentByCategory: { category: string; total: number }[]; month: Month }) {
  const { t } = useT();
  const { budgets, setBudget } = useBudgets();
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const spent = useMemo(() => new Map(spentByCategory.map((c) => [c.category, c.total])), [spentByCategory]);
  const names = useMemo(() => {
    const set = new Set<string>([...EXPENSE_CATEGORIES, ...spent.keys(), ...Object.keys(budgets)]);
    // Yang punya anggaran atau pengeluaran dulu (terbesar di atas), sisanya menyusul sesuai urutan form.
    return Array.from(set).sort((a, b) => {
      const ra = (budgets[a] ? 1 : 0) + (spent.has(a) ? 1 : 0);
      const rb = (budgets[b] ? 1 : 0) + (spent.has(b) ? 1 : 0);
      return rb - ra || (spent.get(b) ?? 0) - (spent.get(a) ?? 0) || a.localeCompare(b);
    });
  }, [spent, budgets]);

  const visible = editing ? names : names.filter((n) => budgets[n] || spent.has(n));
  const totalBudget = Object.values(budgets).reduce((s, n) => s + n, 0);
  const totalSpentBudgeted = Object.keys(budgets).reduce((s, c) => s + (spent.get(c) ?? 0), 0);

  function startEdit() {
    setDrafts(Object.fromEntries(names.map((n) => [n, budgets[n] ? formatRupiah(String(budgets[n])) : ''])));
    setError(null);
    setEditing(true);
  }

  function save() {
    for (const name of names) {
      const value = parseRupiah(drafts[name] ?? '');
      if (value > MAX_BUDGET) {
        setError(t('forms.budget.tooLarge', { name }));
        return;
      }
    }
    for (const name of names) setBudget(name, parseRupiah(drafts[name] ?? ''));
    setEditing(false);
  }

  return (
    <Panel
      title={t('forms.budget.title')}
      action={
        editing ? (
          <button onClick={save} className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-dark">
            <Check className="h-3.5 w-3.5" /> {t('forms.budget.save')}
          </button>
        ) : (
          <button onClick={startEdit} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-rose-50">
            <Pencil className="h-3.5 w-3.5" /> {t('forms.budget.edit')}
          </button>
        )
      }
    >
      {!editing && totalBudget > 0 && (
        <p className="mb-4 text-sm text-slate-600">
          {rich(
            t('forms.budget.summary', {
              spent: rupiahLabel(totalSpentBudgeted), budget: rupiahLabel(totalBudget), month: monthLabel(month),
            }),
            { b: (c) => <strong className="tabular-nums text-slate-900">{c}</strong> },
          )}
        </p>
      )}
      {!editing && totalBudget === 0 && (
        <p className="mb-4 text-sm text-slate-500">
          {t('forms.budget.intro')}
        </p>
      )}
      {editing && <p className="mb-4 text-sm text-slate-500">{t('forms.budget.editHint')}</p>}

      {visible.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">{t('forms.budget.noSpending')}</p>
      ) : (
        <ul className="space-y-4">
          {visible.map((name) => {
            const meta = getCategoryMeta(name, 'expense');
            const Icon = meta.icon;
            const used = spent.get(name) ?? 0;
            const budget = budgets[name];
            const status = budgetStatus(used, budget);
            const style = STATUS_STYLE[status];
            const pct = budget ? Math.min(100, Math.round((used / budget) * 100)) : 0;
            return (
              <li key={name}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-md ${meta.bg}`}>
                      <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                    </span>
                    {name}
                  </span>
                  {editing ? (
                    <div className="relative w-40">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label={t('forms.budget.aria', { name })}
                        value={drafts[name] ?? ''}
                        placeholder={t('forms.budget.placeholder')}
                        onChange={(e) => setDrafts((d) => ({ ...d, [name]: formatRupiah(e.target.value) }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
                        className="form-input !py-1.5 pl-9 text-right text-sm tabular-nums"
                      />
                    </div>
                  ) : (
                    <span className="text-sm tabular-nums text-slate-500">
                      <strong className="text-slate-900">{rupiahLabel(used)}</strong>
                      {budget ? ` / ${rupiahLabel(budget)}` : ''}
                    </span>
                  )}
                </div>
                {!editing && (
                  <>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-slate-100"
                      role="progressbar"
                      aria-label={t('forms.budget.aria', { name })}
                      aria-valuemin={0}
                      aria-valuemax={budget || undefined}
                      aria-valuenow={budget ? Math.min(used, budget) : used}
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${style.bar}`}
                        style={{ width: budget ? `${pct}%` : used ? '100%' : '0%', opacity: budget ? 1 : 0.25 }}
                      />
                    </div>
                    {budget ? (
                      <p className={`mt-1 text-xs font-medium ${style.text}`}>
                        {status === 'over'
                          ? t('forms.budget.overBy', { label: style.label ? t(style.label) : '', amount: rupiahLabel(used - budget) })
                          : t('forms.budget.left', { label: style.label ? t(style.label) : '', amount: rupiahLabel(budget - used) })}
                        {' · '}{Math.round((used / budget) * 100)}%
                      </p>
                    ) : null}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {error && <p role="alert" className="mt-3 text-xs font-medium text-red-600">{error}</p>}
      {editing && (
        <button onClick={() => setEditing(false)} className="mt-4 text-xs font-semibold text-slate-500 hover:text-slate-700">
          {t('forms.budget.cancel')}
        </button>
      )}
    </Panel>
  );
}
