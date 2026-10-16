import { useMemo, useState } from 'react';
import { History, RotateCcw, Trash2 } from 'lucide-react';
import { useT, locale, type MessageKey } from '@/i18n';
import { usePrivacy } from '@/hooks/usePrivacy';
import { changedFields, entryEffect, type ActivityAction, type ActivityEntry, type TxSnap } from '@/lib/activity';
import { clearActivity, useActivity } from '@/lib/activityStore';
import { shortDate } from '@/lib/format';
import type { ToastState } from '@/components/Toast';

type Group = 'all' | 'create' | 'update' | 'delete' | 'restore' | 'import' | 'external';
const GROUPS: Group[] = ['all', 'create', 'update', 'delete', 'restore', 'import', 'external'];
const GROUP_LABEL: Record<Group, MessageKey> = {
  all: 'activity.filter.all',
  create: 'activity.action.create',
  update: 'activity.action.update',
  delete: 'activity.action.delete',
  restore: 'activity.action.restore',
  import: 'activity.action.import',
  external: 'activity.action.external_add',
};
const groupOf = (a: ActivityAction): Group => (a.startsWith('external_') ? 'external' : (a as Group));
const PAGE = 100;

const TONE: Record<ActivityAction, string> = {
  create: 'bg-emerald-50 text-emerald-700',
  update: 'bg-sky-50 text-sky-700',
  delete: 'bg-red-50 text-red-700',
  restore: 'bg-violet-50 text-violet-700',
  import: 'bg-slate-100 text-slate-700',
  external_add: 'bg-amber-50 text-amber-800',
  external_remove: 'bg-amber-50 text-amber-800',
  external_update: 'bg-amber-50 text-amber-800',
};

export function ActivityPage({ onRestore, onToast }: { onRestore: (e: ActivityEntry) => Promise<void>; onToast: (t: ToastState) => void }) {
  const { t } = useT();
  const { moneySigned } = usePrivacy();
  const entries = useActivity();
  const [group, setGroup] = useState<Group>('all');
  const [source, setSource] = useState<'all' | 'local' | 'sheet'>('all');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [busy, setBusy] = useState<string | null>(null);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...entries].reverse().filter((e) => {
      if (group !== 'all' && groupOf(e.action) !== group) return false;
      if (source !== 'all' && e.source !== source) return false;
      if (!needle) return true;
      return [e.before, e.after].some((s) => s && `${s.description} ${s.category} ${s.account}`.toLowerCase().includes(needle));
    });
  }, [entries, group, source, q]);
  const net = shown.reduce((s, e) => s + entryEffect(e), 0);

  async function restore(e: ActivityEntry) {
    setBusy(e.id);
    try {
      await onRestore(e);
      onToast({ kind: 'success', message: t('activity.toast.restored') });
    } catch (err) {
      onToast({ kind: 'error', message: err instanceof Error ? err.message : t('activity.toast.failed') });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4" data-testid="activity-page">
      <p className="flex items-start gap-2 rounded-2xl border border-line bg-white p-4 text-xs leading-relaxed text-slate-600 shadow-card">
        <History className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        {t('activity.scope')}
      </p>

      {entries.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-sm text-slate-500" data-testid="activity-empty">{t('activity.empty')}</p>
      ) : (
        <>
          <div className="space-y-3 rounded-2xl border border-line bg-white p-4 shadow-card">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('activity.filter.all')}>
              {GROUPS.map((g) => (
                <button
                  key={g}
                  onClick={() => { setGroup(g); setLimit(PAGE); }}
                  aria-pressed={group === g}
                  data-testid={`activity-filter-${g}`}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${group === g ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {t(GROUP_LABEL[g])}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input className="form-input flex-1" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder={t('activity.filter.search')} aria-label={t('activity.filter.search')} data-testid="activity-search" />
              <select className="form-input sm:w-48" value={source} onChange={(e) => setSource(e.target.value as 'all' | 'local' | 'sheet')} aria-label={t('activity.filter.source')} data-testid="activity-source">
                <option value="all">{t('activity.source.all')}</option>
                <option value="local">{t('activity.source.local')}</option>
                <option value="sheet">{t('activity.source.sheet')}</option>
              </select>
            </div>
            <p className="text-xs font-medium text-slate-600" data-testid="activity-net">{t('activity.effect.total', { amount: moneySigned(net) })}</p>
          </div>

          {shown.length === 0 ? (
            <p className="rounded-2xl border border-line bg-white p-6 text-sm text-slate-500">{t('activity.emptyFilter')}</p>
          ) : (
            <ul className="space-y-2" data-testid="activity-list">
              {shown.slice(0, limit).map((e) => (
                <Entry key={e.id} e={e} busy={busy === e.id} onRestore={() => restore(e)} />
              ))}
            </ul>
          )}
          {shown.length > limit && (
            <button onClick={() => setLimit((l) => l + PAGE)} className="w-full rounded-xl border border-line bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              +{Math.min(PAGE, shown.length - limit)}
            </button>
          )}
          <button
            onClick={() => {
              if (window.confirm(t('activity.clearConfirm'))) {
                clearActivity();
                onToast({ kind: 'success', message: t('activity.toast.cleared') });
              }
            }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600"
            data-testid="activity-clear"
          >
            <Trash2 className="h-3.5 w-3.5" /> {t('activity.clear')}
          </button>
        </>
      )}
    </div>
  );
}

function when(at: string): string {
  return new Date(at).toLocaleString(locale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Entry({ e, busy, onRestore }: { e: ActivityEntry; busy: boolean; onRestore: () => void }) {
  const { t, tp } = useT();
  const { money, moneySigned } = usePrivacy();
  const effect = entryEffect(e);
  const canRestore = !e.restoredAt && (e.action === 'delete' || e.action === 'external_remove' ? !!e.before : (e.action === 'update' || e.action === 'external_update') && !!e.before && !!e.after);
  const isRevertable = e.action === 'update' || e.action === 'external_update';
  const snap = e.after ?? e.before;
  const fields = changedFields(e.before, e.after);

  const line = (s: TxSnap) => `${s.description || s.category} · ${s.category} · ${s.account} · ${shortDate(s.date)} · ${t(`activity.type.${s.type}` as MessageKey)} ${money(s.total)}`;

  return (
    <li className="rounded-2xl border border-line bg-white p-4 shadow-card" data-testid="activity-entry" data-action={e.action}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2.5 py-0.5 font-bold ${TONE[e.action]}`}>{t(`activity.action.${e.action}` as MessageKey)}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">{t(e.source === 'sheet' ? 'activity.source.sheet' : 'activity.source.local')}</span>
        <time className="text-slate-500" dateTime={e.at}>{when(e.at)}</time>
        <span className={`ml-auto font-bold tabular-nums ${effect < 0 ? 'text-brand' : effect > 0 ? 'text-emerald-700' : 'text-slate-500'}`} title={t('activity.effect')} data-testid="activity-effect">
          {moneySigned(effect)}
        </span>
      </div>

      {e.action === 'import' ? (
        <p className="mt-2 text-sm text-slate-800">{tp('activity.import.summary', e.count ?? 0)}</p>
      ) : e.count && !snap ? (
        <p className="mt-2 text-sm text-slate-800">{t('activity.bulkDelete', { n: e.count })}</p>
      ) : e.before && e.after && fields.length > 0 ? (
        <div className="mt-2 text-sm text-slate-800">
          <p className="font-semibold">{e.after.description || e.after.category}</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {fields.map((f) => (
              <li key={f} className="text-slate-600">
                <span className="font-semibold">{t(`activity.field.${f}` as MessageKey)}:</span>{' '}
                <span className="text-slate-400 line-through">{f === 'total' ? money(e.before![f]) : String(e.before![f])}</span>
                {' → '}
                <span className="font-semibold text-slate-900">{f === 'total' ? money(e.after![f]) : String(e.after![f])}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : snap ? (
        <p className="mt-2 text-sm text-slate-800">{line(snap)}</p>
      ) : null}

      {(canRestore || e.restoredAt) && (
        <div className="mt-3">
          {e.restoredAt ? (
            <span className="text-xs font-semibold text-slate-400">{t('activity.restored')} · {when(e.restoredAt)}</span>
          ) : (
            <button
              onClick={onRestore}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              data-testid="activity-restore"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t(isRevertable ? 'activity.restore.update' : 'activity.restore.delete')}
            </button>
          )}
        </div>
      )}
    </li>
  );
}
