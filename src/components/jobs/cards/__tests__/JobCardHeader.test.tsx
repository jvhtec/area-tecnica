// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { JobCardHeader } from '../JobCardHeader';

const { isMobileMock } = vi.hoisted(() => ({
  isMobileMock: vi.fn(() => false),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => isMobileMock(),
}));

vi.mock('@/hooks/useJobDistance', () => ({
  useJobDistance: (): string | null => null,
}));

vi.mock('@/components/jobs/JobStatusSelector', () => ({
  JobStatusSelector: (): null => null,
}));

const baseJob = {
  id: 'job-1',
  title: 'Tour Date Job',
  job_type: 'tourdate',
  start_time: '2026-06-16T08:00:00.000Z',
  end_time: '2026-06-16T22:00:00.000Z',
  location: { name: 'Bilbao Arena' },
};

const renderHeader = (
  job: any,
  department: any = 'sound',
  dateTypes: Record<string, { date?: string | null; type?: string | null }> = {},
) =>
  render(
    <JobCardHeader
      job={job}
      collapsed
      onToggleCollapse={vi.fn()}
      appliedBorderColor=""
      appliedBgColor=""
      dateTypes={dateTypes}
      department={department}
    />
  );

describe('JobCardHeader date type icon', () => {
  beforeEach(() => {
    isMobileMock.mockReturnValue(false);
  });

  // Regression: `dateTypes` must be keyed by `${jobId}-${yyyy-MM-dd}`. JobCardNewView
  // used to pass the raw `job_date_types` array straight through, so every lookup
  // missed and the icon silently never rendered.
  it('renders the date type icon when the map is keyed by jobId-date', () => {
    const { container } = renderHeader(baseJob, 'sound', {
      'job-1-2026-06-16': { date: '2026-06-16', type: 'travel' },
    });
    expect(container.querySelector('.text-blue-500')).not.toBeNull();
  });

  it('renders no icon when the entry is keyed by anything else', () => {
    const { container } = renderHeader(baseJob, 'sound', {
      '2026-06-16': { date: '2026-06-16', type: 'travel' },
    });
    expect(container.querySelector('.text-blue-500')).toBeNull();
  });

  it('uses the job timezone when its UTC start falls on the previous local date', () => {
    const { container } = renderHeader(
      {
        ...baseJob,
        start_time: '2026-06-16T00:30:00.000Z',
        timezone: 'America/New_York',
      },
      'sound',
      {
        'job-1-2026-06-15': { date: '2026-06-15', type: 'travel' },
      },
    );

    expect(container.querySelector('.text-blue-500')).not.toBeNull();
  });
});

describe('JobCardHeader package badges', () => {
  beforeEach(() => {
    isMobileMock.mockReturnValue(false);
  });

  it('renders Sound XL for a sound package date', () => {
    renderHeader({
      ...baseJob,
      tour_date: { sound_package_size: 'xl', is_tour_pack_only: false },
    });

    expect(screen.getByText('Sound XL')).toBeInTheDocument();
  });

  it('renders Lights M and Video S for the current department only', () => {
    const job = {
      ...baseJob,
      tour_date: {
        sound_package_size: 'xl',
        lights_package_size: 'm',
        video_package_size: 's',
        is_tour_pack_only: false,
      },
    };

    const { rerender } = renderHeader(job, 'lights');
    expect(screen.getByText('Lights M')).toBeInTheDocument();
    expect(screen.queryByText('Sound XL')).not.toBeInTheDocument();

    rerender(
      <JobCardHeader
        job={job}
        collapsed
        onToggleCollapse={vi.fn()}
        appliedBorderColor=""
        appliedBgColor=""
        dateTypes={{}}
        department="video"
      />
    );
    expect(screen.getByText('Video S')).toBeInTheDocument();
    expect(screen.queryByText('Lights M')).not.toBeInTheDocument();
  });

  it('uses legacy tour pack as S fallback for the viewed department', () => {
    renderHeader({
      ...baseJob,
      tour_date: { is_tour_pack_only: true },
    }, 'video');

    expect(screen.getByText('Video S')).toBeInTheDocument();
  });

  it('renders no package badge when no package intent exists', () => {
    renderHeader({
      ...baseJob,
      tour_date: { is_tour_pack_only: false },
    });

    expect(screen.queryByText(/Sound|Lights|Video/)).not.toBeInTheDocument();
    expect(screen.queryByText('Tour Pack Only')).not.toBeInTheDocument();
    expect(screen.queryByText('TP Only')).not.toBeInTheDocument();
  });

  it('renders mobile compact labels', () => {
    isMobileMock.mockReturnValue(true);
    renderHeader({
      ...baseJob,
      tour_date: { sound_package_size: 'xl', is_tour_pack_only: false },
    });

    expect(screen.getByText('SX XL')).toBeInTheDocument();
  });

  it('links editable project jobs to their persisted preparation', () => {
    render(
      <MemoryRouter>
        <JobCardHeader
          job={baseJob}
          collapsed
          onToggleCollapse={vi.fn()}
          appliedBorderColor=""
          appliedBgColor=""
          dateTypes={{}}
          department="sound"
          isProjectManagementPage
          userRole="management"
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /preparación guiada/i })).toHaveAttribute('href', '/jobs/job-1/setup');
  });
});
