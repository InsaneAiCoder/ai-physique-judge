import { CalendarDays } from 'lucide-react';
import { translations } from '../i18n';
import type { T } from '../i18n';
import type { Report } from '../types';
import { CTAButton } from './CTAButton';

type Props = {
  t: T;
  report: Report;
  onOpen: () => void;
};

export function DashboardReportCard({ t, report, onOpen }: Props) {
  const date = new Intl.DateTimeFormat(t.common.locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(report.createdAt));
  const goalLabel = localizeGoal(report.form.goal, t);

  return (
    <article
      className="glass cursor-pointer overflow-hidden rounded-3xl shadow-premium transition duration-300 hover:-translate-y-1 hover:border-blue-200"
      onClick={onOpen}
    >
      {report.photos.front && <img src={report.photos.front} alt="" className="h-44 w-full object-cover" />}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <CalendarDays size={14} />
              {date}
            </p>
            <h3 className="mt-2 text-xl font-bold text-slate-900">{report.aiOverall?.physiqueScore ?? report.scores.overall}/100</h3>
            <p className="mt-1 text-xs text-slate-500">{report.form.weight ? `${report.form.weight} kg` : ''}</p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-electric">{goalLabel}</span>
        </div>
        <p className="mt-4 line-clamp-2 text-sm text-slate-500">{report.mainWeakPoint || report.weakParts[0]}</p>
        <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-700">{report.mainImprovementCommand || report.priorities[0]}</p>
        <CTAButton
          className="mt-5 w-full"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          {t.dashboard.open}
        </CTAButton>
      </div>
    </article>
  );
}

function localizeGoal(goal: string, t: T) {
  const goalSets = Object.values(translations).map((translation) => [...translation.form.goalOptions] as string[]);
  const index = goalSets.find((options) => options.includes(goal))?.indexOf(goal) ?? -1;
  return index >= 0 ? t.form.goalOptions[index] : goal;
}
