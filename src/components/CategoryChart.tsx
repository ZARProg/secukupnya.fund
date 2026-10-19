import { useMemo } from 'react';
import { getCategoryMeta } from '@/lib/categories';
import { rupiahLabel } from '@/lib/format';
import { useT } from '@/i18n';
import type { Transaction } from '@/lib/transactions';

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
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  type === 'expense' ? 'bg-brand' : 'bg-brand-300'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
