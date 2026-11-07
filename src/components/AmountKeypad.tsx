import { Delete } from 'lucide-react';
import { useT } from '@/i18n';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'] as const;
const ADD = [10_000, 50_000, 100_000];
const MAX_DIGITS = 12;

/** Keypad angka layar untuk HP: tidak menutupi form seperti keyboard bawaan, dan ada tombol tambah cepat. */
export function AmountKeypad({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { t } = useT();
  const press = (k: (typeof KEYS)[number]) => {
    if (k === 'del') return onChange(Math.floor(value / 10));
    const next = `${value || ''}${k}`;
    if (next.replace(/^0+/, '').length > MAX_DIGITS) return;
    onChange(Number(next));
  };
  return (
    <div data-testid="keypad" className="mt-3 rounded-2xl bg-slate-50 p-2.5">
      <div className="mb-2 flex gap-2">
        {ADD.map((n) => (
          <button key={n} type="button" data-testid={`keypad-add-${n}`} onClick={() => onChange(value + n)}
            className="flex-1 rounded-full bg-brand-100 py-2 text-xs font-bold text-brand-800 active:scale-95">+{n / 1000}rb</button>
        ))}
        <button type="button" data-testid="keypad-clear" onClick={() => onChange(0)}
          className="rounded-full px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200">{t('keypad.clear')}</button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((k) => (
          <button key={k} type="button" data-testid={`keypad-${k}`} onClick={() => press(k)}
            aria-label={k === 'del' ? t('keypad.delete') : undefined}
            className="grid h-12 place-items-center rounded-2xl bg-card text-lg font-bold text-slate-900 shadow-card active:scale-95 active:bg-brand-100">
            {k === 'del' ? <Delete className="h-5 w-5" aria-hidden="true" /> : k}
          </button>
        ))}
      </div>
    </div>
  );
}
