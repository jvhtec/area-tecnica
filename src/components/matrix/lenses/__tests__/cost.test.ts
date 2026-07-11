import { describe, expect, it } from 'vitest';
import { aggregateCost, formatEuro } from '../cost';
import type { MatrixTimesheetAssignment } from '@/hooks/useOptimizedMatrixData';

const baseAssignment = (overrides: Partial<MatrixTimesheetAssignment>): MatrixTimesheetAssignment => ({
  job_id: 'job-1',
  technician_id: 'tech-1',
  date: '2026-07-15',
  job: { id: 'job-1', title: 'Job', start_time: '', end_time: '', status: 'Confirmado', job_type: 'single' },
  status: 'confirmed',
  assigned_at: null,
  is_schedule_only: false,
  amount_eur: 100,
  timesheet_status: 'draft',
  ...overrides,
});

describe('aggregateCost', () => {
  it('sums amounts per technician, per date, and for the whole window', () => {
    const rows = [
      baseAssignment({ technician_id: 'tech-1', date: '2026-07-15', amount_eur: 100 }),
      baseAssignment({ technician_id: 'tech-1', date: '2026-07-16', amount_eur: 50 }),
      baseAssignment({ technician_id: 'tech-2', date: '2026-07-15', amount_eur: 75 }),
    ];

    const agg = aggregateCost(rows);
    expect(agg.byTech.get('tech-1')?.amount).toBe(150);
    expect(agg.byDate.get('2026-07-15')?.amount).toBe(175);
    expect(agg.window.amount).toBe(225);
  });

  it('only counts approved amounts toward the approved total', () => {
    const rows = [
      baseAssignment({ amount_eur: 100, timesheet_status: 'approved' }),
      baseAssignment({ technician_id: 'tech-2', amount_eur: 50, timesheet_status: 'draft' }),
    ];
    const agg = aggregateCost(rows);
    expect(agg.window.amount).toBe(150);
    expect(agg.window.approved).toBe(100);
  });

  it('excludes schedule-only rows from cost entirely', () => {
    const rows = [baseAssignment({ is_schedule_only: true, amount_eur: 999 })];
    const agg = aggregateCost(rows);
    expect(agg.window.amount).toBe(0);
    expect(agg.byCell.size).toBe(0);
  });

  it('tracks missing-rate cells separately without breaking totals', () => {
    const rows = [
      baseAssignment({ technician_id: 'tech-1', date: '2026-07-15', amount_eur: null }),
      baseAssignment({ technician_id: 'tech-1', date: '2026-07-16', amount_eur: 100 }),
    ];
    const agg = aggregateCost(rows);
    expect(agg.byTech.get('tech-1')?.missingRateCount).toBe(1);
    expect(agg.byTech.get('tech-1')?.amount).toBe(100);
    expect(agg.byCell.get('tech-1-2026-07-15')?.amount).toBeNull();
  });
});

describe('formatEuro', () => {
  it('formats as whole-euro currency', () => {
    const formatted = formatEuro(1234);
    expect(formatted).toContain('€');
    // Grouping separator rendering is ICU-data-dependent across Node builds;
    // assert on the digits themselves rather than a specific separator.
    expect(formatted.replace(/\D/g, '')).toBe('1234');
  });

  it('rounds to whole euros (no decimals)', () => {
    expect(formatEuro(99.6).replace(/\D/g, '')).toBe('100');
  });
});
