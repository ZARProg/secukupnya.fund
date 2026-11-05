// Teks palet perintah (Ctrl+K).
export const id = {
  'pal.title': 'Perintah cepat',
  'pal.placeholder': 'Cari halaman atau aksi...',
  'pal.go': 'Pindah ke',
  'pal.actions': 'Aksi',
  'pal.empty': 'Tidak ada hasil untuk "{q}"',
  'pal.hide.on': 'Sembunyikan saldo',
  'pal.hide.off': 'Tampilkan saldo',
  'pal.theme': 'Ganti tema terang/gelap',
  'pal.lang': 'Ganti bahasa',
  'pal.hint': '↑↓ pilih · Enter buka · Esc tutup',
  'pal.open': 'Cari halaman atau aksi (Ctrl K)',
  'pal.open.short': 'Cari',
  'pal.topup': 'Top up investasi',
} as const;

export const en: Record<keyof typeof id, string> = {
  'pal.title': 'Quick commands',
  'pal.placeholder': 'Search pages or actions...',
  'pal.go': 'Go to',
  'pal.actions': 'Actions',
  'pal.empty': 'No results for "{q}"',
  'pal.hide.on': 'Hide balances',
  'pal.hide.off': 'Show balances',
  'pal.theme': 'Switch light/dark theme',
  'pal.lang': 'Switch language',
  'pal.hint': '↑↓ choose · Enter open · Esc close',
  'pal.open': 'Search pages or actions (Ctrl K)',
  'pal.open.short': 'Search',
  'pal.topup': 'Top up investment',
};
