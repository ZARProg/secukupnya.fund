import { BALANCE_ADJUST_CATEGORY } from './categories';
import { todayISO } from './date';
import type { TransactionPayload } from './transactions';

/** Selisih = saldo asli − saldo di aplikasi. Positif: aplikasi kurang (pemasukan), negatif: aplikasi lebih (pengeluaran). */
export function adjustmentPayload(account: string, diff: number, asReal: boolean, description: string, date = todayISO()): TransactionPayload {
  return {
    date,
    type: diff > 0 ? 'income' : 'expense',
    category: asReal ? 'Others' : BALANCE_ADJUST_CATEGORY,
    account,
    description,
    total: Math.abs(diff),
  };
}
