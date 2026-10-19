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
  wine: { from: '#6A795D', to: '#3B4631', text: '#ffffff', muted: '#E6EDD3', accent: '#D5DEB0' },
  sun: { from: '#FCF0DA', to: '#B2BD7E', text: '#262B1F', muted: '#3F4733', accent: '#262B1F' },
  mint: { from: '#5E6140', to: '#33361F', text: '#ffffff', muted: '#E8EACB', accent: '#D5DEB0' },
  night: { from: '#2E3827', to: '#171C13', text: '#ffffff', muted: '#DCE4C8', accent: '#B2BD7E' },
  rose: { from: '#9A6212', to: '#573406', text: '#ffffff', muted: '#F7E0B4', accent: '#F7E0B4' },
};
