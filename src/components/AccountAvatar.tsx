import { getAccountMeta } from '@/lib/categories';

const SIZES = {
  xs: 'h-5 w-5 rounded-md text-[7px]',
  sm: 'h-7 w-7 rounded-lg text-[9px]',
  md: 'h-10 w-10 rounded-xl text-[11px]',
} as const;

/** Monogram berwarna untuk bank atau e-wallet. Bukan logo resmi. */
export function AccountAvatar({ name, size = 'sm' }: { name: string; size?: keyof typeof SIZES }) {
  const meta = getAccountMeta(name);
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center font-extrabold tracking-tight ${SIZES[size]} ${meta.avatar}`}
    >
      {meta.mono}
    </span>
  );
}
