import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TourRatesPanel } from '../TourRatesPanel';
import { NO_AUTONOMO_LABEL } from '@/utils/autonomo';

const useTourJobRateQuotesMock = vi.fn();
const useTourJobRateQuotesForManagerMock = vi.fn();
const useManagerJobQuotesMock = vi.fn();
const sendTourJobEmailsMock = vi.fn().mockResolvedValue({ success: true, missingEmails: [], context: {} });

vi.mock('@/hooks/useTourJobRateQuotes', () => ({
  useTourJobRateQuotes: (...args: unknown[]) => useTourJobRateQuotesMock(...args),
}));

vi.mock('@/hooks/useTourJobRateQuotesForManager', () => ({
  useTourJobRateQuotesForManager: (...args: unknown[]) => useTourJobRateQuotesForManagerMock(...args),
}));

vi.mock('@/hooks/useManagerJobQuotes', () => ({
  useManagerJobQuotes: (...args: unknown[]) => useManagerJobQuotesMock(...args),
}));

const useQueryMock = vi.fn();

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');

  return {
    ...actual,
    useQuery: (options: unknown) => useQueryMock(options),
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
      setQueryData: vi.fn(),
      getQueryData: vi.fn(),
    }),
    useMutation: () => ({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    }),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {},
}));

vi.mock('@/lib/tour-payout-email', () => ({
  sendTourJobEmails: (...args: unknown[]) => sendTourJobEmailsMock(...args),
}));

describe('TourRatesPanel autonomo badge', () => {
  beforeEach(() => {
    sendTourJobEmailsMock.mockClear();
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
    useTourJobRateQuotesForManagerMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
    useManagerJobQuotesMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    useQueryMock.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
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
      if (key === 'tour-rates-approvals') {
        return {
          data: new Map([['job-1-tech-1', true], ['job-1-tech-2', true]]),
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

  it('uses manager-capable source for payout reviewers and keeps extras/override fields in send payload', async () => {
    useTourJobRateQuotesMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
    useTourJobRateQuotesForManagerMock.mockReturnValue({
      data: [
        {
          job_id: 'job-1',
          technician_id: 'tech-2',
          start_time: '2024-01-01T00:00:00Z',
          end_time: '2024-01-01T10:00:00Z',
          job_type: 'tourdate',
          tour_id: 'tour-1',
          title: 'Manager View Date',
          is_house_tech: false,
          is_tour_team_member: true,
          category: 'audio',
          base_day_eur: 150,
          week_count: 1,
          multiplier: 1,
          per_job_multiplier: 1,
          iso_year: 2024,
          iso_week: 1,
          total_eur: 150,
          extras: {
            items: [{ extra_type: 'night_bonus', quantity: 2, amount_eur: 40 }],
            total_eur: 40,
          },
          total_with_extras_eur: 190,
          has_override: true,
          override_amount_eur: 220,
          breakdown: {},
        },
      ],
      isLoading: false,
      error: null,
    });

    useQueryMock.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      const key = queryKey[0];
      if (key === 'profiles-for-tour-rates') {
        return {
          data: [
            {
              id: 'tech-2',
              first_name: 'Pilar',
              last_name: 'Manager',
              email: 'pilar@example.com',
              autonomo: true,
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
            title: 'Manager View Date',
            start_time: '2024-01-01T00:00:00Z',
            end_time: '2024-01-01T10:00:00Z',
            timezone: 'Europe/Madrid',
            tour_id: 'tour-1',
            job_type: 'tourdate',
            rates_approved: true,
          },
          isLoading: false,
          error: null,
        };
      }
      if (key === 'tour-rates-approvals') {
        return {
          data: new Map([['job-1-tech-2', true]]),
          isLoading: false,
          error: null,
        };
      }
      return { data: undefined, isLoading: false, error: null };
    });

    render(
      <TourRatesPanel
        jobId="job-1"
        jobType="tourdate"
        tourId="tour-1"
        canReviewPayouts
      />
    );

    expect(useTourJobRateQuotesForManagerMock).toHaveBeenCalledWith('job-1', 'tour-1');
    expect(useTourJobRateQuotesMock).toHaveBeenCalledWith(undefined);
    expect(screen.getByText(/night bonus/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Enviar aprobados/i }));

    await waitFor(() => {
      expect(sendTourJobEmailsMock).toHaveBeenCalled();
    });

    const payload = sendTourJobEmailsMock.mock.calls.at(-1)?.[0];
    expect(payload?.quotes?.[0]?.extras_total_eur).toBe(40);
    expect(payload?.quotes?.[0]?.extras?.items?.length).toBe(1);
    expect(payload?.quotes?.[0]?.total_with_extras_eur).toBe(190);
    expect(payload?.quotes?.[0]?.has_override).toBe(true);
    expect(payload?.quotes?.[0]?.override_amount_eur).toBe(220);
  });
});
