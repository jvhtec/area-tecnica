import { roleOptionsForDiscipline, type RoleOption } from '@/types/roles';
import type { RoleSlot } from '@/features/matrix-v2/roleSlots';
import {
  roleDisciplineForDepartment,
  type MatrixTechnicianRef,
} from '@/features/matrix-v2/types';

export type RoleSuggestionReason =
  /** An open slot of the job, in the technician's strongest skill. */
  | 'skill-slot'
  /** An open slot of the job in the technician's discipline. */
  | 'open-slot'
  /** What the technician already does on this job or tour. */
  | 'last-role'
  /** The only role their skills point to, with no slot to guide the level. */
  | 'skill'
  /** Several levels fit and nothing says which: the manager has to choose. */
  | 'ambiguous'
  | 'none';

export interface RoleSuggestion {
  /** The preselected role, or null when the manager has to choose. */
  code: string | null;
  reason: RoleSuggestionReason;
  /** Roles the technician may hold, strongest match first. */
  options: RoleOption[];
  /** Subset of `options` the technician's skills point to. */
  skillMatches: Set<string>;
}

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** "Monitores — Especialista" -> "monitores" */
const labelHead = (label: string) => normalize(label.split('—')[0] ?? label);

type Skill = NonNullable<MatrixTechnicianRef['skills']>[number];

const rankSkills = (skills: MatrixTechnicianRef['skills']): Skill[] =>
  [...(skills ?? [])]
    .filter((skill) => typeof skill?.name === 'string' && skill.name.trim().length > 0)
    .sort((a, b) => Number(b.is_primary === true) - Number(a.is_primary === true)
      || (b.proficiency ?? 0) - (a.proficiency ?? 0));

/** True when a skill name ("Monitores", "FOH", "RF") points at this role's position. */
export const skillMatchesRole = (skillName: string, option: RoleOption): boolean => {
  const skill = normalize(skillName);
  if (!skill) return false;
  const position = option.position.toLowerCase();
  const words = skill.split(/[^a-z0-9]+/).filter(Boolean);
  if (words.includes(position)) return true;
  const head = labelHead(option.label);
  if (head.length >= 4 && skill.includes(head)) return true;
  if (skill.length >= 4 && head.includes(skill)) return true;
  return false;
};

/**
 * Picks the role a quick assignment starts with. It never guesses a pay level:
 * when only skills are known and several levels fit (FOH Responsable vs
 * Especialista), it asks instead of defaulting to the more expensive one.
 */
export function suggestRole({
  technician,
  slots,
  lastRoleCode = null,
}: {
  technician: Pick<MatrixTechnicianRef, 'department' | 'skills'>;
  slots: RoleSlot[];
  lastRoleCode?: string | null;
}): RoleSuggestion {
  const discipline = roleDisciplineForDepartment(technician.department);
  const options = discipline ? roleOptionsForDiscipline(discipline) : [];
  if (options.length === 0) {
    return { code: null, reason: 'none', options: [], skillMatches: new Set() };
  }

  const ranked = rankSkills(technician.skills);
  // Position of the strongest skill that points at each role (lower is better).
  const rankByCode = new Map<string, number>();
  for (const option of options) {
    const index = ranked.findIndex((skill) => skillMatchesRole(skill.name ?? '', option));
    if (index !== -1) rankByCode.set(option.code, index);
  }
  const rankOf = (code: string) => rankByCode.get(code) ?? Number.POSITIVE_INFINITY;
  const skillMatches = new Set(rankByCode.keys());

  const optionCodes = new Set(options.map((option) => option.code));
  const openCodes = slots
    .filter((slot) => slot.open > 0 && optionCodes.has(slot.code))
    .map((slot) => slot.code);

  // Strongest matches first, otherwise the registry order (R, E, T).
  const sorted = [...options].sort((a, b) => rankOf(a.code) - rankOf(b.code));

  if (openCodes.length > 0) {
    const matching = openCodes
      .filter((code) => skillMatches.has(code))
      .sort((a, b) => rankOf(a) - rankOf(b));
    if (matching.length > 0) return { code: matching[0], reason: 'skill-slot', options: sorted, skillMatches };
    return { code: openCodes[0], reason: 'open-slot', options: sorted, skillMatches };
  }

  if (lastRoleCode && optionCodes.has(lastRoleCode)) {
    return { code: lastRoleCode, reason: 'last-role', options: sorted, skillMatches };
  }

  if (skillMatches.size === 1) {
    return { code: [...skillMatches][0], reason: 'skill', options: sorted, skillMatches };
  }
  return { code: null, reason: skillMatches.size > 1 ? 'ambiguous' : 'none', options: sorted, skillMatches };
}
