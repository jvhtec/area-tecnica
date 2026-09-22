import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WallboardSnapshotFeed } from '@/features/wallboard/types';

const { getSessionMock, invokeMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  invokeMock: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
    functions: {
      invoke: invokeMock,
    },
  },
}));

import { WallboardApi, WallboardApiError } from './wallboard-api';

const snapshotFixture = {
  schemaVersion: 1,
  generatedAt: '2026-09-22T10:00:00.000Z',
  presetSlug: 'produccion',
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
      color: '#123456',
      job_type: 'evento',
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
  crew: {
    jobs: [{
      id: 'job-1',
      title: 'Montaje principal',
      crew: [{
        name: 'Ana',
        role: 'Técnica de sonido',
        dept: 'sound',
        timesheetStatus: 'draft',
      }],
    }],
  },
  pending: {
    items: [{ severity: 'yellow', text: 'Falta una persona de sonido' }],
  },
  logistics: {
    items: [{
      id: 'logistics-1',
      date: '2026-09-22',
      time: '07:30',
      title: 'Carga',
      transport_type: 'trailer',
      transport_provider: null,
      plate: null,
      procedure: 'load',
      loadingBay: 'A',
      departments: ['sound'],
    }],
  },
  announcements: {
    announcements: [{
      id: 'announcement-1',
      message: 'Puerta A cerrada',
      level: 'warn',
      created_at: '2026-09-22T09:00:00.000Z',
      active: true,
    }],
  },
} satisfies WallboardSnapshotFeed;

describe('WallboardApi.snapshot', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_FUNCTIONS_URL', 'https://example.supabase.co/functions/v1');
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue({ data: { session: null } });
    invokeMock.mockReset();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('returns a validated canonical snapshot', async () => {
    invokeMock.mockResolvedValue({ data: snapshotFixture, error: null });

    await expect(new WallboardApi('wallboard-jwt').snapshot()).resolves.toEqual(snapshotFixture);
    expect(invokeMock).toHaveBeenCalledWith('wallboard-feed', {
      body: { path: '/snapshot' },
      headers: { 'x-wallboard-jwt': 'wallboard-jwt' },
    });
  });

  it('preserves the signed-in user token in the direct-fetch fallback', async () => {
    invokeMock.mockRejectedValue(new Error('invoke unavailable'));
    getSessionMock.mockResolvedValue({ data: { session: { access_token: 'user-jwt' } } });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(snapshotFixture), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(new WallboardApi().snapshot()).resolves.toEqual(snapshotFixture);
    expect(fetchMock).toHaveBeenCalledWith('https://example.supabase.co/functions/v1/wallboard-feed/snapshot', {
      headers: { Authorization: 'Bearer user-jwt' },
      cache: 'no-store',
    });
  });

  it.each([
    ['a non-object response', null],
    ['an unsupported schema version', { ...snapshotFixture, schemaVersion: 2 }],
    ['a missing feed', { ...snapshotFixture, overview: undefined }],
    ['a malformed nested feed', {
      ...snapshotFixture,
      logistics: {
        items: [{ ...snapshotFixture.logistics.items[0], departments: [null] }],
      },
    }],
  ])('rejects %s', async (_description, payload) => {
    invokeMock.mockResolvedValue({ data: payload, error: null });

    const request = new WallboardApi().snapshot();

    await expect(request).rejects.toBeInstanceOf(WallboardApiError);
    await expect(request).rejects.toThrow('/snapshot returned a malformed payload');
  });
});
