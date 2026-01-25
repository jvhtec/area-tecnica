import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { Info } from 'lucide-react'

interface StaffingCandidateListProps {
  campaignId: string
  roleCode: string
  jobId: string
  department: string
  policy: any
}

interface Candidate {
  profile_id: string
  full_name: string
  department: string
  skills_score: number
  distance_to_madrid_km: number | null
  proximity_score: number
  experience_score: number
  reliability_score: number
  fairness_score: number
  soft_conflict: boolean
  hard_conflict: boolean
  final_score: number
  reasons: unknown
}

export const StaffingCandidateList: React.FC<StaffingCandidateListProps> = ({
  campaignId,
  roleCode,
  jobId,
  department,
  policy
}) => {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set())
  const [expandedReasons, setExpandedReasons] = useState<string | null>(null)

  // Fetch ranked candidates
  const { data: candidates, isLoading } = useQuery({
    queryKey: ['staffing_candidates', jobId, department, roleCode],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc('rank_staffing_candidates', {
          p_job_id: jobId,
          p_department: department,
          p_role_code: roleCode,
          p_mode: 'assisted',
          p_policy: policy
        })

        if (error) throw error
        return (data || []) as Candidate[]
      } catch (err) {
        console.error('Error fetching candidates:', err)
        return []
      }
    }
  })

  // Fetch profile pictures for candidates
  const candidateIds = useMemo(
    () => candidates?.map(c => c.profile_id) || [],
    [candidates]
  )

  const { data: profilePictures } = useQuery({
    queryKey: ['candidate_profile_pictures', candidateIds],
    queryFn: async () => {
      if (candidateIds.length === 0) return {}
      const { data, error } = await supabase
        .from('profiles')
        .select('id, profile_picture_url')
        .in('id', candidateIds)
      if (error) {
        console.error('Error fetching profile pictures:', error)
        return {}
      }
      // Convert to a map for easy lookup
      return (data || []).reduce((acc, p) => {
        acc[p.id] = p.profile_picture_url
        return acc
      }, {} as Record<string, string | null>)
    },
    enabled: candidateIds.length > 0
  })

  // Send availability mutation
  const sendAvailabilityMutation = useMutation({
    mutationFn: async () => {
      const selectedProfiles = Array.from(selectedCandidates)
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
              phase: 'availability',
              role: roleCode,
              idempotency_key: `campaign:${campaignId}:${roleCode}:${profileId}:availability`
            })
          }
        )

        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to send availability request')
        }
        return payload
      }

      const results = await Promise.allSettled(selectedProfiles.map(sendOne))
      const failed = results.filter((r) => r.status === 'rejected')

      if (failed.length > 0) {
        throw new Error(`Failed to send ${failed.length}/${selectedProfiles.length} requests`)
      }

      return { sent: selectedProfiles.length }
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Availability sent',
        description: `Contacted ${data?.sent ?? selectedCandidates.size} candidates`
      })
      setSelectedCandidates(new Set())
      queryClient.invalidateQueries({ queryKey: ['staffing_requests', jobId] })
      queryClient.invalidateQueries({ queryKey: ['staffing_availability_responses', jobId] })
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  const toggleCandidate = (profileId: string) => {
    const newSelected = new Set(selectedCandidates)
    if (newSelected.has(profileId)) {
      newSelected.delete(profileId)
    } else {
      newSelected.add(profileId)
    }
    setSelectedCandidates(newSelected)
  }

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return (name[0] || 'T').toUpperCase()
  }

  const toggleSelectAll = () => {
    if (selectedCandidates.size === candidates?.length) {
      setSelectedCandidates(new Set())
    } else {
      setSelectedCandidates(new Set(candidates?.map(c => c.profile_id) || []))
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Loading candidates...</p>
        </CardContent>
      </Card>
    )
  }

  if (!candidates || candidates.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">No candidates available for {roleCode}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{roleCode} - Candidate Recommendations</CardTitle>
        <CardDescription>
          Top {candidates.length} candidates ranked by skills, proximity, and reliability
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Select all checkbox */}
        <div className="flex items-center gap-2 p-2 bg-muted rounded">
          <Checkbox
            checked={selectedCandidates.size === candidates.length && candidates.length > 0}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm font-medium">
            Select all ({selectedCandidates.size} selected)
          </span>
        </div>

        {/* Candidate list */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {candidates.map((candidate) => (
            <div
              key={candidate.profile_id}
              className="flex items-start gap-3 p-3 border rounded hover:bg-muted"
            >
              <Checkbox
                checked={selectedCandidates.has(candidate.profile_id)}
                onCheckedChange={() => toggleCandidate(candidate.profile_id)}
                className="mt-1"
              />

              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage
                  src={profilePictures?.[candidate.profile_id] || undefined}
                  alt={candidate.full_name}
                />
                <AvatarFallback className="text-xs">
                  {getInitials(candidate.full_name)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm">{candidate.full_name}</p>
                  {candidate.final_score >= 80 && (
                    <Badge className="bg-green-100 text-green-800">⭐ Top</Badge>
                  )}
                  {candidate.soft_conflict && (
                    <Badge className="bg-yellow-100 text-yellow-800">⚠ Soft Conflict</Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-2">
                  <div>Skills: <span className="font-semibold">{candidate.skills_score}</span>pts</div>
                  <div>Reliability: <span className="font-semibold">{candidate.reliability_score}</span>pts</div>
                  <div>
                    Proximity:{' '}
                    <span className="font-semibold">
                      {typeof candidate.distance_to_madrid_km === 'number'
                        ? candidate.distance_to_madrid_km.toFixed(1)
                        : '—'}
                    </span>
                    km
                  </div>
                  <div>Fairness: <span className="font-semibold">{candidate.fairness_score}</span>pts</div>
                </div>

                <div className="flex items-center gap-1">
                  <div className="h-2 flex-1 bg-muted rounded overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${(candidate.final_score / 100) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-foreground">{candidate.final_score}</span>
                </div>

                {(Array.isArray(candidate.reasons) ? candidate.reasons : []).length > 0 && (
                  <button
                    onClick={() => setExpandedReasons(
                      expandedReasons === candidate.profile_id ? null : candidate.profile_id
                    )}
                    className="text-xs text-blue-600 hover:text-blue-800 mt-1 flex items-center gap-1"
                  >
                    <Info size={14} />
                    {expandedReasons === candidate.profile_id ? 'Hide' : 'Show'} reasons
                  </button>
                )}

                {expandedReasons === candidate.profile_id && (
                  <div className="mt-2 p-2 bg-blue-500/10 rounded text-xs space-y-1">
                    {(Array.isArray(candidate.reasons) ? candidate.reasons : []).map((reason, idx) => (
                      <div key={idx} className="text-muted-foreground">• {reason}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-4 border-t">
          <Button
            onClick={() => sendAvailabilityMutation.mutate()}
            disabled={selectedCandidates.size === 0 || sendAvailabilityMutation.isPending}
          >
            {sendAvailabilityMutation.isPending ? 'Sending...' : `Send Availability (${selectedCandidates.size})`}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
