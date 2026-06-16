// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const renderHeader = (job: any, department: any = 'sound') =>
  render(
    <JobCardHeader
      job={job}
      collapsed
      onToggleCollapse={vi.fn()}
      appliedBorderColor=""
      appliedBgColor=""
      dateTypes={{}}
      department={department}
    />
  );

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
});
