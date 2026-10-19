import { useState, FormEvent, useMemo } from 'react';
import { Loader2, TriangleAlert, Calendar, Tag, Wallet, FileText, DollarSign, ArrowRight, Receipt } from 'lucide-react';
import { formatRupiah, parseRupiah, rupiahLabel } from '@/lib/format';
import {
  EXPENSE_CATEGORIES, INCOME_CATEGORIES, TRANSFER_CATEGORY,
} from '@/lib/categories';
import { todayISO } from '@/lib/date';
import { useT, locale } from '@/i18n';
import { useDailyLimit } from '@/hooks/useDailyLimit';
import { useRules } from '@/hooks/useRules';
import { matchRule } from '@/lib/rules';
import { loadMemory, remember, saveMemory } from '@/lib/quickMemory';
import { AccountAvatar } from '@/components/AccountAvatar';
import { SplitBox } from '@/components/SplitBox';
import { buildSplitPayloads, rowsToParts, splitProblem, type SplitRow } from '@/lib/split';
import type { ToastState } from '@/components/Toast';
import type { Transaction, TransactionPayload } from '@/lib/transactions';
import type { Destination } from '@/hooks/useTransactions';

type TxType = 'expense' | 'income' | 'transfer';

const TABS: { id: TxType; labelKey: 'forms.tab.expense' | 'forms.tab.income' | 'forms.tab.transfer'; active: string }[] = [
  { id: 'expense', labelKey: 'forms.tab.expense', active: 'text-brand-600' },
  { id: 'income', labelKey: 'forms.tab.income', active: 'text-emerald-700' },
  { id: 'transfer', labelKey: 'forms.tab.transfer', active: 'text-slate-800' },
];

interface TransactionFormProps {
  /** Kalau diisi, form mengubah transaksi ini (bukan mencatat baru). */
  editing?: Transaction | null;
  onUpdate?: (tx: Transaction, next: TransactionPayload) => Promise<void>;
  sheetAvailable: boolean;
  /** Bank dan e-wallet yang dipilih pengguna. */
  accounts: string[];
  onManageAccounts: () => void;
  /** True kalau script Sheets mendukung kirim banyak baris sekaligus (versi 2+). */
  batchReady: boolean;
  onSave: (payload: TransactionPayload, destination: Destination) => Promise<void>;
  onSaveMany: (payloads: TransactionPayload[], destination: Destination) => Promise<number>;
  onToast: (t: ToastState) => void;
  onSubmitted: () => void | Promise<void>;
}

export function TransactionForm({ editing = null, onUpdate, sheetAvailable, accounts, onManageAccounts, batchReady, onSave, onSaveMany, onToast, onSubmitted }: TransactionFormProps) {
  const { t } = useT();
  const { limit: DAILY_TARGET } = useDailyLimit();
  const { rules } = useRules();
  // Kategori yang disarankan aturan hanya dipakai selama pengguna belum memilih kategori sendiri.
  const [catTouched, setCatTouched] = useState(Boolean(editing));
  const [ruleKw, setRuleKw] = useState('');
  const [destination, setDestination] = useState<Destination>(
    editing ? editing.source : sheetAvailable ? 'sheet' : 'local',
  );
  const [txType, setTxType] = useState<TxType>(editing ? editing.type : 'expense');
  const [date, setDate] = useState(editing?.date || todayISO());
  // Pengisian awal mengikuti rekening dan kategori yang terakhir dipakai, supaya langkahnya lebih sedikit.
  const [mem] = useState(loadMemory);
  const [category, setCategory] = useState(
    editing ? editing.category : EXPENSE_CATEGORIES.includes(mem.lastCategory.expense) ? mem.lastCategory.expense : EXPENSE_CATEGORIES[1],
  );
  const [account, setAccount] = useState(
    editing ? editing.account : accounts.includes(mem.lastAccount) ? mem.lastAccount : (accounts[0] ?? ''),
  );
  const [description, setDescription] = useState(editing?.description ?? '');
  const [totalDisplay, setTotalDisplay] = useState(editing ? formatRupiah(String(editing.total)) : '');
  const [fromChoice, setFromAccount] = useState(accounts[0] ?? '');
  const [toChoice, setToAccount] = useState(accounts[1] ?? '');
  // Pilihan rekening bisa berubah dari menu Sumber data; kalau pilihan lama sudah tidak ada, pakai yang tersedia.
  const fromAccount = accounts.includes(fromChoice) ? fromChoice : (accounts[0] ?? '');
  const toAccount = accounts.includes(toChoice) ? toChoice : (accounts.find((a) => a !== fromAccount) ?? '');
  const [feeDisplay, setFeeDisplay] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Pisah ke beberapa kategori: hanya untuk pengeluaran baru (bukan ubah transaksi, bukan transfer).
  const [splitOn, setSplitOn] = useState(false);
  const [splitRows, setSplitRows] = useState<SplitRow[]>([]);

  const isTransfer = txType === 'transfer';
  const baseCategories = txType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  // Transaksi impor bisa punya kategori di luar daftar; tetap tampilkan supaya tidak berubah diam-diam.
  const categories = baseCategories.includes(category) ? baseCategories : [category, ...baseCategories];
  const accountChoices = !account || accounts.includes(account) ? accounts : [account, ...accounts];
  const totalAmount = useMemo(() => parseRupiah(totalDisplay), [totalDisplay]);
  const feeAmount = useMemo(() => parseRupiah(feeDisplay), [feeDisplay]);
  const overBudget = txType === 'expense' && totalAmount > DAILY_TARGET;
  const sameAccount = isTransfer && fromAccount === toAccount;
  const needTwoAccounts = isTransfer && accounts.length < 2;
  const needAccount = !editing && !isTransfer && accounts.length === 0;
  const canSplit = !editing && txType === 'expense';
  const splitting = splitOn && canSplit;
  const splitParts = useMemo(() => rowsToParts(splitRows), [splitRows]);
  const splitBad = splitting && splitProblem(totalAmount, splitParts) !== null;
  const canSubmit = Boolean(totalAmount) && !sameAccount && !needTwoAccounts && !needAccount && !splitBad;

  function toggleSplit() {
    if (splitOn) {
      setSplitOn(false);
      return;
    }
    const second = EXPENSE_CATEGORIES.find((c) => c !== category) ?? category;
    setSplitRows([{ category, display: '' }, { category: second, display: '' }]);
    setSplitOn(true);
  }

  function switchType(next: TxType) {
    if (next === txType) return;
    setTxType(next);
    setRuleKw('');
    if (next !== 'expense') setSplitOn(false);
    if (next !== 'transfer') {
      const last = mem.lastCategory[next];
      const list = next === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
      const fallback = list.includes(last) ? last : next === 'expense' ? EXPENSE_CATEGORIES[1] : INCOME_CATEGORIES[0];
      const m = !catTouched && description ? matchRule(rules, description, next) : null;
      setCategory(m ? m.rule.category : fallback);
      setRuleKw(m ? m.keyword : '');
    }
  }

  function changeDescription(value: string) {
    setDescription(value);
    if (catTouched || txType === 'transfer') return;
    const m = matchRule(rules, value, txType);
    if (m) {
      setCategory(m.rule.category);
      setRuleKw(m.keyword);
    } else if (ruleKw) {
      // Kata kunci hilang dari keterangan: kembalikan ke kategori terakhir.
      const last = mem.lastCategory[txType];
      const list = txType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
      setCategory(list.includes(last) ? last : txType === 'expense' ? EXPENSE_CATEGORIES[1] : INCOME_CATEGORIES[0]);
      setRuleKw('');
    }
  }

  function swapAccounts() {
    setFromAccount(toAccount);
    setToAccount(fromAccount);
  }

  async function handleTransfer() {
    // Dua baris: uang keluar dari rekening asal (termasuk biaya admin) dan uang masuk ke rekening tujuan.
    // Keduanya berkategori Transfer, jadi tidak dihitung sebagai pemasukan atau pengeluaran.
    const note = description.trim();
    const out: TransactionPayload = {
      date, type: 'expense', category: TRANSFER_CATEGORY, account: fromAccount,
      description: note || `Transfer ke ${toAccount}`, total: totalAmount + feeAmount,
    };
    const into: TransactionPayload = {
      date, type: 'income', category: TRANSFER_CATEGORY, account: toAccount,
      description: note || `Transfer dari ${fromAccount}`, total: totalAmount,
    };
    const target: Destination = sheetAvailable ? destination : 'local';
    if (target === 'sheet' && !batchReady) {
      await onSave(out, target);
      await onSave(into, target);
    } else {
      await onSaveMany([out, into], target);
    }
    onToast({
      kind: 'success',
      message: t('forms.toast.transferSaved', {
        from: fromAccount, to: toAccount, target: t(target === 'sheet' ? 'forms.saved.sheet' : 'forms.saved.local'),
      }),
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting || !canSubmit) return;

    setSubmitting(true);
    const payload: TransactionPayload = {
      date,
      type: txType === 'income' ? 'income' : 'expense',
      category,
      account,
      description: description.trim(),
      total: totalAmount,
    };

    try {
      if (editing && onUpdate) {
        await onUpdate(editing, payload);
        onToast({ kind: 'success', message: t('edit.toast.saved') });
      } else if (isTransfer) {
        await handleTransfer();
      } else if (splitting) {
        const target: Destination = sheetAvailable ? destination : 'local';
        const parts = buildSplitPayloads({ date, account, description: description.trim() }, splitParts);
        if (target === 'sheet' && !batchReady) {
          for (const part of parts) await onSave(part, target);
        } else {
          await onSaveMany(parts, target);
        }
        saveMemory(remember(loadMemory(), parts));
        onToast({
          kind: 'success',
          message: t('split.toast', { n: parts.length, target: t(target === 'sheet' ? 'forms.saved.sheet' : 'forms.saved.local') }),
        });
        setSplitOn(false);
        setSplitRows([]);
      } else {
        const target: Destination = sheetAvailable ? destination : 'local';
        await onSave(payload, target);
        saveMemory(remember(loadMemory(), [payload]));
        onToast({
          kind: 'success',
          message: t('forms.toast.saved', {
            kind: t(txType === 'expense' ? 'forms.tab.expense' : 'forms.tab.income'),
            target: t(target === 'sheet' ? 'forms.saved.sheet' : 'forms.saved.local'),
          }),
        });
      }
      setDescription('');
      setRuleKw('');
      setCatTouched(false);
      setTotalDisplay('');
      setFeeDisplay('');
      await onSubmitted();
    } catch (err) {
      console.error('Error saving transaction:', err);
      onToast({
        kind: 'error',
        message: err instanceof Error ? t('forms.toast.saveFailedWith', { message: err.message }) : t(editing ? 'edit.toast.failed' : 'forms.toast.saveFailed'),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
      {editing ? (
        <p className="mx-6 mt-5 rounded-xl bg-slate-100/70 p-3 text-xs leading-relaxed text-slate-500">{t('edit.hint')}</p>
      ) : (
      <div className="px-6 pt-5">
        <div className="relative grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1">
          <span
            className="absolute inset-y-1 w-[calc((100%-1rem)/3)] rounded-xl bg-card shadow-xs transition-transform duration-200 ease-out"
            style={{ transform: `translateX(calc(${TABS.findIndex((x) => x.id === txType)} * (100% + 0.25rem)))` }}
          />
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchType(tab.id)}
              aria-pressed={txType === tab.id}
              className={`relative z-10 rounded-xl py-2 text-xs font-bold transition-colors ${
                txType === tab.id ? tab.active : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </div>
      )}

      <div className="flex-1 space-y-4 px-6 py-5">
        <Field label={t('forms.field.date')} icon={<Calendar className="h-4 w-4" />}>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="form-input"
          />
        </Field>

        {isTransfer ? (
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <Field label={t('forms.field.fromAccount')} icon={<Wallet className="h-4 w-4" />}>
                <select value={fromAccount} onChange={(e) => setFromAccount(e.target.value)} className="form-input">
                  {accounts.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </Field>
              <button
                type="button"
                onClick={swapAccounts}
                className="mb-1 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-card text-slate-500 transition-colors hover:border-brand hover:text-brand-700"
                aria-label={t('forms.swap.aria')}
                title={t('forms.swap.title')}
              >
                <ArrowRight className="h-4 w-4" />
              </button>
              <Field label={t('forms.field.toAccount')} icon={<Wallet className="h-4 w-4" />}>
                <select value={toAccount} onChange={(e) => setToAccount(e.target.value)} className="form-input">
                  {accounts.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </Field>
            </div>
            {needTwoAccounts ? (
              <p role="alert" className="text-xs font-medium text-amber-700">
                {t('forms.transfer.needTwo')}{' '}
                <button type="button" onClick={onManageAccounts} className="font-semibold text-brand-600 underline">
                  {t('forms.transfer.addOption')}
                </button>
              </p>
            ) : sameAccount ? (
              <p role="alert" className="text-xs font-medium text-amber-700">{t('forms.transfer.sameAccount')}</p>
            ) : (
              <p className="text-xs leading-relaxed text-slate-500">
                {t('forms.transfer.hint', { from: fromAccount, to: toAccount })}
              </p>
            )}
          </div>
        ) : (
          <>
        {!splitting && (
        <>
        <Field label={t('forms.field.category')} icon={<Tag className="h-4 w-4" />}>
            <select value={category} onChange={(e) => { setCategory(e.target.value); setCatTouched(true); setRuleKw(''); }} className="form-input">
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          {ruleKw && <p className="text-xs font-medium text-violet-700" data-testid="rule-suggest">{t('rules.form.suggest', { kw: ruleKw })}</p>}
          {!editing && category === 'Paylater' && <p className="text-xs text-violet-700" data-testid="paylater-hint">{t('debt.formHint')}</p>}
        </>
        )}

          {needAccount && (
            <p role="alert" className="text-xs font-medium text-amber-700">
              {t('accounts.pick.formHint')}{' '}
              <button type="button" onClick={onManageAccounts} className="font-semibold text-brand-600 underline">
                {t('accounts.pick.button')}
              </button>
            </p>
          )}
          <fieldset>
            <legend className="mb-1.5 flex w-full items-center justify-between gap-2 text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1.5">
                <Wallet className="h-4 w-4" />
                {t('forms.field.account')}
              </span>
              <button
                type="button"
                onClick={onManageAccounts}
                className="rounded-md px-1.5 py-0.5 font-semibold text-brand-600 hover:bg-rose-50"
              >
                {t('forms.account.edit')}
              </button>
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {accountChoices.map((a) => {
                const selected = account === a;
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAccount(a)}
                    aria-pressed={selected}
                    className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left text-sm font-semibold transition-all ${
                      selected
                        ? 'border-brand bg-rose-50 text-brand-600 ring-1 ring-brand'
                        : 'border-slate-200 bg-card text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <AccountAvatar name={a} />
                    <span className="min-w-0 truncate">{a}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          </>
        )}

        <Field label={t('forms.field.description')} icon={<FileText className="h-4 w-4" />}>
          <input
            type="text"
            value={description}
            onChange={(e) => changeDescription(e.target.value)}
            placeholder={t(isTransfer ? 'forms.placeholder.transfer' : txType === 'expense' ? 'forms.placeholder.expense' : 'forms.placeholder.income')}
            maxLength={100}
            className="form-input"
          />
        </Field>

        <Field label={t(isTransfer ? 'forms.field.amountTransfer' : 'forms.field.amount')} icon={<DollarSign className="h-4 w-4" />}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
              Rp
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={totalDisplay}
              onChange={(e) => setTotalDisplay(formatRupiah(e.target.value))}
              placeholder="0"
              required
              className="form-input pl-10 text-base font-bold tabular-nums"
            />
          </div>
        </Field>

        {canSplit && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={toggleSplit}
              aria-pressed={splitting}
              data-testid="split-toggle"
              className="text-xs font-semibold text-brand-600 hover:underline"
            >
              {t(splitting ? 'split.toggle.off' : 'split.toggle')}
            </button>
            {splitting && <SplitBox total={totalAmount} rows={splitRows} categories={EXPENSE_CATEGORIES} onChange={setSplitRows} />}
          </div>
        )}

        {isTransfer && (
          <Field label={t('forms.field.fee')} icon={<Receipt className="h-4 w-4" />}>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={feeDisplay}
                onChange={(e) => setFeeDisplay(formatRupiah(e.target.value))}
                placeholder="0"
                className="form-input pl-10 tabular-nums"
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">{t('forms.fee.hint')}</p>
          </Field>
        )}

        {editing ? null : sheetAvailable ? (
          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-slate-500">{t('forms.field.saveTo')}</legend>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
              {(['sheet', 'local'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDestination(d)}
                  aria-pressed={destination === d}
                  className={`rounded-lg py-2 text-xs font-semibold transition-all ${
                    destination === d ? 'bg-card text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t(d === 'sheet' ? 'forms.dest.sheet' : 'forms.dest.local')}
                </button>
              ))}
            </div>
          </fieldset>
        ) : (
          <p className="rounded-xl bg-slate-100/70 p-3 text-xs leading-relaxed text-slate-500 border border-slate-200/50">
            {t('forms.noSheet')}
          </p>
        )}

        {overBudget && (
          <div
            role="alert"
            className="flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/90 p-3 animate-[fadeSlide_0.2s_ease-out]"
          >
            <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs font-medium text-amber-800">
              {t('forms.overBudget', { limit: DAILY_TARGET.toLocaleString(locale()) })}
            </p>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-slate-100 bg-card/95 backdrop-blur-md px-6 py-4">
        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm ${
            txType === 'expense'
              ? 'bg-brand hover:bg-brand-dark active:scale-[0.98]'
              : txType === 'income'
                ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]'
                : 'bg-slate-800 hover:bg-slate-900 active:scale-[0.98]'
          }`}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('forms.saving')}
            </>
          ) : (
            <>{editing ? t('edit.save') : splitting ? t('split.save', { n: splitRows.length }) : t(txType === 'expense' ? 'forms.save.expense' : txType === 'income' ? 'forms.save.income' : 'forms.save.transfer')}</>
          )}
        </button>
        {totalAmount > 0 && (
          <p className="mt-2 text-center text-xs text-slate-500">
            {t(isTransfer && feeAmount > 0 ? 'forms.total.outgoing' : 'forms.total.amount')}
            <span className="font-semibold text-slate-700">{rupiahLabel(isTransfer ? totalAmount + feeAmount : totalAmount)}</span>
          </p>
        )}
      </div>
    </form>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      {children}
    </label>
  );
}