export const RATES_QUERY_KEYS = {
  overview: ['rates', 'overview'] as const,
  extrasCatalog: ['rates', 'catalog', 'extras'] as const,
  baseRates: ['rates', 'catalog', 'base'] as const,
  houseTechList: ['rates', 'house-tech', 'list'] as const,
  houseTechRate: (profileId: string) => ['rates', 'house-tech', 'rate', profileId] as const,
  approvals: ['rates', 'approvals'] as const,
};

export type RatesQueryKey = ReturnType<typeof RATES_QUERY_KEYS.houseTechRate> | typeof RATES_QUERY_KEYS.overview | typeof RATES_QUERY_KEYS.extrasCatalog | typeof RATES_QUERY_KEYS.baseRates | typeof RATES_QUERY_KEYS.houseTechList | typeof RATES_QUERY_KEYS.approvals;
