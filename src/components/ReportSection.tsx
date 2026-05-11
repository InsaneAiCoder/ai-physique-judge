import type { PropsWithChildren } from 'react';

type Props = PropsWithChildren<{
  title: string;
}>;

export function ReportSection({ title, children }: Props) {
  return (
    <section className="glass rounded-3xl p-5 shadow-premium sm:p-6">
      <h3 className="mb-4 text-lg font-bold text-slate-900">{title}</h3>
      {children}
    </section>
  );
}
