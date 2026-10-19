import { isBalanceAdjustCategory, isDebtPaymentCategory, isNonSpendingCategory, isTransferCategory } from './categories';
import { monthOf, shiftMonth } from './report';
import { parseISODate, toLocalISO } from './date';
import { MAX_AMOUNT, type Goal } from './plans';
import type { Transaction } from './transactions';

/**
 * Gamifikasi yang hanya menghargai kebiasaan, bukan jumlah transaksi.
 *
 * Prinsip:
 *  - Satu hari tercatat bernilai sama, mau 1 atau 50 transaksi. Mencatat lebih banyak tidak menambah XP.
 *  - Semua dihitung sejak `start` (hari fitur ini mulai dipakai), jadi mengimpor riwayat lama tidak memberi XP instan.
 *  - Hari yang dinilai "aman" hanya hari yang sudah selesai (sebelum hari ini), supaya tidak bisa dibatalkan setelah dihitung.
 *  - Hal yang tidak bisa diverifikasi aplikasi (target tabungan, check-in bekal) dicatat apa adanya dan diberi label.
 */

export const XP = {
  logDay: 5,
  underLimitDay: 5,
  consistentWeek: 20,
  budgetMonth: 50,
  goalReached: 100,
} as const;

export const MIN_GOAL_TARGET = 100_000;
export const WEEK_MIN_DAYS = 5;
export const STREAK_DAYS = 7;
export const MASTER_CHALLENGES = 3;

export interface Level {
  level: number;
  /** XP minimal untuk level ini. */
  min: number;
  key: 'beginner' | 'explorer' | 'saver' | 'master' | 'legend';
}

export const LEVELS: Level[] = [
  { level: 1, min: 0, key: 'beginner' },
  { level: 2, min: 100, key: 'explorer' },
  { level: 3, min: 300, key: 'saver' },
  { level: 4, min: 700, key: 'master' },
  { level: 5, min: 1500, key: 'legend' },
];

export interface LevelInfo {
  level: Level;
  next: Level | null;
  /** XP yang sudah dikumpulkan di dalam level ini. */
  into: number;
  /** XP yang dibutuhkan untuk naik dari level ini; 0 kalau sudah level tertinggi. */
  span: number;
  percent: number;
}

export function levelFor(xp: number): LevelInfo {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i].min) idx = i;
  const level = LEVELS[idx];
  const next = LEVELS[idx + 1] ?? null;
  const span = next ? next.min - level.min : 0;
  const into = xp - level.min;
  return { level, next, into, span, percent: next ? Math.min(100, Math.floor((into / span) * 100)) : 100 };
}

export type BadgeId = 'firstStep' | 'consistentSaver' | 'goalGetter' | 'budgetGuardian' | 'financialMaster';
export const BADGE_IDS: BadgeId[] = ['firstStep', 'consistentSaver', 'goalGetter', 'budgetGuardian', 'financialMaster'];
export const BADGE_EMOJI: Record<BadgeId, string> = {
  firstStep: '🌱', consistentSaver: '🔥', goalGetter: '🎯', budgetGuardian: '🛡️', financialMaster: '💎',
};

// ---------- Tantangan ----------

export type ChallengeId = 'noBoba' | 'lunchbox3' | 'logWeek' | 'underLimit3';
export const CHALLENGE_IDS: ChallengeId[] = ['noBoba', 'lunchbox3', 'logWeek', 'underLimit3'];

export interface ChallengeDef {
  id: ChallengeId;
  xp: number;
  /** Jumlah langkah untuk selesai. */
  target: number;
  /** auto: dinilai dari data transaksi. checkin: konfirmasi harian oleh pengguna. */
  mode: 'auto' | 'checkin';
  period: 'daily' | 'weekly' | 'streak';
  needsLimit?: boolean;
}

export const CHALLENGES: Record<ChallengeId, ChallengeDef> = {
  noBoba: { id: 'noBoba', xp: 15, target: 1, mode: 'auto', period: 'daily' },
  lunchbox3: { id: 'lunchbox3', xp: 30, target: 3, mode: 'checkin', period: 'streak' },
  logWeek: { id: 'logWeek', xp: 40, target: WEEK_MIN_DAYS, mode: 'auto', period: 'weekly' },
  underLimit3: { id: 'underLimit3', xp: 30, target: 3, mode: 'auto', period: 'weekly', needsLimit: true },
};

/** Kata kunci minuman kopi/boba kekinian. Dicocokkan ke deskripsi dan kategori pengeluaran. */
export const BOBA_KEYWORDS = [
  'kopi', 'coffee', 'boba', 'bubble tea', 'kekinian', 'starbucks', 'janji jiwa', 'kenangan', 'fore ', 'chatime',
  'xing fu tang', 'tealive', 'latte', 'americano', 'cappuccino',
];

export function isBobaExpense(tx: Pick<Transaction, 'type' | 'category' | 'description'>): boolean {
  if (tx.type !== 'expense') return false;
  const text = `${tx.description} ${tx.category} `.toLowerCase();
  return BOBA_KEYWORDS.some((k) => text.includes(k));
}

export interface ChallengeInstance {
  start: string;
  /** Tanggal check-in (hanya untuk tantangan checkin). */
  checkins: string[];
}

export type ChallengeStatus = 'running' | 'done' | 'failed' | 'missed';

export interface ChallengeResult {
  status: ChallengeStatus;
  progress: number;
  target: number;
}

export function addDays(iso: string, n: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toLocalISO(d);
}

export interface DayInfo {
  logged: boolean;
  expense: number;
  boba: boolean;
}

export function dayMap(transactions: Transaction[]): Map<string, DayInfo> {
  const map = new Map<string, DayInfo>();
  for (const tx of transactions) {
    if (!tx.date || isTransferCategory(tx.category) || isBalanceAdjustCategory(tx.category)) continue; // penyesuaian saldo bukan kebiasaan mencatat
    const d = map.get(tx.date) ?? { logged: true, expense: 0, boba: false };
    if (isDebtPaymentCategory(tx.category)) {
      map.set(tx.date, d); // tercatat, tetapi bukan konsumsi sehingga tidak masuk batas harian
      continue;
    }
    if (tx.type === 'expense') {
      d.expense += tx.total;
      if (isBobaExpense(tx)) d.boba = true;
    }
    map.set(tx.date, d);
  }
  return map;
}

function underLimit(d: DayInfo | undefined, limit: number): boolean {
  return !!d && limit > 0 && d.expense <= limit;
}

export function evaluateChallenge(
  id: ChallengeId, inst: ChallengeInstance, days: Map<string, DayInfo>, limit: number, today: string,
): ChallengeResult {
  const def = CHALLENGES[id];
  const target = def.target;
  const res = (status: ChallengeStatus, progress: number): ChallengeResult => ({ status, progress: Math.min(progress, target), target });

  if (id === 'noBoba') {
    const d = days.get(inst.start);
    if (d?.boba) return res('failed', 0);
    if (inst.start >= today) return res('running', 0);
    return d?.logged ? res('done', 1) : res('missed', 0);
  }

  if (id === 'lunchbox3') {
    const set = new Set(inst.checkins);
    let run = 0;
    for (let i = 0; i < target; i++) {
      const day = addDays(inst.start, i);
      if (set.has(day)) { run++; continue; }
      // Hari yang lewat tanpa check-in mematahkan rangkaian.
      return day < today ? res('failed', run) : res('running', run);
    }
    return res('done', run);
  }

  // Jendela 7 hari sejak mulai (logWeek dan underLimit3).
  const last = addDays(inst.start, 6);
  const lastCountable = last < today ? last : today;
  if (id === 'logWeek') {
    let n = 0;
    for (let d = inst.start; d <= lastCountable; d = addDays(d, 1)) if (days.get(d)?.logged) n++;
    if (n >= target) return res('done', n);
    return last < today ? res('missed', n) : res('running', n);
  }

  // underLimit3: hanya hari yang sudah selesai yang dihitung.
  let run = 0;
  let best = 0;
  for (let d = inst.start; d <= lastCountable && d < today; d = addDays(d, 1)) {
    run = underLimit(days.get(d), limit) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  if (best >= target) return res('done', best);
  return last < today ? res('missed', best) : res('running', best);
}

// ---------- Hitungan XP dan lencana ----------

export interface Ledger {
  /** `idTantangan@tanggalMulai` -> tanggal selesai. */
  challenges: Record<string, string>;
  /** idTarget -> tanggal tercapai. */
  goals: Record<string, string>;
  /** yyyy-MM -> tanggal dihargai (anggaran tidak terlewati). */
  months: Record<string, string>;
  badges: Partial<Record<BadgeId, string>>;
}

export const EMPTY_LEDGER: Ledger = { challenges: {}, goals: {}, months: {}, badges: {} };

export interface EngageInput {
  transactions: Transaction[];
  goals: Goal[];
  budgets: Record<string, number>;
  limit: number;
  today: string;
  start: string;
  instances: Partial<Record<ChallengeId, ChallengeInstance>>;
  ledger: Ledger;
}

export interface EngageResult {
  xp: number;
  xpParts: { logDays: number; limitDays: number; weeks: number; months: number; goals: number; challenges: number };
  level: LevelInfo;
  longestStreak: number;
  challenges: Partial<Record<ChallengeId, ChallengeResult>>;
  /** Isi baru untuk ledger (belum tersimpan). Kosong kalau tidak ada yang baru. */
  patch: Ledger;
  hasPatch: boolean;
  badges: Record<BadgeId, string | null>;
  newBadges: BadgeId[];
}

function mondayOf(iso: string): string {
  const d = parseISODate(iso);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return toLocalISO(d);
}

/** Bulan yang seluruh harinya sudah lewat dan dimulai pada/ setelah hari mulai. */
function completedMonths(start: string, today: string): string[] {
  const out: string[] = [];
  let m = monthOf(start);
  if (`${m}-01` < start) m = shiftMonth(m, 1);
  while (shiftMonth(m, 1) + '-01' <= today) {
    out.push(m);
    m = shiftMonth(m, 1);
  }
  return out;
}

function budgetsKept(transactions: Transaction[], month: string, budgets: Record<string, number>): boolean {
  if (!Object.keys(budgets).length) return false;
  const spent = new Map<string, number>();
  let any = false;
  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.date || isNonSpendingCategory(tx.category) || monthOf(tx.date) !== month) continue;
    any = true;
    spent.set(tx.category, (spent.get(tx.category) ?? 0) + tx.total);
  }
  if (!any) return false;
  for (const [cat, limit] of Object.entries(budgets)) if ((spent.get(cat) ?? 0) > limit) return false;
  return true;
}

export function computeEngagement(input: EngageInput): EngageResult {
  const { transactions, goals, budgets, limit, today, start, instances, ledger } = input;
  const days = dayMap(transactions);

  // Hari tercatat (termasuk hari ini) dan hari di bawah batas (hanya hari yang sudah selesai), sejak start.
  const logged: string[] = [];
  for (const [date, d] of days) if (d.logged && date >= start && date <= today) logged.push(date);
  logged.sort();
  const limitDays = logged.filter((d) => d < today && underLimit(days.get(d), limit));

  // Minggu yang sudah selesai dengan cukup hari tercatat.
  const weekCount = new Map<string, number>();
  for (const d of logged) {
    const monday = mondayOf(d);
    if (addDays(monday, 6) < today) weekCount.set(monday, (weekCount.get(monday) ?? 0) + 1);
  }
  const weeks = Array.from(weekCount.values()).filter((n) => n >= WEEK_MIN_DAYS).length;

  // Rangkaian terpanjang hari berturut-turut yang tercatat dan di bawah batas.
  let longest = 0;
  let run = 0;
  let prev = '';
  for (const d of limitDays) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  const patch: Ledger = { challenges: {}, goals: {}, months: {}, badges: {} };

  // Tantangan.
  const challenges: EngageResult['challenges'] = {};
  for (const id of CHALLENGE_IDS) {
    const inst = instances[id];
    if (!inst) continue;
    const r = evaluateChallenge(id, inst, days, limit, today);
    challenges[id] = r;
    const key = `${id}@${inst.start}`;
    if (r.status === 'done' && !ledger.challenges[key]) patch.challenges[key] = today;
  }

  // Target tabungan (dilaporkan sendiri oleh pengguna, jadi ada batas minimal nominal).
  for (const g of goals) {
    if (g.target >= MIN_GOAL_TARGET && g.target <= MAX_AMOUNT && g.saved >= g.target && !ledger.goals[g.id]) {
      patch.goals[g.id] = today;
    }
  }

  // Anggaran bulanan yang terjaga.
  for (const m of completedMonths(start, today)) {
    if (!ledger.months[m] && budgetsKept(transactions, m, budgets)) patch.months[m] = today;
  }

  const merged = {
    challenges: { ...ledger.challenges, ...patch.challenges },
    goals: { ...ledger.goals, ...patch.goals },
    months: { ...ledger.months, ...patch.months },
  };
  const nChallenges = Object.keys(merged.challenges).length;
  const nGoals = Object.keys(merged.goals).length;
  const nMonths = Object.keys(merged.months).length;

  const xpParts = {
    logDays: logged.length * XP.logDay,
    limitDays: limitDays.length * XP.underLimitDay,
    weeks: weeks * XP.consistentWeek,
    months: nMonths * XP.budgetMonth,
    goals: nGoals * XP.goalReached,
    challenges: Object.keys(merged.challenges).reduce((s, key) => s + CHALLENGES[key.split('@')[0] as ChallengeId].xp, 0),
  };
  const xp = Object.values(xpParts).reduce((s, n) => s + n, 0);

  // Lencana: sekali didapat tidak dicabut, tanggalnya disimpan.
  const earnedNow: Record<BadgeId, boolean> = {
    firstStep: days.size > 0,
    consistentSaver: longest >= STREAK_DAYS,
    goalGetter: nGoals > 0,
    budgetGuardian: nMonths > 0,
    financialMaster: nChallenges >= MASTER_CHALLENGES,
  };
  const badges = {} as Record<BadgeId, string | null>;
  const newBadges: BadgeId[] = [];
  for (const id of BADGE_IDS) {
    const had = ledger.badges[id];
    if (had) {
      badges[id] = had;
    } else if (earnedNow[id]) {
      badges[id] = today;
      patch.badges[id] = today;
      newBadges.push(id);
    } else {
      badges[id] = null;
    }
  }

  const hasPatch =
    Object.keys(patch.challenges).length + Object.keys(patch.goals).length +
    Object.keys(patch.months).length + Object.keys(patch.badges).length > 0;

  return { xp, xpParts, level: levelFor(xp), longestStreak: longest, challenges, patch, hasPatch, badges, newBadges };
}
