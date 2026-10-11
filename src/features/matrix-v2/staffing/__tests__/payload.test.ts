// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { buildResendPayload, buildStaffingPayload } from '@/features/matrix-v2/staffing/payload';
import { readChannel, writeChannel } from '@/features/matrix-v2/staffing/rememberedChannel';
import { describeStaffingConflict } from '@/features/matrix-v2/staffing/conflicts';

const JOB_DAYS = ['2026-10-13', '2026-10-14', '2026-10-15'];
const base = { jobId: 'job-a', technicianId: 't1', channel: 'email' as const, department: 'sound', jobDays: JOB_DAYS };

describe('buildStaffingPayload', () => {
  it('asking for every day of the job is a request for the whole job', () => {
    expect(buildStaffingPayload({ ...base, phase: 'availability', days: JOB_DAYS })).toEqual({
      job_id: 'job-a', profile_id: 't1', phase: 'availability', channel: 'email', department: 'sound', single_day: false,
    });
  });

  it('lists the days otherwise, and one day also names the target date', () => {
    const some = buildStaffingPayload({ ...base, phase: 'availability', days: ['2026-10-15', '2026-10-13'] });
    expect(some).toMatchObject({ single_day: true, dates: ['2026-10-13', '2026-10-15'] });
    expect(some).not.toHaveProperty('target_date');
    expect(buildStaffingPayload({ ...base, phase: 'availability', days: ['2026-10-14'] })).toMatchObject({ single_day: true, dates: ['2026-10-14'], target_date: '2026-10-14' });
  });

  it('an offer carries the role and a trimmed message, and leaves an empty message out', () => {
    expect(buildStaffingPayload({ ...base, phase: 'offer', days: JOB_DAYS, role: 'SND-MON-E', message: '  Carga a las 8  ' }))
      .toMatchObject({ phase: 'offer', role: 'SND-MON-E', message: 'Carga a las 8', single_day: false });
    expect(buildStaffingPayload({ ...base, phase: 'offer', days: JOB_DAYS, role: 'SND-MON-E', message: '   ' })).not.toHaveProperty('message');
  });

  it('an availability request never carries a role or message', () => {
    const payload = buildStaffingPayload({ ...base, phase: 'availability', days: JOB_DAYS, role: 'SND-MON-E', message: 'x' });
    expect(payload).not.toHaveProperty('role');
    expect(payload).not.toHaveProperty('message');
  });

  it('only sets override_conflicts when asked to', () => {
    expect(buildStaffingPayload({ ...base, phase: 'availability', days: JOB_DAYS })).not.toHaveProperty('override_conflicts');
    expect(buildStaffingPayload({ ...base, phase: 'availability', days: JOB_DAYS, overrideConflicts: true })).toMatchObject({ override_conflicts: true });
  });

  it('ignores duplicate days and treats no days as the whole job', () => {
    expect(buildStaffingPayload({ ...base, phase: 'availability', days: ['2026-10-14', '2026-10-14'] })).toMatchObject({ dates: ['2026-10-14'] });
    expect(buildStaffingPayload({ ...base, phase: 'availability', days: [] })).toMatchObject({ single_day: false });
  });
});

describe('buildResendPayload', () => {
  it('names the request being resent and the channel to use', () => {
    expect(buildResendPayload({ jobId: 'job-a', technicianId: 't1', channel: 'whatsapp', department: null, requestId: 'req-1' })).toEqual({
      job_id: 'job-a', profile_id: 't1', phase: 'availability', channel: 'whatsapp', department: null, resend_request_id: 'req-1',
    });
  });
});

describe('remembered channel', () => {
  const storage = () => {
    const data = new Map<string, string>();
    return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) };
  };

  it('is email until someone picks WhatsApp, and is kept per person', () => {
    const store = storage();
    expect(readChannel(store, 'ana')).toBe('email');
    writeChannel(store, 'ana', 'whatsapp');
    expect(readChannel(store, 'ana')).toBe('whatsapp');
    expect(readChannel(store, 'beto')).toBe('email');
  });

  it('survives a browser that will not store anything', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(readChannel(broken, 'ana')).toBe('email');
    expect(() => writeChannel(broken, 'ana', 'whatsapp')).not.toThrow();
    expect(readChannel(null, 'ana')).toBe('email');
  });
});

describe('describeStaffingConflict', () => {
  it('lists overlapping jobs and days that are off', () => {
    const summary = describeStaffingConflict({
      conflicts: [{ job_name: 'Boda Sol', start_time: '2026-10-13T08:00:00Z', end_time: '2026-10-14T18:00:00Z', role: 'SND-PA-T' }],
      unavailability: [{ date: '2026-10-15', reason: 'Vacaciones' }],
    });
    expect(summary.jobs).toEqual([{ title: 'Boda Sol', range: '13 oct – 14 oct', role: 'SND-PA-T' }]);
    expect(summary.off).toEqual([{ label: '15 oct', reason: 'Vacaciones' }]);
  });

  it('copes with missing fields and with garbage', () => {
    expect(describeStaffingConflict({ conflicts: [{}], unavailability: [{}] })).toEqual({
      jobs: [{ title: 'Trabajo sin nombre', range: null, role: null }],
      off: [{ label: 'Fecha no especificada', reason: null }],
    });
    expect(describeStaffingConflict(null)).toEqual({ jobs: [], off: [] });
    expect(describeStaffingConflict({ conflicts: 'x', unavailability: [1] })).toEqual({ jobs: [], off: [] });
  });
});

describe('useRememberedChannel', () => {
  it('reads the channel again once the person is known', async () => {
    const { renderHook } = await import('@testing-library/react');
    const { useRememberedChannel } = await import('@/features/matrix-v2/staffing/rememberedChannel');
    window.localStorage.setItem('matrix-v2:staffing-channel:ana', 'whatsapp');
    const view = renderHook(({ userId }: { userId: string | null }) => useRememberedChannel(userId), { initialProps: { userId: null as string | null } });
    expect(view.result.current.channel).toBe('email');
    view.rerender({ userId: 'ana' });
    expect(view.result.current.channel).toBe('whatsapp');
    window.localStorage.clear();
  });
});
