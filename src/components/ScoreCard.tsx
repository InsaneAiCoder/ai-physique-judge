import { motion } from 'framer-motion';

type Props = {
  label: string;
  score: number;
  featured?: boolean;
};

export function ScoreCard({ label, score, featured = false }: Props) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25 }}
      className={`rounded-3xl border p-5 shadow-premium ${
        featured ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className={featured ? 'text-4xl font-black text-electric' : 'text-2xl font-bold text-slate-900'}>{score}</p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <motion.div
          className={featured ? 'h-full rounded-full bg-electric' : 'h-full rounded-full bg-success'}
          initial={{ width: 0 }}
          whileInView={{ width: `${score}%` }}
          viewport={{ once: false }}
          transition={{ duration: 0.85, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  );
}
