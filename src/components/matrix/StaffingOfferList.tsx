import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'

interface StaffingOfferListProps {
  campaignId: string
  roleCode: string
  jobId: string
  department: string
  offerMessage?: string
}

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
  offerMessage
}) => {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedForOffer, setSelectedForOffer] = useState<Set<string>>(new Set())

  // Fetch availability responses for this role
  const { data: responses, isLoading } = useQuery({
    queryKey: ['staffing_availability_responses', jobId, roleCode],
    queryFn: async () => {
      // Role information is stored in staffing_events.meta.role (from send-staffing-email).
      const { data: sentEvents, error: sentError } = await supabase
        .from('staffing_events')
        .select('staffing_request_id')
        .in('event', ['email_sent', 'whatsapp_sent'])
        .contains('meta', { phase: 'availability', role: roleCode })
        .order('created_at', { ascending: false })
        .limit(500)

      if (sentError) throw sentError

      const requestIds = Array.from(
        new Set((sentEvents || []).map((e: any) => e.staffing_request_id).filter(Boolean))
      )

      if (requestIds.length === 0) return [] as AvailabilityResponse[]

      const { data, error } = await supabase
        .from('staffing_requests')
        .select('id, profile_id, status, created_at, updated_at, profiles(first_name,last_name,nickname)')
        .in('id', requestIds)
        .eq('job_id', jobId)
        .eq('phase', 'availability')
        .order('updated_at', { ascending: false })

      if (error) throw error

      return (data || []).map((item: any) => {
        const profiles = item.profiles || {}
        const fullName = `${profiles.first_name || ''} ${profiles.last_name || ''}`.trim()
        const respondedAt =
          item.status && String(item.status).toLowerCase() !== 'pending'
            ? (item.updated_at || item.created_at)
            : null

        return {
          profile_id: item.profile_id,
          full_name: fullName || profiles.nickname || 'Unknown',
          status: item.status,
          responded_at: respondedAt
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

      const token = (await supabase.auth.getSession()).data.session?.access_token
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
              idempotency_key: `campaign:${campaignId}:${roleCode}:${profileId}:offer`
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
        description: `Sent offers to ${data?.sent ?? selectedForOffer.size} candidates`
      })
      setSelectedForOffer(new Set())
      queryClient.invalidateQueries({ queryKey: ['staffing_availability_responses', jobId, roleCode] })
      queryClient.invalidateQueries({ queryKey: ['staffing_requests', jobId] })
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
      </CardHeader>

      <CardContent className="space-y-6">
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
                    checked={selectedForOffer.has(response.profile_id)}
                    onCheckedChange={() => toggleForOffer(response.profile_id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{response.full_name}</p>
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
                  <span className="text-xs text-gray-600">Waiting for response...</span>
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
                  <span className="text-xs text-gray-600">Declined</span>
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
                : `Send Offers (${selectedForOffer.size})`}
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
