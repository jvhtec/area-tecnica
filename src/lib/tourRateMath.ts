import { TourJobRateQuote } from '@/types/tourRates';

const MULTIPLIER_EPSILON = 0.0001;

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
