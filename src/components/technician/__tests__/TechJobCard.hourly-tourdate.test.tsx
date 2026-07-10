// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TechJobCard } from '@/components/technician/TechJobCard';
import type { Theme } from '@/components/technician/types';
import { renderWithProviders } from '@/test/renderWithProviders';

vi.mock('@/hooks/useExpensePermissions', () => ({
  useExpensePermissions: () => ({ data: [] as unknown[] }),
  isPermissionActive: () => false,
}));

vi.mock('@/hooks/useJobExpenses', () => ({
  useJobExpenses: () => ({ data: [] as unknown[] }),
}));

vi.mock('@/components/incident-reports/TechnicianIncidentReportDialog', () => ({
  TechnicianIncidentReportDialog: (): null => null,
}));

const theme: Theme = {
  bg: 'bg-background',
  nav: 'bg-background',
  card: 'bg-card',
  textMain: 'text-foreground',
  textMuted: 'text-muted-foreground',
  accent: 'bg-primary',
  input: 'bg-background',
  modalOverlay: 'bg-black/50',
  divider: 'border-border',
  danger: 'text-destructive',
  success: 'text-green-600',
  warning: 'text-amber-600',
  cluster: 'bg-muted',
};

const createTourDateAssignment = (hasHourlyTimesheet: boolean) => ({
  id: 'assignment-1',
  job_id: 'tourdate-1',
  technician_id: 'tech-1',
  role: 'Técnico',
  jobs: {
    id: 'tourdate-1',
    title: 'Fecha de gira',
    start_time: '2026-07-10T08:00:00Z',
    end_time: '2026-07-10T20:00:00Z',
    job_type: 'tourdate',
    artist_count: 0,
    has_hourly_timesheet: hasHourlyTimesheet,
    job_date_types: [] as Array<{ date?: string | null; type?: string | null }>,
  },
});

describe('TechJobCard hourly tour-date timesheets', () => {
  it('shows the hours action for a tour date with an hourly timesheet', () => {
    const onAction = vi.fn();
    const assignment = createTourDateAssignment(true);

    renderWithProviders(
      <TechJobCard
        job={assignment}
        theme={theme}
        isDark={false}
        onAction={onAction}
        isCrewChief={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /horas/i }));
    expect(onAction).toHaveBeenCalledWith('timesheet', assignment.jobs);
  });

  it('keeps the hours action hidden for a tour date without prep or hourly timesheets', () => {
    renderWithProviders(
      <TechJobCard
        job={createTourDateAssignment(false)}
        theme={theme}
        isDark={false}
        onAction={vi.fn()}
        isCrewChief={false}
      />,
    );

    expect(screen.queryByRole('button', { name: /horas/i })).not.toBeInTheDocument();
  });
});
