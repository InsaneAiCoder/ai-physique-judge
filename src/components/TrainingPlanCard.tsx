import { Dumbbell } from 'lucide-react';
import type { T } from '../i18n';
import type { Report } from '../types';
import { ReportSection } from './ReportSection';

type Props = {
  t: T;
  report: Report;
};

export function TrainingPlanCard({ t, report }: Props) {
  return (
    <ReportSection title={t.report.training}>
      <div className="grid gap-3">
        {report.training.map((item) => (
          <div key={item} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
            <Dumbbell size={18} className="shrink-0 text-electric" />
            <span className="text-sm text-slate-700">{item}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">{report.cardio}</div>
    </ReportSection>
  );
}
