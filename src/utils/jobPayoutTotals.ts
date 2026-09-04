import type { Database } from '@/integrations/supabase/types';
import type { JobPayoutTotals } from '@/types/jobExtras';

export type RawJobPayoutRow =
  Database['public']['Views']['v_job_tech_payout_2025']['Row'];

/**
 * Convert nullable payout-view rows into the domain shape used by the UI and exports.
 * PostgreSQL views are generated with every column nullable, so rows without their
 * job/technician identity are not usable payouts and numeric totals need normalizing.
 */
export const normalizeJobPayoutRows = (
  rows: readonly RawJobPayoutRow[] | null | undefined,
  approvalByTechnician?: ReadonlyMap<string, boolean>,
): JobPayoutTotals[] =>
  (rows ?? []).flatMap((row) => {
    if (!row.job_id || !row.technician_id) return [];

    return [{
      job_id: row.job_id,
      technician_id: row.technician_id,
      timesheets_total_eur: Number(row.timesheets_total_eur ?? 0),
      extras_total_eur: Number(row.extras_total_eur ?? 0),
      expenses_total_eur: Number(row.expenses_total_eur ?? 0),
      total_eur: Number(row.total_eur ?? 0),
      vehicle_disclaimer: Boolean(row.vehicle_disclaimer),
      vehicle_disclaimer_text: row.vehicle_disclaimer_text,
      extras_breakdown: (row.extras_breakdown ?? {}) as JobPayoutTotals['extras_breakdown'],
      expenses_breakdown: (row.expenses_breakdown ?? []) as unknown as JobPayoutTotals['expenses_breakdown'],
      ...(approvalByTechnician
        ? { payout_approved: approvalByTechnician.get(row.technician_id) ?? false }
        : {}),
    }];
  });
