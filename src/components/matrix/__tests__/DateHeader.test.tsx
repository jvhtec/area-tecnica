// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/dataLayerClient', () => ({
  dataLayerClient: { from: fromMock, rpc: vi.fn() },
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

const renderHeader = (props: Partial<React.ComponentProps<typeof DateHeader>> = {}) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <DateHeader
        date={new Date('2026-03-10T12:00:00.000Z')}
        width={110}
        jobs={jobs}
        technicianIds={['tech-1']}
        {...props}
      />
    </QueryClientProvider>,
  );
};

describe('DateHeader', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('reads nothing on mount: scrolling sideways mounts a header per column', () => {
    renderHeader({ confirmedCount: 3 });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('shows the coverage it is given', () => {
    renderHeader({ confirmedCount: 4, openSlots: { required: 8, assigned: 6, open: 2 } });

    expect(screen.getByTitle('6 de 8 puestos cubiertos · 2 libres')).toBeInTheDocument();
    expect(screen.getByText('6/8')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('falls back to the confirmed badge before the slot totals load', () => {
    renderHeader({ confirmedCount: 5, openSlots: null });
    expect(screen.getByTitle('Técnicos confirmados en esta fecha')).toHaveTextContent('5');
  });

  it('labels the Madrid day, with the year on the first of the month', () => {
    renderHeader({ date: new Date('2026-04-01T10:00:00.000Z'), jobs: [] });
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText(/abr\s+2026/)).toBeInTheDocument();
  });
});
