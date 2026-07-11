import React from 'react';
import { cn } from '@/lib/utils';
import type { CellLensBadgeData } from '@/components/matrix/lenses/types';

const TONE_CLASSES: Record<string, string> = {
  neutral: 'bg-muted text-muted-foreground',
  ok: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  warn: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  high: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  muted: 'bg-muted/60 text-muted-foreground',
};

interface CellLensBadgeProps {
  data: CellLensBadgeData;
}

/**
 * Small pill rendered inside a matrix cell for the workload/cost lenses.
 * Receives only primitives (never a new object identity per render from the
 * caller's Map lookup would be fine too, but keeping this a thin presentational
 * component keeps OptimizedMatrixCell's memo boundary cheap to reason about).
 */
const CellLensBadgeComp = ({ data }: CellLensBadgeProps) => (
  <span
    className={cn(
      'absolute top-0.5 left-1/2 -translate-x-1/2 z-10 text-[9px] leading-none px-1 py-0.5 rounded font-medium pointer-events-none whitespace-nowrap',
      TONE_CLASSES[data.tone] || TONE_CLASSES.neutral,
    )}
    title={data.title}
  >
    {data.label}
  </span>
);

export const CellLensBadge = React.memo(CellLensBadgeComp);
