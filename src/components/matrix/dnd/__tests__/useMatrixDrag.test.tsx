// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MATRIX_ASSIGNMENT_DRAG_MIME } from '@/components/matrix/dnd/constants';
import { parseDragSource, useMatrixDrag } from '@/components/matrix/dnd/useMatrixDrag';

const technician = {
  id: 'tech-1',
  first_name: 'Ana',
  last_name: 'Técnica',
  department: 'production',
};

describe('useMatrixDrag', () => {
  it('writes a complete assignment payload and supports production roles', () => {
    const data = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: 'none',
      setData: vi.fn((type: string, value: string) => data.set(type, value)),
    } as unknown as DataTransfer;
    const { result } = renderHook(() => useMatrixDrag({
      enabled: true,
      declinedJobsByTech: new Map(),
      getAssignmentForCell: () => null,
      getAvailabilityForCell: () => null,
      onDrop: vi.fn(),
    }));

    act(() => result.current.beginDrag(technician, new Date('2026-07-15T10:00:00Z'), {
      job_id: 'job-1',
      status: 'confirmed',
      sound_role: 'foh',
      lights_role: 'none',
      video_role: 'video-tech',
      production_role: 'producer',
      job: { title: 'Festival' },
    }, dataTransfer));

    const source = parseDragSource(data.get(MATRIX_ASSIGNMENT_DRAG_MIME) || '');
    expect(source?.roles).toEqual({
      sound_role: 'foh',
      lights_role: null,
      video_role: 'video-tech',
      production_role: 'producer',
    });
    expect(source?.jobTitle).toBe('Festival');
    expect(dataTransfer.effectAllowed).toBe('move');
  });

  it('can complete a drop from the serialized payload even before drag state is available', () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() => useMatrixDrag({
      enabled: true,
      declinedJobsByTech: new Map(),
      getAssignmentForCell: () => null,
      getAvailabilityForCell: () => null,
      onDrop,
    }));
    const serialized = JSON.stringify({
      technicianId: 'tech-1',
      technicianName: 'Ana Técnica',
      dateKey: '2026-07-15',
      jobId: 'job-1',
      jobTitle: 'Festival',
      roles: { sound_role: null, lights_role: null, video_role: null, production_role: 'producer' },
      status: 'confirmed',
      department: 'production',
    });

    act(() => result.current.dropOnCell(
      { id: 'tech-2', first_name: 'Luis', last_name: 'Destino', department: 'production' },
      new Date('2026-07-15T10:00:00Z'),
      serialized,
    ));

    expect(onDrop).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'job-1' }), 'tech-2', 'Luis Destino');
  });
});
