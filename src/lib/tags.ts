import type { Transaction } from './transactions';

const TAG_RE = /(?:^|\s)#([\p{L}\p{N}_-]{2,24})/gu;

/** Tag = kata berawalan # di keterangan (mis. "makan siang #kantor"). Tidak mengubah skema Sheets. */
export function extractTags(description: string): string[] {
  const out = new Set<string>();
  for (const m of description.matchAll(TAG_RE)) out.add(m[1].toLowerCase());
  return [...out];
}

export interface TagTotal { tag: string; count: number; expense: number; income: number }

export function tagTotals(list: Transaction[], limit = 12): TagTotal[] {
  const map = new Map<string, TagTotal>();
  for (const tx of list) {
    for (const tag of extractTags(tx.description)) {
      const cur = map.get(tag) ?? { tag, count: 0, expense: 0, income: 0 };
      cur.count += 1;
      if (tx.type === 'expense') cur.expense += tx.total; else cur.income += tx.total;
      map.set(tag, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.expense + b.income - (a.expense + a.income)).slice(0, limit);
}
