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
  wine: { from: '#1B1E15', to: '#0A0C07', text: '#ffffff', muted: '#E3EBD0', accent: '#C8F060' },
  sun: { from: '#EAF8C8', to: '#C8F060', text: '#14160F', muted: '#3A4228', accent: '#14160F' },
  mint: { from: '#4E8A1C', to: '#2E5C10', text: '#ffffff', muted: '#E8F5D0', accent: '#C8F060' },
  night: { from: '#171A12', to: '#07080A', text: '#ffffff', muted: '#DDE4CF', accent: '#A9D43E' },
  rose: { from: '#9A6212', to: '#573406', text: '#ffffff', muted: '#F7E0B4', accent: '#F7E0B4' },
};
