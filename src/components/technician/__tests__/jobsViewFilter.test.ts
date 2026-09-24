import { describe, expect, it } from 'vitest';

import { filterJobsForView } from '../jobsViewFilter';

const now = new Date('2026-09-23T12:00:00Z');
const job = (id: string, start: string, end: string | null) => ({ id, jobs: { start_time: start, end_time: end } });

const ongoing = job('ongoing', '2026-09-23T08:00:00Z', '2026-09-23T23:00:00Z');
const festival = job('festival', '2026-09-21T10:00:00Z', '2026-09-25T02:00:00Z');
const tomorrow = job('tomorrow', '2026-09-24T09:00:00Z', '2026-09-24T18:00:00Z');
const finished = job('finished', '2026-09-22T09:00:00Z', '2026-09-22T18:00:00Z');
const noEnd = job('no-end', '2026-09-23T08:00:00Z', null);
const farFuture = job('far', '2026-12-01T09:00:00Z', '2026-12-01T18:00:00Z');

const ids = (list: Array<{ id: string }>) => list.map((item) => item.id);
const all = [ongoing, festival, tomorrow, finished, noEnd, farFuture];

describe('filterJobsForView', () => {
  it('keeps jobs in progress under Próximos until they end', () => {
    expect(ids(filterJobsForView(all, 'upcoming', '2weeks', now))).toEqual(['ongoing', 'festival', 'tomorrow']);
  });

  it('only moves a job to Pasados once it has ended', () => {
    expect(ids(filterJobsForView(all, 'past', '2weeks', now))).toEqual(['finished', 'no-end']);
  });

  it('moves the job over the moment it ends', () => {
    const justAfterEnd = new Date('2026-09-23T23:00:01Z');
    expect(ids(filterJobsForView([ongoing], 'upcoming', '2weeks', justAfterEnd))).toEqual([]);
    expect(ids(filterJobsForView([ongoing], 'past', '2weeks', justAfterEnd))).toEqual(['ongoing']);
  });

  it('still honours the selected time span', () => {
    expect(ids(filterJobsForView(all, 'upcoming', '3months', now))).toContain('far');
    expect(ids(filterJobsForView(all, 'past', '1week', new Date('2026-10-05T12:00:00Z')))).toEqual([]);
  });
});
