import { LANGS, useT, type Lang } from '@/i18n';

/** Pilihan bahasa Indonesia / English. Dipakai di sidebar. */
export function LanguageSwitch() {
  const { t, lang, setLang } = useT();
  return (
    <div className="mt-2 grid grid-cols-2 gap-0.5 rounded-lg bg-slate-100 p-0.5" role="group" aria-label={t('lang.label')}>
      {LANGS.map((code: Lang) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          aria-label={t('lang.switchTo', { name: t(code === 'id' ? 'lang.id' : 'lang.en') })}
          className={`min-h-8 rounded-md px-2 text-xs font-semibold transition-colors ${
            lang === code ? 'bg-card text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t(code === 'id' ? 'lang.id' : 'lang.en')}
        </button>
      ))}
    </div>
  );
}
