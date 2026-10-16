import { useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, ChevronDown, Landmark, Plus, Trash2 } from 'lucide-react';
import { useT, type MessageKey } from '@/i18n';
import { useDebts } from '@/hooks/useDebts';
import { usePrivacy } from '@/hooks/usePrivacy';
import { EXPENSE_CATEGORIES } from '@/lib/categories';
import { todayISO } from '@/lib/date';
import { formatRupiah, parseRupiah, shortDate } from '@/lib/format';
import { MAX_AMOUNT } from '@/lib/plans';
import {
  DEBT_KINDS, feePaid, installmentsLeft, isSettled, makePayment, nextDue, paidPercent, payoffDate, paymentTransactions,
  purchaseTransaction, remaining, simulate, splitPayment, summarize, totalObligation, totalPaid,
  type Debt, type DebtKind,
} from '@/lib/debts';
import type { ToastState } from '@/components/Toast';
import type { Destination } from '@/hooks/useTransactions';
import type { TransactionPayload } from '@/lib/transactions';

interface DebtsPageProps {
  /** Rekening bank/e-wallet yang dipilih. */
  accounts: string[];
  sheetAvailable: boolean;
  batchReady: boolean;
  onSave: (payload: TransactionPayload, destination: Destination) => Promise<void>;
  onSaveMany: (payloads: TransactionPayload[], destination: Destination) => Promise<number>;
  onToast: (t: ToastState) => void;
}

export function DebtsPage(props: DebtsPageProps) {
  const { t } = useT();
  const { debts } = useDebts();
  const { money } = usePrivacy();
  const today = todayISO();
  const sum = useMemo(() => summarize(debts, today), [debts, today]);
  const [adding, setAdding] = useState(false);
  const [destination, setDestination] = useState<Destination>(props.sheetAvailable ? 'sheet' : 'local');
  const target: Destination = props.sheetAvailable ? destination : 'local';

  async function saveTx(payloads: TransactionPayload[]) {
    if (!payloads.length) return;
    if (payloads.length === 1) await props.onSave(payloads[0], target);
    else if (target === 'sheet' && !props.batchReady) for (const p of payloads) await props.onSave(p, target);
    else await props.onSaveMany(payloads, target);
  }

  return (
    <div className="space-y-5" data-testid="debts-page">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label={t('debt.title')}>
        <Stat label={t('debt.summary.remaining')} value={money(sum.remaining)} testId="debt-total-remaining" strong />
        <Stat label={t('debt.summary.paidMonth')} value={money(sum.paidThisMonth)} />
        <Stat label={t('debt.summary.active')} value={String(sum.active)} />
      </section>

      <details className="rounded-2xl border border-line bg-white p-4 text-sm text-slate-700 shadow-card">
        <summary className="cursor-pointer font-semibold text-slate-900">{t('debt.how.title')}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>{t('debt.how.purchase')}</li>
          <li>{t('debt.how.payment')}</li>
          <li>{t('debt.how.fee')}</li>
        </ul>
      </details>

      {props.sheetAvailable && (
        <fieldset className="max-w-xs">
          <legend className="mb-1 text-xs font-semibold text-slate-500">{t('forms.field.saveTo')}</legend>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            {(['sheet', 'local'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDestination(d)}
                aria-pressed={destination === d}
                className={`rounded-lg py-1.5 text-xs font-semibold ${destination === d ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}
              >
                {t(d === 'sheet' ? 'forms.dest.sheet' : 'forms.dest.local')}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {adding ? (
        <AddDebtForm
          today={today}
          onCancel={() => setAdding(false)}
          saveTx={saveTx}
          onToast={props.onToast}
          onDone={() => setAdding(false)}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white"
          data-testid="debt-add-open"
        >
          <Plus className="h-4 w-4" /> {t('debt.add')}
        </button>
      )}

      {debts.length === 0 && !adding ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-sm text-slate-500" data-testid="debt-empty">{t('debt.empty')}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {debts.map((d) => (
            <DebtCard key={d.id} debt={d} today={today} accounts={props.accounts} saveTx={saveTx} onToast={props.onToast} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, strong, testId }: { label: string; value: string; strong?: boolean; testId?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 font-extrabold tabular-nums tracking-tight text-slate-900 ${strong ? 'text-2xl' : 'text-xl'}`} data-testid={testId}>{value}</p>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

// ---------- Tambah utang ----------

function AddDebtForm({
  today, onCancel, onDone, saveTx, onToast,
}: {
  today: string;
  onCancel: () => void;
  onDone: () => void;
  saveTx: (p: TransactionPayload[]) => Promise<void>;
  onToast: (t: ToastState) => void;
}) {
  const { t, tp } = useT();
  const { addDebt } = useDebts();
  const { money } = usePrivacy();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<DebtKind>('paylater');
  const [principal, setPrincipal] = useState('');
  const [fee, setFee] = useState('');
  const [monthly, setMonthly] = useState('');
  const [dueDay, setDueDay] = useState(String(Number(today.slice(8, 10))));
  const [start, setStart] = useState('');
  const [paid, setPaid] = useState('');
  const [purchase, setPurchase] = useState<'record' | 'skip'>('record');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[1]);
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const p = parseRupiah(principal);
  const f = parseRupiah(fee);
  const m = parseRupiah(monthly);
  const day = Number(dueDay);
  const total = p + f;
  const cash = kind === 'loan'; // pinjaman tunai: tidak ada pembelian yang perlu dicatat
  const canRecordPurchase = !cash && purchase === 'record';

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim() || !p || !m || p > MAX_AMOUNT || f > MAX_AMOUNT || !Number.isInteger(day) || day < 1 || day > 31) {
      setError(t('debt.err.fields'));
      return;
    }
    const already = parseRupiah(paid);
    if (already > total) {
      setError(t('debt.err.paid'));
      return;
    }
    setError('');
    setBusy(true);
    const base = { name: name.trim().slice(0, 60), kind, principal: p, fee: f, monthly: m, dueDay: day, startDate: start, payments: [] };
    try {
      if (canRecordPurchase) await saveTx([purchaseTransaction({ ...base, id: '' }, purchaseDate, category)]);
      const probe = { ...base, id: '' };
      const initial = already > 0 ? makePayment(probe, already, start || today, false) : null;
      addDebt({ ...base, payments: initial ? [initial] : [] });
      onToast({ kind: 'success', message: t('debt.toast.added') });
      onDone();
    } catch (err) {
      console.error(err);
      onToast({ kind: 'error', message: err instanceof Error ? t('forms.toast.saveFailedWith', { message: err.message }) : t('debt.toast.failed') });
    } finally {
      setBusy(false);
    }
  }

  const n = total > 0 && m > 0 ? Math.ceil(total / m) : 0;

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line bg-white p-5 shadow-card" aria-label={t('debt.add')} data-testid="debt-add-form">
      <h2 className="text-base font-bold text-slate-900">{t('debt.add')}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('debt.f.name')}>
          <input className="form-input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={t('debt.f.name.placeholder')} data-testid="debt-name" />
        </Field>
        <Field label={t('debt.f.kind')}>
          <select className="form-input" value={kind} onChange={(e) => setKind(e.target.value as DebtKind)}>
            {DEBT_KINDS.map((k) => (
              <option key={k} value={k}>{t(`debt.kind.${k}` as MessageKey)}</option>
            ))}
          </select>
        </Field>
        <Field label={t('debt.f.principal')}>
          <input className="form-input tabular-nums" inputMode="numeric" value={principal} onChange={(e) => setPrincipal(formatRupiah(e.target.value))} placeholder="0" data-testid="debt-principal" />
        </Field>
        <Field label={t('debt.f.monthly')}>
          <input className="form-input tabular-nums" inputMode="numeric" value={monthly} onChange={(e) => setMonthly(formatRupiah(e.target.value))} placeholder="0" data-testid="debt-monthly" />
        </Field>
        <Field label={t('debt.f.fee')} hint={t('debt.f.fee.hint')}>
          <input className="form-input tabular-nums" inputMode="numeric" value={fee} onChange={(e) => setFee(formatRupiah(e.target.value))} placeholder="0" data-testid="debt-fee" />
        </Field>
        <Field label={t('debt.f.dueDay')}>
          <input className="form-input" type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} data-testid="debt-dueday" />
        </Field>
        <Field label={t('debt.f.start')}>
          <input className="form-input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label={t('debt.f.alreadyPaid')}>
          <input className="form-input tabular-nums" inputMode="numeric" value={paid} onChange={(e) => setPaid(formatRupiah(e.target.value))} placeholder="0" data-testid="debt-already" />
        </Field>
      </div>

      {n > 0 && (
        <p className="rounded-xl bg-slate-50 p-3 text-sm font-medium text-slate-700" data-testid="debt-preview">
          {tp('debt.preview', n, { total: money(total) })}
        </p>
      )}

      {!cash && (
        <fieldset className="space-y-2 rounded-xl border border-line p-3">
          <legend className="px-1 text-xs font-semibold text-slate-500">{t('debt.f.purchase')}</legend>
          {(['record', 'skip'] as const).map((v) => (
            <label key={v} className="flex items-start gap-2 text-sm text-slate-700">
              <input type="radio" name="purchase" className="mt-1" checked={purchase === v} onChange={() => setPurchase(v)} data-testid={`debt-purchase-${v}`} />
              {t(v === 'record' ? 'debt.purchase.record' : 'debt.purchase.skip')}
            </label>
          ))}
          {purchase === 'record' && (
            <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
              <Field label={t('debt.f.category')}>
                <select className="form-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label={t('debt.f.purchaseDate')}>
                <input className="form-input" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
              </Field>
            </div>
          )}
          <p className="text-xs text-slate-500">{t('debt.f.purchase.hint')}</p>
        </fieldset>
      )}

      {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" data-testid="debt-save">{t('debt.save')}</button>
        <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">{t('debt.add.cancel')}</button>
      </div>
    </form>
  );
}

// ---------- Kartu utang ----------

function DebtCard({
  debt, today, accounts, saveTx, onToast,
}: {
  debt: Debt;
  today: string;
  accounts: string[];
  saveTx: (p: TransactionPayload[]) => Promise<void>;
  onToast: (t: ToastState) => void;
}) {
  const { t, tp } = useT();
  const { money } = usePrivacy();
  const { removeDebt, addPayment, removePayment } = useDebts();
  const [paying, setPaying] = useState(false);
  const [sim, setSim] = useState(false);
  const left = remaining(debt);
  const settled = isSettled(debt);
  const due = nextDue(debt, today);
  const payoff = payoffDate(debt, today);

  return (
    <li className={`rounded-2xl border bg-white p-5 shadow-card ${due?.overdue ? 'border-red-200' : 'border-line'}`} data-testid={`debt-card-${debt.name}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-bold text-slate-900">
            <Landmark className="h-4 w-4 shrink-0 text-violet-600" />
            <span className="truncate">{debt.name}</span>
          </p>
          <p className="text-xs text-slate-500">{t(`debt.kind.${debt.kind}` as MessageKey)}</p>
        </div>
        {settled ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{t('debt.settled')}</span>
        ) : (
          <div className="text-right">
            <p className="text-xs text-slate-500">{t('debt.remaining')}</p>
            <p className="text-xl font-extrabold tabular-nums text-slate-900" data-testid="debt-remaining">{money(left)}</p>
          </div>
        )}
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-violet-500" style={{ width: `${paidPercent(debt)}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {t('debt.paidOf', { paid: money(totalPaid(debt)), total: money(totalObligation(debt)) })}
        {debt.fee > 0 && <> · {t('debt.fee.known', { amount: money(debt.fee) })}</>}
      </p>

      {!settled && due && (
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-slate-500">{t('debt.next')}</dt>
            <dd className={`font-semibold ${due.overdue ? 'text-red-600' : 'text-slate-900'}`} data-testid="debt-next">
              {shortDate(due.date)} · {money(due.amount)}
              {due.overdue && <span className="ml-1 inline-flex items-center gap-0.5 text-xs"><AlertTriangle className="h-3 w-3" />{t('debt.overdue')}</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">{t('debt.payoff')}</dt>
            <dd className="font-semibold text-slate-900" data-testid="debt-payoff">
              {payoff ? shortDate(payoff) : '—'} <span className="text-xs font-normal text-slate-500">({tp('debt.left', installmentsLeft(debt))})</span>
            </dd>
          </div>
        </dl>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {!settled && (
          <button onClick={() => setPaying((v) => !v)} aria-expanded={paying} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white" data-testid="debt-pay-open">
            {t('debt.pay')}
          </button>
        )}
        {!settled && (
          <button onClick={() => setSim((v) => !v)} aria-expanded={sim} className="flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" data-testid="debt-sim-open">
            {t('debt.sim.toggle')} <ChevronDown className={`h-3 w-3 transition-transform ${sim ? 'rotate-180' : ''}`} />
          </button>
        )}
        <button
          onClick={() => {
            if (window.confirm(t('debt.delete.confirm', { name: debt.name }))) {
              removeDebt(debt.id);
              onToast({ kind: 'success', message: t('debt.toast.deleted') });
            }
          }}
          className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-400 hover:bg-red-50 hover:text-red-600"
          aria-label={`${t('debt.delete')} ${debt.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {paying && !settled && (
        <PayForm
          debt={debt}
          today={today}
          defaultAmount={due?.amount ?? left}
          accounts={accounts}
          saveTx={saveTx}
          onToast={onToast}
          onSaved={(p) => { addPayment(debt.id, p); setPaying(false); }}
        />
      )}

      {sim && !settled && <Simulator debt={debt} today={today} />}

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-slate-600">{t('debt.history')} ({debt.payments.length})</summary>
        {debt.payments.length === 0 ? (
          <p className="mt-2 text-xs text-slate-400">{t('debt.history.empty')}</p>
        ) : (
          <ul className="mt-2 space-y-1" data-testid="debt-history">
            {[...debt.payments].sort((a, b) => b.date.localeCompare(a.date)).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-xs text-slate-600">
                <span>
                  {shortDate(p.date)} · <span className="font-semibold tabular-nums">{money(p.amount)}</span>
                  {p.feePart > 0 && <> ({t('debt.pay.split', { principal: money(p.amount - p.feePart), fee: money(p.feePart) })})</>}
                  {!p.recorded && <span className="ml-1 text-slate-400">· {t('debt.history.unrecorded')}</span>}
                </span>
                <button onClick={() => removePayment(debt.id, p.id)} aria-label={t('debt.history.remove', { date: shortDate(p.date) })} className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-slate-400">{t('debt.history.note')}</p>
        {feePaid(debt) > 0 && <p className="mt-1 text-[11px] text-slate-400">{t('debt.fee.known', { amount: money(feePaid(debt)) })}</p>}
      </details>
    </li>
  );
}

// ---------- Catat pembayaran ----------

function PayForm({
  debt, today, defaultAmount, accounts, saveTx, onToast, onSaved,
}: {
  debt: Debt;
  today: string;
  defaultAmount: number;
  accounts: string[];
  saveTx: (p: TransactionPayload[]) => Promise<void>;
  onToast: (t: ToastState) => void;
  onSaved: (p: ReturnType<typeof makePayment> & object) => void;
}) {
  const { t } = useT();
  const { money } = usePrivacy();
  const [amount, setAmount] = useState(formatRupiah(String(defaultAmount)));
  const [date, setDate] = useState(today);
  const [account, setAccount] = useState(accounts[0] ?? '');
  const [record, setRecord] = useState(true);
  const [busy, setBusy] = useState(false);
  const left = remaining(debt);
  const value = parseRupiah(amount);
  const eff = Math.min(value, left);
  const split = value > 0 ? splitPayment(debt, eff) : null;
  const needAccount = record && !accounts.includes(account);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !value || needAccount) return;
    const payment = makePayment(debt, value, date, record);
    if (!payment) return;
    setBusy(true);
    try {
      // Transaksi disimpan dulu; catatan utang baru berubah kalau penyimpanan berhasil.
      if (record) await saveTx(paymentTransactions(debt, payment, account));
      onSaved(payment);
      onToast({ kind: 'success', message: t('debt.toast.paid') });
    } catch (err) {
      console.error(err);
      onToast({ kind: 'error', message: err instanceof Error ? t('forms.toast.saveFailedWith', { message: err.message }) : t('debt.toast.failed') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4" aria-label={t('debt.pay')} data-testid="debt-pay-form">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('debt.pay.amount')}>
          <input className="form-input tabular-nums" inputMode="numeric" value={amount} onChange={(e) => setAmount(formatRupiah(e.target.value))} data-testid="debt-pay-amount" />
        </Field>
        <Field label={t('debt.pay.date')}>
          <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      {value > left && <p className="text-xs text-amber-700">{t('debt.pay.over', { amount: money(left) })}</p>}
      {split && <p className="text-xs text-slate-600" data-testid="debt-pay-split">{t('debt.pay.split', { principal: money(split.principalPart), fee: money(split.feePart) })}</p>}
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" className="mt-0.5" checked={record} onChange={(e) => setRecord(e.target.checked)} data-testid="debt-pay-record" />
        <span>
          {t('debt.pay.record')}
          <span className="block text-xs text-slate-500">{t('debt.pay.record.hint')}</span>
        </span>
      </label>
      {record && (
        <Field label={t('debt.pay.account')}>
          <select className="form-input" value={account} onChange={(e) => setAccount(e.target.value)} data-testid="debt-pay-account">
            {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </Field>
      )}
      {needAccount && <p className="text-xs text-amber-700">{t('debt.pay.needAccount')}</p>}
      <button type="submit" disabled={busy || !value || needAccount} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" data-testid="debt-pay-save">
        {t('debt.pay.save')}
      </button>
    </form>
  );
}

// ---------- Simulasi pelunasan ----------

function Simulator({ debt, today }: { debt: Debt; today: string }) {
  const { t, tp } = useT();
  const { money } = usePrivacy();
  const left = remaining(debt);
  const nd = nextDue(debt, today);
  const [rate, setRate] = useState('');
  const [sc, setSc] = useState([
    { monthly: formatRupiah(String(debt.monthly * 2)), lump: '' },
    { monthly: formatRupiah(String(debt.monthly)), lump: formatRupiah(String(Math.floor(left / 2))) },
  ]);
  const ratePct = Math.min(100, Math.max(0, parseFloat(rate.replace(',', '.')) || 0));

  const run = (monthly: number, lump: number) => simulate(left, { monthly, lump, ratePct }, nd?.date ?? null, today, debt.dueDay);
  const base = run(debt.monthly, 0);
  const rows = [
    { key: 'base', label: t('debt.sim.base'), res: base, edit: null as null | number },
    ...sc.map((s, i) => ({ key: `s${i}`, label: t(i === 0 ? 'debt.sim.a' : 'debt.sim.b'), res: run(parseRupiah(s.monthly), parseRupiah(s.lump)), edit: i })),
  ];

  function diff(months: number | null): string {
    if (months === null || base.months === null) return '';
    const d = base.months - months;
    return d > 0 ? t('debt.sim.faster', { n: d }) : d < 0 ? t('debt.sim.slower', { n: -d }) : t('debt.sim.same');
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4" data-testid="debt-sim">
      <h3 className="text-sm font-bold text-slate-900">{t('debt.sim.title')}</h3>
      <Field label={t('debt.sim.rate')}>
        <input className="form-input max-w-[8rem]" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="0" data-testid="debt-sim-rate" />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {sc.map((s, i) => (
          <fieldset key={i} className="space-y-2 rounded-lg border border-line bg-white p-3">
            <legend className="px-1 text-xs font-semibold text-slate-600">{t(i === 0 ? 'debt.sim.a' : 'debt.sim.b')}</legend>
            <Field label={t('debt.sim.monthly')}>
              <input className="form-input tabular-nums" inputMode="numeric" value={s.monthly} data-testid={`debt-sim-monthly-${i}`}
                onChange={(e) => setSc((prev) => prev.map((x, j) => (j === i ? { ...x, monthly: formatRupiah(e.target.value) } : x)))} />
            </Field>
            <Field label={t('debt.sim.lump')}>
              <input className="form-input tabular-nums" inputMode="numeric" value={s.lump} placeholder="0" data-testid={`debt-sim-lump-${i}`}
                onChange={(e) => setSc((prev) => prev.map((x, j) => (j === i ? { ...x, lump: formatRupiah(e.target.value) } : x)))} />
            </Field>
          </fieldset>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[26rem] text-left text-xs">
          <thead>
            <tr className="text-slate-500">
              <th className="py-1 pr-2 font-semibold" />
              <th className="py-1 pr-2 font-semibold">{t('debt.sim.until')}</th>
              <th className="py-1 pr-2 font-semibold">{t('debt.sim.paid')}</th>
              <th className="py-1 font-semibold">{t('debt.sim.interest')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-line align-top" data-testid={`debt-sim-row-${r.key}`}>
                <td className="py-2 pr-2 font-semibold text-slate-800">{r.label}</td>
                <td className="py-2 pr-2">
                  <span className="font-semibold text-slate-900" data-testid={`debt-sim-months-${r.key}`}>
                    {r.res.months === null ? t('debt.sim.never') : r.res.months === 0 ? t('debt.sim.now') : tp('debt.sim.months', r.res.months)}
                  </span>
                  {r.res.payoffDate && r.res.months !== 0 && <span className="block text-slate-500">{shortDate(r.res.payoffDate)}</span>}
                  {r.key !== 'base' && <span className="block text-emerald-700">{diff(r.res.months)}</span>}
                </td>
                <td className="py-2 pr-2 tabular-nums">{money(r.res.totalPaid)}</td>
                <td className="py-2 tabular-nums">{money(r.res.interest)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">{t('debt.sim.note')}</p>
    </div>
  );
}
