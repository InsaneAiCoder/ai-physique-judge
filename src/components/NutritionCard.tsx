import { Utensils } from 'lucide-react';
import type { T } from '../i18n';
import type { Report } from '../types';
import { ReportSection } from './ReportSection';

type Props = {
  t: T;
  report: Report;
};

export function NutritionCard({ t, report }: Props) {
  return (
    <ReportSection title={t.report.nutrition}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Macro label={t.report.kcal} value={report.calories} />
        <Macro label={t.report.protein} value={`${report.macros.protein}g`} />
        <Macro label={t.report.carbs} value={`${report.macros.carbs}g`} />
        <Macro label={t.report.fat} value={`${report.macros.fat}g`} />
      </div>
      <h4 className="mt-6 text-sm font-semibold text-slate-500">{t.report.meals}</h4>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {report.meals.map((meal) => (
          <div key={meal} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
            <Utensils size={17} className="shrink-0 text-success" />
            {meal}
          </div>
        ))}
      </div>
      <h4 className="mt-6 text-sm font-semibold text-slate-500">{t.report.convenience}</h4>
      <div className="mt-3 flex flex-wrap gap-2">
        {report.convenienceFoods.map((food) => (
          <span key={food} className="rounded-full bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
            {food}
          </span>
        ))}
      </div>
    </ReportSection>
  );
}

function Macro({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
