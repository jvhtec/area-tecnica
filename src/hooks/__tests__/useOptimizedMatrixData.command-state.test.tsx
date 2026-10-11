// @vitest-environment jsdom
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const realtime = vi.hoisted(() => ({ callbacks: new Map<string, (payload: unknown) => void>() }));
vi.mock('@/lib/supabase', () => {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'gte', 'lte', 'order', 'limit', 'neq', 'or', 'range']) builder[method] = () => builder;
  builder.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
  return { supabase: {
    from: () => builder,
    rpc: () => Promise.resolve({ data: [], error: null }),
    channel: () => {
      const channel = {
        on: (_type: string, config: { table: string }, callback: (payload: unknown) => void) => { realtime.callbacks.set(config.table, callback); return channel; },
        subscribe: () => channel,
      };
      return channel;
    },
    removeChannel: vi.fn(),
  } };
});

import { useOptimizedMatrixData } from '@/hooks/useOptimizedMatrixData';
import { assignmentCommandStateKey } from '@/features/assignments/commands/reconcile';
import { createTestQueryClient } from '@/test/createTestQueryClient';

describe('matrix realtime command state', () => {
  beforeEach(() => realtime.callbacks.clear());
  afterEach(() => vi.clearAllMocks());

  it.each(['job_assignments', 'timesheets'])('refreshes a mounted inspector state when %s changes', async (table) => {
    const queryClient = createTestQueryClient();
    const read = vi.fn().mockResolvedValueOnce({ state_token: 'before' }).mockResolvedValue({ state_token: 'colleague' });
    const technicians = [{ id: 'tech-1', first_name: 'A', last_name: 'B', email: '', department: 'sound', role: 'technician' }];
    const dates = [new Date('2026-10-01T10:00:00Z')];
    const jobs = [{ id: 'job-1', title: 'Show', start_time: '2026-10-01T08:00:00Z', end_time: '2026-10-01T20:00:00Z', status: 'Confirmado', job_type: 'single' }];
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const view = renderHook(() => {
      useOptimizedMatrixData({ technicians, dates, jobs });
      return useQuery({ queryKey: assignmentCommandStateKey('job-1', 'tech-1'), queryFn: read, staleTime: 10_000 });
    }, { wrapper });
    await waitFor(() => expect(view.result.current.data?.state_token).toBe('before'));
    await act(async () => { realtime.callbacks.get(table)?.({ eventType: 'UPDATE', new: { job_id: 'job-1', technician_id: 'tech-1', date: '2026-10-01', status: 'confirmed' }, old: {} }); });
    await waitFor(() => expect(view.result.current.data?.state_token).toBe('colleague'));
    expect(read).toHaveBeenCalledTimes(2);
    view.unmount();
    queryClient.clear();
  });
});
