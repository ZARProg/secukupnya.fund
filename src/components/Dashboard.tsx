import { useMemo, useState, type ReactNode } from 'react';
import { Download, FileSpreadsheet, Link2, PencilLine } from 'lucide-react';
import { AccountStrip } from '@/components/AccountStrip';
import { StatsCards } from '@/components/StatsCards';
import { DailyChart } from '@/components/DailyChart';
import { CategoryChart } from '@/components/CategoryChart';
import { LevelChip } from '@/components/LevelChip';
import type { Engagement } from '@/hooks/useEngagement';
import { SafeToSpendCard } from '@/components/SafeToSpendCard';
import { InsightsPanel } from '@/components/InsightsPanel';
import { todayISO } from '@/lib/date';
import { TransactionList } from '@/components/TransactionList';
import { isDebtPaymentCategory, isTransferCategory } from '@/lib/categories';
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
  engagement?: Engagement;
  onSeeAchievements?: () => void;
  onConnect: () => void;
  onImport: () => void;
  onAdd: () => void;
  onTemplate: () => void;
  onSelectAccount: (account: string) => void;
  onManageAccounts: () => void;
}

export function Dashboard({
  transactions, accounts, loading, onDelete, onEdit, onSeeAll, onSeeInsights, engagement, onSeeAchievements, onConnect, onImport, onAdd, onTemplate, onSelectAccount, onManageAccounts,
}: DashboardProps) {
  const { t } = useT();
  const [chartTab, setChartTab] = useState<'expense' | 'income'>('expense');
  // Transfer ikut menghitung saldo (kartu saldo dan rekening), tapi tidak tampil di daftar dan grafik kategori.
  const listed = useMemo(() => transactions.filter((t) => !isTransferCategory(t.category)), [transactions]);
  // Grafik kategori hanya untuk konsumsi: pembayaran pokok utang tampil di daftar, tapi tidak di grafik.
  const spending = useMemo(() => listed.filter((t) => !isDebtPaymentCategory(t.category)), [listed]);

  if (!transactions.length && !loading) {
    return <GettingStarted onConnect={onConnect} onImport={onImport} onAdd={onAdd} onTemplate={onTemplate} />;
  }

  return (
    <div className="space-y-5">
      <div className="rise">
        <StatsCards transactions={transactions} />
      </div>

      <div className="rise" style={{ animationDelay: '60ms' }}>
        <AccountStrip accounts={accounts} onSelect={onSelectAccount} onManage={onManageAccounts} />
      </div>

      <div className="rise" style={{ animationDelay: '75ms' }}>
        <SafeToSpendCard transactions={transactions} accounts={accounts.map((a) => a.account)} />
      </div>

      {engagement && onSeeAchievements && (
        <div className="rise" style={{ animationDelay: '82ms' }}>
          <LevelChip eng={engagement} onOpen={onSeeAchievements} />
        </div>
      )}

      <div className="rise" style={{ animationDelay: '90ms' }}>
        <InsightsPanel transactions={listed} month={todayISO().slice(0, 7)} max={3} hideWhenEmpty onSeeAll={onSeeInsights} />
      </div>

      <div className="rise" style={{ animationDelay: '120ms' }}>
        <Panel title={t('shell.dashboard.daily')}>
          <DailyChart transactions={transactions} />
        </Panel>
      </div>

      <div className="rise grid grid-cols-1 gap-5 lg:grid-cols-2" style={{ animationDelay: '180ms' }}>
        <Panel
          title={t('shell.dashboard.byCategory')}
          action={
            <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5" role="group" aria-label={t('shell.type.group')}>
              <TabButton active={chartTab === 'expense'} activeColor="text-brand" onClick={() => setChartTab('expense')}>
                {t('shell.type.expense')}
              </TabButton>
              <TabButton active={chartTab === 'income'} activeColor="text-emerald-600" onClick={() => setChartTab('income')}>
                {t('shell.type.income')}
              </TabButton>
            </div>
          }
        >
          <CategoryChart transactions={spending} type={chartTab} />
        </Panel>

        <Panel
          title={t('shell.dashboard.recent')}
          action={
            <button
              onClick={onSeeAll}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-brand transition-colors hover:bg-rose-50"
            >
              {t('shell.dashboard.seeAll', { n: listed.length })}
            </button>
          }
        >
          <TransactionList transactions={listed} onDelete={onDelete} onEdit={onEdit} limit={6} />
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="whitespace-nowrap text-base font-bold tracking-tight text-slate-900">{title}</h2>
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
      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
        active ? `bg-white ${activeColor} shadow-sm` : 'text-slate-500 hover:text-slate-700'
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
    <section className="rounded-3xl border border-line bg-white p-6 sm:p-8">
      <h2 className="text-xl font-extrabold tracking-tight text-slate-900">{t('shell.start.title')}</h2>
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
        className="mt-5 flex items-center gap-2 rounded-lg text-sm font-semibold text-brand transition-colors hover:text-brand-dark"
      >
        <Download className="h-4 w-4" />
        {t('shell.start.template')}
      </button>
    </section>
  );
}
