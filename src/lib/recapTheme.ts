import type { CardTheme } from './recapCards';

/** Teks pengganti nominal di kartu yang dibagikan. */
export const HIDDEN_TEXT_PUBLIC = 'Rp ••••••';

export interface ThemeColors {
  from: string;
  to: string;
  text: string;
  muted: string;
  accent: string;
}

export const THEMES: Record<CardTheme, ThemeColors> = {
  wine: { from: '#800020', to: '#3d0010', text: '#ffffff', muted: '#f4b6c4', accent: '#f4b6c4' },
  sun: { from: '#ffb703', to: '#fb8500', text: '#2b1400', muted: '#5c3300', accent: '#2b1400' },
  mint: { from: '#0f766e', to: '#064e3b', text: '#ffffff', muted: '#a7f3d0', accent: '#a7f3d0' },
  night: { from: '#1e1b4b', to: '#0f172a', text: '#ffffff', muted: '#c7d2fe', accent: '#a5b4fc' },
  rose: { from: '#be123c', to: '#7f1d1d', text: '#ffffff', muted: '#fecdd3', accent: '#fecdd3' },
};
