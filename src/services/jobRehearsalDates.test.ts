import { describe, expect, it } from 'vitest';

import {
  buildInclusiveDateRange,
  planJobRehearsalDateSync,
} from './jobRehearsalDates';

describe('buildInclusiveDateRange', () => {
  it('builds an inclusive date range for a multi-day span', () => {
    expect(buildInclusiveDateRange('2026-04-08', '2026-04-10')).toEqual([
      '2026-04-08',
      '2026-04-09',
      '2026-04-10',
    ]);
  });

  it('returns a single date when the end date is omitted', () => {
    expect(buildInclusiveDateRange('2026-04-08')).toEqual(['2026-04-08']);
  });

  it('returns an empty array for an invalid range', () => {
    expect(buildInclusiveDateRange('2026-04-10', '2026-04-08')).toEqual([]);
  });
});

describe('planJobRehearsalDateSync', () => {
  it('seeds missing scheduled dates and deletes out-of-range dates', () => {
    const plan = planJobRehearsalDateSync(
      ['2026-04-08', '2026-04-12'],
      ['2026-04-08', '2026-04-09', '2026-04-10'],
      true
    );

    expect(plan).toEqual({
      toInsert: ['2026-04-09', '2026-04-10'],
      toDelete: ['2026-04-12'],
      retained: ['2026-04-08'],
    });
  });

  it('keeps in-range rows when seedMissing is disabled', () => {
    const plan = planJobRehearsalDateSync(
      ['2026-04-08', '2026-04-09', '2026-04-11'],
      ['2026-04-08', '2026-04-09', '2026-04-10'],
      false
    );

    expect(plan).toEqual({
      toInsert: [],
      toDelete: ['2026-04-11'],
      retained: ['2026-04-08', '2026-04-09'],
    });
  });
});
