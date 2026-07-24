import {
  PROFILE_OPTIONS,
  type JobProfileName,
  type RatePenaltyStrength,
  type SoftConflictPolicy,
  type StaffingChannel,
  type WaveMode,
} from '@/features/staffing/crewingProfiles';
import type { Json } from '@/integrations/supabase/types';

interface StoredRoleProfile {
  selected_profile?: JobProfileName
  inferred_profile?: JobProfileName
}

interface StoredCostScoringPolicy {
  enabled?: boolean
  penalty_strength?: RatePenaltyStrength
  max_rate_penalty?: number
}

export interface StoredCampaignPolicy {
  profile?: {
    selected_job_profile?: JobProfileName
    infer_from_job_type?: boolean
    override_reason?: string | null
  }
  role_profiles?: Record<string, StoredRoleProfile>
  weights?: { proximity?: number; reliability?: number }
  soft_conflict_policy?: SoftConflictPolicy
  exclude_fridge?: boolean
  availability_ttl_hours?: number
  offer_ttl_hours?: number
  tick_interval_seconds?: number
  channel?: StaffingChannel
  cost_scoring?: StoredCostScoringPolicy
  waves?: {
    mode?: WaveMode
    buffer?: number
    wait_minutes?: number
    max_waves?: number
    auto_send_next_wave?: boolean
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const isJobProfileName = (value: unknown): value is JobProfileName =>
  typeof value === 'string' && PROFILE_OPTIONS.some((profile) => profile === value)

const isRatePenaltyStrength = (value: unknown): value is RatePenaltyStrength =>
  value === 'disabled' || value === 'low' || value === 'normal' || value === 'high'

const isSoftConflictPolicy = (value: unknown): value is SoftConflictPolicy =>
  value === 'block'
  || value === 'warn'
  || value === 'manager_approval'
  || value === 'ignore'
  || value === 'allow'

const isWaveMode = (value: unknown): value is WaveMode =>
  value === 'manual_selection'
  || value === 'controlled_waves'
  || value === 'blast_all_eligible'

export const normalizeStoredCampaignPolicy = (value: Json): StoredCampaignPolicy => {
  if (!isRecord(value)) return {}
  const profile = isRecord(value.profile) ? value.profile : {}
  const weights = isRecord(value.weights) ? value.weights : {}
  const costScoring = isRecord(value.cost_scoring) ? value.cost_scoring : {}
  const waves = isRecord(value.waves) ? value.waves : {}
  const rawRoleProfiles = isRecord(value.role_profiles) ? value.role_profiles : {}
  const roleProfiles = Object.fromEntries(
    Object.entries(rawRoleProfiles).flatMap(([roleCode, rawProfile]) => {
      if (!isRecord(rawProfile)) return []
      const selected = isJobProfileName(rawProfile.selected_profile)
        ? rawProfile.selected_profile
        : undefined
      const inferred = isJobProfileName(rawProfile.inferred_profile)
        ? rawProfile.inferred_profile
        : undefined
      return [[roleCode, { selected_profile: selected, inferred_profile: inferred }]]
    }),
  )
  const selectedProfile = isJobProfileName(profile.selected_job_profile)
    ? profile.selected_job_profile
    : undefined
  const rawPenaltyStrength = costScoring.penalty_strength ?? costScoring.penaltyStrength
  const rawMaxRatePenalty = costScoring.max_rate_penalty ?? costScoring.maxRatePenalty

  return {
    profile: {
      selected_job_profile: selectedProfile,
      infer_from_job_type: typeof profile.infer_from_job_type === 'boolean' ? profile.infer_from_job_type : undefined,
      override_reason: typeof profile.override_reason === 'string' ? profile.override_reason : null,
    },
    role_profiles: roleProfiles,
    weights: {
      proximity: typeof weights.proximity === 'number' ? weights.proximity : undefined,
      reliability: typeof weights.reliability === 'number' ? weights.reliability : undefined,
    },
    soft_conflict_policy: isSoftConflictPolicy(value.soft_conflict_policy)
      ? value.soft_conflict_policy
      : undefined,
    exclude_fridge: typeof value.exclude_fridge === 'boolean' ? value.exclude_fridge : undefined,
    availability_ttl_hours: typeof value.availability_ttl_hours === 'number' ? value.availability_ttl_hours : undefined,
    offer_ttl_hours: typeof value.offer_ttl_hours === 'number' ? value.offer_ttl_hours : undefined,
    tick_interval_seconds: typeof value.tick_interval_seconds === 'number' ? value.tick_interval_seconds : undefined,
    channel: value.channel === 'whatsapp' ? 'whatsapp' : value.channel === 'email' ? 'email' : undefined,
    cost_scoring: {
      enabled: typeof costScoring.enabled === 'boolean' ? costScoring.enabled : undefined,
      penalty_strength: isRatePenaltyStrength(rawPenaltyStrength) ? rawPenaltyStrength : undefined,
      max_rate_penalty: typeof rawMaxRatePenalty === 'number' ? rawMaxRatePenalty : undefined,
    },
    waves: {
      mode: isWaveMode(waves.mode) ? waves.mode : undefined,
      buffer: typeof waves.buffer === 'number' ? waves.buffer : undefined,
      wait_minutes: typeof waves.wait_minutes === 'number' ? waves.wait_minutes : undefined,
      max_waves: typeof waves.max_waves === 'number' ? waves.max_waves : undefined,
      auto_send_next_wave: typeof waves.auto_send_next_wave === 'boolean' ? waves.auto_send_next_wave : undefined,
    },
  }
}
