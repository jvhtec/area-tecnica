import { describe, expect, it } from 'vitest';
import { planFocusAssign } from '@/features/matrix-v2/focus/focusAssign';
import { makeTechnician, JOB_A, TECH_1 } from '@/features/matrix-v2/__tests__/fixtures';
import type { RoleSlot } from '@/features/matrix-v2/roleSlots';

const slot = (code: string, open: number, department = 'sound'): RoleSlot => ({ code, department, required: open, filled: 0, invited: 0, open });
const DAYS = ['2026-10-13', '2026-10-14'];

const plan = (overrides: Partial<Parameters<typeof planFocusAssign>[0]> = {}) => planFocusAssign({
  technician: makeTechnician(TECH_1),
  jobId: JOB_A,
  days: DAYS,
  jobDays: DAYS,
  status: 'invited',
  slots: [slot('SND-MON-E', 1)],
  ...overrides,
});

describe('planFocusAssign', () => {
  it('takes the next open slot of the discipline and adds the days', () => {
    expect(plan()).toMatchObject({
      kind: 'run',
      days: DAYS,
      intent: { kind: 'assign', technicianId: TECH_1, jobId: JOB_A, role: 'SND-MON-E', status: 'invited', coverage: 'full', mode: 'add', source: 'matrix-focus' },
    });
  });

  it('every day of the job is full coverage, so it follows the job if its dates change', () => {
    const result = plan();
    expect(result.kind === 'run' && result.intent.dates).toBeUndefined();
  });

  it('one day is single coverage, several but not all are an explicit list', () => {
    const single = plan({ days: ['2026-10-14'] });
    expect(single.kind === 'run' && single.intent).toMatchObject({ coverage: 'single', dates: ['2026-10-14'] });
    const multi = plan({ days: ['2026-10-13', '2026-10-15'], jobDays: [...DAYS, '2026-10-15'] });
    expect(multi.kind === 'run' && multi.intent).toMatchObject({ coverage: 'multi', dates: ['2026-10-13', '2026-10-15'] });
  });

  it('carries the focus status', () => {
    const result = plan({ status: 'confirmed' });
    expect(result.kind === 'run' && result.intent.status).toBe('confirmed');
  });

  it('keeps the role someone already holds on the job', () => {
    const result = plan({ existingRole: 'SND-FOH-R' });
    expect(result.kind === 'run' && result.intent.role).toBe('SND-FOH-R');
  });

  it('only offers slots of the technician\'s discipline', () => {
    const result = plan({ slots: [slot('LGT-BRD-E', 2, 'lights'), slot('SND-PA-T', 1)] });
    expect(result.kind === 'run' && result.intent.role).toBe('SND-PA-T');
  });

  it('asks (opens the inspector) when the level is ambiguous and no slot says which', () => {
    const technician = makeTechnician(TECH_1, { skills: [{ name: 'FOH', is_primary: true }, { name: 'Monitores' }] });
    expect(plan({ technician, slots: [] })).toEqual({ kind: 'inspect', reason: 'role' });
  });

  it('has nothing to do without days', () => {
    expect(plan({ days: [] })).toEqual({ kind: 'inspect', reason: 'no-days' });
  });
});
