type AssignmentDepartmentSource = {
  sound_role?: unknown;
  lights_role?: unknown;
  video_role?: unknown;
  production_role?: unknown;
  department?: unknown;
  job?: { department?: unknown } | null;
  jobs?: { department?: unknown } | null;
} | null | undefined;

const KNOWN_ASSIGNMENT_DEPARTMENTS = new Set([
  'sound',
  'lights',
  'video',
  'production',
  'logistics',
  'personnel',
  'comercial',
  'administrative',
]);

const normalizeDepartment = (department: unknown): string | null => {
  if (typeof department !== 'string') return null;
  const normalized = department.trim().toLowerCase();
  return KNOWN_ASSIGNMENT_DEPARTMENTS.has(normalized) ? normalized : null;
};

const hasActiveRole = (role: unknown): boolean => {
  if (typeof role !== 'string') return false;
  const normalized = role.trim().toLowerCase();
  return normalized.length > 0 && normalized !== 'none';
};

export const getAssignmentNotificationDepartments = (
  assignment: AssignmentDepartmentSource,
  fallbackDepartment?: unknown,
): string[] => {
  const departments = new Set<string>();

  if (hasActiveRole(assignment?.sound_role)) departments.add('sound');
  if (hasActiveRole(assignment?.lights_role)) departments.add('lights');
  if (hasActiveRole(assignment?.video_role)) departments.add('video');
  if (hasActiveRole(assignment?.production_role)) departments.add('production');

  const explicitDepartment = normalizeDepartment(assignment?.department)
    ?? normalizeDepartment(assignment?.job?.department)
    ?? normalizeDepartment(assignment?.jobs?.department);
  if (explicitDepartment) departments.add(explicitDepartment);

  if (departments.size === 0) {
    const fallback = normalizeDepartment(fallbackDepartment);
    if (fallback) departments.add(fallback);
  }

  return Array.from(departments);
};
