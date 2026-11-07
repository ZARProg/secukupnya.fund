export const ROLLOVER_KEY = 'budgettracker.rollover.v1';

export function getRollover(): boolean {
  try { return localStorage.getItem(ROLLOVER_KEY) === '1'; } catch { return false; }
}
export function setRollover(on: boolean): void {
  try { localStorage.setItem(ROLLOVER_KEY, on ? '1' : '0'); } catch { /* abaikan */ }
}

/**
 * Anggaran efektif satu bulan. Dengan rollover, sisa anggaran bulan lalu (hanya yang positif, hanya satu bulan, tidak menumpuk
 * berantai) ditambahkan ke anggaran kategori yang sama. Kategori tanpa anggaran tidak punya sisa.
 */
export function effectiveBudgets(
  budgets: Record<string, number>,
  prevSpent: Map<string, number>,
  rollover: boolean,
  prevHasData: boolean,
): { eff: Record<string, number>; carry: Record<string, number> } {
  const eff: Record<string, number> = {};
  const carry: Record<string, number> = {};
  for (const [c, b] of Object.entries(budgets)) {
    const left = rollover && prevHasData ? Math.max(0, b - (prevSpent.get(c) ?? 0)) : 0;
    eff[c] = b + left;
    if (left > 0) carry[c] = left;
  }
  return { eff, carry };
}
