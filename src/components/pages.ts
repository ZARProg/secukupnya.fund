import { lazyPage } from '@/lib/lazyPage';

// Halaman dan panel dimuat saat pertama dibuka, bukan sekaligus di awal (mengurangi kerja saat halaman pertama muncul). Beranda tetap dimuat langsung.
// Panel Catat dan dialog Cocokkan saldo diambil diam-diam saat browser menganggur (lihat prefetchPanels), jadi terbuka tanpa jeda.
export const CalendarPage = lazyPage(() => import('./CalendarPage').then((m) => ({ default: m.CalendarPage })));
export const PlansPage = lazyPage(() => import('./PlansPage').then((m) => ({ default: m.PlansPage })));
export const GoalsPage = lazyPage(() => import('./PlansPage').then((m) => ({ default: m.GoalsPage })));
export const ConflictsPage = lazyPage(() => import('./ConflictsPage').then((m) => ({ default: m.ConflictsPage })));
export const ActivityPage = lazyPage(() => import('./ActivityPage').then((m) => ({ default: m.ActivityPage })));
export const RulesPage = lazyPage(() => import('./RulesPage').then((m) => ({ default: m.RulesPage })));
export const DebtsPage = lazyPage(() => import('./DebtsPage').then((m) => ({ default: m.DebtsPage })));
export const BudgetsPage = lazyPage(() => import('./BudgetsPage').then((m) => ({ default: m.BudgetsPage })));
export const NetWorthPage = lazyPage(() => import('./NetWorthPage').then((m) => ({ default: m.NetWorthPage })));
export const InvestPage = lazyPage(() => import('./InvestPage').then((m) => ({ default: m.InvestPage })));
export const ReportPage = lazyPage(() => import('./ReportPage').then((m) => ({ default: m.ReportPage })));
export const TransactionsPage = lazyPage(() => import('./TransactionsPage').then((m) => ({ default: m.TransactionsPage })));
export const SourcesPage = lazyPage(() => import('./SourcesPage').then((m) => ({ default: m.SourcesPage })));
export const ImportPanel = lazyPage(() => import('./ImportPanel').then((m) => ({ default: m.ImportPanel })));
export const RecapPage = lazyPage(() => import('./RecapPage').then((m) => ({ default: m.RecapPage })));
export const AchievementsPage = lazyPage(() => import('./AchievementsPage').then((m) => ({ default: m.AchievementsPage })));
export const SettingsPage = lazyPage(() => import('./SettingsPage').then((m) => ({ default: m.SettingsPage })));
export const RecordPanel = lazyPage(() => import('./RecordPanel').then((m) => ({ default: m.RecordPanel })));
export const CommandPalette = lazyPage(() => import('./CommandPalette').then((m) => ({ default: m.CommandPalette })));
export const ReconcileDialog = lazyPage(() => import('./ReconcileDialog').then((m) => ({ default: m.ReconcileDialog })));

/** Ambil panel yang hampir pasti dipakai saat browser menganggur, setelah halaman pertama tampil. */
export function prefetchPanels() {
  const run = () => {
    void import('./RecordPanel');
    void import('./ReconcileDialog');
  };
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(run, { timeout: 4000 });
  else window.setTimeout(run, 2500);
}
