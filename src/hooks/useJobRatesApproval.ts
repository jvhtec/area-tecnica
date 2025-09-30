import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Note: rates_approved column doesn't exist in jobs table yet
// These hooks return null/empty data until the column is added
export function useJobRatesApproval(jobId?: string) {
  return useQuery({
    queryKey: ['job-rates-approval', jobId],
    enabled: false, // Disabled until rates_approved column exists
    queryFn: async () => {
      return null;
    }
  });
}

export function useJobRatesApprovalMap(jobIds: string[]) {
  const unique = useMemo(() => Array.from(new Set(jobIds.filter(Boolean))), [jobIds]);
  return useQuery({
    queryKey: ['job-rates-approval-map', unique],
    enabled: false, // Disabled until rates_approved column exists
    queryFn: async () => {
      return new Map<string, boolean>();
    }
  });
}
