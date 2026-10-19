import { Scale, Settings2 } from 'lucide-react';
import { AccountAvatar } from '@/components/AccountAvatar';
import { getAccountMeta } from '@/lib/categories';
import { usePrivacy } from '@/hooks/usePrivacy';
import { useT } from '@/i18n';
import type { AccountBalance } from '@/lib/summary';

interface AccountStripProps {
  accounts: AccountBalance[];
  onSelect: (account: string) => void;
  onManage: () => void;
  onReconcile?: () => void;
}

/** Deretan kartu rekening di dashboard. Klik kartu untuk melihat transaksi rekening itu. */
export function AccountStrip({ accounts, onSelect, onManage, onReconcile }: AccountStripProps) {
  const { t } = useT();
  const { moneySigned: rupiahSigned } = usePrivacy();
  if (!accounts.length) return null;
  return (
    <section aria-labelledby="strip-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="strip-title" className="text-base font-bold tracking-tight text-slate-900">
          {t('shell.accounts')}
        </h2>
        <div className="flex items-center gap-1">
        {onReconcile && (
          <button
            data-testid="recon-open"
            onClick={onReconcile}
            className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 transition-colors hover:bg-rose-50"
          >
            <Scale className="h-3.5 w-3.5" />
            {t('recon.open')}
          </button>
        )}
        <button
          onClick={onManage}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 transition-colors hover:bg-rose-50"
        >
          <Settings2 className="h-3.5 w-3.5" />
          {t('shell.strip.choose')}
        </button>
        </div>
      </div>

      <ul className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:scroll-px-0 sm:px-0">
        {accounts.map(({ account, balance }) => {
          const kind = getAccountMeta(account).kind === 'ewallet' ? 'E-wallet' : 'Bank';
          return (
            <li key={account} className="snap-start">
              <button
                onClick={() => onSelect(account)}
                className="group flex w-44 flex-col gap-4 rounded-2xl border border-line bg-card p-4 text-left transition-colors hover:border-brand/40 hover:bg-rose-50/40"
                aria-label={t('shell.strip.open', { account, balance: rupiahSigned(balance) })}
              >
                <div className="flex items-center gap-2.5">
                  <AccountAvatar name={account} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{account}</p>
                    <p className="text-xs text-slate-500">{kind}</p>
                  </div>
                </div>
                <p
                  className={`text-base font-bold tabular-nums tracking-tight ${
                    balance < 0 ? 'text-red-700' : 'text-slate-900'
                  }`}
                >
                  {rupiahSigned(balance)}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
