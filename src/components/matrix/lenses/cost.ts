import { formatInTimeZone } from 'date-fns-tz';
import type { MatrixTimesheetAssignment } from '@/hooks/useOptimizedMatrixData';

const MADRID_TIMEZONE = 'Europe/Madrid';

export interface CellCost {
  amount: number | null;
  approved: boolean;
}

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

/**
 * Derives every cost view the cost lens needs from the assignment rows the
 * matrix already fetches. Schedule-only rows carry no cost (nothing was
 * worked), so they're excluded from totals but still tracked as
 * "missing rate" only when they are NOT schedule-only and lack an amount.
 */
export function aggregateCost(assignments: MatrixTimesheetAssignment[]): CostAggregation {
  const byCell = new Map<string, CellCost>();
  const byTech = new Map<string, CostTotal & { missingRateCount: number }>();
  const byDate = new Map<string, CostTotal>();
  const window: CostTotal = { amount: 0, approved: 0 };

  assignments.forEach((assignment) => {
    if (assignment.is_schedule_only) return;

    const approved = assignment.timesheet_status === 'approved';
    const amount = typeof assignment.amount_eur === 'number' ? assignment.amount_eur : null;

    byCell.set(cellKey(assignment.technician_id, assignment.date), { amount, approved });

    const techTotal = byTech.get(assignment.technician_id) || { amount: 0, approved: 0, missingRateCount: 0 };
    const dateTotal = byDate.get(assignment.date) || { amount: 0, approved: 0 };

    if (amount === null) {
      techTotal.missingRateCount += 1;
    } else {
      techTotal.amount += amount;
      dateTotal.amount += amount;
      window.amount += amount;
      if (approved) {
        techTotal.approved += amount;
        dateTotal.approved += amount;
        window.approved += amount;
      }
    }

    byTech.set(assignment.technician_id, techTotal);
    byDate.set(assignment.date, dateTotal);
  });

  return { byCell, byTech, byDate, window };
}

export const formatEuro = (amount: number): string =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);

export const dateKeyFor = (date: Date): string => formatInTimeZone(date, MADRID_TIMEZONE, 'yyyy-MM-dd');

export function costCellKey(technicianId: string, date: Date): string {
  return cellKey(technicianId, dateKeyFor(date));
}
