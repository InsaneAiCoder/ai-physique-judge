import type { Language } from '../types';
import { languages } from '../i18n';

type Props = {
  language: Language;
  onChange: (language: Language) => void;
};

export function LanguageSwitcher({ language, onChange }: Props) {
  return (
    <div className="flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
      {(Object.keys(languages) as Language[]).map((key) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
            language === key ? 'bg-electric text-white' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          {languages[key]}
        </button>
      ))}
    </div>
  );
}
