import { Fragment, useState } from 'react';
import { Inbox, Loader2, Pencil, Trash2 } from 'lucide-react';
import { AccountAvatar } from '@/components/AccountAvatar';
import { isNonSpendingCategory, getCategoryMeta } from '@/lib/categories';
import { parseISODate, todayISO, toLocalISO } from '@/lib/date';
import { rupiahLabel } from '@/lib/format';
import { locale, tr, useT } from '@/i18n';
import type { Transaction } from '@/lib/transactions';

interface TransactionListProps {
  transactions: Transaction[];
  onDelete: (tx: Transaction) => Promise<void>;
  onEdit?: (tx: Transaction) => void;
  limit?: number;
  emptyTitle?: string;
  emptyHint?: string;
}

function dayLabel(iso: string): string {
  if (!iso) return tr('shell.list.undatedDay');
  const today = todayISO();
  const yesterday = toLocalISO(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 1));
  if (iso === today) return tr('shell.list.today');
  if (iso === yesterday) return tr('shell.list.yesterday');
  return parseISODate(iso).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'long' });
}

export function TransactionList({
  transactions,
  onDelete,
  onEdit,
  limit,
  emptyTitle,
  emptyHint,
}: TransactionListProps) {
  const { t } = useT();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Lencana sumber hanya muncul kalau daftar memuat dua sumber sekaligus, supaya tidak berisik untuk yang hanya memakai satu.
  const mixedSources = transactions.some((x) => x.source === 'local') && transactions.some((x) => x.source === 'sheet');

  async function handleDelete(tx: Transaction) {
    if (deletingId) return;
    const key = tx.source === 'local' ? 'shell.list.confirmLocal' : 'shell.list.confirmSheet';
    if (!window.confirm(t(key, { name: tx.description || tx.category }))) return;
    setDeletingId(tx.id);
    try {
      await onDelete(tx);
    } finally {
      setDeletingId(null);
    }
  }

  if (!transactions.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-12 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-100 bg-white text-slate-400 shadow-xs">
          <Inbox className="h-6 w-6" />
        </div>
        <p className="text-sm font-semibold text-slate-700">{emptyTitle ?? t('shell.list.emptyTitle')}</p>
        <p className="mt-1 max-w-xs text-xs text-slate-400">{emptyHint ?? t('shell.list.emptyHint')}</p>
      </div>
    );
  }

  const rows = limit ? transactions.slice(0, limit) : transactions;

  // Daftar sudah urut tanggal menurun, jadi cukup mulai grup baru saat tanggalnya berganti.
  const dayTotals = new Map<string, number>();
  for (const tx of rows) {
    if (tx.type === 'expense' && !isNonSpendingCategory(tx.category)) dayTotals.set(tx.date, (dayTotals.get(tx.date) ?? 0) + tx.total);
  }

  return (
    <ul>
      {rows.map((tx, i) => {
        const meta = getCategoryMeta(tx.category, tx.type);
        const Icon = meta.icon;
        const isExpense = tx.type === 'expense';
        const newDay = i === 0 || rows[i - 1].date !== tx.date;
        const dayExpense = dayTotals.get(tx.date) ?? 0;

        return (
          <Fragment key={tx.id}>
            {newDay && (
              <li
                className={`flex items-center gap-3 pb-1.5 text-xs font-semibold text-slate-600 ${
                  i === 0 ? 'pt-0' : 'pt-6'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
                  {dayLabel(tx.date)}
                </span>
                <span className="h-px flex-1 bg-line" aria-hidden />
                {dayExpense > 0 && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium tabular-nums text-slate-500">
                    −{rupiahLabel(dayExpense)}
                  </span>
                )}
              </li>
            )}
            <li className="group -mx-2 flex items-center gap-3 sm:gap-3.5 rounded-xl px-2 py-2.5 transition-colors duration-150 hover:bg-brand/[0.04] focus-within:bg-brand/[0.04]">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ring-black/[0.03] transition-transform duration-150 group-hover:scale-105 ${meta.bg}`}>
                <Icon className={`h-4 w-4 ${meta.color}`} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{tx.description || tx.category}</p>
                <div className="mt-1 flex items-center gap-x-2 text-xs text-slate-400">
                  <span className="truncate">{tx.category}</span>
                  {tx.account && (
                    <span className="flex shrink-0 items-center gap-1.5 font-medium text-slate-500" title={tx.account}>
                      <AccountAvatar name={tx.account} size="xs" />
                      <span className="hidden sm:inline">{tx.account}</span>
                    </span>
                  )}
                  {tx.source === 'sheet' && mixedSources && (
                    <span className="shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                      {t('source.badge.sheet')}
                    </span>
                  )}
                  {tx.source === 'local' && mixedSources && (
                    <span
                      className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500"
                      title={t('shell.list.localTitle')}
                    >
                      {t('shell.list.local')}
                    </span>
                  )}
                </div>
              </div>

              <p className={`shrink-0 text-sm font-bold tabular-nums ${isExpense ? 'text-brand' : 'text-emerald-600'}`}>
                {isExpense ? '−' : '+'}
                {rupiahLabel(tx.total)}
              </p>

              {onEdit && (
                <button
                  onClick={() => onEdit(tx)}
                  disabled={deletingId !== null}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 focus-visible:text-slate-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
                  aria-label={t('edit.aria', { name: tx.description || tx.category })}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => handleDelete(tx)}
                disabled={deletingId !== null}
                className="-mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 sm:mr-0 transition-all hover:bg-rose-50 hover:text-rose-600 focus-visible:text-rose-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
                aria-label={t('shell.list.delete', { name: tx.description || tx.category })}
              >
                {deletingId === tx.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </li>
          </Fragment>
        );
      })}
    </ul>
  );
}
