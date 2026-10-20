import { getAccountMeta } from '@/lib/categories';

const SIZES = {
  xs: 'h-5 w-5 rounded-md text-[7px]',
  sm: 'h-7 w-7 rounded-lg text-[9px]',
  md: 'h-10 w-10 rounded-xl text-[11px]',
} as const;

// Logo resmi berbentuk wordmark lebar, jadi chip-nya dibuat memanjang agar tetap terbaca.
const LOGO_BOX = {
  xs: 'h-5 w-9 rounded-md px-1 py-[3px]',
  sm: 'h-7 w-11 rounded-lg px-1.5 py-1',
  md: 'h-10 w-14 rounded-xl px-1.5 py-2',
} as const;

// Logo resmi (opsional) dari src/assets/banks/<slug>.(svg|png|webp). Tanpa berkas, dipakai monogram.
const LOGO_FILES = import.meta.glob('/src/assets/banks/*.{svg,png,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const LOGOS = new Map<string, string>();
for (const [path, url] of Object.entries(LOGO_FILES)) {
  const slug = path.split('/').pop()!.replace(/\.[a-z]+$/i, '').toLowerCase();
  LOGOS.set(slug, url);
}

const slugOf = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Logo bank/e-wallet bila berkasnya ada; kalau tidak, monogram berwarna. */
export function AccountAvatar({ name, size = 'sm' }: { name: string; size?: keyof typeof SIZES }) {
  const meta = getAccountMeta(name);
  const logo = LOGOS.get(slugOf(meta.name));
  if (logo) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex shrink-0 items-center justify-center bg-white ring-1 ring-black/10 ${LOGO_BOX[size]}`}
      >
        <img src={logo} alt="" draggable={false} className="h-full w-full object-contain" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center font-display font-bold tracking-tight ${SIZES[size]} ${meta.avatar}`}
    >
      {meta.mono}
    </span>
  );
}
