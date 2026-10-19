import { useMemo, useState } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { useT, type MessageKey } from '@/i18n';
import { usePrivacy } from '@/hooks/usePrivacy';
import { doubleCounted, type DupPair } from '@/lib/crossSource';
import { shortDate } from '@/lib/format';
import type { Transaction } from '@/lib/transactions';
import type { ToastState } from '@/components/Toast';

interface ConflictsPageProps {
  pairs: DupPair[];
  ignoredCount: number;
  onIgnore: (key: string) => void;
  onUnignoreAll: () => void;
  onDelete: (tx: Transaction) => Promise<void>;
  onToast: (t: ToastState) => void;
}

export function ConflictsPage({ pairs, ignoredCount, onIgnore, onUnignoreAll, onDelete, onToast }: ConflictsPageProps) {
  const { t, tp } = useT();
  const { money } = usePrivacy();
  const [busy, setBusy] = useState(false);
  const impact = useMemo(() => doubleCounted(pairs), [pairs]);
  const exact = pairs.filter((p) => p.level === 'exact');

  async function remove(tx: Transaction) {
    if (busy) return;
    setBusy(true);
    try {
      await onDelete(tx);
      onToast({ kind: 'success', message: t('conflicts.toast.deleted') });
    } catch (err) {
      onToast({ kind: 'error', message: err instanceof Error ? err.message : t('conflicts.toast.failed') });
    } finally {
      setBusy(false);
    }
  }

  async function removeAllLocalExact() {
    if (busy || !window.confirm(t('conflicts.bulkConfirm', { n: exact.length }))) return;
    setBusy(true);
    let done = 0;
    try {
      for (const p of exact) {
        await onDelete(p.local);
        done++;
      }
      onToast({ kind: 'success', message: tp('conflicts.toast.bulk', done) });
    } catch (err) {
      onToast({ kind: 'error', message: err instanceof Error ? err.message : t('conflicts.toast.failed') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="conflicts-page">
      <p className="rounded-2xl border border-line bg-card p-4 text-sm leading-relaxed text-slate-600 shadow-card">{t('conflicts.intro')}</p>

      {pairs.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card p-6 text-sm text-slate-500" data-testid="conflicts-empty">{t('conflicts.empty')}</p>
      ) : (
        <>
          <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
            <p className="font-semibold" data-testid="conflicts-impact">{t('conflicts.impact', { expense: money(impact.expense), income: money(impact.income) })}</p>
            <p className="text-xs">{t('conflicts.recommend')}</p>
            {exact.length > 0 && (
              <button onClick={removeAllLocalExact} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50" data-testid="conflicts-bulk">
                <Trash2 className="h-3.5 w-3.5" /> {t('conflicts.bulk', { n: exact.length })}
              </button>
            )}
          </div>

          <ul className="space-y-3" data-testid="conflicts-list">
            {pairs.map((p) => (
              <li key={p.key} className="rounded-2xl border border-line bg-card p-4 shadow-card" data-testid="conflict-item" data-level={p.level}>
                <div className="mb-2 flex items-center gap-2 text-xs">
                  <Copy className="h-3.5 w-3.5 text-slate-500" />
                  <span className={`rounded-full px-2 py-0.5 font-bold ${p.level === 'exact' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>{t(`conflicts.level.${p.level}` as MessageKey)}</span>
                  {p.level === 'likely' && <span className="text-slate-500">{t('conflicts.level.likely.hint')}</span>}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Side title={t('conflicts.col.local')} tx={p.local} />
                  <Side title={t('conflicts.col.sheet')} tx={p.sheet} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => remove(p.local)} disabled={busy} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50" data-testid="conflict-delete-local">{t('conflicts.deleteLocal')}</button>
                  <button onClick={() => remove(p.sheet)} disabled={busy} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50" data-testid="conflict-delete-sheet">{t('conflicts.deleteSheet')}</button>
                  <button onClick={() => onIgnore(p.key)} disabled={busy} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-50" data-testid="conflict-ignore">{t('conflicts.ignore')}</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {ignoredCount > 0 && (
        <p className="text-xs text-slate-500">
          {t('conflicts.ignored', { n: ignoredCount })}{' '}
          <button onClick={onUnignoreAll} className="font-semibold text-brand-600 underline" data-testid="conflicts-unignore">{t('conflicts.showIgnored')}</button>
        </p>
      )}
    </div>
  );
}

function Side({ title, tx }: { title: string; tx: Transaction }) {
  const { money } = usePrivacy();
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-sm">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="font-semibold text-slate-900">{tx.description || tx.category}</p>
      <p className="text-xs text-slate-500">{shortDate(tx.date)} · {tx.category} · {tx.account}</p>
      <p className={`mt-1 font-bold tabular-nums ${tx.type === 'income' ? 'text-emerald-700' : 'text-brand-600'}`}>{tx.type === 'income' ? '+' : '−'}{money(tx.total)}</p>
    </div>
  );
}
