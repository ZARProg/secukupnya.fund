import { CheckCircle2, Lock } from 'lucide-react';
import { useT, type MessageKey } from '@/i18n';
import { usePrivacy } from '@/hooks/usePrivacy';
import type { Engagement } from '@/hooks/useEngagement';
import {
  BADGE_EMOJI, BADGE_IDS, CHALLENGES, CHALLENGE_IDS, MIN_GOAL_TARGET, XP, type ChallengeId,
} from '@/lib/engage';
import { shortDate } from '@/lib/format';

export function AchievementsPage({ eng }: { eng: Engagement }) {
  const { t } = useT();
  const { money } = usePrivacy();
  const { level, next } = eng.level;
  const levelName = (key: string) => t(`lvl.${key}` as MessageKey);

  return (
    <div className="space-y-5" data-testid="achievements">
      <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6" aria-label={t('ach.title')}>
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('ach.level', { n: level.level })}</p>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900" data-testid="level-name">{levelName(level.key)}</h2>
          </div>
          <p className="text-lg font-bold tabular-nums text-brand" data-testid="xp-total">{t('ach.xp', { n: eng.xp })}</p>
        </div>
        <div
          className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"
          role="progressbar" aria-valuenow={eng.level.percent} aria-valuemin={0} aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${eng.level.percent}%` }} />
        </div>
        <p className="mt-2 text-sm text-slate-600" data-testid="level-next">
          {next ? t('ach.toNext', { n: next.min - eng.xp, name: levelName(next.key) }) : t('ach.maxLevel')}
        </p>
        <p className="mt-1 text-xs text-slate-400">{t('ach.since', { date: shortDate(eng.start) })}</p>

        <details className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          <summary className="cursor-pointer font-semibold">{t('ach.how.title')}</summary>
          <p className="mt-2 font-medium text-slate-800">{t('ach.how.note')}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>{t('ach.how.log', { n: XP.logDay })}</li>
            <li>{t('ach.how.limit', { n: XP.underLimitDay })}</li>
            <li>{t('ach.how.week', { n: XP.consistentWeek })}</li>
            <li>{t('ach.how.month', { n: XP.budgetMonth })}</li>
            <li>{t('ach.how.goal', { n: XP.goalReached, min: money(MIN_GOAL_TARGET) })}</li>
            <li>{t('ach.how.challenge')}</li>
          </ul>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('ach.breakdown')}</p>
          <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
            {(Object.keys(eng.xpParts) as (keyof typeof eng.xpParts)[]).map((k) => (
              <div key={k} className="flex justify-between gap-2">
                <dt>{t(`ach.part.${k}` as MessageKey)}</dt>
                <dd className="font-semibold tabular-nums">{eng.xpParts[k]}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6" aria-labelledby="ch-title">
        <h2 id="ch-title" className="text-base font-bold tracking-tight text-slate-900">{t('ch.title')}</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">{t('ch.intro')}</p>
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {CHALLENGE_IDS.map((id) => (
            <ChallengeCard key={id} id={id} eng={eng} />
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6" aria-labelledby="badge-title">
        <h2 id="badge-title" className="mb-4 text-base font-bold tracking-tight text-slate-900">{t('badge.title')}</h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BADGE_IDS.map((b) => {
            const date = eng.badges[b];
            return (
              <li
                key={b}
                data-testid={`badge-${b}`}
                data-earned={date ? '1' : '0'}
                className={`flex items-start gap-3 rounded-xl border p-3 ${date ? 'border-amber-200 bg-amber-50/60' : 'border-line bg-slate-50/60'}`}
              >
                <span className={`text-3xl leading-none ${date ? '' : 'opacity-30 grayscale'}`} aria-hidden>{BADGE_EMOJI[b]}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{t(`badge.${b}.name` as MessageKey)}</p>
                  <p className="text-xs text-slate-600">{t(`badge.${b}.how` as MessageKey)}</p>
                  <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${date ? 'text-amber-700' : 'text-slate-400'}`}>
                    {date ? <CheckCircle2 className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                    {date ? t('badge.earned', { date: shortDate(date) }) : t('badge.locked')}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function ChallengeCard({ id, eng }: { id: ChallengeId; eng: Engagement }) {
  const { t } = useT();
  const def = CHALLENGES[id];
  const inst = eng.instances[id];
  const res = eng.challenges[id];
  const status = res?.status;
  const running = status === 'running';
  const finished = !!status && !running;
  const checkedToday = !!inst?.checkins.includes(eng.today);

  const tone =
    status === 'done' ? 'border-emerald-200 bg-emerald-50/60'
    : status === 'failed' || status === 'missed' ? 'border-slate-200 bg-slate-50'
    : 'border-line bg-white';

  return (
    <li className={`rounded-xl border p-4 ${tone}`} data-testid={`challenge-${id}`} data-status={status ?? 'idle'}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-slate-900">{t(`ch.${id}.name` as MessageKey)}</p>
        <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">{t('ch.xp', { n: def.xp })}</span>
      </div>
      <p className="mt-1 text-sm text-slate-600">{t(`ch.${id}.desc` as MessageKey)}</p>
      <p className="mt-1 text-xs text-slate-400">{t(def.mode === 'auto' ? 'ch.mode.auto' : 'ch.mode.checkin')}</p>

      {res && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className={status === 'done' ? 'text-emerald-700' : 'text-slate-600'} data-testid={`challenge-${id}-status`}>
              {t(`ch.status.${status}` as MessageKey)}
            </span>
            <span className="tabular-nums text-slate-500">{t('ch.progress', { n: res.progress, total: res.target })}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(res.progress / res.target) * 100}%` }} />
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {!inst && (
          <button onClick={() => eng.startChallenge(id)} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white">
            {t('ch.start')}
          </button>
        )}
        {running && def.mode === 'checkin' && (
          <button
            onClick={() => eng.checkIn(id)}
            disabled={checkedToday}
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:bg-slate-200 disabled:text-slate-500"
          >
            {t(checkedToday ? 'ch.checkedToday' : 'ch.checkin')}
          </button>
        )}
        {finished && (
          <>
            <button onClick={() => eng.startChallenge(id)} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white">
              {t('ch.restart')}
            </button>
            <button onClick={() => eng.dismissChallenge(id)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100">
              {t('ch.dismiss')}
            </button>
          </>
        )}
      </div>
    </li>
  );
}
