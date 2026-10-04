import { describe, expect, it } from 'vitest';
import { buildJobRoleSlots, nextOpenSlot, slotsForDepartment } from '@/features/matrix-v2/roleSlots';

const summaries = [
  { job_id: 'j1', department: 'sound', roles: [
    { role_code: 'SND-PA-T', quantity: 3 }, { role_code: 'SND-FOH-R', quantity: 1 }, { role_code: 'SND-MON-E', quantity: 1 },
  ] },
  { job_id: 'j1', department: 'lights', roles: [{ role_code: 'LGT-BRD-R', quantity: 1 }] },
  { job_id: 'j2', department: 'sound', roles: [{ role_code: 'SND-FOH-E', quantity: 0 }] },
];

describe('buildJobRoleSlots', () => {
  it('counts holders per role, invited ones included, declined ones not', () => {
    const slots = buildJobRoleSlots(summaries, [
      { job_id: 'j1', sound_role: 'SND-PA-T', status: 'confirmed' },
      { job_id: 'j1', sound_role: 'SND-PA-T', status: 'invited' },
      { job_id: 'j1', sound_role: 'SND-FOH-R', status: 'declined' },
      { job_id: 'j1', sound_role: 'none', lights_role: 'LGT-BRD-R', status: 'invited' },
    ]).get('j1') ?? [];
    const byCode = Object.fromEntries(slots.map((s) => [s.code, s]));
    expect(byCode['SND-PA-T']).toMatchObject({ required: 3, filled: 2, invited: 1, open: 1 });
    expect(byCode['SND-FOH-R']).toMatchObject({ filled: 0, open: 1 });
    expect(byCode['LGT-BRD-R']).toMatchObject({ filled: 1, invited: 1, open: 0 });
  });

  it('orders slots by department, then R, E, T', () => {
    const slots = buildJobRoleSlots(summaries, []).get('j1') ?? [];
    expect(slots.map((s) => s.code)).toEqual(['SND-FOH-R', 'SND-MON-E', 'SND-PA-T', 'LGT-BRD-R']);
  });

  it('skips roles that require nobody and jobs without requirements', () => {
    const map = buildJobRoleSlots(summaries, []);
    expect(map.get('j2')).toEqual([]);
    expect(map.get('j3')).toBeUndefined();
  });

  it('never goes negative when more people hold a role than required', () => {
    const slots = buildJobRoleSlots(summaries, [
      { job_id: 'j1', sound_role: 'SND-FOH-R', status: 'confirmed' },
      { job_id: 'j1', sound_role: 'SND-FOH-R', status: 'confirmed' },
    ]).get('j1') ?? [];
    expect(slots.find((s) => s.code === 'SND-FOH-R')).toMatchObject({ filled: 2, open: 0 });
  });
});

describe('slot helpers', () => {
  const slots = buildJobRoleSlots(summaries, [{ job_id: 'j1', sound_role: 'SND-FOH-R', status: 'confirmed' }]).get('j1');
  it('finds the next open slot', () => {
    expect(nextOpenSlot(slots)?.code).toBe('SND-MON-E');
    expect(nextOpenSlot(undefined)).toBeNull();
  });
  it('filters by department', () => {
    expect(slotsForDepartment(slots, 'lights').map((s) => s.code)).toEqual(['LGT-BRD-R']);
    expect(slotsForDepartment(slots, null)).toHaveLength(4);
  });
});
