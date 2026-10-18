/*
 * Service worker Secukupnya.fund. Berkas ini dibuat saat build (scripts/vite-sw-plugin.mjs), yang mengisi nilai VERSION, OCR_VERSION, dan PRECACHE di bawah.
 *
 * Yang dilakukan:
 *  - Menyimpan kerangka aplikasi dan semua berkas bawaan build, supaya aplikasi terbuka walau offline.
 *  - Saat online, halaman selalu diambil dari jaringan (versi terbaru); cache hanya cadangan kalau jaringan gagal.
 *  - Berkas mesin OCR (/ocr/) disimpan setelah pertama dipakai, supaya Scan struk jalan offline tanpa unduh ulang.
 *
 * Yang TIDAK dilakukan: tidak menyentuh permintaan ke domain lain (Google Sheets / Apps Script), tidak menyimpan data transaksi,
 * dan tidak menangani permintaan selain GET. Versi baru tidak menimpa versi lama sampai pengguna menekan "Muat ulang".
 */
const VERSION = '__VERSION__';
const OCR_VERSION = '__OCR_VERSION__';
const PRECACHE = __PRECACHE__;

const APP_CACHE = 'secukupnya-app-' + VERSION;
const OCR_CACHE = 'secukupnya-ocr-' + OCR_VERSION;
const SCOPE = self.registration.scope;
const at = (path) => new URL(path, SCOPE).href;
const SHELL = at('index.html');
const PRECACHED = new Set(PRECACHE.map((p) => new URL(at(p)).pathname));
const OCR_PATH = new URL(at('ocr/')).pathname;
const NAV_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE);
      // addAll gagal seluruhnya kalau ada satu berkas hilang: versi lama tetap dipakai, tidak ada pembaruan setengah jadi.
      await cache.addAll(PRECACHE.map((p) => new Request(at(p), { cache: 'reload' })));
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([APP_CACHE, OCR_CACHE]);
      for (const key of await caches.keys()) {
        if (key.startsWith('secukupnya-') && !keep.has(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

async function navigate(request) {
  const cache = await caches.open(APP_CACHE);
  const cached = await cache.match(SHELL);
  const network = fetch(request);
  if (!cached) return network;
  // Jaringan lambat atau putus: setelah beberapa detik pakai salinan tersimpan, jangan biarkan layar menggantung.
  return Promise.race([
    network.catch(() => cached),
    new Promise((resolve) => setTimeout(() => resolve(cached), NAV_TIMEOUT_MS)),
  ]);
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.status === 200 && res.type === 'basic') cache.put(request, res.clone()).catch(() => {});
  return res;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith(OCR_PATH)) {
    event.respondWith(cacheFirst(request, OCR_CACHE));
  } else if (request.mode === 'navigate') {
    event.respondWith(navigate(request));
  } else if (PRECACHED.has(url.pathname)) {
    event.respondWith(cacheFirst(request, APP_CACHE));
  }
});
