import { useQuery } from '@tanstack/react-query';
import { fetchRatesApprovals } from '@/services/ratesService';
import { RATES_QUERY_KEYS } from '@/constants/ratesQueryKeys';

export function useRatesApprovals() {
  return useQuery({
    queryKey: RATES_QUERY_KEYS.approvals,
    queryFn: fetchRatesApprovals,
    staleTime: 30 * 1000,
  });
}
