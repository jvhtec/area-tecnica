import { describe, expect, it } from 'vitest';
import { buildRemoveRows, groupAssignedPairs, planAssignRows, planConfirmRows, resolveRemoveIntents, type BatchLookups, type BatchAssignmentRef } from '@/features/matrix-v2/batch/plan';
import { cellKey } from '@/features/matrix-v2/batch/selection';
import { JOB_A, JOB_B, makeJob, makeTechnician } from '@/features/matrix-v2/__tests__/fixtures';
import type { RoleSlot } from '@/features/matrix-v2/roleSlots';

const D1 = '2026-10-13';
const D2 = '2026-10-14';
const D0 = '2026-10-12';
const technicians = ['t1', 't2', 't3', 't4'].map((id, index) => makeTechnician(id, { first_name: ['Ana', 'Beto', 'Carla', 'Dani'][index], last_name: 'Test' }));

function lookups(overrides: Partial<{
  assignments: Record<string, BatchAssignmentRef>;
  unavailable: string[];
  fridge: string[];
  declined: Record<string, string[]>;
  slots: RoleSlot[];
}> = {}): BatchLookups {
  const assignments = overrides.assignments ?? {};
  return {
    technician: (id) => technicians.find((technician) => technician.id === id),
    job: (id) => ({ [JOB_A]: makeJob(JOB_A), [JOB_B]: makeJob(JOB_B, { title: 'Boda' }) }[id]),
    assignmentOn: (technicianId, dateKey) => assignments[cellKey(technicianId, dateKey)],
    isUnavailable: (technicianId, dateKey) => (overrides.unavailable ?? []).includes(cellKey(technicianId, dateKey)),
    isFridge: (technicianId) => (overrides.fridge ?? []).includes(technicianId),
    declinedJobIds: (technicianId) => new Set(overrides.declined?.[technicianId] ?? []),
    roleSlots: () => overrides.slots ?? [{ code: 'SND-FOH-R', department: 'sound', required: 1, filled: 0, invited: 0, open: 1 }, { code: 'SND-PA-T', department: 'sound', required: 3, filled: 0, invited: 0, open: 3 }],
    lastRole: () => null,
  };
}

const block = (ids: string[], days: string[]) => ids.flatMap((id) => days.map((day) => cellKey(id, day)));

describe('planAssignRows', () => {
  it('one row per person, on the selected days that belong to the job', () => {
    const rows = planAssignRows(block(['t1', 't2'], [D0, D1, D2]), JOB_A, 'invited', lookups());
    expect(rows).toHaveLength(2);
    // The job runs 13 and 14 Oct: the 12th is outside it and left out.
    expect(rows[0].intents[0]).toMatchObject({ kind: 'assign', technicianId: 't1', jobId: JOB_A, status: 'invited', coverage: 'full', mode: 'add', source: 'matrix-batch' });
    expect(rows[0].status).toBe('pending');
  });

  it('spreads people over the open slots in turn', () => {
    const rows = planAssignRows(block(['t1', 't2', 't3', 't4'], [D1, D2]), JOB_A, 'invited', lookups());
    const roles = rows.map((row) => row.intents[0].kind === 'assign' ? row.intents[0].role : null);
    expect(roles).toEqual(['SND-FOH-R', 'SND-PA-T', 'SND-PA-T', 'SND-PA-T']);
  });

  it('carries the chosen status', () => {
    const [row] = planAssignRows(block(['t1'], [D1]), JOB_A, 'confirmed', lookups());
    expect(row.intents[0]).toMatchObject({ status: 'confirmed', coverage: 'single', dates: [D1] });
  });

  it('skips, with the reason, people who cannot take the job', () => {
    const rows = planAssignRows(block(['t1', 't2', 't3'], [D1, D2]), JOB_A, 'invited', lookups({
      fridge: ['t1'], declined: { t2: [JOB_A] }, unavailable: [cellKey('t3', D1), cellKey('t3', D2)],
    }));
    expect(rows.map((row) => [row.name, row.status, row.message])).toEqual([
      ['Ana Test', 'skipped', 'Está en la nevera'],
      ['Beto Test', 'skipped', 'Rechazó este trabajo'],
      ['Carla Test', 'skipped', 'No está disponible esos días'],
    ]);
  });

  it('leaves out only the unavailable days and says so', () => {
    const [row] = planAssignRows(block(['t1'], [D1, D2]), JOB_A, 'invited', lookups({ unavailable: [cellKey('t1', D1)] }));
    expect(row.intents[0]).toMatchObject({ coverage: 'single', dates: [D2] });
    expect(row.message).toBe('1 día no disponible omitido');
  });

  it('leaves busy days to the server so its conflict can be shown', () => {
    const [row] = planAssignRows(block(['t1'], [D1, D2]), JOB_A, 'invited', lookups({ assignments: { [cellKey('t1', D1)]: { job_id: JOB_B } } }));
    expect(row.intents[0]).toMatchObject({ coverage: 'full' });
  });

  it('someone already on the job is a no-op, or only gets the days they lack, keeping their role', () => {
    const all = planAssignRows(block(['t1'], [D1, D2]), JOB_A, 'invited', lookups({ assignments: { [cellKey('t1', D1)]: { job_id: JOB_A }, [cellKey('t1', D2)]: { job_id: JOB_A } } }));
    expect(all[0]).toMatchObject({ status: 'noop', message: 'Ya estaba en el trabajo esos días' });
    const some = planAssignRows(block(['t1'], [D1, D2]), JOB_A, 'invited', lookups({ assignments: { [cellKey('t1', D1)]: { job_id: JOB_A, sound_role: 'SND-MON-E' } } }));
    expect(some[0].intents[0]).toMatchObject({ role: 'SND-MON-E', coverage: 'single', dates: [D2] });
  });

  it('asks for the role instead of guessing a pay level', () => {
    const ambiguous = [makeTechnician('t9', { first_name: 'Eva', skills: [{ name: 'FOH', is_primary: true }, { name: 'Monitores' }] })];
    const base = lookups({ slots: [] });
    const rows = planAssignRows(block(['t9'], [D1]), JOB_A, 'invited', { ...base, technician: (id) => ambiguous.find((t) => t.id === id) });
    expect(rows[0]).toMatchObject({ status: 'needs-role', openAt: { technicianId: 't9', dateKey: D1 } });
  });

  it('skips a person when none of their days belong to the job', () => {
    const [row] = planAssignRows(block(['t1'], [D0]), JOB_A, 'invited', lookups());
    expect(row).toMatchObject({ status: 'skipped', message: 'Ninguno de los días elegidos es de este trabajo' });
  });
});

describe('planConfirmRows', () => {
  it('confirms invitations and counts what it leaves alone', () => {
    const plan = planConfirmRows(block(['t1', 't2', 't3', 't4'], [D1]), lookups({
      assignments: {
        [cellKey('t1', D1)]: { job_id: JOB_A, status: 'invited' },
        [cellKey('t2', D1)]: { job_id: JOB_A, status: 'confirmed' },
        [cellKey('t3', D1)]: { job_id: JOB_B, status: 'declined' },
      },
    }));
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0].intents[0]).toEqual({ kind: 'confirm', technicianId: 't1', jobId: JOB_A, source: 'matrix-batch' });
    expect(plan).toMatchObject({ alreadyConfirmed: 1, notInvited: 1, empty: 1 });
  });

  it('is one row per pair however many days are selected', () => {
    const plan = planConfirmRows(block(['t1'], [D1, D2]), lookups({
      assignments: { [cellKey('t1', D1)]: { job_id: JOB_A, status: 'invited' }, [cellKey('t1', D2)]: { job_id: JOB_A, status: 'invited' } },
    }));
    expect(plan.rows).toHaveLength(1);
  });
});

describe('removal', () => {
  it('groups the selected cells that hold an assignment by pair', () => {
    const { pairs, empty } = groupAssignedPairs(block(['t1', 't2'], [D1, D2]), lookups({
      assignments: { [cellKey('t1', D1)]: { job_id: JOB_A }, [cellKey('t1', D2)]: { job_id: JOB_A }, [cellKey('t2', D1)]: { job_id: JOB_B } },
    }));
    expect(pairs.map((pair) => [pair.technicianId, pair.jobId, pair.days])).toEqual([['t1', JOB_A, [D1, D2]], ['t2', JOB_B, [D1]]]);
    expect(empty).toBe(1);
  });

  it('removing every day the pair has is a removal of the assignment', () => {
    expect(resolveRemoveIntents({ technicianId: 't1', jobId: JOB_A, selectedDays: [D1, D2] }, { exists: true, dates: [D1, D2] }))
      .toEqual([{ kind: 'remove', technicianId: 't1', jobId: JOB_A, source: 'matrix-batch' }]);
  });

  it('removing some days is one command per day, never the last one', () => {
    const intents = resolveRemoveIntents({ technicianId: 't1', jobId: JOB_A, selectedDays: [D1, D2] }, { exists: true, dates: [D0, D1, D2] });
    expect(intents).toEqual([
      { kind: 'remove-date', technicianId: 't1', jobId: JOB_A, date: D1, source: 'matrix-batch' },
      { kind: 'remove-date', technicianId: 't1', jobId: JOB_A, date: D2, source: 'matrix-batch' },
    ]);
  });

  it('does nothing for a pair that is gone or has none of those days', () => {
    expect(resolveRemoveIntents({ technicianId: 't1', jobId: JOB_A, selectedDays: [D1] }, { exists: false, dates: [] })).toEqual([]);
    expect(resolveRemoveIntents({ technicianId: 't1', jobId: JOB_A, selectedDays: [D1] }, { exists: true, dates: [D0] })).toEqual([]);
  });

  it('builds rows from the states it could read and skips the rest', () => {
    const pairs = [
      { technicianId: 't1', jobId: JOB_A, title: 'Trabajo', days: [D1] },
      { technicianId: 't2', jobId: JOB_A, title: 'Trabajo', days: [D1] },
      { technicianId: 't3', jobId: JOB_A, title: 'Trabajo', days: [D1] },
    ];
    const rows = buildRemoveRows(pairs, new Map([[`t1:${JOB_A}`, { exists: true, dates: [D1] }], [`t3:${JOB_A}`, { exists: true, dates: [D0] }]]), lookups());
    expect(rows.map((row) => row.status)).toEqual(['pending', 'skipped', 'noop']);
  });
});
