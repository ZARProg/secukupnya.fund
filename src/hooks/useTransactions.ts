import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  fetchTransactions,
  deleteTransaction,
  updateTransaction,
  addTransaction,
  addTransactions,
  orderForSend,
  PartialImportError,
  SheetAuthError,
  type Transaction,
  type TransactionPayload,
} from '@/lib/transactions';
import { tr } from '@/i18n';
import { loadLocal, saveLocal, createLocal } from '@/lib/localStore';
import { snapOf, type ActivityEntry, type TxSnap } from '@/lib/activity';
import { logActivity, markRestored, snapApplyOwn, syncSheetSnapshot } from '@/lib/activityStore';
import { isCreditAccount } from '@/lib/categories';

const payloadOf = (s: TxSnap): TransactionPayload => ({ ...s });
const sameSnap = (a: TxSnap, b: TxSnap) =>
  a.date === b.date && a.type === b.type && a.account === b.account && a.category === b.category && a.description === b.description && a.total === b.total;

export type Destination = 'sheet' | 'local';

export function useTransactions(sheetUrl: string) {
  const [sheetTx, setSheetTx] = useState<Transaction[]>([]);
  const [localTx, setLocalTx] = useState<Transaction[]>(() => loadLocal());
  const [sheetVersion, setSheetVersion] = useState(0);
  const [sheetLimit, setSheetLimitState] = useState<number | null>(null);
  const [sheetSecured, setSheetSecured] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(Boolean(sheetUrl));
  const [error, setError] = useState<string | null>(null);
  // Naik setiap kali isi spreadsheet ternyata berubah di luar aplikasi ini; App memakainya untuk memberi tahu pengguna.
  const [external, setExternal] = useState<{ n: number; count: number }>({ n: 0, count: 0 });

  const requestId = useRef(0);
  const loadedUrl = useRef('');
  const localRef = useRef(localTx);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;

    // Data dari spreadsheet lain tidak boleh tersisa saat URL berganti.
    if (loadedUrl.current !== sheetUrl) {
      loadedUrl.current = sheetUrl;
      setSheetTx([]);
      setSheetVersion(0);
      setSheetLimitState(null);
      setSheetSecured(false);
      setAuthRequired(false);
    }

    if (!sheetUrl) {
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await fetchTransactions(sheetUrl);
      if (id !== requestId.current) return;
      setSheetTx(result.transactions);
      setSheetVersion(result.version);
      setSheetLimitState(result.dailyLimit);
      setSheetSecured(result.secured);
      setAuthRequired(false);
      setError(null);
      const outside = syncSheetSnapshot(sheetUrl, result.transactions);
      if (outside.length) setExternal((e) => ({ n: e.n + 1, count: outside.length }));
    } catch (err) {
      if (id !== requestId.current) return;
      console.error('Error fetching transactions:', err);
      setAuthRequired(err instanceof SheetAuthError);
      setError(err instanceof Error ? err.message : tr('forms.err.loadFailed'));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [sheetUrl]);

  useEffect(() => {
    // Data lama dari versi sebelumnya tidak dipakai lagi.
    localStorage.removeItem('budgettracker_transactions');
    refresh();
  }, [refresh]);

  const commitLocal = useCallback((next: Transaction[]) => {
    saveLocal(next); // melempar error kalau gagal, sebelum state berubah
    localRef.current = next;
    setLocalTx(next);
  }, []);

  const transactions = useMemo(() => {
    // sheetTx sudah terurut sesuai aturan versi script-nya; urutan itu dipertahankan.
    const sheetRank = new Map(sheetTx.map((t, i) => [t.id + t.type, i]));
    return [...sheetTx, ...localTx].sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate) return byDate;
      if (a.source !== b.source) return a.source === 'local' ? -1 : 1;
      if (a.source === 'sheet') return (sheetRank.get(a.id + a.type) ?? 0) - (sheetRank.get(b.id + b.type) ?? 0);
      return b.row - a.row;
    });
  }, [sheetTx, localTx]);

  const addOne = useCallback(
    async (payload: TransactionPayload, destination: Destination) => {
      if (destination === 'sheet') {
        await addTransaction(sheetUrl, payload);
        snapApplyOwn(sheetUrl, [snapOf(payload)], []);
        logActivity([{ action: 'create', source: 'sheet', after: snapOf(payload) }]);
        await refresh();
      } else {
        commitLocal([...localRef.current, ...createLocal([payload])]);
        logActivity([{ action: 'create', source: 'local', after: snapOf(payload) }]);
      }
    },
    [sheetUrl, refresh, commitLocal],
  );

  const importTransactions = useCallback(
    async (
      payloads: TransactionPayload[],
      destination: Destination,
      onProgress?: (done: number, total: number) => void,
    ): Promise<number> => {
      // Satu entri ringkasan per impor (bukan satu per baris) supaya riwayat tidak membengkak.
      const log = (list: TransactionPayload[], source: 'sheet' | 'local') => {
        if (!list.length) return;
        // Transfer dan Debt Payment tetap menggerakkan saldo, jadi ikut dihitung di dampak saldo.
        let income = 0;
        let expense = 0;
        for (const p of list) {
          if (isCreditAccount(p.account)) continue;
          if (p.type === 'income') income += p.total;
          else expense += p.total;
        }
        logActivity([{ action: 'import', source, count: list.length, income, expense }]);
      };
      if (destination === 'local') {
        commitLocal([...localRef.current, ...createLocal(payloads)]);
        log(payloads, 'local');
        return payloads.length;
      }
      let done = 0;
      try {
        done = await addTransactions(sheetUrl, payloads, onProgress);
        return done;
      } catch (err) {
        // Impor berhenti di tengah: baris yang sudah masuk tetap dicatat dan tidak dianggap perubahan luar.
        if (err instanceof PartialImportError) done = err.imported;
        throw err;
      } finally {
        const sent = orderForSend(payloads).slice(0, done);
        snapApplyOwn(sheetUrl, sent.map(snapOf), []);
        log(sent, 'sheet');
        await refresh();
      }
    },
    [sheetUrl, refresh, commitLocal],
  );

  const deleteTx = useCallback(
    async (tx: Transaction) => {
      const before = snapOf(tx);
      if (tx.source === 'local') {
        commitLocal(localRef.current.filter((t) => t.id !== tx.id));
        logActivity([{ action: 'delete', source: 'local', before }]);
        return;
      }
      await deleteTransaction(sheetUrl, tx);
      snapApplyOwn(sheetUrl, [], [before]);
      logActivity([{ action: 'delete', source: 'sheet', before }]);
      await refresh();
    },
    [sheetUrl, refresh, commitLocal],
  );

  const updateTx = useCallback(
    async (tx: Transaction, next: TransactionPayload) => {
      const before = snapOf(tx);
      const after = snapOf(next);
      if (tx.source === 'local') {
        commitLocal(
          localRef.current.map((t) => (t.id === tx.id ? { ...t, ...next, rawDate: undefined } : t)),
        );
        logActivity([{ action: 'update', source: 'local', before, after }]);
        return;
      }
      await updateTransaction(sheetUrl, tx, next);
      snapApplyOwn(sheetUrl, [after], [before]);
      logActivity([{ action: 'update', source: 'sheet', before, after }]);
      await refresh();
    },
    [sheetUrl, refresh, commitLocal],
  );

  /**
   * Pulihkan dari riwayat: transaksi yang dihapus ditambahkan lagi, perubahan diedit dikembalikan ke nilai sebelumnya.
   * Untuk Sheets, pemulihan hanya jalan kalau spreadsheet tersambung; transaksi yang sudah berubah lagi tidak ditimpa diam-diam.
   */
  const restoreEntry = useCallback(
    async (entry: ActivityEntry) => {
      if (entry.restoredAt) throw new Error(tr('activity.err.already'));
      const source = entry.source;
      if (source === 'sheet' && !sheetUrl) throw new Error(tr('activity.err.noSheet'));
      const isDelete = entry.action === 'delete' || entry.action === 'external_remove';
      const isUpdate = entry.action === 'update' || entry.action === 'external_update';
      if (isDelete && entry.before) {
        const p = payloadOf(entry.before);
        if (source === 'local') {
          commitLocal([...localRef.current, ...createLocal([p])]);
        } else {
          await addTransaction(sheetUrl, p);
          snapApplyOwn(sheetUrl, [entry.before], []);
        }
        logActivity([{ action: 'restore', source, restores: 'delete', after: entry.before }]);
        markRestored(entry.id);
        if (source === 'sheet') await refresh();
        return;
      }
      if (isUpdate && entry.before && entry.after) {
        const now = entry.after;
        const pool = source === 'local' ? localRef.current : sheetTx;
        const current = pool.find((t) => sameSnap(snapOf(t), now));
        if (!current) throw new Error(tr('activity.err.notFound'));
        const target = payloadOf(entry.before);
        if (source === 'local') {
          commitLocal(localRef.current.map((t) => (t.id === current.id ? { ...t, ...target, rawDate: undefined } : t)));
        } else {
          await updateTransaction(sheetUrl, current, target);
          snapApplyOwn(sheetUrl, [entry.before], [now]);
        }
        logActivity([{ action: 'restore', source, restores: 'update', before: now, after: entry.before }]);
        markRestored(entry.id);
        if (source === 'sheet') await refresh();
        return;
      }
      throw new Error(tr('activity.err.cannot'));
    },
    [sheetUrl, sheetTx, refresh, commitLocal],
  );

  const clearLocal = useCallback(() => {
    const all = localRef.current;
    commitLocal([]);
    if (!all.length) return;
    let income = 0;
    let expense = 0;
    for (const t of all) {
      if (isCreditAccount(t.account)) continue;
      if (t.type === 'income') income += t.total;
      else expense += t.total;
    }
    logActivity([{ action: 'delete', source: 'local', count: all.length, income, expense }]);
  }, [commitLocal]);

  return {
    transactions,
    sheetTransactions: sheetTx,
    localTransactions: localTx,
    sheetVersion,
    sheetLimit,
    loading,
    error,
    refresh,
    deleteTx,
    updateTx,
    addOne,
    importTransactions,
    clearLocal,
    restoreEntry,
    external,
    sheetSecured,
    authRequired,
  };
}
