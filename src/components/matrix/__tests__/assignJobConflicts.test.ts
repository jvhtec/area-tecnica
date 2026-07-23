import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkTimeConflictEnhanced } from '@/utils/technicianAvailability'
import { checkAssignmentConflicts } from '@/components/matrix/assignJobConflicts'

vi.mock('@/utils/technicianAvailability', () => ({
  checkTimeConflictEnhanced: vi.fn(),
}))

describe('checkAssignmentConflicts', () => {
  beforeEach(() => {
    vi.mocked(checkTimeConflictEnhanced).mockReset().mockResolvedValue({
      hasHardConflict: false,
      hasSoftConflict: false,
      hardConflicts: [],
      softConflicts: [],
      unavailabilityConflicts: [],
    })
  })

  it('uses Madrid date keys for multi-day conflict checks', async () => {
    await checkAssignmentConflicts({
      technicianId: 'tech-1',
      selectedJobId: 'job-1',
      coverageMode: 'multi',
      multiDates: [new Date('2026-03-28T23:30:00Z')],
      assignmentDate: '',
    })

    expect(checkTimeConflictEnhanced).toHaveBeenCalledWith(
      'tech-1',
      'job-1',
      {
        targetDateIso: '2026-03-29',
        singleDayOnly: true,
        includePending: true,
      },
    )
  })
})
