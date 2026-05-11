import { Activity, LayoutDashboard } from 'lucide-react';
import type { PropsWithChildren } from 'react';
import type { Language, Page } from '../types';
import type { T } from '../i18n';
import { LanguageSwitcher } from './LanguageSwitcher';
import { CTAButton } from './CTAButton';

type Props = PropsWithChildren<{
  language: Language;
  t: T;
  page: Page;
  onLanguageChange: (language: Language) => void;
  onNavigate: (page: Page) => void;
}>;

export function AppLayout({ children, language, t, page, onLanguageChange, onNavigate }: Props) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <button onClick={() => onNavigate('landing')} className="flex items-center gap-3 text-left">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-electric ring-1 ring-blue-100">
              <Activity size={20} />
            </span>
            <span>
              <span className="block text-sm font-bold tracking-wide text-slate-900">AI Physique Judge</span>
              <span className="block text-xs text-slate-500">{t.common.saved}</span>
            </span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <CTAButton variant={page === 'dashboard' ? 'primary' : 'ghost'} onClick={() => onNavigate('dashboard')}>
              <LayoutDashboard size={16} className="mr-2" />
              {t.nav.dashboard}
            </CTAButton>
            <CTAButton onClick={() => onNavigate('upload')}>{t.nav.new}</CTAButton>
            <LanguageSwitcher language={language} onChange={onLanguageChange} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8">{children}</main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-slate-500 lg:px-8">{t.common.disclaimer}</footer>
    </div>
  );
}
