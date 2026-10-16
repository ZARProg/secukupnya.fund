// Teks umum yang dipakai di banyak tempat.
export const id = {
  'app.title': 'Secukupnya.fund',
  'lang.label': 'Bahasa',
  'lang.id': 'Indonesia',
  'lang.en': 'Inggris',
  'lang.switchTo': 'Ganti bahasa ke {name}',
} as const;

export const en: Record<keyof typeof id, string> = {
  'app.title': 'Secukupnya.fund',
  'lang.label': 'Language',
  'lang.id': 'Indonesian',
  'lang.en': 'English',
  'lang.switchTo': 'Switch language to {name}',
};
