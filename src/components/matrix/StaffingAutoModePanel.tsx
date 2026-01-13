import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { Play, Pause, Square, Zap } from 'lucide-react'

interface StaffingAutoModePanelProps {
  campaign: any
  campaignRoles: any[]
  onStatusChange?: () => void
}

export const StaffingAutoModePanel: React.FC<StaffingAutoModePanelProps> = ({
  campaign,
  campaignRoles,
  onStatusChange
}) => {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showEscalationWarning, setShowEscalationWarning] = useState(false)

  const getToken = async () => {
    const token = (await supabase.auth.getSession()).data.session?.access_token
    if (!token) throw new Error('Not authenticated')
    return token
  }

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['staffing_campaign', campaign.job_id, campaign.department] })
    queryClient.invalidateQueries({ queryKey: ['staffing_campaign_roles', campaign.id] })
    onStatusChange?.()
  }

  const pauseMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken()
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/staffing-orchestrator?action=pause`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ campaign_id: campaign.id })
        }
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'Failed to pause')
      return payload
    },
    onSuccess: () => {
      toast({ title: 'Campaign paused' })
      invalidateAll()
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  })

  const resumeMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken()
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/staffing-orchestrator?action=resume`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ campaign_id: campaign.id })
        }
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'Failed to resume')
      return payload
    },
    onSuccess: () => {
      toast({ title: 'Campaign resumed' })
      invalidateAll()
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  })

  const nudgeMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken()
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/staffing-orchestrator?action=nudge`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ campaign_id: campaign.id })
        }
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'Failed to nudge')
      return payload
    },
    onSuccess: () => {
      toast({ title: 'Campaign nudged', description: 'Next tick scheduled immediately' })
      invalidateAll()
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  })

  const stopMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken()
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/staffing-orchestrator?action=stop`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ campaign_id: campaign.id })
        }
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'Failed to stop')
      return payload
    },
    onSuccess: () => {
      toast({ title: 'Campaign stopped' })
      invalidateAll()
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  })

  // Escalate mutation
  const escalateMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken()
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/staffing-orchestrator?action=escalate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ campaign_id: campaign.id })
        }
      )
      if (!response.ok) throw new Error('Failed to escalate')
      return response.json()
    },
    onSuccess: () => {
      toast({ title: 'Campaign escalated', description: 'Next escalation step activated' })
      setShowEscalationWarning(false)
      invalidateAll()
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'filled':
        return '✓'
      case 'offer':
        return '💌'
      case 'availability':
        return '❓'
      case 'escalating':
        return '🔼'
      default:
        return '⏸'
    }
  }

  const calculateProgress = () => {
    if (!campaignRoles || campaignRoles.length === 0) return 0
    const filledRoles = campaignRoles.filter((r: any) => r.stage === 'filled').length
    return Math.round((filledRoles / campaignRoles.length) * 100)
  }

  const progress = calculateProgress()

  return (
    <div className="space-y-4">
      {/* Main status card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Auto Mode Campaign</CardTitle>
              <CardDescription>System-driven staffing automation</CardDescription>
            </div>
            <div className="text-right">
              <Badge className="mb-2 block bg-blue-100 text-blue-800">
                {campaign.status.toUpperCase()}
              </Badge>
              <p className="text-sm text-gray-600">{progress}% Filled</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progress bar */}
          <div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  progress === 100 ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {campaignRoles?.filter((r: any) => r.stage === 'filled').length || 0} of{' '}
              {campaignRoles?.length || 0} roles filled
            </p>
          </div>

          {/* Campaign info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Next Tick</p>
              <p className="font-medium">
                {campaign.next_run_at ? format(new Date(campaign.next_run_at), 'HH:mm') : 'Paused'}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Last Tick</p>
              <p className="font-medium">
                {campaign.last_run_at
                  ? format(new Date(campaign.last_run_at), 'HH:mm:ss')
                  : 'Never'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role status grid */}
      {campaignRoles && campaignRoles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Role Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {campaignRoles.map((role: any) => (
                <div
                  key={role.id}
                  className="p-3 bg-gray-50 rounded border border-gray-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getStageIcon(role.stage)}</span>
                      <p className="font-semibold text-sm">{role.role_code}</p>
                    </div>
                    <Badge
                      className={`text-xs ${
                        role.stage === 'filled'
                          ? 'bg-green-100 text-green-800'
                          : role.stage === 'offer'
                            ? 'bg-blue-100 text-blue-800'
                            : role.stage === 'availability'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {role.stage}
                    </Badge>
                  </div>

                  {/* Counters */}
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="bg-white p-1 rounded text-center">
                      <p className="text-gray-600">Assigned</p>
                      <p className="font-bold">{role.assigned_count}</p>
                    </div>
                    <div className="bg-white p-1 rounded text-center">
                      <p className="text-gray-600">Avail ✓</p>
                      <p className="font-bold">{role.confirmed_availability}</p>
                    </div>
                    <div className="bg-white p-1 rounded text-center">
                      <p className="text-gray-600">Offers ⧐</p>
                      <p className="font-bold">{role.pending_offers}</p>
                    </div>
                    <div className="bg-white p-1 rounded text-center">
                      <p className="text-gray-600">Accept ✓</p>
                      <p className="font-bold">{role.accepted_offers}</p>
                    </div>
                  </div>

                  {/* Last wave info */}
                  {role.last_wave_at && (
                    <p className="text-xs text-gray-500 mt-2">
                      Wave {role.wave_number} at {format(new Date(role.last_wave_at), 'HH:mm')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2 flex-wrap">
            {campaign.status === 'active' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    pauseMutation.mutate()
                  }}
                  disabled={pauseMutation.isPending}
                  className="gap-2"
                >
                  <Pause size={16} />
                  Pause
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    nudgeMutation.mutate()
                  }}
                  disabled={nudgeMutation.isPending}
                  className="gap-2"
                >
                  <Zap size={16} />
                  Next Tick Now
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowEscalationWarning(true)}
                  className="gap-2"
                >
                  🔼 Escalate
                </Button>
              </>
            )}

            {campaign.status === 'paused' && (
              <Button
                size="sm"
                onClick={() => {
                  resumeMutation.mutate()
                }}
                disabled={resumeMutation.isPending}
                className="gap-2"
              >
                <Play size={16} />
                Resume
              </Button>
            )}

            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                stopMutation.mutate()
              }}
              disabled={stopMutation.isPending}
              className="gap-2 ml-auto"
            >
              <Square size={16} />
              Stop
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Escalation warning dialog */}
      {showEscalationWarning && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-base text-orange-900">Escalation Warning</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-orange-800">
              Escalation may include fridge techs or allow soft conflicts. This is irreversible for this campaign.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowEscalationWarning(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-orange-600 hover:bg-orange-700"
                onClick={() => escalateMutation.mutate()}
                disabled={escalateMutation.isPending}
              >
                {escalateMutation.isPending ? 'Escalating...' : 'Confirm Escalation'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
