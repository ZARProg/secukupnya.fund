import { tr, trp, locale } from '@/i18n';
import { parseISODate } from './date';
import type { RecapData } from './recap';
import { rupiahLabel, rupiahSigned } from './format';
import { HIDDEN_TEXT_PUBLIC } from './recapTheme';

export type CardTheme = 'wine' | 'sun' | 'mint' | 'night' | 'rose';

export interface CardRow {
  label: string;
  value: string;
  /** 0-100 untuk bar; kosong = tanpa bar. */
  pct?: number;
}

export interface StoryCard {
  id: 'intro' | 'spend' | 'category' | 'habits' | 'left';
  theme: CardTheme;
  eyebrow: string;
  title: string;
  big: string;
  sub: string;
  rows: CardRow[];
}

export interface CardOptions {
  showAmounts: boolean;
  level?: { n: number; name: string } | null;
}

export function rangeLabel(d: RecapData): string {
  const loc = locale();
  const a = parseISODate(d.range.from);
  const b = parseISODate(d.range.to);
  if (d.range.kind === 'month') return a.toLocaleDateString(loc, { month: 'long', year: 'numeric' });
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const left = a.toLocaleDateString(loc, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' });
  const right = b.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' });
  return `${left} – ${right}`;
}

export function buildCards(d: RecapData, opt: CardOptions): StoryCard[] {
  const money = (n: number) => (opt.showAmounts ? rupiahLabel(n) : HIDDEN_TEXT_PUBLIC);
  const signed = (n: number) => (opt.showAmounts ? rupiahSigned(n) : HIDDEN_TEXT_PUBLIC);
  const cards: StoryCard[] = [];

  cards.push({
    id: 'intro', theme: 'wine', eyebrow: tr('recap.c1.tag'),
    title: tr(d.range.kind === 'week' ? 'recap.c1.title.week' : 'recap.c1.title.month'),
    big: rangeLabel(d),
    sub: d.partial ? tr('recap.c1.sub.partial', { n: d.elapsed }) : tr('recap.c1.sub.full', { n: d.elapsed }),
    rows: [],
  });

  const change =
    d.change === null ? tr('recap.c2.none')
    : d.change < 0 ? tr('recap.c2.down', { p: -d.change })
    : d.change > 0 ? tr('recap.c2.up', { p: d.change })
    : tr('recap.c2.same');
  cards.push({
    id: 'spend', theme: d.change !== null && d.change > 0 ? 'rose' : 'mint',
    eyebrow: tr('recap.c2.eyebrow'), title: d.partial ? tr('recap.c2.partial') : '',
    big: money(d.expense), sub: change, rows: [],
  });

  if (d.categories.length) {
    const top = d.categories.slice(0, 3);
    cards.push({
      id: 'category', theme: 'sun', eyebrow: tr('recap.c3.eyebrow'), title: top[0].category,
      big: `${top[0].share}%`, sub: tr('recap.c3.sub'),
      rows: top.map((c) => ({ label: c.category, value: money(c.total), pct: c.share })),
    });
  }

  if (d.elapsed > 0) {
    const rows: CardRow[] = [{ label: tr('recap.c4.limit'), value: trp('recap.c4.days', d.underLimitDays), pct: d.loggedDays ? Math.round((d.underLimitDays / d.loggedDays) * 100) : 0 }];
    if (opt.level) rows.push({ label: tr('recap.c4.level', { n: opt.level.n }), value: opt.level.name });
    cards.push({
      id: 'habits', theme: 'night', eyebrow: tr('recap.c4.eyebrow'), title: '',
      big: `${d.loggedDays}/${d.elapsed}`, sub: tr('recap.c4.sub'), rows,
    });
  }

  const hasIncome = d.income > 0;
  cards.push({
    id: 'left', theme: d.net < 0 ? 'rose' : 'wine', eyebrow: tr('recap.c5.eyebrow'), title: '',
    big: hasIncome && d.savingsRate !== null ? `${d.savingsRate}%` : signed(d.net),
    sub: !hasIncome ? tr('recap.c5.noIncome') : d.net < 0 ? tr('recap.c5.over') : tr('recap.c5.sub'),
    rows: [
      { label: tr('recap.c5.income'), value: money(d.income) },
      { label: tr('recap.c5.expense'), value: money(d.expense) },
      { label: tr('recap.c5.net'), value: signed(d.net) },
    ],
  });
  return cards;
}
