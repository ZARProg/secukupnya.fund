import { useState, type FormEvent } from 'react';
import {
  Check, CheckCircle2, ClipboardCopy, Download, FileDown, FileSpreadsheet, Gauge, HardDrive, Landmark, Link2Off, Loader2, ShieldAlert,
  TriangleAlert,
} from 'lucide-react';
import { AccountAvatar } from '@/components/AccountAvatar';
import { Badge, Card } from '@/components/Card';
import { SecurityCard } from '@/components/SecurityCard';
import { BackupCard } from '@/components/BackupCard';
import { ACCOUNT_CATALOG } from '@/lib/categories';
import appsScriptSource from '@/lib/appsScriptSource';
import { isValidAppsScriptUrl, isValidToken, maskSheetUrl } from '@/lib/config';
import { EDIT_VERSION, LIMIT_SYNC_VERSION, MIN_BATCH_VERSION, NEWEST_FIRST_VERSION } from '@/lib/transactions';
import { DAILY_TARGET } from '@/lib/categories';
import { MAX_DAILY_LIMIT, useDailyLimit } from '@/hooks/useDailyLimit';
import { formatRupiah, parseRupiah, rupiahLabel } from '@/lib/format';
import { useT } from '@/i18n';
import { rich } from '@/i18n/rich';

const bold = (c: string) => <strong>{c}</strong>;

interface SourcesPageProps {
  sheetUrl: string;
  urlFromEnv: boolean;
  sheetVersion: number;
  loading: boolean;
  error: string | null;
  sheetCount: number;
  localCount: number;
  /** Bank dan e-wallet yang dipilih pengguna. */
  selectedAccounts: string[];
  /** Jumlah transaksi per nama rekening, untuk memberi tahu pilihan mana yang sudah dipakai. */
  accountUsage: Record<string, number>;
  onChangeAccounts: (names: string[]) => void;
  onTemplate: () => void;
  /** Dipanggil setelah batas harian disimpan, supaya App bisa mengirimnya ke spreadsheet. */
  onLimitChange: (limit: number) => void;
  onConnect: (url: string, token: string) => Promise<number>;
  sheetSecured: boolean;
  authRequired: boolean;
  onSaveToken: (token: string) => Promise<void>;
  onRemoveToken: () => void;
  onDisconnect: () => void;
  onClearLocal: () => void;
  onImport: () => void;
  onExport: () => void;
  onNotify: (kind: 'success' | 'error', message: string) => void;
}

export function SourcesPage({
  sheetUrl, urlFromEnv, sheetVersion, loading, error, sheetCount, localCount,
  selectedAccounts, accountUsage, onChangeAccounts, onTemplate, onLimitChange,
  onConnect, onDisconnect, onClearLocal, onImport, onExport, onNotify, sheetSecured, authRequired, onSaveToken, onRemoveToken,
}: SourcesPageProps) {
  const { t, tp } = useT();
  const [input, setInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [copied, setCopied] = useState(false);

  const connected = Boolean(sheetUrl);
  const settled = connected && !loading && !error && sheetVersion > 0;
  const outdated = settled && sheetVersion < MIN_BATCH_VERSION;
  const behind = settled && !outdated && sheetVersion < EDIT_VERSION;

  async function handleConnect(e: FormEvent) {
    e.preventDefault();
    const url = input.trim();
    if (!isValidAppsScriptUrl(url)) {
      setFieldError(t('sources.urlInvalid'));
      return;
    }
    if (tokenInput.trim() && !isValidToken(tokenInput)) {
      setFieldError(t('sec.err.format'));
      return;
    }
    setFieldError(null);
    setConnecting(true);
    try {
      const count = await onConnect(url, tokenInput.trim());
      setInput('');
      setTokenInput('');
      onNotify('success', tp('sources.connected', count));
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : t('sources.connectFailed'));
    } finally {
      setConnecting(false);
    }
  }

  async function copyScript() {
    try {
      await navigator.clipboard.writeText(appsScriptSource);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onNotify('error', t('sources.copyFailed'));
    }
  }

  function handleDisconnect() {
    if (window.confirm(t('sources.disconnectConfirm'))) {
      onDisconnect();
    }
  }

  function handleClearLocal() {
    if (window.confirm(tp('sources.clearConfirm', localCount))) {
      onClearLocal();
    }
  }

  return (
    <div className="space-y-5">
      <Card
        icon={<FileSpreadsheet className="h-5 w-5" />}
        title={t('sources.sheets.title')}
        badge={
          connected ? (
            error ? <Badge tone="red">{t('sources.sheets.badgeFailed')}</Badge> : <Badge tone="green">{t('sources.sheets.badgeConnected')}</Badge>
          ) : (
            <Badge tone="slate">{t('sources.sheets.badgeNone')}</Badge>
          )
        }
      >
        {connected && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-mono text-xs text-slate-600">{maskSheetUrl(sheetUrl)}</p>
              <p className="mt-1 text-xs text-slate-500">
                {loading ? t('sources.sheets.loading') : error ? error : tp('sources.sheets.count', sheetCount)}
                {urlFromEnv ? t('sources.sheets.fromEnv') : ''}
              </p>
            </div>
            {!urlFromEnv && (
              <button
                onClick={handleDisconnect}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                <Link2Off className="h-3.5 w-3.5" />
                {t('sources.sheets.disconnect')}
              </button>
            )}
          </div>
        )}

        {outdated && (
          <div role="alert" className="mb-5 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs leading-relaxed text-amber-800">
              {rich(t('sources.outdated', { min: MIN_BATCH_VERSION, newest: NEWEST_FIRST_VERSION }), { b: bold })}
            </p>
          </div>
        )}

        {behind && (
          <div role="status" className="mb-5 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="text-xs leading-relaxed text-amber-800">
              <p>
                {rich(t('sources.behind.intro', { version: sheetVersion, target: EDIT_VERSION }), { b: bold })}
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {sheetVersion < NEWEST_FIRST_VERSION && (
                  <li>{t('sources.behind.newestFirst')}</li>
                )}
                {sheetVersion < LIMIT_SYNC_VERSION && <li>{t('sources.behind.limit')}</li>}
                <li>{t('sources.behind.edit')}</li>
              </ul>
              <p className="mt-1">
                {t('sources.behind.how')}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleConnect} noValidate>
          <label htmlFor="sheet-url" className="mb-1.5 block text-sm font-medium text-slate-700">
            {connected ? t('sources.url.labelSwitch') : t('sources.url.label')}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="sheet-url"
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setFieldError(null);
              }}
              placeholder="https://script.google.com/macros/s/…/exec"
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? 'sheet-url-error' : undefined}
              className="form-input font-mono text-xs"
            />
            <button
              type="submit"
              disabled={connecting || !input.trim()}
              className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('sources.url.checking')}
                </>
              ) : (
                t('sources.url.connect')
              )}
            </button>
          </div>
 <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={tokenInput}
            onChange={(e) => { setTokenInput(e.target.value); setFieldError(null); }}
            placeholder={t('sec.field.token.optional')}
            aria-label={t('sec.field.token.optional')}
            className="form-input mt-2 font-mono text-xs"
            data-testid="connect-token"
          />
          {fieldError && (
            <p id="sheet-url-error" role="alert" className="mt-2 text-xs font-medium text-red-600">
              {fieldError}
            </p>
          )}
        </form>

        <div className="mt-4 flex gap-2 rounded-lg bg-slate-50 px-4 py-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          <p className="text-xs leading-relaxed text-slate-600">
            {t('sources.privacy')}
          </p>
        </div>

        <details className="group mt-4 rounded-lg border border-slate-200">
          <summary className="cursor-pointer select-none rounded-lg px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            {t('sources.setup.summary')}
          </summary>
          <div className="space-y-3 border-t border-slate-100 px-4 py-4 text-sm text-slate-600">
            <ol className="list-decimal space-y-2 pl-5 leading-relaxed">
              <li>{t('sources.setup.step1')}</li>
              <li>{rich(t('sources.setup.step2'), { b: bold })}</li>
              <li>{rich(t('sources.setup.step3'), { b: bold })}</li>
              <li>{t('sources.setup.step4')}</li>
            </ol>
            <button
              onClick={copyScript}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  {t('sources.setup.copied')}
                </>
              ) : (
                <>
                  <ClipboardCopy className="h-4 w-4" />
                  {t('sources.setup.copy')}
                </>
              )}
            </button>
          </div>
        </details>
      </Card>

      <SecurityCard connected={connected} version={sheetVersion} secured={sheetSecured} authRequired={authRequired} onSaveToken={onSaveToken} onRemoveToken={onRemoveToken} />

      <Card
        id="rekening"
        icon={<Landmark className="h-5 w-5" />}
        title={t('sources.accounts.title')}
        badge={<Badge tone="slate">{t('sources.accounts.selected', { n: selectedAccounts.length })}</Badge>}
      >
        <p className="mb-4 text-sm leading-relaxed text-slate-600">
          {t('sources.accounts.intro')}
        </p>
        {(['bank', 'ewallet'] as const).map((kind) => (
          <div key={kind} className="mb-4 last:mb-0">
            <h3 className="mb-2 text-xs font-semibold text-slate-500">{kind === 'bank' ? t('sources.accounts.bank') : t('sources.accounts.ewallet')}</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ACCOUNT_CATALOG.filter((a) => a.kind === kind).map((a) => {
                const selected = selectedAccounts.includes(a.name);
                const used = accountUsage[a.name] ?? 0;
                return (
                  <button
                    key={a.name}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      onChangeAccounts(selected ? selectedAccounts.filter((n) => n !== a.name) : [...selectedAccounts, a.name])
                    }
                    className={`relative flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all ${
                      selected
                        ? 'border-brand bg-rose-50 ring-1 ring-brand'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <AccountAvatar name={a.name} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-semibold ${selected ? 'text-brand' : 'text-slate-800'}`}>
                        {a.name}
                      </span>
                      <span className="block text-xs text-slate-400">{used ? tp('sources.accounts.used', used) : t('sources.accounts.unused')}</span>
                    </span>
                    {selected && (
                      <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-white">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </Card>

      <BackupCard sheetUrl={sheetUrl} sheetVersion={sheetVersion} authRequired={authRequired} onNotify={onNotify} />

      <LimitCard onChange={onLimitChange} synced={settled && sheetVersion >= LIMIT_SYNC_VERSION} />

      <Card icon={<FileDown className="h-5 w-5" />} title={t('sources.template.title')} badge={<Badge tone="slate">.xlsx</Badge>}>
        <p className="text-sm leading-relaxed text-slate-600">
          {t('sources.template.intro')}
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
          <li className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>{rich(t('sources.template.sheets'), { b: bold })}</span>
          </li>
          <li className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>{rich(t('sources.template.guide'), { b: bold })}</span>
          </li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={onTemplate}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            <Download className="h-4 w-4" />
            {t('sources.template.download')}
          </button>
          <button
            onClick={onImport}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {t('sources.importExcel')}
          </button>
        </div>
      </Card>

      <Card
        icon={<HardDrive className="h-5 w-5" />}
        title={t('sources.local.title')}
        badge={<Badge tone="slate">{tp('sources.local.badge', localCount)}</Badge>}
      >
        <p className="text-sm leading-relaxed text-slate-600">
          {t('sources.local.intro')}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={onImport}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {t('sources.importExcel')}
          </button>
          <button
            onClick={onExport}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            {t('sources.local.export')}
          </button>
          {localCount > 0 && (
            <button
              onClick={handleClearLocal}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
            >
              {t('sources.local.clear')}
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}

/** Batas pengeluaran harian: dipakai kartu saldo, grafik 14 hari, dan peringatan di form. Tersimpan di browser ini. */
function LimitCard({ onChange, synced }: { onChange: (limit: number) => void; synced: boolean }) {
  const { t } = useT();
  const { limit, setLimit, reset } = useDailyLimit();
  const [draft, setDraft] = useState(() => formatRupiah(String(limit)));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = parseRupiah(draft);
    if (!setLimit(value)) {
      setError(value > MAX_DAILY_LIMIT ? t('sources.limit.tooBig') : t('sources.limit.invalid'));
      setSaved(false);
      return;
    }
    setError(null);
    setSaved(true);
    onChange(value);
  }

  return (
    <Card icon={<Gauge className="h-5 w-5" />} title={t('sources.limit.title')} badge={<Badge tone="slate">{rupiahLabel(limit)}</Badge>}>
      <p className="text-sm leading-relaxed text-slate-600">
        {t('sources.limit.intro')}{' '}
        {synced ? t('sources.limit.synced') : t('sources.limit.local')}
      </p>
      <form onSubmit={handleSubmit} noValidate className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
          <input
            type="text"
            inputMode="numeric"
            aria-label={t('sources.limit.aria')}
            value={draft}
            onChange={(e) => { setDraft(formatRupiah(e.target.value)); setSaved(false); setError(null); }}
            className="form-input pl-10 tabular-nums"
            aria-invalid={Boolean(error)}
          />
        </div>
        <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark">
          {t('sources.limit.save')}
        </button>
        {limit !== DAILY_TARGET && (
          <button
            type="button"
            onClick={() => { reset(); setDraft(formatRupiah(String(DAILY_TARGET))); setSaved(true); setError(null); onChange(DAILY_TARGET); }}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            {t('sources.limit.reset', { amount: rupiahLabel(DAILY_TARGET) })}
          </button>
        )}
      </form>
      {error && <p role="alert" className="mt-2 text-xs font-medium text-red-600">{error}</p>}
      {saved && !error && <p role="status" className="mt-2 text-xs font-medium text-emerald-700">{t('sources.limit.saved')}</p>}
    </Card>
  );
}
