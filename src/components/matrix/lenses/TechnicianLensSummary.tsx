import React from 'react';
import { cn } from '@/lib/utils';
import type { TechnicianLensSummaryData } from '@/components/matrix/lenses/types';

interface TechnicianLensSummaryProps {
  data: TechnicianLensSummaryData;
  compact?: boolean;
}

const TONE_TEXT: Record<string, string> = {
  neutral: 'text-muted-foreground',
  ok: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  high: 'text-rose-600 dark:text-rose-400',
  muted: 'text-muted-foreground',
};

/** Compact per-technician line under the workload/cost lens, rendered in TechnicianRow. */
const TechnicianLensSummaryComp = ({ data, compact = false }: TechnicianLensSummaryProps) => (
  <div className={cn('leading-tight', compact ? 'text-[9px]' : 'text-[10px]', TONE_TEXT[data.tone || 'neutral'])}>
    <div className="truncate font-medium">{data.primary}</div>
    {data.secondary && !compact && <div className="truncate text-muted-foreground">{data.secondary}</div>}
  </div>
);

export const TechnicianLensSummary = React.memo(TechnicianLensSummaryComp);
