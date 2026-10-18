import { Plus, X } from 'lucide-react';
import { useT } from '@/i18n';
import { formatRupiah, rupiahLabel } from '@/lib/format';
import { MAX_PARTS, MIN_PARTS, rowsToParts, splitProblem, splitRemainder, type SplitRow } from '@/lib/split';

interface Props {
  total: number;
  rows: SplitRow[];
  categories: string[];
  onChange: (rows: SplitRow[]) => void;
}

/** Rincian pisah kategori. Tidak ada yang disimpan di sini: induknya yang menyimpan setelah jumlah pas dengan total. */
export function SplitBox({ total, rows, categories, onChange }: Props) {
  const { t } = useT();
  const parts = rowsToParts(rows);
  const rest = splitRemainder(total, parts);
  const problem = splitProblem(total, parts);
  const nextCategory = () => categories.find((c) => !rows.some((r) => r.category === c)) ?? categories[0];

  const setRow = (i: number, patch: Partial<SplitRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const fill = (i: number) => {
    const others = parts.reduce((s, p, j) => (j === i ? s : s + p.amount), 0);
    const v = total - others;
    if (v > 0) setRow(i, { display: formatRupiah(String(v)) });
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3" data-testid="split-box">
      <p className="text-xs leading-relaxed text-slate-500">{t('split.hint')}</p>
      <ul className="space-y-2">
        {rows.map((row, i) => (
          <li key={i} className="grid grid-cols-[1fr_auto] gap-2">
            <select
              value={row.category}
              onChange={(e) => setRow(i, { category: e.target.value })}
              aria-label={t('split.category.aria', { n: i + 1 })}
              data-testid={`split-cat-${i}`}
              className="form-input col-span-2 sm:col-span-1"
            >
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="col-span-2 flex items-center gap-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
              <div className="relative min-w-0 flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={row.display}
                  onChange={(e) => setRow(i, { display: formatRupiah(e.target.value) })}
                  placeholder="0"
                  aria-label={t('split.amount.aria', { n: i + 1 })}
                  data-testid={`split-amt-${i}`}
                  className="form-input w-full pl-9 tabular-nums sm:w-36"
                />
              </div>
              {rest > 0 && parts[i].amount === 0 && (
                <button type="button" onClick={() => fill(i)} className="whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-semibold text-brand hover:bg-rose-50">
                  {t('split.fill')}
                </button>
              )}
              {rows.length > MIN_PARTS && (
                <button
                  type="button"
                  onClick={() => onChange(rows.filter((_, j) => j !== i))}
                  aria-label={t('split.remove.aria', { n: i + 1 })}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-rose-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {rows.length < MAX_PARTS ? (
          <button
            type="button"
            onClick={() => onChange([...rows, { category: nextCategory(), display: rest > 0 ? formatRupiah(String(rest)) : '' }])}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-brand hover:bg-rose-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('split.add')}
          </button>
        ) : <span />}
        <p
          data-testid="split-rest"
          role="status"
          className={`text-xs font-semibold tabular-nums ${rest === 0 && total > 0 ? 'text-emerald-700' : rest < 0 ? 'text-red-700' : 'text-amber-700'}`}
        >
          {rest === 0 && total > 0 ? t('split.rest.ok') : rest < 0 ? t('split.rest.over', { amount: rupiahLabel(-rest) }) : t('split.rest', { amount: rupiahLabel(rest) })}
        </p>
      </div>
      {problem && total > 0 && problem !== 'mismatch' && (
        <p role="alert" className="text-xs font-medium text-amber-700">{t(`split.problem.${problem}` as const)}</p>
      )}
    </div>
  );
}
