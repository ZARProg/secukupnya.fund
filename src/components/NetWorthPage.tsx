import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, Plus, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { useT, locale, type MessageKey } from '@/i18n';
import { useDebts } from '@/hooks/useDebts';
import { useNetWorth } from '@/hooks/useNetWorth';
import { usePrivacy } from '@/hooks/usePrivacy';
import { todayISO } from '@/lib/date';
import { formatRupiah, parseRupiah, parseSigned, rupiahSigned, shortDate, signedFormat } from '@/lib/format';
import { MAX_AMOUNT } from '@/lib/plans';
import {
  ASSET_KINDS, LIABILITY_KINDS, MAX_ITEMS, STALE_DAYS, computeNetWorth, netChange, snapshotOf,
  type AssetKind, type LiabilityKind, type NetRow, type NetSnapshot,
} from '@/lib/networth';
import type { ToastState } from '@/components/Toast';
import type { AccountBalance } from '@/lib/summary';
import type { Transaction } from '@/lib/transactions';

interface NetWorthPageProps {
  balances: AccountBalance[];
  transactions: Transaction[];
  /** False selama data transaksi masih dimuat: riwayat tidak dicatat dulu supaya tidak mencatat angka setengah jadi. */
  ready: boolean;
  onToast: (t: ToastState) => void;
}

const compact = (n: number) => `Rp ${new Intl.NumberFormat(locale(), { notation: 'compact', maximumFractionDigits: 1 }).format(n)}`;

export function NetWorthPage({ balances, transactions, ready, onToast }: NetWorthPageProps) {
  const { t } = useT();
  const { money, moneySigned } = usePrivacy();
  const { debts } = useDebts();
  const nw = useNetWorth();
  const { data } = nw;
  const today = todayISO();

  const accountInputs = useMemo(() => {
    const last = new Map<string, string>();
    for (const tx of transactions) {
      if (!tx.date) continue;
      const prev = last.get(tx.account);
      if (!prev || tx.date > prev) last.set(tx.account, tx.date);
    }
    return balances.map((b) => ({ account: b.account, balance: b.balance, lastTx: last.get(b.account) ?? null }));
  }, [balances, transactions]);

  const result = useMemo(() => computeNetWorth(data, accountInputs, debts, today), [data, accountInputs, debts, today]);
  const hasAnything = result.assetRows.length > 0 || result.liabilityRows.length > 0;

  // Catat satu riwayat per hari setelah data selesai dimuat.
  const { recordSnapshot } = nw;
  const snap = useMemo(() => snapshotOf(result, today), [result, today]);
  useEffect(() => {
    if (ready && hasAnything) recordSnapshot(snap);
  }, [ready, hasAnything, snap, recordSnapshot]);

  const change = useMemo(() => netChange(data.history, result.net, today), [data.history, result.net, today]);
  const estPct = Math.round(result.estimatedShare * 100);
  const estAmount = result.estimatedAssets + result.estimatedLiabilities;

  return (
    <div className="space-y-5" data-testid="networth-page">
      <section
        className="relative rounded-3xl bg-brand p-7 text-white shadow-sm sm:p-9"
        aria-label={t('nw.hero.label')}
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-2 rounded-[0.8rem] border border-[#F8E69F]/30" />
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-white">{t('nw.hero.label')}</p>
          {result.hasEstimate && (
            <span className="rounded-full bg-amber-300/90 px-2.5 py-0.5 text-[11px] font-bold text-amber-950" data-testid="nw-estimate-badge">
              {t('nw.estimate.badge')}
            </span>
          )}
        </div>
        <p className="mt-1 font-display text-5xl font-medium leading-none tracking-tight tabular-nums sm:text-6xl" data-testid="nw-net">
          {result.hasEstimate && '≈ '}{moneySigned(result.net)}
        </p>
        <p className="mt-2 text-sm text-white" data-testid="nw-formula">
          {t('nw.hero.formula', { assets: money(result.assets), liabilities: money(result.liabilities) })}
        </p>

        <div className="mt-4 space-y-1.5 text-sm">
          {!ready && <p className="text-white">{t('nw.loading')}</p>}
          {change ? (
            <p className="flex items-center gap-1.5 font-semibold" data-testid="nw-change">
              {change.delta >= 0 ? <TrendingUp className="h-4 w-4" aria-hidden="true" /> : <TrendingDown className="h-4 w-4" aria-hidden="true" />}
              {t('nw.change', { date: shortDate(change.since), delta: `${change.delta > 0 ? '+' : ''}${moneySigned(change.delta)}` })}
            </p>
          ) : (
            hasAnything && <p className="text-white">{t('nw.change.none')}</p>
          )}
          {hasAnything && (
            <p className="text-white" data-testid="nw-estimate-note">
              {result.hasEstimate
                ? t('nw.estimate.note', { amount: money(estAmount), pct: estPct })
                : t('nw.exact.note', { days: STALE_DAYS })}
            </p>
          )}
        </div>
      </section>

      <HistoryChart history={data.history} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ItemsPanel
          kind="assets"
          title={t('nw.assets')}
          total={result.assets}
          rows={result.assetRows}
          onToast={onToast}
        />
        <ItemsPanel
          kind="liabilities"
          title={t('nw.liabilities')}
          total={result.liabilities}
          rows={result.liabilityRows}
          onToast={onToast}
        />
      </div>

      <section className="rounded-2xl border border-line bg-card p-5 shadow-card sm:p-6" aria-label={t('nw.how.title')}>
        <div className="space-y-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={data.includeAccounts}
              onChange={(e) => nw.setInclude('includeAccounts', e.target.checked)}
              className="h-4 w-4 accent-brand"
              data-testid="nw-toggle-accounts"
            />
            {t('nw.toggle.accounts')}
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={data.includeDebts}
              onChange={(e) => nw.setInclude('includeDebts', e.target.checked)}
              className="h-4 w-4 accent-brand"
              data-testid="nw-toggle-debts"
            />
            {t('nw.toggle.debts')}
          </label>
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {t('nw.double')}
          </p>
        </div>
        <details className="mt-4 text-sm text-slate-700">
          <summary className="cursor-pointer font-semibold text-slate-900">{t('nw.how.title')}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>{t('nw.how.formula')}</li>
            <li>{t('nw.how.account')}</li>
            <li>{t('nw.how.stale', { days: STALE_DAYS })}</li>
            <li>{t('nw.how.history')}</li>
            <li>{t('nw.how.local')}</li>
          </ul>
        </details>
      </section>
    </div>
  );
}

// ---------- Grafik ----------

function HistoryChart({ history }: { history: NetSnapshot[] }) {
  const { t } = useT();
  const { hidden, moneySigned } = usePrivacy();
  const pts = history;
  const enough = pts.length >= 2;

  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-card sm:p-6" aria-labelledby="nw-chart-title">
      <h2 id="nw-chart-title" className="text-base font-bold tracking-tight text-slate-900">{t('nw.chart.title')}</h2>
      {!enough ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500" data-testid="nw-chart-empty">
          {t('nw.chart.empty')}
        </p>
      ) : hidden ? (
        <p className="mt-3 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">{moneySigned(0)}</p>
      ) : (
        <ChartSvg pts={pts} />
      )}
    </section>
  );
}

function ChartSvg({ pts }: { pts: NetSnapshot[] }) {
  const { t } = useT();
  const W = 600, H = 200, L = 84, R = 14, T = 14, B = 8;
  const values = pts.map((p) => p.net);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.1;
  const lo = min - pad;
  const hi = max + pad;
  const t0 = Date.parse(pts[0].date);
  const t1 = Date.parse(pts[pts.length - 1].date);
  const span = Math.max(1, t1 - t0);
  const x = (d: string) => L + ((Date.parse(d) - t0) / span) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.net).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts[pts.length - 1].date).toFixed(1)},${H - B} L${x(pts[0].date).toFixed(1)},${H - B} Z`;
  const ticks = [max, (max + min) / 2, min];
  const from = shortDate(pts[0].date);
  const to = shortDate(pts[pts.length - 1].date);
  const last = pts[pts.length - 1];

  return (
    <div className="mt-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-48 w-full"
        role="img"
        aria-label={t('nw.chart.aria', { from, to, value: rupiahSigned(last.net) })}
        data-testid="nw-chart"
      >
        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#EBE8DC" strokeDasharray="3 4" />
            <text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize="14" fill="#6F6B5D">{v < 0 ? '−' : ''}{compact(Math.abs(v))}</text>
          </g>
        ))}
        {min < 0 && max > 0 && <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="#555143" strokeWidth="1" />}
        <path d={area} fill="#6A795D" fillOpacity="0.08" />
        <path d={line} fill="none" stroke="#6A795D" strokeWidth="2" strokeLinejoin="round" />
        {pts.map((p) => (
          <circle key={p.date} cx={x(p.date)} cy={y(p.net)} r="3.5" fill={p.estimated > 0 ? '#fff' : '#6A795D'} stroke="#6A795D" strokeWidth="2">
            <title>{`${shortDate(p.date)}: ${rupiahSigned(p.net)}${p.estimated > 0 ? ` (${t('nw.estimate.badge')})` : ''}`}</title>
          </circle>
        ))}
      </svg>
      <p className="mt-2 text-xs text-slate-500" data-testid="nw-chart-caption">{t('nw.chart.caption', { from, to, n: pts.length })}</p>
      <p className="mt-1 text-[11px] text-slate-500">
        <span aria-hidden="true">○</span> {t('nw.estimate.badge')} · <span aria-hidden="true">●</span> {t('nw.exact.note', { days: STALE_DAYS })}
      </p>
    </div>
  );
}

// ---------- Daftar aset / kewajiban ----------

type ListKey = 'assets' | 'liabilities';

function ItemsPanel({
  kind, title, total, rows, onToast,
}: {
  kind: ListKey;
  title: string;
  total: number;
  rows: NetRow[];
  onToast: (t: ToastState) => void;
}) {
  const { t } = useT();
  const { money } = usePrivacy();
  const nw = useNetWorth();
  const [adding, setAdding] = useState(false);
  const manualCount = kind === 'assets' ? nw.data.assets.length : nw.data.liabilities.length;

  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-card sm:p-6" aria-labelledby={`nw-${kind}-title`} data-testid={`nw-${kind}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`nw-${kind}-title`} className="text-base font-bold tracking-tight text-slate-900">{title}</h2>
          <p className="text-sm font-semibold tabular-nums text-slate-600" data-testid={`nw-${kind}-total`}>{t('nw.total')}: {money(total)}</p>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            disabled={manualCount >= MAX_ITEMS}
            className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-xl bg-brand px-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand/90 disabled:opacity-50"
            data-testid={`nw-add-${kind}`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {kind === 'assets' ? t('nw.add.asset') : t('nw.add.liability')}
          </button>
        )}
      </div>

      {adding && (
        <AddItemForm
          kind={kind}
          onDone={() => setAdding(false)}
          onToast={onToast}
        />
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-sm text-slate-500" data-testid={`nw-${kind}-empty`}>
          {kind === 'assets' ? t('nw.empty.assets') : t('nw.empty.liabilities')}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <ItemRow key={r.key} row={r} list={kind} onToast={onToast} />
          ))}
        </ul>
      )}
    </section>
  );
}

function reasonText(r: NetRow, t: ReturnType<typeof useT>['t']): string | null {
  if (!r.reason) return null;
  switch (r.reason) {
    case 'stale': return t('nw.reason.stale', { days: r.ageDays ?? 0 });
    case 'oldActivity': return t('nw.reason.oldActivity', { days: r.ageDays ?? 0 });
    case 'flagged': return t('nw.reason.flagged');
    case 'noOpening': return t('nw.reason.noOpening');
    case 'noActivity': return t('nw.reason.noActivity');
    default: return null;
  }
}

function ItemRow({ row, list, onToast }: { row: NetRow; list: ListKey; onToast: (t: ToastState) => void }) {
  const { t } = useT();
  const { moneySigned } = usePrivacy();
  const nw = useNetWorth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const today = todayISO();
  const manual = nw.data[list].find((x) => x.id === row.id);

  const kindLabel = row.source === 'debt' ? t(`debt.kind.${row.kind}` as MessageKey) : t(`nw.kind.${row.kind}` as MessageKey);
  const source = row.source === 'account' ? t('nw.source.account') : row.source === 'debt' ? t('nw.source.debt') : t('nw.source.manual');
  const reason = reasonText(row, t);
  const negativeAccount = row.source === 'account' && row.value < 0;

  function startEdit() {
    setError('');
    if (row.source === 'account') {
      const o = nw.data.openings[row.name];
      setDraft(o ? signedFormat(o) : '');
    } else setDraft(formatRupiah(String(row.value)));
    setEditing(true);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (row.source === 'account') {
      const n = parseSigned(draft);
      if (n === null) return setError(t('nw.err.value'));
      if (Math.abs(n) > MAX_AMOUNT) return setError(t('nw.err.max'));
      nw.setOpening(row.name, n);
      onToast({ kind: 'success', message: t('nw.toast.updated', { name: row.name }) });
    } else if (row.id) {
      if (!draft.trim()) return setError(t('nw.err.value'));
      const n = parseRupiah(draft);
      if (n > MAX_AMOUNT) return setError(t('nw.err.max'));
      nw.updateItem(list, row.id, n, today);
      onToast({ kind: 'success', message: t('nw.toast.updated', { name: row.name }) });
    }
    setEditing(false);
  }

  return (
    <li className="py-3" data-testid={`nw-row-${row.key}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{row.name}</p>
          <p className="text-xs text-slate-500">{kindLabel} · {source}</p>
        </div>
        <p className={`shrink-0 text-sm font-bold tabular-nums ${row.value < 0 ? 'text-red-700' : 'text-slate-900'}`}>
          {row.estimate && <span aria-hidden="true">≈ </span>}{moneySigned(row.value)}
        </p>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {row.estimate && reason && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800" data-testid="nw-row-estimate">{reason}</span>
        )}
        {!row.estimate && manual && (
          <span className="text-[11px] text-slate-500">{t('nw.updated', { date: shortDate(manual.updatedAt) })}</span>
        )}
        {negativeAccount && <span className="text-[11px] text-red-600">{t('nw.negative')}</span>}

        <span className="ml-auto flex items-center gap-1">
          {row.source !== 'debt' && !editing && (
            <button
              onClick={startEdit}
              aria-label={row.source === 'account' ? `${t('nw.opening.edit')}: ${row.name}` : t('nw.update.aria', { name: row.name })}
              className="min-h-10 rounded-lg px-3 text-xs font-semibold text-brand-600 transition-colors hover:bg-rose-50"
              data-testid={`nw-update-${row.key}`}
            >
              {row.source === 'account' ? t('nw.opening.set') : t('nw.update')}
            </button>
          )}
          {row.source === 'manual' && row.id && !editing && (
            <button
              onClick={() => {
                nw.removeItem(list, row.id!);
                onToast({ kind: 'success', message: t('nw.toast.removed', { name: row.name }) });
              }}
              aria-label={t('nw.remove.aria', { name: row.name })}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </span>
      </div>

      {editing && (
        <form onSubmit={submit} className="mt-2 space-y-2 rounded-xl bg-slate-50 p-3" aria-label={row.source === 'account' ? t('nw.opening.label', { account: row.name }) : t('nw.update.aria', { name: row.name })}>
          {row.source === 'account' && <p className="text-xs text-slate-500">{t('nw.opening.hint')}</p>}
          <input
            className="form-input tabular-nums"
            inputMode={row.source === 'account' ? 'text' : 'numeric'}
            value={draft}
            onChange={(e) => setDraft(row.source === 'account' ? signedFormat(e.target.value) : formatRupiah(e.target.value))}
            aria-label={row.source === 'account' ? t('nw.opening.label', { account: row.name }) : t('nw.update.aria', { name: row.name })}
            placeholder="0"
            autoFocus
            data-testid="nw-edit-input"
          />
          {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" className="min-h-10 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand/90" data-testid="nw-edit-save">
              {t('nw.opening.save')}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="min-h-10 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              {t('nw.f.cancel')}
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

// ---------- Tambah ----------

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function AddItemForm({ kind, onDone, onToast }: { kind: ListKey; onDone: () => void; onToast: (t: ToastState) => void }) {
  const { t } = useT();
  const nw = useNetWorth();
  const kinds: readonly string[] = kind === 'assets' ? ASSET_KINDS : LIABILITY_KINDS;
  const [name, setName] = useState('');
  const [itemKind, setItemKind] = useState<string>(kinds[0]);
  const [value, setValue] = useState('');
  const [estimate, setEstimate] = useState(false);
  const [error, setError] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    const nm = name.trim();
    if (!nm) return setError(t('nw.err.name'));
    if (!value.trim()) return setError(t('nw.err.value'));
    const n = parseRupiah(value);
    if (n > MAX_AMOUNT) return setError(t('nw.err.max'));
    const count = kind === 'assets' ? nw.data.assets.length : nw.data.liabilities.length;
    if (count >= MAX_ITEMS) return setError(t('nw.err.limit'));
    const base = { name: nm.slice(0, 60), value: n, updatedAt: todayISO(), estimate };
    if (kind === 'assets') nw.addAsset({ ...base, kind: itemKind as AssetKind });
    else nw.addLiability({ ...base, kind: itemKind as LiabilityKind });
    onToast({ kind: 'success', message: t('nw.toast.added', { name: nm }) });
    onDone();
  }

  return (
    <form onSubmit={submit} className="mb-4 space-y-3 rounded-xl bg-slate-50 p-4" aria-label={kind === 'assets' ? t('nw.add.asset') : t('nw.add.liability')} data-testid={`nw-form-${kind}`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('nw.f.name')}>
          <input
            className="form-input"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === 'assets' ? t('nw.f.name.asset') : t('nw.f.name.liability')}
            autoFocus
            data-testid="nw-f-name"
          />
        </Field>
        <Field label={t('nw.f.kind')}>
          <select className="form-input" value={itemKind} onChange={(e) => setItemKind(e.target.value)} data-testid="nw-f-kind">
            {kinds.map((k) => (
              <option key={k} value={k}>{t(`nw.kind.${k}` as MessageKey)}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={t('nw.f.value')}>
        <input
          className="form-input tabular-nums"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(formatRupiah(e.target.value))}
          placeholder="0"
          data-testid="nw-f-value"
        />
      </Field>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-slate-700">
        <input type="checkbox" checked={estimate} onChange={(e) => setEstimate(e.target.checked)} className="h-4 w-4 accent-brand" data-testid="nw-f-estimate" />
        {t('nw.f.estimate')}
      </label>
      {error && <p role="alert" className="text-xs font-semibold text-red-600" data-testid="nw-f-error">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="min-h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:bg-brand/90" data-testid="nw-f-submit">{t('nw.f.submit')}</button>
        <button type="button" onClick={onDone} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100">{t('nw.f.cancel')}</button>
      </div>
    </form>
  );
}
