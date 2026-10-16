import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BADGE_IDS, CHALLENGES, CHALLENGE_IDS, EMPTY_LEDGER, computeEngagement,
  type BadgeId, type ChallengeId, type ChallengeInstance, type EngageResult, type Ledger,
} from '@/lib/engage';
import { todayISO } from '@/lib/date';
import type { Goal } from '@/lib/plans';
import type { Transaction } from '@/lib/transactions';

const KEY = 'budgettracker.engage.v1';
const DATE = /^\d{4}-\d{2}-\d{2}$/;

interface Stored {
  start: string;
  instances: Partial<Record<ChallengeId, ChallengeInstance>>;
  ledger: Ledger;
}

function dateRecord(v: unknown, keyOk: (k: string) => boolean = () => true): Record<string, string> {
  const out: Record<string, string> = {};
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const [k, d] of Object.entries(v as Record<string, unknown>)) {
      if (typeof d === 'string' && DATE.test(d) && keyOk(k)) out[k] = d;
    }
  }
  return out;
}

export function cleanStored(value: unknown, today: string): Stored {
  const fresh: Stored = { start: today, instances: {}, ledger: EMPTY_LEDGER };
  if (!value || typeof value !== 'object') return fresh;
  const o = value as Record<string, unknown>;
  const start = typeof o.start === 'string' && DATE.test(o.start) && o.start <= today ? o.start : today;
  const instances: Stored['instances'] = {};
  if (o.instances && typeof o.instances === 'object') {
    for (const id of CHALLENGE_IDS) {
      const raw = (o.instances as Record<string, unknown>)[id];
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;
      if (typeof r.start !== 'string' || !DATE.test(r.start) || r.start > today) continue;
      const checkins = Array.isArray(r.checkins)
        ? r.checkins.filter((c): c is string => typeof c === 'string' && DATE.test(c) && c <= today)
        : [];
      instances[id] = { start: r.start, checkins: Array.from(new Set(checkins)).sort() };
    }
  }
  const l = (o.ledger && typeof o.ledger === 'object' ? o.ledger : {}) as Record<string, unknown>;
  const badges: Ledger['badges'] = {};
  const rawBadges = dateRecord(l.badges, (k) => (BADGE_IDS as string[]).includes(k));
  for (const id of BADGE_IDS) if (rawBadges[id]) badges[id] = rawBadges[id];
  const ledger: Ledger = {
    challenges: dateRecord(l.challenges, (k) => (CHALLENGE_IDS as string[]).includes(k.split('@')[0])),
    goals: dateRecord(l.goals),
    months: dateRecord(l.months, (k) => /^\d{4}-\d{2}$/.test(k)),
    badges,
  };
  return { start, instances, ledger };
}

function load(): Stored {
  const today = todayISO();
  try {
    const raw = localStorage.getItem(KEY);
    return cleanStored(raw ? JSON.parse(raw) : null, today);
  } catch {
    return cleanStored(null, today);
  }
}

function save(s: Stored) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Diblokir: kemajuan berlaku sampai halaman ditutup.
  }
}

export interface Engagement extends EngageResult {
  start: string;
  instances: Stored['instances'];
  today: string;
  startChallenge: (id: ChallengeId) => void;
  checkIn: (id: ChallengeId) => void;
  dismissChallenge: (id: ChallengeId) => void;
  /** Lencana yang baru didapat dan belum diberitahukan. */
  fresh: BadgeId[];
  clearFresh: () => void;
}

interface Input {
  transactions: Transaction[];
  goals: Goal[];
  budgets: Record<string, number>;
  limit: number;
  /** False selama data masih dimuat, supaya tidak ada penilaian dari data kosong. */
  ready: boolean;
}

export function useEngagement({ transactions, goals, budgets, limit, ready }: Input): Engagement {
  const [stored, setStored] = useState<Stored>(load);
  const [fresh, setFresh] = useState<BadgeId[]>([]);
  const today = todayISO();

  const result = useMemo(
    () => computeEngagement({
      transactions, goals, budgets, limit, today, start: stored.start, instances: stored.instances, ledger: stored.ledger,
    }),
    [transactions, goals, budgets, limit, today, stored],
  );

  // Simpan hasil yang baru didapat (lencana, tantangan selesai, target tercapai, anggaran terjaga).
  useEffect(() => {
    if (!ready || !result.hasPatch) return;
    const p = result.patch;
    setStored((prev) => {
      const next: Stored = {
        ...prev,
        ledger: {
          challenges: { ...prev.ledger.challenges, ...p.challenges },
          goals: { ...prev.ledger.goals, ...p.goals },
          months: { ...prev.ledger.months, ...p.months },
          badges: { ...prev.ledger.badges, ...p.badges },
        },
      };
      save(next);
      return next;
    });
    if (result.newBadges.length) setFresh((f) => [...f, ...result.newBadges.filter((b) => !f.includes(b))]);
  }, [ready, result]);

  // Simpan juga hari mulai pada kunjungan pertama.
  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) save(stored);
    } catch {
      // abaikan
    }
  }, [stored]);

  const mutate = useCallback((fn: (s: Stored) => Stored) => {
    setStored((prev) => {
      const next = fn(prev);
      save(next);
      return next;
    });
  }, []);

  const startChallenge = useCallback((id: ChallengeId) => {
    mutate((s) => ({ ...s, instances: { ...s.instances, [id]: { start: todayISO(), checkins: [] } } }));
  }, [mutate]);

  const checkIn = useCallback((id: ChallengeId) => {
    if (CHALLENGES[id].mode !== 'checkin') return;
    mutate((s) => {
      const inst = s.instances[id];
      const day = todayISO();
      if (!inst || inst.checkins.includes(day)) return s;
      return { ...s, instances: { ...s.instances, [id]: { ...inst, checkins: [...inst.checkins, day].sort() } } };
    });
  }, [mutate]);

  const dismissChallenge = useCallback((id: ChallengeId) => {
    mutate((s) => {
      const instances = { ...s.instances };
      delete instances[id];
      return { ...s, instances };
    });
  }, [mutate]);

  const clearFresh = useCallback(() => setFresh([]), []);

  return {
    ...result, start: stored.start, instances: stored.instances, today,
    startChallenge, checkIn, dismissChallenge, fresh, clearFresh,
  };
}
