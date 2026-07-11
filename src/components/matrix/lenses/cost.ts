import { formatInTimeZone } from 'date-fns-tz';
import type { MatrixTimesheetAssignment } from '@/hooks/useOptimizedMatrixData';
import { getCategoryFromAssignment } from '@/utils/roleCategory';

const MADRID_TIMEZONE = 'Europe/Madrid';

export type CostSource = 'timesheet' | 'tour_quote';

export interface RateEstimateRange {
  low: number;
  high: number;
}

export interface CellCost {
  amount: number | null;
  approved: boolean;
  source: CostSource;
  /** Rough day-rate-based preview shown only while `amount` is null. Never rolled into totals. */
  estimate?: RateEstimateRange | null;
}

export const rateEstimateKey = (technicianId: string, category: string) => `${technicianId}:${category}`;

export interface CostTotal {
  amount: number;
  approved: number;
}

export interface CostAggregation {
  byCell: Map<string, CellCost>; // `${technicianId}-${dateKey}` -> cost
  byTech: Map<string, CostTotal & { missingRateCount: number }>;
  byDate: Map<string, CostTotal>;
  window: CostTotal;
}

const cellKey = (technicianId: string, dateKey: string) => `${technicianId}-${dateKey}`;
export const tourQuotePairKey = (jobId: string, technicianId: string) => `${jobId}:${technicianId}`;

/**
 * Derives every cost view the cost lens needs from the assignment rows the
 * matrix already fetches, plus tour-date rate quotes (see
 * useMatrixTourRateQuotes) for `tourQuoteAmountByPair`.
 *
 * Tour-date timesheets are always `is_schedule_only` (tour pay is a flat
 * day/tour rate, not hours-based, so there's nothing to "fill in") — for
 * those the real, final amount comes from `tourQuoteAmountByPair` instead of
 * `amount_eur`, which stays null forever on that row. Non-tour schedule-only
 * rows (dry hire) still carry no cost and are excluded, same as before.
 *
 * Tour quotes are counted into the "approved" totals too: tour pay has no
 * draft/approved lifecycle, the quote *is* the settled number.
 *
 * `estimateRangeByTechCategory` (technicianId:category -> {low,high}, see
 * useMatrixRateEstimates) supplies a rough day-rate preview for cells that
 * have no real `amount_eur` yet — deliberately a low/high band (base day
 * rate vs. base + mid-tier bump + overtime out to a long day), not a single
 * number, since it skips night/holiday premiums and shouldn't be read as the
 * final figure. Estimates are attached to the cell but never added to any
 * total (byTech/byDate/window stay real-money-only).
 */
export function aggregateCost(
  assignments: MatrixTimesheetAssignment[],
  tourQuoteAmountByPair: Map<string, number> = new Map(),
  estimateRangeByTechCategory: Map<string, RateEstimateRange> = new Map(),
): CostAggregation {
  const byCell = new Map<string, CellCost>();
  const byTech = new Map<string, CostTotal & { missingRateCount: number }>();
  const byDate = new Map<string, CostTotal>();
  const window: CostTotal = { amount: 0, approved: 0 };

  const addAmount = (technicianId: string, date: string, amount: number, approved: boolean, source: CostSource) => {
    byCell.set(cellKey(technicianId, date), { amount, approved, source });

    const techTotal = byTech.get(technicianId) || { amount: 0, approved: 0, missingRateCount: 0 };
    const dateTotal = byDate.get(date) || { amount: 0, approved: 0 };

    techTotal.amount += amount;
    dateTotal.amount += amount;
    window.amount += amount;
    if (approved) {
      techTotal.approved += amount;
      dateTotal.approved += amount;
      window.approved += amount;
    }

    byTech.set(technicianId, techTotal);
    byDate.set(date, dateTotal);
  };

  assignments.forEach((assignment) => {
    if (assignment.is_schedule_only) {
      const quoteAmount = tourQuoteAmountByPair.get(tourQuotePairKey(assignment.job_id, assignment.technician_id));
      if (quoteAmount === undefined) return;
      addAmount(assignment.technician_id, assignment.date, quoteAmount, true, 'tour_quote');
      return;
    }

    const approved = assignment.timesheet_status === 'approved';
    const amount = typeof assignment.amount_eur === 'number' ? assignment.amount_eur : null;

    if (amount === null) {
      const category = getCategoryFromAssignment(assignment);
      const estimate = category
        ? estimateRangeByTechCategory.get(rateEstimateKey(assignment.technician_id, category)) ?? null
        : null;
      byCell.set(cellKey(assignment.technician_id, assignment.date), {
        amount: null,
        approved: false,
        source: 'timesheet',
        estimate,
      });
      const techTotal = byTech.get(assignment.technician_id) || { amount: 0, approved: 0, missingRateCount: 0 };
      techTotal.missingRateCount += 1;
      byTech.set(assignment.technician_id, techTotal);
      return;
    }

    addAmount(assignment.technician_id, assignment.date, amount, approved, 'timesheet');
  });

  return { byCell, byTech, byDate, window };
}

export const formatEuro = (amount: number): string =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);

export const formatEuroRange = (range: RateEstimateRange): string =>
  `${Math.round(range.low)}–${Math.round(range.high)} €`;

export const dateKeyFor = (date: Date): string => formatInTimeZone(date, MADRID_TIMEZONE, 'yyyy-MM-dd');

export function costCellKey(technicianId: string, date: Date): string {
  return cellKey(technicianId, dateKeyFor(date));
}
