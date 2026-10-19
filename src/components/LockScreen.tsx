import { useCallback, useEffect, useRef, useState } from 'react';
import { Delete, Lock, Wallet } from 'lucide-react';
import { useT } from '@/i18n';
import { lockoutRemaining, pinLength, verifyPin, wipeLocalData } from '@/lib/lock';
import { syncLockState, unlockApp } from '@/hooks/useLock';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

/** Layar kunci penuh. Aplikasi di baliknya tidak dirender sama sekali selama terkunci. */
export function LockScreen() {
  const { t } = useT();
  const len = pinLength() || 4;
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  const [wait, setWait] = useState(() => Math.ceil(lockoutRemaining() / 1000));
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [word, setWord] = useState('');
  const busyRef = useRef(false);

  // Hitung mundur jeda setelah terlalu banyak salah.
  useEffect(() => {
    if (wait <= 0) return;
    const id = setInterval(() => setWait(Math.ceil(lockoutRemaining() / 1000)), 500);
    return () => clearInterval(id);
  }, [wait]);

  const submit = useCallback(async (value: string) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      const r = await verifyPin(value);
      if (r.ok) { unlockApp(); return; }
      setWrong(true); setPin('');
      setWait(Math.ceil(r.waitMs / 1000));
      if (navigator.vibrate) navigator.vibrate(120);
    } finally {
      busyRef.current = false; setBusy(false);
    }
  }, []);

  const press = useCallback((d: string) => {
    if (busyRef.current || wait > 0) return;
    setWrong(false);
    setPin((p) => {
      if (p.length >= len) return p;
      const next = p + d;
      if (next.length === len) void submit(next);
      return next;
    });
  }, [len, wait, submit]);

  const back = useCallback(() => { setWrong(false); setPin((p) => p.slice(0, -1)); }, []);

  useEffect(() => {
    if (forgot) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, back, forgot]);

  const confirmWord = t('lock.forgot.word');
  const canWipe = word.trim().toLowerCase() === confirmWord.toLowerCase();

  return (
    <div data-testid="lock-screen" role="dialog" aria-modal="true" aria-label={t('lock.title')}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-y-auto bg-paper px-6 py-8">
      <div className="flex w-full max-w-xs flex-col items-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white"><Wallet className="h-7 w-7" /></span>
        <h1 className="mt-4 font-display text-2xl font-bold text-ink">Secukupnya.fund</h1>

        {!forgot ? (
          <>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600"><Lock className="h-3.5 w-3.5" />{t('lock.enter')}</p>
            <div className="mt-6 flex h-4 items-center gap-3" aria-hidden="true">
              {Array.from({ length: len }, (_, i) => (
                <span key={i} className={`h-3.5 w-3.5 rounded-full border-2 transition-colors ${i < pin.length ? 'border-brand-700 bg-brand-700' : 'border-slate-400'}`} />
              ))}
            </div>
            <p role="status" aria-live="polite" data-testid="lock-msg" className={`mt-4 min-h-[2.5rem] text-center text-sm font-semibold ${wrong || wait > 0 ? 'text-red-700' : 'text-transparent'}`}>
              {wait > 0 ? t('lock.wait', { s: wait }) : wrong ? t('lock.wrong') : '.'}
            </p>
            <div className="mt-2 grid w-full grid-cols-3 gap-3">
              {KEYS.map((d) => (
                <button key={d} type="button" aria-label={t('lock.digit', { d })} disabled={busy || wait > 0} onClick={() => press(d)}
                  className="flex h-16 items-center justify-center rounded-full bg-card font-display text-2xl font-semibold text-ink shadow-card ring-1 ring-line transition-colors active:bg-brand-100 disabled:opacity-40">
                  {d}
                </button>
              ))}
              <span />
              <button type="button" aria-label={t('lock.digit', { d: 0 })} disabled={busy || wait > 0} onClick={() => press('0')}
                className="flex h-16 items-center justify-center rounded-full bg-card font-display text-2xl font-semibold text-ink shadow-card ring-1 ring-line transition-colors active:bg-brand-100 disabled:opacity-40">
                0
              </button>
              <button type="button" aria-label={t('lock.delete')} onClick={back} disabled={busy || !pin}
                className="flex h-16 items-center justify-center rounded-full text-slate-600 transition-colors active:bg-brand-100 disabled:opacity-30">
                <Delete className="h-6 w-6" />
              </button>
            </div>
            <button type="button" data-testid="lock-forgot" onClick={() => setForgot(true)}
              className="mt-6 min-h-11 rounded-lg px-3 text-sm font-semibold text-brand-600 hover:underline">
              {t('lock.forgot')}
            </button>
          </>
        ) : (
          <div className="mt-6 w-full">
            <h2 className="text-lg font-semibold text-ink">{t('lock.forgot.title')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{t('lock.forgot.body')}</p>
            <input data-testid="lock-wipe-input" value={word} onChange={(e) => setWord(e.target.value)} autoCapitalize="characters" autoComplete="off" spellCheck={false}
              aria-label={confirmWord} className="form-input mt-4 w-full" />
            <button type="button" data-testid="lock-wipe" disabled={!canWipe}
              onClick={() => { wipeLocalData(); syncLockState(); }}
              className="mt-3 min-h-11 w-full rounded-xl bg-red-700 px-4 text-sm font-bold text-white transition-colors hover:bg-red-800 disabled:opacity-40">
              {t('lock.forgot.confirm')}
            </button>
            <button type="button" onClick={() => { setForgot(false); setWord(''); }}
              className="mt-2 min-h-11 w-full rounded-xl px-4 text-sm font-semibold text-brand-600 hover:bg-brand-50">
              {t('lock.forgot.cancel')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
