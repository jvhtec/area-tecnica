export const PREVENTIVE_RESOURCE_EXTRA_EUR = 10;
export const PREVENTIVE_RESOURCE_EXTRA_TYPE = 'recurso_preventivo';

interface JobLike {
  preventive_resource_technician_id?: string | null;
}

interface AssignmentLike {
  technician_id?: string | null;
  status?: string | null;
  // PostgREST may return the embedded relation as an object or an array.
  profiles?: {
    first_name?: string | null;
    last_name?: string | null;
    department?: string | null;
    role?: string | null;
    [key: string]: unknown;
  } | Array<{
    first_name?: string | null;
    last_name?: string | null;
    department?: string | null;
    role?: string | null;
    [key: string]: unknown;
  }> | null;
}

export interface PreventiveResourceOption {
  id: string;
  name: string;
  department: string | null;
  role: string | null;
}

export function isPreventiveResourceForJob(job: JobLike | null | undefined, technicianId?: string | null): boolean {
  return Boolean(job?.preventive_resource_technician_id && technicianId && job.preventive_resource_technician_id === technicianId);
}

type AssignmentProfile = NonNullable<Exclude<AssignmentLike['profiles'], unknown[]>>;

/** Takes the single embedded profile, unwrapping PostgREST's array form. */
function singleProfile(profile: AssignmentLike['profiles']): AssignmentProfile | null {
  if (Array.isArray(profile)) return profile[0] ?? null;
  return profile ?? null;
}

export function getTechnicianDisplayName(profile?: AssignmentLike['profiles']): string {
  const single = singleProfile(profile);
  const name = [single?.first_name, single?.last_name].filter(Boolean).join(' ').trim();
  return name || 'Técnico sin nombre';
}

export function getPreventiveResourceOptions(assignments: AssignmentLike[] = []): PreventiveResourceOption[] {
  const optionsById = new Map<string, PreventiveResourceOption>();

  assignments.forEach((assignment) => {
    const technicianId = assignment.technician_id;
    if (!technicianId || assignment.status !== 'confirmed' || optionsById.has(technicianId)) {
      return;
    }

    optionsById.set(technicianId, {
      id: technicianId,
      name: getTechnicianDisplayName(assignment.profiles),
      department: singleProfile(assignment.profiles)?.department ?? null,
      role: singleProfile(assignment.profiles)?.role ?? null,
    });
  });

  return Array.from(optionsById.values()).sort((left, right) => left.name.localeCompare(right.name, 'es'));
}
