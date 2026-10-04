import { describe, expect, it } from 'vitest';
import { skillMatchesRole, suggestRole } from '@/features/matrix-v2/roleSuggestion';
import type { RoleSlot } from '@/features/matrix-v2/roleSlots';
import { roleOptionsForDiscipline } from '@/types/roles';

const slot = (code: string, open: number, department = 'sound'): RoleSlot => ({
  code, department, required: Math.max(open, 1), filled: 0, invited: 0, open,
});

const find = (code: string) => {
  const option = roleOptionsForDiscipline('sound').concat(roleOptionsForDiscipline('lights')).find((o) => o.code === code);
  if (!option) throw new Error(`unknown role ${code}`);
  return option;
};

describe('skillMatchesRole', () => {
  it('matches a skill to a role position by code or by label', () => {
    expect(skillMatchesRole('FOH', find('SND-FOH-E'))).toBe(true);
    expect(skillMatchesRole('Monitores', find('SND-MON-E'))).toBe(true);
    expect(skillMatchesRole('monitor', find('SND-MON-E'))).toBe(true);
    expect(skillMatchesRole('RF', find('SND-RF-E'))).toBe(true);
    expect(skillMatchesRole('Sistemas', find('SND-SYS-E'))).toBe(true);
  });

  it('ignores accents and case, and does not match unrelated skills', () => {
    expect(skillMatchesRole('SISTEMAS', find('SND-SYS-E'))).toBe(true);
    expect(skillMatchesRole('Cañón', find('LGT-CAN-T'))).toBe(true);
    expect(skillMatchesRole('Rigging', find('SND-RF-E'))).toBe(false);
    expect(skillMatchesRole('', find('SND-FOH-E'))).toBe(false);
  });
});

describe('suggestRole', () => {
  it('prefers an open slot that matches the strongest skill', () => {
    const suggestion = suggestRole({
      technician: { department: 'sound', skills: [{ name: 'Monitores', is_primary: true }, { name: 'FOH' }] },
      slots: [slot('SND-FOH-R', 1), slot('SND-MON-E', 1), slot('SND-PA-T', 2)],
    });
    expect(suggestion).toMatchObject({ code: 'SND-MON-E', reason: 'skill-slot' });
    expect(suggestion.skillMatches.has('SND-MON-E')).toBe(true);
  });

  it('falls back to the first open slot of the discipline', () => {
    const suggestion = suggestRole({
      technician: { department: 'sound', skills: [] },
      slots: [slot('LGT-BRD-R', 1, 'lights'), slot('SND-PA-T', 3)],
    });
    expect(suggestion).toMatchObject({ code: 'SND-PA-T', reason: 'open-slot' });
  });

  it('ignores slots with no room', () => {
    const suggestion = suggestRole({
      technician: { department: 'sound', skills: [{ name: 'RF' }] },
      slots: [slot('SND-RF-E', 0)],
      lastRoleCode: 'SND-PA-T',
    });
    expect(suggestion).toMatchObject({ code: 'SND-PA-T', reason: 'last-role' });
  });

  it('ignores a last role outside the technician discipline', () => {
    const suggestion = suggestRole({ technician: { department: 'sound', skills: [] }, slots: [], lastRoleCode: 'LGT-BRD-R' });
    expect(suggestion.code).toBeNull();
  });

  it('preselects a single skill match but never guesses between levels', () => {
    const single = suggestRole({ technician: { department: 'sound', skills: [{ name: 'RF' }] }, slots: [] });
    expect(single).toMatchObject({ code: 'SND-RF-E', reason: 'skill' });

    const ambiguous = suggestRole({ technician: { department: 'sound', skills: [{ name: 'FOH' }] }, slots: [] });
    expect(ambiguous).toMatchObject({ code: null, reason: 'ambiguous' });
    expect([...ambiguous.skillMatches].sort()).toEqual(['SND-FOH-E', 'SND-FOH-R']);
    // Skill matches come first in the options.
    expect(ambiguous.options.slice(0, 2).map((o) => o.code).sort()).toEqual(['SND-FOH-E', 'SND-FOH-R']);
  });

  it('gives logistics staff the production roles, like the database does', () => {
    const suggestion = suggestRole({ technician: { department: 'logistics', skills: [] }, slots: [slot('PROD-AYUD-T', 1, 'production')] });
    expect(suggestion).toMatchObject({ code: 'PROD-AYUD-T', reason: 'open-slot' });
  });

  it('offers nothing for a department with no roles', () => {
    expect(suggestRole({ technician: { department: 'administrative', skills: [] }, slots: [] })).toMatchObject({ code: null, reason: 'none', options: [] });
    expect(suggestRole({ technician: { department: null, skills: null }, slots: [] }).options).toEqual([]);
  });
});
