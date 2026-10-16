import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { DatabaseBackup, Download, RefreshCw, Upload } from 'lucide-react';
import { Badge, Card } from '@/components/Card';
import { useT, locale, type MessageKey } from '@/i18n';
import {
  applyData, BACKUP_KEYS, buildBackup, buildSyncBlob, loadSyncMeta, MAX_SYNC_CHARS, parseBackup, parseSyncBlob, saveSyncMeta, settingsFingerprint,
  summarize, SYNC_KEYS, syncState, type BackupFile, type SyncState,
} from '@/lib/backup';
import { fetchSettingsBlob, pushSettingsBlob, SETTINGS_SYNC_VERSION } from '@/lib/transactions';

interface BackupCardProps {
  sheetUrl: string;
  sheetVersion: number;
  authRequired: boolean;
  onNotify: (kind: 'success' | 'error', message: string) => void;
}

function saveFile(name: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toLocaleDateString('en-CA');
const fmt = (iso: string) => new Date(iso).toLocaleString(locale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function BackupCard({ sheetUrl, sheetVersion, authRequired, onNotify }: BackupCardProps) {
  const { t } = useT();
  const [includeConn, setIncludeConn] = useState(false);
  const [file, setFile] = useState<BackupFile | null>(null);
  const [fileError, setFileError] = useState('');
  const [safety, setSafety] = useState(true);
  const [withConn, setWithConn] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function download() {
    saveFile(`secukupnya-backup-${stamp()}.json`, JSON.stringify(buildBackup(localStorage, includeConn), null, 1));
    onNotify('success', t('backup.toast.downloaded'));
  }

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (input.current) input.current.value = '';
    if (!f) return;
    setFile(null);
    setFileError('');
    let text = '';
    try {
      text = await f.text();
    } catch {
      setFileError(t('backup.err.read'));
      return;
    }
    const r = parseBackup(text);
    if (!r.ok) {
      setFileError(t(`backup.err.${r.error}` as MessageKey));
      return;
    }
    setFile(r.file);
    setWithConn(false);
  }

  function restore() {
    if (!file || !window.confirm(t('backup.restore.confirm'))) return;
    try {
      if (safety) saveFile(`secukupnya-backup-sebelum-pulihkan-${stamp()}.json`, JSON.stringify(buildBackup(localStorage, true), null, 1));
      applyData(localStorage, file.data, BACKUP_KEYS, withConn);
      onNotify('success', t('backup.toast.restored'));
      setTimeout(() => window.location.reload(), 700);
    } catch (err) {
      console.error(err);
      onNotify('error', t('backup.toast.failed'));
    }
  }

  const sum = file ? summarize(file.data) : null;

  return (
    <>
      <Card icon={<DatabaseBackup className="h-5 w-5" />} title={t('backup.title')} badge={<Badge tone="slate">.json</Badge>}>
        <div data-testid="backup-card">
          <p className="text-sm leading-relaxed text-slate-600">{t('backup.intro')}</p>
          <p className="mt-2 text-xs text-slate-500">{t('backup.contents')}</p>
          <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
            <input type="checkbox" checked={includeConn} onChange={(e) => setIncludeConn(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#800020]" data-testid="backup-conn" />
            <span>
              {t('backup.includeConn')}
              <span className="block text-xs text-amber-700">{t('backup.includeConn.hint')}</span>
            </span>
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={download} className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark" data-testid="backup-download">
              <Download className="h-4 w-4" /> {t('backup.download')}
            </button>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Upload className="h-4 w-4" /> {t('backup.restore.pick')}
              <input ref={input} type="file" accept="application/json,.json" onChange={pick} className="sr-only" data-testid="backup-file" />
            </label>
          </div>
          {fileError && <p role="alert" className="mt-3 text-xs font-medium text-red-600" data-testid="backup-error">{fileError}</p>}

          {file && sum && (
            <div className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-950" data-testid="backup-preview">
              <p className="font-semibold">{t('backup.restore.preview', { date: fmt(file.createdAt) })}</p>
              <p className="text-xs">{t('backup.restore.line', { tx: sum.transactions, accounts: sum.accounts, budgets: sum.budgets, goals: sum.goals, recurring: sum.recurring, debts: sum.debts, rules: sum.rules, activity: sum.activity })}</p>
              <p className="text-xs font-semibold">{t('backup.restore.warn')}</p>
              <label className="flex cursor-pointer items-start gap-2 text-xs">
                <input type="checkbox" checked={safety} onChange={(e) => setSafety(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#800020]" data-testid="backup-safety" />
                {t('backup.restore.safety')}
              </label>
              {sum.hasConnection && (
                <label className="flex cursor-pointer items-start gap-2 text-xs">
                  <input type="checkbox" checked={withConn} onChange={(e) => setWithConn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#800020]" data-testid="backup-restore-conn" />
                  {t('backup.restore.conn')}
                </label>
              )}
              <div className="flex gap-2">
                <button onClick={restore} className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white" data-testid="backup-restore">{t('backup.restore.go')}</button>
                <button onClick={() => setFile(null)} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-amber-100">{t('backup.restore.cancel')}</button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <SyncCard sheetUrl={sheetUrl} sheetVersion={sheetVersion} authRequired={authRequired} onNotify={onNotify} />
    </>
  );
}

function SyncCard({ sheetUrl, sheetVersion, authRequired, onNotify }: BackupCardProps) {
  const { t } = useT();
  const [state, setState] = useState<SyncState | null>(null);
  const [remote, setRemote] = useState<{ at: string | null; blob: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = Boolean(sheetUrl) && sheetVersion >= SETTINGS_SYNC_VERSION && !authRequired;

  async function check() {
    setBusy(true);
    try {
      const r = await fetchSettingsBlob(sheetUrl);
      setRemote(r);
      setState(syncState(loadSyncMeta(localStorage), settingsFingerprint(localStorage), r.at && r.blob ? r.at : null));
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : t('sync.err.invalid'));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (ready) void check();
    // Cek sekali saat siap; selanjutnya manual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, sheetUrl]);

  async function push() {
    if (state && (state === 'remote_newer' || state === 'both_changed') && !window.confirm(t('sync.confirmPush'))) return;
    const blob = buildSyncBlob(localStorage);
    if (blob.length > MAX_SYNC_CHARS) {
      onNotify('error', t('sync.err.tooBig'));
      return;
    }
    setBusy(true);
    try {
      const at = await pushSettingsBlob(sheetUrl, blob);
      saveSyncMeta(localStorage, { remoteAt: at, fingerprint: settingsFingerprint(localStorage) });
      onNotify('success', t('sync.toast.pushed'));
      await check();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : t('sync.err.invalid'));
    } finally {
      setBusy(false);
    }
  }

  async function pull() {
    setBusy(true);
    try {
      const r = await fetchSettingsBlob(sheetUrl);
      if (!r.blob || !r.at) {
        onNotify('error', t('sync.err.empty'));
        return;
      }
      const parsed = parseSyncBlob(r.blob);
      if (!parsed.ok) {
        onNotify('error', t('sync.err.invalid'));
        return;
      }
      const sum = summarize(parsed.blob.data);
      const line = t('sync.line', { budgets: sum.budgets, goals: sum.goals, recurring: sum.recurring, debts: sum.debts, rules: sum.rules });
      if (!window.confirm(t('sync.confirmPull', { line }))) return;
      applyData(localStorage, parsed.blob.data, SYNC_KEYS);
      saveSyncMeta(localStorage, { remoteAt: r.at, fingerprint: settingsFingerprint(localStorage) });
      onNotify('success', t('sync.toast.pulled'));
      setTimeout(() => window.location.reload(), 700);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : t('sync.err.invalid'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card icon={<RefreshCw className="h-5 w-5" />} title={t('sync.title')} badge={<Badge tone="slate">Sheets</Badge>}>
      <div data-testid="sync-card">
        <p className="text-sm leading-relaxed text-slate-600">{t('sync.intro')}</p>
        {!sheetUrl ? (
          <p className="mt-3 text-xs font-medium text-slate-500">{t('sync.needSheet')}</p>
        ) : authRequired ? (
          <p className="mt-3 text-xs font-medium text-amber-700">{t('sync.needToken')}</p>
        ) : sheetVersion < SETTINGS_SYNC_VERSION ? (
          <p className="mt-3 text-xs font-medium text-amber-700">{t('sync.needVersion', { target: SETTINGS_SYNC_VERSION })}</p>
        ) : (
          <>
            <p className="mt-3 text-sm font-semibold text-slate-800" data-testid="sync-state">{state ? t(`sync.state.${state}` as MessageKey) : t('sync.checking')}</p>
            {remote?.at && <p className="text-xs text-slate-500">{t('sync.lastRemote', { at: fmt(remote.at) })}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={push} disabled={busy} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50" data-testid="sync-push">{t('sync.push')}</button>
              <button onClick={pull} disabled={busy || !remote?.blob} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50" data-testid="sync-pull">{t('sync.pull')}</button>
              <button onClick={check} disabled={busy} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-50">{t('sync.check')}</button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
