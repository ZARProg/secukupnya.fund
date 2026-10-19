import { useT } from '@/i18n';
import { rich } from '@/i18n/rich';
import { useMemo, useRef, useState, type DragEvent } from 'react';
import { AlertCircle, ArrowLeftRight, Download, FileSpreadsheet, HardDrive, Loader2, Sheet, UploadCloud } from 'lucide-react';
import { downloadTemplate, readWorkbook } from '@/lib/excelFile';
import { countFileTwins, findSimilar, parseWorkbook, rowKey, splitDuplicates, transactionKey, type ParseResult } from '@/lib/importExcel';
import { useRules } from '@/hooks/useRules';
import { suggestForImport } from '@/lib/rules';
import { rupiahLabel } from '@/lib/format';
import { getCategoryMeta, isTransferCategory } from '@/lib/categories';
import { PartialImportError, type Transaction, type TransactionPayload } from '@/lib/transactions';
import type { Destination } from '@/hooks/useTransactions';

interface ImportPanelProps {
  sheetConnected: boolean;
  sheetLoading: boolean;
  sheetError: string | null;
  /** Script di spreadsheet sudah versi yang mendukung impor massal. */
  sheetReady: boolean;
  sheetTransactions: Transaction[];
  localTransactions: Transaction[];
  onImport: (
    payloads: TransactionPayload[],
    destination: Destination,
    onProgress: (done: number, total: number) => void,
  ) => Promise<number>;
  onDone: (count: number, destination: Destination) => void;
  onGoToSources: () => void;
}

type Phase = 'idle' | 'reading' | 'preview' | 'importing';

const PREVIEW_ROWS = 6;
const ISSUE_ROWS = 8;

export function ImportPanel({
  sheetConnected, sheetLoading, sheetError, sheetReady, sheetTransactions, localTransactions,
  onImport, onDone, onGoToSources,
}: ImportPanelProps) {
  const { t, tp } = useT();
  const { rules } = useRules();
  const [useRuleSuggest, setUseRuleSuggest] = useState(true);
  const [overrideExisting, setOverrideExisting] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  // null = user belum memilih; default mengikuti kesiapan Sheets (yang bisa baru siap setelah panel dibuka).
  const [chosen, setChosen] = useState<Destination | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tujuan "sheet" tidak boleh terpakai kalau Sheets tidak siap (mis. koneksi baru gagal).
  const effectiveDestination: Destination = (chosen ?? (sheetReady ? 'sheet' : 'local')) === 'sheet' && sheetReady ? 'sheet' : 'local';

  const split = useMemo(() => {
    if (!parsed) return null;
    // Dibandingkan dengan SEMUA sumber, bukan hanya tujuan: kalau tidak, file yang sama bisa masuk ke browser dan Sheets
    // sekaligus dan terhitung dua kali di saldo dan laporan.
    return splitDuplicates(parsed.rows, [...sheetTransactions, ...localTransactions]);
  }, [parsed, sheetTransactions, localTransactions]);

  const dupSource = useMemo(() => {
    const out = new Map<string, 'local' | 'sheet' | 'both'>();
    if (!split) return out;
    const inSheet = new Set(sheetTransactions.map(transactionKey));
    const inLocal = new Set(localTransactions.map(transactionKey));
    for (const r of split.duplicates) {
      const k = transactionKey(r.payload);
      out.set(rowKey(r), inSheet.has(k) && inLocal.has(k) ? 'both' : inSheet.has(k) ? 'sheet' : 'local');
    }
    return out;
  }, [split, sheetTransactions, localTransactions]);

  // Baris yang mirip (bukan sama persis) dengan transaksi yang sudah ada. Hanya penanda: pengguna yang memutuskan.
  const similar = useMemo(() => {
    if (!split) return new Map<string, Transaction>();
    return findSimilar(split.fresh, [...sheetTransactions, ...localTransactions]);
  }, [split, sheetTransactions, localTransactions]);
  const [skippedSimilar, setSkippedSimilar] = useState<Set<string>>(() => new Set());
  const fileTwins = useMemo(() => (parsed ? countFileTwins(parsed.rows) : 0), [parsed]);

  const toImport = useMemo(() => {
    if (!split) return [];
    const base = skipDuplicates ? split.fresh : [...split.fresh, ...split.duplicates];
    return base.filter((r) => !skippedSimilar.has(rowKey(r)));
  }, [split, skipDuplicates, skippedSimilar]);
  const issues = parsed?.issues ?? [];

  // Saran kategori dari aturan pengguna. Hanya menyarankan: bisa dimatikan, dan secara bawaan tidak menimpa kategori yang valid.
  const ruleSuggestions = useMemo(() => {
    const out = new Map<string, ReturnType<typeof suggestForImport> & object>();
    if (!rules.length) return out;
    for (const r of toImport) {
      const sg = suggestForImport(rules, r.payload, overrideExisting);
      if (sg) out.set(rowKey(r), sg);
    }
    return out;
  }, [rules, toImport, overrideExisting]);
  const finalPayloads = useMemo(
    () => toImport.map((r) => {
      const sg = useRuleSuggest ? ruleSuggestions.get(rowKey(r)) : undefined;
      return sg ? { ...r.payload, category: sg.category } : r.payload;
    }),
    [toImport, ruleSuggestions, useRuleSuggest],
  );

  const transfersToImport = useMemo(
    () => toImport.filter((r) => isTransferCategory(r.payload.category)).length,
    [toImport],
  );

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const r of toImport) {
      if (isTransferCategory(r.payload.category)) continue; // transfer bukan pemasukan/pengeluaran
      if (r.payload.type === 'income') income += r.payload.total;
      else expense += r.payload.total;
    }
    return { income, expense };
  }, [toImport]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPhase('reading');
    setFileName(file.name);
    try {
      const sheets = await readWorkbook(file);
      setParsed(parseWorkbook(sheets));
      setSkippedSimilar(new Set());
      setPhase('preview');
    } catch (err) {
      setParsed(null);
      setError(err instanceof Error ? err.message : t('importer.readFailed'));
      setPhase('idle');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  function reset() {
    setParsed(null);
    setSkippedSimilar(new Set());
    setError(null);
    setFileName('');
    setPhase('idle');
  }

  async function runImport() {
    if (!toImport.length) return;
    setError(null);
    setProgress(null);
    setPhase('importing');
    try {
      const count = await onImport(
        finalPayloads,
        effectiveDestination,
        (done, total) => setProgress({ done, total }),
      );
      onDone(count, effectiveDestination);
    } catch (err) {
      const base = err instanceof Error ? err.message : t('importer.importFailedFallback');
      setError(
        err instanceof PartialImportError && err.imported > 0
          ? tp('importer.importStopped', err.imported, { base })
          : t('importer.importFailed', { base }),
      );
      setPhase('preview');
    }
  }

  if (phase === 'idle' || phase === 'reading') {
    return (
      <div className="space-y-5 p-6">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-within:border-brand ${
            dragging ? 'border-brand bg-rose-50' : 'border-slate-300 hover:border-brand hover:bg-slate-50'
          }`}
        >
          {phase === 'reading' ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
              <p className="text-sm font-semibold text-slate-700">{t('importer.reading', { name: fileName })}</p>
            </>
          ) : (
            <>
              <UploadCloud className="h-8 w-8 text-brand-600" />
              <p className="text-sm font-semibold text-slate-800">{t('importer.drop.title')}</p>
              <p className="text-xs text-slate-500">{t('importer.drop.hint')}</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            disabled={phase === 'reading'}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-xs leading-relaxed text-slate-600">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-slate-800">{t('importer.template.title')}</p>
            <button
              onClick={() => downloadTemplate().catch(() => setError(t('importer.template.failed')))}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-dark"
            >
              <Download className="h-3.5 w-3.5" />
              {t('importer.template.download')}
            </button>
          </div>
          <p className="mt-2">
            {rich(t('importer.template.info1', { guide: t('importer.guide.sheetName') }), { b: (c) => <strong>{c}</strong> })}
          </p>
          <p className="mt-2">{rich(t('importer.template.info2'), { b: (c) => <strong>{c}</strong> })}</p>
        </div>
      </div>
    );
  }

  const importing = phase === 'importing';
  const nothingValid = parsed !== null && parsed.rows.length === 0;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-5 p-6">
        <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-brand-600" />
            <span className="truncate text-sm font-medium text-slate-800">{fileName}</span>
          </div>
          <button
            onClick={reset}
            disabled={importing}
            className="shrink-0 text-xs font-semibold text-brand-600 hover:underline disabled:opacity-50"
          >
            {t('importer.changeFile')}
          </button>
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}

        {transfersToImport > 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
            <ArrowLeftRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span>{tp('importer.transfers', transfersToImport)}</span>
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label={t('importer.stat.ready')} value={toImport.length} tone="text-emerald-700" />
          <Stat label={t('importer.stat.existing')} value={split?.duplicates.length ?? 0} tone="text-slate-700" />
          <Stat label={t('importer.stat.skipped')} value={issues.length} tone={issues.length ? 'text-amber-700' : 'text-slate-700'} />
        </div>

        <fieldset disabled={importing}>
          <legend className="mb-2 text-sm font-semibold text-slate-800">{t('importer.saveTo')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <DestinationOption
              checked={effectiveDestination === 'sheet'}
              disabled={!sheetReady}
              onSelect={() => setChosen('sheet')}
              icon={<Sheet className="h-4 w-4" />}
              title="Google Sheets"
              hint={
                sheetReady
                  ? t('importer.hint.sheetReady')
                  : !sheetConnected
                    ? t('importer.hint.notConnected')
                    : sheetLoading
                      ? t('importer.hint.checking')
                      : sheetError
                        ? t('importer.hint.connectionProblem')
                        : t('importer.hint.needsUpdate')
              }
            />
            <DestinationOption
              checked={effectiveDestination === 'local'}
              onSelect={() => setChosen('local')}
              icon={<HardDrive className="h-4 w-4" />}
              title={t('importer.dest.local')}
              hint={t('importer.hint.local')}
            />
          </div>
          {!sheetReady && (
            <button onClick={onGoToSources} className="mt-2 text-xs font-semibold text-brand-600 hover:underline">
              {sheetConnected ? t('importer.goSources.check') : t('importer.goSources.connect')}
            </button>
          )}
        </fieldset>

        {fileTwins > 0 && (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">{tp('importer.twins', fileTwins)}</p>
        )}

        {split && split.fresh.some((r) => similar.has(rowKey(r))) && (
          <section aria-label={t('importer.review.hint')} className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
            <h3 className="text-sm font-semibold text-amber-900">
              {tp('importer.review.title', split.fresh.filter((r) => similar.has(rowKey(r))).length)}
            </h3>
            <p className="mt-1 text-xs text-amber-800/90">{t('importer.review.hint')}</p>
            <ul className="mt-2 divide-y divide-amber-200/60">
              {split.fresh.filter((r) => similar.has(rowKey(r))).map((r) => {
                const key = rowKey(r);
                const m = similar.get(key)!;
                return (
                  <li key={key} className="py-2">
                    <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-800">
                      <input
                        type="checkbox"
                        checked={!skippedSimilar.has(key)}
                        disabled={importing}
                        aria-label={t('importer.review.include', { line: r.line })}
                        onChange={(e) =>
                          setSkippedSimilar((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.delete(key);
                            else next.add(key);
                            return next;
                          })
                        }
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {t('importer.review.row', { line: r.line })} · {r.payload.description || t('importer.review.noDescription')} · {rupiahLabel(r.payload.total)}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {t('importer.review.similarTo', {
                            date: m.date,
                            description: m.description || t('importer.review.noDescription'),
                            amount: rupiahLabel(m.total),
                          })}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {(split?.duplicates.length ?? 0) > 0 && (
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={skipDuplicates}
              onChange={(e) => setSkipDuplicates(e.target.checked)}
              disabled={importing}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand"
            />
            <span>
              {tp('importer.skipDuplicates', split?.duplicates.length ?? 0)}
              <span className="block text-xs text-slate-500">
                {t('importer.skipDuplicates.hint')}
              </span>
            </span>
          </label>
        )}

        {skipDuplicates && (split?.duplicates.length ?? 0) > 0 && (
          <details className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600">
            <summary className="cursor-pointer font-semibold text-slate-700">{tp('importer.dupList', split?.duplicates.length ?? 0)}</summary>
            <ul className="mt-2 divide-y divide-slate-100">
              {split?.duplicates.map((r) => (
                <li key={rowKey(r)} className="truncate py-1">
                  {t('importer.review.row', { line: r.line })} · {r.payload.date} · {r.payload.description || t('importer.review.noDescription')} · {rupiahLabel(r.payload.total)}
                  {dupSource.get(rowKey(r)) && <span className="ml-1 text-slate-500">({t(`dup.in.${dupSource.get(rowKey(r))}` as 'dup.in.local')})</span>}
                </li>
              ))}
            </ul>
          </details>
        )}

        {ruleSuggestions.size > 0 && (
          <section className="space-y-2 rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-3 text-sm text-slate-700" data-testid="import-rules">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input type="checkbox" checked={useRuleSuggest} onChange={(e) => setUseRuleSuggest(e.target.checked)} disabled={importing} className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand" data-testid="import-rules-apply" />
              <span>
                <span className="font-semibold">{tp('rules.import.title', ruleSuggestions.size)}</span>
                <span className="block text-xs text-slate-500">{t('rules.import.apply')}. {overrideExisting ? t('rules.import.overrideHint') : t('rules.import.hint')}</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 text-xs">
              <input type="checkbox" checked={overrideExisting} onChange={(e) => setOverrideExisting(e.target.checked)} disabled={importing} className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand" data-testid="import-rules-override" />
              <span>{t('rules.import.override')}</span>
            </label>
            <details className="text-xs">
              <summary className="cursor-pointer font-semibold text-slate-700">{t('rules.import.list')}</summary>
              <ul className="mt-1 divide-y divide-violet-100">
                {toImport.filter((r) => ruleSuggestions.has(rowKey(r))).slice(0, 30).map((r) => {
                  const sg = ruleSuggestions.get(rowKey(r))!;
                  return (
                    <li key={rowKey(r)} className="truncate py-1">
                      {r.payload.description} · {t('rules.import.arrow', { from: r.payload.category || t('rules.import.empty'), to: sg.category })}
                    </li>
                  );
                })}
              </ul>
            </details>
          </section>
        )}

        {toImport.length > 0 && (
          <div>
            <p className="mb-2 flex flex-wrap items-center justify-between gap-x-4 text-sm font-semibold text-slate-800">
              <span>{t('importer.preview')}</span>
              <span className="text-xs font-medium text-slate-500">
                {totals.expense > 0 && <span className="text-brand-600 tabular-nums">−{rupiahLabel(totals.expense)}</span>}
                {totals.expense > 0 && totals.income > 0 && ' · '}
                {totals.income > 0 && (
                  <span className="text-emerald-600 tabular-nums">+{rupiahLabel(totals.income)}</span>
                )}
              </span>
            </p>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {toImport.slice(0, PREVIEW_ROWS).map((r, i) => {
                const shownCategory = finalPayloads[i].category;
                const meta = getCategoryMeta(shownCategory, r.payload.type);
                const Icon = meta.icon;
                const isExpense = r.payload.type === 'expense';
                return (
                  <li key={`${r.sheet}-${r.line}`} className="flex items-center gap-3 px-3 py-2.5">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.bg}`}>
                      <Icon className={`h-4 w-4 ${meta.color}`} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">
                        {r.payload.description || r.payload.category}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {r.payload.date} · {shownCategory}
                        {r.payload.account ? ` · ${r.payload.account}` : ''}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-sm font-bold tabular-nums ${isExpense ? 'text-brand-600' : 'text-emerald-600'}`}
                    >
                      {isExpense ? '−' : '+'}
                      {rupiahLabel(r.payload.total)}
                    </span>
                  </li>
                );
              })}
            </ul>
            {toImport.length > PREVIEW_ROWS && (
              <p className="mt-2 text-center text-xs text-slate-500">
                {tp('importer.moreTransactions', toImport.length - PREVIEW_ROWS)}
              </p>
            )}
          </div>
        )}

        {nothingValid && (
          <ErrorNote>
            {t('importer.nothingValid')}
          </ErrorNote>
        )}

        {issues.length > 0 && (
          <details className="rounded-lg border border-amber-200 bg-amber-50" open={nothingValid}>
            <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-semibold text-amber-800">
              {tp('importer.issues.summary', issues.length)}
            </summary>
            <ul className="space-y-1 border-t border-amber-200 px-4 py-3 text-xs text-amber-900">
              {issues.slice(0, ISSUE_ROWS).map((i, idx) => (
                <li key={idx}>
                  <span className="font-semibold">
                    {i.sheet}
                    {i.line ? t('importer.issues.lineSuffix', { line: i.line }) : ''}:
                  </span>{' '}
                  {i.message}
                </li>
              ))}
              {issues.length > ISSUE_ROWS && <li>{tp('importer.issues.more', issues.length - ISSUE_ROWS)}</li>}
            </ul>
          </details>
        )}

      </div>

      <div className="sticky bottom-0 border-t border-slate-100 bg-card px-6 py-4">
        <button
          onClick={runImport}
          disabled={importing || toImport.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-bold text-white transition-all hover:bg-brand-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {importing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {progress ? t('importer.sending', { done: progress.done, total: progress.total }) : t('importer.importing')}
            </>
          ) : (
            <>
              {tp('importer.cta', toImport.length, {
                dest: effectiveDestination === 'sheet' ? t('importer.dest.sheet') : t('importer.dest.localShort'),
              })}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-200 px-2 py-3">
      <p className={`text-xl font-display font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
      <p className="text-xs leading-relaxed text-red-800">{children}</p>
    </div>
  );
}

function DestinationOption({
  checked, disabled, onSelect, icon, title, hint,
}: {
  checked: boolean;
  disabled?: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition-colors focus-within:ring-2 focus-within:ring-brand/40 ${
        disabled
          ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
          : checked
            ? 'border-brand bg-rose-50 ring-1 ring-brand'
            : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <input
        type="radio"
        name="import-destination"
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="sr-only"
      />
      <span className={`mt-0.5 ${checked ? 'text-brand-600' : 'text-slate-500'}`}>{icon}</span>
      <span>
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
    </label>
  );
}
