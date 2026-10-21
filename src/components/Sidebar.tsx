import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Copy, Gauge, PiggyBank, LayoutDashboard, Receipt, BarChart3, CalendarClock, CalendarDays, History, Landmark, Wand2, Trophy, Share2, RefreshCw, Wallet, DatabaseZap, Scale, Settings, type LucideIcon,
} from 'lucide-react';
import { AccountAvatar } from '@/components/AccountAvatar';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { rupiahSigned } from '@/lib/format';
import { useT, type MessageKey } from '@/i18n';
import type { AccountBalance } from '@/lib/summary';

export type View = 'overview' | 'transactions' | 'budgets' | 'goals' | 'report' | 'calendar' | 'plans' | 'debts' | 'networth' | 'rules' | 'activity' | 'conflicts' | 'achievements' | 'recap' | 'sources' | 'settings';

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

// Dipaku di bawah sidebar (di luar area gulir): dibutuhkan untuk setup dan tidak boleh tersembunyi di layar pendek.
const PINNED: NavItem[] = [
  { view: 'sources', label: 'shell.nav.sources', icon: DatabaseZap },
  { view: 'settings', label: 'nav.settings', icon: Settings },
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
  onRefresh: () => void;
  onClose: () => void;
}

export function Sidebar({
  open, view, accounts, activeAccount, connected, loading, error, conflictCount,
  onNavigate, onSelectAccount, onManageAccounts, onRefresh, onClose,
}: SidebarProps) {
  const { t } = useT();
  // Di layar laptop yang pendek, menu paling bawah (Sumber data, Pengaturan) tersembunyi di dalam area gulir.
  // Pudarkan tepi bawah selama masih ada isi di bawah, supaya jelas bisa digulir.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [moreBelow, setMoreBelow] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el) setMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
  }, []);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [checkScroll]);
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
        <div className="flex items-center gap-3 px-6 pb-6 pt-7">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand">
            <Wallet className="h-[17px] w-[17px] text-white" />
          </span>
          <span className="font-display text-[1.3rem] font-semibold leading-none tracking-tight text-slate-900">Secukupnya.fund</span>
        </div>

        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex-1 overflow-y-auto px-3 pb-4"
          style={moreBelow ? { maskImage: 'linear-gradient(to bottom, #000 calc(100% - 28px), transparent)', WebkitMaskImage: 'linear-gradient(to bottom, #000 calc(100% - 28px), transparent)' } : undefined}
        >
          <nav aria-label={t('shell.sidebar.pages')} className="space-y-6 lg:space-y-5">
            {GROUPS.map((group) => {
              const items: NavItem[] =
                group.id === 'tools' && (conflictCount > 0 || view === 'conflicts')
                  ? [...group.items, { view: 'conflicts', label: 'nav.conflicts', icon: Copy }]
                  : group.items;
              return (
                <div key={group.id} className="space-y-1 lg:space-y-0.5" role="group" aria-label={group.label ? t(group.label) : t('nav.group.main')}>
                  {group.label && (
                    <p className="flex items-center gap-3 px-3 pb-1.5 font-display text-[13px] font-medium italic text-slate-500">
                      {t(group.label)}
                      <span aria-hidden="true" className="h-px flex-1 bg-line" />
                    </p>
                  )}
                  {items.map(({ view: v, label, icon: Icon }) => {
                    const active = v === view;
                    return (
                      <button
                        key={v}
                        onClick={() => onNavigate(v)}
                        aria-current={active ? 'page' : undefined}
                        className={`relative flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors lg:min-h-9 lg:py-1.5 ${
                          active ? 'bg-brand-100 font-semibold text-brand-800' : 'font-medium text-slate-600 hover:bg-card hover:text-slate-900'
                        }`}
                      >
                        {active && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-ochre" />}
                        <Icon className="h-4 w-4" strokeWidth={active ? 2.2 : 1.8} />
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

          <section className="mt-6 border-t border-line pt-5" aria-labelledby="sidebar-accounts">
            <div className="flex items-center justify-between px-3">
              <h2 id="sidebar-accounts" className="font-display text-[13px] font-medium italic text-slate-500">
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

        <div className="border-t border-line px-3 pb-3 pt-2">
          <nav aria-label={t('nav.group.tools')} className="space-y-0.5">
            {PINNED.map(({ view: v, label, icon: Icon }) => {
              const active = v === view;
              return (
                <button
                  key={v}
                  onClick={() => onNavigate(v)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors lg:min-h-9 lg:py-1.5 ${
                    active ? 'bg-brand-100 font-semibold text-brand-800' : 'font-medium text-slate-600 hover:bg-card hover:text-slate-900'
                  }`}
                >
                  {active && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-ochre" />}
                  <Icon className="h-4 w-4" strokeWidth={active ? 2.2 : 1.8} />
                  {t(label)}
                </button>
              );
            })}
          </nav>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-line px-3 pt-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot}`} aria-hidden="true" />
              <span className="truncate text-xs font-medium text-slate-600" role="status">
                {statusLabel}
              </span>
            </div>
            <button
              onClick={onRefresh}
              disabled={loading || !connected}
              className="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
              aria-label={t('shell.sidebar.refresh')}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <LanguageSwitch />
        </div>
      </aside>
    </>
  );
}
