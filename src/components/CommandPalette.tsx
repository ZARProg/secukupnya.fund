import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  BarChart3, CalendarClock, CalendarDays, CornerDownLeft, DatabaseZap, Eye, EyeOff, Gauge, History, Landmark, LayoutDashboard, Languages,
  Moon, PiggyBank, Plus, Receipt, Scale, Search, Settings, Share2, TrendingUp, Trophy, Wand2, type LucideIcon,
} from 'lucide-react';
import { useT, type MessageKey } from '@/i18n';
import { usePrivacy } from '@/hooks/usePrivacy';
import { getThemeMode, resolveDark, setThemeMode } from '@/lib/theme';
import type { View } from '@/components/Sidebar';

interface Item {
  id: string;
  group: 'go' | 'act';
  label: string;
  /** Kata kunci tambahan (dua bahasa) supaya "cicilan" atau "saham" tetap menemukan halamannya. */
  keys: string;
  icon: LucideIcon;
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: View) => void;
  onRecord: () => void;
  onReconcile: () => void;
}

const VIEWS: { view: View; label: MessageKey; icon: LucideIcon; keys: string }[] = [
  { view: 'overview', label: 'shell.nav.overview', icon: LayoutDashboard, keys: 'home dashboard beranda saldo' },
  { view: 'transactions', label: 'shell.nav.transactions', icon: Receipt, keys: 'transactions riwayat cari filter' },
  { view: 'budgets', label: 'nav.budgets', icon: Gauge, keys: 'budget anggaran batas kategori' },
  { view: 'goals', label: 'nav.goals', icon: PiggyBank, keys: 'goals tabungan target dana darurat' },
  { view: 'report', label: 'shell.nav.report', icon: BarChart3, keys: 'report laporan bulanan tren' },
  { view: 'calendar', label: 'nav.calendar', icon: CalendarDays, keys: 'calendar kalender jadwal' },
  { view: 'plans', label: 'nav.plans', icon: CalendarClock, keys: 'recurring tagihan rutin langganan berulang dca' },
  { view: 'debts', label: 'nav.debts', icon: Landmark, keys: 'debt utang cicilan paylater pinjaman' },
  { view: 'invest', label: 'nav.invest', icon: TrendingUp, keys: 'invest investasi bibit ajaib pluang saham reksa dana emas top up' },
  { view: 'networth', label: 'nav.networth', icon: Scale, keys: 'net worth kekayaan aset kewajiban' },
  { view: 'rules', label: 'nav.rules', icon: Wand2, keys: 'rules aturan kategori otomatis' },
  { view: 'activity', label: 'nav.activity', icon: History, keys: 'activity riwayat perubahan undo urungkan' },
  { view: 'achievements', label: 'nav.achievements', icon: Trophy, keys: 'achievements pencapaian lencana level' },
  { view: 'recap', label: 'nav.recap', icon: Share2, keys: 'recap rekap bagikan' },
  { view: 'sources', label: 'shell.nav.sources', icon: DatabaseZap, keys: 'sources sumber data google sheets bank e-wallet rekening backup' },
  { view: 'settings', label: 'nav.settings', icon: Settings, keys: 'settings pengaturan pin keamanan tema' },
];

/** Palet perintah: Ctrl/Cmd+K atau "/" untuk pindah halaman dan menjalankan aksi tanpa menggulir menu. */
export function CommandPalette({ open, onClose, onNavigate, onRecord, onReconcile }: Props) {
  const { t, lang, setLang } = useT();
  const { hidden, toggle } = usePrivacy();
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const items = useMemo<Item[]>(() => {
    const go = (v: View) => () => { onNavigate(v); };
    const nav: Item[] = VIEWS.map((v) => ({ id: `go-${v.view}`, group: 'go', label: t(v.label), keys: v.keys, icon: v.icon, run: go(v.view) }));
    const acts: Item[] = [
      { id: 'act-record', group: 'act', label: t('shell.action.record'), keys: 'catat tambah transaksi record add new', icon: Plus, run: onRecord },
      { id: 'act-topup', group: 'act', label: t('pal.topup'), keys: 'invest investasi bibit ajaib pluang', icon: TrendingUp, run: go('invest') },
      { id: 'act-recon', group: 'act', label: t('recon.open'), keys: 'cocokkan saldo reconcile rekonsiliasi', icon: Scale, run: onReconcile },
      { id: 'act-hide', group: 'act', label: t(hidden ? 'pal.hide.off' : 'pal.hide.on'), keys: 'privasi sembunyikan tampilkan saldo hide show privacy', icon: hidden ? Eye : EyeOff, run: toggle },
      { id: 'act-theme', group: 'act', label: t('pal.theme'), keys: 'tema gelap terang dark light theme mode', icon: Moon, run: () => setThemeMode(resolveDark(getThemeMode()) ? 'light' : 'dark') },
      { id: 'act-lang', group: 'act', label: t('pal.lang'), keys: 'bahasa language indonesia english inggris', icon: Languages, run: () => setLang(lang === 'id' ? 'en' : 'id') },
    ];
    return [...acts, ...nav];
  }, [t, hidden, toggle, lang, setLang, onNavigate, onRecord, onReconcile]);

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return items;
    return items.filter((i) => {
      const hay = `${i.label} ${i.keys}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [items, q]);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setQ('');
    setCursor(0);
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open]);

  useEffect(() => { setCursor(0); }, [q]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [cursor, shown]);

  if (!open) return null;

  function choose(item: Item | undefined) {
    if (!item) return;
    onClose();
    // Tutup dulu supaya fokus kembali, baru jalankan aksi (aksi membuka panel/halaman lain).
    setTimeout(() => item.run(), 0);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(shown.length - 1, c + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(shown[cursor]); }
    else if (e.key === 'Tab') { e.preventDefault(); }
  }

  const groups: ('act' | 'go')[] = ['act', 'go'];
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]" onKeyDown={onKey}>
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px] animate-[fadeIn_0.12s_ease-out]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('pal.title')}
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-card shadow-2xl animate-[sheetIn_0.16s_ease-out]"
        data-testid="palette"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            role="combobox"
            aria-expanded="true"
            aria-controls="pal-list"
            aria-activedescendant={shown[cursor] ? `pal-${shown[cursor].id}` : undefined}
            aria-label={t('pal.placeholder')}
            placeholder={t('pal.placeholder')}
            autoComplete="off"
            className="h-14 w-full bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-500"
            data-testid="palette-input"
          />
        </div>

        <ul id="pal-list" ref={listRef} role="listbox" aria-label={t('pal.title')} className="max-h-[52vh] overflow-y-auto p-2">
          {shown.length === 0 && <li className="px-3 py-8 text-center text-sm text-slate-600" data-testid="palette-empty">{t('pal.empty', { q })}</li>}
          {groups.map((g) => {
            const rows = shown.filter((i) => i.group === g);
            if (!rows.length) return null;
            return (
              <li key={g} role="presentation">
                <p className="px-3 pb-1 pt-2 font-display text-xs italic text-slate-500">{t(g === 'go' ? 'pal.go' : 'pal.actions')}</p>
                <ul role="presentation">
                  {rows.map((i) => {
                    const idx = shown.indexOf(i);
                    const active = idx === cursor;
                    const Icon = i.icon;
                    return (
                      <li
                        key={i.id}
                        id={`pal-${i.id}`}
                        role="option"
                        aria-selected={active}
                        onMouseMove={() => setCursor(idx)}
                        onClick={() => choose(i)}
                        className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-medium ${active ? 'bg-brand/10 text-brand-700' : 'text-slate-800'}`}
                        data-testid={`palette-${i.id}`}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">{i.label}</span>
                        {active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>

        <p className="hidden border-t border-line px-4 py-2 text-xs text-slate-500 sm:block">{t('pal.hint')}</p>
      </div>
    </div>
  );
}
