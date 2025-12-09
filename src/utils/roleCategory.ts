/**
 * Type representing technician categories
 */
export type TechnicianCategory = 'responsable' | 'especialista' | 'tecnico' | null;

/**
 * Determines the technician category from a role code
 * @param roleCode - Role code like 'SND-FOH-R', 'LGT-BRD-E', 'VID-PA-T'
 * @returns 'responsable' | 'especialista' | 'tecnico' | null
 */
export function getCategoryFromRole(roleCode: string | null | undefined): TechnicianCategory {
  if (!roleCode) return null;
  
  const normalized = roleCode.trim().toUpperCase();
  
  // Check if it's a valid role code format (XXX-XXX-X)
  if (!normalized.match(/^[A-Z]{3}-[A-Z]+-[RET]$/)) {
    return null;
  }
  
  // Extract the level (last character after final dash)
  const level = normalized.slice(-1);
  
  switch (level) {
    case 'R':
      return 'responsable';
    case 'E':
      return 'especialista';
    case 'T':
      return 'tecnico';
    default:
      return null;
  }
}

/**
 * Gets the category from any of the three role fields
 * Returns the highest category found (responsable > especialista > tecnico)
 */
export function getCategoryFromAssignment(assignment: {
  sound_role?: string | null;
  lights_role?: string | null;
  video_role?: string | null;
}): TechnicianCategory {
  const roles = [assignment.sound_role, assignment.lights_role, assignment.video_role];
  const categories = roles.map(role => getCategoryFromRole(role)).filter(cat => cat !== null);

  if (categories.length === 0) return null;

  // Return highest category: responsable > especialista > tecnico
  if (categories.includes('responsable')) return 'responsable';
  if (categories.includes('especialista')) return 'especialista';
  if (categories.includes('tecnico')) return 'tecnico';

  return null;
}
