export type FlexDepartment = 'sound' | 'lights';

type AssignmentLike = {
  sound_role?: string | null;
  lights_role?: string | null;
  job?: { department?: string | null } | null;
  jobs?: { department?: string | null } | null;
  department?: string | null;
} | null | undefined;

const isFlexDepartment = (department: string | null | undefined): department is FlexDepartment => {
  return department === 'sound' || department === 'lights';
};

export const determineFlexDepartmentsForAssignment = (
  assignment: AssignmentLike,
  fallbackDepartment?: string | null | undefined
): FlexDepartment[] => {
  const departments = new Set<FlexDepartment>();

  if (assignment?.sound_role && assignment.sound_role !== 'none') {
    departments.add('sound');
  }

  if (assignment?.lights_role && assignment.lights_role !== 'none') {
    departments.add('lights');
  }

  if (assignment?.department) {
    if (isFlexDepartment(assignment.department)) {
      departments.add(assignment.department);
    }
  }

  const jobDepartment = assignment?.job?.department ?? assignment?.jobs?.department;
  if (isFlexDepartment(jobDepartment)) {
    departments.add(jobDepartment);
  }

  if (departments.size === 0 && isFlexDepartment(fallbackDepartment)) {
    departments.add(fallbackDepartment);
  }

  return Array.from(departments);
};
