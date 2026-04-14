import { describe, expect, it, vi } from 'vitest';

import {
  buildMatrixCellKey,
  formatMatrixDateKey,
  invalidateMatrixAssignmentQueries,
  invalidateMatrixAvailabilityQueries,
  invalidateMatrixJobsAndStaffingQueries,
  matrixQueryKeys,
  parseMatrixDateKey,
  toMatrixDayTimestamp,
} from '../matrixCore';

describe('matrixCore', () => {
  it('formats Madrid date keys and cell keys consistently', () => {
    const date = new Date('2025-03-01T23:30:00.000Z');

    expect(formatMatrixDateKey(date)).toBe('2025-03-02');
    expect(buildMatrixCellKey('tech-1', date)).toBe('tech-1-2025-03-02');
    expect(buildMatrixCellKey('tech-1', '2025-03-03')).toBe('tech-1-2025-03-03');
  });

  it('parses matrix day timestamps as Madrid local midnight', () => {
    expect(toMatrixDayTimestamp('2025-03-31')).toBe(parseMatrixDateKey('2025-03-31').getTime());
    expect(toMatrixDayTimestamp('2025-03-31')).toBe(new Date('2025-03-30T22:00:00.000Z').getTime());
  });

  it('builds scoped staffing matrix query keys', () => {
    expect(
      matrixQueryKeys.staffingMatrix(
        ['tech-1'],
        [{ id: 'job-1', start_time: '2025-03-01T10:00:00Z', end_time: '2025-03-01T12:00:00Z' }],
        [new Date('2025-03-01T00:00:00Z'), new Date('2025-03-02T00:00:00Z')],
      ),
    ).toEqual(['staffing-matrix', ['tech-1'], ['job-1'], '2025-03-01', '2025-03-02']);
  });

  it('invalidates scoped matrix query groups', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const queryClient = { invalidateQueries } as never;

    await invalidateMatrixAssignmentQueries(queryClient);
    await invalidateMatrixAvailabilityQueries(queryClient);
    await invalidateMatrixJobsAndStaffingQueries(queryClient);

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: matrixQueryKeys.assignmentsPrefix });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: matrixQueryKeys.availabilityPrefix });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: matrixQueryKeys.jobsPrefix });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: matrixQueryKeys.legacyJobsPrefix });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: matrixQueryKeys.optimizedJobsPrefix });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: matrixQueryKeys.staffingPrefix });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: matrixQueryKeys.sortJobStatusesPrefix });
  });
});
