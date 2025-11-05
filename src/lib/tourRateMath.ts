import { TourJobRateQuote } from '@/types/tourRates';

const MULTIPLIER_EPSILON = 0.0001;
const TOTAL_AMOUNT_TOLERANCE = 0.01;

export const calculateQuoteTotal = (
  quote: Pick<TourJobRateQuote, 'total_with_extras_eur' | 'total_eur' | 'extras_total_eur'>
): number => {
  const withExtras = quote.total_with_extras_eur;
  if (typeof withExtras === 'number' && !Number.isNaN(withExtras)) {
    return withExtras;
  }

  const base = typeof quote.total_eur === 'number' && !Number.isNaN(quote.total_eur) ? quote.total_eur : 0;
  const extras =
    typeof quote.extras_total_eur === 'number' && !Number.isNaN(quote.extras_total_eur)
      ? quote.extras_total_eur
      : 0;

  if (extras !== 0 && Math.abs(extras) <= TOTAL_AMOUNT_TOLERANCE) {
    return base;
  }

  return base + extras;
};

export const getPerJobMultiplier = (
  quote: Pick<TourJobRateQuote, 'per_job_multiplier' | 'multiplier' | 'week_count'>
): number | undefined => {
  if (quote.per_job_multiplier && quote.per_job_multiplier > 0) {
    return quote.per_job_multiplier;
  }

  if (!quote.multiplier) {
    return undefined;
  }

  const count = Math.max(1, quote.week_count || 1);
  if (count >= 3 && Math.abs(quote.multiplier - 1) < MULTIPLIER_EPSILON) {
    return 1;
  }
  return quote.multiplier / count;
};

export const formatMultiplier = (value?: number | null) => {
  if (!value || Math.abs(value - 1) < MULTIPLIER_EPSILON) {
    return '—';
  }

  return `×${value.toLocaleString('es-ES', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};

export const shouldDisplayMultiplier = (value?: number | null) => {
  if (!value) return false;
  return Math.abs(value - 1) >= MULTIPLIER_EPSILON;
};
