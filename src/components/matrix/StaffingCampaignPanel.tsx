import {
  CARLOS_AGENT_NAME
} from '@/features/staffing/carlos';
import {
  buildCampaignPolicy,
  buildRoleProfiles,
  inferJobProfile,
  JobProfileName,
  PROFILE_DEFAULTS,
  RatePenaltyStrength,
  SoftConflictPolicy,
  StaffingChannel,
  WaveMode
} from '@/features/staffing/crewingProfiles';
import {
  normalizeStoredCampaignPolicy,
  type StoredCampaignPolicy,
} from '@/features/staffing/storedCampaignPolicy';
import { useToast } from '@/hooks/use-toast';
import { dataLayerClient } from '@/services/dataLayerClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useMemo, useState } from 'react';

import { StaffingCampaignView } from "@/components/matrix/StaffingCampaignView";
import { queryKeys } from "@/lib/react-query";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Error desconocido'

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

export type { Campaign, CampaignRole, JobMeta };

export const StaffingCampaignPanel: React.FC<StaffingCampaignPanelProps> = ({
  jobId,
  department,
  jobTitle
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
        ratePenaltyStrength: campaign.policy?.cost_scoring?.penalty_strength ?? 'normal',
        maxRatePenalty: campaign.policy?.cost_scoring?.max_rate_penalty ?? 10,
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
