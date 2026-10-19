import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Star, X } from 'lucide-react';
import { useT, type MessageKey } from '@/i18n';
import { useRules } from '@/hooks/useRules';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/categories';
import { todayISO } from '@/lib/date';
import { rupiahLabel, shortDate } from '@/lib/format';
import { frequentSuggestions, parseQuickText, suggestionLine, type QuickRow } from '@/lib/quickAdd';
import {
  MAX_FAVORITES, addFavorite, loadMemory, remember, removeFavorite, saveMemory, type Favorite, type QuickMemory,
} from '@/lib/quickMemory';
import type { ToastState } from '@/components/Toast';
import type { Transaction, TransactionPayload } from '@/lib/transactions';
import type { Destination } from '@/hooks/useTransactions';

interface QuickAddProps {
  accounts: string[];
  transactions: Transaction[];
  sheetAvailable: boolean;
  batchReady: boolean;
  onSave: (payload: TransactionPayload, destination: Destination) => Promise<void>;
  onSaveMany: (payloads: TransactionPayload[], destination: Destination) => Promise<number>;
  onToast: (t: ToastState) => void;
  onSubmitted: () => void | Promise<void>;
  onManageAccounts: () => void;
}

interface Override {
  category?: string;
  account?: string;
  exclude?: boolean;
}

export function QuickAdd({
  accounts, transactions, sheetAvailable, batchReady, onSave, onSaveMany, onToast, onSubmitted, onManageAccounts,
}: QuickAddProps) {
  const { t, tp } = useT();
  const { rules } = useRules();
  const [text, setText] = useState('');
  const [mem, setMem] = useState<QuickMemory>(loadMemory);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [destination, setDestination] = useState<Destination>(sheetAvailable ? 'sheet' : 'local');
  const [submitting, setSubmitting] = useState(false);
  const [showFix, setShowFix] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const today = todayISO();

  // SlideOver memberi fokus ke panelnya setelah tampil; fokus input diambil sesudahnya.
  useEffect(() => {
    const id = requestAnimationFrame(() => area.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const parsed = useMemo(
    () => parseQuickText(text, { accounts, lastAccount: mem.lastAccount, lastCategory: mem.lastCategory, learned: mem.learned, rules, today }),
    [text, accounts, mem, rules, today],
  );

  const rows = parsed.map((r, i) => {
    const key = `${i}|${r.raw}`;
    const o = overrides[key] ?? {};
    const account = o.account ?? r.account;
    const category = o.category ?? r.category;
    const row: QuickRow = { ...r, account, category, ok: r.total > 0 && !!account && !!category };
    return { key, row, excluded: !!o.exclude, guess: !o.category && (r.categoryFrom === 'last' || r.categoryFrom === 'default'), byRule: !o.category && r.categoryFrom === 'rule' ? r.ruleKeyword ?? '' : '' };
  });
  const included = rows.filter((r) => !r.excluded);
  const valid = included.filter((r) => r.row.ok);
  const hasProblem = included.some((r) => !r.row.ok);

  const suggestions = useMemo(() => {
    const favKey = (f: { type: string; description: string; category: string; account: string; total: number }) =>
      [f.type, f.description.toLowerCase(), f.category, f.account, f.total].join('|');
    const taken = new Set(mem.favorites.map(favKey));
    return frequentSuggestions(transactions, today, 6).filter((s) => !taken.has(favKey(s))).slice(0, Math.max(0, 6 - mem.favorites.length));
  }, [transactions, today, mem.favorites]);

  function setOverride(key: string, patch: Override) {
    setOverrides((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  function appendLine(line: string) {
    setText((prev) => (prev.trim() ? `${prev.replace(/\s+$/, '')}\n${line}` : line));
    requestAnimationFrame(() => {
      const el = area.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  }

  function updateMem(next: QuickMemory) {
    setMem(next);
    saveMemory(next);
  }

  function favorite(r: QuickRow) {
    const next = addFavorite(mem, { type: r.type, total: r.total, description: r.description, category: r.category, account: r.account });
    if (!next) {
      onToast({ kind: 'error', message: t('quick.fav.full', { n: MAX_FAVORITES }) });
      return;
    }
    updateMem(next);
    onToast({ kind: 'success', message: t('quick.fav.added') });
  }

  async function submit() {
    if (submitting) return;
    if (hasProblem) {
      setShowFix(true);
      return;
    }
    if (!valid.length) return;
    const payloads: TransactionPayload[] = valid.map(({ row }) => ({
      date: row.date, type: row.type, category: row.category, account: row.account, description: row.description, total: row.total,
    }));
    const target: Destination = sheetAvailable ? destination : 'local';
    setSubmitting(true);
    try {
      if (payloads.length === 1) {
        await onSave(payloads[0], target);
      } else if (target === 'sheet' && !batchReady) {
        for (const p of payloads) await onSave(p, target);
      } else {
        await onSaveMany(payloads, target);
      }
      updateMem(remember(mem, payloads));
      onToast({
        kind: 'success',
        message: tp('quick.saved', payloads.length, { target: t(target === 'sheet' ? 'forms.saved.sheet' : 'forms.saved.local') }),
      });
      setText('');
      setOverrides({});
      await onSubmitted();
    } catch (err) {
      console.error('Quick add failed:', err);
      onToast({
        kind: 'error',
        message: err instanceof Error ? t('forms.toast.saveFailedWith', { message: err.message }) : t('forms.toast.saveFailed'),
      });
    } finally {
      setSubmitting(false);
    }
  }

  const chips: { id: string; label: string; line: string; fav?: Favorite }[] = [
    ...mem.favorites.map((f) => ({ id: f.id, label: chipLabel(f.description, f.category, f.total), line: suggestionLine(f), fav: f })),
    ...suggestions.map((s, i) => ({ id: `s${i}`, label: chipLabel(s.description, s.category, s.total), line: suggestionLine(s) })),
  ];

  return (
    <div className="flex flex-1 flex-col" data-testid="quick-add">
      <div className="flex-1 space-y-4 px-6 py-5">
        {accounts.length === 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" role="alert">
            {t('quick.noAccounts')}{' '}
            <button type="button" onClick={onManageAccounts} className="font-semibold underline">{t('accounts.pick.button')}</button>
          </div>
        )}

        <div>
          <label htmlFor="quick-input" className="mb-1.5 block text-xs font-semibold text-slate-500">{t('quick.input.label')}</label>
          <textarea
            id="quick-input"
            ref={area}
            rows={3}
            value={text}
            onChange={(e) => { setText(e.target.value); setShowFix(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={t('quick.input.placeholder')}
            className="form-input resize-none text-base"
            data-testid="quick-input"
          />
          <p className="mt-1.5 text-xs text-slate-500">{t('quick.input.hint')}</p>
          <p className="mt-1 text-xs text-slate-500">{t('quick.examples')}</p>
        </div>

        <section aria-label={t('quick.fav.title')}>
          <h3 className="mb-2 text-xs font-semibold text-slate-500">{t('quick.fav.title')}</h3>
          {chips.length ? (
            <>
              <ul className="flex flex-wrap gap-2" data-testid="quick-chips">
                {chips.map((c) => (
                  <li key={c.id} className="flex items-center overflow-hidden rounded-full border border-line bg-card text-xs font-semibold text-slate-700">
                    <button
                      type="button"
                      onClick={() => appendLine(c.line)}
                      aria-label={t('quick.fav.chip', { name: c.label })}
                      className="flex items-center gap-1 px-3 py-1.5 hover:bg-rose-50"
                    >
                      {c.fav && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                      {c.label}
                    </button>
                    {c.fav && (
                      <button
                        type="button"
                        onClick={() => updateMem(removeFavorite(mem, c.fav?.id ?? ''))}
                        aria-label={t('quick.fav.remove', { name: c.label })}
                        className="border-l border-line px-2 py-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-xs text-slate-500">{t('quick.fav.hint')}</p>
            </>
          ) : (
            <p className="text-xs text-slate-500">{t('quick.fav.empty')}</p>
          )}
        </section>

        <section aria-label={t('quick.preview.title')}>
          <h3 className="mb-2 text-xs font-semibold text-slate-500">{t('quick.preview.title')}</h3>
          {rows.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">{t('quick.empty')}</p>
          ) : (
            <ul className="space-y-3" data-testid="quick-rows">
              {rows.map(({ key, row, excluded, guess, byRule }) => (
                <li
                  key={key}
                  data-testid="quick-row"
                  data-ok={row.ok ? '1' : '0'}
                  className={`rounded-xl border p-3 ${excluded ? 'border-slate-200 bg-slate-50 opacity-60' : row.ok ? 'border-line bg-card' : 'border-amber-300 bg-amber-50/50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900" data-testid="quick-row-desc">{row.description || row.category}</p>
                      <p className="text-xs text-slate-500">
                        {t(row.type === 'income' ? 'forms.tab.income' : 'forms.tab.expense')} ·{' '}
                        {row.date === today ? t('quick.row.today') : shortDate(row.date)}
                      </p>
                    </div>
                    <p className={`whitespace-nowrap font-bold tabular-nums ${row.type === 'income' ? 'text-emerald-600' : 'text-slate-900'}`} data-testid="quick-row-total">
                      {row.total > 0 ? `${row.type === 'income' ? '+' : '−'}${rupiahLabel(row.total)}` : '—'}
                    </p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label className="block text-[11px] font-semibold text-slate-500">
                      <span className="flex items-center gap-1">
                        {t('quick.row.category')}
                        {guess && <span title={t('quick.guess.title')} className="rounded bg-amber-100 px-1 text-[10px] font-bold text-amber-800">{t('quick.guess')}</span>}
                        {byRule && <span title={t('rules.badge.title')} className="rounded bg-violet-100 px-1 text-[10px] font-bold text-violet-800" data-testid="quick-rule-badge">{t('rules.badge', { kw: byRule })}</span>}
                      </span>
                      <select
                        value={row.category}
                        onChange={(e) => setOverride(key, { category: e.target.value })}
                        className="form-input mt-1 py-1.5 text-sm"
                        aria-label={t('quick.row.category')}
                      >
                        {(row.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-[11px] font-semibold text-slate-500">
                      {t('quick.row.account')}
                      <select
                        value={row.account}
                        onChange={(e) => setOverride(key, { account: e.target.value })}
                        className="form-input mt-1 py-1.5 text-sm"
                        aria-label={t('quick.row.account')}
                      >
                        {!row.account && <option value="">{t('quick.row.pickAccount')}</option>}
                        {accounts.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {row.warnings.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-amber-800">
                      {row.warnings
                        .filter((w) => !(w === 'noAccount' && row.account))
                        .map((w) => (
                          <li key={w}>{t(`quick.warn.${w}` as MessageKey)}</li>
                        ))}
                    </ul>
                  )}

                  <div className="mt-2 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input type="checkbox" checked={!excluded} onChange={(e) => setOverride(key, { exclude: !e.target.checked })} />
                      {t('quick.row.include')}
                    </label>
                    {row.ok && (
                      <button
                        type="button"
                        onClick={() => favorite(row)}
                        aria-label={t('quick.fav.add')}
                        title={t('quick.fav.add')}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-500"
                      >
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {sheetAvailable && (
          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-slate-500">{t('forms.field.saveTo')}</legend>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
              {(['sheet', 'local'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDestination(d)}
                  aria-pressed={destination === d}
                  className={`rounded-lg py-2 text-xs font-semibold transition-all ${destination === d ? 'bg-card text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {t(d === 'sheet' ? 'forms.dest.sheet' : 'forms.dest.local')}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <p className="text-xs text-slate-500">{t('quick.shortcut')}</p>
      </div>

      <div className="sticky bottom-0 border-t border-slate-100 bg-card/95 px-6 py-4 backdrop-blur-md">
        {showFix && hasProblem && <p className="mb-2 text-center text-xs font-medium text-amber-800" role="alert">{t('quick.save.fix')}</p>}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting || (!valid.length && !hasProblem)}
          data-testid="quick-save"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-brand-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />{t('forms.saving')}</> : tp('quick.save', valid.length)}
        </button>
      </div>
    </div>
  );
}

function chipLabel(description: string, category: string, total: number): string {
  const name = description || category;
  return total >= 100 ? `${name} · ${rupiahLabel(total)}` : name;
}
