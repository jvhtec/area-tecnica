import { RACK_BUILDER_DEPARTMENTS, type RackBuilderDepartment } from '../types'

export const normalizeRackBuilderDepartment = (
  value: string | null | undefined,
): RackBuilderDepartment | null => {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return null
  return RACK_BUILDER_DEPARTMENTS.includes(normalized as RackBuilderDepartment)
    ? normalized as RackBuilderDepartment
    : null
}

export const getRackBuilderProjectsPath = (department: string | null | undefined) => {
  const normalized = normalizeRackBuilderDepartment(department)
  return normalized ? `/rack-builder/projects?department=${normalized}` : '/rack-builder/projects'
}

export const formatRackBuilderDepartment = (department: RackBuilderDepartment) =>
  department === 'lights' ? 'Luces' : 'Sonido'
