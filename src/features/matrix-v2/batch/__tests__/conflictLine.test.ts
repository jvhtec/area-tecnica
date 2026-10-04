import { describe, expect, it } from 'vitest';
import { conflictLine } from '@/features/matrix-v2/batch/conflictLine';
import type { BatchFailure } from '@/features/matrix-v2/batch/types';

const job = (title: string) => ({ id: title, title, start_time: '', end_time: '', status: 'Confirmado' });
const failure = (conflicts: Partial<NonNullable<BatchFailure['conflict']>['conflicts']>): BatchFailure => ({
  ok: false, code: 'conflict', message: 'x', stale: false, retryable: false, result: null,
  conflict: { conflicts: { hasHardConflict: true, hasSoftConflict: false, hardConflicts: [], softConflicts: [], unavailabilityConflicts: [], ...conflicts } },
});

describe('conflictLine', () => {
  it('names the jobs in the way', () => {
    expect(conflictLine(failure({ hardConflicts: [job('Boda Sol'), job('Gala Mar')] }))).toBe('Ya tiene Boda Sol, Gala Mar');
  });

  it('adds days that are off', () => {
    expect(conflictLine(failure({ hardConflicts: [job('Boda Sol')], unavailabilityConflicts: [{ date: '2026-10-13', reason: 'x', source: 'vacation' }] }))).toBe('Ya tiene Boda Sol · 1 día no disponible');
    expect(conflictLine(failure({ unavailabilityConflicts: [{ date: 'a', reason: 'x', source: 's' }, { date: 'b', reason: 'x', source: 's' }] }))).toBe('2 días no disponibles');
  });

  it('has nothing to say when the server gave no details', () => {
    expect(conflictLine(null)).toBeNull();
    expect(conflictLine({ ...failure({}), conflict: null })).toBeNull();
    expect(conflictLine(failure({}))).toBeNull();
  });
});
