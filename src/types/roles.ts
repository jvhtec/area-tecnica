// New role model: discipline-position-level codes with labels

export type Discipline = 'sound' | 'lights' | 'video'
export type Level = 'R' | 'E' | 'T'

export interface RoleOption {
  code: string; // e.g., SND-FOH-R
  label: string; // e.g., Sound FOH — Responsable
  discipline: Discipline;
  position: string; // e.g., FOH, MON, RF, PA, BRD, DIM, SW, CAM, etc.
  level: Level; // R/E/T
}

// Registry of supported role codes by discipline
const ROLE_REGISTRY: Record<Discipline, RoleOption[]> = {
  sound: [
    { code: 'SND-FOH-R', label: 'FOH — Responsable', discipline: 'sound', position: 'FOH', level: 'R' },
    { code: 'SND-MON-R', label: 'Monitores — Responsable', discipline: 'sound', position: 'MON', level: 'R' },
    { code: 'SND-SYS-R', label: 'Sistemas — Responsable', discipline: 'sound', position: 'SYS', level: 'R' },

    { code: 'SND-FOH-E', label: 'FOH — Especialista', discipline: 'sound', position: 'FOH', level: 'E' },
    { code: 'SND-MON-E', label: 'Monitores — Especialista', discipline: 'sound', position: 'MON', level: 'E' },
    { code: 'SND-RF-E',  label: 'RF — Especialista', discipline: 'sound', position: 'RF', level: 'E' },
    { code: 'SND-SYS-E', label: 'Sistemas — Especialista', discipline: 'sound', position: 'SYS', level: 'E' },

    { code: 'SND-PA-T',  label: 'PA — Técnico', discipline: 'sound', position: 'PA', level: 'T' },
  ],
  lights: [
    { code: 'LGT-BRD-R', label: 'Mesa — Responsable', discipline: 'lights', position: 'BRD', level: 'R' },
    { code: 'LGT-SYS-R', label: 'Sistema/Rig — Responsable', discipline: 'lights', position: 'SYS', level: 'R' },

    { code: 'LGT-BRD-E', label: 'Mesa — Especialista', discipline: 'lights', position: 'BRD', level: 'E' },
    { code: 'LGT-SYS-E', label: 'Sistema/Rig — Especialista', discipline: 'lights', position: 'SYS', level: 'E' },
    { code: 'LGT-FOLO-E', label: 'Follow Spot — Especialista', discipline: 'lights', position: 'FOLO', level: 'E' },

    { code: 'LGT-PA-T', label: 'PA — Técnico', discipline: 'lights', position: 'PA', level: 'T' },
  ],
  video: [
    { code: 'VID-SW-R', label: 'Switcher/TD — Responsable', discipline: 'video', position: 'SW', level: 'R' },

    { code: 'VID-DIR-E', label: 'Director — Especialista', discipline: 'video', position: 'DIR', level: 'E' },
    { code: 'VID-CAM-E', label: 'Cámara — Especialista', discipline: 'video', position: 'CAM', level: 'E' },
    { code: 'VID-LED-E', label: 'LED — Especialista', discipline: 'video', position: 'LED', level: 'E' },
    { code: 'VID-PROJ-E', label: 'Proyección — Especialista', discipline: 'video', position: 'PROJ', level: 'E' },

    { code: 'VID-PA-T', label: 'PA — Técnico', discipline: 'video', position: 'PA', level: 'T' },
  ],
}

// Flattened lookup maps
const CODE_TO_LABEL = new Map<string, string>(
  Object.values(ROLE_REGISTRY).flat().map(r => [r.code, r.label] as const)
)

export function roleOptionsForDiscipline(discipline: string): RoleOption[] {
  const key = (discipline || '').toLowerCase() as Discipline
  return ROLE_REGISTRY[key] ?? []
}

export function labelForCode(value: string | null | undefined): string {
  if (!value) return ''
  // If it matches a known code, return the label; otherwise return the original string
  return CODE_TO_LABEL.get(value) ?? value
}

export function isRoleCode(value: string | null | undefined): boolean {
  if (!value) return false
  return CODE_TO_LABEL.has(value)
}

// Best-effort mapping from human label to code, optionally constrained by discipline
export function codeForLabel(label: string, discipline?: string): string | null {
  const normalized = (label || '').trim().toLowerCase()
  if (!normalized) return null

  const searchPool = discipline ? roleOptionsForDiscipline(discipline) : Object.values(ROLE_REGISTRY).flat()

  // Exact match first
  const exact = searchPool.find(r => r.label.toLowerCase() === normalized)
  if (exact) return exact.code

  // Fuzzy match on common legacy labels
  const aliases: Array<[RegExp, string]> = [
    [/^foh(\s+engineer)?$/i, 'SND-FOH-R'],
    [/^monitor(\s+engineer)?$/i, 'SND-MON-E'],
    [/^rf(\s+tech(nician)?)?$/i, 'SND-RF-E'],
    [/^pa(\s+tech(nician)?)?$/i, 'SND-PA-T'],

    [/^lighting\s+designer$/i, 'LGT-BRD-R'],
    [/^lighting\s+technician$/i, 'LGT-PA-T'],
    [/^follow\s*spot/i, 'LGT-FOLO-E'],
    [/^rigger$/i, 'LGT-SYS-E'],

    [/^video\s+director$/i, 'VID-DIR-E'],
    [/^video\s+technician$/i, 'VID-PA-T'],
    [/^camera(\s+operator)?$/i, 'VID-CAM-E'],
    [/^playback(\s+technician)?$/i, 'VID-SW-R'],
  ]

  for (const [re, code] of aliases) {
    if (re.test(label)) return code
  }
  return null
}

// Legacy-compatible export to avoid breaking imports while migrating
// Note: returns a list of labels for UI display if needed by older components
export function getDepartmentRoles(department: string): string[] {
  return roleOptionsForDiscipline(department).map(r => r.label)
}

