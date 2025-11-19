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

let fetchRatesApprovals: typeof import('../ratesService').fetchRatesApprovals;

beforeAll(async () => {
  ({ fetchRatesApprovals } = await import('../ratesService'));
});

describe('fetchRatesApprovals', () => {
  const tourRow = {
    id: 'tour-1',
    name: 'Spring Tour',
    start_date: '2025-05-01',
    end_date: '2025-05-10',
    rates_approved: false,
    status: 'confirmed',
  };

  const tourJob = { id: 'job-tour-1', tour_id: 'tour-1', job_type: 'tourdate' };
  const standaloneJob = {
    id: 'job-single-1',
    title: 'Corporate Show',
    start_time: '2025-05-03',
    end_time: '2025-05-03',
    job_type: 'single',
    status: 'Confirmado',
    rates_approved: false,
    tour_id: null,
  };

  beforeEach(() => {
    supabaseMock.reset();
  });

  it('counts distinct technicians from timesheets for tours and standalone jobs', async () => {
    supabaseMock.enqueueResponse('tours', { data: [tourRow], error: null });
    supabaseMock.enqueueResponse('jobs', { data: [tourJob], error: null });
    supabaseMock.enqueueResponse('jobs', { data: [standaloneJob], error: null });
    supabaseMock.enqueueResponse('timesheets', {
      data: [
        { job_id: 'job-tour-1', technician_id: 'tech-1', status: 'approved', date: '2025-05-01', is_schedule_only: false },
        { job_id: 'job-tour-1', technician_id: 'tech-1', status: 'approved', date: '2025-05-02', is_schedule_only: false },
        { job_id: 'job-single-1', technician_id: 'tech-9', status: 'approved', date: '2025-05-03', is_schedule_only: false },
      ],
      error: null,
    });
    supabaseMock.enqueueResponse('job_rate_extras', { data: [], error: null });

    const rows = await fetchRatesApprovals();

    const tourRowResult = rows.find((row) => row.entityType === 'tour');
    const jobRowResult = rows.find((row) => row.entityType === 'job');

    expect(tourRowResult?.assignmentCount).toBe(1);
    expect(jobRowResult?.assignmentCount).toBe(1);
    expect(tourRowResult?.pendingIssues).not.toContain('No assignments');
    expect(jobRowResult?.pendingIssues).not.toContain('No assignments');
  });

  it('marks tours with no per-day staffing as missing assignments', async () => {
    supabaseMock.enqueueResponse('tours', { data: [tourRow], error: null });
    supabaseMock.enqueueResponse('jobs', { data: [tourJob], error: null });
    supabaseMock.enqueueResponse('jobs', { data: [standaloneJob], error: null });
    supabaseMock.enqueueResponse('timesheets', {
      data: [
        { job_id: 'job-single-1', technician_id: 'tech-9', status: 'approved', date: '2025-05-03', is_schedule_only: false },
      ],
      error: null,
    });
    supabaseMock.enqueueResponse('job_rate_extras', { data: [], error: null });

    const rows = await fetchRatesApprovals();
    const tourRowResult = rows.find((row) => row.entityType === 'tour');

    expect(tourRowResult?.assignmentCount).toBe(0);
    expect(tourRowResult?.pendingIssues).toContain('No assignments');
  });
});
