import { locale } from '@/i18n';
import { parseISODate } from './date';

export function formatRupiah(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString(locale());
}

export function parseRupiah(formatted: string): number {
  const digits = formatted.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

export function rupiahLabel(n: number): string {
  return 'Rp ' + n.toLocaleString(locale());
}

export function rupiahSigned(n: number): string {
  return n < 0 ? '−' + rupiahLabel(-n) : rupiahLabel(n);
}

export function shortDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
}
