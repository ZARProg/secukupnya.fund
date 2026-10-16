import { Landmark } from 'lucide-react';
import { useT } from '@/i18n';
import { useDebts } from '@/hooks/useDebts';
import { usePrivacy } from '@/hooks/usePrivacy';
import { todayISO } from '@/lib/date';
import { dueBy } from '@/lib/debts';
import { shortDate } from '@/lib/format';

/** Pengingat cicilan utang yang sudah jatuh tempo (hari ini atau terlambat). Hanya mengingatkan, tidak mencatat apa pun. */
export function DebtDueBanner({ onOpen }: { onOpen: () => void }) {
  const { t, tp } = useT();
  const { debts } = useDebts();
  const { money } = usePrivacy();
  const today = todayISO();
  const items = dueBy(debts, today, today);
  if (!items.length) return null;
  return (
    <section aria-label={tp('debt.banner.title', items.length)} className="mb-5 rounded-2xl border border-violet-200 bg-violet-50/80 p-4 sm:p-5" data-testid="debt-banner">
      <div className="flex items-start gap-3">
        <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-violet-900">{tp('debt.banner.title', items.length)}</h2>
          <ul className="mt-1 space-y-0.5 text-xs text-violet-900/80">
            {items.map(({ debt, due }) => (
              <li key={debt.id}>
                {debt.name} · {shortDate(due.date)} · <span className="font-semibold tabular-nums">{money(due.amount)}</span>
                {due.overdue && <span className="ml-1 font-semibold text-red-600">({t('debt.banner.overdue')})</span>}
              </li>
            ))}
          </ul>
        </div>
        <button onClick={onOpen} className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white">{t('debt.banner.see')}</button>
      </div>
    </section>
  );
}
