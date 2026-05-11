import { motion } from 'framer-motion';
import type { PhotoAnnotation } from '../types';

type Props = {
  title: string;
  image: string;
  annotations?: PhotoAnnotation[];
};

const positionClass: Record<PhotoAnnotation['position'], string> = {
  'top-left': 'left-[8%] top-[18%]',
  'top-right': 'right-[8%] top-[18%]',
  'upper-center': 'left-1/2 top-[28%] -translate-x-1/2',
  'middle-left': 'left-[8%] top-[45%]',
  'middle-right': 'right-[8%] top-[45%]',
  center: 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
  'lower-center': 'left-1/2 top-[68%] -translate-x-1/2',
};

const toneClass: Record<PhotoAnnotation['tone'], string> = {
  improve: 'border-blue-200 text-blue-700',
  strong: 'border-emerald-200 text-emerald-700',
  warning: 'border-amber-200 text-amber-700',
};

const dotClass: Record<PhotoAnnotation['tone'], string> = {
  improve: 'bg-blue-500',
  strong: 'bg-emerald-500',
  warning: 'bg-amber-500',
};

export function AnnotatedPhotoFeedback({ title, image, annotations = [] }: Props) {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-4 shadow-premium">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-black text-slate-900">{title}</h3>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">Photo feedback</span>
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative overflow-hidden rounded-3xl bg-slate-100">
        <img src={image} alt={title} className="h-auto w-full rounded-3xl object-cover" />
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {annotations.slice(0, 4).map((annotation, index) => (
            <path
              key={`${annotation.label}-${index}`}
              d={arrowPath(annotation.position)}
              fill="none"
              stroke={arrowColor(annotation.tone)}
              strokeWidth="0.7"
              strokeLinecap="round"
              strokeDasharray="1 1"
            />
          ))}
        </svg>
        {annotations.slice(0, 4).map((annotation, index) => (
          <motion.div
            key={`${annotation.label}-${index}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className={`absolute max-w-[58%] rounded-full border bg-white px-3 py-2 text-[13px] font-black shadow-[0_8px_24px_rgba(15,23,42,0.12)] ${positionClass[annotation.position]} ${toneClass[annotation.tone]}`}
            title={annotation.comment || annotation.label}
          >
            <span className={`mr-2 inline-block h-2 w-2 rounded-full ${dotClass[annotation.tone]}`} />
            {annotation.label}
          </motion.div>
        ))}
      </motion.div>
      {annotations.length === 0 && <p className="mt-3 text-sm text-slate-500">No visual notes for this angle yet.</p>}
    </div>
  );
}

function arrowColor(tone: PhotoAnnotation['tone']) {
  if (tone === 'strong') return '#10B981';
  if (tone === 'warning') return '#F59E0B';
  return '#2563EB';
}

function arrowPath(position: PhotoAnnotation['position']) {
  const paths: Record<PhotoAnnotation['position'], string> = {
    'top-left': 'M 21 25 C 33 29, 38 35, 45 41',
    'top-right': 'M 79 25 C 67 29, 62 35, 55 41',
    'upper-center': 'M 50 33 C 50 39, 50 43, 50 48',
    'middle-left': 'M 23 50 C 34 50, 40 51, 47 52',
    'middle-right': 'M 77 50 C 66 50, 60 51, 53 52',
    center: 'M 50 50 C 50 50, 50 50, 50 50',
    'lower-center': 'M 50 70 C 50 64, 50 59, 50 54',
  };
  return paths[position];
}
