import { useQuery } from '@tanstack/react-query';
import { fetchHouseTechOverrides } from '@/services/ratesService';
import { RATES_QUERY_KEYS } from '@/constants/ratesQueryKeys';

export function useRatesHouseTechList() {
  return useQuery({
    queryKey: RATES_QUERY_KEYS.houseTechList,
    queryFn: fetchHouseTechOverrides,
    staleTime: 60 * 1000,
  });
}
