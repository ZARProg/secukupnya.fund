import type { Debt } from './debts';
import type { Goal, Recurring } from './plans';

const enc = new TextEncoder();

/** RFC 5545: escape teks. */
export function icsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Lipat baris > 75 byte (tanpa memotong karakter multibyte). */
export function fold(line: string): string {
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) { out.push(cur); cur = ' '; bytes = 1; limit = 75; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join('\r\n');
}

const ymd = (iso: string) => iso.replace(/-/g, '');
const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate();

/** Tanggal jatuh tempo berikutnya (>= today) untuk hari-dalam-bulan `day`, memakai hari terakhir di bulan yang lebih pendek. */
export function nextOccurrence(day: number, today: string): string {
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7));
  for (let i = 0; i < 2; i++) {
    const d = Math.min(day, lastDay(y, m));
    const iso = `${y}-${pad(m)}-${pad(d)}`;
    if (iso >= today) return iso;
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return today;
}

const RP = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

interface Item { uid: string; start: string; summary: string; rrule?: string; description?: string }

function event(it: Item, stamp: string): string[] {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${it.uid}@secukupnya.fund`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(it.start)}`,
    `SUMMARY:${icsText(it.summary)}`,
  ];
  if (it.rrule) lines.push(`RRULE:${it.rrule}`);
  if (it.description) lines.push(`DESCRIPTION:${icsText(it.description)}`);
  lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(it.summary)}`, 'TRIGGER:-P1D', 'END:VALARM', 'END:VEVENT');
  return lines;
}

/**
 * Kalender (.ics) berisi tagihan rutin, cicilan utang yang masih berjalan, dan tenggat target.
 * Tagihan dan cicilan berulang tiap bulan; tanggal 31 memakai hari terakhir bulan (BYMONTHDAY=-1). Tanggal 29 dan 30 dilewati di bulan yang lebih pendek.
 * Setiap acara diberi pengingat sehari sebelumnya.
 */
export function buildIcs(opts: { recurring: Recurring[]; goals: Goal[]; debts: Debt[]; today: string; now?: Date }): string {
  const now = opts.now ?? new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const monthly = (day: number) => `FREQ=MONTHLY;BYMONTHDAY=${day >= 31 ? -1 : day}`;
  const items: Item[] = [];
  for (const r of opts.recurring) {
    if (r.toAccount) continue;
    items.push({
      uid: `rec-${r.id}`, start: nextOccurrence(r.day, opts.today), rrule: monthly(r.day),
      summary: `${r.type === 'income' ? 'Pemasukan' : 'Tagihan'}: ${r.description || r.category} ${RP(r.total)}`,
    });
  }
  for (const d of opts.debts) {
    const paid = d.payments.reduce((s, p) => s + p.amount, 0);
    if (d.principal + d.fee - paid <= 0 || d.monthly <= 0) continue;
    items.push({ uid: `debt-${d.id}`, start: nextOccurrence(d.dueDay, opts.today), rrule: monthly(d.dueDay), summary: `Cicilan ${d.name} ${RP(d.monthly)}` });
  }
  for (const g of opts.goals) {
    if (!g.deadline || g.saved >= g.target) continue;
    items.push({ uid: `goal-${g.id}`, start: g.deadline, summary: `Tenggat target: ${g.name}`, description: `Terkumpul ${RP(g.saved)} dari ${RP(g.target)}` });
  }
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Secukupnya.fund//ID', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Secukupnya.fund'];
  for (const it of items) lines.push(...event(it, stamp));
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
