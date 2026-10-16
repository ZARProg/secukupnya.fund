/** Urutan tulisan tanggal bergaris miring: hari/bulan/tahun (Indonesia) atau bulan/hari/tahun (AS, bawaan Google Sheets). */
export type DateOrder = 'dmy' | 'mdy';

export const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, january: 1,
  feb: 2, februari: 2, february: 2,
  mar: 3, maret: 3, march: 3,
  apr: 4, april: 4,
  mei: 5, may: 5,
  jun: 6, juni: 6, june: 6,
  jul: 7, juli: 7, july: 7,
  agu: 8, agt: 8, agustus: 8, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10, oct: 10, october: 10,
  nov: 11, november: 11,
  des: 12, desember: 12, dec: 12, december: 12,
};

/** yyyy-MM-dd kalau tanggalnya ada di kalender, selain itu null. */
export function isoDate(y: number, m: number, d: number): string | null {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1) return null;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d > daysInMonth) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export interface TextDateOptions {
  order: DateOrder;
  /**
   * Kalau true, urutan ditebak ulang per tulisan saat hanya satu urutan yang masuk akal
   * ("9/28/2026" pasti bulan/hari, "28/9/2026" pasti hari/bulan). Kalau false, urutan `order`
   * dipakai apa adanya dan tanggal yang tidak ada di kalender ditolak.
   */
  flexible?: boolean;
}

/**
 * Tanggal dari teks: "2026-10-08", "08/10/2026", "8 Okt 2026", "Oct 8, 2026",
 * "Mon Oct 08 2026 00:00:00 GMT+0700". Mengembalikan yyyy-MM-dd atau null.
 */
export function parseTextDate(text: string, { order, flexible = false }: TextDateOptions): string | null {
  const s = text.trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (m) return isoDate(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    const year = +m[3];
    const first = order === 'dmy' ? isoDate(year, b, a) : isoDate(year, a, b);
    if (first || !flexible) return first;
    return order === 'dmy' ? isoDate(year, a, b) : isoDate(year, b, a);
  }

  // 28 Sep 2026, 28 September 2026, Senin, 28 September 2026
  m = s.match(/(\d{1,2})\s+([A-Za-z]{3,})\.?,?\s+(\d{4})/);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month) return isoDate(+m[3], month, +m[1]);
  }

  // Sep 28, 2026 dan Mon Sep 28 2026 00:00:00 GMT+0700 (bentuk Date.toString)
  m = s.match(/([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) {
    const month = MONTHS[m[1].toLowerCase()];
    if (month) return isoDate(+m[3], month, +m[2]);
  }
  return null;
}
