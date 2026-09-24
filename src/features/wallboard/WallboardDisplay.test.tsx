// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WallboardSnapshotFeed } from './types';

const mocks = vi.hoisted(() => ({
  processAnnouncements: vi.fn(),
  snapshot: vi.fn(),
}));

vi.mock('@/lib/wallboard-api', () => {
  class WallboardApiError extends Error {
    status?: number;
  }
  return {
    WallboardApi: class {
      snapshot = mocks.snapshot;
    },
    WallboardApiError,
  };
});

vi.mock('@/hooks/useLgScreensaverBlock', () => ({ useLgScreensaverBlock: vi.fn() }));
vi.mock('@/components/WakeLockVideo', () => ({ WakeLockVideo: () => null }));
vi.mock('@/components/SplashScreen', () => ({ default: () => <div>Cargando</div> }));
vi.mock('./hooks/useWallboardPreset', () => ({ useWallboardPreset: vi.fn() }));
vi.mock('./useWallboardRotation', () => ({ useWallboardRotation: vi.fn() }));
vi.mock('./useWallboardAnnouncements', () => ({
  useWallboardAnnouncements: () => mocks.processAnnouncements,
}));
vi.mock('./components/WallboardHeader', () => ({ WallboardHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock('./components/Ticker', () => ({ Ticker: () => null }));
vi.mock('./components/WallboardActivePanel', () => ({
  WallboardActivePanel: ({ overview }: { overview: WallboardSnapshotFeed['overview'] | null }) => (
    <div>{overview?.jobs[0]?.title ?? 'Sin datos'}</div>
  ),
}));

import { WallboardDisplay } from './WallboardDisplay';

const snapshot: WallboardSnapshotFeed = {
  schemaVersion: 1,
  generatedAt: '2026-09-22T12:00:00.000Z',
  presetSlug: 'default',
  overview: {
    jobs: [{
      id: 'job-1',
      title: 'Montaje principal',
      start_time: '2026-09-22T08:00:00.000Z',
      end_time: '2026-09-22T18:00:00.000Z',
      location: { name: 'Nave 1' },
      departments: ['sound'],
      crewAssigned: { sound: 1, lights: 0, video: 0, total: 1 },
      crewNeeded: { sound: 2, lights: 0, video: 0, total: 2 },
      docs: { sound: { have: 1, need: 2 } },
      status: 'yellow',
    }],
  },
  calendar: {
    jobs: [],
    jobsByDate: {},
    jobDateLookup: {},
    range: { start: '2026-08-31T22:00:00.000Z', end: '2026-10-11T21:59:59.999Z' },
    focusMonth: 8,
    focusYear: 2026,
  },
  crew: { jobs: [] },
  pending: { items: [] },
  logistics: { items: [] },
  announcements: { announcements: [] },
};

describe('WallboardDisplay', () => {
  beforeEach(() => {
    mocks.snapshot.mockReset();
    mocks.snapshot.mockResolvedValue(snapshot);
    mocks.processAnnouncements.mockReset();
  });

  it('loads every panel from one canonical snapshot request', async () => {
    render(
      <MemoryRouter>
        <WallboardDisplay skipSplash />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Montaje principal')).toBeInTheDocument());
    expect(mocks.snapshot).toHaveBeenCalledTimes(1);
  });
});
