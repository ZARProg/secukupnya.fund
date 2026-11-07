import { parseAmountCell, type Cell, type RawSheet } from './importExcel';

/** Teks CSV → baris sel (RFC 4180: kutip ganda, kutip di dalam digandakan, baris baru di dalam kutip). Pemisah dideteksi: , ; atau tab. */
export function parseCsvText(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const delim = count(';') > count(',') && count(';') >= count('\t') ? ';' : count('\t') > count(',') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const norm = (v: unknown) => String(v ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
const ALIAS = {
  date: ['tanggal', 'tgl', 'date', 'waktu', 'postingdate', 'transactiondate'],
  desc: ['keterangan', 'deskripsi', 'description', 'remark', 'remarks', 'berita', 'uraian', 'catatan', 'note', 'memo', 'detail'],
  debit: ['debit', 'db', 'keluar', 'pengeluaran', 'withdrawal', 'danakeluar'],
  credit: ['kredit', 'credit', 'cr', 'masuk', 'pemasukan', 'deposit', 'danamasuk'],
  amount: ['jumlah', 'nominal', 'amount', 'mutasi', 'total', 'nilai'],
  type: ['jenis', 'tipe', 'type', 'dbcr', 'drcr'],
  category: ['kategori', 'category'],
  account: ['rekening', 'akun', 'account', 'bank'],
} as const;
type K = keyof typeof ALIAS;

function find(row: string[]): Partial<Record<K, number>> {
  const cols: Partial<Record<K, number>> = {};
  row.forEach((h, i) => {
    const n = norm(h);
    if (!n) return;
    (Object.keys(ALIAS) as K[]).forEach((k) => {
      if (cols[k] === undefined && (ALIAS[k] as readonly string[]).some((a) => n === a || (a.length > 3 && n.startsWith(a)))) cols[k] = i;
    });
  });
  return cols;
}

const HEADER = ['Tanggal', 'Jenis', 'Kategori', 'Rekening', 'Keterangan', 'Total'];

/**
 * CSV (termasuk mutasi rekening) → bentuk standar yang dibaca parseWorkbook.
 * Jenis ditentukan dari: kolom Debit/Kredit terpisah, akhiran DB/CR pada nominal, tanda minus, atau kolom Jenis.
 * Tanpa petunjuk apa pun, nominal dianggap pengeluaran. Tidak dikenali sebagai mutasi → dikembalikan apa adanya.
 */
export function csvToSheets(text: string, sheetName = 'CSV'): RawSheet[] {
  const rows = parseCsvText(text);
  let h = -1;
  let cols: Partial<Record<K, number>> = {};
  for (let r = 0; r < Math.min(12, rows.length); r++) {
    const c = find(rows[r]);
    if (c.date !== undefined && (c.amount !== undefined || c.debit !== undefined || c.credit !== undefined)) { h = r; cols = c; break; }
  }
  if (h < 0) return [{ sheet: sheetName, data: rows as Cell[][] }];

  const at = (row: string[], k: K) => (cols[k] === undefined ? '' : (row[cols[k] as number] ?? '').trim());
  // Mutasi bertanda: kalau ada nominal negatif di file, nominal positif berarti pemasukan.
  const hasSign = cols.amount !== undefined && rows.slice(h + 1).some((r) => /^\s*-/.test(r[cols.amount as number] ?? ''));
  const out: Cell[][] = [HEADER];
  for (let r = h + 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every((c) => !c.trim())) continue;
    let type = '';
    let amount = 0;
    const deb = cols.debit !== undefined ? parseAmountCell(at(row, 'debit').replace(/\s?(DB|DR)$/i, '')) : null;
    const cre = cols.credit !== undefined ? parseAmountCell(at(row, 'credit').replace(/\s?CR$/i, '')) : null;
    if ((deb ?? 0) > 0 || (cre ?? 0) > 0) {
      if ((deb ?? 0) > 0) { type = 'Expense'; amount = deb as number; } else { type = 'Income'; amount = cre as number; }
    } else if (cols.amount !== undefined) {
      const raw = at(row, 'amount');
      const suffix = /\b(DB|DR)\s*$/i.test(raw) ? 'Expense' : /\bCR\s*$/i.test(raw) ? 'Income' : '';
      const n = parseAmountCell(raw.replace(/\s?(DB|DR|CR)\s*$/i, ''));
      if (n === null) { out.push([at(row, 'date'), '', at(row, 'category'), at(row, 'account'), at(row, 'desc'), raw]); continue; }
      amount = Math.abs(n);
      const t = norm(at(row, 'type'));
      const fromCol = ['expense', 'pengeluaran', 'keluar', 'debit', 'db', 'dr'].includes(t) ? 'Expense' : ['income', 'pemasukan', 'masuk', 'kredit', 'credit', 'cr'].includes(t) ? 'Income' : '';
      type = suffix || fromCol || (n > 0 && hasSign ? 'Income' : 'Expense');
    } else continue;
    out.push([at(row, 'date'), type, at(row, 'category'), at(row, 'account'), at(row, 'desc'), amount]);
  }
  return [{ sheet: sheetName, data: out }];
}
