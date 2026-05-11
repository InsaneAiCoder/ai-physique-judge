import { motion } from 'framer-motion';

type Props = {
  pose?: 'front' | 'side' | 'back';
  compact?: boolean;
};

export function PoseExample3D({ pose = 'front', compact = false }: Props) {
  const isSide = pose === 'side';
  const isBack = pose === 'back';

  return (
    <div className={`relative mx-auto ${compact ? 'h-28 w-28' : 'h-80 w-full'} overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50`}>
      {!compact && (
        <>
          <div className="absolute left-8 top-8 h-44 w-24 rounded-[2rem] border border-slate-200 bg-white/70 shadow-premium" />
          <div className="absolute right-8 top-10 h-48 w-24 rounded-[2rem] border border-slate-200 bg-white/60 shadow-premium" />
          <div className="absolute bottom-8 left-8 right-8 h-16 rounded-[2rem] bg-white/70" />
        </>
      )}

      <motion.div
        animate={compact ? undefined : { y: [0, -4, 0] }}
        transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
        className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center ${isSide ? 'scale-x-75' : ''}`}
      >
        <div className={`h-12 w-12 rounded-full bg-gradient-to-br from-blue-100 to-slate-200 shadow-sm ${isBack ? 'ring-4 ring-slate-200/70' : ''}`} />
        <div className={`mt-2 h-28 rounded-[2rem] bg-gradient-to-br from-blue-200 via-slate-100 to-emerald-100 shadow-sm ${isSide ? 'w-12' : 'w-20'}`} />
        <div className={`absolute top-[4.7rem] h-5 rounded-full bg-blue-100 ${isSide ? 'w-16 rotate-6' : 'w-32'}`} />
        <div className="mt-1 flex gap-3">
          <div className="h-20 w-5 rounded-full bg-gradient-to-b from-slate-100 to-blue-100" />
          <div className="h-20 w-5 rounded-full bg-gradient-to-b from-slate-100 to-blue-100" />
        </div>
      </motion.div>

      {!compact && (
        <div className="absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-2">
          {(['Front', 'Side', 'Back'] as const).map((label) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white/85 px-3 py-2 text-center text-xs font-bold text-slate-600 shadow-sm">
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
