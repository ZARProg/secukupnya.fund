import readExcelFile from 'read-excel-file/browser';
import writeExcelFile from 'write-excel-file/browser';
import { tr } from '@/i18n';
import type { RawSheet } from './importExcel';
import { ACCOUNT_CATALOG, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './categories';
import type { Transaction } from './transactions';
import { saveBlob } from './download';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export async function readWorkbook(file: File): Promise<RawSheet[]> {
  if (!/\.xlsx$/i.test(file.name)) {
    throw new Error(tr('importer.err.onlyXlsx'));
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(tr('importer.err.tooLarge'));
  }
  try {
    return (await readExcelFile(file)) as RawSheet[];
  } catch (err) {
    console.error('Gagal membaca file Excel:', err);
    throw new Error(tr('importer.err.unreadable'));
  }
}

// Susunan kolom sama dengan sheet Expense dan Income di Google Sheets (kolom A–E), jadi file ini
// bisa diimpor ke website, dan bisa juga ditempel langsung ke Google Sheets yang dipakai Apps Script.
const HEADER = ['Date', 'Category', 'Account/Bank', 'Description', 'Total (Rp)'];
const COLUMNS = [{ width: 14 }, { width: 18 }, { width: 18 }, { width: 38 }, { width: 16 }];
const BRAND = '#6A795D';

function headerRow() {
  return HEADER.map((value) => ({
    value,
    fontWeight: 'bold' as const,
    textColor: '#ffffff',
    backgroundColor: BRAND,
    align: 'left' as const,
  }));
}

/** yyyy-MM-dd → sel tanggal Excel (tengah malam UTC, supaya tidak bergeser sehari karena zona waktu). */
function dateCell(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return { value: new Date(Date.UTC(y, m - 1, d)), type: Date, format: 'yyyy-mm-dd', align: 'left' as const };
}

function rowFor(t: Transaction) {
  return [
    // Tanggal yang tidak terbaca ditulis apa adanya, supaya tidak hilang dari file ekspor.
    t.date ? dateCell(t.date) : (t.rawDate ?? ''),
    t.category,
    t.account,
    t.description,
    { value: t.total, type: Number, format: '#,##0' },
  ];
}

function guideSheet() {
  const bold = (value: string) => ({ value, fontWeight: 'bold' as const });
  const head = (value: string) => ({ value, fontWeight: 'bold' as const, textColor: '#ffffff', backgroundColor: BRAND });
  const banks = ACCOUNT_CATALOG.filter((a) => a.kind === 'bank').map((a) => a.name);
  const wallets = ACCOUNT_CATALOG.filter((a) => a.kind === 'ewallet').map((a) => a.name);

  const guide = tr('importer.guide.sheetName');
  const rows: unknown[][] = [
    [head(tr('importer.guide.title'))],
    [],
    [bold(tr('importer.guide.steps'))],
    [tr('importer.guide.step1')],
    [tr('importer.guide.step2')],
    [tr('importer.guide.step3')],
    [],
    [bold(tr('importer.guide.columns'))],
    ['Date', tr('importer.guide.colDate')],
    ['Category', tr('importer.guide.colCategory')],
    ['Account/Bank', tr('importer.guide.colAccount')],
    ['Description', tr('importer.guide.colDescription')],
    ['Total (Rp)', tr('importer.guide.colTotal')],
    [],
    [bold(tr('importer.guide.examples'))],
    ['Expense', tr('importer.guide.exampleExpense')],
    ['Income', tr('importer.guide.exampleIncome')],
    [],
    [bold(tr('importer.guide.expenseCategories'))],
    [EXPENSE_CATEGORIES.join(', ')],
    [bold(tr('importer.guide.incomeCategories'))],
    [INCOME_CATEGORIES.join(', ')],
    [],
    [bold(tr('importer.guide.transferTitle'))],
    [tr('importer.guide.moneyOut'), tr('importer.guide.moneyOutText')],
    [tr('importer.guide.moneyIn'), tr('importer.guide.moneyInText')],
    [tr('importer.guide.viaWebsite'), tr('importer.guide.viaWebsiteText')],
    [tr('importer.guide.notes'), tr('importer.guide.transferNote')],
    [],
    [bold(tr('importer.guide.accountChoices'))],
    ['Bank', banks.join(', ')],
    ['E-wallet', wallets.join(', ')],
    [],
    [bold(tr('importer.guide.notes'))],
    [tr('importer.guide.note1')],
    [tr('importer.guide.note2')],
    [tr('importer.guide.note3', { guide })],
  ];
  return { data: rows, sheet: guide, columns: [{ width: 16 }, { width: 100 }] };
}

/**
 * Template kosong: hanya baris judul di sheet Expense dan Income, plus sheet Panduan.
 * Sengaja tanpa baris contoh di sheet data, supaya tidak ada contoh yang ikut terimpor.
 */
export async function downloadTemplate() {
  const blob = await writeExcelFile(
    [
      { data: [headerRow()], sheet: 'Expense', columns: COLUMNS, stickyRowsCount: 1 },
      { data: [headerRow()], sheet: 'Income', columns: COLUMNS, stickyRowsCount: 1 },
      guideSheet(),
    ] as never,
  ).toBlob();
  saveBlob(blob, 'template-secukupnya.xlsx');
}

/** Ekspor semua transaksi dalam format yang sama dengan template, jadi bisa diimpor kembali. */
export async function downloadTransactions(transactions: Transaction[]) {
  // Terbaru di atas, sama seperti spreadsheet. Sort stabil: urutan input untuk tanggal yang sama dipertahankan.
  const newestFirst = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
  const expenses = newestFirst.filter((t) => t.type === 'expense').map(rowFor);
  const incomes = newestFirst.filter((t) => t.type === 'income').map(rowFor);
  const blob = await writeExcelFile(
    [
      { data: [headerRow(), ...expenses], sheet: 'Expense', columns: COLUMNS, stickyRowsCount: 1 },
      { data: [headerRow(), ...incomes], sheet: 'Income', columns: COLUMNS, stickyRowsCount: 1 },
    ] as never,
  ).toBlob();
  const stamp = new Date().toISOString().slice(0, 10);
  saveBlob(blob, `secukupnya-${stamp}.xlsx`);
}
