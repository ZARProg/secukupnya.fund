import { getEntries } from '@/lib/activityStore';
import { ReconcileDialog } from '@/components/ReconcileDialog';
import { readSafeSettings } from '@/hooks/useSafeSettings';
import type { TransactionPayload } from '@/lib/transactions';
import { Suspense, useState, useCallback, useEffect, useMemo } from 'react';
import { Menu, Plus, TriangleAlert, Wallet } from 'lucide-react';
import { Sidebar, type View } from '@/components/Sidebar';
import { SlideOver } from '@/components/SlideOver';
import { todayISO } from '@/lib/date';
import { PickAccountsBanner } from '@/components/PickAccountsBanner';
import { DueBanner } from '@/components/DueBanner';
import { usePlans } from '@/hooks/usePlans';
import { useBudgets } from '@/hooks/useBudgets';
import { dueRules, monthKey, type Recurring } from '@/lib/plans';
import { RecordPanel } from '@/components/RecordPanel';
import { SecurityBanner } from '@/components/SecurityBanner';
import { DebtDueBanner } from '@/components/DebtDueBanner';
import { Dashboard } from '@/components/Dashboard';
import {
  AchievementsPage, ActivityPage, BudgetsPage, CalendarPage, ConflictsPage, DebtsPage, GoalsPage, ImportPanel, NetWorthPage,
  PlansPage, RecapPage, ReportPage, RulesPage, SettingsPage, SourcesPage, TransactionsPage,
} from '@/components/pages';
import { PageFallback } from '@/components/PageFallback';
import { PwaStatus } from '@/components/PwaStatus';
import { Toast, ToastState } from '@/components/Toast';
import { useEngagement } from '@/hooks/useEngagement';
import { BADGE_EMOJI } from '@/lib/engage';
import { useTransactions, type Destination } from '@/hooks/useTransactions';
import { findCrossDuplicates, loadIgnored, saveIgnored } from '@/lib/crossSource';
import { clearSheetToken, clearSheetUrl, getSheetUrl, isUrlFromEnv, saveSheetToken, saveSheetUrl } from '@/lib/config';
import { loadAccounts, saveAccounts } from '@/lib/accounts';
import { accountBalances } from '@/lib/summary';
import { isTransferCategory } from '@/lib/categories';
import { fetchTransactions, EDIT_VERSION, LIMIT_SYNC_VERSION, MIN_BATCH_VERSION, setSheetLimit, type Transaction } from '@/lib/transactions';
import { useDailyLimit } from '@/hooks/useDailyLimit';
import { locale, useT } from '@/i18n';
import { rich } from '@/i18n/rich';

type Panel = 'none' | 'form' | 'import';

function App() {
  const { t, tp } = useT();
  const [view, setView] = useState<View>('overview');
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [startingSet, setStartingSet] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>('none');
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [account, setAccount] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [sheetUrl, setSheetUrl] = useState(() => getSheetUrl());
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(() => loadAccounts());

  const {
    transactions, sheetTransactions, localTransactions, sheetVersion, sheetLimit, loading, error,
    refresh, deleteTx, updateTx, addOne, importTransactions, clearLocal, restoreEntry, external, sheetSecured, authRequired,
  } = useTransactions(sheetUrl);

  // Transfer ikut menghitung saldo rekening, tapi tidak tampil di daftar transaksi.
  const listedTransactions = useMemo(
    () => transactions.filter((t) => !isTransferCategory(t.category)),
    [transactions],
  );
  // Filter transaksi tetap bisa menjangkau rekening yang sudah tidak dipilih tapi masih punya riwayat.
  const filterAccounts = useMemo(
    () => Array.from(new Set([...selectedAccounts, ...transactions.map((t) => t.account).filter(Boolean)])),
    [selectedAccounts, transactions],
  );
  const balances = useMemo(() => accountBalances(transactions, selectedAccounts), [transactions, selectedAccounts]);
  const undated = useMemo(() => transactions.filter((t) => !t.date), [transactions]);
  const accountUsage = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tx of transactions) if (tx.account) counts[tx.account] = (counts[tx.account] ?? 0) + 1;
    return counts;
  }, [transactions]);
  const sheetConnected = Boolean(sheetUrl);
  const sheetReady = sheetConnected && !loading && !error && sheetVersion >= MIN_BATCH_VERSION;

  // Batas harian: kalau pengguna belum mengaturnya di browser ini, pakai yang tersimpan di spreadsheet.
  const { isStored: limitStored, adopt: adoptLimit, limit: dailyLimit } = useDailyLimit();
  useEffect(() => {
    if (!limitStored && sheetLimit && sheetVersion >= LIMIT_SYNC_VERSION) adoptLimit(sheetLimit);
  }, [limitStored, sheetLimit, sheetVersion, adoptLimit]);

  const showToast = useCallback((t: ToastState) => setToast(t), []);
  const notify = useCallback((kind: ToastState['kind'], message: string) => setToast({ kind, message }), []);
  const dismissToast = useCallback(() => setToast(null), []);

  // Spreadsheet ternyata diubah di luar aplikasi: beri tahu, rinciannya ada di Riwayat.
  useEffect(() => {
    if (external.n > 0) showToast({ kind: 'success', message: tp('activity.external.toast', external.count) });
  }, [external, showToast, tp]);

  // Duplikat lintas sumber (browser vs Sheets). Pasangan yang diabaikan pengguna tidak dihitung lagi.
  const [ignoredDup, setIgnoredDup] = useState<Set<string>>(loadIgnored);
  const crossDups = useMemo(
    () => findCrossDuplicates(localTransactions, sheetTransactions, ignoredDup),
    [localTransactions, sheetTransactions, ignoredDup],
  );
  const ignoreDup = useCallback((key: string) => {
    setIgnoredDup((prev) => {
      const next = new Set(prev).add(key);
      saveIgnored(next);
      return next;
    });
  }, []);
  const unignoreAllDup = useCallback(() => {
    setIgnoredDup(new Set());
    saveIgnored(new Set());
  }, []);

  const { goals } = usePlans();
  const { budgets } = useBudgets();
  const engagement = useEngagement({ transactions: listedTransactions, goals, budgets, limit: dailyLimit, ready: !loading });
  const { fresh: freshBadges, clearFresh } = engagement;
  // Pemberitahuan lencana menunggu toast aksi yang sedang tampil (mis. "berhasil diimpor") selesai, supaya tidak saling menimpa.
  useEffect(() => {
    if (!freshBadges.length || toast) return;
    const timer = setTimeout(() => {
      const names = freshBadges.map((b) => `${BADGE_EMOJI[b]} ${t(`badge.${b}.name`)}`).join(', ');
      setToast({ kind: 'success', message: t('ach.toast.badge', { name: names }) });
      clearFresh();
    }, 800);
    return () => clearTimeout(timer);
  }, [freshBadges, toast, clearFresh, t]);
  const closeNav = useCallback(() => setNavOpen(false), []);
  const closePanel = useCallback(() => {
    setPanel('none');
    setEditing(null);
  }, []);
  const openPanel = useCallback((next: Panel) => {
    setNavOpen(false);
    setEditing(null);
    setPanel(next);
  }, []);

  // Pintasan: tekan N (di luar kolom isian) untuk membuka pencatatan cepat.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      openPanel('form');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openPanel]);

  const navigate = useCallback((next: View) => {
    setView(next);
    setNavOpen(false);
    window.scrollTo(0, 0);
  }, []);

  const selectAccount = useCallback((name: string) => {
    setAccount((prev) => (prev === name ? '' : name));
    setView('transactions');
    setNavOpen(false);
    window.scrollTo(0, 0);
  }, []);

  const handleDelete = useCallback(async (tx: Transaction) => {
    try {
      await deleteTx(tx);
      // Entri riwayat yang baru dibuat oleh hapus ini; dipakai tombol Urungkan (pemulihan yang sama dengan di Riwayat).
      const entry = [...getEntries()].reverse().find((e) => e.action === 'delete' && !e.restoredAt);
      showToast({
        kind: 'success',
        message: tx.source === 'local' ? t('shell.app.toast.deletedLocal') : t('shell.app.toast.deletedSheet'),
        action: entry
          ? {
              label: t('toast.undo'),
              run: () => {
                restoreEntry(entry).then(
                  () => showToast({ kind: 'success', message: t('toast.undone') }),
                  (err) => showToast({ kind: 'error', message: err instanceof Error ? err.message : t('shell.app.toast.deleteFailed') }),
                );
              },
            }
          : undefined,
      });
    } catch (err) {
      console.error('Error deleting transaction:', err);
      showToast({ kind: 'error', message: err instanceof Error ? err.message : t('shell.app.toast.deleteFailed') });
    }
  }, [deleteTx, restoreEntry, showToast, t]);

  const { recurring, markDone } = usePlans();
  const due = dueRules(recurring, todayISO());

  const handleRecordDue = useCallback(async (rule: Recurring, date: string) => {
    try {
      await addOne(
        { date, type: rule.type, category: rule.category, account: rule.account, description: rule.description, total: rule.total },
        sheetConnected ? 'sheet' : 'local',
      );
      markDone(rule.id, monthKey(date));
      showToast({ kind: 'success', message: t('due.toast.recorded', { name: rule.description }) });
    } catch (err) {
      console.error('Gagal mencatat transaksi berulang:', err);
      showToast({ kind: 'error', message: t('due.toast.failed') });
    }
  }, [addOne, sheetConnected, markDone, showToast, t]);

  const handleReconcile = useCallback(async (payloads: TransactionPayload[]) => {
    for (const p of payloads) await addOne(p, sheetConnected ? 'sheet' : 'local');
    setReconcileOpen(false);
    showToast({ kind: 'success', message: t('recon.toast', { n: payloads.length }) });
  }, [addOne, sheetConnected, showToast, t]);

  const handleSkipDue = useCallback((rule: Recurring) => {
    markDone(rule.id, monthKey(todayISO()));
    showToast({ kind: 'success', message: t('due.toast.skipped', { name: rule.description }) });
  }, [markDone, showToast, t]);

  const handleEdit = useCallback((tx: Transaction) => {
    if (tx.source === 'sheet' && sheetVersion < EDIT_VERSION) {
      showToast({ kind: 'error', message: t('edit.toast.needScript') });
      return;
    }
    setNavOpen(false);
    setEditing(tx);
    setPanel('form');
  }, [sheetVersion, showToast, t]);

  // Coba dulu sebelum disimpan, supaya URL yang salah tidak pernah tersimpan.
  const handleConnect = useCallback(async (url: string, token: string) => {
    const result = await fetchTransactions(url, token);
    saveSheetUrl(url);
    saveSheetToken(token); // kosong = hapus token lama, supaya token milik sheet lain tidak terkirim ke sheet ini
    setAccount('');
    setSheetUrl(url);
    return result.transactions.length;
  }, []);

  const handleSaveToken = useCallback(async (token: string) => {
    // Diperiksa dulu ke script: token yang salah tidak boleh tersimpan dan dianggap berhasil.
    await fetchTransactions(sheetUrl, token);
    saveSheetToken(token);
    await refresh();
    notify('success', t('sec.toast.saved'));
  }, [sheetUrl, refresh, notify, t]);

  const handleRemoveToken = useCallback(() => {
    clearSheetToken();
    void refresh();
    notify('success', t('sec.toast.removed'));
  }, [refresh, notify, t]);

  const handleDisconnect = useCallback(() => {
    clearSheetUrl();
    clearSheetToken();
    setSheetUrl(getSheetUrl());
    notify('success', t('shell.app.toast.disconnected'));
  }, [notify, t]);

  const handleExport = useCallback(async () => {
    if (!transactions.length) {
      notify('error', t('shell.app.toast.exportEmpty'));
      return;
    }
    try {
      const { downloadTransactions } = await import('@/lib/excelFile');
      await downloadTransactions(transactions);
    } catch (err) {
      console.error('Export gagal:', err);
      notify('error', t('shell.app.toast.exportFailed'));
    }
  }, [transactions, notify, t]);

  const handleTemplate = useCallback(async () => {
    try {
      const { downloadTemplate } = await import('@/lib/excelFile');
      await downloadTemplate();
    } catch (err) {
      console.error('Template gagal dibuat:', err);
      notify('error', t('shell.app.toast.templateFailed'));
    }
  }, [notify, t]);

  // Kirim batas harian yang baru ke spreadsheet supaya popup di sana ikut. Gagal kirim tidak membatalkan
  // pengaturan di browser ini.
  const handleLimitChange = useCallback(
    async (value: number) => {
      if (!sheetUrl || sheetVersion < LIMIT_SYNC_VERSION) return;
      try {
        await setSheetLimit(sheetUrl, value);
      } catch (err) {
        console.error('Gagal mengirim batas harian:', err);
        notify('error', t('shell.app.toast.limitFailed'));
      }
    },
    [sheetUrl, sheetVersion, notify, t],
  );

  const handleAccountsChange = useCallback((names: string[]) => {
    setSelectedAccounts(names);
    saveAccounts(names);
  }, []);

  const manageAccounts = useCallback(() => {
    setPanel('none');
    setNavOpen(false);
    setView('sources');
    window.scrollTo(0, 0);
    // Tunggu halaman Sumber data tampil, baru gulir ke kartu bank dan e-wallet.
    setTimeout(() => document.getElementById('rekening')?.scrollIntoView({ block: 'start' }), 60);
  }, []);

  const handleImportDone = useCallback((count: number, destination: Destination) => {
    setPanel('none');
    setView('transactions');
    window.scrollTo(0, 0);
    notify('success', tp('shell.app.toast.imported', count, {
      dest: destination === 'sheet' ? t('shell.app.dest.sheet') : t('shell.app.dest.local'),
    }));
  }, [notify, t, tp]);

  const heading =
    view === 'overview'
      ? {
          title: t('shell.nav.overview'),
          subtitle: new Date().toLocaleDateString(locale(), {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          }),
        }
      : view === 'transactions'
        ? { title: t('shell.nav.transactions'), subtitle: t('shell.app.subtitle.transactions') }
        : view === 'budgets'
          ? { title: t('nav.budgets'), subtitle: t('budgets.subtitle') }
          : view === 'goals'
            ? { title: t('nav.goals'), subtitle: t('goals.page.subtitle') }
            : view === 'report'
          ? { title: t('shell.nav.report'), subtitle: t('shell.app.subtitle.report') }
          : view === 'calendar'
            ? { title: t('nav.calendar'), subtitle: t('cal.subtitle') }
            : view === 'plans'
              ? { title: t('nav.plans'), subtitle: t('plans.subtitle') }
              : view === 'debts'
                ? { title: t('debt.title'), subtitle: t('debt.subtitle') }
                : view === 'networth'
                  ? { title: t('nw.title'), subtitle: t('nw.subtitle') }
                : view === 'conflicts'
                  ? { title: t('conflicts.title'), subtitle: t('conflicts.subtitle') }
                : view === 'rules'
                  ? { title: t('rules.title'), subtitle: t('rules.subtitle') }
                  : view === 'activity'
                    ? { title: t('activity.title'), subtitle: t('activity.subtitle') }
                    : view === 'achievements'
                      ? { title: t('ach.title'), subtitle: t('ach.subtitle') }
                      : view === 'recap'
                        ? { title: t('recap.title'), subtitle: t('recap.subtitle') }
                        : view === 'settings'
                          ? { title: t('set.title'), subtitle: t('set.subtitle') }
                          : { title: t('shell.nav.sources'), subtitle: t('shell.app.subtitle.sources') };

  return (
    <div className="min-h-screen bg-paper text-slate-900">
      {reconcileOpen && (
        <ReconcileDialog
          accounts={balances}
          toSheet={sheetConnected}
          startingBalanceSet={startingSet}
          onClose={() => setReconcileOpen(false)}
          onSave={handleReconcile}
        />
      )}
      <Toast toast={toast} onDismiss={dismissToast} />

      <Sidebar
        open={navOpen}
        view={view}
        accounts={balances}
        activeAccount={account}
        connected={sheetConnected}
        loading={loading}
        error={error}
        conflictCount={crossDups.length}
        onNavigate={navigate}
        onSelectAccount={selectAccount}
        onManageAccounts={manageAccounts}
        onTemplate={handleTemplate}
        onNewTransaction={() => openPanel('form')}
        onImport={() => openPanel('import')}
        onRefresh={refresh}
        onClose={closeNav}
      />

      <div className="lg:pl-72">
        {/* Top bar (mobile only) */}
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-paper/90 px-4 py-3 backdrop-blur-md lg:hidden">
          <button
            onClick={() => setNavOpen(true)}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
            aria-label={t('shell.app.openMenu')}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-white">
              <Wallet className="h-4 w-4" />
            </span>
            <span className="font-display text-base font-bold tracking-tight">Secukupnya.fund</span>
          </div>
        </div>

        <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-8 sm:pt-10 lg:pb-10">
          <header className="mb-6 sm:mb-8">
            <h1 className="font-display text-[1.75rem] font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">{heading.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{heading.subtitle}</p>
          </header>

          {error && view !== 'sources' && (
            <div
              role="alert"
              className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <span>{t('shell.app.errorBanner', { error })}</span>
              <div className="flex gap-2">
                <button
                  onClick={refresh}
                  className="rounded-lg border border-red-200 bg-card px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  {t('shell.app.retry')}
                </button>
                <button
                  onClick={() => navigate('sources')}
                  className="rounded-lg border border-red-200 bg-card px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  {t('shell.nav.sources')}
                </button>
              </div>
            </div>
          )}

          {undated.length > 0 && view !== 'sources' && (
            <div
              role="alert"
              className="mb-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="leading-relaxed">
                {rich(tp('shell.app.undated.lead', undated.length), { b: (c) => <strong>{c}</strong> })}
                {undated[0].rawDate
                  ? rich(t('shell.app.undated.example'), {
                      c: () => <code className="rounded bg-amber-100 px-1">{undated[0].rawDate}</code>,
                    })
                  : null}
                {t('shell.app.undated.tail', { group: t('shell.list.undatedDay') })}
              </p>
            </div>
          )}

          <Suspense fallback={<PageFallback />}>
          {view === 'overview' && selectedAccounts.length === 0 && <PickAccountsBanner onPick={manageAccounts} />}
          {view === 'overview' && <DueBanner due={due} onRecord={handleRecordDue} onSkip={handleSkipDue} />}
          {view === 'overview' && sheetUrl && !loading && !error && sheetVersion > 0 && !sheetSecured && (
            <SecurityBanner url={sheetUrl} onOpen={() => navigate('sources')} />
          )}
          {view === 'overview' && crossDups.length > 0 && (
            <section role="status" className="mb-5 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4" data-testid="conflict-banner">
              <p className="min-w-0 flex-1 text-sm font-medium text-amber-900">{tp('conflicts.banner', crossDups.length)}</p>
              <button onClick={() => navigate('conflicts')} className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white">{t('conflicts.banner.action')}</button>
            </section>
          )}
          {view === 'overview' && <DebtDueBanner onOpen={() => setView('debts')} />}
          {view === 'overview' && (
            <Dashboard
              transactions={transactions}
              accounts={balances}
              onTemplate={handleTemplate}
              onSelectAccount={selectAccount}
              onManageAccounts={manageAccounts}
              onReconcile={() => { setStartingSet(readSafeSettings().adjust !== 0); setReconcileOpen(true); }}
              loading={loading}
              onDelete={handleDelete}
              onEdit={handleEdit}
              engagement={engagement}
              onSeeAchievements={() => navigate('achievements')}
              onSeeInsights={() => navigate('report')}
              onSeeAll={() => navigate('transactions')}
              onConnect={() => navigate('sources')}
              onImport={() => openPanel('import')}
              onAdd={() => openPanel('form')}
            />
          )}
          {view === 'transactions' && (
            <TransactionsPage
              transactions={listedTransactions}
              accounts={filterAccounts}
              onDelete={handleDelete}
              onEdit={handleEdit}
              account={account}
              onAccountChange={setAccount}
            />
          )}
          {view === 'calendar' && <CalendarPage transactions={listedTransactions} onRecord={handleRecordDue} onSkip={handleSkipDue} />}
          {view === 'plans' && <PlansPage accounts={selectedAccounts} />}
          {view === 'goals' && <GoalsPage />}
          {view === 'budgets' && <BudgetsPage transactions={listedTransactions} />}
          {view === 'networth' && <NetWorthPage balances={balances} transactions={transactions} ready={!loading} onToast={showToast} />}
          {view === 'debts' && (
            <DebtsPage
              accounts={selectedAccounts}
              sheetAvailable={sheetConnected}
              batchReady={sheetReady}
              onSave={addOne}
              onSaveMany={importTransactions}
              onToast={showToast}
            />
          )}
          {view === 'rules' && <RulesPage transactions={listedTransactions} onToast={showToast} />}
          {view === 'conflicts' && (
            <ConflictsPage
              pairs={crossDups}
              ignoredCount={ignoredDup.size}
              onIgnore={ignoreDup}
              onUnignoreAll={unignoreAllDup}
              onDelete={deleteTx}
              onToast={showToast}
            />
          )}
          {view === 'activity' && <ActivityPage onRestore={restoreEntry} onToast={showToast} />}
          {view === 'achievements' && <AchievementsPage eng={engagement} />}
          {view === 'recap' && <RecapPage transactions={listedTransactions} eng={engagement} onToast={notify} />}
          {view === 'report' && <ReportPage transactions={listedTransactions} />}
          {view === 'settings' && <SettingsPage onToast={showToast} />}
          {view === 'sources' && (
            <SourcesPage
              sheetUrl={sheetUrl}
              urlFromEnv={isUrlFromEnv(sheetUrl)}
              sheetVersion={sheetVersion}
              loading={loading}
              error={error}
              sheetCount={sheetTransactions.length}
              localCount={localTransactions.length}
              selectedAccounts={selectedAccounts}
              accountUsage={accountUsage}
              onChangeAccounts={handleAccountsChange}
              onTemplate={handleTemplate}
              onLimitChange={handleLimitChange}
              onConnect={handleConnect}
              sheetSecured={sheetSecured}
              authRequired={authRequired}
              onSaveToken={handleSaveToken}
              onRemoveToken={handleRemoveToken}
              onDisconnect={handleDisconnect}
              onClearLocal={clearLocal}
              onImport={() => openPanel('import')}
              onExport={handleExport}
              onNotify={notify}
            />
          )}
          </Suspense>
        </main>
      </div>

      <button
        onClick={() => openPanel('form')}
        className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg transition-colors hover:bg-brand-dark lg:hidden"
        aria-label={t('shell.action.record')}
      >
        <Plus className="h-6 w-6" />
      </button>

      <SlideOver open={panel === 'form'} title={editing ? t('edit.title') : t('shell.action.record')} onClose={closePanel}>
        <RecordPanel
          editing={editing}
          transactions={transactions}
          onUpdate={updateTx}
          sheetAvailable={sheetConnected}
          accounts={selectedAccounts}
          onManageAccounts={manageAccounts}
          batchReady={sheetReady}
          onSave={addOne}
          onSaveMany={importTransactions}
          onToast={showToast}
          onSubmitted={closePanel}
        />
      </SlideOver>

      <SlideOver open={panel === 'import'} title={t('shell.action.import')} onClose={closePanel} wide>
        <Suspense fallback={<PageFallback />}>
        <ImportPanel
          sheetConnected={sheetConnected}
          sheetLoading={loading}
          sheetError={error}
          sheetReady={sheetReady}
          sheetTransactions={sheetTransactions}
          localTransactions={localTransactions}
          onImport={importTransactions}
          onDone={handleImportDone}
          onGoToSources={() => {
            setPanel('none');
            navigate('sources');
          }}
        />
        </Suspense>
      </SlideOver>
      <PwaStatus />
    </div>
  );
}

export default App;
