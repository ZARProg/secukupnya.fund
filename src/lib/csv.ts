import { saveBlob } from './download';
import type { Transaction } from './transactions';

const HEADER = ['Date', 'Type', 'Category', 'Account', 'Description', 'Total (Rp)'];

/**
 * Teks yang diawali = + - @ (atau tab/CR) dibaca Excel/Sheets sebagai rumus. Keterangan dari struk atau impor bisa berisi
 * apa saja, jadi diberi tanda kutip tunggal di depan supaya tampil sebagai teks biasa.
 */
export function safeText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** Sel CSV (RFC 4180): dikutip kalau berisi koma, kutip, atau baris baru; kutip di dalamnya digandakan. */
export function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function transactionsToCsv(list: Transaction[]): string {
  // Terbaru di atas, sama seperti ekspor Excel. Sort stabil: urutan input untuk tanggal yang sama dipertahankan.
  const rows = [...list].sort((a, b) => b.date.localeCompare(a.date)).map((t) =>
    [
      t.date || t.rawDate || '',
      t.type,
      safeText(t.category),
      safeText(t.account),
      safeText(t.description),
      t.total,
    ].map(csvCell).join(','),
  );
  return [HEADER.join(','), ...rows].join('\r\n') + '\r\n';
}

/** BOM di depan supaya Excel membaca UTF-8 dengan benar (huruf non-ASCII di keterangan). */
export function downloadCsv(list: Transaction[]) {
  const blob = new Blob(['﻿', transactionsToCsv(list)], { type: 'text/csv;charset=utf-8' });
  saveBlob(blob, `secukupnya-${new Date().toISOString().slice(0, 10)}.csv`);
}
