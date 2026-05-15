// Shared helpers for mapping our internal role codes/tiers
// to Flex "business-role" dictionary IDs per department.

export type Dept = 'sound' | 'lights' | 'video'
export type Tier = 'responsable' | 'especialista' | 'tecnico'

// Known Flex dictionary IDs for SOUND business-role tiers
const SOUND_BUSINESS_ROLE_IDS: Record<Tier, string> = {
  responsable: '2916b300-c515-11ea-a087-2a0a4490a7fb',
  especialista: 'b18a5bcc-59fa-4956-917f-0d1816d7d9b3',
  tecnico: '2f6cf050-c5c1-11ea-a087-2a0a4490a7fb',
}

// Roadmap P0-04 tracks confirmed LIGHTS/VIDEO Flex dictionary IDs.
const LIGHTS_BUSINESS_ROLE_IDS: Partial<Record<Tier, string>> = {
  // Lights tiers are unsupported until their Flex dictionary IDs are confirmed.
}
const VIDEO_BUSINESS_ROLE_IDS: Partial<Record<Tier, string>> = {
  // Video tiers are unsupported until their Flex dictionary IDs are confirmed.
}

export function inferTierFromRoleCode(role: string | null | undefined): Tier | null {
  if (!role) return null
  return role.includes('-R') ? 'responsable'
    : role.includes('-E') ? 'especialista'
    : role.includes('-T') ? 'tecnico'
    : null
}

export function businessRoleIdFor(dept: Dept, tier: Tier | null): string | null {
  if (!tier) return null
  switch (dept) {
    case 'sound':
      return SOUND_BUSINESS_ROLE_IDS[tier] || null
    case 'lights':
      return LIGHTS_BUSINESS_ROLE_IDS[tier] || null
    case 'video':
      return VIDEO_BUSINESS_ROLE_IDS[tier] || null
    default:
      return null
  }
}
