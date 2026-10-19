import { useEffect, useMemo, useState } from 'react';
import { Bookmark, ChevronDown, Download, Search, X } from 'lucide-react';
import { TransactionList } from '@/components/TransactionList';
import { isDebtPaymentCategory } from '@/lib/categories';
import { formatRupiah, parseRupiah, rupiahLabel } from '@/lib/format';
import { monthLabel, monthsWithData } from '@/lib/report';
import {
  EMPTY_FILTER, MAX_SAVED_FILTERS, advancedCount, applyFilter, hasAnyFilter, rangeProblem, sanitizeForUse,
  type TxFilter, type TypeFilter,
} from '@/lib/filters';
import { useBudgets } from '@/hooks/useBudgets';
import { useSavedFilters } from '@/hooks/useSavedFilters';
import { downloadCsv } from '@/lib/csv';
import { useT, type MessageKey } from '@/i18n';
import type { Transaction } from '@/lib/transactions';

const TYPE_TABS: { value: TypeFilter; label: MessageKey }[] = [
  { value: 'all', label: 'shell.type.all' },
  { value: 'expense', label: 'shell.type.expense' },
  { value: 'income', label: 'shell.type.income' },
];

const PAGE_SIZE = 20;

interface TransactionsPageProps {
  transactions: Transaction[];
  /** Nama rekening yang bisa dipilih sebagai filter. */
  accounts: string[];
  onDelete: (tx: Transaction) => Promise<void>;
  onEdit?: (tx: Transaction) => void;
  account: string;
  onAccountChange: (account: string) => void;
}

export function TransactionsPage({ transactions, accounts, onDelete, onEdit, account, onAccountChange }: TransactionsPageProps) {
  const { t, tp } = useT();
  const { budgets } = useBudgets();
  const [f, setF] = useState<TxFilter>(EMPTY_FILTER);
  const { type, query, month, category } = f;
  const setType = (v: TypeFilter) => setF((p) => ({ ...p, type: v }));
  const setQuery = (v: string) => setF((p) => ({ ...p, query: v }));
  const setMonth = (v: string) => setF((p) => ({ ...p, month: v }));
  const setCategory = (v: string) => setF((p) => ({ ...p, category: v }));
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [naming, setNaming] = useState(false);
  const [presetName, setPresetName] = useState('');
  const { saved, save, remove, full } = useSavedFilters();
  const [exportMsg, setExportMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!exportMsg) return;
    const id = window.setTimeout(() => setExportMsg(null), 4000);
    return () => window.clearTimeout(id);
  }, [exportMsg]);

  async function exportAs(kind: 'csv' | 'xlsx') {
    if (!filtered.length) {
      setExportMsg({ ok: false, text: t('export.empty') });
      return;
    }
    try {
      if (kind === 'csv') downloadCsv(filtered);
      else await (await import('@/lib/excelFile')).downloadTransactions(filtered);
      setExportMsg({ ok: true, text: t('export.done', { n: filtered.length }) });
    } catch (err) {
      console.error('Ekspor gagal:', err);
      setExportMsg({ ok: false, text: t('export.failed') });
    }
  }

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [f, account]);

  const months = useMemo(() => monthsWithData(transactions), [transactions]);
  const categories = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.category))).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [transactions],
  );

  const full_ = useMemo(() => ({ ...f, account }), [f, account]);
  const filtered = useMemo(() => applyFilter(transactions, full_, budgets), [transactions, full_, budgets]);
  const advanced = advancedCount(f);
  const problem = rangeProblem(f);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of filtered) {
      if (isDebtPaymentCategory(tx.category)) continue; // bukan konsumsi baru
      if (tx.type === 'income') income += tx.total;
      else expense += tx.total;
    }
    return { income, expense };
  }, [filtered]);

  const hasFilter = hasAnyFilter(full_);

  function applySaved(preset: TxFilter) {
    const next = sanitizeForUse(preset, { accounts, months, categories });
    setF({ ...next, account: '' });
    onAccountChange(next.account);
    if (advancedCount(next) > 0) setShowAdvanced(true);
  }

  function submitPreset() {
    if (save(presetName, full_)) {
      setPresetName('');
      setNaming(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-card">
      <div className="space-y-3 border-b border-slate-100 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label={t('shell.type.group')}>
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setType(tab.value)}
                aria-pressed={type === tab.value}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  type === tab.value ? 'bg-card text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t(tab.label)}
              </button>
            ))}
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:contents">
          <select
            value={account}
            onChange={(e) => onAccountChange(e.target.value)}
            className="form-input sm:!w-auto"
            aria-label={t('shell.tx.filterAccount')}
          >
            <option value="">{t('shell.tx.allAccounts')}</option>
            {accounts.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="form-input sm:!w-auto"
            aria-label={t('shell.tx.filterMonth')}
          >
            <option value="">{t('shell.tx.allMonths')}</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="form-input col-span-2 sm:col-span-1 sm:!w-auto"
            aria-label={t('shell.tx.filterCategory')}
          >
            <option value="">{t('shell.tx.allCategories')}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          </div>

          <button
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
            aria-controls="advanced-filters"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
          >
            {t('filter.advanced')}
            {advanced > 0 && <span className="rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">{advanced}</span>}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>

          {hasFilter && (
            <button
              onClick={() => { setF(EMPTY_FILTER); onAccountChange(''); }}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-600 transition-colors hover:bg-rose-50"
            >
              {t('shell.tx.clear')}
            </button>
          )}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('shell.tx.searchPlaceholder')}
            className="form-input pl-9"
            aria-label={t('shell.tx.search')}
          />
        </div>

        {showAdvanced && (
          <div id="advanced-filters" className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-xs font-semibold text-slate-500">
                {t('filter.from')}
                <input type="date" className="form-input mt-1" value={f.from} onChange={(e) => setF((p) => ({ ...p, from: e.target.value }))} />
              </label>
              <label className="block text-xs font-semibold text-slate-500">
                {t('filter.to')}
                <input type="date" className="form-input mt-1" value={f.to} onChange={(e) => setF((p) => ({ ...p, to: e.target.value }))} />
              </label>
              <label className="block text-xs font-semibold text-slate-500">
                {t('filter.min')}
                <input
                  inputMode="numeric" placeholder="0" className="form-input mt-1 tabular-nums"
                  value={f.min === null ? '' : formatRupiah(String(f.min))}
                  onChange={(e) => setF((p) => ({ ...p, min: e.target.value.replace(/\D/g, '') ? parseRupiah(e.target.value) : null }))}
                />
              </label>
              <label className="block text-xs font-semibold text-slate-500">
                {t('filter.max')}
                <input
                  inputMode="numeric" placeholder="0" className="form-input mt-1 tabular-nums"
                  value={f.max === null ? '' : formatRupiah(String(f.max))}
                  onChange={(e) => setF((p) => ({ ...p, max: e.target.value.replace(/\D/g, '') ? parseRupiah(e.target.value) : null }))}
                />
              </label>
            </div>
            {problem && <p role="alert" className="text-xs font-medium text-amber-700">{t(problem === 'date' ? 'filter.problem.date' : 'filter.problem.amount')}</p>}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
              <label className="flex cursor-pointer items-start gap-2">
                <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand" checked={f.overBudget} onChange={(e) => setF((p) => ({ ...p, overBudget: e.target.checked }))} />
                <span>
                  {t('filter.overBudget')}
                  <span className="block text-xs text-slate-500">{t('filter.overBudget.hint')}</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2">
                <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand" checked={f.noDescription} onChange={(e) => setF((p) => ({ ...p, noDescription: e.target.checked }))} />
                <span>{t('filter.noDescription')}</span>
              </label>
            </div>
          </div>
        )}

        {(saved.length > 0 || hasFilter) && (
          <div className="flex flex-wrap items-center gap-2" aria-label={t('filter.saved.title')}>
            {saved.length > 0 && <span className="flex items-center gap-1 text-xs font-semibold text-slate-500"><Bookmark className="h-3.5 w-3.5" />{t('filter.saved.title')}</span>}
            {saved.map((s) => (
              <span key={s.id} className="flex items-center rounded-full border border-slate-200 bg-card text-xs font-semibold text-slate-700">
                <button onClick={() => applySaved(s.filter)} aria-label={t('filter.saved.apply', { name: s.name })} className="rounded-l-full py-1 pl-3 pr-1.5 hover:text-brand-700">
                  {s.name}
                </button>
                <button onClick={() => remove(s.id)} aria-label={t('filter.saved.delete', { name: s.name })} className="rounded-r-full py-1 pl-0.5 pr-2 text-slate-500 hover:text-rose-600">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {hasFilter && !naming && (
              <button
                onClick={() => setNaming(true)}
                disabled={full}
                title={full ? t('filter.saved.full', { n: MAX_SAVED_FILTERS }) : undefined}
                className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs font-semibold text-brand-600 hover:bg-rose-50 disabled:opacity-50"
              >
                {t('filter.save')}
              </button>
            )}
            {naming && (
              <form onSubmit={(e) => { e.preventDefault(); submitPreset(); }} className="flex items-center gap-1.5">
                <input
                  autoFocus maxLength={40} value={presetName} onChange={(e) => setPresetName(e.target.value)}
                  aria-label={t('filter.save.name')} placeholder={t('filter.save.name')} className="form-input !w-44 !py-1 text-xs"
                />
                <button type="submit" disabled={!presetName.trim()} className="rounded-lg bg-brand px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50">{t('filter.save.confirm')}</button>
                <button type="button" onClick={() => { setNaming(false); setPresetName(''); }} aria-label={t('forms.budget.cancel')} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-3.5 w-3.5" /></button>
              </form>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{tp('shell.tx.count', filtered.length)}</span>
          <span>
            {t('shell.type.income')} <span className="font-semibold text-emerald-600 tabular-nums">+{rupiahLabel(totals.income)}</span>
          </span>
          <span>
            {t('shell.type.expense')} <span className="font-semibold text-brand-600 tabular-nums">−{rupiahLabel(totals.expense)}</span>
          </span>
          <span className="ml-auto flex items-center gap-1.5" role="group" aria-label={t('export.title')}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <button type="button" data-testid="export-csv" onClick={() => exportAs('csv')} disabled={!filtered.length} title={t('export.hint', { n: filtered.length })} className="rounded-md px-2 py-1 font-semibold text-brand-600 hover:bg-rose-50 disabled:opacity-40">
              {t('export.csv')}
            </button>
            <button type="button" data-testid="export-xlsx" onClick={() => exportAs('xlsx')} disabled={!filtered.length} title={t('export.hint', { n: filtered.length })} className="rounded-md px-2 py-1 font-semibold text-brand-600 hover:bg-rose-50 disabled:opacity-40">
              {t('export.xlsx')}
            </button>
          </span>
          {exportMsg && (
            <span role="status" data-testid="export-msg" className={`basis-full text-right font-medium ${exportMsg.ok ? 'text-emerald-700' : 'text-red-700'}`}>{exportMsg.text}</span>
          )}
        </div>
      </div>

      <div className="px-4 pb-1 pt-4 sm:px-5">
        <TransactionList
          transactions={filtered.slice(0, visible)}
          onDelete={onDelete}
          onEdit={onEdit}
          emptyTitle={hasFilter ? t('shell.tx.noMatch') : t('shell.list.emptyTitle')}
          emptyHint={
            hasFilter
              ? t('shell.tx.noMatchHint')
              : t('shell.tx.emptyHint')
          }
        />
      </div>

      {filtered.length > visible && (
        <div className="border-t border-slate-100 p-3 text-center">
          <button
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-brand-600 transition-colors hover:bg-rose-50"
          >
            {t('shell.tx.more', { n: Math.min(PAGE_SIZE, filtered.length - visible) })}
          </button>
        </div>
      )}
    </div>
  );
}
