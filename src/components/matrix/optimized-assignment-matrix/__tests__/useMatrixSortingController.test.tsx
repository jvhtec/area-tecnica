import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useMatrixSortingController } from '../useMatrixSortingController';

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: useQueryMock,
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

describe('useMatrixSortingController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useQueryMock.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      const key = queryKey[0];
      if (key === 'tech-confirmed-counts-all-with-dept') {
        return {
          data: {
            counts: new Map([
              ['tech-1', 4],
              ['tech-2', 10],
              ['tech-3', 7],
            ]),
            departments: new Map([
              ['tech-1', 'sound'],
              ['tech-2', 'sound'],
              ['tech-3', 'sound'],
            ]),
          },
        };
      }
      if (key === 'tech-last-year-counts-all-with-dept') {
        return {
          data: {
            counts: new Map([
              ['tech-1', 2],
              ['tech-2', 3],
            ]),
            departments: new Map([
              ['tech-1', 'sound'],
              ['tech-2', 'sound'],
            ]),
          },
        };
      }
      return { data: new Map() };
    });
  });

  it('sorts house technicians first and exposes medal rankings', () => {
    const technicians = [
      { id: 'tech-1', first_name: 'Ana', last_name: 'A', email: 'a@test.com', department: 'sound', role: 'technician' },
      { id: 'tech-2', first_name: 'Bea', last_name: 'B', email: 'b@test.com', department: 'sound', role: 'house_tech' },
      { id: 'tech-3', first_name: 'Carla', last_name: 'C', email: 'c@test.com', department: 'sound', role: 'technician' },
    ];

    const { result } = renderHook(() =>
      useMatrixSortingController({
        technicians,
        jobs: [],
        dates: [new Date('2025-03-01T00:00:00Z')],
        allAssignments: [],
        mobile: false,
        isManagementUser: true,
      }),
    );

    expect(result.current.orderedTechnicians.map((technician) => technician.id)).toEqual(['tech-2', 'tech-3', 'tech-1']);
    expect(result.current.techMedalRankings.get('tech-2')).toBe('gold');
    expect(result.current.techMedalRankings.get('tech-3')).toBe('silver');
  });

  it('cycles through technician sort labels', () => {
    const { result } = renderHook(() =>
      useMatrixSortingController({
        technicians: [],
        jobs: [],
        dates: [],
        allAssignments: [],
        mobile: false,
        isManagementUser: false,
      }),
    );

    expect(result.current.getSortLabel()).toBe('');

    act(() => {
      result.current.cycleTechSort();
    });

    expect(result.current.getSortLabel()).toBe('📍 Ubicación');
  });
});
