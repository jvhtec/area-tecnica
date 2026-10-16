import { getErrorMessage } from '@/utils/errorMessage';

/** A skill as the catalog lists it. */
export type CatalogSkill = { id: string; name: string; category: string | null };

type Skill = CatalogSkill;

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
export function groupSkillsForDepartment<T extends Skill>(skills: T[], department?: string | null): Array<[string, T[]]> {
  const dept = normalizeSkillKey(department);
  const rank = (category: string) => {
    if (dept && (category === dept || category.startsWith(`${dept}-`))) return 0;
    if (category === 'general') return 1;
    return 2;
  };

  const seen = new Set<string>();
  const groups = new Map<string, T[]>();
  for (const skill of skills) {
    const key = normalizeSkillKey(skill.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const category = normalizeSkillKey(skill.category) || 'general';
    const list = groups.get(category);
    if (list) list.push(skill); else groups.set(category, [skill]);
  }

  return Array.from(groups.entries())
    .map(([category, list]): [string, T[]] => [
      category,
      [...list].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    ])
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
}

const errorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object' || !('code' in error)) return undefined;
  const { code } = error as { code?: unknown };
  return typeof code === 'string' ? code : undefined;
};

/** A readable reason for a rejected skill insert or update. */
export function describeSkillWriteError(error: unknown, fallback: string): string {
  const code = errorCode(error);
  if (code === '23505') return 'Ya existe una habilidad con ese nombre.';
  if (code === '42501' || /row-level security/i.test(getErrorMessage(error, ''))) {
    return 'No puedes gestionar habilidades en esa categoría.';
  }
  return getErrorMessage(error, fallback);
}
