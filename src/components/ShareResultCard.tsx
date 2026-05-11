import { forwardRef } from 'react';
import type { Report } from '../types';

type Props = {
  report: Report;
  includePhoto: boolean;
};

export const ShareResultCard = forwardRef<HTMLDivElement, Props>(function ShareResultCard({ report, includePhoto }, ref) {
  const coachCommand = report.mainImprovementCommand || report.priorities[0] || 'Train your main weak point this week.';

  return (
    <div ref={ref} className="w-[720px] max-w-full rounded-[2rem] border border-slate-200 bg-white p-8 text-slate-950 shadow-premium">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.16em] text-blue-600">AI Physique Judge</p>
          <h2 className="mt-2 text-3xl font-black">Physique Check</h2>
        </div>
        <div className="rounded-3xl bg-blue-600 px-5 py-4 text-center text-white">
          <p className="text-xs font-bold uppercase tracking-[0.16em]">Score</p>
          <p className="text-4xl font-black">{report.scores.overall}</p>
        </div>
      </div>

      {includePhoto && report.photos.front && (
        <img src={report.photos.front} alt="Shared physique result" className="mt-6 max-h-[360px] w-full rounded-3xl object-cover" />
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <ShareBlock title="Strong Points" items={report.strongParts.slice(0, 3)} tone="green" />
        <ShareBlock title="Improve Next" items={report.weakParts.slice(0, 3)} tone="amber" />
      </div>

      <div className="mt-5 rounded-3xl border border-blue-100 bg-blue-50 p-5">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">Coach Command</p>
        <p className="mt-2 text-lg font-black text-slate-950">{coachCommand}</p>
      </div>

      <p className="mt-5 text-xs font-semibold text-slate-500">For fitness education only. Not medical advice.</p>
    </div>
  );
});

function ShareBlock({ title, items, tone }: { title: string; items: string[]; tone: 'green' | 'amber' }) {
  const color = tone === 'green' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-amber-600 bg-amber-50 border-amber-100';

  return (
    <div className={`rounded-3xl border p-5 ${color}`}>
      <p className="text-xs font-black uppercase tracking-[0.16em]">{title}</p>
      <div className="mt-3 space-y-2">
        {(items.length ? items : ['Keep building consistency.']).map((item) => (
          <p key={item} className="text-sm font-bold text-slate-700">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}
