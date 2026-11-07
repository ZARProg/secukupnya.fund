const P = 'budgettracker.';
export const LAST_BACKUP_KEY = `${P}lastbackup.v1`;
const FIRST_SEEN_KEY = `${P}firstseen.v1`;
const SNOOZE_KEY = `${P}backupsnooze.v1`;
export const REMIND_AFTER_DAYS = 14;
export const SNOOZE_DAYS = 7;
const DAY = 86_400_000;

function num(key: string): number {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}
function put(key: string, v: number): void {
  try { localStorage.setItem(key, String(v)); } catch { /* abaikan */ }
}

/** Dicatat saat pengguna mengunduh cadangan. */
export function markBackup(now = Date.now()): void {
  put(LAST_BACKUP_KEY, now);
}

/** Hari pertama aplikasi dipakai; jadi pengingat tidak muncul untuk pengguna yang baru mulai. */
export function touchFirstSeen(now = Date.now()): void {
  if (!num(FIRST_SEEN_KEY)) put(FIRST_SEEN_KEY, now);
}

export function snoozeBackup(now = Date.now()): void {
  put(SNOOZE_KEY, now + SNOOZE_DAYS * DAY);
}

/** Ingatkan kalau ada data lokal, sudah lewat 14 hari sejak cadangan terakhir (atau sejak pertama dipakai), dan tidak sedang ditunda. */
export function shouldRemindBackup(hasData: boolean, now = Date.now()): boolean {
  if (!hasData) return false;
  if (num(SNOOZE_KEY) > now) return false;
  const base = num(LAST_BACKUP_KEY) || num(FIRST_SEEN_KEY);
  if (!base) return false;
  return now - base >= REMIND_AFTER_DAYS * DAY;
}

export function daysSince(now = Date.now()): number | null {
  const last = num(LAST_BACKUP_KEY);
  return last ? Math.floor((now - last) / DAY) : null;
}
