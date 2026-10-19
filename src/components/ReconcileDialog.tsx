import { useEffect, useMemo, useRef, useState } from 'react';
import { Scale, X } from 'lucide-react';
import { AccountAvatar } from '@/components/AccountAvatar';
import { useT } from '@/i18n';
import { parseSigned, rupiahLabel, signedFormat } from '@/lib/format';
import { MAX_AMOUNT } from '@/lib/plans';
import { adjustmentPayload } from '@/lib/reconcile';
import type { AccountBalance } from '@/lib/summary';
import type { TransactionPayload } from '@/lib/transactions';

interface Props {
  accounts: AccountBalance[];
  toSheet: boolean;
  startingBalanceSet: boolean;
  onSave: (payloads: TransactionPayload[]) => Promise<void>;
  onClose: () => void;
}

export function ReconcileDialog({ accounts, toSheet, startingBalanceSet, onSave, onClose }: Props) {
  const { t } = useT();
  const [input, setInput] = useState<Record<string, string>>({});
  const [real, setReal] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rows = useMemo(() => accounts.map(({ account, balance }) => {
    const raw = input[account] ?? '';
    const actual = raw.trim() === '' ? null : parseSigned(raw);
    const diff = actual === null ? null : actual - balance;
    return { account, balance, raw, actual, diff };
  }), [accounts, input]);

  const changes = rows.filter((r) => r.diff !== null && r.diff !== 0 && Math.abs(r.diff) <= MAX_AMOUNT);

  async function save() {
    setError('');
    if (rows.some((r) => r.raw.trim() !== '' && r.actual === null)) return setError(t('recon.err.value'));
    if (rows.some((r) => r.diff !== null && Math.abs(r.diff) > MAX_AMOUNT)) return setError(t('recon.err.max'));
    if (!changes.length) return setError(t('recon.none'));
    setBusy(true);
    try {
      await onSave(changes.map((r) => adjustmentPayload(r.account, r.diff as number, !!real[r.account], t('recon.desc'))));
    } catch {
      setError(t('recon.toast.failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="recon-title" data-testid="recon-dialog"
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl bg-card shadow-xl sm:rounded-3xl">
        <div className="flex items-start gap-3 border-b border-line p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700"><Scale className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="recon-title" className="text-lg font-semibold text-slate-900">{t('recon.title')}</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{t('recon.intro')}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('shell.toast.dismiss')} className="-mr-1 flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-3 overflow-y-auto p-5">
          {rows.map((r, i) => (
            <div key={r.account} data-testid={`recon-row-${r.account}`} className="rounded-2xl border border-line p-3">
              <div className="flex items-center gap-2.5">
                <AccountAvatar name={r.account} size="sm" />
                <p className="flex-1 truncate text-sm font-bold text-slate-900">{r.account}</p>
                <p className="text-xs text-slate-600">{t('recon.inApp')}: <span className="font-semibold tabular-nums text-slate-800">{r.balance < 0 ? '−' : ''}{rupiahLabel(Math.abs(r.balance))}</span></p>
              </div>
              <label className="mt-2 block">
                <span className="sr-only">{t('recon.actual', { account: r.account })}</span>
                <input ref={i === 0 ? firstRef : undefined} data-testid={`recon-input-${r.account}`} inputMode="text" autoComplete="off" placeholder={t('recon.actual', { account: r.account })}
                  value={r.raw} onChange={(e) => setInput((p) => ({ ...p, [r.account]: signedFormat(e.target.value) }))} className="form-input w-full tabular-nums" />
              </label>
              {r.diff !== null && (
                <p data-testid={`recon-diff-${r.account}`} className={`mt-2 text-xs font-semibold ${r.diff === 0 ? 'text-brand-700' : 'text-slate-800'}`}>
                  {r.diff === 0 ? t('recon.same') : r.diff > 0 ? t('recon.less', { n: rupiahLabel(r.diff) }) : t('recon.more', { n: rupiahLabel(-r.diff) })}
                </p>
              )}
              {r.diff !== null && r.diff !== 0 && (
                <label className="mt-2 flex items-start gap-2 text-xs text-slate-700">
                  <input type="checkbox" data-testid={`recon-real-${r.account}`} checked={!!real[r.account]} onChange={(e) => setReal((p) => ({ ...p, [r.account]: e.target.checked }))} className="mt-0.5 h-4 w-4 accent-brand" />
                  <span>{r.diff < 0 ? t('recon.count.expense') : t('recon.count.income')}</span>
                </label>
              )}
            </div>
          ))}
          {startingBalanceSet && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{t('recon.safeWarn')}</p>}
          {toSheet && <p className="rounded-xl bg-slate-100 p-3 text-xs text-slate-700">{t('recon.sheetWarn')}</p>}
          <p role="alert" data-testid="recon-error" className="min-h-4 text-sm font-semibold text-red-700">{error}</p>
        </div>

        <div className="flex gap-2 border-t border-line p-4">
          <button type="button" data-testid="recon-save" onClick={save} disabled={busy || !changes.length}
            className="min-h-11 flex-1 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50">{t('recon.save', { n: changes.length })}</button>
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-brand-600 hover:bg-brand-50">{t('recon.cancel')}</button>
        </div>
      </div>
    </div>
  );
}
