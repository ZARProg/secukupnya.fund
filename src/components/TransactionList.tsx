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
  /** Gaya ringkas untuk Beranda: baris rata tanpa judul tanggal, tanggal di bawah nominal, ketuk baris untuk mengubah. */
  compact?: boolean;
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

/** Tanggal pendek di bawah nominal: Hari ini / Kemarin / 18 Agu. */
function shortDay(iso: string): string {
  if (!iso) return tr('shell.list.undatedDay');
  const label = dayLabel(iso);
  if (iso === todayISO() || label === tr('shell.list.yesterday')) return label;
  return parseISODate(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
}

export function TransactionList({
  transactions,
  onDelete,
  onEdit,
  limit,
  compact,
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
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-100 bg-card text-slate-500 shadow-xs">
          <Inbox className="h-6 w-6" />
        </div>
        <p className="text-sm font-semibold text-slate-700">{emptyTitle ?? t('shell.list.emptyTitle')}</p>
        <p className="mt-1 max-w-xs text-xs text-slate-500">{emptyHint ?? t('shell.list.emptyHint')}</p>
      </div>
    );
  }

  const rows = limit ? transactions.slice(0, limit) : transactions;

  if (compact) {
    return (
      <ul className="divide-y divide-line/70">
        {rows.map((tx) => {
          const meta = getCategoryMeta(tx.category, tx.type);
          const Icon = meta.icon;
          const isExpense = tx.type === 'expense';
          const name = tx.description || tx.category;
          const body = (
            <>
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${meta.bg}`}>
                <Icon className={`h-5 w-5 ${meta.color}`} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold leading-snug text-slate-900">{name}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="truncate">{tx.category}</span>
                  {tx.account && <AccountAvatar name={tx.account} size="xs" />}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className={`block text-[15px] font-bold tabular-nums ${isExpense ? 'text-slate-900' : 'text-emerald-600'}`}>
                  {isExpense ? '−' : '+'}{rupiahLabel(tx.total)}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">{shortDay(tx.date)}</span>
              </span>
            </>
          );
          return (
            <li key={tx.id} className="group flex items-center gap-1">
              {onEdit ? (
                <button type="button" onClick={() => onEdit(tx)} className="-mx-2 flex min-w-0 flex-1 items-center gap-3.5 rounded-2xl px-2 py-3 text-left transition-colors hover:bg-brand/[0.04] active:bg-brand/[0.07]" aria-label={t('edit.aria', { name })}>
                  {body}
                </button>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-3.5 py-3">{body}</div>
              )}
              <button
                onClick={() => handleDelete(tx)}
                disabled={deletingId !== null}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-all hover:bg-red-50 hover:text-red-700 focus-visible:text-red-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 max-sm:sr-only lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
                aria-label={t('shell.list.delete', { name })}
              >
                {deletingId === tx.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

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
                <p className="line-clamp-2 break-words text-sm font-semibold leading-snug text-slate-900 sm:line-clamp-1">{tx.description || tx.category}</p>
                <div className="mt-1 flex items-center gap-x-2 text-xs text-slate-500">
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

              {/* HP: nominal di atas, tombol di bawahnya, supaya deskripsi dapat ruang. sm ke atas: satu baris seperti biasa. */}
              <div className="flex shrink-0 flex-col items-end sm:flex-row sm:items-center sm:gap-3.5">
                <p className={`text-sm font-bold tabular-nums ${isExpense ? 'text-brand-600' : 'text-emerald-600'}`}>
                  {isExpense ? '−' : '+'}
                  {rupiahLabel(tx.total)}
                </p>

                <div className="-mr-1.5 mt-0.5 flex items-center sm:mr-0 sm:mt-0 sm:contents">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(tx)}
                      disabled={deletingId !== null}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-700 focus-visible:text-slate-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:w-10 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
                      aria-label={t('edit.aria', { name: tx.description || tx.category })}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(tx)}
                    disabled={deletingId !== null}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-all hover:bg-red-50 hover:text-red-700 focus-visible:text-red-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:w-10 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
                    aria-label={t('shell.list.delete', { name: tx.description || tx.category })}
                  >
                    {deletingId === tx.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </li>
          </Fragment>
        );
      })}
    </ul>
  );
}
