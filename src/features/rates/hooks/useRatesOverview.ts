import { useQuery } from '@tanstack/react-query';
import { fetchRatesOverview } from '@/services/ratesService';
import { RATES_QUERY_KEYS } from '@/constants/ratesQueryKeys';

export function useRatesOverview() {
  return useQuery({
    queryKey: RATES_QUERY_KEYS.overview,
    queryFn: fetchRatesOverview,
    staleTime: 60 * 1000,
  });
}
