import { useSyncExternalStore } from 'react';

/**
 * Pendaftaran service worker (hanya di build produksi) dan status "versi baru siap". Versi baru tidak dipasang diam-diam:
 * pengguna yang menekan Muat ulang, supaya formulir yang sedang diisi tidak hilang tiba-tiba.
 */
let registration: ServiceWorkerRegistration | null = null;
let waiting = false;
let lastCheck = 0;
const listeners = new Set<() => void>();
const CHECK_EVERY_MS = 10 * 60 * 1000;

function setWaiting(value: boolean) {
  if (waiting === value) return;
  waiting = value;
  listeners.forEach((l) => l());
}

function watch(reg: ServiceWorkerRegistration) {
  // Hanya anggap "pembaruan" kalau sudah ada pengendali lama; pemasangan pertama tidak perlu muat ulang.
  if (reg.waiting && navigator.serviceWorker.controller) setWaiting(true);
  reg.addEventListener('updatefound', () => {
    const worker = reg.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) setWaiting(true);
    });
  });
}

export function registerServiceWorker() {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((reg) => {
        registration = reg;
        watch(reg);
      })
      .catch((err) => console.warn('Service worker tidak aktif:', err));
  });
  // Aplikasi terpasang di HP jarang dimuat ulang penuh: cek versi baru setiap kali dibuka kembali.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !registration) return;
    if (Date.now() - lastCheck < CHECK_EVERY_MS) return;
    lastCheck = Date.now();
    registration.update().catch(() => { /* offline: coba lagi nanti */ });
  });
}

export function applyUpdate() {
  const worker = registration?.waiting;
  if (!worker) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  worker.postMessage({ type: 'SKIP_WAITING' });
}

export function dismissUpdate() {
  setWaiting(false);
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
};

export const useUpdateReady = () => useSyncExternalStore(subscribe, () => waiting, () => false);

const onlineSubscribe = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};

export const useOnline = () => useSyncExternalStore(onlineSubscribe, () => navigator.onLine, () => true);
