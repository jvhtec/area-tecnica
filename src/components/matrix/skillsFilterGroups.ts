import type { ActiveSkill } from '@/hooks/useActiveSkills';

type Skill = ActiveSkill;

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  sound: 'Sonido',
  'sound-specialty': 'Sonido · especialidad',
  lights: 'Iluminación',
  'lights-specialty': 'Iluminación · especialidad',
  video: 'Vídeo',
  'video-specialty': 'Vídeo · especialidad',
  production: 'Producción',
  'production-specialty': 'Producción · especialidad',
  logistics: 'Logística',
};

export const skillCategoryLabel = (category: string): string => CATEGORY_LABELS[category] ?? category;

export const normalizeSkillKey = (value: string | null | undefined) => (value || '').trim().toLowerCase();

/**
 * Every active skill, grouped by category, straight from the catalog so a new
 * skill shows up without a code change. The selected department's categories
 * (`sound` also covers `sound-specialty`) come first, then `general`, then the
 * rest (rigging is a production skill, but lights crews have it too). Names
 * match case-insensitively, so a name is listed once.
 */
export function groupSkillsForDepartment(skills: Skill[], department?: string | null): Array<[string, Skill[]]> {
  const dept = normalizeSkillKey(department);
  const rank = (category: string) => {
    if (dept && (category === dept || category.startsWith(`${dept}-`))) return 0;
    if (category === 'general') return 1;
    return 2;
  };

  const seen = new Set<string>();
  const groups = new Map<string, Skill[]>();
  for (const skill of skills) {
    const key = normalizeSkillKey(skill.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const category = normalizeSkillKey(skill.category) || 'general';
    const list = groups.get(category);
    if (list) list.push(skill); else groups.set(category, [skill]);
  }

  return Array.from(groups.entries())
    .map(([category, list]): [string, Skill[]] => [
      category,
      [...list].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    ])
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
}
