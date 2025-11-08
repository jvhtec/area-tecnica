import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TourRatesPanel } from '../TourRatesPanel';
import { NO_AUTONOMO_LABEL } from '@/utils/autonomo';

const useTourJobRateQuotesMock = vi.fn();

vi.mock('@/hooks/useTourJobRateQuotes', () => ({
  useTourJobRateQuotes: (...args: any[]) => useTourJobRateQuotesMock(...args),
}));

const useQueryMock = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: any) => useQueryMock(options),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {},
}));

vi.mock('@/lib/tour-payout-email', () => ({
  sendTourJobEmails: vi.fn().mockResolvedValue({ success: true, missingEmails: [], context: {} }),
}));

describe('TourRatesPanel autonomo badge', () => {
  beforeEach(() => {
    useTourJobRateQuotesMock.mockReturnValue({
      data: [
        {
          job_id: 'job-1',
          technician_id: 'tech-1',
          start_time: '2024-01-01T00:00:00Z',
          end_time: '2024-01-01T10:00:00Z',
          job_type: 'show',
          tour_id: 'tour-1',
          title: 'Opening Night',
          is_house_tech: false,
          is_tour_team_member: true,
          category: 'audio',
          base_day_eur: 200,
          week_count: 1,
          multiplier: 1,
          per_job_multiplier: 1,
          iso_year: 2024,
          iso_week: 1,
          total_eur: 200,
          extras_total_eur: 0,
          total_with_extras_eur: 200,
          vehicle_disclaimer: false,
          breakdown: {
            after_discount: 200,
          },
        },
      ],
      isLoading: false,
      error: null,
    });

    useQueryMock.mockImplementation(({ queryKey }: { queryKey: any[] }) => {
      const key = queryKey[0];
      if (key === 'profiles-for-tour-rates') {
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
      if (key === 'tour-rates-job-meta') {
        return {
          data: {
            id: 'job-1',
            title: 'Opening Night',
            start_time: '2024-01-01T00:00:00Z',
            tour_id: 'tour-1',
            rates_approved: true,
          },
          isLoading: false,
          error: null,
        };
      }
      return { data: undefined, isLoading: false, error: null };
    });
  });

  it('shows the non-autonomo badge beside the technician name', () => {
    render(<TourRatesPanel jobId="job-1" />);

    expect(screen.getByText(NO_AUTONOMO_LABEL)).toBeInTheDocument();
  });
});
