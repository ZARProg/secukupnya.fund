import { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Share2 } from 'lucide-react';
import { useT } from '@/i18n';
import { usePrivacy } from '@/hooks/usePrivacy';
import { useDailyLimit } from '@/hooks/useDailyLimit';
import { todayISO } from '@/lib/date';
import { buildRecap, rangeFor, shiftRange, type RecapKind } from '@/lib/recap';
import { buildCards, rangeLabel, type StoryCard } from '@/lib/recapCards';
import { THEMES } from '@/lib/recapTheme';
import { canvasToBlob, renderCard } from '@/lib/recapImage';
import type { Engagement } from '@/hooks/useEngagement';
import type { MessageKey } from '@/i18n';
import type { Transaction } from '@/lib/transactions';

export function RecapPage({ transactions, eng, onToast }: {
  transactions: Transaction[];
  eng: Engagement;
  onToast: (kind: 'success' | 'error', message: string) => void;
}) {
  const { t } = useT();
  const { hidden } = usePrivacy();
  const { limit } = useDailyLimit();
  const today = todayISO();
  const [kind, setKind] = useState<RecapKind>('week');
  const [offset, setOffset] = useState(0);
  // Mengikuti mode sembunyikan saldo, tapi bisa diubah khusus untuk kartu.
  const [amountsOverride, setAmountsOverride] = useState<boolean | null>(null);
  const showAmounts = amountsOverride ?? !hidden;
  const [idx, setIdx] = useState(0);
  const busy = useRef(false);

  const range = useMemo(() => shiftRange(rangeFor(kind, today), offset), [kind, offset, today]);
  const data = useMemo(() => buildRecap(transactions, range, today, limit), [transactions, range, today, limit]);
  const level = eng.level.level;
  const cards = useMemo(
    () => buildCards(data, {
      showAmounts,
      level: { n: level.level, name: t(`lvl.${level.key}` as MessageKey) },
    }),
    // t dipakai supaya kartu ikut berganti bahasa.
    [data, showAmounts, level, t],
  );
  const cur = Math.min(idx, cards.length - 1);
  const card = cards[cur];
  const label = rangeLabel(data);

  function pickKind(k: RecapKind) {
    setKind(k);
    setOffset(0);
    setIdx(0);
  }

  async function makeBlob(c: StoryCard) {
    return canvasToBlob(await renderCard(c, label));
  }
  const fileName = (c: StoryCard) => `secukupnya-recap-${data.range.kind}-${data.range.from}-${c.id}.png`;

  async function download() {
    if (busy.current) return;
    busy.current = true;
    try {
      const blob = await makeBlob(card);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName(card);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      onToast('error', t('recap.download.failed'));
    } finally {
      busy.current = false;
    }
  }

  async function share() {
    if (busy.current) return;
    busy.current = true;
    try {
      const file = new File([await makeBlob(card)], fileName(card), { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) onToast('error', t('recap.share.failed'));
    } finally {
      busy.current = false;
    }
  }

  const canShare = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';

  return (
    <div className="space-y-4" data-testid="recap">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label={t('recap.kind.group')}>
          {(['week', 'month'] as const).map((k) => (
            <button
              key={k}
              onClick={() => pickKind(k)}
              aria-pressed={kind === k}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${kind === k ? 'bg-card text-brand-600 shadow-sm' : 'text-slate-500'}`}
            >
              {t(k === 'week' ? 'recap.kind.week' : 'recap.kind.month')}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setOffset((o) => o - 1); setIdx(0); }}
            aria-label={t('recap.prev')}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[10rem] text-center text-sm font-semibold text-slate-800" data-testid="recap-range">{label}</span>
          <button
            onClick={() => { setOffset((o) => Math.min(0, o + 1)); setIdx(0); }}
            disabled={offset >= 0}
            aria-label={t('recap.next')}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!data.hasData ? (
        <p className="rounded-2xl border border-line bg-card p-6 text-sm text-slate-500" data-testid="recap-empty">{t('recap.empty')}</p>
      ) : (
        <>
          <div className="mx-auto w-full max-w-sm">
            <CardView card={card} footer={label} />
            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={() => setIdx(Math.max(0, cur - 1))}
                disabled={cur === 0}
                aria-label={t('recap.card.prev')}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-1.5" role="status" aria-label={t('recap.card.n', { n: cur + 1, total: cards.length })} data-testid="recap-dots">
                {cards.map((c, i) => (
                  <button
                    key={c.id}
                    onClick={() => setIdx(i)}
                    aria-label={t('recap.card.n', { n: i + 1, total: cards.length })}
                    className={`h-2 rounded-full transition-all ${i === cur ? 'w-6 bg-brand' : 'w-2 bg-slate-300'}`}
                  />
                ))}
              </div>
              <button
                onClick={() => setIdx(Math.min(cards.length - 1, cur + 1))}
                disabled={cur >= cards.length - 1}
                aria-label={t('recap.card.next')}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={download} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">
                <Download className="h-4 w-4" /> {t('recap.download')}
              </button>
              {canShare && (
                <button onClick={share} className="flex items-center justify-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-semibold text-slate-700">
                  <Share2 className="h-4 w-4" /> {t('recap.share')}
                </button>
              )}
            </div>
          </div>
          <label className="mx-auto flex max-w-sm items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={showAmounts}
              onChange={(e) => setAmountsOverride(e.target.checked)}
              data-testid="recap-amounts"
            />
            <span>
              {t('recap.amounts')}
              <span className="block text-xs text-slate-500">{t('recap.amounts.hint')}</span>
            </span>
          </label>
        </>
      )}
    </div>
  );
}

function CardView({ card, footer }: { card: StoryCard; footer: string }) {
  const th = THEMES[card.theme];
  return (
    <article
      data-testid={`recap-card-${card.id}`}
      className="relative flex aspect-[4/5] w-full flex-col overflow-hidden rounded-3xl p-7 shadow-card"
      style={{ background: `linear-gradient(135deg, ${th.from}, ${th.to})`, color: th.text }}
    >
      <span aria-hidden className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-card/10" />
      <span aria-hidden className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-card/10" />
      <p className="relative text-xs font-bold uppercase tracking-widest" style={{ color: th.muted }}>{card.eyebrow}</p>
      {card.title && <h3 className="relative mt-3 text-2xl font-display font-bold leading-tight">{card.title}</h3>}
      <p className="relative mt-auto break-words text-5xl font-display font-bold leading-none tracking-tight" data-testid="recap-big">{card.big}</p>
      <p className="relative mt-3 text-sm font-medium" style={{ color: th.muted }}>{card.sub}</p>
      {card.rows.length > 0 && (
        <ul className="relative mt-5 space-y-3">
          {card.rows.slice(0, 3).map((r) => (
            <li key={r.label}>
              <div className="flex justify-between gap-3 text-sm">
                <span className="truncate">{r.label}</span>
                <span className="whitespace-nowrap font-display font-bold">{r.value}</span>
              </div>
              {r.pct !== undefined && (
                <div className="mt-1 h-1.5 rounded-full bg-card/20">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, r.pct))}%`, background: th.accent }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="relative mt-6 flex justify-between text-[11px] font-semibold" style={{ color: th.muted }}>
        <span>secukupnya.fund</span>
        <span>{footer}</span>
      </div>
    </article>
  );
}
