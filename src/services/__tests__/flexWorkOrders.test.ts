import { beforeEach, describe, expect, it, vi } from 'vitest';

type SupabaseResponse = { data: any; error: any };

type BuilderFactory = (table: string) => any;

function createSupabaseMockHarness() {
  const queues = new Map<string, SupabaseResponse[]>();

  const dequeue = (table: string): SupabaseResponse => {
    const queue = queues.get(table);
    if (!queue || queue.length === 0) {
      return { data: [], error: null };
    }
    return queue.shift()!;
  };

  const createBuilder: BuilderFactory = (table) => {
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      match: () => builder,
      gte: () => builder,
      lte: () => builder,
      order: () => builder,
      insert: () => builder,
      update: () => builder,
      delete: () => builder,
      limit: () => builder,
      single: () => Promise.resolve(dequeue(table)),
      maybeSingle: () => Promise.resolve(dequeue(table)),
      then: (resolve: any, reject: any) => Promise.resolve(dequeue(table)).then(resolve, reject),
    };
    return builder;
  };

  const mockFrom = vi.fn((table: string) => createBuilder(table));
  const mockRpc = vi.fn();
  const mockFunctionsInvoke = vi.fn();

  return {
    mockFrom,
    mockRpc,
    mockFunctionsInvoke,
    enqueueResponse(table: string, response: SupabaseResponse) {
      const queue = queues.get(table) ?? [];
      queue.push(response);
      queues.set(table, queue);
    },
    reset() {
      queues.clear();
      mockFrom.mockReset();
      mockRpc.mockReset();
      mockFunctionsInvoke.mockReset();
      mockFrom.mockImplementation((table: string) => createBuilder(table));
    },
  };
}

const supabaseMock = vi.hoisted(createSupabaseMockHarness);

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: supabaseMock.mockFrom,
    rpc: supabaseMock.mockRpc,
    functions: { invoke: supabaseMock.mockFunctionsInvoke },
  },
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

let syncFlexWorkOrdersForJob: typeof import('../flexWorkOrders').syncFlexWorkOrdersForJob;

describe('syncFlexWorkOrdersForJob', () => {
  beforeEach(async () => {
    vi.resetModules();
    supabaseMock.reset();
    fetchMock.mockReset();
    supabaseMock.mockFunctionsInvoke.mockResolvedValue({
      data: { X_AUTH_TOKEN: 'test-token' },
      error: null,
    });
    ({ syncFlexWorkOrdersForJob } = await import('../flexWorkOrders'));
  });

  it('skips work-order creation when no per-day timesheets exist', async () => {
    supabaseMock.enqueueResponse('jobs', {
      data: {
        id: 'job-1',
        title: 'Sample Job',
        start_time: '2025-05-01T08:00:00.000Z',
        end_time: '2025-05-01T18:00:00.000Z',
        job_type: 'single',
        tour_date_id: null,
      },
      error: null,
    });
    supabaseMock.enqueueResponse('flex_folders', {
      data: [{ element_id: 'folder-1', department: 'personnel' }],
      error: null,
    });
    supabaseMock.enqueueResponse('timesheets', { data: [], error: null });

    const result = await syncFlexWorkOrdersForJob('job-1');

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('creates work orders for technicians that still have per-day timesheets', async () => {
    supabaseMock.enqueueResponse('jobs', {
      data: {
        id: 'job-1',
        title: 'Sample Job',
        start_time: '2025-05-01T08:00:00.000Z',
        end_time: '2025-05-01T18:00:00.000Z',
        job_type: 'single',
        tour_date_id: null,
      },
      error: null,
    });
    supabaseMock.enqueueResponse('flex_folders', {
      data: [{ element_id: 'folder-1', department: 'personnel' }],
      error: null,
    });
    supabaseMock.enqueueResponse('timesheets', {
      data: [
        {
          job_id: 'job-1',
          technician_id: 'tech-1',
          date: '2025-05-01',
          profile: { first_name: 'Ana', last_name: 'López', flex_resource_id: 'flex-1' },
        },
      ],
      error: null,
    });
    supabaseMock.enqueueResponse('job_assignments', {
      data: [
        {
          job_id: 'job-1',
          technician_id: 'tech-1',
          sound_role: null,
          lights_role: null,
          video_role: null,
          status: 'confirmed',
          profiles: { first_name: 'Ana', last_name: 'López', flex_resource_id: 'flex-1' },
        },
      ],
      error: null,
    });
    supabaseMock.enqueueResponse('job_rate_extras', { data: [], error: null });
    supabaseMock.enqueueResponse('flex_work_orders', { data: [], error: null });
    supabaseMock.enqueueResponse('flex_work_orders', { data: null, error: null });

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'document-1', documentNumber: 'WO-123' }),
    });

    const result = await syncFlexWorkOrdersForJob('job-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.created).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
  });
});
