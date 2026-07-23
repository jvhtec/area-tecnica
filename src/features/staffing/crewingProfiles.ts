export type StaffingJobType = 'single' | 'evento' | 'festival' | 'ciclo' | 'tourdate';

export type JobProfileName =
  | 'standard'
  | 'high_risk_critical'
  | 'training_friendly'
  | 'emergency_fill'
  | 'local_low_complexity'
  | 'multi_day_tour'
  | 'custom';

export type WaveMode = 'manual_selection' | 'controlled_waves' | 'blast_all_eligible';
export type RatePenaltyStrength = 'disabled' | 'low' | 'normal' | 'high';
export type StaffingChannel = 'email' | 'whatsapp';
export type SoftConflictPolicy = 'block' | 'warn' | 'manager_approval' | 'ignore' | 'allow';

export type ScoringWeights = {
  roleSkill: number;
  reliability: number;
  fairness: number;
  proximity: number;
  costEfficiency: number;
  houseTechBonus: number;
  roleProgression: number;
  availabilityConfidence: number;
};

export type ProfileDefaults = {
  label: string;
  description: string;
  weights: ScoringWeights;
  availabilityTtlHours: number;
  offerTtlHours: number;
  waveWaitMinutes: number;
  waveBuffer: number;
  maxWaves: number;
  minimumAutoBookScore: number;
  defaultSoftConflictPolicy: SoftConflictPolicy;
};

export type RoleProfilePolicy = {
  role_code: string;
  inferred_profile: JobProfileName;
  selected_profile: JobProfileName;
  manual_override: boolean;
  required_count: number;
  assigned_count: number;
  is_critical: boolean;
};

export type BuildCampaignPolicyInput = {
  mode: 'assisted' | 'auto';
  jobType?: string | null;
  jobStartTime?: string | null;
  jobEndTime?: string | null;
  requiredCrewCount?: number;
  selectedJobProfile: JobProfileName;
  inferredJobProfile?: JobProfileName;
  inferProfileFromJobType: boolean;
  profileOverrideReason?: string;
  roleProfiles: Record<string, RoleProfilePolicy>;
  roleProfileOverrides?: Record<string, JobProfileName>;
  availabilityTtlHours: number;
  offerTtlHours: number;
  softConflictPolicy: SoftConflictPolicy;
  excludeFridge: boolean;
  sendChannel: StaffingChannel;
  costScoring: {
    enabled: boolean;
    penaltyStrength: RatePenaltyStrength;
    maxRatePenalty: number;
  };
  waves: {
    mode: WaveMode;
    buffer: number;
    waitMinutes: number;
    maxWaves: number;
    autoSendNextWave: boolean;
  };
  tickIntervalSeconds: number;
  weightOverrides?: Partial<ScoringWeights>;
  surroundingJobs?: {
    enabled?: boolean;
    maxLocationDistanceKm?: number;
  };
};

export const JOB_PROFILE_LABELS: Record<JobProfileName, string> = {
  standard: 'Estándar',
  high_risk_critical: 'Alto riesgo / Crítico',
  training_friendly: 'Apto para formación',
  emergency_fill: 'Cobertura urgente',
  local_low_complexity: 'Local baja complejidad',
  multi_day_tour: 'Multi-día / Gira',
  custom: 'Personalizado',
};

export const PROFILE_DEFAULTS: Record<JobProfileName, ProfileDefaults> = {
  standard: {
    label: JOB_PROFILE_LABELS.standard,
    description: 'Selección equilibrada para trabajos puntuales.',
    weights: {
      roleSkill: 0.32,
      reliability: 0.23,
      fairness: 0.15,
      proximity: 0.1,
      costEfficiency: 0.08,
      houseTechBonus: 0.05,
      roleProgression: 0.04,
      availabilityConfidence: 0.03,
    },
    availabilityTtlHours: 24,
    offerTtlHours: 4,
    waveWaitMinutes: 20,
    waveBuffer: 2,
    maxWaves: 3,
    minimumAutoBookScore: 70,
    defaultSoftConflictPolicy: 'warn',
  },
  high_risk_critical: {
    label: JOB_PROFILE_LABELS.high_risk_critical,
    description: 'Prioriza personal probado para roles complejos o críticos.',
    weights: {
      roleSkill: 0.4,
      reliability: 0.35,
      fairness: 0.05,
      proximity: 0.05,
      costEfficiency: 0.03,
      houseTechBonus: 0.1,
      roleProgression: 0.02,
      availabilityConfidence: 0,
    },
    availabilityTtlHours: 24,
    offerTtlHours: 2,
    waveWaitMinutes: 15,
    waveBuffer: 1,
    maxWaves: 3,
    minimumAutoBookScore: 75,
    defaultSoftConflictPolicy: 'block',
  },
  training_friendly: {
    label: JOB_PROFILE_LABELS.training_friendly,
    description: 'Favorece rotación y progresión de rol en trabajos de bajo riesgo.',
    weights: {
      roleSkill: 0.23,
      reliability: 0.18,
      fairness: 0.25,
      proximity: 0.05,
      costEfficiency: 0.08,
      houseTechBonus: 0.03,
      roleProgression: 0.18,
      availabilityConfidence: 0,
    },
    availabilityTtlHours: 24,
    offerTtlHours: 4,
    waveWaitMinutes: 30,
    waveBuffer: 3,
    maxWaves: 3,
    minimumAutoBookScore: 65,
    defaultSoftConflictPolicy: 'warn',
  },
  emergency_fill: {
    label: JOB_PROFILE_LABELS.emergency_fill,
    description: 'Favorece respuestas rápidas, cercanas, disponibles y fiables.',
    weights: {
      roleSkill: 0.15,
      reliability: 0.3,
      fairness: 0,
      proximity: 0.2,
      costEfficiency: 0.02,
      houseTechBonus: 0.03,
      roleProgression: 0,
      availabilityConfidence: 0.3,
    },
    availabilityTtlHours: 4,
    offerTtlHours: 1,
    waveWaitMinutes: 5,
    waveBuffer: 4,
    maxWaves: 4,
    minimumAutoBookScore: 60,
    defaultSoftConflictPolicy: 'manager_approval',
  },
  local_low_complexity: {
    label: JOB_PROFILE_LABELS.local_low_complexity,
    description: 'Evita sobreusar personal premium en trabajo local sencillo.',
    weights: {
      roleSkill: 0.18,
      reliability: 0.18,
      fairness: 0.23,
      proximity: 0.23,
      costEfficiency: 0.12,
      houseTechBonus: 0.02,
      roleProgression: 0.04,
      availabilityConfidence: 0,
    },
    availabilityTtlHours: 24,
    offerTtlHours: 3,
    waveWaitMinutes: 20,
    waveBuffer: 2,
    maxWaves: 3,
    minimumAutoBookScore: 65,
    defaultSoftConflictPolicy: 'warn',
  },
  multi_day_tour: {
    label: JOB_PROFILE_LABELS.multi_day_tour,
    description: 'Prioriza continuidad y compromiso en fechas repetidas.',
    weights: {
      roleSkill: 0.28,
      reliability: 0.28,
      fairness: 0.04,
      proximity: 0.04,
      costEfficiency: 0.1,
      houseTechBonus: 0.08,
      roleProgression: 0,
      availabilityConfidence: 0.18,
    },
    availabilityTtlHours: 48,
    offerTtlHours: 4,
    waveWaitMinutes: 30,
    waveBuffer: 1,
    maxWaves: 3,
    minimumAutoBookScore: 72,
    defaultSoftConflictPolicy: 'block',
  },
  custom: {
    label: JOB_PROFILE_LABELS.custom,
    description: 'Ajustes personalizados por gestión.',
    weights: {
      roleSkill: 0.32,
      reliability: 0.23,
      fairness: 0.15,
      proximity: 0.1,
      costEfficiency: 0.08,
      houseTechBonus: 0.05,
      roleProgression: 0.04,
      availabilityConfidence: 0.03,
    },
    availabilityTtlHours: 24,
    offerTtlHours: 4,
    waveWaitMinutes: 20,
    waveBuffer: 2,
    maxWaves: 3,
    minimumAutoBookScore: 70,
    defaultSoftConflictPolicy: 'warn',
  },
};

export const PROFILE_OPTIONS = Object.keys(PROFILE_DEFAULTS) as JobProfileName[];

const CRITICAL_ROLE_PATTERNS = [
  /\bA1\b/i,
  /\bV1\b/i,
  /\bPM\b/i,
  /\bRF\b/i,
  /CREW[\s_-]*CHIEF/i,
  /SYSTEM/i,
  /LEAD/i,
  /^SND-PA(?:-|$)/i,
  /^LGT-MON(?:-|$)/i,
];

const TRAINING_ROLE_PATTERNS = [
  /ASSIST/i,
  /HELP/i,
  /RUNNER/i,
  /STAGEHAND/i,
  /AUX/i,
];

export function normalizeStaffingJobType(jobType?: string | null): StaffingJobType {
  const normalized = String(jobType || 'single').toLowerCase();
  if (normalized === 'festival') return 'festival';
  if (normalized === 'ciclo') return 'ciclo';
  if (normalized === 'tourdate') return 'tourdate';
  if (normalized === 'evento') return 'evento';
  return 'single';
}

export function hoursUntil(startTime?: string | null, now = new Date()): number | null {
  if (!startTime) return null;
  const startsAt = new Date(startTime);
  if (Number.isNaN(startsAt.getTime())) return null;
  return (startsAt.getTime() - now.getTime()) / 36e5;
}

export function spansMultipleDates(startTime?: string | null, endTime?: string | null): boolean {
  if (!startTime || !endTime) return false;
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return start.toDateString() !== end.toDateString();
}

export function isCriticalRole(roleCode: string): boolean {
  return CRITICAL_ROLE_PATTERNS.some((pattern) => pattern.test(roleCode));
}

export function isTrainingFriendlyRole(roleCode: string): boolean {
  return TRAINING_ROLE_PATTERNS.some((pattern) => pattern.test(roleCode));
}

export function inferJobProfile(input: {
  jobType?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  requiredCrewCount?: number;
  manualUrgency?: boolean;
  now?: Date;
}): JobProfileName {
  const startsWithinHours = hoursUntil(input.startTime, input.now);
  const jobType = normalizeStaffingJobType(input.jobType);

  if (input.manualUrgency || (startsWithinHours !== null && startsWithinHours <= 6)) {
    return 'emergency_fill';
  }

  if (jobType === 'tourdate' || jobType === 'ciclo' || spansMultipleDates(input.startTime, input.endTime)) {
    return 'multi_day_tour';
  }

  if (jobType === 'festival' || Number(input.requiredCrewCount || 0) >= 10) {
    return 'high_risk_critical';
  }

  return 'standard';
}

export function inferRoleProfile(input: {
  jobProfile: JobProfileName;
  roleCode: string;
  requiredCount?: number;
  assignedCount?: number;
  startsWithinHours?: number | null;
}): JobProfileName {
  const required = Number(input.requiredCount || 0);
  const assigned = Number(input.assignedCount || 0);
  const unfilled = assigned < required;

  if (input.startsWithinHours !== null && input.startsWithinHours !== undefined) {
    if (input.startsWithinHours <= 6 || (input.startsWithinHours <= 24 && unfilled)) {
      return 'emergency_fill';
    }
  }

  if (input.jobProfile === 'multi_day_tour') return 'multi_day_tour';
  if (isCriticalRole(input.roleCode)) return 'high_risk_critical';
  if (isTrainingFriendlyRole(input.roleCode) && input.jobProfile !== 'emergency_fill') {
    return 'training_friendly';
  }
  return input.jobProfile;
}

export function toLegacyRankWeights(weights: ScoringWeights) {
  return {
    skills: weights.roleSkill,
    role_skill: weights.roleSkill,
    reliability: weights.reliability,
    fairness: weights.fairness,
    proximity: weights.proximity,
    experience: weights.roleProgression,
    cost_efficiency: weights.costEfficiency,
    house_tech_bonus: weights.houseTechBonus,
    role_progression: weights.roleProgression,
    availability_confidence: weights.availabilityConfidence,
  };
}

export function buildRoleProfiles(input: {
  roleCodes: string[];
  requiredByRole?: Record<string, number>;
  assignedByRole?: Record<string, number>;
  selectedJobProfile: JobProfileName;
  startTime?: string | null;
  overrides?: Record<string, JobProfileName>;
  now?: Date;
}): Record<string, RoleProfilePolicy> {
  const starts = hoursUntil(input.startTime, input.now);

  return input.roleCodes.reduce<Record<string, RoleProfilePolicy>>((acc, roleCode) => {
    const required = Number(input.requiredByRole?.[roleCode] || 0);
    const assigned = Number(input.assignedByRole?.[roleCode] || 0);
    const inferred = inferRoleProfile({
      jobProfile: input.selectedJobProfile,
      roleCode,
      requiredCount: required,
      assignedCount: assigned,
      startsWithinHours: starts,
    });
    const selected = input.overrides?.[roleCode] || inferred;

    acc[roleCode] = {
      role_code: roleCode,
      inferred_profile: inferred,
      selected_profile: selected,
      manual_override: selected !== inferred,
      required_count: required,
      assigned_count: assigned,
      is_critical: isCriticalRole(roleCode),
    };
    return acc;
  }, {});
}

export function buildCampaignPolicy(input: BuildCampaignPolicyInput) {
  const inferredJobProfile =
    input.inferredJobProfile ||
    inferJobProfile({
      jobType: input.jobType,
      startTime: input.jobStartTime,
      endTime: input.jobEndTime,
      requiredCrewCount: input.requiredCrewCount,
    });
  const selectedDefaults = PROFILE_DEFAULTS[input.selectedJobProfile] || PROFILE_DEFAULTS.standard;
  const weights = {
    ...selectedDefaults.weights,
    ...input.weightOverrides,
  };
  const roleProfiles = Object.fromEntries(
    Object.entries(input.roleProfiles).map(([roleCode, profile]) => {
      const selected = input.roleProfileOverrides?.[roleCode] || profile.selected_profile || profile.inferred_profile;
      return [
        roleCode,
        {
          ...profile,
          selected_profile: selected,
          manual_override: selected !== profile.inferred_profile,
        },
      ];
    }),
  );

  return {
    profile: {
      infer_from_job_type: input.inferProfileFromJobType,
      job_type: normalizeStaffingJobType(input.jobType),
      inferred_job_profile: inferredJobProfile,
      selected_job_profile: input.selectedJobProfile,
      manual_profile_override: input.selectedJobProfile !== inferredJobProfile,
      override_reason: input.profileOverrideReason || null,
    },
    role_profiles: roleProfiles,
    weights: toLegacyRankWeights(weights),
    availability_ttl_hours: input.availabilityTtlHours,
    offer_ttl_hours: input.offerTtlHours,
    availability_multiplier: Math.max(1, input.waves.buffer + 1),
    offer_buffer: Math.max(0, input.waves.buffer),
    exclude_fridge: input.excludeFridge,
    soft_conflict_policy: input.softConflictPolicy,
    tick_interval_seconds: input.tickIntervalSeconds,
    channel: input.sendChannel,
    assisted_handoff_priority: true,
    cost_scoring: {
      enabled: input.costScoring.enabled,
      penalty_strength: input.costScoring.penaltyStrength,
      max_rate_penalty: input.costScoring.maxRatePenalty,
    },
    waves: {
      mode: input.waves.mode,
      size_mode: input.waves.mode === 'blast_all_eligible' ? 'all' : 'required_plus_buffer',
      buffer: input.waves.buffer,
      wait_minutes: input.waves.waitMinutes,
      max_waves: input.waves.maxWaves,
      auto_send_next_wave: input.waves.autoSendNextWave,
    },
    auto_close: {
      close_when_filled: true,
      stop_future_waves: true,
      block_extra_acceptances: true,
      confirm_booked_crew: true,
      notify_late_responders: true,
      notify_pending_contacted: true,
    },
    escalation: {
      escalate_after_wave: selectedDefaults.maxWaves,
      minimum_auto_book_score: selectedDefaults.minimumAutoBookScore,
      escalate_soft_conflicts: true,
      escalate_weak_critical_pool: true,
      require_manager_approval_for_low_confidence: true,
    },
    surrounding_jobs: {
      enabled: input.surroundingJobs?.enabled ?? true,
      max_location_distance_km: input.surroundingJobs?.maxLocationDistanceKm ?? 25,
    },
    audit: {
      log_inferred_profile: true,
      log_profile_override: true,
      log_score_breakdown: true,
      log_eligibility_failures: true,
      log_wave_contact_history: true,
      log_rate_adjustment: true,
      require_manual_override_reason: true,
      generate_crew_facing_explanation: true,
    },
    escalation_steps: ['increase_wave', 'include_fridge', 'allow_soft_conflicts'],
  };
}

export function recommendedWaveNumber(index: number, requiredCount: number, buffer: number): number {
  const waveSize = Math.max(1, Number(requiredCount || 0) + Number(buffer || 0));
  return Math.floor(index / waveSize) + 1;
}
