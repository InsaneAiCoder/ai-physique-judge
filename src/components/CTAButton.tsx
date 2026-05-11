import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type Props = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }>;

export function CTAButton({ children, className = '', variant = 'primary', ...props }: Props) {
  const styles =
    variant === 'primary'
      ? 'bg-electric text-white shadow-[0_12px_24px_rgba(37,99,235,0.18)] hover:bg-[#1D4ED8]'
      : 'border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50';

  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition duration-300 hover:-translate-y-0.5 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-45 ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
