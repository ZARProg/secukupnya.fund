import {
  Copy, Gauge, PiggyBank, LayoutDashboard, Receipt, BarChart3, CalendarClock, CalendarDays, History, Landmark, Wand2, Trophy, Share2, Plus, RefreshCw, Wallet, X, FileSpreadsheet, DatabaseZap, Download, Scale, type LucideIcon,
} from 'lucide-react';
import { AccountAvatar } from '@/components/AccountAvatar';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { rupiahSigned } from '@/lib/format';
import { useT, type MessageKey } from '@/i18n';
import type { AccountBalance } from '@/lib/summary';

export type View = 'overview' | 'transactions' | 'budgets' | 'goals' | 'report' | 'calendar' | 'plans' | 'debts' | 'networth' | 'rules' | 'activity' | 'conflicts' | 'achievements' | 'recap' | 'sources';

type NavItem = { view: View; label: MessageKey; icon: LucideIcon };

// Lima halaman utama dulu (sesuai urutan kebutuhan harian), lalu perencanaan, alat, dan motivasi.
const GROUPS: { id: string; label: MessageKey | null; items: NavItem[] }[] = [
  {
    id: 'main',
    label: null,
    items: [
      { view: 'overview', label: 'shell.nav.overview', icon: LayoutDashboard },
      { view: 'transactions', label: 'shell.nav.transactions', icon: Receipt },
      { view: 'budgets', label: 'nav.budgets', icon: Gauge },
      { view: 'goals', label: 'nav.goals', icon: PiggyBank },
      { view: 'report', label: 'shell.nav.report', icon: BarChart3 },
    ],
  },
  {
    id: 'plan',
    label: 'nav.group.plan',
    items: [
      { view: 'calendar', label: 'nav.calendar', icon: CalendarDays },
      { view: 'plans', label: 'nav.plans', icon: CalendarClock },
      { view: 'debts', label: 'nav.debts', icon: Landmark },
      { view: 'networth', label: 'nav.networth', icon: Scale },
    ],
  },
  {
    id: 'tools',
    label: 'nav.group.tools',
    items: [
      { view: 'rules', label: 'nav.rules', icon: Wand2 },
      { view: 'activity', label: 'nav.activity', icon: History },
      { view: 'sources', label: 'shell.nav.sources', icon: DatabaseZap },
    ],
  },
  {
    id: 'motivation',
    label: 'nav.group.motivation',
    items: [
      { view: 'achievements', label: 'nav.achievements', icon: Trophy },
      { view: 'recap', label: 'nav.recap', icon: Share2 },
    ],
  },
];

interface SidebarProps {
  open: boolean;
  view: View;
  accounts: AccountBalance[];
  activeAccount: string;
  connected: boolean;
  loading: boolean;
  error: string | null;
  /** Jumlah kemungkinan duplikat lintas sumber. Menu Tinjau duplikat hanya tampil kalau ada. */
  conflictCount: number;
  onNavigate: (view: View) => void;
  onSelectAccount: (account: string) => void;
  onManageAccounts: () => void;
  onNewTransaction: () => void;
  onImport: () => void;
  onTemplate: () => void;
  onRefresh: () => void;
  onClose: () => void;
}

export function Sidebar({
  open, view, accounts, activeAccount, connected, loading, error, conflictCount,
  onNavigate, onSelectAccount, onManageAccounts, onNewTransaction, onImport, onTemplate, onRefresh, onClose,
}: SidebarProps) {
  const { t } = useT();
  const statusLabel = !connected
    ? t('shell.sidebar.status.disconnected')
    : loading
      ? t('shell.sidebar.status.syncing')
      : error
        ? t('shell.sidebar.status.error')
        : t('shell.sidebar.status.connected');
  const statusDot = !connected
    ? 'bg-slate-400'
    : loading
      ? 'bg-amber-400 animate-pulse'
      : error
        ? 'bg-red-400'
        : 'bg-emerald-400';

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-ink/50 backdrop-blur-xs transition-opacity duration-200 lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        aria-label={t('shell.sidebar.nav')}
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-line bg-paper text-slate-800 transition-[transform,visibility] duration-200 lg:visible lg:translate-x-0 ${
          open ? 'translate-x-0' : 'invisible -translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 pt-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand">
              <Wallet className="h-5 w-5 text-white" />
            </span>
            <span className="font-display text-xl font-bold tracking-tight text-slate-900">Secukupnya.fund</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 lg:hidden"
            aria-label={t('shell.sidebar.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 space-y-2 px-5">
          <button
            onClick={onNewTransaction}
            aria-keyshortcuts="n"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-600 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            {t('shell.action.record')}
            <kbd aria-hidden="true" className="ml-1 hidden rounded border border-white/50 px-1.5 text-[10px] font-bold text-white lg:inline">N</kbd>
          </button>
          <button
            onClick={onImport}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:border-brand-300 hover:text-brand-700 active:scale-[0.98]"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {t('shell.action.import')}
          </button>
          <button
            onClick={onTemplate}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-800"
          >
            <Download className="h-3.5 w-3.5" />
            {t('shell.sidebar.template')}
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto px-3 pb-4">
          <nav aria-label={t('shell.sidebar.pages')} className="space-y-5 px-2">
            {GROUPS.map((group) => {
              const items: NavItem[] =
                group.id === 'tools' && (conflictCount > 0 || view === 'conflicts')
                  ? [...group.items, { view: 'conflicts', label: 'nav.conflicts', icon: Copy }]
                  : group.items;
              return (
                <div key={group.id} className="space-y-1" role="group" aria-label={group.label ? t(group.label) : t('nav.group.main')}>
                  {group.label && (
                    <p className="px-3.5 pb-1 text-xs font-semibold text-slate-500">{t(group.label)}</p>
                  )}
                  {items.map(({ view: v, label, icon: Icon }) => {
                    const active = v === view;
                    return (
                      <button
                        key={v}
                        onClick={() => onNavigate(v)}
                        aria-current={active ? 'page' : undefined}
                        className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                          active ? 'bg-brand-200 font-semibold text-brand-800' : 'text-slate-600 hover:bg-card hover:text-slate-900'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {t(label)}
                        {v === 'conflicts' && conflictCount > 0 && (
                          <span className="ml-auto rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-ink" data-testid="conflict-count">{conflictCount}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          <section className="mt-7 px-2" aria-labelledby="sidebar-accounts">
            <div className="flex items-center justify-between px-3">
              <h2 id="sidebar-accounts" className="text-sm font-semibold text-slate-600">
                {t('shell.accounts')}
              </h2>
              <button
                onClick={onManageAccounts}
                className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-100 hover:text-brand-800"
              >
                {t('shell.sidebar.manage')}
              </button>
            </div>
            {accounts.length === 0 && <p className="px-3 pt-2 text-xs text-slate-500">{t('accounts.pick.short')}</p>}
            <ul className="mt-2 space-y-0.5">
              {accounts.map(({ account, balance }) => {
                const active = account === activeAccount;
                return (
                  <li key={account}>
                    <button
                      onClick={() => onSelectAccount(account)}
                      aria-pressed={active}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-all ${
                        active ? 'bg-card font-medium text-slate-900 ring-1 ring-line' : 'text-slate-700 hover:bg-card'
                      }`}
                    >
                      <AccountAvatar name={account} />
                      <span className="min-w-0 flex-1 truncate">{account}</span>
                      <span
                        className={`shrink-0 text-xs font-semibold tabular-nums ${
                          balance < 0 ? 'text-rose-700' : 'text-slate-500'
                        }`}
                      >
                        {rupiahSigned(balance)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {accounts.length > 0 && (
              <p className="px-3 pt-3 text-[11px] leading-relaxed text-slate-500">
                {t('shell.sidebar.balanceNote')}
              </p>
            )}
          </section>
        </div>

        <div className="border-t border-line pt-3">
          <LanguageSwitch />
        </div>

        <div className="flex items-center justify-between border-t border-line px-6 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot}`} aria-hidden="true" />
            <span className="truncate text-xs font-medium text-slate-600" role="status">
              {statusLabel}
            </span>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading || !connected}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
            aria-label={t('shell.sidebar.refresh')}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </aside>
    </>
  );
}
