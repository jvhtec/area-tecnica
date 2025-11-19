import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type SupabaseResponse = { data: any; error: any };

function createSupabaseMockHarness() {
  const queues = new Map<string, SupabaseResponse[]>();

  const dequeue = (table: string): SupabaseResponse => {
    const queue = queues.get(table);
    if (!queue || queue.length === 0) {
      return { data: [], error: null };
    }
    return queue.shift()!;
  };

  const createBuilder = (table: string) => {
    const builder: any = {
      select: () => builder,
      in: () => builder,
      eq: () => builder,
      neq: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: () => Promise.resolve(dequeue(table)),
      then: (resolve: any, reject: any) =>
        Promise.resolve(dequeue(table)).then(resolve, reject),
    };
    return builder;
  };

  const mockRpc = vi.fn();
  const mockFrom = vi.fn((table: string) => createBuilder(table));

  return {
    mockRpc,
    mockFrom,
    enqueueResponse(table: string, response: SupabaseResponse) {
      const queue = queues.get(table) ?? [];
      queue.push(response);
      queues.set(table, queue);
    },
    reset() {
      queues.clear();
      mockFrom.mockClear();
      mockRpc.mockReset();
      mockFrom.mockImplementation((table: string) => createBuilder(table));
    },
  };
}

const supabaseMock = vi.hoisted(createSupabaseMockHarness);

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: supabaseMock.mockFrom,
    rpc: supabaseMock.mockRpc,
  },
}));

let buildTourRatesExportPayload: typeof import('../tourRatesExport').buildTourRatesExportPayload;

beforeAll(async () => {
  ({ buildTourRatesExportPayload } = await import('../tourRatesExport'));
});

describe('buildTourRatesExportPayload', () => {
  const baseJob = {
    id: 'job-1',
    title: 'Tour Day 1',
    start_time: '2025-05-01T08:00:00.000Z',
    end_time: '2025-05-01T20:00:00.000Z',
    job_type: 'tourdate' as const,
  };

  beforeEach(() => {
    supabaseMock.reset();
    supabaseMock.mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'compute_tour_job_rate_quote_2025') {
        return Promise.resolve({
          data: {
            start_time: baseJob.start_time,
            end_time: baseJob.end_time,
            total_eur: 250,
            title: baseJob.title,
          },
          error: null,
        });
      }
      if (fnName === 'get_timesheet_amounts_visible') {
        return Promise.resolve({ data: [], error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  it('includes technicians who still have per-day timesheets', async () => {
    supabaseMock.enqueueResponse('timesheets', {
      data: [
        { job_id: 'job-1', technician_id: 'tech-1', date: '2025-05-01', is_schedule_only: false },
        { job_id: 'job-1', technician_id: 'tech-1', date: '2025-05-02', is_schedule_only: false },
      ],
      error: null,
    });
    supabaseMock.enqueueResponse('flex_work_orders', { data: [], error: null });
    supabaseMock.enqueueResponse('timesheets', { data: [], error: null });
    supabaseMock.enqueueResponse('profiles', {
      data: [
        {
          id: 'tech-1',
          first_name: 'Ana',
          last_name: 'López',
          default_timesheet_category: null,
          role: null,
        },
      ],
      error: null,
    });

    const payload = await buildTourRatesExportPayload('tour-1', [baseJob]);

    expect(payload.jobsWithQuotes).toHaveLength(1);
    expect(payload.jobsWithQuotes[0].quotes).toHaveLength(1);
    expect(payload.jobsWithQuotes[0].quotes[0].technician_id).toBe('tech-1');
    expect(payload.profiles).toHaveLength(1);
  });

  it('drops technicians once all of their per-day timesheets are removed', async () => {
    supabaseMock.enqueueResponse('timesheets', { data: [], error: null });
    supabaseMock.enqueueResponse('flex_work_orders', { data: [], error: null });

    const payload = await buildTourRatesExportPayload('tour-1', [baseJob]);

    expect(payload.jobsWithQuotes).toHaveLength(0);
    expect(payload.profiles).toHaveLength(0);
  });
});
