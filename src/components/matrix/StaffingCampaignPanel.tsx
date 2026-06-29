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
  policy: any
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
}

interface RequiredRole {
  role_code: string
  quantity: number
}

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
  const [formData, setFormData] = useState({
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
      return data as Campaign | null
    }
  })

  const { data: jobMeta } = useQuery({
    queryKey: queryKeys.scope('staffing_job_meta', jobId),
    queryFn: async () => {
      const { data } = await dataLayerClient.from('jobs')
        .select('id, title, job_type, start_time, end_time')
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
        (acc, [roleCode, profile]: [string, any]) => {
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
        ratePenaltyStrength: (campaign.policy?.cost_scoring?.penalty_strength ?? 'normal') as RatePenaltyStrength,
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
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
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
    onError: (error: any) => {
      toast({
        title: 'Error updating settings',
        description: error.message,
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

  const renderCrewingProfileSettings = () => (
    <div className="space-y-4 rounded border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Perfil automático</p>
          <p className="text-xs text-muted-foreground">
            Tipo de trabajo {jobMeta?.job_type || 'single'}: perfil sugerido {JOB_PROFILE_LABELS[inferredJobProfile]}.
          </p>
        </div>
        {profileOverrideActive && (
          <Badge variant="outline">Perfil manual activo</Badge>
        )}
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={formData.inferProfileFromJobType}
          onChange={(e) => setFormData({ ...formData, inferProfileFromJobType: e.target.checked })}
        />
        <span className="text-sm">Inferir perfil por tipo de trabajo y rol</span>
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Perfil de trabajo sugerido</label>
          <div className="mt-1 rounded border bg-background px-2 py-1 text-sm">
            {JOB_PROFILE_LABELS[inferredJobProfile]}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Perfil de trabajo seleccionado</label>
          <select
            value={formData.selectedJobProfile}
            onChange={(e) => applyProfileDefaults(e.target.value as JobProfileName)}
            className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
          >
            {PROFILE_OPTIONS.map((profile) => (
              <option key={profile} value={profile}>{JOB_PROFILE_LABELS[profile]}</option>
            ))}
          </select>
        </div>
      </div>

      {profileOverrideActive && (
        <div>
          <label className="text-sm font-medium">Motivo del cambio</label>
          <input
            value={formData.profileOverrideReason}
            onChange={(e) => setFormData({ ...formData, profileOverrideReason: e.target.value })}
            placeholder="Por qué esta campaña debe usar otro perfil"
            className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
          />
        </div>
      )}

      {roleCodes.length > 0 && (
        <div>
          <p className="text-sm font-medium">Perfiles por rol</p>
          <div className="mt-2 space-y-2">
            {roleCodes.map((roleCode) => {
              const roleProfile = roleProfiles[roleCode]
              if (!roleProfile) return null

              return (
                <div key={roleCode} className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-2 items-center rounded border bg-background p-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{roleCode}</span>
                      <Badge variant="outline">Requeridos {roleProfile.required_count}</Badge>
                      {roleProfile.is_critical && <Badge variant="secondary">Crítico</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Sugerido: {JOB_PROFILE_LABELS[roleProfile.inferred_profile]}
                    </p>
                  </div>
                  <select
                    value={roleProfile.selected_profile}
                    onChange={(e) => updateRoleProfileOverride(roleCode, e.target.value as JobProfileName)}
                    className="w-full px-2 py-1 border rounded text-sm bg-background"
                  >
                    {PROFILE_OPTIONS.map((profile) => (
                      <option key={profile} value={profile}>{JOB_PROFILE_LABELS[profile]}</option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="rounded border bg-background p-3">
        <p className="text-sm font-medium">Pesos del perfil</p>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
          <span>Habilidad de rol: {selectedProfileDefaults.weights.roleSkill.toFixed(2)}</span>
          <span>Fiabilidad: {formData.historyWeight.toFixed(2)}</span>
          <span>Equidad: {selectedProfileDefaults.weights.fairness.toFixed(2)}</span>
          <span>Proximidad: {formData.proximityWeight.toFixed(2)}</span>
          <span>Coste: {selectedProfileDefaults.weights.costEfficiency.toFixed(2)}</span>
          <span>Técnico de casa: {selectedProfileDefaults.weights.houseTechBonus.toFixed(2)}</span>
          <span>Progresión: {selectedProfileDefaults.weights.roleProgression.toFixed(2)}</span>
          <span>Disponibilidad: {selectedProfileDefaults.weights.availabilityConfidence.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )

  const renderCostAndWaveSettings = () => (
    <div className="space-y-4 rounded border bg-muted/30 p-3">
      <p className="text-sm font-semibold">Puntuación de coste/tarifa</p>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={formData.costScoringEnabled}
          onChange={(e) => setFormData({ ...formData, costScoringEnabled: e.target.checked })}
        />
        <span className="text-sm">Aplicar ajuste por tarifa personalizada</span>
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Intensidad de penalización de tarifa</label>
          <select
            value={formData.ratePenaltyStrength}
            onChange={(e) => setFormData({ ...formData, ratePenaltyStrength: e.target.value as RatePenaltyStrength })}
            className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
          >
            <option value="disabled">Desactivado</option>
            <option value="low">Baja</option>
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Penalización máxima de tarifa</label>
          <input
            type="number"
            min="0"
            max="20"
            value={formData.maxRatePenalty}
            onChange={(e) => setFormData({ ...formData, maxRatePenalty: parseFloat(e.target.value) })}
            className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
          />
        </div>
      </div>

      <p className="text-sm font-semibold pt-2">Oleadas de contacto</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Modo de oleada</label>
          <select
            value={formData.waveMode}
            onChange={(e) => setFormData({ ...formData, waveMode: e.target.value as WaveMode })}
            className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
          >
            <option value="manual_selection">Selección manual</option>
            <option value="controlled_waves">Oleadas controladas</option>
            <option value="blast_all_eligible">Contactar todos los elegibles</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Tamaño de oleada</label>
          <input
            type="number"
            min="0"
            max="20"
            value={formData.waveBuffer}
            onChange={(e) => setFormData({ ...formData, waveBuffer: parseInt(e.target.value) })}
            className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
          />
          <p className="text-xs text-muted-foreground mt-1">Requeridos + este margen</p>
        </div>
        <div>
          <label className="text-sm font-medium">Espera entre oleadas (minutos)</label>
          <input
            type="number"
            min="3"
            max="120"
            value={formData.waveWaitMinutes}
            onChange={(e) => setFormData({ ...formData, waveWaitMinutes: parseInt(e.target.value) })}
            className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Máximo de oleadas</label>
          <input
            type="number"
            min="1"
            max="10"
            value={formData.maxWaves}
            onChange={(e) => setFormData({ ...formData, maxWaves: parseInt(e.target.value) })}
            className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={formData.autoSendNextWave}
          onChange={(e) => setFormData({ ...formData, autoSendNextWave: e.target.checked })}
        />
        <span className="text-sm">Enviar siguiente oleada automáticamente con {CARLOS_AGENT_NAME}</span>
      </label>

      <div className="rounded border bg-background p-3 text-xs text-muted-foreground">
        Cierre automático activo: cierra roles completos, detiene futuras oleadas, bloquea aceptaciones extra, confirma el equipo reservado y avisa a respuestas tardías o pendientes.
      </div>
    </div>
  )

  if (!campaign) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Campaign Management</CardTitle>
          <CardDescription>
            {jobTitle ? `${jobTitle} - ${department}` : `${department} Department`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">No active campaign for this job.</p>
          <Button onClick={() => setShowStartDialog(true)}>Start Campaign</Button>

          <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Start Staffing Campaign</DialogTitle>
                <DialogDescription>
                  Configure campaign settings for {department} department
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Mode Selection */}
                <div>
                  <label className="text-sm font-medium">Mode</label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-4">
                    <label className="flex min-w-0 items-start gap-2 cursor-pointer">
                      <input
                        className="mt-1"
                        type="radio"
                        name="mode"
                        value="assisted"
                        checked={formData.mode === 'assisted'}
                        onChange={() => updateMode('assisted')}
                      />
                      <span className="text-sm">Assisted (Manager-controlled)</span>
                    </label>
                    <label className="flex min-w-0 items-start gap-2 cursor-pointer">
                      <input
                        className="mt-1"
                        type="radio"
                        name="mode"
                        value="auto"
                        checked={formData.mode === 'auto'}
                        onChange={() => updateMode('auto')}
                      />
                      <span className="text-sm leading-snug">{CARLOS_AUTO_MODE_LABEL}</span>
                    </label>
                  </div>
                </div>

                {/* Scope Selection */}
                <div>
                  <label className="text-sm font-medium">Scope</label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="scope"
                        value="outstanding"
                        checked={formData.scope === 'outstanding'}
                        onChange={() => setFormData({ ...formData, scope: 'outstanding' })}
                      />
                      <span className="text-sm">Outstanding roles only</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="scope"
                        value="all"
                        checked={formData.scope === 'all'}
                        onChange={() => setFormData({ ...formData, scope: 'all' })}
                      />
                      <span className="text-sm">All required roles</span>
                    </label>
                  </div>
                </div>

                {renderCrewingProfileSettings()}

                {/* Weights */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Proximity Weight</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="0.3"
                      value={formData.proximityWeight}
                      onChange={(e) => setFormData({ ...formData, proximityWeight: parseFloat(e.target.value) })}
                      className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">History Weight</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.15"
                      max="0.4"
                      value={formData.historyWeight}
                      onChange={(e) => setFormData({ ...formData, historyWeight: parseFloat(e.target.value) })}
                      className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
                    />
                  </div>
                </div>

                {/* TTLs */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Availability TTL (hours)</label>
                    <input
                      type="number"
                      min="1"
                      max="72"
                      value={formData.availabilityTtl}
                      onChange={(e) => setFormData({ ...formData, availabilityTtl: parseInt(e.target.value) })}
                      className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Offer TTL (hours)</label>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={formData.offerTtl}
                      onChange={(e) => setFormData({ ...formData, offerTtl: parseInt(e.target.value) })}
                      className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
                    />
                  </div>
                </div>

                {renderCostAndWaveSettings()}

                {/* Conflict policy */}
                <div>
                  <label className="text-sm font-medium">Soft Conflict Policy</label>
                  <select
                    value={formData.softConflictPolicy}
                    onChange={(e) => setFormData({ ...formData, softConflictPolicy: e.target.value as any })}
                    className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
                  >
                    <option value="block">Bloquear (predeterminado de {CARLOS_AGENT_NAME})</option>
                    <option value="warn">Avisar (modo asistido)</option>
                    <option value="manager_approval">Aprobación de responsable</option>
                    <option value="ignore">Ignorar</option>
                    <option value="allow">Permitir (escalado heredado)</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Send Channel</label>
                  <select
                    value={formData.channel}
                    onChange={(e) => setFormData({ ...formData, channel: e.target.value as StaffingChannel })}
                    className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
                  >
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>

                {/* Fridge toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.excludeFridge}
                    onChange={(e) => setFormData({ ...formData, excludeFridge: e.target.checked })}
                  />
                  <span className="text-sm">Exclude fridge techs (check by default)</span>
                </label>

                {/* Offer message */}
                <div>
                  <label className="text-sm font-medium">Offer Message (optional)</label>
                  <textarea
                    value={formData.offerMessage}
                    onChange={(e) => setFormData({ ...formData, offerMessage: e.target.value })}
                    placeholder="Personal note to include in offer emails..."
                    className="w-full mt-1 px-2 py-1 border rounded text-sm h-20 bg-background"
                  />
                </div>

                {formData.mode === 'auto' && (
                  <div>
                    <label className="text-sm font-medium">Tick Interval (seconds)</label>
                    <input
                      type="number"
                      min="60"
                      max="3600"
                      step="60"
                      value={formData.tickInterval}
                      onChange={(e) => setFormData({ ...formData, tickInterval: parseInt(e.target.value) })}
                      className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowStartDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
                  {startMutation.isPending ? 'Starting...' : 'Start Campaign'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Active Campaign</CardTitle>
            <CardDescription>
              {jobTitle ? `${jobTitle} - ${department}` : `${department} Department`}
            </CardDescription>
          </div>
          <Badge className={getStatusColor(campaign.status)}>
            {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Campaign info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Mode</p>
            <p className="font-medium">{campaign.mode === 'assisted' ? 'Asistido' : CARLOS_AGENT_NAME}</p>
          </div>
          <div>
            <p className="text-gray-600">Created</p>
            <p className="font-medium">{format(new Date(campaign.created_at), 'PPp')}</p>
          </div>
          {campaign.last_run_at && (
            <div>
              <p className="text-gray-600">Last Run</p>
              <p className="font-medium">{format(new Date(campaign.last_run_at), 'PPp')}</p>
            </div>
          )}
          {campaign.next_run_at && (
            <div>
              <p className="text-gray-600">Next Run</p>
              <p className="font-medium">{format(new Date(campaign.next_run_at), 'PPp')}</p>
            </div>
          )}
        </div>

        {/* Roles status */}
        {campaignRoles && campaignRoles.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Role Progress</h4>
            <div className="space-y-2">
              {campaignRoles.map((role) => (
                <div key={role.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{role.role_code}</p>
                    <p className="text-xs text-gray-600">
                      Assigned: {role.assigned_count} | Availability: {role.confirmed_availability} | Offers: {role.accepted_offers}
                    </p>
                  </div>
                  <Badge className={getStageColor(role.stage)}>
                    {role.stage}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Editable Settings form */}
        <div className="border-t pt-4 space-y-6">
          <h4 className="text-sm font-semibold">Campaign Settings</h4>

          <div className="space-y-6">
            {/* Mode Selection */}
            <div>
              <label className="text-sm font-medium">Mode</label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-4">
                <label className="flex min-w-0 items-start gap-2 cursor-pointer">
                  <input
                    className="mt-1"
                    type="radio"
                    name="active_mode"
                    value="assisted"
                    checked={formData.mode === 'assisted'}
                    onChange={() => updateMode('assisted')}
                  />
                  <span className="text-sm">Assisted (Manager-controlled)</span>
                </label>
                <label className="flex min-w-0 items-start gap-2 cursor-pointer">
                  <input
                    className="mt-1"
                    type="radio"
                    name="active_mode"
                    value="auto"
                    checked={formData.mode === 'auto'}
                    onChange={() => updateMode('auto')}
                  />
                  <span className="text-sm leading-snug">{CARLOS_AUTO_MODE_LABEL}</span>
                </label>
              </div>
            </div>

            {renderCrewingProfileSettings()}

            {/* Weights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Proximity Weight</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="0.3"
                  value={formData.proximityWeight}
                  onChange={(e) => setFormData({ ...formData, proximityWeight: parseFloat(e.target.value) })}
                  className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">History Weight (Reliability)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="0.5"
                  value={formData.historyWeight}
                  onChange={(e) => setFormData({ ...formData, historyWeight: parseFloat(e.target.value) })}
                  className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
                />
              </div>
            </div>

            {/* TTLs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Availability TTL (hours)</label>
                <input
                  type="number"
                  min="1"
                  max="72"
                  value={formData.availabilityTtl}
                  onChange={(e) => setFormData({ ...formData, availabilityTtl: parseInt(e.target.value) })}
                  className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Offer TTL (hours)</label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={formData.offerTtl}
                  onChange={(e) => setFormData({ ...formData, offerTtl: parseInt(e.target.value) })}
                  className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
                />
              </div>
            </div>

            {renderCostAndWaveSettings()}

            {/* Conflict policy */}
            <div>
              <label className="text-sm font-medium">Soft Conflict Policy</label>
              <select
                value={formData.softConflictPolicy}
                onChange={(e) => setFormData({ ...formData, softConflictPolicy: e.target.value as any })}
                className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
              >
                <option value="block">Bloquear (predeterminado de {CARLOS_AGENT_NAME})</option>
                <option value="warn">Avisar (modo asistido)</option>
                <option value="manager_approval">Aprobación de responsable</option>
                <option value="ignore">Ignorar</option>
                <option value="allow">Permitir (escalado heredado)</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Send Channel</label>
              <select
                value={formData.channel}
                onChange={(e) => setFormData({ ...formData, channel: e.target.value as StaffingChannel })}
                className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
              >
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
              {campaign.mode === 'assisted' && formData.mode === 'auto' && (
                <p className="text-xs text-gray-600 mt-1">
                  {CARLOS_AGENT_NAME} usará respuestas existentes de disponibilidad y oferta en modo asistido antes de contactar nuevos candidatos.
                </p>
              )}
            </div>

            {/* Fridge toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.excludeFridge}
                onChange={(e) => setFormData({ ...formData, excludeFridge: e.target.checked })}
              />
              <span className="text-sm">Exclude fridge techs</span>
            </label>

            {/* Offer message */}
            <div>
              <label className="text-sm font-medium">Offer Message</label>
              <textarea
                value={formData.offerMessage}
                onChange={(e) => setFormData({ ...formData, offerMessage: e.target.value })}
                placeholder="Personal note to include in offer emails..."
                className="w-full mt-1 px-2 py-1 border rounded text-sm h-20 bg-background"
              />
            </div>

            {formData.mode === 'auto' && (
              <div>
                <label className="text-sm font-medium">Tick Interval (seconds)</label>
                <input
                  type="number"
                  min="60"
                  max="3600"
                  step="60"
                  value={formData.tickInterval}
                  onChange={(e) => setFormData({ ...formData, tickInterval: parseInt(e.target.value) })}
                  className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2 border-t pt-4">
          {campaign.status === 'active' ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => pauseMutation.mutate()}
                disabled={pauseMutation.isPending}
              >
                Pause
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => stopMutation.mutate()}
                disabled={stopMutation.isPending}
              >
                Stop
              </Button>
            </>
          ) : campaign.status === 'paused' ? (
            <>
              <Button
                size="sm"
                onClick={() => resumeMutation.mutate()}
                disabled={resumeMutation.isPending}
              >
                Resume
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => stopMutation.mutate()}
                disabled={stopMutation.isPending}
              >
                Stop
              </Button>
            </>
          ) : canResumeStaffingCampaign(campaign.status) ? (
            <Button
              size="sm"
              onClick={() => resumeMutation.mutate()}
              disabled={resumeMutation.isPending}
            >
              {staffingCampaignResumeLabel(campaign.status)}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
