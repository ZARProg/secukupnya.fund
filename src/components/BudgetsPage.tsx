import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Check } from 'lucide-react';
import { EXPENSE_CATEGORIES, getCategoryMeta } from '@/lib/categories';
import { formatRupiah, parseRupiah, rupiahLabel } from '@/lib/format';
import { toLocalISO } from '@/lib/date';
import { useT, type MessageKey } from '@/i18n';
import { rich } from '@/i18n/rich';
import { budgetStatus, monthLabel, monthReport, monthsWithData, shiftMonth, type BudgetStatus, type Month } from '@/lib/report';
import { useBudgets } from '@/hooks/useBudgets';
import { MAX_BUDGET } from '@/lib/plans';
import type { Transaction } from '@/lib/transactions';

const STATUS_STYLE: Record<BudgetStatus, { bar: string; text: string; label: MessageKey | null }> = {
  none: { bar: 'bg-brand', text: 'text-slate-500', label: null },
  ok: { bar: 'bg-emerald-500', text: 'text-emerald-700', label: 'forms.budget.ok' },
  warn: { bar: 'bg-amber-500', text: 'text-amber-700', label: 'forms.budget.warn' },
  over: { bar: 'bg-red-600', text: 'text-red-700', label: 'forms.budget.over' },
};

/** Halaman Anggaran: batas pengeluaran per kategori untuk satu bulan, dengan pemilih bulan. */
export function BudgetsPage({ transactions }: { transactions: Transaction[] }) {
  const { t } = useT();
  const currentMonth = useMemo(() => toLocalISO(new Date()).slice(0, 7), []);
  const months = useMemo(() => monthsWithData(transactions), [transactions]);
  const earliest = months.length ? months[months.length - 1] : currentMonth;
  const [month, setMonth] = useState<Month>(currentMonth);
  const report = useMemo(() => monthReport(transactions, month), [transactions, month]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-2xl border border-line bg-card p-1 shadow-xs" role="group" aria-label={t('forms.report.pickMonth')}>
          <button
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            disabled={month <= earliest}
            aria-label={t('forms.report.prevMonth')}
            className="rounded-xl p-2.5 text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[9.5rem] px-2 text-center text-sm font-bold text-slate-900" aria-live="polite">{monthLabel(month)}</span>
          <button
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            disabled={month >= currentMonth}
            aria-label={t('forms.report.nextMonth')}
            className="rounded-xl p-2.5 text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {month !== currentMonth && (
          <button onClick={() => setMonth(currentMonth)} className="rounded-lg px-3 py-2 text-xs font-semibold text-brand-600 transition-colors hover:bg-rose-50">
            {t('forms.report.backToCurrent')}
          </button>
        )}
      </div>
      <BudgetPanel spentByCategory={report.categories} month={month} />
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
          <button onClick={startEdit} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-brand-600 transition-colors hover:bg-rose-50">
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
        <p className="py-4 text-center text-sm text-slate-500">{t('forms.budget.noSpending')}</p>
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
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">Rp</span>
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
