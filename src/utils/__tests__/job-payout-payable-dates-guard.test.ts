import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('job payout payable-date source guard', () => {
  const source = readFileSync(
    join(
      __dirname,
      '..',
      '..',
      'components',
      'jobs',
      'payout-totals',
      'useJobPayoutData.ts',
    ),
    'utf-8',
  );

  it('builds technician rate-mode dates from all payable-date sources', () => {
    expect(source).toMatch(/queryKeys\.scope\('job-tech-timesheet-dates', jobId\)/);
    expect(source).toMatch(/from\('timesheets'\)[\s\S]*select\('technician_id, date'\)/);
    expect(source).toMatch(/from\('job_assignments'\)[\s\S]*select\('technician_id, single_day, assignment_date'\)/);
    expect(source).toMatch(/from\('job_date_types'\)[\s\S]*select\('date, type'\)/);
    expect(source).toMatch(/from\('tour_dates'\)[\s\S]*select\('start_date, end_date, date'\)/);
    expect(source).toMatch(/row\.type === 'prep_day'/);
    expect(source).toMatch(/row\.type !== 'rigging'/);
    expect(source).toMatch(/fallbackScheduleDates/);
  });

  it('keeps payout edits locked for non-admins while closure metadata is unknown', () => {
    expect(source).toMatch(/!isAdmin[\s\S]*jobMetaLoading[\s\S]*Boolean\(jobMetaError\)[\s\S]*isJobPastClosureWindow/);
  });
});
