// Membuat src/theme-vars.css dari scripts/theme-palette.json. Jalankan: npm run theme
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const p = JSON.parse(readFileSync(join(here, 'theme-palette.json'), 'utf8'));
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ');
const INVERT = { 50: 950, 100: 900, 200: 800, 300: 700, 400: 600, 500: 500, 600: 400, 700: 300, 800: 200, 900: 100, 950: 50 };

let light = '';
let dark = '';
for (const [name, hex] of Object.entries(p.light.flat)) {
  light += `  --c-${name}: ${rgb(hex)};\n`;
  dark += `  --c-${name}: ${rgb(p.dark.flat[name] ?? hex)};\n`;
}
for (const [fam, steps] of Object.entries(p.light.families)) {
  for (const [step, hex] of Object.entries(steps)) {
    light += `  --c-${fam}-${step}: ${rgb(hex)};\n`;
    const d = p.dark.overrides[`${fam}.${step}`] ?? (fam === 'slate' ? p.dark.slate[step] : steps[INVERT[step]]);
    dark += `  --c-${fam}-${step}: ${rgb(d)};\n`;
  }
}
writeFileSync(
  join(here, '..', 'src', 'theme-vars.css'),
  `/* Dibuat otomatis oleh scripts/gen-theme-vars.mjs dari scripts/theme-palette.json. Jangan diedit manual. */\n:root {\n${light}  color-scheme: light;\n}\n:root[data-theme='dark'] {\n${dark}  color-scheme: dark;\n}\n`,
);
