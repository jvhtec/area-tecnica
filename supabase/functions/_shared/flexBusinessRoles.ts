// Shared helpers for mapping our internal role codes/tiers
// to Flex "business-role" dictionary IDs per department.

export type Dept = 'sound' | 'lights' | 'video'
export type Tier = 'responsable' | 'especialista' | 'tecnico'
export type BusinessRoleLookup =
  | {
      supported: true
      dept: Dept
      tier: Tier
      roleId: string
      diagnostic?: undefined
    }
  | {
      supported: false
      dept: Dept
      tier: Tier | null
      roleId: null
      diagnostic: string
    }

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
  const lookup = businessRoleLookupFor(dept, tier)
  return lookup.supported ? lookup.roleId : null
}

export function businessRoleLookupFor(dept: Dept, tier: Tier | null): BusinessRoleLookup {
  if (!tier) {
    return {
      supported: false,
      dept,
      tier,
      roleId: null,
      diagnostic: `No Flex business-role tier could be inferred for ${dept}. Expected a role code suffix of -R, -E, or -T.`
    }
  }

  let roleId: string | undefined
  switch (dept) {
    case 'sound':
      roleId = SOUND_BUSINESS_ROLE_IDS[tier]
      break
    case 'lights':
      roleId = LIGHTS_BUSINESS_ROLE_IDS[tier]
      break
    case 'video':
      roleId = VIDEO_BUSINESS_ROLE_IDS[tier]
      break
    default:
      roleId = undefined
  }

  if (roleId) {
    return {
      supported: true,
      dept,
      tier,
      roleId
    }
  }

  return {
    supported: false,
    dept,
    tier,
    roleId: null,
    diagnostic: `${dept} Flex business-role ID for tier "${tier}" is not configured. Confirm the Flex dictionary ID before business-role sync can set this field.`
  }
}
