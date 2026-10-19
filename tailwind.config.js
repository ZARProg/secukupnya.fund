import { readFileSync } from 'node:fs';

/** @type {import('tailwindcss').Config} */
// Palet merek (dari pemilik): sage #6A795D, olive #8E9162, lime #B2BD7E, krem #FCF0DA.
// Warna lain diturunkan darinya dengan OKLCH (lightness dijaga, kroma diturunkan) dan dicek kontrasnya:
//  - teks kecil memakai brand-600 (sage gelap, 6,2:1 di krem), bukan sage murni (4,1:1);
//  - isian, tombol, ikon, dan hero memakai sage murni (brand / brand-500) dengan teks putih (4,7:1);
//  - olive dan lime hanya untuk isian dan aksen, tidak untuk teks.
// "emerald" dipetakan ke skala brand (pemasukan = hijau sage). "rose" 50-300 = tint brand, 400+ = merah bata untuk bahaya.
// Nilai warna ada di scripts/theme-palette.json. Di sini hanya menjadi variabel CSS (src/theme-vars.css) supaya mode gelap
// cukup mengganti variabel. Setelah mengubah palet: npm run theme.
const palette = JSON.parse(readFileSync(new URL('./scripts/theme-palette.json', import.meta.url), 'utf8'));
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;
const colors = {};
for (const name of Object.keys(palette.light.flat)) colors[name] = v(name);
for (const [fam, steps] of Object.entries(palette.light.families)) {
  colors[fam] = Object.fromEntries(Object.keys(steps).map((s) => [s, v(`${fam}-${s}`)]));
}
for (const [path, step] of Object.entries(palette.light.aliases)) {
  const [fam, alias] = path.split('.');
  colors[fam][alias] = v(`${fam}-${step}`);
}

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors,
      fontFamily: {
        sans: ['Figtree', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Newsreader', 'Georgia', 'Times New Roman', 'serif'],
      },
      borderRadius: { xl: '0.625rem', '2xl': '0.875rem', '3xl': '1.125rem' },
      // Tailwind v3 belum punya ukuran xs/2xs (itu fitur v4), jadi didefinisikan di sini.
      boxShadow: {
        '2xs': '0 1px 0 0 rgb(44 41 28 / 0.04)',
        xs: '0 1px 2px 0 rgb(44 41 28 / 0.06)',
        card: '0 1px 0 rgb(44 41 28 / 0.03)',
      },
      backdropBlur: { xs: '2px' },
    },
  },
  plugins: [],
};
