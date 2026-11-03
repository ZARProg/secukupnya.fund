import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Pencil, Plus, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { useT } from '@/i18n';
import { AccountAvatar } from '@/components/AccountAvatar';
import { InvestDialog, type InvestMode, type MoveInput } from '@/components/InvestDialog';
import type { ToastState } from '@/components/Toast';
import { useInvest } from '@/hooks/useInvest';
import { useNetWorth } from '@/hooks/useNetWorth';
import { usePrivacy } from '@/hooks/usePrivacy';
import { todayISO } from '@/lib/date';
import { shortDate } from '@/lib/format';
import {
  INVEST_PLATFORMS, STALE_VALUE_DAYS, isInvestAccount, movePayloads, platformColor, positionOf, summarize, valueAfterMove, valueSeries,
  type MoveKind, type Position, type Valuation,
} from '@/lib/invest';
import type { AccountBalance } from '@/lib/summary';
import type { TransactionPayload } from '@/lib/transactions';

interface Props {
  /** Saldo semua rekening yang dipilih (bank, e-wallet, dan platform investasi). */
  balances: AccountBalance[];
  selectedAccounts: string[];
  onChangeAccounts: (names: string[]) => void;
  /** Simpan dua baris transfer sekaligus. Melempar galat bila gagal. */
  onMove: (payloads: TransactionPayload[]) => Promise<void>;
  onToast: (t: ToastState) => void;
}

const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
const tone = (n: number) => (n > 0 ? 'text-emerald-700' : n < 0 ? 'text-red-700' : 'text-slate-600');

function Spark({ list, label }: { list: Valuation[]; label: string }) {
  if (list.length < 2) return null;
  const vals = list.map((v) => v.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const w = 120;
  const h = 32;
  const pts = list.map((v, i) => `${((i / (list.length - 1)) * w).toFixed(1)},${(h - 3 - ((v.value - min) / span) * (h - 6)).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-28" role="img" aria-label={label}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand" />
    </svg>
  );
}

export function InvestPage({ balances, selectedAccounts, onChangeAccounts, onMove, onToast }: Props) {
  const { t } = useT();
  const { money, moneySigned } = usePrivacy();
  const { data, setValue, removeValue } = useInvest();
  const { data: nw } = useNetWorth();
  const today = todayISO();
  const [dialog, setDialog] = useState<{ mode: InvestMode; platform: string } | null>(null);

  const active = useMemo(() => INVEST_PLATFORMS.filter((p) => selectedAccounts.includes(p)), [selectedAccounts]);
  const available = INVEST_PLATFORMS.filter((p) => !selectedAccounts.includes(p));
  const banks = useMemo(() => balances.filter((b) => !isInvestAccount(b.account)), [balances]);
  const positions = useMemo<Position[]>(
    () => active.map((p) => positionOf(p, balances.find((b) => b.account === p)?.balance ?? 0, nw.openings[p] ?? 0, data.valuations[p], today)),
    [active, balances, nw.openings, data.valuations, today],
  );
  const sum = useMemo(() => summarize(positions), [positions]);
  const hasMoney = positions.some((p) => p.cost !== 0 || p.hasValue);

  async function handleMove(platform: string, kind: MoveKind, pos: Position, input: MoveInput) {
    try {
      await onMove(movePayloads(kind, input.bank, platform, input.amount, input.date, input.note));
    } catch (err) {
      console.error('Gagal mencatat investasi:', err);
      onToast({ kind: 'error', message: t('inv.toast.failed') });
      throw err;
    }
    if (input.sync && pos.hasValue) setValue(platform, input.date, valueAfterMove(pos.value, kind, input.amount));
    onToast({ kind: 'success', message: t(kind === 'topup' ? 'inv.toast.topup' : 'inv.toast.withdraw', { amount: money(input.amount), platform }) });
  }

  const current = dialog ? positions.find((p) => p.platform === dialog.platform) : null;

  return (
    <div className="space-y-5" data-testid="invest-page">
      <section className="relative rounded-3xl bg-brand p-7 text-white shadow-sm sm:p-9" aria-label={t('inv.hero.label')}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-2 rounded-[0.8rem] border border-[#F8E69F]/30" />
        <p className="text-sm font-semibold text-white">{t('inv.hero.label')}</p>
        <p className="mt-1 font-display text-5xl font-medium leading-none tracking-tight tabular-nums sm:text-6xl" data-testid="invest-total">
          {money(sum.value)}
        </p>
        {hasMoney ? (
          <div className="mt-3 space-y-1.5 text-sm text-white">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span data-testid="invest-cost">{t('inv.hero.cost', { amount: money(sum.cost) })}</span>
              <span className="flex items-center gap-1.5 font-semibold" data-testid="invest-gain">
                {sum.gain >= 0 ? <TrendingUp className="h-4 w-4" aria-hidden="true" /> : <TrendingDown className="h-4 w-4" aria-hidden="true" />}
                {t('inv.hero.gain', { amount: moneySigned(sum.gain) })}
                {sum.gainPct !== null && ` ${t('inv.hero.gainPct', { pct: pct(sum.gainPct) })}`}
              </span>
            </p>
            <p data-testid="invest-note">
              {sum.anyMissing ? t('inv.note.missing') : sum.anyStale ? t('inv.note.stale', { days: STALE_VALUE_DAYS }) : t('inv.note.ok')}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-white">{t('inv.hero.empty')}</p>
        )}
        {positions.filter((p) => p.value > 0).length > 1 && sum.value > 0 && (
          <div className="mt-5" data-testid="invest-alloc">
            <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-white/15" role="img" aria-label={t('inv.alloc')}>
              {positions.filter((p) => p.value > 0).map((p) => (
                <span key={p.platform} className={`h-full ${platformColor(p.platform)} ring-1 ring-inset ring-white/30`} style={{ width: `${(p.value / sum.value) * 100}%` }} />
              ))}
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white">
              {positions.filter((p) => p.value > 0).map((p) => (
                <li key={p.platform} className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ring-1 ring-white/60 ${platformColor(p.platform)}`} aria-hidden="true" />
                  {p.platform} <span className="tabular-nums">{Math.round((p.value / sum.value) * 100)}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {positions.length > 0 && (
        <section aria-label={t('inv.platforms')} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {positions.map((p) => {
            const all = data.valuations[p.platform] ?? [];
            const list = valueSeries(all);
            return (
              <article key={p.platform} className="rounded-2xl border border-line bg-card p-5 shadow-card" data-testid={`invest-card-${p.platform}`}>
                <header className="flex items-center gap-3">
                  <AccountAvatar name={p.platform} size="md" />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-bold text-slate-900">{p.platform}</h2>
                    <p className={`text-xs ${p.stale || !p.hasValue ? 'text-amber-800' : 'text-slate-500'}`}>
                      {!p.hasValue ? t('inv.card.noValue') : t(p.stale ? 'inv.card.stale' : 'inv.card.updated', { date: shortDate(p.valueDate!) })}
                    </p>
                  </div>
                  <Spark list={list} label={t('inv.trend', { platform: p.platform })} />
                </header>

                <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3">
                  <div className="col-span-2 sm:col-span-1">
                    <dt className="text-xs text-slate-500">{t('inv.card.value')}</dt>
                    <dd className="mt-0.5 whitespace-nowrap text-xl font-bold tabular-nums text-slate-900 sm:text-lg" data-testid={`invest-value-${p.platform}`}>{money(p.value)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">{t('inv.card.cost')}</dt>
                    <dd className="mt-0.5 whitespace-nowrap text-lg font-bold tabular-nums text-slate-900">{money(p.cost)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">{t('inv.card.gain')}</dt>
                    <dd className={`mt-0.5 whitespace-nowrap text-lg font-bold tabular-nums ${tone(p.gain)}`} data-testid={`invest-gain-${p.platform}`}>
                      {p.hasValue ? moneySigned(p.gain) : '–'}
                      {p.gainPct !== null && <span className="block text-xs font-semibold">{pct(p.gainPct)}</span>}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setDialog({ mode: 'topup', platform: p.platform })} className="flex min-h-11 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-white" data-testid={`invest-topup-${p.platform}`}>
                    <ArrowUpFromLine className="h-4 w-4" aria-hidden="true" />{t('inv.act.topup')}
                  </button>
                  <button type="button" onClick={() => setDialog({ mode: 'withdraw', platform: p.platform })} className="flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50" data-testid={`invest-withdraw-${p.platform}`}>
                    <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />{t('inv.act.withdraw')}
                  </button>
                  <button type="button" onClick={() => setDialog({ mode: 'value', platform: p.platform })} className="flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50" data-testid={`invest-update-${p.platform}`}>
                    <Pencil className="h-4 w-4" aria-hidden="true" />{t('inv.act.value')}
                  </button>
                </div>
                {all.length > 0 && (
                  <details className="mt-3 border-t border-line pt-1">
                    <summary className="flex min-h-11 cursor-pointer items-center text-xs font-semibold text-slate-600">{t('inv.hist.title')} ({all.length})</summary>
                    <ul className="divide-y divide-line">
                      {[...all].reverse().map((v) => (
                        <li key={v.date} className="flex items-center justify-between gap-3 py-1 text-sm">
                          <span className="text-slate-600">{shortDate(v.date)}</span>
                          <span className="ml-auto font-semibold tabular-nums text-slate-900">{money(v.value)}</span>
                          <button
                            type="button"
                            onClick={() => { removeValue(p.platform, v.date); onToast({ kind: 'success', message: t('inv.hist.toast', { date: shortDate(v.date) }) }); }}
                            className="grid h-11 w-11 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-red-700"
                            aria-label={t('inv.hist.delete', { date: shortDate(v.date) })}
                            data-testid={`invest-hist-del-${p.platform}-${v.date}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </article>
            );
          })}
        </section>
      )}

      {available.length > 0 && (
        <section className="rounded-2xl border border-line bg-card p-5 shadow-card sm:p-6" aria-label={t('inv.add.title')}>
          <h2 className="text-base font-bold text-slate-900">{t('inv.add.title')}</h2>
          <p className="mt-1 text-sm text-slate-600">{t('inv.add.hint')}</p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {available.map((p) => (
              <button
                key={p} type="button" onClick={() => onChangeAccounts([...selectedAccounts, p])}
                className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-200 bg-card px-3 py-2.5 text-left hover:border-brand/50"
                data-testid={`invest-add-${p}`}
              >
                <AccountAvatar name={p} size="md" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{p}</span>
                <Plus className="h-4 w-4 text-brand-600" aria-label={t('inv.add.btn', { platform: p })} />
              </button>
            ))}
          </div>
        </section>
      )}

      <details className="rounded-2xl border border-line bg-card p-4 text-sm text-slate-700 shadow-card">
        <summary className="cursor-pointer font-semibold text-slate-900">{t('inv.how.title')}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>{t('inv.how.1')}</li>
          <li>{t('inv.how.2')}</li>
          <li>{t('inv.how.3')}</li>
        </ul>
      </details>

      {dialog && current && (
        <InvestDialog
          key={`${dialog.mode}-${dialog.platform}`}
          mode={dialog.mode}
          platform={dialog.platform}
          position={current}
          banks={banks}
          onClose={() => setDialog(null)}
          onMove={(kind, input) => handleMove(dialog.platform, kind, current, input)}
          onValue={(v, d) => {
            setValue(dialog.platform, d, v);
            onToast({ kind: 'success', message: t('inv.toast.value', { platform: dialog.platform }) });
          }}
        />
      )}
    </div>
  );
}
