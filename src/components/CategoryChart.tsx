import { useMemo } from 'react';
import { getCategoryMeta } from '@/lib/categories';
import { rupiahLabel } from '@/lib/format';
import { useT } from '@/i18n';
import type { Transaction } from '@/lib/transactions';

const SLICES = ['#14160F', '#C8F060', '#85B533', '#C9821A', '#9AA088'];

/** Donat ringkas: 4 kategori teratas + sisanya. Daftar di bawah tetap jadi sumber info (donat aria-hidden). */
function Donut({ entries, total, type }: { entries: [string, number][]; total: number; type: 'expense' | 'income' }) {
  const { t } = useT();
  const top = entries.slice(0, 4);
  const rest = entries.slice(4).reduce((s, [, v]) => s + v, 0);
  const parts = rest > 0 ? [...top.map(([, v]) => v), rest] : top.map(([, v]) => v);
  const R = 42, C = 2 * Math.PI * R, GAP = parts.length > 1 ? 2 : 0;
  let off = 0;
  return (
    <div className="mb-5 flex items-center gap-5">
      <div className="relative h-36 w-36 shrink-0" aria-hidden="true">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={R} fill="none" stroke="currentColor" className="text-slate-100" strokeWidth="14" />
          {parts.map((v, i) => {
            const len = (v / total) * C;
            const el = (
              <circle key={i} cx="50" cy="50" r={R} fill="none" stroke={SLICES[i]} strokeWidth="14"
                strokeDasharray={`${Math.max(len - GAP, 0.5)} ${C}`} strokeDashoffset={-off} />
            );
            off += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-medium text-slate-500">{t(type === 'expense' ? 'cat.donut.expense' : 'cat.donut.income')}</span>
          <span className="text-sm font-bold text-slate-900">{rupiahLabel(total)}</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5 text-xs text-slate-600" aria-hidden="true">
        {parts.map((v, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SLICES[i] }} />
            <span className="truncate">{i < top.length ? getCategoryMeta(top[i][0], type).label : t('cat.donut.other')}</span>
            <span className="ml-auto font-semibold text-slate-800">{Math.round((v / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface CategoryChartProps {
  transactions: Transaction[];
  type: 'expense' | 'income';
}

export function CategoryChart({ transactions, type }: CategoryChartProps) {
  const { t } = useT();
  const data = useMemo(() => {
    const filtered = transactions.filter((t) => t.type === type);
    const totals: Record<string, number> = {};
    for (const tx of filtered) {
      totals[tx.category] = (totals[tx.category] ?? 0) + tx.total;
    }
    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const max = entries.length ? Math.max(...entries.map((e) => e[1])) : 1;
    return { entries, max, total: entries.reduce((s, [, v]) => s + v, 0) };
  }, [transactions, type]);

  if (!data.entries.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-sm text-slate-500">
          {t(type === 'expense' ? 'shell.category.emptyExpense' : 'shell.category.emptyIncome')}
        </p>
        <p className="mt-1 text-xs text-slate-300">{t('shell.category.emptyHint')}</p>
      </div>
    );
  }

  return (
    <div>
      <Donut entries={data.entries} total={data.total} type={type} />
      <div className="space-y-3">
      {data.entries.map(([category, amount]) => {
        const meta = getCategoryMeta(category, type);
        const Icon = meta.icon;
        const pct = Math.round((amount / data.max) * 100);
        const sharePct = data.total ? Math.round((amount / data.total) * 100) : 0;

        return (
          <div key={category} className="group">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className={`flex h-6 w-6 items-center justify-center rounded-md ${meta.bg}`}>
                  <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                </div>
                <span className="text-sm font-medium text-slate-700">{meta.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{sharePct}%</span>
                <span className="text-sm font-semibold text-slate-900">{rupiahLabel(amount)}</span>
              </div>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  type === 'expense' ? 'bg-brand' : 'bg-brand-300'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
