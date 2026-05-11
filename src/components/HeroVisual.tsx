import { motion } from 'framer-motion';
import { BarChart3, CheckCircle2 } from 'lucide-react';
import { PoseExample3D } from './PoseExample3D';

export function HeroVisual() {
  const metrics = [
    ['Balance', 82],
    ['Conditioning', 74],
    ['Progress', 88],
  ] as const;

  return (
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
      className="glass premium-ring relative overflow-hidden rounded-[2rem] p-5 shadow-premium"
    >
      <div className="absolute right-6 top-6 z-10 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">
        88/100
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_0.78fr]">
        <PoseExample3D />

        <div className="grid content-between gap-3">
          <PoseMini title="Front" active />
          <PoseMini title="Side" />
          <PoseMini title="Back" />
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
              <BarChart3 size={16} className="text-electric" />
              Progress line
            </div>
            <svg viewBox="0 0 220 72" className="h-16 w-full overflow-visible">
              <path d="M2 58 C42 54 52 38 84 42 C124 47 128 18 164 24 C190 28 196 16 218 12" fill="none" stroke="#3B82F6" strokeWidth="4" strokeLinecap="round" />
              <path d="M2 58 C42 54 52 38 84 42 C124 47 128 18 164 24 C190 28 196 16 218 12" fill="none" stroke="rgba(59,130,246,.18)" strokeWidth="12" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-600">
              <span>{label}</span>
              <span className="text-slate-900">{value}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-electric" style={{ width: `${value}%` }} />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function PoseMini({ title, active = false }: { title: string; active?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-3xl border p-3 ${active ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
      <div className="h-12 w-12 overflow-hidden rounded-2xl bg-white">
        <PoseExample3D pose={title.toLowerCase() as 'front' | 'side' | 'back'} compact />
      </div>
      <div>
        <p className="text-sm font-bold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">Body visible</p>
      </div>
      {active && <CheckCircle2 className="ml-auto text-success" size={18} />}
    </div>
  );
}
