import { describe, expect, it } from 'vitest';
import { aggregateCost, formatEuro, formatEuroRange, rateEstimateKey, tourQuotePairKey } from '../cost';
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

describe('aggregateCost with tour-date quotes', () => {
  it('uses the quote amount for a schedule-only tour-date row, tagged as tour_quote and counted as approved', () => {
    const rows = [
      baseAssignment({
        job_id: 'tour-job-1',
        technician_id: 'tech-1',
        date: '2026-07-15',
        is_schedule_only: true,
        amount_eur: null,
        timesheet_status: null,
      }),
    ];
    const quotes = new Map([[tourQuotePairKey('tour-job-1', 'tech-1'), 200]]);

    const agg = aggregateCost(rows, quotes);
    const cell = agg.byCell.get('tech-1-2026-07-15');
    expect(cell?.amount).toBe(200);
    expect(cell?.source).toBe('tour_quote');
    expect(cell?.approved).toBe(true);
    expect(agg.window.amount).toBe(200);
    expect(agg.window.approved).toBe(200);
  });

  it('still excludes schedule-only rows with no resolvable quote', () => {
    const rows = [
      baseAssignment({ job_id: 'dryhire-job', is_schedule_only: true, amount_eur: null }),
    ];
    const agg = aggregateCost(rows, new Map());
    expect(agg.byCell.size).toBe(0);
    expect(agg.byTech.get('tech-1')?.missingRateCount ?? 0).toBe(0);
  });

  it('surfaces tour-date assignments whose quote cannot be resolved', () => {
    const rows = [
      baseAssignment({
        job_id: 'tour-job-missing-rate',
        is_schedule_only: true,
        amount_eur: null,
        job: { ...baseAssignment({}).job, job_type: 'tourdate' },
      }),
    ];
    const agg = aggregateCost(rows, new Map());

    expect(agg.byCell.get('tech-1-2026-07-15')?.amount).toBeNull();
    expect(agg.byCell.get('tech-1-2026-07-15')?.source).toBe('tour_quote');
    expect(agg.byTech.get('tech-1')?.missingRateCount).toBe(1);
  });

  it('does not apply a tour quote to a non-schedule-only row even if a pair happens to match', () => {
    const rows = [
      baseAssignment({ job_id: 'tour-job-1', technician_id: 'tech-1', is_schedule_only: false, amount_eur: 50 }),
    ];
    const quotes = new Map([[tourQuotePairKey('tour-job-1', 'tech-1'), 200]]);
    const agg = aggregateCost(rows, quotes);
    expect(agg.byCell.get('tech-1-2026-07-15')?.amount).toBe(50);
    expect(agg.byCell.get('tech-1-2026-07-15')?.source).toBe('timesheet');
  });
});

describe('aggregateCost with rate estimates', () => {
  it('attaches an estimate range to a missing-rate cell when the technician/category resolves', () => {
    const rows = [
      baseAssignment({ technician_id: 'tech-1', amount_eur: null, sound_role: 'SND-FOH-T' }),
    ];
    const estimates = new Map([[rateEstimateKey('tech-1', 'tecnico'), { low: 100, high: 220 }]]);

    const agg = aggregateCost(rows, new Map(), estimates);
    const cell = agg.byCell.get('tech-1-2026-07-15');
    expect(cell?.amount).toBeNull();
    expect(cell?.estimate).toEqual({ low: 100, high: 220 });
  });

  it('never rolls estimate amounts into any total', () => {
    const rows = [
      baseAssignment({ technician_id: 'tech-1', amount_eur: null, sound_role: 'SND-FOH-T' }),
    ];
    const estimates = new Map([[rateEstimateKey('tech-1', 'tecnico'), { low: 100, high: 220 }]]);

    const agg = aggregateCost(rows, new Map(), estimates);
    expect(agg.window.amount).toBe(0);
    expect(agg.byTech.get('tech-1')?.amount).toBe(0);
    expect(agg.byTech.get('tech-1')?.missingRateCount).toBe(1);
  });

  it('leaves estimate null when no role code resolves a category', () => {
    const rows = [baseAssignment({ technician_id: 'tech-1', amount_eur: null, sound_role: null })];
    const estimates = new Map([[rateEstimateKey('tech-1', 'tecnico'), { low: 100, high: 220 }]]);

    const agg = aggregateCost(rows, new Map(), estimates);
    expect(agg.byCell.get('tech-1-2026-07-15')?.estimate).toBeNull();
  });
});

describe('formatEuroRange', () => {
  it('renders a rounded low-high range with a single currency symbol', () => {
    expect(formatEuroRange({ low: 100.4, high: 219.6 })).toBe('100–220 €');
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
