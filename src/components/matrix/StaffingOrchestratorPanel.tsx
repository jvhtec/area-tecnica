import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { dataLayerClient } from '@/services/dataLayerClient';
import { StaffingCampaignPanel } from './StaffingCampaignPanel'
import { StaffingCandidateList } from './StaffingCandidateList'
import { StaffingOfferList } from './StaffingOfferList'
import { StaffingAutoModePanel } from './StaffingAutoModePanel'
import { parseSummaryRow } from '@/pages/job-assignment-matrix/utils'
import {
  useStaffingCampaignRealtime,
  useStaffingCampaignRolesRealtime,
  useStaffingRequestsRealtime
} from '@/hooks/useStaffingCampaignRealtime'


import { queryKeys } from "@/lib/react-query";
interface StaffingOrchestratorPanelProps {
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
  stage: string
}

export const StaffingOrchestratorPanel: React.FC<StaffingOrchestratorPanelProps> = ({
  jobId,
  department,
  jobTitle,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<string>('overview')

  // Enable realtime subscriptions
  useStaffingCampaignRealtime(jobId, department)

  // Fetch active campaign
  const { data: campaign, refetch: refetchCampaign } = useQuery({
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

  // Enable realtime for roles if campaign exists
  useStaffingCampaignRolesRealtime(campaign?.id)
  useStaffingRequestsRealtime(jobId)

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

  const { data: requiredRoleSummary } = useQuery({
    queryKey: queryKeys.scope('staffing_required_roles', jobId, department),
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from('job_required_roles_summary')
        .select('job_id, department, roles')
        .eq('job_id', jobId)
        .eq('department', department)
        .maybeSingle()

      if (error) throw error
      return parseSummaryRow(data)
    }
  })

  const requiredByRole = useMemo(() => {
    return new Map(
      (requiredRoleSummary?.roles || []).map((role) => [role.role_code, role.quantity])
    )
  }, [requiredRoleSummary])

  const getRequiredCount = (roleCode: string) => requiredByRole.get(roleCode) ?? 0

  if (!campaign) {
    return (
      <StaffingCampaignPanel
        jobId={jobId}
        department={department}
        jobTitle={jobTitle}
        onClose={onClose}
      />
    )
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="candidates">Candidates</TabsTrigger>
        <TabsTrigger value="offers">Offers</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>

      {/* Overview tab */}
      <TabsContent value="overview" className="space-y-4">
        {campaign.mode === 'assisted' ? (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <h3 className="font-semibold text-sm mb-2">Campaign Status</h3>
                <p className="text-sm text-gray-600">
                  {campaign.status === 'active'
                    ? 'Campaign is running and awaiting your actions. Select candidates from the Candidates tab to send availability requests.'
                    : campaign.status === 'paused'
                      ? 'Campaign is paused. Resume from the Settings tab.'
                      : campaign.status === 'completed'
                        ? 'Campaign completed - all roles filled!'
                        : campaign.status === 'stopped'
                          ? 'Campaign has been stopped.'
                          : 'Campaign encountered an error.'}
                </p>
              </div>

              {campaignRoles && campaignRoles.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Roles to Fill</h3>
                  <div className="space-y-1 text-sm">
                    {campaignRoles.map((role) => {
                      const requiredCount = getRequiredCount(role.role_code)
                      const assignedCount = Number(role.assigned_count || 0)

                      return (
                        <div
                          key={role.id}
                          className="flex flex-wrap justify-between items-center gap-2 py-1"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-gray-700">{role.role_code}</span>
                            <Badge variant="outline">Required {requiredCount}</Badge>
                          </div>
                          <span className="text-gray-600">
                            {role.stage === 'filled' ? (
                              <span className="text-green-600 font-semibold">✓ Filled</span>
                            ) : (
                              <span>
                                {assignedCount}/{requiredCount || '—'} assigned
                                {role.confirmed_availability > 0 &&
                                  ` • ${role.confirmed_availability} confirmed`}
                              </span>
                            )}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {campaign.offer_message && (
                <div className="bg-blue-50 p-3 rounded border border-blue-200">
                  <p className="text-xs font-semibold text-blue-900 mb-1">Message to Candidates</p>
                  <p className="text-sm text-blue-900 italic">"{campaign.offer_message}"</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <StaffingAutoModePanel
            campaign={campaign}
            campaignRoles={campaignRoles || []}
            requiredByRole={requiredByRole}
            onStatusChange={() => refetchCampaign()}
          />
        )}
      </TabsContent>

      {/* Candidates tab - Assisted mode only */}
      {campaign.mode === 'assisted' && (
        <TabsContent value="candidates" className="space-y-4">
          {campaignRoles && campaignRoles.length > 0 ? (
            <div className="space-y-4">
              {campaignRoles
                .filter((r) => r.stage !== 'filled')
                .map((role) => (
                  <StaffingCandidateList
                    key={role.id}
                    campaignId={campaign.id}
                    roleCode={role.role_code}
                    jobId={jobId}
                    department={department}
                    policy={campaign.policy}
                    requiredCount={getRequiredCount(role.role_code)}
                    assignedCount={Number(role.assigned_count || 0)}
                    confirmedAvailability={Number(role.confirmed_availability || 0)}
                    pendingAvailability={Number(role.pending_availability || 0)}
                  />
                ))}
              {campaignRoles.every((r) => r.stage === 'filled') && (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-center text-gray-600">
                      All roles are filled! 🎉
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-gray-500">No roles configured for this campaign.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      )}

      {/* Offers tab - Assisted mode only */}
      {campaign.mode === 'assisted' && (
        <TabsContent value="offers" className="space-y-4">
          {campaignRoles && campaignRoles.length > 0 ? (
            <div className="space-y-4">
              {campaignRoles.map((role) => (
                <StaffingOfferList
                  key={role.id}
                  campaignId={campaign.id}
                  roleCode={role.role_code}
                  jobId={jobId}
                  department={department}
                  offerMessage={campaign.offer_message}
                  requiredCount={getRequiredCount(role.role_code)}
                  assignedCount={Number(role.assigned_count || 0)}
                  confirmedAvailability={Number(role.confirmed_availability || 0)}
                  pendingAvailability={Number(role.pending_availability || 0)}
                  acceptedOffers={Number(role.accepted_offers || 0)}
                  pendingOffers={Number(role.pending_offers || 0)}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-gray-500">No roles configured for this campaign.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      )}

      {/* Settings tab */}
      <TabsContent value="settings" className="space-y-4">
        <StaffingCampaignPanel
          jobId={jobId}
          department={department}
          jobTitle={jobTitle}
          onClose={onClose}
        />
      </TabsContent>
    </Tabs>
  )
}
