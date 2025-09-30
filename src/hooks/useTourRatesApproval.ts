import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Note: rates_approved column doesn't exist in tours table yet
// These hooks return null/empty data until the column is added
export function useTourRatesApproval(tourId?: string) {
  return useQuery({
    queryKey: ['tour-rates-approval', tourId],
    enabled: false, // Disabled until rates_approved column exists
    queryFn: async () => {
      return null;
    }
  });
}

export function useTourRatesApprovalMap(tourIds: string[]) {
  const unique = useMemo(() => Array.from(new Set(tourIds.filter(Boolean))), [tourIds]);
  return useQuery({
    queryKey: ['tour-rates-approval-map', unique],
    enabled: false, // Disabled until rates_approved column exists
    queryFn: async () => {
      return new Map<string, boolean>();
    }
  });
}
