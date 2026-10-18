import { useState } from 'react';
import { useT } from '@/i18n';
import { QuickAdd } from '@/components/QuickAdd';
import { TransactionForm } from '@/components/TransactionForm';
import { ReceiptScan } from '@/components/ReceiptScan';
import type { Transaction, TransactionPayload } from '@/lib/transactions';
import type { ToastState } from '@/components/Toast';
import type { Destination } from '@/hooks/useTransactions';

const TAB_KEY = 'budgettracker.recordtab.v1';
type Tab = 'quick' | 'full' | 'scan';

function loadTab(): Tab {
  try {
    return localStorage.getItem(TAB_KEY) === 'full' ? 'full' : 'quick';
  } catch {
    return 'quick';
  }
}

interface RecordPanelProps {
  editing: Transaction | null;
  transactions: Transaction[];
  onUpdate: (tx: Transaction, next: TransactionPayload) => Promise<void>;
  sheetAvailable: boolean;
  accounts: string[];
  onManageAccounts: () => void;
  batchReady: boolean;
  onSave: (payload: TransactionPayload, destination: Destination) => Promise<void>;
  onSaveMany: (payloads: TransactionPayload[], destination: Destination) => Promise<number>;
  onToast: (t: ToastState) => void;
  onSubmitted: () => void | Promise<void>;
}

/** Isi panel "Catat transaksi": input cepat secara bawaan, form lengkap untuk transfer dan pengaturan rinci. */
export function RecordPanel(props: RecordPanelProps) {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>(loadTab);
  const full = (
    <TransactionForm
      editing={props.editing}
      onUpdate={props.onUpdate}
      sheetAvailable={props.sheetAvailable}
      accounts={props.accounts}
      onManageAccounts={props.onManageAccounts}
      batchReady={props.batchReady}
      onSave={props.onSave}
      onSaveMany={props.onSaveMany}
      onToast={props.onToast}
      onSubmitted={props.onSubmitted}
    />
  );
  if (props.editing) return full;

  function pick(next: Tab) {
    setTab(next);
    if (next === 'scan') return; // tab scan tidak jadi tab bawaan: foto selalu dipilih sengaja
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      // abaikan
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="px-6 pt-5">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label={t('quick.tab.group')}>
          {(['quick', 'full', 'scan'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => pick(k)}
              aria-pressed={tab === k}
              className={`rounded-lg py-2 text-xs font-bold transition-all ${tab === k ? 'bg-white text-brand shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {t(k === 'quick' ? 'quick.tab.quick' : k === 'full' ? 'quick.tab.full' : 'scan.tab')}
            </button>
          ))}
        </div>
      </div>
      {tab === 'quick' ? (
        <QuickAdd
          accounts={props.accounts}
          transactions={props.transactions}
          sheetAvailable={props.sheetAvailable}
          batchReady={props.batchReady}
          onSave={props.onSave}
          onSaveMany={props.onSaveMany}
          onToast={props.onToast}
          onSubmitted={props.onSubmitted}
          onManageAccounts={props.onManageAccounts}
        />
      ) : tab === 'scan' ? (
        <ReceiptScan
          accounts={props.accounts}
          transactions={props.transactions}
          sheetAvailable={props.sheetAvailable}
          onSave={props.onSave}
          onToast={props.onToast}
          onSubmitted={props.onSubmitted}
          onManageAccounts={props.onManageAccounts}
        />
      ) : (
        full
      )}
    </div>
  );
}
