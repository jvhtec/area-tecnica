import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'

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

export const StaffingCampaignPanel: React.FC<StaffingCampaignPanelProps> = ({
  jobId,
  department,
  jobTitle,
  onClose
}) => {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showStartDialog, setShowStartDialog] = useState(false)
  const [formData, setFormData] = useState({
    mode: 'assisted' as 'assisted' | 'auto',
    scope: 'outstanding' as 'outstanding' | 'all',
    proximityWeight: 0.1,
    historyWeight: 0.2, // Will be mapped to reliability
    softConflictPolicy: 'block' as 'warn' | 'block' | 'allow',
    excludeFridge: true,
    availabilityTtl: 24,
    offerTtl: 4,
    offerMessage: '',
    tickInterval: 300
  })

  // Fetch active campaign for this job+department
  const { data: campaign } = useQuery({
    queryKey: ['staffing_campaign', jobId, department],
    queryFn: async () => {
      const { data } = await supabase
        .from('staffing_campaigns')
        .select('*')
        .eq('job_id', jobId)
        .eq('department', department)
        .maybeSingle()
      return data as Campaign | null
    }
  })

  // Initialize formData from active campaign
  useEffect(() => {
    if (campaign) {
      setFormData({
        mode: campaign.mode,
        scope: 'outstanding',
        proximityWeight: campaign.policy?.weights?.proximity ?? 0.1,
        historyWeight: campaign.policy?.weights?.reliability ?? 0.2,
        softConflictPolicy: campaign.policy?.soft_conflict_policy ?? 'block',
        excludeFridge: campaign.policy?.exclude_fridge ?? true,
        availabilityTtl: campaign.policy?.availability_ttl_hours ?? 24,
        offerTtl: campaign.policy?.offer_ttl_hours ?? 4,
        offerMessage: campaign.offer_message ?? '',
        tickInterval: campaign.policy?.tick_interval_seconds ?? 300
      })
    }
  }, [campaign])

  // Fetch campaign roles if campaign exists
  const { data: campaignRoles } = useQuery({
    queryKey: ['staffing_campaign_roles', campaign?.id],
    queryFn: async () => {
      if (!campaign?.id) return []
      const { data } = await supabase
        .from('staffing_campaign_roles')
        .select('*')
        .eq('campaign_id', campaign.id)
        .order('role_code')
      return (data || []) as CampaignRole[]
    },
    enabled: !!campaign?.id
  })

  // Start campaign mutation
  const startMutation = useMutation({
    mutationFn: async () => {
      const policy = {
        weights: {
          skills: 0.5,
          proximity: formData.proximityWeight,
          reliability: formData.historyWeight,
          fairness: 0.1,
          experience: 0.1
        },
        availability_ttl_hours: formData.availabilityTtl,
        offer_ttl_hours: formData.offerTtl,
        availability_multiplier: 4,
        offer_buffer: 1,
        exclude_fridge: formData.excludeFridge,
        soft_conflict_policy: formData.softConflictPolicy,
        tick_interval_seconds: formData.tickInterval,
        escalation_steps: ['increase_wave', 'include_fridge', 'allow_soft_conflicts']
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/staffing-orchestrator?action=start`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
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
      queryClient.invalidateQueries({ queryKey: ['staffing_campaign', jobId, department] })
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
      const policy = {
        weights: {
          skills: 0.5,
          proximity: formData.proximityWeight,
          reliability: formData.historyWeight,
          fairness: 0.1,
          experience: 0.1
        },
        availability_ttl_hours: formData.availabilityTtl,
        offer_ttl_hours: formData.offerTtl,
        availability_multiplier: 4,
        offer_buffer: 1,
        exclude_fridge: formData.excludeFridge,
        soft_conflict_policy: formData.softConflictPolicy,
        tick_interval_seconds: formData.tickInterval,
        escalation_steps: ['increase_wave', 'include_fridge', 'allow_soft_conflicts']
      }

      const nextRunUpdate = formData.mode === 'auto' && campaign?.mode === 'assisted'
        ? { next_run_at: new Date().toISOString() }
        : {}

      const { data, error } = await supabase
        .from('staffing_campaigns')
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
      return data
    },
    onSuccess: () => {
      toast({ title: 'Settings updated' })
      queryClient.invalidateQueries({ queryKey: ['staffing_campaign', jobId, department] })
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
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({ campaign_id: campaign?.id })
        }
      )
      if (!response.ok) throw new Error('Failed to pause campaign')
      return response.json()
    },
    onSuccess: () => {
      toast({ title: 'Campaign paused' })
      queryClient.invalidateQueries({ queryKey: ['staffing_campaign', jobId, department] })
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
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({ campaign_id: campaign?.id })
        }
      )
      if (!response.ok) throw new Error('Failed to resume campaign')
      return response.json()
    },
    onSuccess: () => {
      toast({ title: 'Campaign resumed' })
      queryClient.invalidateQueries({ queryKey: ['staffing_campaign', jobId, department] })
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
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({ campaign_id: campaign?.id })
        }
      )
      if (!response.ok) throw new Error('Failed to stop campaign')
      return response.json()
    },
    onSuccess: () => {
      toast({ title: 'Campaign stopped' })
      queryClient.invalidateQueries({ queryKey: ['staffing_campaign', jobId, department] })
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
            <DialogContent className="max-w-2xl">
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
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="mode"
                        value="assisted"
                        checked={formData.mode === 'assisted'}
                        onChange={() => setFormData({ ...formData, mode: 'assisted' })}
                      />
                      <span className="text-sm">Assisted (Manager-controlled)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="mode"
                        value="auto"
                        checked={formData.mode === 'auto'}
                        onChange={() => setFormData({ ...formData, mode: 'auto' })}
                      />
                      <span className="text-sm">Auto (System-driven)</span>
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

                {/* Conflict policy */}
                <div>
                  <label className="text-sm font-medium">Soft Conflict Policy</label>
                  <select
                    value={formData.softConflictPolicy}
                    onChange={(e) => setFormData({ ...formData, softConflictPolicy: e.target.value as any })}
                    className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
                  >
                    <option value="block">Block (Auto mode default)</option>
                    <option value="warn">Warn (Assisted mode)</option>
                    <option value="allow">Allow (Escalation only)</option>
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
            <p className="font-medium">{campaign.mode === 'assisted' ? 'Assisted' : 'Automatic'}</p>
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
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="active_mode"
                    value="assisted"
                    checked={formData.mode === 'assisted'}
                    onChange={() => setFormData({ ...formData, mode: 'assisted' })}
                  />
                  <span className="text-sm">Assisted (Manager-controlled)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="active_mode"
                    value="auto"
                    checked={formData.mode === 'auto'}
                    onChange={() => setFormData({ ...formData, mode: 'auto' })}
                  />
                  <span className="text-sm">Auto (System-driven)</span>
                </label>
              </div>
            </div>

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

            {/* Conflict policy */}
            <div>
              <label className="text-sm font-medium">Soft Conflict Policy</label>
              <select
                value={formData.softConflictPolicy}
                onChange={(e) => setFormData({ ...formData, softConflictPolicy: e.target.value as any })}
                className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
              >
                <option value="block">Block (Auto mode default)</option>
                <option value="warn">Warn (Assisted mode)</option>
                <option value="allow">Allow (Escalation only)</option>
              </select>
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
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
