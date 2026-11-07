import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useT } from '@/i18n';
import { monthLabel, shiftMonth } from '@/lib/report';
import { todayISO } from '@/lib/date';

const KEY = 'budgettracker.recapprompt.v1';

/** Awal bulan (tanggal 1–5): ajak melihat ringkasan bulan lalu. Hilang setelah dibuka atau ditutup, sekali per bulan. */
export function RecapPrompt({ hasPrevData, onOpen }: { hasPrevData: boolean; onOpen: () => void }) {
  const { t } = useT();
  const today = todayISO();
  const prev = shiftMonth(today.slice(0, 7), -1);
  const mark = today.slice(0, 7);
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(KEY) === mark; } catch { return false; }
  });
  if (hidden || !hasPrevData || Number(today.slice(8, 10)) > 5) return null;
  const done = () => { try { localStorage.setItem(KEY, mark); } catch { /* abaikan */ } setHidden(true); };
  return (
    <section role="status" data-testid="recap-prompt" className="mb-5 flex items-center gap-3 rounded-2xl bg-lime p-4 text-night">
      <Sparkles className="h-5 w-5 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm font-semibold">{t('recapPrompt.text', { month: monthLabel(prev) })}</p>
      <button onClick={() => { done(); onOpen(); }} data-testid="recap-prompt-open" className="shrink-0 rounded-full bg-night px-3.5 py-1.5 text-xs font-bold text-white">{t('recapPrompt.action')}</button>
      <button onClick={done} aria-label={t('recapPrompt.dismiss')} className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-black/10"><X className="h-4 w-4" aria-hidden="true" /></button>
    </section>
  );
}
