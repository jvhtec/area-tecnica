import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { dataLayerClient } from '@/services/dataLayerClient';
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { Mail, MessageCircle } from 'lucide-react'


import { queryKeys } from "@/lib/react-query";
interface StaffingOfferListProps {
  campaignId: string
  roleCode: string
  jobId: string
  department: string
  offerMessage?: string
  requiredCount?: number
  assignedCount?: number
  confirmedAvailability?: number
  pendingAvailability?: number
  acceptedOffers?: number
  pendingOffers?: number
}

type StaffingChannel = 'email' | 'whatsapp'

interface AvailabilityResponse {
  profile_id: string
  full_name: string
  status: 'confirmed' | 'declined' | 'pending'
  responded_at?: string | null
}

export const StaffingOfferList: React.FC<StaffingOfferListProps> = ({
  campaignId,
  roleCode,
  jobId,
  department,
  offerMessage,
  requiredCount = 0,
  assignedCount = 0,
  confirmedAvailability = 0,
  pendingAvailability = 0,
  acceptedOffers = 0,
  pendingOffers = 0
}) => {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedForOffer, setSelectedForOffer] = useState<Set<string>>(new Set())
  const [channel, setChannel] = useState<StaffingChannel>('email')

  // Availability responses are job-scoped, but the original send event carries
  // manager intent for which role card should display the response.
  const { data: responses, isLoading } = useQuery({
    queryKey: queryKeys.scope('staffing_availability_responses', jobId, roleCode),
    queryFn: async () => {
      const { data: directRequests, error: directError } = await dataLayerClient.from('staffing_requests')
        .select('id, profile_id, status, created_at, updated_at')
        .eq('job_id', jobId)
        .eq('phase', 'availability')
        .order('updated_at', { ascending: false })

      if (directError) throw directError

      const requestRows = directRequests || []
      const requestIds = requestRows.map((item: any) => item.id).filter(Boolean)
      if (requestIds.length === 0) return []

      const { data: sentEvents, error: sentEventsError } = await dataLayerClient.from('staffing_events')
        .select('staffing_request_id, event, meta, created_at')
        .in('staffing_request_id', requestIds)
        .in('event', ['email_sent', 'whatsapp_sent'])
        .order('created_at', { ascending: false })

      if (sentEventsError) throw sentEventsError

      const latestAvailabilityRoleByRequestId = new Map<string, string>()
      ;[...(sentEvents || [])]
        .sort((a: any, b: any) => (
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        ))
        .forEach((event: any) => {
        const requestId = String(event.staffing_request_id || '')
        const meta = event?.meta || {}
        if (!requestId || latestAvailabilityRoleByRequestId.has(requestId)) return
        if (meta.phase !== 'availability' || !meta.role) return
        latestAvailabilityRoleByRequestId.set(requestId, String(meta.role))
      })

      const latestRequestByProfileId = new Map<string, any>()
      requestRows.forEach((item: any) => {
        if (latestAvailabilityRoleByRequestId.get(String(item.id)) !== roleCode) return
        const profileId = String(item.profile_id || '')
        if (!profileId || latestRequestByProfileId.has(profileId)) return
        latestRequestByProfileId.set(profileId, item)
      })

      const profileIds = Array.from(latestRequestByProfileId.keys())
      if (profileIds.length === 0) return []

      const { data: profiles, error: profilesError } = await dataLayerClient.from('profiles')
        .select('id, first_name, last_name, nickname, email')
        .in('id', profileIds)

      if (profilesError) throw profilesError

      const profilesById = new Map(
        (profiles || []).map((profile: any) => [String(profile.id), profile])
      )

      return Array.from(latestRequestByProfileId.entries()).map(([profileId, item]) => {
        const profile: any = profilesById.get(profileId) || {}
        const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
        const respondedAt =
          item.status && String(item.status).toLowerCase() !== 'pending'
            ? (item.updated_at || item.created_at)
            : null

        return {
          profile_id: profileId,
          full_name: fullName || profile.nickname || profile.email || 'Unknown',
          status: item.status,
          responded_at: respondedAt,
        } as AvailabilityResponse
      })
    }
  })

  // Send offers mutation
  const sendOffersMutation = useMutation({
    mutationFn: async () => {
      const selectedProfiles = Array.from(selectedForOffer)
      if (selectedProfiles.length === 0) {
        throw new Error('Select at least one candidate')
      }

      const token = (await dataLayerClient.auth.getSession()).data.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const sendOne = async (profileId: string) => {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-staffing-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              job_id: jobId,
              profile_id: profileId,
              phase: 'offer',
              role: roleCode,
              message: offerMessage || null,
              channel,
              idempotency_key: `campaign:${campaignId}:${roleCode}:${profileId}:offer:${channel}`
            })
          }
        )

        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to send offer')
        }
        return payload
      }

      const results = await Promise.allSettled(selectedProfiles.map(sendOne))
      const failed = results.filter((r) => r.status === 'rejected')

      if (failed.length > 0) {
        throw new Error(`Failed to send ${failed.length}/${selectedProfiles.length} offers`)
      }

      return { sent: selectedProfiles.length }
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Offers sent',
        description: `Sent offers to ${data?.sent ?? selectedForOffer.size} candidates by ${channel}`
      })
      setSelectedForOffer(new Set())
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('staffing_availability_responses', jobId, roleCode) })
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('staffing_availability_responses', jobId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('staffing_requests', jobId) })
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  const confirmedResponses = responses?.filter((r: any) => r.status === 'confirmed') || []
  const declinedResponses = responses?.filter((r: any) => r.status === 'declined') || []
  const pendingResponses = responses?.filter((r: any) => r.status === 'pending') || []
  const hasResponseRows = Boolean(responses && responses.length > 0)
  const displayedConfirmedAvailability = hasResponseRows ? confirmedResponses.length : confirmedAvailability
  const displayedPendingAvailability = hasResponseRows ? pendingResponses.length : pendingAvailability
  const displayedDeclinedAvailability = hasResponseRows ? declinedResponses.length : 0

  const statusSummary = (
    <div className="flex flex-wrap gap-2 pt-2">
      <Badge variant="outline">Required {requiredCount}</Badge>
      <Badge variant="secondary">{assignedCount}/{requiredCount || '—'} assigned</Badge>
      <Badge variant="outline">Availability: {displayedConfirmedAvailability} yes</Badge>
      <Badge variant="outline">{displayedPendingAvailability} pending</Badge>
      <Badge variant="outline">{displayedDeclinedAvailability} no</Badge>
      {(acceptedOffers > 0 || pendingOffers > 0) && (
        <Badge variant="outline">Offers: {acceptedOffers} accepted / {pendingOffers} pending</Badge>
      )}
    </div>
  )

  const toggleForOffer = (profileId: string) => {
    const newSelected = new Set(selectedForOffer)
    if (newSelected.has(profileId)) {
      newSelected.delete(profileId)
    } else {
      newSelected.add(profileId)
    }
    setSelectedForOffer(newSelected)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          {statusSummary}
          <p className="text-gray-500">Loading responses...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{roleCode} - Availability Responses</CardTitle>
        <CardDescription>
          Manage offers for candidates who confirmed availability
        </CardDescription>
        {statusSummary}
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded border bg-background p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            {channel === 'whatsapp' ? <MessageCircle size={16} /> : <Mail size={16} />}
            Send offers by
          </div>
          <Select value={channel} onValueChange={(value) => setChannel(value as StaffingChannel)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Confirmed responses */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Badge className="bg-green-100 text-green-800">✓ Yes</Badge>
            <span className="text-sm font-medium">
              {confirmedResponses.length} confirmed
            </span>
          </div>

          {confirmedResponses.length > 0 ? (
            <div className="space-y-2 bg-green-50 p-3 rounded border border-green-200">
              {confirmedResponses.map((response: any) => (
                <label
                  key={response.profile_id}
                  className="flex items-center gap-3 p-2 bg-white rounded hover:bg-green-50 cursor-pointer"
                >
                  <Checkbox
                    aria-label={`Select ${response.full_name} for offer`}
                    checked={selectedForOffer.has(response.profile_id)}
                    onCheckedChange={() => toggleForOffer(response.profile_id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-sm">{response.full_name}</p>
                      <Badge className="bg-green-100 text-green-800">Availability yes</Badge>
                      <Badge variant="outline">Job availability</Badge>
                    </div>
                    <p className="text-xs text-gray-600">
                      {response.responded_at
                        ? format(new Date(response.responded_at), 'PPp')
                        : 'No response time'}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">No confirmations yet</p>
          )}
        </div>

        {/* Pending responses */}
        {pendingResponses.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-yellow-100 text-yellow-800">⏳ Waiting</Badge>
              <span className="text-sm font-medium">
                {pendingResponses.length} pending
              </span>
            </div>
            <div className="space-y-2 bg-yellow-50 p-3 rounded border border-yellow-200">
              {pendingResponses.map((response: any) => (
                <div
                  key={response.profile_id}
                  className="flex items-center justify-between p-2 bg-white rounded"
                >
                  <p className="text-sm font-medium">{response.full_name}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">Job availability</Badge>
                    <Badge className="bg-yellow-100 text-yellow-800">Availability pending</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Declined responses */}
        {declinedResponses.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-red-100 text-red-800">✗ No</Badge>
              <span className="text-sm font-medium">
                {declinedResponses.length} declined
              </span>
            </div>
            <div className="space-y-2 bg-red-50 p-3 rounded border border-red-200">
              {declinedResponses.map((response: any) => (
                <div
                  key={response.profile_id}
                  className="flex items-center justify-between p-2 bg-white rounded"
                >
                  <p className="text-sm font-medium">{response.full_name}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">Job availability</Badge>
                    <Badge className="bg-red-100 text-red-800">Availability no</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Send offers button */}
        {confirmedResponses.length > 0 && (
          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={() => sendOffersMutation.mutate()}
              disabled={selectedForOffer.size === 0 || sendOffersMutation.isPending}
            >
              {sendOffersMutation.isPending
                ? 'Sending...'
                : `Send Offers (${selectedForOffer.size}) by ${channel === 'whatsapp' ? 'WhatsApp' : 'Email'}`}
            </Button>
            <p className="text-xs text-gray-600 self-center">
              First candidate to accept will be auto-assigned
            </p>
          </div>
        )}

        {/* Empty state */}
        {responses && responses.length === 0 && (
          <div className="text-center py-6">
            <p className="text-gray-500 text-sm">
              No availability requests sent yet. Start by sending availability requests from the candidate list.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
