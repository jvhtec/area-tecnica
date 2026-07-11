import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/react-query';
import { streakEndingAt, streakTone, DEFAULT_WORKLOAD_THRESHOLDS } from '@/components/matrix/lenses/workload';
import { addMadridCalendarDays } from '@/utils/timezoneUtils';

const LOOKBACK_DAYS = 21;

interface AssignmentWorkloadWarningProps {
  technicianId: string;
  technicianName: string;
  /** The latest date being assigned — the projection point for the streak check. */
  dateIso: string;
}

/**
 * Non-blocking, advisory warning shown in the assignment dialog when the
 * assignment being created would extend the technician's current streak of
 * consecutive worked/scheduled days past the workload lens threshold.
 * Queries independently (small, technician-scoped) rather than depending on
 * the matrix-wide workload lens hook, so it works regardless of which lens
 * the matrix is currently showing.
 */
export const AssignmentWorkloadWarning = ({ technicianId, technicianName, dateIso }: AssignmentWorkloadWarningProps) => {
  const { data: streak } = useQuery({
    queryKey: queryKeys.scope('assignment-workload-warning', technicianId, dateIso),
    queryFn: async () => {
      const lookbackStart = addMadridCalendarDays(dateIso, -LOOKBACK_DAYS);
      const { data, error } = await supabase
        .from('timesheets')
        .select('date')
        .eq('technician_id', technicianId)
        .eq('is_active', true)
        .gte('date', lookbackStart)
        .lte('date', dateIso);
      if (error) return null;

      const dateSet = new Set<string>((data || []).map((row: { date: string }) => row.date));
      dateSet.add(dateIso); // project as if this assignment is already saved
      return streakEndingAt(dateSet, dateIso);
    },
    enabled: !!technicianId && !!dateIso,
    staleTime: 30_000,
  });

  if (!streak || streak < DEFAULT_WORKLOAD_THRESHOLDS.streakWarn) return null;

  const tone = streakTone(streak);
  const toneClass = tone === 'high'
    ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-900 dark:text-red-300'
    : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-300';

  return (
    <div className={`flex items-center gap-2 text-xs rounded-md border p-2 ${toneClass}`}>
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>
        Con esta asignación, {technicianName} llevaría {streak} día{streak === 1 ? '' : 's'} seguidos trabajando.
      </span>
    </div>
  );
};
