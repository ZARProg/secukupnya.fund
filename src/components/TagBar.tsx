import { Hash } from 'lucide-react';
import { useT } from '@/i18n';
import { rupiahLabel } from '@/lib/format';
import type { TagTotal } from '@/lib/tags';

/** Deretan tag teratas. Mengetuk tag memfilter daftar (lewat kolom cari). */
export function TagBar({ tags, active, onPick }: { tags: TagTotal[]; active: string; onPick: (query: string) => void }) {
  const { t } = useT();
  if (tags.length === 0) return null;
  return (
    <div data-testid="tagbar" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label={t('tags.label')}>
      <Hash className="mt-2 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
      {tags.map((g) => {
        const on = active.trim().toLowerCase() === `#${g.tag}`;
        return (
          <button key={g.tag} type="button" aria-pressed={on} data-testid={`tag-${g.tag}`} onClick={() => onPick(on ? '' : `#${g.tag}`)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${on ? 'bg-brand text-white' : 'bg-brand-100 text-brand-800 hover:bg-brand-200'}`}>
            #{g.tag} <span className="font-medium opacity-70">· {rupiahLabel(g.expense + g.income)}</span>
          </button>
        );
      })}
    </div>
  );
}
