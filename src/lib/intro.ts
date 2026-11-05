export const INTRO_FLAG = 'budgettracker.onboarded.v1';

/** Tampil hanya untuk pengguna baru: belum pernah menandai selesai dan belum memilih rekening. `?intro=0` melewati. */
export function shouldShowIntro(): boolean {
  try {
    if (new URLSearchParams(location.search).get('intro') === '0') {
      localStorage.setItem(INTRO_FLAG, '1');
      return false;
    }
    return !localStorage.getItem(INTRO_FLAG) && !localStorage.getItem('budgettracker.accounts.v1');
  } catch {
    return false;
  }
}

