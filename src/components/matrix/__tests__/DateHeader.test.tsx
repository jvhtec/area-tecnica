// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const tablesQueried: string[] = [];

const makeBuilder = () => {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const method of ['select', 'eq', 'in', 'neq', 'gte', 'lte', 'order', 'limit']) {
    builder[method] = vi.fn(chain);
  }
  // Awaiting the builder resolves to an empty result set.
  builder.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve);
  return builder;
};

vi.mock('@/services/dataLayerClient', () => ({
  dataLayerClient: {
    from: vi.fn((table: string) => {
      tablesQueried.push(table);
      return makeBuilder();
    }),
  },
}));

import { DateHeader } from '@/components/matrix/DateHeader';
import { createTestQueryClient } from '@/test/createTestQueryClient';

const jobs = [
  {
    id: 'job-1',
    title: 'Show',
    start_time: '2026-03-10T08:00:00.000Z',
    end_time: '2026-03-10T20:00:00.000Z',
    status: 'Confirmado',
  },
];

const renderHeader = (compact: boolean) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <DateHeader
        date={new Date('2026-03-10T12:00:00.000Z')}
        width={110}
        jobs={jobs}
        technicianIds={['tech-1']}
        compact={compact}
      />
    </QueryClientProvider>,
  );
};

describe('DateHeader open-slot query', () => {
  beforeEach(() => {
    tablesQueried.length = 0;
  });

  it('skips the open-slot aggregation in compact mode', async () => {
    renderHeader(true);

    // The confirmed-count badge still renders in compact mode, so its timesheets
    // read is expected; only the open-slot aggregation is skipped.
    await waitFor(() => expect(tablesQueried).toContain('timesheets'));
    expect(tablesQueried).not.toContain('job_required_roles_summary');
  });

  it('runs the open-slot aggregation when the badge can render', async () => {
    renderHeader(false);

    await waitFor(() => expect(tablesQueried).toContain('job_required_roles_summary'));
  });
});
