import { Languages } from 'lucide-react';
import { LANGS, useT, type Lang } from '@/i18n';

/** Pilihan bahasa Indonesia / English. Dipakai di sidebar. */
export function LanguageSwitch() {
  const { t, lang, setLang } = useT();
  return (
    <div className="flex items-center justify-between gap-3 px-6 pb-3 pt-1">
      <span className="flex items-center gap-2 text-xs font-medium text-slate-600">
        <Languages className="h-3.5 w-3.5" aria-hidden="true" />
        {t('lang.label')}
      </span>
      <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5" role="group" aria-label={t('lang.label')}>
        {LANGS.map((code: Lang) => (
          <button
            key={code}
            onClick={() => setLang(code)}
            aria-pressed={lang === code}
            aria-label={t('lang.switchTo', { name: t(code === 'id' ? 'lang.id' : 'lang.en') })}
            className={`rounded-md px-2.5 py-1 text-[11px] font-bold uppercase transition-colors ${
              lang === code ? 'bg-card text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {code}
          </button>
        ))}
      </div>
    </div>
  );
}
