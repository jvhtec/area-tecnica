export const RACK_BUILDER_DEPARTMENTS = ['sound', 'lights'] as const

export type RackBuilderDepartment = (typeof RACK_BUILDER_DEPARTMENTS)[number]

export const normalizeRackBuilderDepartment = (
  value: string | null | undefined,
): RackBuilderDepartment | null => {
  const normalized = value?.trim().toLowerCase()
  return normalized === 'sound' || normalized === 'lights' ? normalized : null
}

export const getRackBuilderProjectsPath = (department: string | null | undefined) => {
  const normalized = normalizeRackBuilderDepartment(department)
  return normalized ? `/rack-builder/projects?department=${normalized}` : '/rack-builder/projects'
}

export const formatRackBuilderDepartment = (department: RackBuilderDepartment) =>
  department === 'lights' ? 'Lights' : 'Sound'
