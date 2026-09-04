import { describe, expect, it } from 'vitest';
import {
  normalizeJobPayoutRows,
  type RawJobPayoutRow,
} from '@/utils/jobPayoutTotals';

const payoutRow = (overrides: Partial<RawJobPayoutRow> = {}): RawJobPayoutRow => ({
  job_id: 'job-1',
  technician_id: 'tech-1',
  timesheets_total_eur: 100,
  extras_total_eur: 20,
  expenses_total_eur: 5,
  total_eur: 125,
  extras_breakdown: { items: [] },
  expenses_breakdown: [],
  vehicle_disclaimer: false,
  vehicle_disclaimer_text: null,
  ...overrides,
});

describe('normalizeJobPayoutRows', () => {
  it('drops view rows without a complete payout identity', () => {
    expect(normalizeJobPayoutRows([
      payoutRow({ job_id: null }),
      payoutRow({ technician_id: null }),
      payoutRow(),
    ])).toHaveLength(1);
  });

  it('normalizes nullable totals, JSON breakdowns, and approval state', () => {
    const approvals = new Map([['tech-1', true]]);

    expect(normalizeJobPayoutRows([
      payoutRow({
        timesheets_total_eur: null,
        extras_total_eur: null,
        expenses_total_eur: null,
        total_eur: null,
        extras_breakdown: null,
        expenses_breakdown: null,
        vehicle_disclaimer: null,
      }),
    ], approvals)).toEqual([expect.objectContaining({
      timesheets_total_eur: 0,
      extras_total_eur: 0,
      expenses_total_eur: 0,
      total_eur: 0,
      extras_breakdown: {},
      expenses_breakdown: [],
      vehicle_disclaimer: false,
      payout_approved: true,
    })]);
  });

  it('does not invent approval state for unscoped payout consumers', () => {
    expect(normalizeJobPayoutRows([payoutRow()])[0]).not.toHaveProperty('payout_approved');
  });
});
