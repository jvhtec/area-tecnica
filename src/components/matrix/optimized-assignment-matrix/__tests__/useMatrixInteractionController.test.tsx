import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useMatrixInteractionController } from '../useMatrixInteractionController';

const { useSelectedCellStoreMock } = vi.hoisted(() => ({
  useSelectedCellStoreMock: vi.fn(),
}));

vi.mock('@/stores/useSelectedCellStore', () => ({
  useSelectedCellStore: useSelectedCellStoreMock,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('useMatrixInteractionController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSelectedCellStoreMock.mockReturnValue({
      selectCell: vi.fn(),
      clearSelection: vi.fn(),
      isCellSelected: vi.fn().mockReturnValue(false),
    });
  });

  it('routes email availability clicks into the availability dialog when a job is already assigned', () => {
    const getAssignmentForCell = vi.fn().mockReturnValue({
      job_id: 'job-1',
      technician_id: 'tech-1',
      date: '2025-03-01',
      status: 'invited',
      assigned_at: null,
      job: {
        id: 'job-1',
        title: 'Festival',
        start_time: '2025-03-01T10:00:00Z',
        end_time: '2025-03-01T18:00:00Z',
        status: 'scheduled',
        job_type: 'single',
      },
    });

    const { result } = renderHook(() =>
      useMatrixInteractionController({
        technicians: [
          {
            id: 'tech-1',
            first_name: 'Ana',
            last_name: 'López',
            email: 'ana@test.com',
            department: 'sound',
            role: 'technician',
          },
        ],
        allowDirectAssign: true,
        isManagementUser: true,
        getAssignmentForCell,
        getAvailabilityForCell: vi.fn(),
        invalidateAssignmentQueries: vi.fn().mockResolvedValue(undefined),
        prefetchTechnicianData: vi.fn().mockResolvedValue(undefined),
        updateAssignmentOptimistically: vi.fn(),
        toast: vi.fn(),
        sendStaffingEmail: vi.fn(),
        checkTimeConflictEnhanced: vi.fn().mockResolvedValue({ hasHardConflict: false, hardConflicts: [] }),
        declinedJobsByTech: new Map(),
      }),
    );

    act(() => {
      result.current.handleCellClick('tech-1', new Date('2025-03-01T00:00:00Z'), 'availability-email');
    });

    expect(result.current.availabilityDialog).toMatchObject({
      open: true,
      jobId: 'job-1',
      profileId: 'tech-1',
      channel: 'email',
    });
  });

  it('creates job-selection state for staffing when no assignment exists', () => {
    const { result } = renderHook(() =>
      useMatrixInteractionController({
        technicians: [
          {
            id: 'tech-1',
            first_name: 'Ana',
            last_name: 'López',
            email: 'ana@test.com',
            department: 'sound',
            role: 'technician',
          },
        ],
        allowDirectAssign: true,
        isManagementUser: true,
        getAssignmentForCell: vi.fn().mockReturnValue(undefined),
        getAvailabilityForCell: vi.fn(),
        invalidateAssignmentQueries: vi.fn().mockResolvedValue(undefined),
        prefetchTechnicianData: vi.fn().mockResolvedValue(undefined),
        updateAssignmentOptimistically: vi.fn(),
        toast: vi.fn(),
        sendStaffingEmail: vi.fn(),
        checkTimeConflictEnhanced: vi.fn().mockResolvedValue({ hasHardConflict: false, hardConflicts: [] }),
        declinedJobsByTech: new Map(),
      }),
    );

    act(() => {
      result.current.handleCellClick('tech-1', new Date('2025-03-01T00:00:00Z'), 'offer-details-email');
    });

    expect(result.current.cellAction).toMatchObject({
      type: 'select-job-for-staffing',
      technicianId: 'tech-1',
    });
  });
});
