import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JobPayoutTotalsPanel } from '../JobPayoutTotalsPanel';
import { formatCurrency } from '@/lib/utils';
import type { TourJobRateQuote } from '@/types/tourRates';

const useJobPayoutTotalsMock = vi.fn();
const useManagerJobQuotesMock = vi.fn();

vi.mock('@/hooks/useJobPayoutTotals', () => ({
  useJobPayoutTotals: (...args: any[]) => useJobPayoutTotalsMock(...args),
}));

vi.mock('@/hooks/useManagerJobQuotes', () => ({
  useManagerJobQuotes: (...args: any[]) => useManagerJobQuotesMock(...args),
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

describe('JobPayoutTotalsPanel tourdate payouts', () => {
  beforeEach(() => {
    useJobPayoutTotalsMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    const quote: TourJobRateQuote = {
      job_id: 'job-tour-1',
      technician_id: 'tech-1',
      start_time: '2024-01-01T00:00:00Z',
      end_time: '2024-01-01T06:00:00Z',
      job_type: 'tourdate',
      tour_id: 'tour-1',
      title: 'Tour Date',
      is_house_tech: false,
      category: 'tecnico',
      base_day_eur: 150,
      week_count: 1,
      multiplier: 1,
      iso_year: 2024,
      iso_week: 1,
      total_eur: 150,
      extras: {
        items: [
          {
            extra_type: 'travel_half',
            quantity: 1,
            unit_eur: 25,
            amount_eur: 25,
          },
        ],
        total_eur: 25,
      },
      extras_total_eur: 25,
      total_with_extras_eur: 175,
      vehicle_disclaimer: true,
      vehicle_disclaimer_text: 'Vehículo asignado por la gira.',
      breakdown: {},
    };

    useManagerJobQuotesMock.mockReturnValue({
      data: [quote],
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
            id: 'job-tour-1',
            title: 'Tour Date',
            start_time: '2024-01-01T00:00:00Z',
            tour_id: 'tour-1',
            rates_approved: true,
            job_type: 'tourdate',
          },
          isLoading: false,
          error: null,
        };
      }
      return { data: undefined, isLoading: false, error: null };
    });
  });

  it('renders mapped tour payouts with totals and extras', () => {
    render(<JobPayoutTotalsPanel jobId="job-tour-1" />);

    const normalize = (value: string) => value.replace(/\s+/g, '');
    const grandTotals = screen.getAllByText(
      (content) => normalize(content) === normalize(formatCurrency(175))
    );
    const baseTotals = screen.getAllByText(
      (content) => normalize(content) === normalize(formatCurrency(150))
    );
    expect(grandTotals.length).toBeGreaterThan(0);
    expect(baseTotals.length).toBeGreaterThan(0);
    expect(screen.getByText('travel half × 1')).toBeInTheDocument();
    expect(screen.queryByText('No payout information available for this job.')).not.toBeInTheDocument();
  });
});
