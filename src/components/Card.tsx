import type { ReactNode } from 'react';

export function Card({
  id, icon, title, badge, children,
}: { id?: string; icon: ReactNode; title: string; badge: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-2xl border border-line bg-white p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-brand">{icon}</span>
          <h2 className="text-base font-bold tracking-tight text-slate-900">{title}</h2>
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}

export function Badge({ tone, children }: { tone: 'green' | 'red' | 'slate'; children: ReactNode }) {
  const styles = {
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    slate: 'bg-slate-100 text-slate-600',
  }[tone];
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}>{children}</span>;
}
