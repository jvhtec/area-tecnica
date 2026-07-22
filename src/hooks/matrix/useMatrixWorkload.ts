import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/react-query';
import {
  buildCellWorkloadMap,
  buildTechWorkloadSummaries,
  type CellWorkload,
  type TechWorkloadSummary,
} from '@/components/matrix/lenses/workload';

const MADRID_TIMEZONE = 'Europe/Madrid';
const LOOKBACK_DAYS = 21;

interface UseMatrixWorkloadArgs {
  technicianIds: string[];
  dates: Date[];
  enabled: boolean;
}

interface WorkloadDateRow {
  technician_id: string;
  date: string;
}

function shiftDate(date: Date, days: number): Date {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

const EMPTY_CELL_MAP = new Map<string, CellWorkload>();
const EMPTY_TECH_MAP = new Map<string, TechWorkloadSummary>();

/**
 * Workload/fairness lens data source. Pulls scheduled/worked dates for every
 * matrix technician over the visible window plus a 21-day lookback (needed so
 * streaks near the left edge of the window are correct), then hands the raw
 * date sets to the pure aggregation functions in lenses/workload.ts.
 */
export const useMatrixWorkload = ({ technicianIds, dates, enabled }: UseMatrixWorkloadArgs) => {
  const dateKeys = useMemo(
    () => dates.map((date) => formatInTimeZone(date, MADRID_TIMEZONE, 'yyyy-MM-dd')),
    [dates],
  );
  const technicianIdsKey = useMemo(() => technicianIds.slice().sort().join(','), [technicianIds]);
  const windowStart = dates[0];
  const windowEnd = dates[dates.length - 1];
  const lookbackStartKey = windowStart
    ? formatInTimeZone(shiftDate(windowStart, -LOOKBACK_DAYS), MADRID_TIMEZONE, 'yyyy-MM-dd')
    : undefined;
  const windowEndKey = windowEnd ? formatInTimeZone(windowEnd, MADRID_TIMEZONE, 'yyyy-MM-dd') : undefined;

  const { data: datesByTech } = useQuery({
    queryKey: queryKeys.scope('matrix-workload-dates', technicianIdsKey, lookbackStartKey, windowEndKey),
    queryFn: async () => {
      const map = new Map<string, Set<string>>();
      if (!technicianIds.length || !lookbackStartKey || !windowEndKey) return map;

      const batchSize = 100;
      for (let i = 0; i < technicianIds.length; i += batchSize) {
        const batch = technicianIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('timesheets')
          .select('technician_id, date')
          .eq('is_active', true)
          .in('technician_id', batch)
          .gte('date', lookbackStartKey)
          .lte('date', windowEndKey)
          .limit(5000);

        if (error) {
          console.warn('Workload lens query error', error);
          continue;
        }

        (data as WorkloadDateRow[] | null || []).forEach((row) => {
          if (!map.has(row.technician_id)) map.set(row.technician_id, new Set());
          map.get(row.technician_id)!.add(row.date);
        });
      }

      return map;
    },
    enabled: enabled && technicianIds.length > 0 && !!lookbackStartKey && !!windowEndKey,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const byCell = useMemo(() => {
    if (!enabled || !datesByTech) return EMPTY_CELL_MAP;
    return buildCellWorkloadMap(datesByTech, dateKeys);
  }, [enabled, datesByTech, dateKeys]);

  const todayKey = useMemo(() => formatInTimeZone(new Date(), MADRID_TIMEZONE, 'yyyy-MM-dd'), []);
  const byTech = useMemo(() => {
    if (!enabled || !datesByTech) return EMPTY_TECH_MAP;
    return buildTechWorkloadSummaries(datesByTech, todayKey);
  }, [enabled, datesByTech, todayKey]);

  return { byCell, byTech };
};
