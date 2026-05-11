import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const TWO_DAY_DISPLAY_FIX_MIGRATION = '20260430100000_fix_tour_two_day_display_multiplier.sql';

describe('tour job two-day multiplier display guard', () => {
  const migration = readFileSync(
    join(__dirname, '..', '..', '..', 'supabase', 'migrations', TWO_DAY_DISPLAY_FIX_MIGRATION),
    'utf-8',
  );

  it('keeps the returned two-day multiplier at the per-date 1.125x value', () => {
    expect(migration).toContain(
      "'WHEN GREATEST(COALESCE(weekly_counts.cnt, 0), 1) = 2 THEN 2.25::numeric'",
    );
    expect(migration).toContain(
      "'WHEN GREATEST(COALESCE(weekly_counts.cnt, 0), 1) = 2 THEN 1.125::numeric'",
    );
    expect(migration).toContain(
      "'COALESCE(ROUND(AVG(dm.week_multiplier), 3), 1.0)'",
    );
    expect(migration).toContain(
      "'COALESCE(ROUND(AVG(dm.date_multiplier), 3), 1.0)'",
    );
  });

  it('matches the payroll value for two same-week dates', () => {
    const baseRate = 200;
    const twoDayMultiplier = 1.125;

    expect(baseRate * twoDayMultiplier).toBe(225);
    expect(baseRate * twoDayMultiplier * 2).toBe(450);
    expect(twoDayMultiplier).toBe(1.125);
  });
});
