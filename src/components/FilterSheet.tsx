import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { applyFilter, rangeProblem, type TxFilter } from '@/lib/filters';
import { amountHistogram, barInRange, facetCounts } from '@/lib/filterFacets';
import { formatRupiah, parseRupiah } from '@/lib/format';
import { monthLabel } from '@/lib/report';
import { useT } from '@/i18n';
import type { Transaction } from '@/lib/transactions';

interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  transactions: Transaction[];
  /** Filter lengkap (termasuk rekening). */
  filter: TxFilter;
  onChange: (next: TxFilter) => void;
  accounts: string[];
  months: string[];
  categories: string[];
  budgets: Record<string, number>;
  /** Jumlah hasil dengan filter sekarang. */
  resultCount: number;
}

function Chip({ active, onClick, children, count, disabled }: { active: boolean; onClick: () => void; children: ReactNode; count?: number; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled ?? (count === 0 && !active)}
      className={`flex min-h-10 shrink-0 flex-col items-center justify-center rounded-xl border px-3 py-1 text-sm font-semibold leading-tight transition-colors active:scale-[0.98] disabled:opacity-40 ${
        active ? 'border-brand bg-brand-100 text-brand-800 ring-1 ring-brand' : 'border-line bg-card text-slate-700'
      }`}
    >
      <span>{children}</span>
      {count !== undefined && <span className={`text-[11px] font-medium tabular-nums ${active ? 'text-brand-700' : 'text-slate-500'}`}>{count}</span>}
    </button>
  );
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-line px-5 py-4 first:border-t-0">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {aside && <span className="text-xs font-semibold tabular-nums text-brand-700">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * Lembar filter dari bawah untuk HP: pilihan berupa chip dengan jumlah hasil, grafik sebaran nominal,
 * dan tombol bawah yang menunjukkan jumlah hasil langsung ("Tampilkan 41 transaksi").
 * Perubahan langsung berlaku, jadi menutup lembar tidak membuang pilihan.
 */
export function FilterSheet({ open, onClose, transactions, filter, onChange, accounts, months, categories, budgets, resultCount }: FilterSheetProps) {
  const { t, tp } = useT();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  const set = (patch: Partial<TxFilter>) => onChange({ ...filter, ...patch });

  const accountCounts = useMemo(() => open ? facetCounts(transactions, filter, 'account', ['', ...accounts], budgets) : new Map<string, number>(), [open, transactions, filter, accounts, budgets]);
  const monthCounts = useMemo(() => open ? facetCounts(transactions, filter, 'month', ['', ...months], budgets) : new Map<string, number>(), [open, transactions, filter, months, budgets]);
  const categoryCounts = useMemo(() => open ? facetCounts(transactions, filter, 'category', ['', ...categories], budgets) : new Map<string, number>(), [open, transactions, filter, categories, budgets]);
  const sortedCategories = useMemo(
    () => categories.filter((c) => (categoryCounts.get(c) ?? 0) > 0 || filter.category === c).sort((a, b) => (categoryCounts.get(b) ?? 0) - (categoryCounts.get(a) ?? 0) || a.localeCompare(b)),
    [categories, categoryCounts, filter.category],
  );

  // Sebaran nominal dihitung tanpa batas nominal supaya grafik tidak ikut menyusut saat rentang dipersempit.
  const hist = useMemo(
    () => open ? amountHistogram(applyFilter(transactions, { ...filter, min: null, max: null }, budgets).map((x) => x.total)) : null,
    [open, transactions, filter, budgets],
  );

  if (!open) return null;
  const problem = rangeProblem(filter);
  const anyOnPage = hist?.total ?? 0;

  const amountInput = (key: 'min' | 'max', label: string) => (
    <label className="block text-xs font-semibold text-slate-500">
      {label}
      <input
        inputMode="numeric" placeholder="0" className="form-input mt-1 tabular-nums"
        value={filter[key] === null ? '' : formatRupiah(String(filter[key]))}
        onChange={(e) => set({ [key]: e.target.value.replace(/\D/g, '') ? parseRupiah(e.target.value) : null } as Partial<TxFilter>)}
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-[60] sm:hidden" data-testid="filter-sheet">
      <div className="absolute inset-0 animate-[fadeIn_0.15s_ease-out] bg-ink/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('sheet.title')}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 flex max-h-[90dvh] flex-col rounded-t-3xl bg-card shadow-2xl outline-none animate-[sheetIn_0.22s_ease-out]"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300" aria-hidden="true" />
        <div className="flex items-center justify-between px-4 py-2">
          <button onClick={onClose} aria-label={t('sheet.close')} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700">
            <X className="h-4 w-4" />
          </button>
          <h2 className="font-display text-lg font-semibold">{t('sheet.title')}</h2>
          <button
            data-testid="filter-reset"
            onClick={() => onChange({ ...filter, account: '', month: '', category: '', from: '', to: '', min: null, max: null, overBudget: false, noDescription: false })}
            className="min-h-10 rounded-lg px-2 text-sm font-semibold text-brand-700"
          >
            {t('sheet.reset')}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-line">
          <Section title={t('sheet.account')}>
            <div className="flex flex-wrap gap-2">
              <Chip active={filter.account === ''} onClick={() => set({ account: '' })} count={accountCounts.get('')}>{t('sheet.all')}</Chip>
              {accounts.map((a) => (
                <Chip key={a} active={filter.account === a} onClick={() => set({ account: a })} count={accountCounts.get(a)}>{a}</Chip>
              ))}
            </div>
          </Section>

          <Section title={t('sheet.month')}>
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
              <Chip active={filter.month === ''} onClick={() => set({ month: '' })} count={monthCounts.get('')}>{t('sheet.all')}</Chip>
              {months.map((m) => (
                <Chip key={m} active={filter.month === m} onClick={() => set({ month: m })} count={monthCounts.get(m)}>{monthLabel(m)}</Chip>
              ))}
            </div>
          </Section>

          <Section title={t('sheet.category')}>
            <div className="flex flex-wrap gap-2">
              <Chip active={filter.category === ''} onClick={() => set({ category: '' })} count={categoryCounts.get('')}>{t('sheet.all')}</Chip>
              {sortedCategories.map((c) => (
                <Chip key={c} active={filter.category === c} onClick={() => set({ category: c })} count={categoryCounts.get(c)}>{c}</Chip>
              ))}
            </div>
          </Section>

          <Section title={t('sheet.amount')} aside={t('sheet.amount.of', { n: resultCount, total: anyOnPage })}>
            {hist && anyOnPage > 0 && (
              <div role="img" aria-label={t('sheet.chart')} className="mb-3 flex h-16 items-end gap-[3px]">
                {hist.bars.map((b, i) => (
                  <span
                    key={i}
                    className={`flex-1 rounded-t-[3px] ${barInRange(hist, i, filter.min, filter.max) ? 'bg-brand' : 'bg-slate-200'}`}
                    style={{ height: `${Math.max(6, Math.round(b * 100))}%` }}
                  />
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {amountInput('min', t('filter.min'))}
              {amountInput('max', t('filter.max'))}
            </div>
            {problem === 'amount' && <p role="alert" className="mt-2 text-xs font-medium text-amber-700">{t('filter.problem.amount')}</p>}
          </Section>

          <Section title={t('sheet.date')}>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-500">
                {t('filter.from')}
                <input type="date" className="form-input mt-1" value={filter.from} onChange={(e) => set({ from: e.target.value })} />
              </label>
              <label className="block text-xs font-semibold text-slate-500">
                {t('filter.to')}
                <input type="date" className="form-input mt-1" value={filter.to} onChange={(e) => set({ to: e.target.value })} />
              </label>
            </div>
            {problem === 'date' && <p role="alert" className="mt-2 text-xs font-medium text-amber-700">{t('filter.problem.date')}</p>}
          </Section>

          <Section title={t('sheet.other')}>
            <div className="space-y-3 text-sm text-slate-700">
              <label className="flex min-h-10 cursor-pointer items-start gap-3">
                <input type="checkbox" className="mt-0.5 h-5 w-5 rounded border-slate-300 accent-brand" checked={filter.overBudget} onChange={(e) => set({ overBudget: e.target.checked })} />
                <span>
                  {t('filter.overBudget')}
                  <span className="block text-xs text-slate-500">{t('filter.overBudget.hint')}</span>
                </span>
              </label>
              <label className="flex min-h-10 cursor-pointer items-start gap-3">
                <input type="checkbox" className="mt-0.5 h-5 w-5 rounded border-slate-300 accent-brand" checked={filter.noDescription} onChange={(e) => set({ noDescription: e.target.checked })} />
                <span>{t('filter.noDescription')}</span>
              </label>
            </div>
          </Section>
        </div>

        <div className="border-t border-line bg-card px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <button
            data-testid="filter-apply"
            onClick={onClose}
            className="flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-4 text-base font-semibold text-white transition-colors active:bg-brand-600"
          >
            <span aria-live="polite">{resultCount > 0 ? tp('sheet.show', resultCount) : t('sheet.show.none')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

