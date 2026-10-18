// Membuat sw.js saat build: daftar berkas bawaan build + berkas statis di public/ (kecuali ocr/, yang disimpan saat dipakai).
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const STATIC = ['manifest.webmanifest', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

export function swPrecache({ root }) {
  return {
    name: 'secukupnya-sw-precache',
    apply: 'build',
    generateBundle(_options, bundle) {
      const hash = createHash('sha256');
      const files = ['', 'index.html'];
      for (const name of Object.keys(bundle).sort()) {
        if (name === 'sw.js') continue;
        if (name !== 'index.html') files.push(name);
        // Nama berkas sudah memuat hash isi, tapi index.html perlu dihitung isinya (memuat nama-nama itu).
        const item = bundle[name];
        hash.update(name);
        if (name === 'index.html') hash.update(String(item.source));
      }
      for (const name of STATIC) {
        const p = join(root, 'public', name);
        if (!existsSync(p)) continue;
        files.push(name);
        hash.update(name).update(readFileSync(p));
      }

      // Versi cache OCR mengikuti isi berkas OCR, supaya mesin yang diperbarui tidak bercampur dengan salinan lama.
      const ocrHash = createHash('sha256');
      const ocrDir = join(root, 'public', 'ocr');
      if (existsSync(ocrDir)) {
        for (const f of readdirSync(ocrDir).sort()) ocrHash.update(f).update(String(statSync(join(ocrDir, f)).size));
      }

      const template = readFileSync(join(root, 'scripts', 'sw-template.js'), 'utf8');
      const fill = (src, token, value) => {
        if (src.split(token).length !== 2) throw new Error(`[sw] penanda ${token} harus muncul tepat sekali di sw-template.js`);
        return src.replace(token, () => value);
      };
      let source = fill(template, '__VERSION__', hash.digest('hex').slice(0, 12));
      source = fill(source, '__OCR_VERSION__', ocrHash.digest('hex').slice(0, 12));
      source = fill(source, '__PRECACHE__', JSON.stringify(files));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}
