export interface CampaignPolicy {
  weights: {
    skills: number;
    role_skill?: number;
    proximity: number;
    reliability: number;
    fairness: number;
    experience: number;
    cost_efficiency?: number;
    house_tech_bonus?: number;
    role_progression?: number;
    availability_confidence?: number;
  };
  availability_ttl_hours: number;
  offer_ttl_hours: number;
  availability_multiplier: number;
  offer_buffer: number;
  exclude_fridge: boolean;
  soft_conflict_policy: 'warn' | 'block' | 'allow' | 'manager_approval' | 'ignore';
  tick_interval_seconds: number;
  channel?: 'email' | 'whatsapp';
  assisted_handoff_priority?: boolean;
  profile?: Record<string, unknown>;
  role_profiles?: Record<string, unknown>;
  cost_scoring?: {
    enabled?: boolean;
    penalty_strength?: 'disabled' | 'low' | 'normal' | 'high';
    max_rate_penalty?: number;
  };
  waves?: {
    mode?: 'manual_selection' | 'controlled_waves' | 'blast_all_eligible';
    size_mode?: 'required_plus_buffer' | 'fixed' | 'all';
    buffer?: number;
    fixed_size?: number;
    max_waves?: number;
    wait_minutes?: number;
    auto_send_next_wave?: boolean;
  };
  auto_close?: Record<string, boolean>;
  audit?: Record<string, boolean>;
  escalation?: Record<string, unknown>;
  surrounding_jobs?: {
    enabled?: boolean;
    max_location_distance_km?: number;
  };
  escalation_steps: string[];
}

type CampaignPolicyProfile = {
  infer_from_job_type?: boolean;
  selected_job_profile?: unknown;
  override_reason?: unknown;
};

type RoleProfilePolicy = {
  inferred_profile?: unknown;
  selected_profile?: unknown;
  assigned_count?: unknown;
};

type StaffingJobLike = {
  job_type?: unknown;
  start_time?: unknown;
  end_time?: unknown;
};

type StaffingRoleLike = {
  role_code?: unknown;
  quantity?: unknown;
};

type CampaignUser = {
  role?: unknown;
  department?: unknown;
};

export type JobProfileName =
  | 'standard'
  | 'high_risk_critical'
  | 'training_friendly'
  | 'emergency_fill'
  | 'local_low_complexity'
  | 'multi_day_tour'
  | 'custom';

const PROFILE_WEIGHTS: Record<JobProfileName, CampaignPolicy['weights']> = {
  standard: {
    skills: 0.32,
    role_skill: 0.32,
    reliability: 0.23,
    fairness: 0.15,
    proximity: 0.1,
    experience: 0.04,
    role_progression: 0.04,
    cost_efficiency: 0.08,
    house_tech_bonus: 0.05,
    availability_confidence: 0.03,
  },
  high_risk_critical: {
    skills: 0.4,
    role_skill: 0.4,
    reliability: 0.35,
    fairness: 0.05,
    proximity: 0.05,
    experience: 0.02,
    role_progression: 0.02,
    cost_efficiency: 0.03,
    house_tech_bonus: 0.1,
    availability_confidence: 0,
  },
  training_friendly: {
    skills: 0.23,
    role_skill: 0.23,
    reliability: 0.18,
    fairness: 0.25,
    proximity: 0.05,
    experience: 0.18,
    role_progression: 0.18,
    cost_efficiency: 0.08,
    house_tech_bonus: 0.03,
    availability_confidence: 0,
  },
  emergency_fill: {
    skills: 0.15,
    role_skill: 0.15,
    reliability: 0.3,
    fairness: 0,
    proximity: 0.2,
    experience: 0,
    role_progression: 0,
    cost_efficiency: 0.02,
    house_tech_bonus: 0.03,
    availability_confidence: 0.3,
  },
  local_low_complexity: {
    skills: 0.18,
    role_skill: 0.18,
    reliability: 0.18,
    fairness: 0.23,
    proximity: 0.23,
    experience: 0.04,
    role_progression: 0.04,
    cost_efficiency: 0.12,
    house_tech_bonus: 0.02,
    availability_confidence: 0,
  },
  multi_day_tour: {
    skills: 0.28,
    role_skill: 0.28,
    reliability: 0.28,
    fairness: 0.04,
    proximity: 0.04,
    experience: 0,
    role_progression: 0,
    cost_efficiency: 0.1,
    house_tech_bonus: 0.08,
    availability_confidence: 0.18,
  },
  custom: {
    skills: 0.32,
    role_skill: 0.32,
    reliability: 0.23,
    fairness: 0.15,
    proximity: 0.1,
    experience: 0.04,
    role_progression: 0.04,
    cost_efficiency: 0.08,
    house_tech_bonus: 0.05,
    availability_confidence: 0.03,
  },
};

const PROFILE_TIMING: Record<JobProfileName, { availability: number; offer: number; waveWait: number; buffer: number; maxWaves: number }> = {
  standard: { availability: 24, offer: 4, waveWait: 20, buffer: 2, maxWaves: 3 },
  high_risk_critical: { availability: 24, offer: 2, waveWait: 15, buffer: 1, maxWaves: 3 },
  training_friendly: { availability: 24, offer: 4, waveWait: 30, buffer: 3, maxWaves: 3 },
  emergency_fill: { availability: 4, offer: 1, waveWait: 5, buffer: 4, maxWaves: 4 },
  local_low_complexity: { availability: 24, offer: 3, waveWait: 20, buffer: 2, maxWaves: 3 },
  multi_day_tour: { availability: 48, offer: 4, waveWait: 30, buffer: 1, maxWaves: 3 },
  custom: { availability: 24, offer: 4, waveWait: 20, buffer: 2, maxWaves: 3 },
};

export function normalizeProfileName(value: unknown): JobProfileName {
  const name = String(value || 'standard') as JobProfileName;
  return Object.prototype.hasOwnProperty.call(PROFILE_WEIGHTS, name) ? name : 'standard';
}

export function inferJobProfile(job: StaffingJobLike | null | undefined, totalRequired: number): JobProfileName {
  const startsAt = job?.start_time ? new Date(String(job.start_time)) : null;
  const endsAt = job?.end_time ? new Date(String(job.end_time)) : null;
  const startsWithinHours = startsAt && !Number.isNaN(startsAt.getTime())
    ? (startsAt.getTime() - Date.now()) / 36e5
    : null;
  const spansMultipleDates = startsAt && endsAt
    && !Number.isNaN(startsAt.getTime())
    && !Number.isNaN(endsAt.getTime())
    && endsAt.getTime() > startsAt.getTime()
    && startsAt.toISOString().slice(0, 10) !== endsAt.toISOString().slice(0, 10);
  const type = String(job?.job_type || 'single').toLowerCase();

  if (startsWithinHours !== null && startsWithinHours <= 6) return 'emergency_fill';
  if (type === 'tourdate' || type === 'ciclo' || spansMultipleDates) return 'multi_day_tour';
  if (type === 'festival' || totalRequired >= 10) return 'high_risk_critical';
  return 'standard';
}

export function isCriticalRole(roleCode: string): boolean {
  return [
    /\bA1\b/i,
    /\bV1\b/i,
    /\bPM\b/i,
    /\bRF\b/i,
    /CREW[\s_-]*CHIEF/i,
    /SYSTEM/i,
    /LEAD/i,
    /^SND-PA(?:-|$)/i,
    /^LGT-MON(?:-|$)/i,
  ].some((pattern) => pattern.test(roleCode));
}

export function inferRoleProfile(jobProfile: JobProfileName, roleCode: string): JobProfileName {
  if (jobProfile === 'multi_day_tour') return 'multi_day_tour';
  if (isCriticalRole(roleCode)) return 'high_risk_critical';
  if (/ASSIST|HELP|RUNNER|STAGEHAND|AUX/i.test(roleCode) && jobProfile !== 'emergency_fill') {
    return 'training_friendly';
  }
  return jobProfile;
}

export function normalizeCampaignPolicy(
  policy: Partial<CampaignPolicy> | null | undefined,
  job: StaffingJobLike | null | undefined,
  roles: StaffingRoleLike[],
  mode: 'assisted' | 'auto',
): CampaignPolicy {
  const basePolicy = policy || {};
  const profilePolicy = (basePolicy.profile || {}) as CampaignPolicyProfile;
  const roleProfilePolicies = (basePolicy.role_profiles || {}) as Record<string, RoleProfilePolicy | undefined>;
  const totalRequired = roles.reduce((sum, role) => sum + Number(role.quantity || 0), 0);
  const inferredJobProfile = inferJobProfile(job, totalRequired);
  const selectedJobProfile = normalizeProfileName(profilePolicy.selected_job_profile || inferredJobProfile);
  const timing = PROFILE_TIMING[selectedJobProfile];
  const roleProfiles = roles.reduce<Record<string, unknown>>((acc, role) => {
    const roleCode = String(role.role_code || '').trim();
    if (!roleCode) return acc;
    const existing = roleProfilePolicies[roleCode];
    const inferred = normalizeProfileName(existing?.inferred_profile || inferRoleProfile(selectedJobProfile, roleCode));
    const selected = normalizeProfileName(existing?.selected_profile || inferred);
    acc[roleCode] = {
      role_code: roleCode,
      inferred_profile: inferred,
      selected_profile: selected,
      manual_override: selected !== inferred,
      required_count: Number(role.quantity || 0),
      assigned_count: Number(existing?.assigned_count || 0),
      is_critical: isCriticalRole(roleCode),
    };
    return acc;
  }, {});

  return {
    ...basePolicy,
    profile: {
      infer_from_job_type: profilePolicy.infer_from_job_type ?? true,
      job_type: String(job?.job_type || 'single').toLowerCase(),
      inferred_job_profile: inferredJobProfile,
      selected_job_profile: selectedJobProfile,
      manual_profile_override: selectedJobProfile !== inferredJobProfile,
      override_reason: profilePolicy.override_reason || null,
    },
    role_profiles: roleProfiles,
    weights: {
      ...PROFILE_WEIGHTS[selectedJobProfile],
      ...(basePolicy.weights || {}),
    },
    availability_ttl_hours: Number(basePolicy.availability_ttl_hours || timing.availability),
    offer_ttl_hours: Number(basePolicy.offer_ttl_hours || timing.offer),
    availability_multiplier: Number(basePolicy.availability_multiplier || timing.buffer + 1),
    offer_buffer: Number(basePolicy.offer_buffer ?? timing.buffer),
    exclude_fridge: basePolicy.exclude_fridge ?? true,
    soft_conflict_policy: basePolicy.soft_conflict_policy || (mode === 'auto' ? 'block' : 'warn'),
    tick_interval_seconds: Number(basePolicy.tick_interval_seconds || 300),
    channel: basePolicy.channel === 'whatsapp' ? 'whatsapp' : 'email',
    assisted_handoff_priority: basePolicy.assisted_handoff_priority !== false,
    cost_scoring: {
      enabled: basePolicy.cost_scoring?.enabled ?? true,
      penalty_strength: basePolicy.cost_scoring?.penalty_strength || 'normal',
      max_rate_penalty: Number(basePolicy.cost_scoring?.max_rate_penalty || 10),
    },
    waves: {
      mode: basePolicy.waves?.mode || 'controlled_waves',
      size_mode: basePolicy.waves?.size_mode || 'required_plus_buffer',
      buffer: Number(basePolicy.waves?.buffer ?? timing.buffer),
      fixed_size:
        basePolicy.waves?.fixed_size == null
          ? undefined
          : Math.max(1, Number(basePolicy.waves.fixed_size)),
      max_waves: Number(basePolicy.waves?.max_waves ?? timing.maxWaves),
      wait_minutes: Number(basePolicy.waves?.wait_minutes ?? timing.waveWait),
      auto_send_next_wave: basePolicy.waves?.auto_send_next_wave ?? mode === 'auto',
    },
    auto_close: {
      close_when_filled: true,
      stop_future_waves: true,
      block_extra_acceptances: true,
      confirm_booked_crew: true,
      notify_late_responders: true,
      notify_pending_contacted: true,
      ...(basePolicy.auto_close || {}),
    },
    escalation: {
      escalate_after_wave: timing.maxWaves,
      minimum_auto_book_score: selectedJobProfile === 'high_risk_critical' ? 75 : 70,
      escalate_soft_conflicts: true,
      escalate_weak_critical_pool: true,
      require_manager_approval_for_low_confidence: true,
      ...(basePolicy.escalation || {}),
    },
    surrounding_jobs: {
      enabled: basePolicy.surrounding_jobs?.enabled ?? true,
      max_location_distance_km: Number(basePolicy.surrounding_jobs?.max_location_distance_km ?? 25),
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
      ...(basePolicy.audit || {}),
    },
    escalation_steps: basePolicy.escalation_steps || ['increase_wave', 'include_fridge', 'allow_soft_conflicts'],
  };
}

export function assignmentRoleColumnForDepartment(department: string): string | null {
  switch ((department || '').toLowerCase()) {
    case 'sound':
      return 'sound_role';
    case 'lights':
      return 'lights_role';
    case 'video':
      return 'video_role';
    case 'production':
      return 'production_role';
    default:
      return null;
  }
}

export async function canManageCampaign(
  user: CampaignUser | null | undefined,
  department: string,
  _supabase?: unknown,
): Promise<boolean> {
  if (user?.role === 'admin' || user?.role === 'logistics') {
    return true;
  }
  if (user?.role === 'management') {
    if (!user.department) return true;
    if (department === 'production' && user.department === 'logistics') return true;
    return user.department === department;
  }
  return false;
}
