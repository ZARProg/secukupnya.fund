import { useMemo, useState } from 'react';
import { ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useT } from '@/i18n';
import { usePlans } from '@/hooks/usePlans';
import { useDebts } from '@/hooks/useDebts';
import { usePrivacy } from '@/hooks/usePrivacy';
import { useSafeSettings } from '@/hooks/useSafeSettings';
import { formatRupiah, parseRupiah } from '@/lib/format';
import { computeSafeToSpend } from '@/lib/safeToSpend';
import { MAX_AMOUNT } from '@/lib/plans';
import { todayISO } from '@/lib/date';
import type { Transaction } from '@/lib/transactions';

interface Props {
  transactions: Transaction[];
  /** Nama rekening yang dipilih pengguna. */
  accounts: string[];
  /** Data masih diambil: tampilkan kerangka seukuran kartu supaya halaman tidak bergeser saat angka muncul. */
  loading?: boolean;
}

export function SafeToSpendCard({ transactions, accounts, loading = false }: Props) {
  const { t, tp } = useT();
  const { money, moneySigned } = usePrivacy();
  const { recurring, goals } = usePlans();
  const { debts } = useDebts();
  const { settings, update } = useSafeSettings();
  const [open, setOpen] = useState(false);
  const [real, setReal] = useState('');
  const [bad, setBad] = useState(false);

  const today = todayISO();
  const r = useMemo(
    () => computeSafeToSpend({ transactions, accounts, rules: recurring, goals, debts, today, settings }),
    [transactions, accounts, recurring, goals, debts, today, settings],
  );

  function apply() {
    const n = parseRupiah(real);
    if (!real || n > MAX_AMOUNT) { setBad(true); return; }
    setBad(false);
    update({ adjust: n - (r.balance - r.adjust) });
    setReal('');
  }

  const negative = r.ready && r.safe < 0;
  const hasExpenseRules = recurring.some((x) => x.type === 'expense');

  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-card sm:p-6" aria-labelledby="safe-title" data-testid="safe-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="safe-title" className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-900">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          {t('safe.title')}
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{t('safe.estimate')}</span>
        </h2>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-rose-50"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {t('safe.settings')}
        </button>
      </div>

      {loading && !r.ready ? (
        <div className="motion-safe:animate-pulse" aria-busy="true" data-testid="safe-loading">
          <div className="h-9 w-44 rounded-lg bg-slate-100" />
          <div className="mt-3 h-3.5 w-3/4 rounded bg-slate-100" />
          <div className="mt-2 h-3.5 w-1/2 rounded bg-slate-100" />
          <div className="mt-5 space-y-3 border-t border-line pt-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-3.5 rounded bg-slate-100" />)}
          </div>
        </div>
      ) : !r.ready ? (
        <p className="text-sm text-slate-500" data-testid="safe-notready">
          {t(r.reason === 'noAccounts' ? 'safe.notReady.noAccounts' : 'safe.notReady.noData')}
        </p>
      ) : (
        <>
          <p className={`text-3xl font-display font-bold tabular-nums tracking-tight ${negative ? 'text-red-600' : 'text-slate-900'}`} data-testid="safe-amount">
            {moneySigned(r.safe)}
          </p>
          <p className="mt-1 text-sm text-slate-500">{t('safe.sub')}</p>
          <p className="mt-1 text-sm font-medium text-slate-700" data-testid="safe-perday">
            {negative
              ? t('safe.over')
              : r.perDay > 0
                ? t('safe.perDay', { amount: money(r.perDay), n: r.daysLeft })
                : t('safe.perDay.none')}
          </p>

          {r.balance > 0 && (() => {
            const free = Math.max(0, r.safe);
            const bills = r.billsTotal + r.debtTotal;
            const goals = r.reservedTotal + r.needTotal;
            const total = free + bills + goals;
            if (total <= 0) return null;
            return (
              <div className="mt-4" data-testid="safe-bar">
                <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={t('safe.bar.label')}>
                  {free > 0 && <span className="h-full bg-brand" style={{ width: `${(free / total) * 100}%` }} />}
                  {bills > 0 && <span className="h-full bg-ochre" style={{ width: `${(bills / total) * 100}%` }} />}
                  {goals > 0 && <span className="h-full bg-slate-400" style={{ width: `${(goals / total) * 100}%` }} />}
                </div>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                  <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />{t('safe.legend.free')}</li>
                  <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ochre" aria-hidden="true" />{t('safe.legend.bills')}</li>
                  <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden="true" />{t('safe.legend.goals')}</li>
                </ul>
              </div>
            );
          })()}

          <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
            <Row label={t('safe.row.balance')} value={moneySigned(r.balance)} sub={r.adjust !== 0 ? t('safe.row.adjust', { amount: moneySigned(r.adjust) }) : undefined} />
            <Row label={tp('safe.row.bills', r.bills.length)} value={'− ' + money(r.billsTotal)} />
            {r.debts.length > 0 && <Row label={tp('safe.row.debts', r.debts.length)} value={'− ' + money(r.debtTotal)} />}
            <Row label={t('safe.row.reserved')} value={'− ' + money(r.reservedTotal)} />
            <Row label={t('safe.row.need')} value={'− ' + money(r.needTotal)} />
          </dl>

          <ul className="mt-3 space-y-1 text-xs text-slate-500">
            {r.paidMatched > 0 && <li>{tp('safe.note.matched', r.paidMatched)}</li>}
            {r.adjust === 0 && <li>{t('safe.note.noAdjust')}</li>}
            {!hasExpenseRules && <li>{t('safe.note.noBills')}</li>}
          </ul>
        </>
      )}

      {open && (
        <div className="mt-4 space-y-3 border-t border-line pt-4" data-testid="safe-settings">
          <div>
            <label className="text-xs font-semibold text-slate-600" htmlFor="safe-real">{t('safe.settings.balance')}</label>
            <div className="mt-1 flex gap-2">
              <input
                id="safe-real"
                className="form-input tabular-nums"
                inputMode="numeric"
                value={real}
                onChange={(e) => setReal(formatRupiah(e.target.value))}
                placeholder="0"
              />
              <button onClick={apply} className="shrink-0 rounded-xl bg-brand px-4 text-sm font-semibold text-white">
                {t('safe.settings.apply')}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">{t('safe.settings.balance.hint')}</p>
            {bad && <p className="mt-1 text-xs text-red-600">{t('safe.settings.invalid')}</p>}
            {settings.adjust !== 0 && (
              <button onClick={() => update({ adjust: 0 })} className="mt-1 text-xs font-semibold text-brand-600">
                {t('safe.settings.reset')}
              </button>
            )}
          </div>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={settings.savedInBalance}
              onChange={(e) => update({ savedInBalance: e.target.checked })}
            />
            <span>
              {t('safe.settings.inBalance')}
              <span className="block text-xs text-slate-500">{t('safe.settings.inBalance.hint')}</span>
            </span>
          </label>
        </div>
      )}
    </section>
  );
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-600">
        {label}
        {sub && <span className="block text-xs text-slate-500">{sub}</span>}
      </dt>
      <dd className="whitespace-nowrap font-semibold tabular-nums text-slate-800">{value}</dd>
    </div>
  );
}
