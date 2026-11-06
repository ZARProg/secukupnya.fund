import { BarChart3, Gauge, LayoutDashboard, Plus, Receipt, type LucideIcon } from 'lucide-react';
import { useT, type MessageKey } from '@/i18n';
import type { View } from '@/components/Sidebar';

type Tab = { view: View; label: MessageKey; icon: LucideIcon };

const LEFT: Tab[] = [
  { view: 'overview', label: 'shell.nav.overview', icon: LayoutDashboard },
  { view: 'transactions', label: 'shell.nav.transactions', icon: Receipt },
];
const RIGHT: Tab[] = [
  { view: 'budgets', label: 'nav.budgets', icon: Gauge },
  { view: 'report', label: 'shell.nav.report', icon: BarChart3 },
];

interface BottomNavProps {
  view: View;
  onNavigate: (view: View) => void;
  onRecord: () => void;
}

/**
 * Navigasi bawah khusus HP: empat halaman yang paling sering dibuka dan tombol Catat di tengah,
 * semuanya terjangkau ibu jari. Halaman lain tetap lewat menu di pojok kiri atas.
 */
export function BottomNav({ view, onNavigate, onRecord }: BottomNavProps) {
  const { t } = useT();

  const renderTab = ({ view: v, label, icon: Icon }: Tab) => {
    const active = v === view;
    return (
      <li key={v} className="flex-1">
        <button
          onClick={() => onNavigate(v)}
          aria-current={active ? 'page' : undefined}
          className={`flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold transition-colors ${
            active ? 'text-lime' : 'text-white/65 active:text-white'
          }`}
        >
          <span
            className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
              active ? 'bg-lime text-night' : ''
            }`}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 2} />
          </span>
          <span className="max-w-full truncate">{t(label)}</span>
        </button>
      </li>
    );
  };

  return (
    <nav
      aria-label={t('shell.sidebar.pages')}
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto max-w-md rounded-[2rem] bg-night shadow-[0_10px_30px_rgb(20_22_15/0.35)] lg:hidden"
    >
      <ul className="flex items-center px-2">
        {LEFT.map(renderTab)}
        <li className="flex w-20 justify-center">
          <button
            onClick={onRecord}
            aria-label={t('shell.action.record')}
            className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-lime text-night shadow-lg ring-4 ring-night transition-transform active:scale-95"
          >
            <Plus className="h-6 w-6" />
          </button>
        </li>
        {RIGHT.map(renderTab)}
      </ul>
    </nav>
  );
}
