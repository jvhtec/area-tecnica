const PRIVILEGED_ROLES = new Set(['admin', 'management']);

export function canUseLaSessionTools(
  role: string,
  department: string | null | undefined,
  hasExplicitToolAccess: boolean,
): boolean {
  const normalizedRole = role.trim().toLowerCase();
  if (PRIVILEGED_ROLES.has(normalizedRole)) return true;

  const isSoundDepartment = department?.trim().toLowerCase() === 'sound';
  if (!isSoundDepartment) return false;
  if (normalizedRole === 'house_tech') return true;
  return normalizedRole === 'technician' && hasExplicitToolAccess;
}
