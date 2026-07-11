import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/react-query';
import { tourQuotePairKey } from '@/components/matrix/lenses/cost';

export interface TourRateQuotePair {
  jobId: string;
  technicianId: string;
}

interface UseMatrixTourRateQuotesArgs {
  pairs: TourRateQuotePair[];
  enabled: boolean;
}

type TourRateQuoteRpcResult = {
  total_with_extras_eur?: number | string | null;
  total_eur?: number | string | null;
  error?: string;
} | null;

const EMPTY_MAP = new Map<string, number>();

/**
 * Real (not estimated) tour-date pay per (job, technician) pair, via the same
 * `compute_tour_job_rate_quote_2025` RPC the payout/quote UI already uses
 * (see useManagerJobQuotes.ts). Tour dates are flat-rate — the amount is
 * knowable the moment the assignment exists, independent of the timesheet
 * (which stays schedule-only/hours-empty for tour dates by design). The RPC
 * itself gates on management/admin role server-side, matching the cost
 * lens's own UI gate.
 *
 * No batch RPC exists, so this fans out one call per pair like the existing
 * per-job quote UI does — acceptable for a single job's roster, but keep an
 * eye on this if a very large multi-department tour window makes the pair
 * count grow into the hundreds.
 */
export const useMatrixTourRateQuotes = ({ pairs, enabled }: UseMatrixTourRateQuotesArgs) => {
  const pairsKey = useMemo(
    () => pairs.map((pair) => tourQuotePairKey(pair.jobId, pair.technicianId)).sort().join(','),
    [pairs],
  );

  const { data } = useQuery({
    queryKey: queryKeys.scope('matrix-tour-rate-quotes', pairsKey),
    queryFn: async () => {
      const map = new Map<string, number>();

      const results = await Promise.all(
        pairs.map(async ({ jobId, technicianId }) => {
          const { data: quote, error } = await supabase.rpc('compute_tour_job_rate_quote_2025', {
            _job_id: jobId,
            _tech_id: technicianId,
          });
          if (error) {
            console.warn('Tour rate quote RPC error', jobId, technicianId, error);
            return null;
          }
          const row = quote as TourRateQuoteRpcResult;
          if (!row || row.error) return null;
          const amount = row.total_with_extras_eur ?? row.total_eur;
          if (amount === null || amount === undefined) return null;
          const numericAmount = Number(amount);
          if (Number.isNaN(numericAmount)) return null;
          return { key: tourQuotePairKey(jobId, technicianId), amount: numericAmount };
        }),
      );

      results.forEach((result) => {
        if (result) map.set(result.key, result.amount);
      });

      return map;
    },
    enabled: enabled && pairs.length > 0,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  return data ?? EMPTY_MAP;
};
