/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as common from './common';
import * as shell from './shell';
import * as sources from './sources';
import * as importer from './importer';
import * as forms from './forms';
import * as extras from './extras';
import * as engage from './engage';
import * as quick from './quick';
import * as debts from './debts';
import * as safety from './safety';
import * as rules from './rules';
import * as ux from './ux';
import * as wealth from './wealth';
import * as scan from './scan';
import * as tools from './tools';
import * as data from './data';

export type Lang = 'id' | 'en';
export const LANGS: Lang[] = ['id', 'en'];
const STORAGE_KEY = 'budgettracker.lang.v1';

const ID = { ...common.id, ...shell.id, ...sources.id, ...importer.id, ...forms.id, ...extras.id, ...engage.id, ...quick.id, ...debts.id, ...rules.id, ...ux.id, ...wealth.id, ...scan.id, ...tools.id, ...data.id, ...safety.id };
export type MessageKey = keyof typeof ID;
const EN: Record<MessageKey, string> = {
  ...common.en, ...shell.en, ...sources.en, ...importer.en, ...forms.en, ...extras.en, ...engage.en, ...quick.en, ...debts.en, ...rules.en, ...ux.en, ...wealth.en, ...scan.en, ...tools.en, ...data.en, ...safety.en,
};
const MESSAGES: Record<Lang, Record<MessageKey, string>> = { id: ID, en: EN };

function loadLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'id' || stored === 'en') return stored;
  } catch {
    // Penyimpanan diblokir: pakai bawaan.
  }
  return 'id';
}

// Bahasa aktif disimpan di variabel modul supaya fungsi biasa (format angka, pesan error di lib/)
// ikut berganti tanpa hook. Komponen memakai useT() agar render ulang saat bahasa berubah.
let current: Lang = loadLang();

export const getLang = (): Lang => current;

/** Locale untuk toLocaleString / toLocaleDateString. */
export const locale = (): string => (current === 'id' ? 'id-ID' : 'en-US');

type Params = Record<string, string | number>;

function fill(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** Terjemahan untuk bahasa aktif. Placeholder {nama} diisi dari params. */
export function tr(key: MessageKey, params?: Params): string {
  return fill(MESSAGES[current][key] ?? MESSAGES.id[key] ?? key, params);
}

/**
 * Bentuk jamak: memakai kunci `${base}_one` (hanya Inggris, saat n = 1) atau `${base}_other`.
 * {n} otomatis berisi jumlahnya.
 */
export function trp(base: string, n: number, params?: Params): string {
  const suffix = current === 'en' && n === 1 ? '_one' : '_other';
  return tr((base + suffix) as MessageKey, { n, ...params });
}

interface LangValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: typeof tr;
  tp: typeof trp;
}

const LangContext = createContext<LangValue>({ lang: current, setLang: () => {}, t: tr, tp: trp });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setState] = useState<Lang>(current);

  const setLang = useCallback((next: Lang) => {
    current = next;
    setState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Tetap berlaku selama halaman terbuka.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = tr('app.title');
  }, [lang]);

  // t dan tp dibuat ulang tiap ganti bahasa, jadi useMemo/useCallback yang memakainya ikut diperbarui.
  const value = useMemo<LangValue>(() => ({ lang, setLang, t: (k, p) => tr(k, p), tp: (b, n, p) => trp(b, n, p) }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useT() {
  return useContext(LangContext);
}
