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
  wine: { from: '#1E4D3A', to: '#0E281E', text: '#ffffff', muted: '#DCEBDD', accent: '#A8C7A5' },
  sun: { from: '#EEF4E8', to: '#A8C7A5', text: '#12251B', muted: '#2F4A3A', accent: '#12251B' },
  mint: { from: '#2F6B4F', to: '#174032', text: '#ffffff', muted: '#E1F0E4', accent: '#BFE0C4' },
  night: { from: '#16251D', to: '#08130D', text: '#ffffff', muted: '#D5E4D8', accent: '#8FC49B' },
  rose: { from: '#9A6212', to: '#573406', text: '#ffffff', muted: '#F7E0B4', accent: '#F7E0B4' },
};
