import { Trophy } from 'lucide-react';
import { useT, type MessageKey } from '@/i18n';
import type { Engagement } from '@/hooks/useEngagement';

export function LevelChip({ eng, onOpen }: { eng: Engagement; onOpen: () => void }) {
  const { t } = useT();
  const { level, next, percent } = eng.level;
  return (
    <button
      onClick={onOpen}
      data-testid="level-chip"
      className="flex w-full items-center gap-4 rounded-2xl border border-line bg-card p-4 text-left shadow-card transition-colors hover:bg-rose-50/40"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand-600"><Trophy className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-bold text-slate-900">
            {t('ach.level', { n: level.level })} · {t(`lvl.${level.key}` as MessageKey)}
          </span>
          <span className="text-xs font-semibold tabular-nums text-slate-500">{t('ach.xp', { n: eng.xp })}</span>
        </span>
        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-100">
          <span className="block h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
        </span>
        {next && (
          <span className="mt-1 block text-xs text-slate-500">
            {t('ach.toNext', { n: next.min - eng.xp, name: t(`lvl.${next.key}` as MessageKey) })}
          </span>
        )}
      </span>
    </button>
  );
}
