export type AssignmentDepartment = "sound" | "lights" | "video" | "production";

export type AssignmentRoleField =
  | "sound_role"
  | "lights_role"
  | "video_role"
  | "production_role";

export type AssignmentRoleInput = Partial<Record<AssignmentDepartment, string | null | undefined>> & {
  soundRole?: string | null;
  lightsRole?: string | null;
  videoRole?: string | null;
  productionRole?: string | null;
};

export const ROLE_FIELD_BY_DEPARTMENT: Record<AssignmentDepartment, AssignmentRoleField> = {
  sound: "sound_role",
  lights: "lights_role",
  video: "video_role",
  production: "production_role",
};

export const ASSIGNMENT_DEPARTMENTS: AssignmentDepartment[] = [
  "sound",
  "lights",
  "video",
  "production",
];

export const isAssignmentDepartment = (
  department: string | null | undefined,
): department is AssignmentDepartment => (
  !!department && ASSIGNMENT_DEPARTMENTS.includes(department.toLowerCase() as AssignmentDepartment)
);

export const normalizeAssignmentRole = (role: string | null | undefined) => {
  const normalized = typeof role === "string" ? role.trim() : role;
  return normalized && normalized !== "none" ? normalized : null;
};

export const getAssignmentRoleForDepartment = (
  assignment: Record<string, any> | null | undefined,
  department: string | null | undefined,
): string | null => {
  const normalizedDepartment = department?.toLowerCase?.();
  if (!isAssignmentDepartment(normalizedDepartment)) return null;
  return normalizeAssignmentRole(assignment?.[ROLE_FIELD_BY_DEPARTMENT[normalizedDepartment]]);
};

export const hasAssignmentRoleForDepartment = (
  assignment: Record<string, any> | null | undefined,
  department: string | null | undefined,
) => Boolean(getAssignmentRoleForDepartment(assignment, department));

export const getFirstAssignmentRole = (
  assignment: Record<string, any> | null | undefined,
): string | null => {
  for (const department of ASSIGNMENT_DEPARTMENTS) {
    const role = getAssignmentRoleForDepartment(assignment, department);
    if (role) return role;
  }
  return null;
};

export const normalizeAssignmentRoleInput = (input: AssignmentRoleInput = {}) => ({
  sound_role: normalizeAssignmentRole(input.sound ?? input.soundRole),
  lights_role: normalizeAssignmentRole(input.lights ?? input.lightsRole),
  video_role: normalizeAssignmentRole(input.video ?? input.videoRole),
  production_role: normalizeAssignmentRole(input.production ?? input.productionRole),
});

export const buildAssignmentRoleInputForDepartment = (
  department: string,
  role: string | null | undefined,
): AssignmentRoleInput => {
  const normalizedDepartment = department.toLowerCase();
  if (!isAssignmentDepartment(normalizedDepartment)) return {};
  return { [normalizedDepartment]: role };
};
