import { describe, expect, it, vi, beforeEach } from 'vitest';

import { getConflictWarning } from '../conflictUtils';

const { checkTimeConflictEnhancedMock } = vi.hoisted(() => ({
  checkTimeConflictEnhancedMock: vi.fn(),
}));

vi.mock('@/utils/technicianAvailability', () => ({
  checkTimeConflictEnhanced: checkTimeConflictEnhancedMock,
}));

describe('getConflictWarning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps unavailability-only dates in multi-day conflict warnings', async () => {
    checkTimeConflictEnhancedMock
      .mockResolvedValueOnce({
        hasHardConflict: false,
        hasSoftConflict: false,
        hardConflicts: [],
        softConflicts: [],
        unavailabilityConflicts: [{ date: '2026-04-14', reason: 'Vacaciones', source: 'availability' }],
      })
      .mockResolvedValueOnce({
        hasHardConflict: false,
        hasSoftConflict: true,
        hardConflicts: [],
        softConflicts: [{ id: 'soft-1', title: 'Otro bolo', start_time: '2026-04-15T09:00:00Z', end_time: '2026-04-15T18:00:00Z', status: 'invited' }],
        unavailabilityConflicts: [],
      });

    const result = await getConflictWarning({
      selectedJobId: 'job-1',
      coverageMode: 'multi',
      technicianId: 'tech-1',
      assignmentDate: '2026-04-14',
      multiDates: [
        new Date('2026-04-14T00:00:00.000Z'),
        new Date('2026-04-15T00:00:00.000Z'),
        new Date('2026-04-15T12:00:00.000Z'),
      ],
    });

    expect(checkTimeConflictEnhancedMock).toHaveBeenCalledTimes(2);
    expect(result?.mode).toBe('multi');
    expect(result?.perDateConflicts).toHaveLength(2);
    expect(result?.perDateConflicts?.[0]).toEqual(expect.objectContaining({
      targetDate: '2026-04-14',
      result: expect.objectContaining({
        unavailabilityConflicts: [{ date: '2026-04-14', reason: 'Vacaciones', source: 'availability' }],
      }),
    }));
    expect(result?.result.unavailabilityConflicts).toHaveLength(1);
  });

  it('returns warnings for single-day unavailability-only conflicts', async () => {
    checkTimeConflictEnhancedMock.mockResolvedValue({
      hasHardConflict: false,
      hasSoftConflict: false,
      hardConflicts: [],
      softConflicts: [],
      unavailabilityConflicts: [{ date: '2026-04-14', reason: 'Baja médica', source: 'availability' }],
    });

    const result = await getConflictWarning({
      selectedJobId: 'job-1',
      coverageMode: 'single',
      technicianId: 'tech-1',
      assignmentDate: '2026-04-14',
      multiDates: [],
    });

    expect(result).toEqual(expect.objectContaining({
      mode: 'single',
      targetDate: '2026-04-14',
      result: expect.objectContaining({
        unavailabilityConflicts: [{ date: '2026-04-14', reason: 'Baja médica', source: 'availability' }],
      }),
    }));
  });
});
