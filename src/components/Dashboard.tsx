import { useMemo, useState, type ReactNode } from 'react';
import { Download, FileSpreadsheet, Link2, MoreHorizontal, PencilLine, Plus, Scale, TrendingUp, type LucideIcon } from 'lucide-react';
import { AccountStrip } from '@/components/AccountStrip';
import { StatsCards } from '@/components/StatsCards';
import { DailyChart } from '@/components/DailyChart';
import { CategoryChart } from '@/components/CategoryChart';
import { LevelChip } from '@/components/LevelChip';
import type { Engagement } from '@/hooks/useEngagement';
import { SafeToSpendCard } from '@/components/SafeToSpendCard';
import { InsightsPanel } from '@/components/InsightsPanel';
import { InvestGlance } from '@/components/InvestGlance';
import { todayISO } from '@/lib/date';
import { monthLabel } from '@/lib/report';
import { TransactionList } from '@/components/TransactionList';
import { isNonSpendingCategory, isTransferCategory } from '@/lib/categories';
import { useT } from '@/i18n';
import type { AccountBalance } from '@/lib/summary';
import type { Transaction } from '@/lib/transactions';

interface DashboardProps {
  transactions: Transaction[];
  accounts: AccountBalance[];
  loading: boolean;
  onDelete: (tx: Transaction) => Promise<void>;
  onEdit?: (tx: Transaction) => void;
  onSeeAll: () => void;
  onSeeInsights?: () => void;
  onSeeInvest?: () => void;
  /** Buka menu navigasi penuh (tombol Lainnya). */
  onMore?: () => void;
  engagement?: Engagement;
  onSeeAchievements?: () => void;
  onConnect: () => void;
  onImport: () => void;
  onAdd: () => void;
  onTemplate: () => void;
  onSelectAccount: (account: string) => void;
  onManageAccounts: () => void;
  onReconcile?: () => void;
}

export function Dashboard({
  transactions, accounts, loading, onDelete, onEdit, onSeeAll, onSeeInsights, onSeeInvest, onMore, engagement, onSeeAchievements, onConnect, onImport, onAdd, onTemplate, onSelectAccount, onManageAccounts, onReconcile,
}: DashboardProps) {
  const { t } = useT();
  const [chartTab, setChartTab] = useState<'expense' | 'income'>('expense');
  // Transfer ikut menghitung saldo (kartu saldo dan rekening), tapi tidak tampil di daftar dan grafik kategori.
  const listed = useMemo(() => transactions.filter((t) => !isTransferCategory(t.category)), [transactions]);
  // Grafik kategori hanya untuk konsumsi: pembayaran pokok utang tampil di daftar, tapi tidak di grafik.
  const spending = useMemo(() => listed.filter((t) => !isNonSpendingCategory(t.category)), [listed]);
  // Ringkasan kategori untuk bulan berjalan, sama dengan angka pemasukan/pengeluaran di kartu saldo.
  const month = todayISO().slice(0, 7);
  const spendingMonth = useMemo(() => spending.filter((t) => t.date.startsWith(month)), [spending, month]);

  if (!transactions.length && !loading) {
    return <GettingStarted onConnect={onConnect} onImport={onImport} onAdd={onAdd} onTemplate={onTemplate} />;
  }

  const rail = 'contents lg:flex lg:min-w-0 lg:flex-col lg:gap-5';
  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_22rem]">
      {/* Mobile: urutan disusun dengan order (saldo, rekening, investasi, aman dipakai, ...). Desktop: kolom utama + kolom samping. */}
      <div className="max-lg:order-1 lg:col-span-2">
        <StatsCards transactions={transactions} />
        <QuickActions
          actions={[
            { icon: Plus, label: t('qa.record'), run: onAdd, testId: 'qa-record' },
            { icon: TrendingUp, label: t('qa.invest'), run: onSeeInvest ?? onAdd, testId: 'qa-invest' },
            { icon: Scale, label: t('qa.reconcile'), run: onReconcile ?? onAdd, testId: 'qa-reconcile' },
            { icon: MoreHorizontal, label: t('qa.more'), run: onMore ?? onAdd, testId: 'qa-more' },
          ]}
        />
      </div>

      <div className={rail}>
        <div className="max-lg:order-4">
          <SafeToSpendCard transactions={transactions} accounts={accounts.map((a) => a.account)} loading={loading} />
        </div>

        <div className="defer-render max-lg:order-6">
          <Panel title={t('shell.dashboard.daily')}>
            <DailyChart transactions={transactions} />
          </Panel>
        </div>

        <div className="defer-render grid grid-cols-1 items-start gap-5 max-lg:order-7 2xl:grid-cols-2">
          <Panel
            title={t('ux.cat.period', { month: monthLabel(month) })}
            action={
              <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5" role="group" aria-label={t('shell.type.group')}>
                <TabButton active={chartTab === 'expense'} activeColor="text-brand-600" onClick={() => setChartTab('expense')}>
                  {t('shell.type.expense')}
                </TabButton>
                <TabButton active={chartTab === 'income'} activeColor="text-emerald-600" onClick={() => setChartTab('income')}>
                  {t('shell.type.income')}
                </TabButton>
              </div>
            }
          >
            <CategoryChart transactions={spendingMonth} type={chartTab} />
          </Panel>

          <Panel
            title={t('shell.dashboard.recent')}
            action={
              <button
                onClick={onSeeAll}
                className="min-h-9 rounded-lg px-2.5 py-1 text-xs font-semibold text-brand-600 transition-colors hover:bg-rose-50"
              >
                {t('shell.dashboard.seeAll', { n: listed.length })}
              </button>
            }
          >
            <TransactionList transactions={listed} onDelete={onDelete} onEdit={onEdit} limit={6} compact />
          </Panel>
        </div>
      </div>

      <div className={rail}>
        <div className="max-lg:order-2">
          <AccountStrip accounts={accounts} onSelect={onSelectAccount} onManage={onManageAccounts} onReconcile={onReconcile} />
        </div>

        {onSeeInvest && (
          <div className="max-lg:order-3 empty:hidden">
            <InvestGlance accounts={accounts} onOpen={onSeeInvest} />
          </div>
        )}

        <div className="max-lg:order-5 empty:hidden">
          <InsightsPanel transactions={listed} month={todayISO().slice(0, 7)} max={3} hideWhenEmpty onSeeAll={onSeeInsights} />
        </div>

        {engagement && onSeeAchievements && (
          <div className="max-lg:order-8">
            <LevelChip eng={engagement} onOpen={onSeeAchievements} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Empat aksi cepat di bawah kartu saldo (HP). Desktop sudah punya tombol Catat dan sidebar. */
function QuickActions({ actions }: { actions: { icon: LucideIcon; label: string; run: () => void; testId: string }[] }) {
  const { t } = useT();
  return (
    <ul className="mt-5 grid grid-cols-4 gap-2 lg:hidden" aria-label={t('qa.label')}>
      {actions.map(({ icon: Icon, label, run, testId }) => (
        <li key={testId}>
          <button type="button" onClick={run} data-testid={testId} className="group flex w-full flex-col items-center gap-2 rounded-2xl py-1 text-center active:scale-95 transition-transform">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-card text-brand-700 shadow-card ring-1 ring-line transition-colors group-hover:bg-brand-100">
              <Icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="text-xs font-semibold text-slate-700">{label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-card sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function TabButton({
  active, activeColor, onClick, children,
}: {
  active: boolean;
  activeColor: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-8 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
        active ? `bg-card ${activeColor} shadow-sm` : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

function GettingStarted({
  onConnect, onImport, onAdd, onTemplate,
}: { onConnect: () => void; onImport: () => void; onAdd: () => void; onTemplate: () => void }) {
  const { t } = useT();
  const options = [
    {
      icon: Link2,
      title: t('shell.start.connect.title'),
      text: t('shell.start.connect.text'),
      action: onConnect,
    },
    {
      icon: FileSpreadsheet,
      title: t('shell.action.import'),
      text: t('shell.start.import.text'),
      action: onImport,
    },
    {
      icon: PencilLine,
      title: t('shell.start.manual.title'),
      text: t('shell.start.manual.text'),
      action: onAdd,
    },
  ];

  return (
    <section className="rounded-3xl border border-line bg-card p-6 sm:p-8">
      <h2 className="text-xl font-display font-bold tracking-tight text-slate-900">{t('shell.start.title')}</h2>
      <p className="mt-1 text-sm text-slate-500">{t('shell.start.subtitle')}</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {options.map(({ icon: Icon, title, text, action }) => (
          <button
            key={title}
            onClick={action}
            className="flex flex-col items-start rounded-2xl border border-line p-5 text-left transition-colors hover:border-brand hover:bg-rose-50"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white">
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="mt-3 text-sm font-bold text-slate-900">{title}</span>
            <span className="mt-1 text-xs leading-relaxed text-slate-500">{text}</span>
          </button>
        ))}
      </div>
      <button
        onClick={onTemplate}
        className="mt-5 flex items-center gap-2 rounded-lg text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
      >
        <Download className="h-4 w-4" />
        {t('shell.start.template')}
      </button>
    </section>
  );
}
