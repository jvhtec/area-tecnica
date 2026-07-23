import React, { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { dataLayerClient } from '@/services/dataLayerClient';
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import {
  JOB_PROFILE_LABELS,
  PROFILE_DEFAULTS,
  PROFILE_OPTIONS,
  RatePenaltyStrength,
  SoftConflictPolicy,
  StaffingChannel,
  WaveMode,
  buildCampaignPolicy,
  buildRoleProfiles,
  inferJobProfile,
  JobProfileName,
} from '@/features/staffing/crewingProfiles'
import {
  CARLOS_AGENT_NAME,
  CARLOS_AUTO_MODE_LABEL,
} from '@/features/staffing/carlos'
import { canResumeStaffingCampaign, staffingCampaignResumeLabel } from '@/features/staffing/campaignLifecycle'

import { queryKeys } from "@/lib/react-query";
import type { Json } from "@/integrations/supabase/types";

interface StoredRoleProfile {
  selected_profile?: JobProfileName
  inferred_profile?: JobProfileName
}

interface StoredCampaignPolicy {
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
  cost_scoring?: {
    enabled?: boolean
    penaltyStrength?: RatePenaltyStrength
    maxRatePenalty?: number
  }
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

const normalizeStoredCampaignPolicy = (value: Json): StoredCampaignPolicy => {
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
    soft_conflict_policy: typeof value.soft_conflict_policy === 'string'
      ? value.soft_conflict_policy as SoftConflictPolicy
      : undefined,
    exclude_fridge: typeof value.exclude_fridge === 'boolean' ? value.exclude_fridge : undefined,
    availability_ttl_hours: typeof value.availability_ttl_hours === 'number' ? value.availability_ttl_hours : undefined,
    offer_ttl_hours: typeof value.offer_ttl_hours === 'number' ? value.offer_ttl_hours : undefined,
    tick_interval_seconds: typeof value.tick_interval_seconds === 'number' ? value.tick_interval_seconds : undefined,
    channel: value.channel === 'whatsapp' ? 'whatsapp' : value.channel === 'email' ? 'email' : undefined,
    cost_scoring: {
      enabled: typeof costScoring.enabled === 'boolean' ? costScoring.enabled : undefined,
      penaltyStrength: typeof costScoring.penaltyStrength === 'string'
        ? costScoring.penaltyStrength as RatePenaltyStrength
        : undefined,
      maxRatePenalty: typeof costScoring.maxRatePenalty === 'number' ? costScoring.maxRatePenalty : undefined,
    },
    waves: {
      mode: typeof waves.mode === 'string' ? waves.mode as WaveMode : undefined,
      buffer: typeof waves.buffer === 'number' ? waves.buffer : undefined,
      wait_minutes: typeof waves.wait_minutes === 'number' ? waves.wait_minutes : undefined,
      max_waves: typeof waves.max_waves === 'number' ? waves.max_waves : undefined,
      auto_send_next_wave: typeof waves.auto_send_next_wave === 'boolean' ? waves.auto_send_next_wave : undefined,
    },
  }
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Error desconocido'
import { StaffingCampaignView } from "@/components/matrix/StaffingCampaignView";

interface StaffingCampaignPanelProps {
  jobId: string
  department: string
  jobTitle?: string
  onClose?: () => void
}

interface Campaign {
  id: string
  job_id: string
  department: string
  mode: 'assisted' | 'auto'
  status: 'active' | 'paused' | 'stopped' | 'completed' | 'failed'
  policy: StoredCampaignPolicy
  offer_message?: string
  created_at: string
  updated_at: string
  last_run_at?: string
  next_run_at?: string
  version: number
}

interface CampaignRole {
  id: string
  campaign_id: string
  role_code: string
  assigned_count: number
  pending_availability: number
  confirmed_availability: number
  pending_offers: number
  accepted_offers: number
  stage: 'idle' | 'availability' | 'offer' | 'filled' | 'escalating'
  wave_number: number
  last_wave_at?: string
}

interface JobMeta {
  id: string
  title?: string | null
  job_type?: string | null
  start_time?: string | null
  end_time?: string | null
  description?: string | null
}

interface RequiredRole {
  role_code: string
  quantity: number
}

export interface StaffingCampaignFormData {
  mode: 'assisted' | 'auto'
  scope: 'outstanding' | 'all'
  proximityWeight: number
  historyWeight: number
  softConflictPolicy: SoftConflictPolicy
  excludeFridge: boolean
  availabilityTtl: number
  offerTtl: number
  offerMessage: string
  tickInterval: number
  channel: StaffingChannel
  inferProfileFromJobType: boolean
  selectedJobProfile: JobProfileName
  profileOverrideReason: string
  roleProfileOverrides: Record<string, JobProfileName>
  costScoringEnabled: boolean
  ratePenaltyStrength: RatePenaltyStrength
  maxRatePenalty: number
  waveMode: WaveMode
  waveBuffer: number
  waveWaitMinutes: number
  maxWaves: number
  autoSendNextWave: boolean
}

export type { Campaign, CampaignRole, JobMeta }

export const StaffingCampaignPanel: React.FC<StaffingCampaignPanelProps> = ({
  jobId,
  department,
  jobTitle,
  onClose
}) => {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showStartDialog, setShowStartDialog] = useState(false)
  const [profileDefaultsApplied, setProfileDefaultsApplied] = useState(false)
  const [formData, setFormData] = useState<StaffingCampaignFormData>({
    mode: 'assisted' as 'assisted' | 'auto',
    scope: 'outstanding' as 'outstanding' | 'all',
    proximityWeight: 0.1,
    historyWeight: 0.2, // Will be mapped to reliability
    softConflictPolicy: 'block' as SoftConflictPolicy,
    excludeFridge: true,
    availabilityTtl: 24,
    offerTtl: 4,
    offerMessage: '',
    tickInterval: 300,
    channel: 'email' as StaffingChannel,
    inferProfileFromJobType: true,
    selectedJobProfile: 'standard' as JobProfileName,
    profileOverrideReason: '',
    roleProfileOverrides: {} as Record<string, JobProfileName>,
    costScoringEnabled: true,
    ratePenaltyStrength: 'normal' as RatePenaltyStrength,
    maxRatePenalty: 10,
    waveMode: 'controlled_waves' as WaveMode,
    waveBuffer: 2,
    waveWaitMinutes: 20,
    maxWaves: 3,
    autoSendNextWave: false
  })

  // Fetch active campaign for this job+department
  const { data: campaign } = useQuery({
    queryKey: queryKeys.scope('staffing_campaign', jobId, department),
    queryFn: async () => {
      const { data } = await dataLayerClient.from('staffing_campaigns')
        .select('*')
        .eq('job_id', jobId)
        .eq('department', department)
        .maybeSingle()
      if (!data) return null
      return {
        ...data,
        mode: data.mode === 'auto' ? 'auto' : 'assisted',
        status: ['active', 'paused', 'stopped', 'completed', 'failed'].includes(data.status)
          ? data.status as Campaign['status']
          : 'failed',
        policy: normalizeStoredCampaignPolicy(data.policy),
      } satisfies Campaign
    }
  })

  const { data: jobMeta } = useQuery({
    queryKey: queryKeys.scope('staffing_job_meta', jobId),
    queryFn: async () => {
      const { data } = await dataLayerClient.from('jobs')
        .select('id, title, job_type, start_time, end_time, description')
        .eq('id', jobId)
        .maybeSingle()
      return data as JobMeta | null
    }
  })

  const { data: requiredRoles } = useQuery({
    queryKey: queryKeys.scope('staffing_required_role_rows', jobId, department),
    queryFn: async () => {
      const { data } = await dataLayerClient.from('job_required_roles')
        .select('role_code, quantity')
        .eq('job_id', jobId)
        .eq('department', department)
        .order('role_code')
      return (data || []) as RequiredRole[]
    }
  })

  // Fetch campaign roles if campaign exists
  const { data: campaignRoles } = useQuery({
    queryKey: queryKeys.scope('staffing_campaign_roles', campaign?.id),
    queryFn: async () => {
      if (!campaign?.id) return []
      const { data } = await dataLayerClient.from('staffing_campaign_roles')
        .select('*')
        .eq('campaign_id', campaign.id)
        .order('role_code')
      return (data || []) as CampaignRole[]
    },
    enabled: !!campaign?.id
  })

  const requiredByRole = useMemo(() => (
    (requiredRoles || []).reduce<Record<string, number>>((acc, role) => {
      if (role.role_code) acc[String(role.role_code).trim()] = Number(role.quantity || 0)
      return acc
    }, {})
  ), [requiredRoles])

  const assignedByRole = useMemo(() => (
    (campaignRoles || []).reduce<Record<string, number>>((acc, role) => {
      if (role.role_code) acc[String(role.role_code).trim()] = Number(role.assigned_count || 0)
      return acc
    }, {})
  ), [campaignRoles])

  const roleCodes = useMemo(() => {
    const codes = new Set<string>()
    ;(requiredRoles || []).forEach((role) => {
      const code = String(role.role_code || '').trim()
      if (code) codes.add(code)
    })
    ;(campaignRoles || []).forEach((role) => {
      const code = String(role.role_code || '').trim()
      if (code) codes.add(code)
    })
    return Array.from(codes).sort()
  }, [campaignRoles, requiredRoles])

  const totalRequired = useMemo(
    () => Object.values(requiredByRole).reduce((sum, quantity) => sum + quantity, 0),
    [requiredByRole]
  )

  const inferredJobProfile = useMemo(() => inferJobProfile({
    jobType: jobMeta?.job_type,
    startTime: jobMeta?.start_time,
    endTime: jobMeta?.end_time,
    requiredCrewCount: totalRequired
  }), [jobMeta?.end_time, jobMeta?.job_type, jobMeta?.start_time, totalRequired])

  const roleProfiles = useMemo(() => buildRoleProfiles({
    roleCodes,
    requiredByRole,
    assignedByRole,
    selectedJobProfile: formData.selectedJobProfile,
    startTime: jobMeta?.start_time,
    overrides: formData.roleProfileOverrides
  }), [
    assignedByRole,
    formData.roleProfileOverrides,
    formData.selectedJobProfile,
    jobMeta?.start_time,
    requiredByRole,
    roleCodes
  ])

  // Initialize formData from active campaign
  useEffect(() => {
    if (campaign) {
      const selectedProfile = campaign.policy?.profile?.selected_job_profile || 'standard'
      const selectedDefaults = PROFILE_DEFAULTS[selectedProfile as JobProfileName] || PROFILE_DEFAULTS.standard
      const savedRoleProfiles = campaign.policy?.role_profiles || {}
      const roleProfileOverrides = Object.entries(savedRoleProfiles).reduce<Record<string, JobProfileName>>(
        (acc, [roleCode, profile]) => {
          const selected = profile?.selected_profile as JobProfileName | undefined
          const inferred = profile?.inferred_profile as JobProfileName | undefined
          if (selected && selected !== inferred) acc[roleCode] = selected
          return acc
        },
        {}
      )

      setFormData({
        mode: campaign.mode,
        scope: 'outstanding',
        proximityWeight: campaign.policy?.weights?.proximity ?? selectedDefaults.weights.proximity,
        historyWeight: campaign.policy?.weights?.reliability ?? selectedDefaults.weights.reliability,
        softConflictPolicy: (campaign.policy?.soft_conflict_policy ?? 'block') as SoftConflictPolicy,
        excludeFridge: campaign.policy?.exclude_fridge ?? true,
        availabilityTtl: campaign.policy?.availability_ttl_hours ?? 24,
        offerTtl: campaign.policy?.offer_ttl_hours ?? 4,
        offerMessage: campaign.offer_message ?? '',
        tickInterval: campaign.policy?.tick_interval_seconds ?? 300,
        channel: campaign.policy?.channel === 'whatsapp' ? 'whatsapp' : 'email',
        inferProfileFromJobType: campaign.policy?.profile?.infer_from_job_type ?? true,
        selectedJobProfile: selectedProfile as JobProfileName,
        profileOverrideReason: campaign.policy?.profile?.override_reason ?? '',
        roleProfileOverrides,
        costScoringEnabled: campaign.policy?.cost_scoring?.enabled ?? true,
        ratePenaltyStrength: campaign.policy?.cost_scoring?.penaltyStrength ?? 'normal',
        maxRatePenalty: campaign.policy?.cost_scoring?.maxRatePenalty ?? 10,
        waveMode: (campaign.policy?.waves?.mode ?? 'controlled_waves') as WaveMode,
        waveBuffer: campaign.policy?.waves?.buffer ?? selectedDefaults.waveBuffer,
        waveWaitMinutes: campaign.policy?.waves?.wait_minutes ?? selectedDefaults.waveWaitMinutes,
        maxWaves: campaign.policy?.waves?.max_waves ?? selectedDefaults.maxWaves,
        autoSendNextWave: campaign.policy?.waves?.auto_send_next_wave ?? campaign.mode === 'auto'
      })
      setProfileDefaultsApplied(true)
    }
  }, [campaign])

  useEffect(() => {
    if (campaign || profileDefaultsApplied || !jobMeta || requiredRoles === undefined) return

    const defaults = PROFILE_DEFAULTS[inferredJobProfile] || PROFILE_DEFAULTS.standard
    setFormData((current) => ({
      ...current,
      selectedJobProfile: inferredJobProfile,
      proximityWeight: defaults.weights.proximity,
      historyWeight: defaults.weights.reliability,
      availabilityTtl: defaults.availabilityTtlHours,
      offerTtl: defaults.offerTtlHours,
      softConflictPolicy: defaults.defaultSoftConflictPolicy,
      waveBuffer: defaults.waveBuffer,
      waveWaitMinutes: defaults.waveWaitMinutes,
      maxWaves: defaults.maxWaves,
      offerMessage: current.offerMessage || jobMeta.description || '',
      autoSendNextWave: current.mode === 'auto'
    }))
    setProfileDefaultsApplied(true)
  }, [campaign, inferredJobProfile, jobMeta, profileDefaultsApplied, requiredRoles])

  const selectedProfileDefaults = PROFILE_DEFAULTS[formData.selectedJobProfile] || PROFILE_DEFAULTS.standard
  const profileOverrideActive = formData.selectedJobProfile !== inferredJobProfile

  const applyProfileDefaults = (profile: JobProfileName) => {
    const defaults = PROFILE_DEFAULTS[profile] || PROFILE_DEFAULTS.standard
    setFormData((current) => ({
      ...current,
      selectedJobProfile: profile,
      proximityWeight: defaults.weights.proximity,
      historyWeight: defaults.weights.reliability,
      availabilityTtl: defaults.availabilityTtlHours,
      offerTtl: defaults.offerTtlHours,
      softConflictPolicy: defaults.defaultSoftConflictPolicy,
      waveBuffer: defaults.waveBuffer,
      waveWaitMinutes: defaults.waveWaitMinutes,
      maxWaves: defaults.maxWaves,
      autoSendNextWave: current.mode === 'auto'
    }))
  }

  const updateMode = (mode: 'assisted' | 'auto') => {
    setFormData((current) => ({
      ...current,
      mode,
      autoSendNextWave: mode === 'auto',
      softConflictPolicy: mode === 'auto' && current.softConflictPolicy === 'warn'
        ? 'block'
        : current.softConflictPolicy
    }))
  }

  const updateRoleProfileOverride = (roleCode: string, profile: JobProfileName) => {
    setFormData((current) => {
      const inferred = roleProfiles[roleCode]?.inferred_profile
      const next = { ...current.roleProfileOverrides }

      if (!inferred || profile === inferred) {
        delete next[roleCode]
      } else {
        next[roleCode] = profile
      }

      return { ...current, roleProfileOverrides: next }
    })
  }

  const buildPolicyPayload = () => buildCampaignPolicy({
    mode: formData.mode,
    jobType: jobMeta?.job_type,
    jobStartTime: jobMeta?.start_time,
    jobEndTime: jobMeta?.end_time,
    requiredCrewCount: totalRequired,
    selectedJobProfile: formData.selectedJobProfile,
    inferredJobProfile,
    inferProfileFromJobType: formData.inferProfileFromJobType,
    profileOverrideReason: formData.profileOverrideReason,
    roleProfiles,
    roleProfileOverrides: formData.roleProfileOverrides,
    availabilityTtlHours: formData.availabilityTtl,
    offerTtlHours: formData.offerTtl,
    softConflictPolicy: formData.softConflictPolicy,
    excludeFridge: formData.excludeFridge,
    sendChannel: formData.channel,
    costScoring: {
      enabled: formData.costScoringEnabled,
      penaltyStrength: formData.ratePenaltyStrength,
      maxRatePenalty: formData.maxRatePenalty
    },
    waves: {
      mode: formData.waveMode,
      buffer: formData.waveBuffer,
      waitMinutes: formData.waveWaitMinutes,
      maxWaves: formData.maxWaves,
      autoSendNextWave: formData.autoSendNextWave
    },
    tickIntervalSeconds: formData.tickInterval,
    weightOverrides: {
      proximity: formData.proximityWeight,
      reliability: formData.historyWeight
    }
  })

  // Start campaign mutation
  const startMutation = useMutation({
    mutationFn: async () => {
      const policy = buildPolicyPayload()

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/staffing-orchestrator?action=start`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await dataLayerClient.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({
            job_id: jobId,
            department,
            mode: formData.mode,
            policy,
            offer_message: formData.offerMessage || null,
            scope: formData.scope
          })
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to start campaign')
      }

      return response.json()
    },
    onSuccess: (data) => {
      toast({
        title: 'Campaign started',
        description: `${data.roles_created} roles initialized`
      })
      setShowStartDialog(false)
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('staffing_campaign', jobId, department) })
      if (data?.campaign?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.scope('staffing_campaign_roles', data.campaign.id) })
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('staffing_availability_responses', jobId) })
    },
    onError: (error: unknown) => {
      toast({
        title: 'Error',
        description: getErrorMessage(error),
        variant: 'destructive'
      })
    }
  })

  // Update campaign settings mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      const policy = buildPolicyPayload()
      const switchingToAuto = formData.mode === 'auto' && campaign?.mode !== 'auto'

      const nextRunUpdate = switchingToAuto
        ? { next_run_at: new Date().toISOString() }
        : {}

      const { data, error } = await dataLayerClient.from('staffing_campaigns')
        .update({
          mode: formData.mode,
          policy,
          offer_message: formData.offerMessage || null,
          updated_at: new Date().toISOString(),
          ...nextRunUpdate
        })
        .eq('id', campaign?.id)
        .select()
        .single()

      if (error) throw error

      if (switchingToAuto) {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/staffing-orchestrator?action=nudge`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await dataLayerClient.auth.getSession()).data.session?.access_token}`
            },
            body: JSON.stringify({ campaign_id: campaign?.id })
          }
        )
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(payload?.error || `No se pudo iniciar el ciclo de ${CARLOS_AGENT_NAME}`)
        }
      }

      return data
    },
    onSuccess: () => {
      toast({ title: 'Settings updated' })
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('staffing_campaign', jobId, department) })
      if (campaign?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.scope('staffing_campaign_roles', campaign.id) })
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('staffing_availability_responses', jobId) })
    },
    onError: (error: unknown) => {
      toast({
        title: 'Error updating settings',
        description: getErrorMessage(error),
        variant: 'destructive'
      })
    }
  })

  // Pause campaign mutation
  const pauseMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/staffing-orchestrator?action=pause`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await dataLayerClient.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({ campaign_id: campaign?.id })
        }
      )
      if (!response.ok) throw new Error('Failed to pause campaign')
      return response.json()
    },
    onSuccess: () => {
      toast({ title: 'Campaign paused' })
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('staffing_campaign', jobId, department) })
    }
  })

  // Resume campaign mutation
  const resumeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/staffing-orchestrator?action=resume`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await dataLayerClient.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({ campaign_id: campaign?.id })
        }
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'Failed to resume campaign')
      return payload
    },
    onSuccess: () => {
      toast({ title: campaign?.status === 'paused' ? 'Campaña reanudada' : 'Campaña reiniciada' })
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('staffing_campaign', jobId, department) })
    }
  })

  // Stop campaign mutation
  const stopMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/staffing-orchestrator?action=stop`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await dataLayerClient.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({ campaign_id: campaign?.id })
        }
      )
      if (!response.ok) throw new Error('Failed to stop campaign')
      return response.json()
    },
    onSuccess: () => {
      toast({ title: 'Campaign stopped' })
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('staffing_campaign', jobId, department) })
    }
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'paused':
        return 'bg-yellow-100 text-yellow-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'filled':
        return 'bg-green-100 text-green-800'
      case 'offer':
        return 'bg-blue-100 text-blue-800'
      case 'availability':
        return 'bg-purple-100 text-purple-800'
      case 'escalating':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }


  return (
    <StaffingCampaignView
      jobMeta={jobMeta}
      inferredJobProfile={inferredJobProfile}
      profileOverrideActive={profileOverrideActive}
      roleCodes={roleCodes}
      roleProfiles={roleProfiles}
      selectedProfileDefaults={selectedProfileDefaults}
      applyProfileDefaults={applyProfileDefaults}
      updateRoleProfileOverride={updateRoleProfileOverride}
      formData={formData}
      setFormData={setFormData}
      updateMode={updateMode}
      campaign={campaign}
      jobTitle={jobTitle}
      department={department}
      showStartDialog={showStartDialog}
      setShowStartDialog={setShowStartDialog}
      startMutation={startMutation}
      campaignRoles={campaignRoles}
      getStatusColor={getStatusColor}
      getStageColor={getStageColor}
      updateMutation={updateMutation}
      pauseMutation={pauseMutation}
      resumeMutation={resumeMutation}
      stopMutation={stopMutation}
    />
  )
}
