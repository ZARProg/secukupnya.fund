import { useEffect, useRef, useState } from 'react';
import { PieChart, TrendingUp, Wallet } from 'lucide-react';
import { useT } from '@/i18n';
import { INTRO_FLAG as FLAG } from '@/lib/intro';

const SLIDES = [
  { icon: Wallet, title: 'intro.1.title', body: 'intro.1.body' },
  { icon: PieChart, title: 'intro.2.title', body: 'intro.2.body' },
  { icon: TrendingUp, title: 'intro.3.title', body: 'intro.3.body' },
] as const;

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  const [i, setI] = useState(0);
  const ref = useRef<HTMLButtonElement>(null);
  const last = i === SLIDES.length - 1;
  const { icon: Icon, title, body } = SLIDES[i];

  const finish = () => {
    try { localStorage.setItem(FLAG, '1'); } catch { /* abaikan */ }
    onDone();
  };

  useEffect(() => { ref.current?.focus(); }, [i]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') finish(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  return (
    <div role="dialog" aria-modal="true" aria-label={t('intro.label')} data-testid="intro"
      className="fixed inset-0 z-[70] flex flex-col bg-[#0E281E] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tabular-nums text-white/80">0{i + 1}/0{SLIDES.length}</span>
          <div className="flex flex-1 gap-1.5" aria-hidden="true">
            {SLIDES.map((_, n) => (
              <span key={n} className={`h-1 flex-1 rounded-full ${n <= i ? 'bg-white' : 'bg-white/25'}`} />
            ))}
          </div>
          <button type="button" onClick={finish} data-testid="intro-skip" className="rounded-lg px-2 py-2 text-sm font-semibold text-white/80 hover:text-white">
            {t('intro.skip')}
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center" aria-hidden="true">
          <div className="grid h-44 w-44 place-items-center rounded-[2.5rem] bg-white/10 ring-1 ring-white/15">
            <Icon className="h-20 w-20 text-[#BFE0C4]" strokeWidth={1.5} />
          </div>
        </div>

        <h2 className="font-display text-4xl font-bold leading-[1.1]">{t(title)}</h2>
        <p className="mt-3 text-base leading-relaxed text-white/75">{t(body)}</p>

        <button ref={ref} type="button" onClick={() => (last ? finish() : setI(i + 1))} data-testid="intro-next"
          className="mt-8 w-full rounded-full bg-white py-4 text-base font-bold text-[#0E281E] transition-transform active:scale-[0.98]">
          {t(last ? 'intro.start' : 'intro.next')}
        </button>
      </div>
    </div>
  );
}
