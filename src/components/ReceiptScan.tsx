import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Camera, ImagePlus, Loader2, TriangleAlert } from 'lucide-react';
import { useT, type MessageKey } from '@/i18n';
import { useRules } from '@/hooks/useRules';
import { EXPENSE_CATEGORIES } from '@/lib/categories';
import { todayISO } from '@/lib/date';
import { formatRupiah, parseRupiah, rupiahLabel } from '@/lib/format';
import { MAX_RECEIPT_AMOUNT, parseReceipt, type Confidence, type ReceiptParse } from '@/lib/receipt';
import { checkImageFile, type OcrError, type OcrErrorCode, type OcrProgress } from '@/lib/receiptOcr';
import { loadMemory } from '@/lib/quickMemory';
import { matchRule } from '@/lib/rules';
import type { ToastState } from '@/components/Toast';
import type { Transaction, TransactionPayload } from '@/lib/transactions';
import type { Destination } from '@/hooks/useTransactions';

interface ReceiptScanProps {
  accounts: string[];
  transactions: Transaction[];
  sheetAvailable: boolean;
  onSave: (payload: TransactionPayload, destination: Destination) => Promise<void>;
  onToast: (t: ToastState) => void;
  onSubmitted: () => void | Promise<void>;
  onManageAccounts: () => void;
}

type Phase =
  | { kind: 'idle'; error?: OcrErrorCode; detail?: string }
  | { kind: 'working'; stage: OcrProgress['stage']; progress: number }
  | { kind: 'review'; parse: ReceiptParse; preview: string; ocrConfidence: number };

const DESCRIPTION_MAX = 100;

export function ReceiptScan({ accounts, transactions, sheetAvailable, onSave, onToast, onSubmitted, onManageAccounts }: ReceiptScanProps) {
  const { t } = useT();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const run = useRef(0);
  const picker = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);

  // Hentikan mesin OCR (dan bebaskan memori) saat panel ditutup.
  useEffect(() => {
    const counter = run;
    return () => {
      counter.current++;
      void import('@/lib/receiptOcr').then((m) => m.stopOcr());
    };
  }, []);

  const start = useCallback(async (file: File) => {
    const bad = checkImageFile(file);
    if (bad) { setPhase({ kind: 'idle', error: bad }); return; }
    const id = ++run.current;
    setPhase({ kind: 'working', stage: 'prepare', progress: 0 });
    try {
      const ocr = await import('@/lib/receiptOcr');
      const { canvas, preview } = await ocr.prepareImage(file);
      if (id !== run.current) return;
      setPhase({ kind: 'working', stage: 'engine', progress: 0 });
      const res = await ocr.recognizeCanvas(canvas, (p) => { if (id === run.current) setPhase({ kind: 'working', stage: p.stage, progress: p.progress }); });
      if (id !== run.current) return;
      canvas.width = canvas.height = 1; // lepaskan memori kanvas besar
      const parse = parseReceipt(res.text, { today: todayISO(), ocrConfidence: res.confidence });
      setPhase({ kind: 'review', parse, preview, ocrConfidence: res.confidence });
    } catch (e) {
      if (id !== run.current) return;
      const code = (e as Partial<OcrError>)?.code;
      console.error('Receipt scan failed:', e);
      const detail = e instanceof Error && e.message && e.message !== code ? e.message.slice(0, 160) : undefined;
      setPhase({ kind: 'idle', error: code === 'engine' || code === 'read' || code === 'decode' ? code : 'read', detail });
    }
  }, []);

  function cancel() {
    run.current++;
    void import('@/lib/receiptOcr').then((m) => m.stopOcr());
    setPhase({ kind: 'idle' });
  }

  function onFile(files: FileList | null) {
    const f = files?.[0];
    if (f) void start(f);
    if (picker.current) picker.current.value = '';
    if (camera.current) camera.current.value = '';
  }

  if (phase.kind === 'review') {
    return (
      <ReviewForm
        parse={phase.parse}
        preview={phase.preview}
        ocrConfidence={phase.ocrConfidence}
        accounts={accounts}
        transactions={transactions}
        sheetAvailable={sheetAvailable}
        onSave={onSave}
        onToast={onToast}
        onSubmitted={onSubmitted}
        onManageAccounts={onManageAccounts}
        onRescan={() => setPhase({ kind: 'idle' })}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col" data-testid="receipt-scan">
      <div className="flex-1 space-y-4 px-6 py-5">
        <p className="text-sm text-slate-600">{t('scan.intro')}</p>

        {phase.kind === 'working' ? (
          <div className="rounded-2xl border border-line bg-slate-50 p-5 text-center" role="status" aria-live="polite" data-testid="scan-working">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand-600" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-slate-800">
              {phase.stage === 'prepare'
                ? t('scan.stage.prepare')
                : phase.stage === 'engine'
                  ? t('scan.stage.engine', { pct: Math.round(phase.progress * 100) })
                  : t('scan.stage.read', { pct: Math.round(phase.progress * 100) })}
            </p>
            <div className="mx-auto mt-3 h-1.5 max-w-xs overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.round(phase.progress * 100)}%` }} />
            </div>
            <button type="button" onClick={cancel} className="mt-4 min-h-10 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-200" data-testid="scan-cancel">
              {t('scan.cancel')}
            </button>
          </div>
        ) : (
          <>
            {phase.error && (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" data-testid="scan-error">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p>{t(`scan.err.${phase.error === 'cancelled' ? 'read' : phase.error}` as MessageKey)}</p>
                  {phase.detail && <p data-testid="scan-error-detail" className="mt-1 break-words text-xs opacity-80">{t('scan.err.detail', { msg: phase.detail })}</p>}
                </div>
              </div>
            )}
            {accounts.length === 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" role="alert">
                {t('scan.noAccounts')}{' '}
                <button type="button" onClick={onManageAccounts} className="font-semibold underline">{t('accounts.pick.button')}</button>
              </div>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => picker.current?.click()}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white shadow-sm hover:bg-brand-dark"
                data-testid="scan-pick"
              >
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
                {t('scan.pick')}
              </button>
              <button
                type="button"
                onClick={() => camera.current?.click()}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-card px-4 text-sm font-bold text-slate-800 hover:bg-slate-50"
                data-testid="scan-camera"
              >
                <Camera className="h-4 w-4" aria-hidden="true" />
                {t('scan.camera')}
              </button>
            </div>
            <input ref={picker} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-label={t('scan.pick')} onChange={(e) => onFile(e.target.files)} data-testid="scan-file" />
            <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-label={t('scan.camera')} onChange={(e) => onFile(e.target.files)} />
            <p className="text-xs text-slate-500">{t('scan.tips')}</p>
            <p className="text-xs text-slate-500">{t('scan.first')}</p>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Layar pemeriksaan ----------

const FIELD_NEEDS: Record<Confidence, boolean> = { high: false, medium: true, low: true };

function Field({ label, check, children, id }: { label: string; check: boolean; children: ReactNode; id: string }) {
  const { t } = useT();
  return (
    <div>
      <label htmlFor={id} className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-500">
        {label}
        {check && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800" data-testid={`check-${id}`}>{t('scan.check')}</span>}
      </label>
      {children}
    </div>
  );
}

function ReviewForm({
  parse, preview, ocrConfidence, accounts, transactions, sheetAvailable, onSave, onToast, onSubmitted, onManageAccounts, onRescan,
}: {
  parse: ReceiptParse;
  preview: string;
  ocrConfidence: number;
  accounts: string[];
  transactions: Transaction[];
  sheetAvailable: boolean;
  onSave: ReceiptScanProps['onSave'];
  onToast: ReceiptScanProps['onToast'];
  onSubmitted: ReceiptScanProps['onSubmitted'];
  onManageAccounts: () => void;
  onRescan: () => void;
}) {
  const { t } = useT();
  const { rules } = useRules();
  const today = todayISO();
  const mem = useMemo(() => loadMemory(), []);

  const [merchant, setMerchant] = useState(parse.merchant.value ?? '');
  const [date, setDate] = useState(parse.date.value ?? today);
  const [total, setTotal] = useState(parse.total.value ? formatRupiah(String(parse.total.value)) : '');
  const ruleHit = useMemo(() => (parse.merchant.value ? matchRule(rules, parse.merchant.value, 'expense') : null), [rules, parse.merchant.value]);
  const suggested = ruleHit?.rule.category ?? parse.categoryHint ?? '';
  const [category, setCategory] = useState(EXPENSE_CATEGORIES.includes(suggested) ? suggested : '');
  const [account, setAccount] = useState(accounts.includes(mem.lastAccount) ? mem.lastAccount : accounts.length === 1 ? accounts[0] : '');
  const [withItems, setWithItems] = useState(false);
  const [destination, setDestination] = useState<Destination>(sheetAvailable ? 'sheet' : 'local');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Bidang yang sudah diubah pengguna tidak lagi diberi tanda "Periksa".
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (k: string) => setTouched((p) => (p[k] ? p : { ...p, [k]: true }));

  const needs = {
    merchant: !touched.merchant && (parse.merchant.value === null || FIELD_NEEDS[parse.merchant.confidence]),
    date: !touched.date && (parse.date.value === null || FIELD_NEEDS[parse.date.confidence]),
    total: !touched.total && (parse.total.value === null || FIELD_NEEDS[parse.total.confidence]),
    category: false,
  };

  const amount = parseRupiah(total);
  const description = useMemo(() => {
    const base = merchant.trim();
    if (!withItems || !parse.items.length) return base.slice(0, DESCRIPTION_MAX);
    const names = parse.items.map((i) => i.name).join(', ');
    return `${base} (${names})`.slice(0, DESCRIPTION_MAX);
  }, [merchant, withItems, parse.items]);

  const duplicate = useMemo(
    () => (amount > 0 ? transactions.find((tx) => tx.type === 'expense' && tx.date === date && tx.total === amount) ?? null : null),
    [transactions, date, amount],
  );

  const itemsSum = parse.items.reduce((s, i) => s + i.amount, 0);

  async function submit() {
    if (submitting) return;
    const e: Record<string, string> = {};
    if (!amount || amount <= 0 || amount > MAX_RECEIPT_AMOUNT) e.total = t('scan.err.total');
    if (!date) e.date = t('scan.err.date');
    if (!account) e.account = t('scan.err.account');
    if (!category) e.category = t('scan.err.category');
    setErrors(e);
    if (Object.keys(e).length) return;

    const target: Destination = sheetAvailable ? destination : 'local';
    setSubmitting(true);
    try {
      await onSave({ date, type: 'expense', category, account, description: description || category, total: amount }, target);
      onToast({ kind: 'success', message: t('scan.saved', { target: t(target === 'sheet' ? 'forms.saved.sheet' : 'forms.saved.local') }) });
      await onSubmitted();
    } catch (err) {
      console.error('Receipt save failed:', err);
      onToast({ kind: 'error', message: err instanceof Error ? t('forms.toast.saveFailedWith', { message: err.message }) : t('forms.toast.saveFailed') });
    } finally {
      setSubmitting(false);
    }
  }

  const warnings = parse.warnings;

  return (
    <div className="flex flex-1 flex-col" data-testid="scan-review">
      <div className="flex-1 space-y-4 px-6 py-5">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{t('scan.review.title')}</h3>
          <p className="mt-1 text-xs text-slate-500">{t('scan.review.note')}</p>
        </div>

        <img src={preview} alt={t('scan.photo.alt')} className="max-h-56 w-full rounded-xl border border-line bg-slate-50 object-contain" />

        {warnings.length > 0 && (
          <ul className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" data-testid="scan-warnings">
            {warnings.map((w) => (
              <li key={w} className="flex items-start gap-2" data-warning={w}>
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {t(`scan.w.${w}` as MessageKey)}
              </li>
            ))}
          </ul>
        )}

        <Field id="scan-total" label={t('scan.f.total')} check={needs.total}>
          <input
            id="scan-total"
            className="form-input text-lg font-bold tabular-nums"
            inputMode="numeric"
            value={total}
            onChange={(e) => { setTotal(formatRupiah(e.target.value)); touch('total'); }}
            placeholder="0"
            aria-invalid={!!errors.total}
            data-testid="scan-total"
          />
          {errors.total && <p role="alert" className="mt-1 text-xs font-semibold text-red-600">{errors.total}</p>}
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="scan-date" label={t('scan.f.date')} check={needs.date}>
            <input id="scan-date" type="date" className="form-input" value={date} max="2100-12-31" onChange={(e) => { setDate(e.target.value); touch('date'); }} data-testid="scan-date" />
            {errors.date && <p role="alert" className="mt-1 text-xs font-semibold text-red-600">{errors.date}</p>}
          </Field>
          <Field id="scan-merchant" label={t('scan.f.merchant')} check={needs.merchant}>
            <input id="scan-merchant" className="form-input" maxLength={DESCRIPTION_MAX} value={merchant} onChange={(e) => { setMerchant(e.target.value); touch('merchant'); }} data-testid="scan-merchant" />
          </Field>
          <Field id="scan-category" label={t('scan.f.category')} check={needs.category}>
            <select id="scan-category" className="form-input" value={category} onChange={(e) => setCategory(e.target.value)} aria-invalid={!!errors.category} data-testid="scan-category">
              {!category && <option value="">{t('scan.f.pickCategory')}</option>}
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {category && category === suggested && (
              <p className="mt-1 text-[11px] text-slate-500">{ruleHit ? t('scan.catFrom.rule') : t('scan.catFrom.known')}</p>
            )}
            {errors.category && <p role="alert" className="mt-1 text-xs font-semibold text-red-600">{errors.category}</p>}
          </Field>
          <Field id="scan-account" label={t('scan.f.account')} check={false}>
            <select id="scan-account" className="form-input" value={account} onChange={(e) => setAccount(e.target.value)} aria-invalid={!!errors.account} data-testid="scan-account">
              {!account && <option value="">{t('scan.f.pickAccount')}</option>}
              {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            {accounts.length === 0 && (
              <button type="button" onClick={onManageAccounts} className="mt-1 text-xs font-semibold text-brand-600 underline">{t('accounts.pick.button')}</button>
            )}
            {errors.account && <p role="alert" className="mt-1 text-xs font-semibold text-red-600">{errors.account}</p>}
          </Field>
        </div>

        {duplicate && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" role="status" data-testid="scan-dup">
            {t('scan.dup', { amount: rupiahLabel(duplicate.total), desc: duplicate.description || duplicate.category })}
          </p>
        )}

        {parse.items.length > 0 && (
          <section aria-label={t('scan.items.title', { n: parse.items.length })} className="rounded-xl border border-line p-3">
            <h4 className="text-xs font-bold text-slate-700">{t('scan.items.title', { n: parse.items.length })}</h4>
            <p className="text-[11px] text-slate-500">{t('scan.items.note')}</p>
            <ul className="mt-2 divide-y divide-slate-100 text-sm" data-testid="scan-items">
              {parse.items.map((i, idx) => (
                <li key={idx} className="flex items-baseline justify-between gap-3 py-1.5">
                  <span className="min-w-0 truncate text-slate-700">{i.qty && i.qty > 1 ? `${i.qty}× ` : ''}{i.name}</span>
                  <span className="shrink-0 tabular-nums text-slate-900">{rupiahLabel(i.amount)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-right text-[11px] font-semibold text-slate-500">{t('scan.items.sum', { sum: rupiahLabel(itemsSum) })}</p>
            <label className="mt-2 flex min-h-10 cursor-pointer items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={withItems} onChange={(e) => setWithItems(e.target.checked)} className="h-4 w-4 accent-brand" data-testid="scan-with-items" />
              {t('scan.items.include')}
            </label>
          </section>
        )}

        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer font-semibold">{t('scan.raw')} · {Math.round(ocrConfidence)}%</summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[11px] text-slate-700" data-testid="scan-raw">{parse.lines.join('\n')}</pre>
        </details>

        {sheetAvailable && (
          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-slate-500">{t('forms.field.saveTo')}</legend>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
              {(['sheet', 'local'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDestination(d)}
                  aria-pressed={destination === d}
                  className={`rounded-lg py-2 text-xs font-semibold transition-all ${destination === d ? 'bg-card text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {t(d === 'sheet' ? 'forms.dest.sheet' : 'forms.dest.local')}
                </button>
              ))}
            </div>
          </fieldset>
        )}
      </div>

      <div className="sticky bottom-0 flex gap-2 border-t border-slate-100 bg-card/95 px-6 py-4 backdrop-blur-md">
        <button type="button" onClick={onRescan} className="min-h-12 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100" data-testid="scan-rescan">
          {t('scan.retry')}
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting}
          data-testid="scan-save"
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-brand text-sm font-bold text-white shadow-sm transition-all hover:bg-brand-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{t('forms.saving')}</> : t('scan.save')}
        </button>
      </div>
    </div>
  );
}
