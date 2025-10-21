export type Dept = 'sound' | 'lights' | 'video'
export type Tier = 'responsable' | 'especialista' | 'tecnico'

// Resource IDs provided/confirmed by management
const SOUND_RESOURCES: Record<Tier, string> = {
  responsable: '2915a190-c515-11ea-a087-2a0a4490a7fb', // Responsable de Sonido
  especialista: 'f1224528-9038-486b-b1b8-a8085cb24651', // Tecnico Especialista
  tecnico: '2f6bdee0-c5c1-11ea-a087-2a0a4490a7fb', // Técnico de Sonido
}

const LIGHTS_RESOURCES: Partial<Record<Tier, string>> = {
  responsable: 'ec63fd59-d71f-4118-b016-0873451cb6e2', // Responsable de Iluminacion
  // No explicit especialista provided; fallback to tecnico
  tecnico: '8505f640-caa0-11ea-a087-2a0a4490a7fb', // Tecnico de Iluminacion
}

// Extras resources
export const EXTRA_RESOURCE_IDS = {
  transit: 'd75261e0-caa0-11ea-a087-2a0a4490a7fb', // Transito
  dayOff: 'cf6c13d0-caa6-11ea-a087-2a0a4490a7fb', // Dia off
}

export function inferTierFromRoleCode(role: string | null | undefined): Tier | null {
  if (!role) return null
  return role.includes('-R') ? 'responsable'
    : role.includes('-E') ? 'especialista'
    : role.includes('-T') ? 'tecnico'
    : null
}

export function resourceIdForRole(dept: Dept, roleCode: string | null | undefined): string | null {
  const tier = inferTierFromRoleCode(roleCode)
  if (!tier) return null
  switch (dept) {
    case 'sound':
      return SOUND_RESOURCES[tier] || null
    case 'lights': {
      if (tier === 'responsable') return LIGHTS_RESOURCES.responsable || null
      // For especialista/tecnico, map to lights tecnico if provided
      return LIGHTS_RESOURCES.tecnico || null
    }
    case 'video':
      // Skipped per requirement
      return null
    default:
      return null
  }
}

