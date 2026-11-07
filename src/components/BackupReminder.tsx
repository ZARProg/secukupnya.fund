import { useState } from 'react';
import { DatabaseBackup } from 'lucide-react';
import { useT } from '@/i18n';
import { daysSince, shouldRemindBackup, snoozeBackup } from '@/lib/backupReminder';

/** Pengingat cadangan di Beranda. Data hanya ada di browser ini, jadi cadangan berkala melindungi dari data hilang. */
export function BackupReminder({ hasData, onOpen }: { hasData: boolean; onOpen: () => void }) {
  const { t, tp } = useT();
  const [hidden, setHidden] = useState(false);
  if (hidden || !shouldRemindBackup(hasData)) return null;
  const d = daysSince();
  return (
    <section role="status" data-testid="backup-reminder" className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-card p-4 shadow-card">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700"><DatabaseBackup className="h-5 w-5" aria-hidden="true" /></span>
      <p className="min-w-0 flex-1 text-sm font-medium text-slate-800">{d === null ? t('brem.never') : tp('brem.days', d)}</p>
      <button onClick={onOpen} data-testid="backup-reminder-open" className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white">{t('brem.action')}</button>
      <button onClick={() => { snoozeBackup(); setHidden(true); }} data-testid="backup-reminder-later" className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">{t('brem.later')}</button>
    </section>
  );
}
