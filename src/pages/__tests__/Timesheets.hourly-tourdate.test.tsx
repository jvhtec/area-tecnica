// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Timesheets from '@/pages/Timesheets';
import { fetchHourlyTourDateRateModes } from '@/services/hourlyTourDateTimesheets';
import { renderWithProviders } from '@/test/renderWithProviders';

vi.mock('@/hooks/useOptimizedJobs', () => ({
  useOptimizedJobs: () => ({
    data: [
      {
        id: 'tourdate-1',
        title: 'Fecha de gira con tarifa por horas',
        start_time: '2026-07-10T08:00:00Z',
        end_time: '2026-07-10T20:00:00Z',
        job_type: 'tourdate',
        status: 'Confirmado',
        job_date_types: [] as Array<{ type?: string | null; date?: string | null }>,
      },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useOptimizedAuth', () => ({
  useOptimizedAuth: () => ({
    user: { id: 'manager-1', department: 'sound' },
    userRole: 'management',
  }),
}));

vi.mock('@/hooks/useTimesheets', () => ({
  useTimesheets: () => ({ timesheets: [] as unknown[] }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/services/hourlyTourDateTimesheets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/hourlyTourDateTimesheets')>();
  return {
    ...actual,
    fetchHourlyTourDateRateModes: vi.fn(),
  };
});

vi.mock('@/components/timesheet/TimesheetView', () => ({
  TimesheetView: ({ jobId }: { jobId: string }) => (
    <div data-testid="timesheet-view">Timesheets for {jobId}</div>
  ),
}));

vi.mock('@/components/timesheet/TimesheetReminderSettings', () => ({
  TimesheetReminderSettings: (): null => null,
}));

describe('Timesheets hourly tour-date access', () => {
  beforeEach(() => {
    vi.mocked(fetchHourlyTourDateRateModes).mockReset();
  });

  it('enables the manager interface when the tour date has an hourly override', async () => {
    vi.mocked(fetchHourlyTourDateRateModes).mockResolvedValue([
      { job_id: 'tourdate-1', technician_id: 'tech-1', date: '2026-07-10' },
    ]);

    renderWithProviders(<Timesheets />, { route: '/timesheets?jobId=tourdate-1' });

    expect(await screen.findByTestId('timesheet-view')).toHaveTextContent('tourdate-1');
    expect(screen.queryByText('Partes deshabilitados')).not.toBeInTheDocument();
  });

  it('keeps ordinary non-prep tour dates disabled', async () => {
    vi.mocked(fetchHourlyTourDateRateModes).mockResolvedValue([]);

    renderWithProviders(<Timesheets />, { route: '/timesheets?jobId=tourdate-1' });

    expect(await screen.findByText('Partes deshabilitados')).toBeInTheDocument();
    expect(screen.queryByTestId('timesheet-view')).not.toBeInTheDocument();
  });
});
