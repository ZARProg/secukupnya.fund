// Menyalin berkas OCR (tesseract.js) dari node_modules ke public/ocr supaya semuanya disajikan dari domain sendiri.
// Foto struk tidak pernah dikirim ke server mana pun: OCR berjalan di browser, dan mesin serta data bahasanya
// diambil dari situs ini (tanpa CDN pihak ketiga, sesuai CSP).
import { cpSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'ocr');
const nm = join(root, 'node_modules');

// Mesin OCR dipilih otomatis oleh tesseract.js sesuai kemampuan perangkat (SIMD / relaxed SIMD / biasa); hanya varian LSTM yang dipakai.
const files = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['@tesseract.js-data/ind/4.0.0_best_int/ind.traineddata.gz', 'ind.traineddata.gz'],
];

mkdirSync(out, { recursive: true });
let copied = 0;
for (const [from, to] of files) {
  const src = join(nm, from);
  if (!existsSync(src)) {
    console.error(`[ocr] berkas tidak ditemukan: ${from}. Jalankan "npm install" dulu.`);
    process.exit(1);
  }
  const dst = join(out, to);
  if (existsSync(dst) && statSync(dst).size === statSync(src).size) continue;
  cpSync(src, dst);
  copied++;
}
console.log(`[ocr] ${copied} berkas disalin ke public/ocr (${files.length - copied} sudah ada).`);
