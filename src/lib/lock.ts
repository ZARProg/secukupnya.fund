/**
 * Kunci aplikasi dengan PIN. Hanya melindungi tampilan: data tetap di penyimpanan browser tanpa enkripsi,
 * jadi ini menahan orang yang meminjam atau membuka HP-mu, bukan penyerang yang paham teknis.
 * PIN tidak pernah disimpan; yang disimpan hanya hasil PBKDF2 dengan salt acak.
 */
const KEY = 'budgettracker.lock.v1';
const PREFIX = 'budgettracker.';
const KEEP_ON_WIPE = new Set(['budgettracker.lang.v1', 'budgettracker.theme.v1']);

export const PIN_MIN = 4;
export const PIN_MAX = 6;
export const ITERATIONS = 150_000;
/** Detik di latar belakang sebelum terkunci lagi. 0 = langsung saat ditinggalkan. */
export const AUTO_LOCK_OPTIONS = [0, 60, 300, 900] as const;
export type AutoLock = (typeof AUTO_LOCK_OPTIONS)[number];

interface Stored {
  v: 1;
  salt: string;
  hash: string;
  iter: number;
  len: number;
  auto: AutoLock;
  fails: number;
  until: number; // epoch ms: percobaan ditolak sebelum waktu ini
}

function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function isValidPin(pin: string): boolean {
  return /^\d+$/.test(pin) && pin.length >= PIN_MIN && pin.length <= PIN_MAX;
}

/** PIN yang terlalu mudah ditebak: semua digit sama atau urutan naik/turun. */
export function isWeakPin(pin: string): boolean {
  if (/^(\d)\1+$/.test(pin)) return true;
  const d = [...pin].map(Number);
  const step = d[1] - d[0];
  return Math.abs(step) === 1 && d.every((x, i) => i === 0 || x - d[i - 1] === step);
}

export function cryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle && typeof crypto.getRandomValues === 'function';
}

async function derive(pin: string, salt: Uint8Array, iter: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: iter }, key, 256);
  return b64(bits);
}

function equalConst(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function read(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<Stored>;
    if (o.v !== 1 || typeof o.salt !== 'string' || typeof o.hash !== 'string') return null;
    const len = Number(o.len);
    if (!Number.isInteger(len) || len < PIN_MIN || len > PIN_MAX) return null;
    const iter = Number(o.iter);
    return {
      v: 1, salt: o.salt, hash: o.hash,
      iter: Number.isInteger(iter) && iter >= 1000 ? iter : ITERATIONS,
      len,
      auto: (AUTO_LOCK_OPTIONS as readonly number[]).includes(Number(o.auto)) ? (Number(o.auto) as AutoLock) : 60,
      fails: Math.max(0, Math.floor(Number(o.fails) || 0)),
      until: Number(o.until) > 0 ? Number(o.until) : 0,
    };
  } catch {
    return null;
  }
}

function write(s: Stored): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function isLockEnabled(): boolean {
  return read() !== null;
}
export function pinLength(): number {
  return read()?.len ?? 0;
}
export function getAutoLock(): AutoLock {
  return read()?.auto ?? 60;
}
export function setAutoLock(auto: AutoLock): void {
  const s = read();
  if (s) write({ ...s, auto });
}

/** Jeda setelah salah PIN berulang: 5 salah → 30 dtk, lalu berlipat tiap 5 salah berikutnya, maksimal 15 menit. */
export function delayAfterFails(fails: number): number {
  if (fails < 5) return 0;
  const tier = Math.floor(fails / 5) - 1;
  return Math.min(30_000 * 2 ** tier, 15 * 60_000);
}

/** Sisa milidetik sebelum boleh mencoba lagi (0 = boleh). */
export function lockoutRemaining(now = Date.now()): number {
  const s = read();
  return s ? Math.max(0, s.until - now) : 0;
}

export async function setupPin(pin: string, auto: AutoLock = 60): Promise<void> {
  if (!cryptoAvailable()) throw new Error('crypto');
  if (!isValidPin(pin)) throw new Error('invalid');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(pin, salt, ITERATIONS);
  write({ v: 1, salt: b64(salt), hash, iter: ITERATIONS, len: pin.length, auto, fails: 0, until: 0 });
}

export type VerifyResult = { ok: true } | { ok: false; waitMs: number };

export async function verifyPin(pin: string, now = Date.now()): Promise<VerifyResult> {
  const s = read();
  if (!s) return { ok: true };
  if (s.until > now) return { ok: false, waitMs: s.until - now };
  const hash = await derive(pin, unb64(s.salt), s.iter);
  if (equalConst(hash, s.hash)) {
    if (s.fails || s.until) write({ ...s, fails: 0, until: 0 });
    return { ok: true };
  }
  const fails = s.fails + 1;
  const waitMs = delayAfterFails(fails);
  write({ ...s, fails, until: waitMs ? now + waitMs : 0 });
  return { ok: false, waitMs };
}

/** Matikan kunci. Wajib PIN yang benar. */
export async function removePin(pin: string): Promise<boolean> {
  const r = await verifyPin(pin);
  if (!r.ok) return false;
  localStorage.removeItem(KEY);
  return true;
}

/** Lupa PIN: hapus semua data lokal aplikasi (kecuali bahasa/tema) beserta kuncinya. Data di Google Sheets tidak tersentuh. */
export function wipeLocalData(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX) && !KEEP_ON_WIPE.has(k)) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}
