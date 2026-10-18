import { lazyPage } from '@/lib/lazyPage';

// Halaman dimuat saat pertama dibuka, bukan sekaligus di awal. Beranda dan panel Catat tetap dimuat langsung.
export const CalendarPage = lazyPage(() => import('./CalendarPage').then((m) => ({ default: m.CalendarPage })));
export const PlansPage = lazyPage(() => import('./PlansPage').then((m) => ({ default: m.PlansPage })));
export const GoalsPage = lazyPage(() => import('./PlansPage').then((m) => ({ default: m.GoalsPage })));
export const ConflictsPage = lazyPage(() => import('./ConflictsPage').then((m) => ({ default: m.ConflictsPage })));
export const ActivityPage = lazyPage(() => import('./ActivityPage').then((m) => ({ default: m.ActivityPage })));
export const RulesPage = lazyPage(() => import('./RulesPage').then((m) => ({ default: m.RulesPage })));
export const DebtsPage = lazyPage(() => import('./DebtsPage').then((m) => ({ default: m.DebtsPage })));
export const BudgetsPage = lazyPage(() => import('./BudgetsPage').then((m) => ({ default: m.BudgetsPage })));
export const NetWorthPage = lazyPage(() => import('./NetWorthPage').then((m) => ({ default: m.NetWorthPage })));
export const ReportPage = lazyPage(() => import('./ReportPage').then((m) => ({ default: m.ReportPage })));
export const TransactionsPage = lazyPage(() => import('./TransactionsPage').then((m) => ({ default: m.TransactionsPage })));
export const SourcesPage = lazyPage(() => import('./SourcesPage').then((m) => ({ default: m.SourcesPage })));
export const ImportPanel = lazyPage(() => import('./ImportPanel').then((m) => ({ default: m.ImportPanel })));
export const RecapPage = lazyPage(() => import('./RecapPage').then((m) => ({ default: m.RecapPage })));
export const AchievementsPage = lazyPage(() => import('./AchievementsPage').then((m) => ({ default: m.AchievementsPage })));
