import { describe, expect, it } from 'vitest';
import { computeFocusFit, sortIdsByFit } from '@/features/matrix-v2/focus/fit';

const DAYS = ['2026-10-13', '2026-10-14'];
const fit = (overrides: Partial<Parameters<typeof computeFocusFit>[0]> = {}) => computeFocusFit({
  jobId: 'job-a',
  jobDayKeys: DAYS,
  assignmentOn: () => undefined,
  isUnavailable: () => false,
  declined: false,
  fridge: false,
  ...overrides,
});

describe('computeFocusFit', () => {
  it('a technician with every day free is "Libre 2/2" and assignable', () => {
    expect(fit()).toMatchObject({ kind: 'free', label: 'Libre 2/2', assignable: true, freeDays: DAYS });
  });

  it('counts only the free days when some are taken elsewhere or off', () => {
    const result = fit({ assignmentOn: (key) => (key === '2026-10-13' ? { job_id: 'job-b' } : undefined) });
    expect(result).toMatchObject({ kind: 'partial-free', label: 'Libre 1/2', assignable: true, freeDays: ['2026-10-14'] });
    const off = fit({ isUnavailable: (key) => key === '2026-10-14' });
    expect(off).toMatchObject({ kind: 'partial-free', freeDays: ['2026-10-13'] });
  });

  it('names the first day when every day is taken by other jobs', () => {
    const result = fit({ assignmentOn: () => ({ job_id: 'job-b' }) });
    expect(result).toMatchObject({ kind: 'busy', label: 'Ocupado mar', assignable: false, freeDays: [] });
  });

  it('is "No disp." when the days are off', () => {
    expect(fit({ isUnavailable: () => true })).toMatchObject({ kind: 'unavailable', label: 'No disp.', assignable: false });
  });

  it('knows who is already on the job, wholly or in part', () => {
    expect(fit({ assignmentOn: () => ({ job_id: 'job-a' }) })).toMatchObject({ kind: 'assigned', label: 'Asignado', assignable: false });
    const some = fit({ assignmentOn: (key) => (key === '2026-10-13' ? { job_id: 'job-a' } : undefined) });
    expect(some).toMatchObject({ kind: 'partial', label: 'Asignado 1/2', assignable: true, freeDays: ['2026-10-14'] });
  });

  it('fridge and declined win over everything else', () => {
    expect(fit({ fridge: true, declined: true })).toMatchObject({ kind: 'fridge', label: 'Nevera', assignable: false });
    expect(fit({ declined: true })).toMatchObject({ kind: 'declined', label: 'Rechazó', assignable: false });
  });

  it('a job with no days on the grid has nothing to assign', () => {
    expect(fit({ jobDayKeys: [] })).toMatchObject({ kind: 'busy', assignable: false });
  });
});

describe('sortIdsByFit', () => {
  it('puts the best fit first and keeps ties in their incoming order', () => {
    const fits = new Map([
      ['a', fit({ declined: true })],
      ['b', fit()],
      ['c', fit({ assignmentOn: () => ({ job_id: 'job-b' }) })],
      ['d', fit()],
      ['e', fit({ fridge: true })],
    ]);
    expect(sortIdsByFit(['a', 'b', 'c', 'd', 'e'], fits)).toEqual(['b', 'd', 'c', 'a', 'e']);
  });

  it('sends ids without a fit after the free ones', () => {
    expect(sortIdsByFit(['x', 'y'], new Map([['y', fit()]]))).toEqual(['y', 'x']);
  });
});
