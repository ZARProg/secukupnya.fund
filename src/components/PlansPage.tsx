import { useState, type FormEvent, type ReactNode } from 'react';
import { CalendarClock, PiggyBank, Plus, Trash2, Target } from 'lucide-react';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, TRANSFER_CATEGORY } from '@/lib/categories';
import { formatRupiah, parseRupiah } from '@/lib/format';
import { parseISODate, todayISO } from '@/lib/date';
import { dueRules, goalPercent, initialLastDone, monthlyNeed, monthKey, MAX_AMOUNT } from '@/lib/plans';
import { useT, locale } from '@/i18n';
import { usePlans } from '@/hooks/usePlans';
import { usePrivacy } from '@/hooks/usePrivacy';

interface PlansPageProps {
  accounts: string[];
}

export function PlansPage({ accounts }: PlansPageProps) {
  return (
    <div className="space-y-5">
      <RecurringSection accounts={accounts} />
    </div>
  );
}

/** Halaman Target tabungan: hanya target; tagihan rutin ada di halaman Tagihan rutin. */
export function GoalsPage() {
  return (
    <div className="space-y-5">
      <GoalsSection />
    </div>
  );
}

function Section({ icon, title, intro, children }: { icon: ReactNode; title: string; intro: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-brand-600">{icon}</span>
        <h2 className="text-base font-bold tracking-tight text-slate-900">{title}</h2>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{intro}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Label({ text, children }: { text: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-500">{text}</span>
      {children}
    </label>
  );
}

function RecurringSection({ accounts }: { accounts: string[] }) {
  const { t } = useT();
  const { money } = usePrivacy();
  const { recurring, addRecurring, removeRecurring } = usePlans();
  const today = todayISO();
  const dueIds = new Set(dueRules(recurring, today).map((d) => d.rule.id));
  const ym = monthKey(today);

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [account, setAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState('1');

  const categories = (type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).filter((c) => c !== TRANSFER_CATEGORY);
  const chosenCategory = categories.includes(category) ? category : categories[0];
  const chosenAccount = accounts.includes(account) ? account : (accounts[0] ?? '');
  const total = parseRupiah(amount);
  const dayNum = Number(day);
  const valid = name.trim() !== '' && total > 0 && total <= MAX_AMOUNT && Number.isInteger(dayNum) && dayNum >= 1 && dayNum <= 31;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    addRecurring({
      type, description: name.trim(), category: chosenCategory, account: chosenAccount,
      total, day: dayNum, lastDone: initialLastDone(dayNum, today),
    });
    setName('');
    setAmount('');
    setDay('1');
    setOpen(false);
  }

  return (
    <Section icon={<CalendarClock className="h-5 w-5" />} title={t('recurring.title')} intro={t('recurring.intro')}>
      {recurring.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-500">{t('recurring.empty')}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {recurring.map((r) => {
            const status = dueIds.has(r.id) ? 'due' : r.lastDone === ym ? 'done' : 'upcoming';
            return (
              <li key={r.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{r.description}</p>
                  <p className="truncate text-xs text-slate-500">
                    {t('recurring.every', { day: r.day })} · {r.category}{r.account ? ` · ${r.account}` : ''}
                  </p>
                  <span
                    className={`mt-1 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                      status === 'due' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {t(status === 'due' ? 'recurring.due' : status === 'done' ? 'recurring.done' : 'recurring.upcoming')}
                  </span>
                </div>
                <p className={`text-sm font-bold tabular-nums ${r.type === 'expense' ? 'text-slate-900' : 'text-emerald-600'}`}>
                  {r.type === 'expense' ? '−' : '+'}{money(r.total)}
                </p>
                <button
                  onClick={() => {
                    if (window.confirm(t('recurring.delete.confirm', { name: r.description }))) removeRecurring(r.id);
                  }}
                  aria-label={t('recurring.delete.aria', { name: r.description })}
                  className="rounded-xl p-2 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open ? (
        <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4" aria-label={t('recurring.add')}>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            {(['expense', 'income'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={type === k}
                onClick={() => setType(k)}
                className={`rounded-lg py-2 text-xs font-bold ${type === k ? 'bg-card shadow-xs text-slate-900' : 'text-slate-500'}`}
              >
                {t(k === 'expense' ? 'shell.type.expense' : 'shell.type.income')}
              </button>
            ))}
          </div>
          <Label text={t('recurring.field.name')}>
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
          </Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Label text={t('forms.field.category')}>
              <select className="form-input" value={chosenCategory} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Label>
            <Label text={t('forms.field.account')}>
              <select className="form-input" value={chosenAccount} onChange={(e) => setAccount(e.target.value)}>
                {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </Label>
            <Label text={t('forms.field.amount')}>
              <input className="form-input tabular-nums" inputMode="numeric" value={amount} onChange={(e) => setAmount(formatRupiah(e.target.value))} placeholder="0" required />
            </Label>
            <Label text={t('recurring.field.day')}>
              <input className="form-input" type="number" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} required />
            </Label>
          </div>
          <p className="text-xs text-slate-500">{t('recurring.startHint')}</p>
          <div className="flex gap-2">
            <button type="submit" disabled={!valid} className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50">
              {t('recurring.add')}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">
              {t('forms.budget.cancel')}
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setOpen(true)} className="mt-4 flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-brand-600 hover:bg-rose-50">
          <Plus className="h-4 w-4" />
          {t('recurring.add')}
        </button>
      )}
    </Section>
  );
}

function GoalsSection() {
  const { t } = useT();
  const { money } = usePrivacy();
  const { goals, addGoal, removeGoal, adjustGoal } = usePlans();
  const today = todayISO();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState('');
  const [deadline, setDeadline] = useState('');
  const [funds, setFunds] = useState<Record<string, string>>({});

  const targetNum = parseRupiah(target);
  const savedNum = parseRupiah(saved);
  const valid = name.trim() !== '' && targetNum > 0 && targetNum <= MAX_AMOUNT && savedNum <= MAX_AMOUNT;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    addGoal({ name: name.trim(), target: targetNum, saved: savedNum, deadline });
    setName(''); setTarget(''); setSaved(''); setDeadline('');
    setOpen(false);
  }

  return (
    <Section icon={<PiggyBank className="h-5 w-5" />} title={t('goals.title')} intro={t('goals.intro')}>
      {goals.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-500">{t('goals.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {goals.map((g) => {
            const pct = goalPercent(g);
            const reached = g.saved >= g.target;
            const need = monthlyNeed(g, today);
            const fund = parseRupiah(funds[g.id] ?? '');
            return (
              <li key={g.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start gap-3">
                  <Target className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{g.name}</p>
                    <p className="text-xs text-slate-500">
                      {t('goals.progress', { saved: money(g.saved), target: money(g.target) })}
                    </p>
                  </div>
                  <span className={`text-sm font-display font-bold tabular-nums ${reached ? 'text-emerald-600' : 'text-slate-700'}`}>{pct}%</span>
                  <button
                    onClick={() => {
                      if (window.confirm(t('goals.delete.confirm', { name: g.name }))) removeGoal(g.id);
                    }}
                    aria-label={t('goals.delete.aria', { name: g.name })}
                    className="-mr-1 rounded-xl p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div
                  className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
                  role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={g.name}
                >
                  <div className={`h-full rounded-full ${reached ? 'bg-emerald-500' : 'bg-brand'}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {reached
                    ? <span className="font-semibold text-emerald-700">{t('goals.done')}</span>
                    : t('goals.remaining', { amount: money(g.target - g.saved) })}
                  {g.deadline && (
                    <>
                      {' · '}
                      {g.deadline < today && !reached
                        ? <span className="font-semibold text-amber-700">{t('goals.overdue')}</span>
                        : t('goals.deadline', { date: parseISODate(g.deadline).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' }) })}
                    </>
                  )}
                  {need !== null && <> · {t('goals.monthly', { amount: money(need) })}</>}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    className="form-input w-40 tabular-nums"
                    inputMode="numeric"
                    placeholder="0"
                    aria-label={t('goals.fund.label', { name: g.name })}
                    value={funds[g.id] ?? ''}
                    onChange={(e) => setFunds((f) => ({ ...f, [g.id]: formatRupiah(e.target.value) }))}
                  />
                  <button
                    disabled={!fund}
                    onClick={() => { adjustGoal(g.id, fund); setFunds((f) => ({ ...f, [g.id]: '' })); }}
                    className="rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white hover:bg-brand-dark disabled:opacity-50"
                  >
                    {t('goals.fund.add')}
                  </button>
                  <button
                    disabled={!fund}
                    onClick={() => { adjustGoal(g.id, -fund); setFunds((f) => ({ ...f, [g.id]: '' })); }}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {t('goals.fund.take')}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {open ? (
        <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4" aria-label={t('goals.add')}>
          <Label text={t('goals.field.name')}>
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
          </Label>
          <div className="grid gap-3 sm:grid-cols-3">
            <Label text={t('goals.field.target')}>
              <input className="form-input tabular-nums" inputMode="numeric" value={target} onChange={(e) => setTarget(formatRupiah(e.target.value))} placeholder="0" required />
            </Label>
            <Label text={t('goals.field.saved')}>
              <input className="form-input tabular-nums" inputMode="numeric" value={saved} onChange={(e) => setSaved(formatRupiah(e.target.value))} placeholder="0" />
            </Label>
            <Label text={t('goals.field.deadline')}>
              <input className="form-input" type="date" min={today} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </Label>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={!valid} className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50">
              {t('goals.add')}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">
              {t('forms.budget.cancel')}
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setOpen(true)} className="mt-4 flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-brand-600 hover:bg-rose-50">
          <Plus className="h-4 w-4" />
          {t('goals.add')}
        </button>
      )}
    </Section>
  );
}
