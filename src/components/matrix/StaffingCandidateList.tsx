import React, { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { dataLayerClient } from '@/services/dataLayerClient';
import { useToast } from '@/hooks/use-toast'
import { parseISO } from 'date-fns'
import { Info, Mail, MessageCircle } from 'lucide-react'
import {
  JOB_PROFILE_LABELS,
  JobProfileName,
  recommendedWaveNumber,
} from '@/features/staffing/crewingProfiles'


import { queryKeys } from "@/lib/react-query";
interface StaffingCandidateListProps {
  campaignId: string
  roleCode: string
  jobId: string
  department: string
  policy: any
  requiredCount?: number
  assignedCount?: number
  confirmedAvailability?: number
  pendingAvailability?: number
  mode?: 'assisted' | 'auto'
  readOnly?: boolean
  actorLabel?: string
}

type StaffingChannel = 'email' | 'whatsapp'

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

interface RolelessConsultation {
  phase: string
  status: string
  target_date: string | null
  single_day: boolean
  updated_at: string | null
}

interface CandidateRequestRow {
  id: string
  profile_id: string | null
  phase: string | null
  status: string | null
  target_date: string | null
  single_day: boolean | null
  updated_at: string | null
  created_at: string | null
  role_code: string | null
}

interface CandidateEventMeta {
  phase?: string
  role?: string
  request_origin?: string
}

interface CandidateEventRow {
  staffing_request_id: string | null
  event: string | null
  meta: CandidateEventMeta | null
  created_at: string | null
}

interface CandidatePhaseActivity {
  phase: 'availability' | 'offer'
  status: string
  created_at: string | null
  updated_at: string | null
  request_origin?: string | null
}

type CandidateActivity = Partial<Record<'availability' | 'offer', CandidatePhaseActivity>>

const ROLELESS_PHASE_LABELS: Record<string, string> = {
  availability: 'disponibilidad',
  offer: 'oferta'
}

const ROLELESS_STATUS_LABELS: Record<string, string> = {
  pending: 'pendiente',
  confirmed: 'confirmada',
  declined: 'rechazada'
}

const getRolelessConsultationLabel = (consultation: RolelessConsultation) => {
  const phase = ROLELESS_PHASE_LABELS[consultation.phase] ?? consultation.phase
  const status = ROLELESS_STATUS_LABELS[consultation.status] ?? consultation.status
  const scope = consultation.single_day && consultation.target_date
    ? ` para ${consultation.target_date}`
    : ''

  return `Solicitud previa de ${phase} sin rol: ${status}${scope}`
}

const ROLE_ACTIVITY_STATUS_LABELS: Record<string, string> = {
  pending: 'enviada',
  confirmed: 'confirmada',
  declined: 'rechazada'
}

const getCandidateActivityLabel = (activity?: CandidateActivity) => {
  const latest = activity?.offer || activity?.availability
  if (!latest) return null

  const phaseLabel = latest.phase === 'offer' ? 'Oferta' : 'Disponibilidad'
  const statusLabel = ROLE_ACTIVITY_STATUS_LABELS[latest.status] ?? latest.status
  return `${phaseLabel} ${statusLabel}`
}

const getCandidateActivityClassName = (activity?: CandidateActivity) => {
  const latest = activity?.offer || activity?.availability
  if (!latest) return ''
  if (latest.status === 'confirmed') return 'bg-green-100 text-green-800'
  if (latest.status === 'declined') return 'bg-red-100 text-red-800'
  return latest.phase === 'offer' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
}

export const StaffingCandidateList: React.FC<StaffingCandidateListProps> = ({
  campaignId,
  roleCode,
  jobId,
  department,
  policy,
  requiredCount = 0,
  assignedCount = 0,
  confirmedAvailability = 0,
  pendingAvailability = 0,
  mode = 'assisted',
  readOnly = false,
  actorLabel
}) => {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set())
  const [expandedReasons, setExpandedReasons] = useState<string | null>(null)
  const [channel, setChannel] = useState<StaffingChannel>('email')

  useEffect(() => {
    setChannel(policy?.channel === 'whatsapp' ? 'whatsapp' : 'email')
  }, [policy?.channel])

  // Fetch ranked candidates
  const { data: candidates, isLoading } = useQuery({
    queryKey: queryKeys.scope('staffing_candidates', jobId, department, roleCode, mode),
    queryFn: async () => {
      try {
        const { data, error } = await dataLayerClient.rpc('rank_staffing_candidates', {
          p_job_id: jobId,
          p_department: department,
          p_role_code: roleCode,
          p_mode: mode,
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
    () => Array.from(new Set(candidates?.map(c => c.profile_id) || [])).sort(),
    [candidates]
  )

  const { data: profilePictures } = useQuery({
    queryKey: queryKeys.scope('candidate_profile_pictures', candidateIds),
    queryFn: async () => {
      if (candidateIds.length === 0) return {}
      const { data, error } = await dataLayerClient.from('profiles')
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

  const { data: rolelessConsultations = {} } = useQuery<Record<string, RolelessConsultation>>({
    queryKey: queryKeys.scope('staffing_roleless_consultations', jobId, candidateIds),
    queryFn: async () => {
      if (candidateIds.length === 0) return {}

      const { data, error } = await dataLayerClient.from('staffing_requests')
        .select('profile_id, phase, status, target_date, single_day, updated_at')
        .eq('job_id', jobId)
        .in('profile_id', candidateIds)
        .or('role_code.is.null,role_code.eq.')
        .in('phase', ['availability', 'offer'])
        .in('status', ['pending', 'confirmed', 'declined'])
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error fetching prior role-less staffing requests:', error)
        return {}
      }

      return (data || []).reduce((acc, request) => {
        if (!request.profile_id || acc[request.profile_id]) return acc

        acc[request.profile_id] = {
          phase: request.phase,
          status: request.status,
          target_date: request.target_date,
          single_day: Boolean(request.single_day),
          updated_at: request.updated_at
        }

        return acc
      }, {} as Record<string, RolelessConsultation>)
    },
    enabled: candidateIds.length > 0
  })

  const { data: roleActivity = {} } = useQuery<Record<string, CandidateActivity>>({
    queryKey: queryKeys.scope('staffing_candidate_role_activity', jobId, roleCode, candidateIds),
    queryFn: async () => {
      if (candidateIds.length === 0) return {}

      const { data: requests, error } = await dataLayerClient.from('staffing_requests')
        .select('id, profile_id, phase, status, target_date, single_day, updated_at, created_at, role_code')
        .eq('job_id', jobId)
        .in('profile_id', candidateIds)
        .in('phase', ['availability', 'offer'])
        .in('status', ['pending', 'confirmed', 'declined'])
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error fetching candidate staffing activity:', error)
        return {}
      }

      const requestRows = (requests || []) as CandidateRequestRow[]
      const requestIds = requestRows.map((request) => request.id).filter(Boolean)
      const eventMetaByRequestId = new Map<string, CandidateEventMeta>()

      if (requestIds.length > 0) {
        const { data: sentEvents, error: sentEventsError } = await dataLayerClient.from('staffing_events')
          .select('staffing_request_id, event, meta, created_at')
          .in('staffing_request_id', requestIds)
          .in('event', ['email_sent', 'whatsapp_sent'])
          .order('created_at', { ascending: false })

        if (sentEventsError) {
          console.error('Error fetching candidate staffing events:', sentEventsError)
        } else {
          ;[...((sentEvents || []) as CandidateEventRow[])]
            .sort((a, b) => (
              parseISO(b.created_at || '1970-01-01T00:00:00.000Z').getTime() -
              parseISO(a.created_at || '1970-01-01T00:00:00.000Z').getTime()
            ))
            .forEach((event) => {
              const requestId = String(event.staffing_request_id || '')
              if (!requestId || eventMetaByRequestId.has(requestId)) return
              eventMetaByRequestId.set(requestId, event.meta || {})
            })
        }
      }

      return requestRows.reduce((acc, request) => {
        const phase = request.phase === 'availability' || request.phase === 'offer'
          ? request.phase
          : null
        const profileId = String(request.profile_id || '')
        if (!phase || !profileId) return acc

        const eventMeta = eventMetaByRequestId.get(String(request.id)) || {}
        const requestRole = String(request.role_code || eventMeta.role || '')
        if (requestRole !== roleCode) return acc

        if (!acc[profileId]) acc[profileId] = {}
        if (acc[profileId][phase]) return acc

        acc[profileId][phase] = {
          phase,
          status: request.status || 'pending',
          created_at: request.created_at,
          updated_at: request.updated_at,
          request_origin: eventMeta.request_origin || null
        }
        return acc
      }, {} as Record<string, CandidateActivity>)
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
              phase: 'availability',
              role: roleCode,
              department,
              channel,
              require_no_conflicts: true,
              idempotency_key: `campaign:${campaignId}:${roleCode}:${profileId}:availability:${channel}`
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
        description: `Contacted ${data?.sent ?? selectedCandidates.size} candidates by ${channel}`
      })
      setSelectedCandidates(new Set())
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('staffing_requests', jobId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('staffing_availability_responses', jobId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('staffing_candidates', jobId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('staffing_roleless_consultations', jobId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('staffing_candidate_role_activity', jobId, roleCode) })
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
    const trimmed = name.trim()
    if (!trimmed) return 'T'

    const parts = trimmed.split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return trimmed[0].toUpperCase()
  }

  const toggleSelectAll = () => {
    if (selectedCandidates.size === candidates?.length) {
      setSelectedCandidates(new Set())
    } else {
      setSelectedCandidates(new Set(candidates?.map(c => c.profile_id) || []))
    }
  }

  const roleSummary = (
    <div className="flex flex-wrap gap-2 pt-2">
      <Badge variant="outline">Requeridos {requiredCount}</Badge>
      <Badge variant="secondary">{assignedCount}/{requiredCount || '—'} asignados</Badge>
      <Badge variant="outline">{confirmedAvailability} disponibles</Badge>
      {pendingAvailability > 0 && (
        <Badge variant="outline">{pendingAvailability} pendientes</Badge>
      )}
    </div>
  )

  const roleProfileName = (
    policy?.role_profiles?.[roleCode]?.selected_profile ||
    policy?.profile?.selected_job_profile ||
    'standard'
  ) as JobProfileName
  const waveBuffer = Number(policy?.waves?.buffer ?? policy?.offer_buffer ?? 1)
  const waveMode = String(policy?.waves?.mode || 'manual_selection')
  const maxWaves = Number(policy?.waves?.max_waves || 3)
  const waveLabelForIndex = (index: number) => {
    if (waveMode === 'blast_all_eligible') return 'Todos elegibles'
    if (waveMode === 'manual_selection') return 'Oleada manual'
    const wave = recommendedWaveNumber(index, requiredCount, waveBuffer)
    return wave > maxWaves ? `Tras oleada ${maxWaves}` : `Oleada ${wave}`
  }
  const nextCandidateProfileId = useMemo(() => {
    if (!readOnly || !candidates?.length) return null

    return candidates.find((candidate) => {
      const activity = roleActivity[candidate.profile_id]
      return !activity?.availability && !activity?.offer
    })?.profile_id ?? null
  }, [candidates, readOnly, roleActivity])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          {roleSummary}
          <p className="text-muted-foreground">Cargando candidatos...</p>
        </CardContent>
      </Card>
    )
  }

  if (!candidates || candidates.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          {roleSummary}
          <p className="text-muted-foreground">No hay candidatos disponibles para {roleCode}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {roleCode} - {readOnly && actorLabel ? `Decisión de ${actorLabel}` : 'Recomendaciones de candidatos'}
        </CardTitle>
        <CardDescription>
          {readOnly && actorLabel
            ? `${actorLabel} evalúa estos ${candidates.length} candidatos por ranking y estado de contacto`
            : `Los ${candidates.length} candidatos mejor clasificados por habilidades, experiencia en el rol, proximidad y confiabilidad`}
        </CardDescription>
        {roleSummary}
      </CardHeader>

      <CardContent className="space-y-4">
        {!readOnly && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded border bg-background p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              {channel === 'whatsapp' ? <MessageCircle size={16} /> : <Mail size={16} />}
              Enviar disponibilidad por
            </div>
            <Select value={channel} onValueChange={(value) => setChannel(value as StaffingChannel)}>
              <SelectTrigger aria-label="Seleccionar canal de disponibilidad" className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Select all checkbox */}
        {!readOnly && (
          <div className="flex items-center gap-2 p-2 bg-muted rounded">
            <Checkbox
              aria-label="Seleccionar todos los candidatos"
              checked={selectedCandidates.size === candidates.length && candidates.length > 0}
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-sm font-medium">
              Seleccionar todos ({selectedCandidates.size} seleccionados)
            </span>
          </div>
        )}

        {/* Candidate list */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {candidates.map((candidate, index) => {
            const rolelessConsultation = rolelessConsultations[candidate.profile_id]
            const activity = roleActivity[candidate.profile_id]
            const activityLabel = getCandidateActivityLabel(activity)
            const isNextCandidate = candidate.profile_id === nextCandidateProfileId
            const reasons = Array.isArray(candidate.reasons) ? candidate.reasons.map(String) : []
            const rateReason = reasons.find((reason) => /rate adjustment|custom rate|candidate rate|standard role rate/i.test(reason))
            const waveLabel = waveLabelForIndex(index)

            return (
              <div
                key={candidate.profile_id}
                className="flex items-start gap-3 p-3 border rounded hover:bg-muted"
              >
                {!readOnly && (
                  <Checkbox
                    aria-label={`Seleccionar ${candidate.full_name}`}
                    checked={selectedCandidates.has(candidate.profile_id)}
                    onCheckedChange={() => toggleCandidate(candidate.profile_id)}
                    className="mt-1"
                  />
                )}

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
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-medium text-sm">{candidate.full_name}</p>
                    <Badge variant="outline">Puesto #{index + 1}</Badge>
                    <Badge variant="secondary">Perfil: {JOB_PROFILE_LABELS[roleProfileName] || roleProfileName}</Badge>
                    <Badge variant="outline">{waveLabel}</Badge>
                    {activityLabel ? (
                      <Badge className={getCandidateActivityClassName(activity)}>
                        {activityLabel}
                      </Badge>
                    ) : isNextCandidate ? (
                      <Badge className="bg-blue-100 text-blue-800">
                        Siguiente candidato
                      </Badge>
                    ) : (
                      <Badge variant="outline">Estado: No contactado</Badge>
                    )}
                    {activityLabel && readOnly && actorLabel && (
                      <Badge variant="outline">Enviado por {actorLabel}</Badge>
                    )}
                    {candidate.final_score >= 80 && (
                      <Badge className="bg-green-100 text-green-800">⭐ Destacado</Badge>
                    )}
                    {candidate.soft_conflict && (
                      <Badge className="bg-yellow-100 text-yellow-800">⚠ Conflicto blando</Badge>
                    )}
                    {rolelessConsultation && (
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                        title={getRolelessConsultationLabel(rolelessConsultation)}
                      >
                        Solicitud sin rol
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-2">
                    <div>Habilidades: <span className="font-semibold">{candidate.skills_score}</span>pts</div>
                    <div>Fiabilidad: <span className="font-semibold">{candidate.reliability_score}</span>pts</div>
                    <div>
                      Proximidad:{' '}
                      <span className="font-semibold">
                        {typeof candidate.distance_to_madrid_km === 'number'
                          ? candidate.distance_to_madrid_km.toFixed(1)
                          : '—'}
                      </span>
                      km
                    </div>
                    <div>Equidad: <span className="font-semibold">{candidate.fairness_score}</span>pts</div>
                    <div>Experiencia: <span className="font-semibold">{candidate.experience_score}</span>pts</div>
                    <div>
                      Tarifa:{' '}
                      <span className="font-semibold">
                        {rateReason ? rateReason.replace(/^Rate adjustment:\s*/i, '') : 'estándar'}
                      </span>
                    </div>
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

                  {rolelessConsultation && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {getRolelessConsultationLabel(rolelessConsultation)}
                    </p>
                  )}

                  {reasons.length > 0 && (
                    <button
                      onClick={() => setExpandedReasons(
                        expandedReasons === candidate.profile_id ? null : candidate.profile_id
                      )}
                      className="text-xs text-blue-600 hover:text-blue-800 mt-1 flex items-center gap-1"
                    >
                      <Info size={14} />
                      {expandedReasons === candidate.profile_id ? 'Ocultar' : 'Ver'} motivos
                    </button>
                  )}

                  {expandedReasons === candidate.profile_id && (
                    <div className="mt-2 p-2 bg-blue-500/10 rounded text-xs space-y-1">
                      <p className="font-semibold text-foreground">Desglose de puntuación</p>
                      {reasons.map((reason, idx) => (
                        <div key={idx} className="text-muted-foreground">• {reason}</div>
                      ))}
                      <p className="pt-2 font-semibold text-foreground">Explicación</p>
                      <p className="text-muted-foreground">
                        Clasificado con el perfil {JOB_PROFILE_LABELS[roleProfileName] || roleProfileName} usando habilidad de rol,
                        fiabilidad, equidad, proximidad, historial completado, señales de disponibilidad y reglas de coste configuradas.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Action buttons */}
        {!readOnly && (
          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={() => sendAvailabilityMutation.mutate()}
              disabled={selectedCandidates.size === 0 || sendAvailabilityMutation.isPending}
            >
              {sendAvailabilityMutation.isPending
                ? 'Enviando...'
                : `Enviar disponibilidad (${selectedCandidates.size}) por ${channel === 'whatsapp' ? 'WhatsApp' : 'Email'}`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
