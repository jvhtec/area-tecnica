import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JobPayoutTotalsPanel } from '../JobPayoutTotalsPanel';
import { NO_AUTONOMO_LABEL } from '@/utils/autonomo';

const useJobPayoutTotalsMock = vi.fn();

vi.mock('@/hooks/useJobPayoutTotals', () => ({
  useJobPayoutTotals: (...args: any[]) => useJobPayoutTotalsMock(...args),
}));

const useQueryMock = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: any) => useQueryMock(options),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {},
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('JobPayoutTotalsPanel autonomo badge', () => {
  beforeEach(() => {
    useJobPayoutTotalsMock.mockReturnValue({
      data: [
        {
          technician_id: 'tech-1',
          job_id: 'job-1',
          timesheets_total_eur: 100,
          extras_total_eur: 0,
          total_eur: 100,
        },
      ],
      isLoading: false,
      error: null,
    });

    useQueryMock.mockImplementation(({ queryKey }: { queryKey: any[] }) => {
      const key = queryKey[0];
      if (key === 'flex-work-orders-by-job') {
        return { data: [], isLoading: false, error: null };
      }
      if (key === 'profiles-for-job-payout') {
        return {
          data: [
            {
              id: 'tech-1',
              first_name: 'Ana',
              last_name: 'Lopez',
              email: 'ana@example.com',
              autonomo: false,
            },
          ],
          isLoading: false,
          error: null,
        };
      }
      if (key === 'job-payout-metadata') {
        return {
          data: {
            id: 'job-1',
            title: 'Job Uno',
            start_time: '2024-01-01T00:00:00Z',
            tour_id: null,
            rates_approved: true,
          },
          isLoading: false,
          error: null,
        };
      }
      return { data: undefined, isLoading: false, error: null };
    });
  });

  it('renders the non-autonomo badge when the flag is false', () => {
    render(<JobPayoutTotalsPanel jobId="job-1" />);

    expect(screen.getByText(NO_AUTONOMO_LABEL)).toBeInTheDocument();
  });
});
