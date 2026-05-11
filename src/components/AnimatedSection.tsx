import { motion } from 'framer-motion';
import type { PropsWithChildren } from 'react';

type Props = PropsWithChildren<{
  className?: string;
  delay?: number;
  direction?: 'up' | 'left' | 'right';
}>;

export function AnimatedSection({ children, className = '', delay = 0, direction = 'up' }: Props) {
  const offset = direction === 'left' ? { x: -28, y: 0 } : direction === 'right' ? { x: 28, y: 0 } : { x: 0, y: 28 };

  return (
    <motion.section
      className={className}
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: false, amount: 0.24 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.section>
  );
}
