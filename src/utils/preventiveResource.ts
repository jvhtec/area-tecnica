export const PREVENTIVE_RESOURCE_EXTRA_EUR = 10;
export const PREVENTIVE_RESOURCE_EXTRA_TYPE = 'recurso_preventivo';

interface JobLike {
  preventive_resource_technician_id?: string | null;
}

interface AssignmentLike {
  technician_id?: string | null;
  status?: string | null;
  profiles?: {
    first_name?: string | null;
    last_name?: string | null;
    department?: string | null;
    role?: string | null;
  } | null;
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

export function getTechnicianDisplayName(profile?: AssignmentLike['profiles']): string {
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
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
      department: assignment.profiles?.department ?? null,
      role: assignment.profiles?.role ?? null,
    });
  });

  return Array.from(optionsById.values()).sort((left, right) => left.name.localeCompare(right.name, 'es'));
}
