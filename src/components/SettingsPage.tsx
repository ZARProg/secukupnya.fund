import { useState, type FormEvent } from 'react';
import { Lock, Moon, PlayCircle, Shapes, Trash2, Palette, ShieldCheck, Smartphone, Sun } from 'lucide-react';
import { useT } from '@/i18n';
import {
  AUTO_LOCK_OPTIONS, PIN_MAX, PIN_MIN, cryptoAvailable, getAutoLock, isLockEnabled, isValidPin, isWeakPin, pinLength,
  removePin, setAutoLock, setupPin, type AutoLock,
} from '@/lib/lock';
import { CUSTOM_ICONS, MAX_CUSTOM, MAX_NAME, addCustom, loadCustom, removeCustom, type CustomCategory } from '@/lib/customCategories';
import { getThemeMode, setThemeMode, type ThemeMode } from '@/lib/theme';
import { lockNow, syncLockState } from '@/hooks/useLock';
import type { ToastState } from '@/components/Toast';

const THEMES: { mode: ThemeMode; icon: typeof Sun; label: 'theme.light' | 'theme.dark' | 'theme.auto' }[] = [
  { mode: 'light', icon: Sun, label: 'theme.light' },
  { mode: 'dark', icon: Moon, label: 'theme.dark' },
  { mode: 'auto', icon: Smartphone, label: 'theme.auto' },
];

function Section({ icon, title, hint, children, testId }: { icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode; testId: string }) {
  return (
    <section data-testid={testId} className="rounded-2xl border border-line bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">{icon}</span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
          {hint && <p className="mt-1 text-sm leading-relaxed text-slate-600">{hint}</p>}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function CustomCategories() {
  const { t } = useT();
  const [list, setList] = useState<CustomCategory[]>(loadCustom);
  const [name, setName] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [icon, setIcon] = useState('tag');
  const [err, setErr] = useState('');

  function add(e: FormEvent) {
    e.preventDefault();
    const r = addCustom(name, type, icon);
    if (!r.ok) { setErr(t(`cat.err.${r.reason}` as const, { max: MAX_NAME, n: MAX_CUSTOM })); return; }
    setName(''); setErr(''); setList(loadCustom());
  }

  return (
    <div>
      {list.length > 0 && (
        <ul className="mb-4 space-y-1.5" data-testid="custom-cats">
          {list.map((c) => {
            const Icon = CUSTOM_ICONS[c.icon];
            return (
              <li key={`${c.type}-${c.name}`} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-100 text-brand-700"><Icon className="h-4 w-4" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{c.name}</span>
                <span className="text-xs text-slate-500">{t(c.type === 'expense' ? 'cat.type.expense' : 'cat.type.income')}</span>
                <button type="button" onClick={() => { removeCustom(c.name, c.type); setList(loadCustom()); }} aria-label={t('cat.remove', { name: c.name })}
                  className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
              </li>
            );
          })}
        </ul>
      )}
      <form onSubmit={add} className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <input data-testid="cat-name" value={name} maxLength={MAX_NAME} onChange={(e) => { setName(e.target.value); setErr(''); }} aria-label={t('cat.name')} placeholder={t('cat.name')} className="form-input min-w-0 flex-1" />
          <select data-testid="cat-type" value={type} onChange={(e) => setType(e.target.value as 'expense' | 'income')} aria-label={t('cat.type')} className="form-input w-auto">
            <option value="expense">{t('cat.type.expense')}</option>
            <option value="income">{t('cat.type.income')}</option>
          </select>
        </div>
        <div role="radiogroup" aria-label={t('cat.icon')} className="flex flex-wrap gap-1.5">
          {Object.entries(CUSTOM_ICONS).map(([key, Icon]) => (
            <button key={key} type="button" role="radio" aria-checked={icon === key} aria-label={key} onClick={() => setIcon(key)}
              className={`grid h-10 w-10 place-items-center rounded-xl ${icon === key ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}><Icon className="h-4 w-4" aria-hidden="true" /></button>
          ))}
        </div>
        <p role="alert" data-testid="cat-error" className="min-h-5 text-sm font-semibold text-red-700">{err}</p>
        <button type="submit" data-testid="cat-add" className="min-h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand/90">{t('cat.add')}</button>
      </form>
    </div>
  );
}

export function SettingsPage({ onToast }: { onToast: (t: ToastState) => void }) {
  const { t } = useT();
  const [mode, setMode] = useState<ThemeMode>(getThemeMode);
  const [enabled, setEnabled] = useState(isLockEnabled);
  const [auto, setAuto] = useState<AutoLock>(getAutoLock);
  const [step, setStep] = useState<'idle' | 'create' | 'disable'>('idle');
  const [pin1, setPin1] = useState('');
  const [pin2, setPin2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const params = { min: PIN_MIN, max: PIN_MAX };
  const reset = () => { setStep('idle'); setPin1(''); setPin2(''); setErr(''); };
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, PIN_MAX);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!isValidPin(pin1)) return setErr(t('sec2.err.invalid', params));
    if (isWeakPin(pin1)) return setErr(t('sec2.err.weak'));
    if (pin1 !== pin2) return setErr(t('sec2.err.mismatch'));
    if (!cryptoAvailable()) return setErr(t('sec2.err.crypto'));
    setBusy(true);
    try {
      await setupPin(pin1, auto);
      setEnabled(true); reset();
      onToast({ kind: 'success', message: t('sec2.toast.enabled') });
    } catch {
      setErr(t('sec2.err.crypto'));
    } finally {
      setBusy(false);
    }
  }

  async function disable(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (await removePin(pin1)) {
        setEnabled(false); syncLockState(); reset();
        onToast({ kind: 'success', message: t('sec2.toast.disabled') });
      } else {
        setErr(t('sec2.err.wrong')); setPin1('');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5" data-testid="settings-page">
      <Section testId="theme-section" icon={<Palette className="h-5 w-5" />} title={t('theme.title')} hint={t('theme.hint')}>
        <div role="radiogroup" aria-label={t('theme.title')} className="grid grid-cols-3 gap-2 sm:max-w-md">
          {THEMES.map(({ mode: m, icon: Icon, label }) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} data-testid={`theme-${m}`}
              onClick={() => { setMode(m); setThemeMode(m); }}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs font-semibold transition-colors ${
                mode === m ? 'border-brand bg-brand-100 text-brand-700 ring-1 ring-brand' : 'border-slate-200 bg-card text-slate-700 hover:bg-slate-50'
              }`}>
              <Icon className="h-5 w-5" />{t(label)}
            </button>
          ))}
        </div>
      </Section>

      <Section testId="lock-section" icon={<ShieldCheck className="h-5 w-5" />} title={t('sec2.title')} hint={t('sec2.hint')}>
        <p data-testid="lock-status" className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Lock className="h-4 w-4" />{enabled ? t('sec2.on', { n: pinLength() }) : t('sec2.off')}
        </p>

        {step === 'idle' && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!enabled ? (
              <button type="button" data-testid="lock-enable" onClick={() => { setStep('create'); setErr(''); }}
                className="min-h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand/90">{t('sec2.enable')}</button>
            ) : (
              <>
                <button type="button" data-testid="lock-now" onClick={lockNow}
                  className="min-h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand/90">{t('sec2.lockNow')}</button>
                <button type="button" data-testid="lock-disable" onClick={() => { setStep('disable'); setErr(''); }}
                  className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">{t('sec2.disable')}</button>
              </>
            )}
          </div>
        )}

        {step === 'create' && (
          <form onSubmit={create} className="mt-4 max-w-xs space-y-3">
            <label className="block text-sm font-semibold text-slate-700">{t('sec2.new', params)}
              <input data-testid="pin-new" type="password" inputMode="numeric" autoComplete="new-password" value={pin1} onChange={(e) => setPin1(digits(e.target.value))} className="form-input mt-1 w-full tracking-[0.4em]" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">{t('sec2.confirm')}
              <input data-testid="pin-confirm" type="password" inputMode="numeric" autoComplete="new-password" value={pin2} onChange={(e) => setPin2(digits(e.target.value))} className="form-input mt-1 w-full tracking-[0.4em]" />
            </label>
            <p role="alert" data-testid="pin-error" className="min-h-5 text-sm font-semibold text-red-700">{err}</p>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} data-testid="pin-save" className="min-h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50">{t('sec2.save')}</button>
              <button type="button" onClick={reset} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-brand-600 hover:bg-brand-50">{t('sec2.cancel')}</button>
            </div>
          </form>
        )}

        {step === 'disable' && (
          <form onSubmit={disable} className="mt-4 max-w-xs space-y-3">
            <label className="block text-sm font-semibold text-slate-700">{t('sec2.current')}
              <input data-testid="pin-current" type="password" inputMode="numeric" autoComplete="current-password" value={pin1} onChange={(e) => setPin1(digits(e.target.value))} className="form-input mt-1 w-full tracking-[0.4em]" />
            </label>
            <p role="alert" data-testid="pin-error" className="min-h-5 text-sm font-semibold text-red-700">{err}</p>
            <div className="flex gap-2">
              <button type="submit" disabled={busy || !pin1} data-testid="pin-disable-confirm" className="min-h-11 rounded-xl bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">{t('sec2.disable')}</button>
              <button type="button" onClick={reset} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-brand-600 hover:bg-brand-50">{t('sec2.cancel')}</button>
            </div>
          </form>
        )}

        {enabled && step === 'idle' && (
          <label className="mt-5 block max-w-xs text-sm font-semibold text-slate-700">{t('sec2.auto')}
            <select data-testid="auto-lock" value={auto} onChange={(e) => { const v = Number(e.target.value) as AutoLock; setAuto(v); setAutoLock(v); }} className="form-input mt-1 w-full">
              {AUTO_LOCK_OPTIONS.map((o) => <option key={o} value={o}>{t(`sec2.auto.${o}` as const)}</option>)}
            </select>
          </label>
        )}
      </Section>
      <Section testId="cats-section" icon={<Shapes className="h-5 w-5" />} title={t('cat.title')} hint={t('cat.hint')}>
        <CustomCategories />
      </Section>
      <Section testId="intro-section" icon={<PlayCircle className="h-5 w-5" />} title={t('intro.replay.title')} hint={t('intro.replay.hint')}>
        <button type="button" data-testid="intro-replay" onClick={() => window.dispatchEvent(new Event('budgettracker:intro'))}
          className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">{t('intro.replay.action')}</button>
      </Section>
    </div>
  );
}
