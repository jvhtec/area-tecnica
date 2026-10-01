// @vitest-environment jsdom
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase', () => {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'gte', 'lte', 'order', 'limit', 'neq', 'or']) {
    builder[method] = () => builder;
  }
  builder.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve);
  const channel = { on: () => channel, subscribe: () => channel };
  return {
    supabase: {
      from: () => builder,
      rpc: () => Promise.resolve({ data: [], error: null }),
      channel: () => channel,
      removeChannel: vi.fn(),
    },
  };
});

import { useOptimizedMatrixData } from '@/hooks/useOptimizedMatrixData';
import { createTestQueryClient } from '@/test/createTestQueryClient';

describe('useOptimizedMatrixData', () => {
  it('keeps the callbacks the grid rows receive stable across renders', () => {
    // Every one of these reaches each memoised grid row. A fresh function per
    // render re-rendered the whole visible grid on any matrix update: a click,
    // a selection, a data refresh.
    const technicians = [{ id: 'tech-1', first_name: 'A', last_name: 'B', email: '', department: 'sound', role: 'technician' }];
    const dates = [new Date('2026-10-01T10:00:00Z')];
    const jobs = [{ id: 'job-1', title: 'Show', start_time: '2026-10-01T08:00:00Z', end_time: '2026-10-01T20:00:00Z', status: 'Confirmado', job_type: 'single' }];
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result, rerender } = renderHook(() => useOptimizedMatrixData({ technicians, dates, jobs }), { wrapper });
    const first = result.current;
    rerender();
    const second = result.current;

    expect(second.getAssignmentForCell).toBe(first.getAssignmentForCell);
    expect(second.getAvailabilityForCell).toBe(first.getAvailabilityForCell);
    expect(second.getJobsForDate).toBe(first.getJobsForDate);
    expect(second.prefetchTechnicianData).toBe(first.prefetchTechnicianData);
    expect(second.updateAssignmentOptimistically).toBe(first.updateAssignmentOptimistically);
    expect(second.invalidateAssignmentQueries).toBe(first.invalidateAssignmentQueries);
  });
});
