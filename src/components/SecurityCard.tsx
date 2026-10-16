import { useState, type FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Badge, Card } from '@/components/Card';
import { useT } from '@/i18n';
import { isValidToken, getSheetToken } from '@/lib/config';
import { SECURITY_VERSION } from '@/lib/transactions';

interface SecurityCardProps {
  connected: boolean;
  /** Versi script sudah diketahui (pembacaan sukses atau gagal karena token). */
  version: number;
  secured: boolean;
  authRequired: boolean;
  onSaveToken: (token: string) => Promise<void>;
  onRemoveToken: () => void;
}

/** Status keamanan akses Google Sheets + tempat mengisi token. Jujur soal batas perlindungannya. */
export function SecurityCard({ connected, version, secured, authRequired, onSaveToken, onRemoveToken }: SecurityCardProps) {
  const { t } = useT();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!connected) return null;

  const old = !authRequired && version > 0 && version < SECURITY_VERSION;
  const tone = authRequired ? 'red' : old ? 'red' : secured ? 'green' : 'red';
  const badge = authRequired ? t('sec.badge.need') : old ? t('sec.badge.old') : secured ? t('sec.badge.on') : t('sec.badge.off');
  const message = authRequired ? t('sec.need') : old ? t('sec.old', { target: SECURITY_VERSION }) : secured ? t('sec.on') : t('sec.off');
  const hasToken = Boolean(getSheetToken());

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!isValidToken(token)) { setError(t('sec.err.format')); return; }
    setBusy(true);
    try {
      await onSaveToken(token.trim());
      setToken('');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sec.err.format'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card icon={<ShieldCheck className="h-5 w-5" />} title={t('sec.title')} badge={<Badge tone={tone}>{badge}</Badge>}>
      <div data-testid="security-card">
        <p className={`text-sm leading-relaxed ${secured && !authRequired ? 'text-slate-600' : 'font-medium text-red-700'}`} data-testid="security-status">{message}</p>

        {!old && (
          <details className="mt-3 rounded-lg border border-slate-200 text-sm text-slate-600">
            <summary className="cursor-pointer select-none rounded-lg px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50">{t('sec.how.title')}</summary>
            <ol className="list-decimal space-y-1.5 border-t border-slate-100 px-8 py-3 leading-relaxed">
              <li>{t('sec.how.1')}</li>
              <li>{t('sec.how.2')}</li>
              <li>{t('sec.how.3')}</li>
            </ol>
          </details>
        )}

        {!old && (
          <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row" noValidate>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={token}
              onChange={(e) => { setToken(e.target.value); setError(''); }}
              placeholder={hasToken ? '••••••••••••••••' : t('sec.field.token')}
              aria-label={t('sec.field.token')}
              className="form-input font-mono text-xs"
              data-testid="token-input"
            />
            <button type="submit" disabled={busy || !token.trim()} className="shrink-0 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50" data-testid="token-save">
              {t('sec.save')}
            </button>
            {hasToken && (
              <button type="button" onClick={onRemoveToken} className="shrink-0 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                {t('sec.remove')}
              </button>
            )}
          </form>
        )}
        {error && <p role="alert" className="mt-2 text-xs font-medium text-red-600">{error}</p>}
        <p className="mt-4 text-xs leading-relaxed text-slate-500">{t('sec.limits')}</p>
      </div>
    </Card>
  );
}
