import { useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useT } from '@/i18n';
import { SlideOver } from '@/components/SlideOver';
import { usePrivacy } from '@/hooks/usePrivacy';
import { todayISO } from '@/lib/date';
import { formatRupiah, parseRupiah } from '@/lib/format';
import { MAX_AMOUNT } from '@/lib/plans';
import type { Position } from '@/lib/invest';
import type { AccountBalance } from '@/lib/summary';

export type InvestMode = 'topup' | 'withdraw' | 'value';

export interface MoveInput { bank: string; amount: number; date: string; note: string; sync: boolean }

interface Props {
  mode: InvestMode;
  platform: string;
  position: Position;
  /** Bank dan e-wallet yang dipilih, lengkap dengan saldonya. */
  banks: AccountBalance[];
  onClose: () => void;
  onMove: (kind: 'topup' | 'withdraw', input: MoveInput) => Promise<void>;
  onValue: (value: number, date: string) => void;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function InvestDialog({ mode, platform, position, banks, onClose, onMove, onValue }: Props) {
  const { t } = useT();
  const { money, moneySigned } = usePrivacy();
  const [bank, setBank] = useState(banks[0]?.account ?? '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [value, setValue] = useState(position.hasValue ? formatRupiah(String(position.value)) : '');
  const [sync, setSync] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isMove = mode !== 'value';
  const n = parseRupiah(isMove ? amount : value);
  const bankBalance = banks.find((b) => b.account === bank)?.balance ?? 0;
  // Penarikan dibatasi oleh nilai di platform (atau modal bila nilainya belum diisi).
  const platformMax = position.hasValue ? position.value : position.cost;

  let warning: string | null = null;
  if (mode === 'topup' && n > 0 && bank && n > bankBalance) warning = t('inv.warn.balance', { account: bank, amount: money(bankBalance) });
  if (mode === 'withdraw' && n > 0 && n > platformMax) warning = t('inv.warn.platform', { platform, amount: money(Math.max(0, platformMax)) });

  const canSync = isMove && position.hasValue && !!position.valueDate && date >= position.valueDate;
  const gainAfter = mode === 'value' && n > 0 ? n - position.cost : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!date) return setError(t('inv.err.date'));
    if (!n || n <= 0 || n > MAX_AMOUNT) return setError(t('inv.err.amount'));
    if (isMove && !bank) return setError(t('inv.err.account'));
    setError(null);
    if (mode === 'value') {
      onValue(n, date);
      onClose();
      return;
    }
    setBusy(true);
    try {
      await onMove(mode, { bank, amount: n, date, note, sync: sync && canSync });
      onClose();
    } catch {
      setError(t('inv.toast.failed'));
      setBusy(false);
    }
  }

  const title = t(`inv.d.${mode}` as const, { platform });

  return (
    <SlideOver open title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 p-6" data-testid="invest-form" noValidate>
        {isMove && (
          banks.length === 0 ? (
            <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{t('inv.noBank')}</p>
          ) : (
            <Field label={mode === 'topup' ? t('inv.f.from') : t('inv.f.to')} hint={t('inv.f.balance', { amount: money(bankBalance) })}>
              <select className="form-input" value={bank} onChange={(e) => setBank(e.target.value)} data-testid="invest-bank">
                {banks.map((b) => <option key={b.account} value={b.account}>{b.account}</option>)}
              </select>
            </Field>
          )
        )}

        {isMove ? (
          <Field label={t('inv.f.amount')}>
            <input
              className="form-input tabular-nums" inputMode="numeric" autoFocus placeholder="0"
              value={amount} onChange={(e) => setAmount(formatRupiah(e.target.value))} data-testid="invest-amount"
            />
          </Field>
        ) : (
          <Field label={t('inv.f.value')} hint={t('inv.f.value.hint', { platform })}>
            <input
              className="form-input tabular-nums" inputMode="numeric" autoFocus placeholder="0"
              value={value} onChange={(e) => setValue(formatRupiah(e.target.value))} data-testid="invest-value"
            />
          </Field>
        )}

        {gainAfter !== null && (
          <p className="text-sm font-semibold text-slate-800" data-testid="invest-preview">
            {t('inv.preview.gain', { amount: moneySigned(gainAfter) })}
          </p>
        )}

        <Field label={t('inv.f.date')}>
          <input type="date" className="form-input" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} data-testid="invest-date" />
        </Field>

        {isMove && (
          <Field label={t('inv.f.note')}>
            <input className="form-input" maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        )}

        {isMove && canSync && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            <input type="checkbox" checked={sync} onChange={(e) => setSync(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" data-testid="invest-sync" />
            <span>
              <span className="block font-semibold">{t(mode === 'topup' ? 'inv.f.sync.topup' : 'inv.f.sync.withdraw')}</span>
              <span className="block text-xs text-slate-500">{t('inv.f.sync.hint')}</span>
            </span>
          </label>
        )}

        {warning && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="status" data-testid="invest-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{warning}
          </p>
        )}
        {error && <p className="text-sm font-semibold text-rose-700" role="alert" data-testid="invest-error">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            {t('inv.cancel')}
          </button>
          <button
            type="submit" disabled={busy || (isMove && banks.length === 0)}
            className="min-h-11 flex-1 rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50" data-testid="invest-save"
          >
            {t(`inv.save.${mode}` as const)}
          </button>
        </div>
      </form>
    </SlideOver>
  );
}
