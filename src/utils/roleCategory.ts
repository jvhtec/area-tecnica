/**
 * Determines the technician category from a role code
 * @param roleCode - Role code like 'SND-FOH-R', 'LGT-BRD-E', 'VID-PA-T'
 * @returns 'responsable' | 'especialista' | 'tecnico' | null
 */
export function getCategoryFromRole(roleCode: string | null | undefined): 'responsable' | 'especialista' | 'tecnico' | null {
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
 * Prioritizes in order: sound_role, lights_role, video_role
 */
export function getCategoryFromAssignment(assignment: {
  sound_role?: string | null;
  lights_role?: string | null;
  video_role?: string | null;
}): 'responsable' | 'especialista' | 'tecnico' | null {
  const role = assignment.sound_role || assignment.lights_role || assignment.video_role;
  return getCategoryFromRole(role);
}
