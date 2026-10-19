/** Tema tampilan: terang, gelap, atau ikut perangkat. Disimpan per perangkat, tidak ikut sinkron. */
export type ThemeMode = 'light' | 'dark' | 'auto';
const KEY = 'budgettracker.theme.v1';
export const THEME_COLOR = { light: '#6A795D', dark: '#151810' } as const;

export function getThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'auto') return v;
  } catch { /* penyimpanan diblokir: ikut perangkat */ }
  return 'auto';
}

export function resolveDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(mode: ThemeMode): void {
  const dark = resolveDark(mode);
  const root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? THEME_COLOR.dark : THEME_COLOR.light);
}

export function setThemeMode(mode: ThemeMode): void {
  try { localStorage.setItem(KEY, mode); } catch { /* berlaku selama halaman terbuka */ }
  applyTheme(mode);
}

/** Pantau perubahan tema perangkat saat mode "ikut perangkat". */
export function watchSystemTheme(): void {
  if (typeof matchMedia !== 'function') return;
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getThemeMode() === 'auto') applyTheme('auto');
  });
}
