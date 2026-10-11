import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConflictError } from '@/features/staffing/hooks/useStaffing';
import { getErrorMessage } from '@/utils/errorMessage';
import { isFocusableJob } from '@/features/matrix-v2/focus/focusableJob';
import type { InspectorEnvironment, InspectorTarget, InspectorTechnician } from '@/features/matrix-v2/inspector/environment';
import { labelForCode } from '@/utils/roles';
import { jobDayKeys } from '@/features/matrix-v2/jobDays';
import { slotsForDepartment } from '@/features/matrix-v2/roleSlots';
import { suggestRole } from '@/features/matrix-v2/roleSuggestion';
import { technicianDisplayName } from '@/features/matrix-v2/names';
import { describeStaffingConflict, type StaffingConflictSummary } from '@/features/matrix-v2/staffing/conflicts';
import {
  buildResendPayload,
  buildStaffingPayload,
  type StaffingChannel,
  type StaffingPhase,
  type StaffingSendPayload,
} from '@/features/matrix-v2/staffing/payload';
import { roleDisciplineForDepartment } from '@/features/matrix-v2/types';
import type { JobOption } from '@/features/matrix-v2/inspector/useCellInspectorModel';
import type { MatrixJob } from '@/hooks/useOptimizedMatrixData';

export const channelLabel = (channel: StaffingChannel) => (channel === 'whatsapp' ? 'WhatsApp' : 'Email');

/** Some job rows carry a description that offers include by default. */
const jobDescription = (job: MatrixJob | undefined): string => (job?.description ?? '').trim();

interface Options {
  env: InspectorEnvironment;
  technician: InspectorTechnician | undefined;
  target: InspectorTarget;
  onDone: () => void;
}

/** A request that is already out, as the grid knows it. */
export interface InFlightRequest {
  phase: StaffingPhase;
  jobTitle: string | null;
  /** Jobs the request(s) are for, for cancelling. */
  jobIds: string[];
  /** Availability only: the request to send again. */
  requestId: string | null;
}

/**
 * The staffing composer's model. Intent first (availability or offer), the job
 * and days prefilled from the cell and the job's own days, a suggested role for
 * offers, the person's usual channel. What is already out is managed here too:
 * resend the availability request, or cancel it.
 */
export function useStaffingComposer({ env, technician, target, onDone }: Options) {
  const { technicianId, date, dateKey, staffingDraft: draft } = target;
  const staffing = env.staffingByDate(technicianId, dateKey);
  const api = env.staffing;
  const name = technicianDisplayName(technician);
  const discipline = roleDisciplineForDepartment(technician?.department);
  const declined = env.declinedJobIds(technicianId);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<StaffingConflictSummary | null>(null);
  const rejected = useRef<{ payload: StaffingSendPayload; fingerprint: string } | null>(null);
  const editVersion = useRef(0);
  const clearDecision = useCallback(() => {
    editVersion.current += 1;
    rejected.current = null;
    setConflict(null);
    setError(null);
  }, []);

  const availabilityOut = staffing?.availability_status === 'requested';
  const offerOut = staffing?.offer_status === 'sent';
  const availabilityConfirmed = staffing?.availability_status === 'confirmed' && !offerOut && staffing?.offer_status !== 'confirmed';

  const [pickedPhase, setPickedPhase] = useState<StaffingPhase | null>(draft?.phase ?? null);
  // Once they have said yes, the next thing to send is the offer.
  const phase = pickedPhase ?? (availabilityConfirmed ? 'offer' : 'availability');

  const jobOptions = useMemo<JobOption[]>(
    () => {
      const jobs = env.getJobsForDate(date);
      const draftJob = draft ? env.getJob(draft.jobId) : undefined;
      const options = draft ? [...jobs.filter((job) => job.id !== draft.jobId), ...(draftJob ? [draftJob] : [])] : jobs;
      return options.filter(isFocusableJob).map((job) => ({
        job,
        declined: declined?.has(job.id) ?? false,
        open: slotsForDepartment(env.roleSlotsByJob.get(job.id), discipline).filter((slot) => slot.open > 0),
      }));
    },
    [env, date, declined, discipline, draft],
  );
  const selectable = jobOptions.filter((option) => !option.declined);
  const [pickedJobId, setPickedJobId] = useState<string | null>(draft?.jobId ?? null);
  const defaultJobId = useMemo(() => {
    const confirmedFor = staffing?.availability_job_id;
    if (availabilityConfirmed && confirmedFor && selectable.some((option) => option.job.id === confirmedFor)) return confirmedFor;
    if (env.focusJobId && selectable.some((option) => option.job.id === env.focusJobId)) return env.focusJobId;
    return selectable.length === 1 ? selectable[0].job.id : '';
  }, [availabilityConfirmed, staffing?.availability_job_id, env.focusJobId, selectable]);
  const jobId = pickedJobId ?? defaultJobId;
  const job = jobOptions.find((option) => option.job.id === jobId)?.job;
  const jobDays = useMemo(() => jobDayKeys(job), [job]);

  const [pickedDays, setPickedDays] = useState<{ jobId: string; days: string[] } | null>(
    draft ? { jobId: draft.jobId, days: draft.days } : null,
  );
  const days = useMemo(() => {
    const selected = pickedDays && pickedDays.jobId === jobId ? pickedDays.days : jobDays;
    // A retained selection can shrink with the real job, but cannot widen to it.
    return draft ? selected.filter((day) => jobDays.includes(day)) : selected;
  }, [pickedDays, jobId, jobDays, draft]);
  const toggleDay = useCallback((key: string) => {
    clearDecision();
    const next = new Set(days);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setPickedDays({ jobId, days: [...next].sort() });
  }, [days, jobId, clearDecision]);

  const suggestion = useMemo(() => suggestRole({
    technician: technician ?? { department: null, skills: null },
    slots: slotsForDepartment(env.roleSlotsByJob.get(jobId), discipline),
    lastRoleCode: env.lastRoleByTechnician.get(technicianId) ?? null,
  }), [technician, env.roleSlotsByJob, env.lastRoleByTechnician, jobId, discipline, technicianId]);
  const [pickedRole, setPickedRole] = useState<string | null>(null);
  const role = pickedRole ?? suggestion.code;

  const [pickedMessage, setPickedMessage] = useState<{ jobId: string; text: string } | null>(
    draft ? { jobId: draft.jobId, text: draft.message } : null,
  );
  const message = pickedMessage && pickedMessage.jobId === jobId ? pickedMessage.text : jobDescription(job);
  const [messageOpen, setMessageOpen] = useState(false);
  const [pickedChannel, setPickedChannel] = useState<StaffingChannel | null>(null);
  const channel = draft ? pickedChannel ?? draft.channel : api.channel;
  const department = draft ? draft.department : api.department;

  const [busy, setBusy] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState<StaffingPhase | null>(null);

  // Include whole-job dates and derived defaults: they can change without a form edit.
  const fingerprint = JSON.stringify({ technicianId, dateKey, jobId, phase, days, jobDays, role, message, channel, department });
  useEffect(clearDecision, [fingerprint, clearDecision]);

  const inFlight = useMemo<InFlightRequest[]>(() => {
    const requests: InFlightRequest[] = [];
    if (availabilityOut) {
      const jobIds = staffing?.pending_availability_job_ids?.length ? staffing.pending_availability_job_ids
        : staffing?.availability_job_id ? [staffing.availability_job_id] : [];
      requests.push({ phase: 'availability', jobTitle: staffing?.availability_job_title ?? null, jobIds, requestId: staffing?.availability_request_id ?? null });
    }
    if (offerOut) {
      const jobIds = staffing?.pending_offer_job_ids?.length ? staffing.pending_offer_job_ids
        : staffing?.offer_job_id ? [staffing.offer_job_id] : [];
      requests.push({ phase: 'offer', jobTitle: staffing?.offer_job_title ?? null, jobIds, requestId: null });
    }
    return requests;
  }, [availabilityOut, offerOut, staffing]);

  const needsRole = phase === 'offer';
  const canSend = !busy && !!job && !!env.canAssign && days.length > 0 && (!needsRole || !!role)
    && (!draft || (!declined?.has(jobId) && !env.isFridge(technicianId)));

  const run = useCallback(async (payload: StaffingSendPayload, success: (channel: string | null) => string, decisionFingerprint?: string) => {
    const version = editVersion.current;
    rejected.current = null;
    setBusy(true);
    setError(null);
    setConflict(null);
    try {
      const result = await api.send(payload);
      toast.success(success(result?.channel ?? null));
      onDone();
    } catch (cause) {
      // A late failure cannot restore an approval invalidated by a semantic edit.
      if (version !== editVersion.current) return;
      if (cause instanceof ConflictError) {
        if (decisionFingerprint) rejected.current = { payload, fingerprint: decisionFingerprint };
        setConflict(describeStaffingConflict(cause.details));
      }
      else setError(getErrorMessage(cause, 'No se pudo enviar la solicitud'));
    } finally {
      setBusy(false);
    }
  }, [api, onDone]);

  const send = useCallback(async (overrideConflicts = false) => {
    if (!job || !canSend) return;
    const decision = rejected.current;
    if (overrideConflicts && (!decision || decision.fingerprint !== fingerprint)) return;
    const payload = overrideConflicts && decision ? { ...decision.payload, override_conflicts: true } : buildStaffingPayload({
      jobId: job.id, technicianId, phase, channel, department,
      days, jobDays, role: needsRole ? role : null, message: needsRole ? message : null,
    });
    // Even a retained selection covering today's whole job stays date-scoped.
    if (draft) {
      payload.single_day = true;
      payload.dates = [...new Set(days)].sort();
      if (payload.dates.length === 1) payload.target_date = payload.dates[0];
    }
    const via = (used: string | null) => (used === 'whatsapp' ? 'WhatsApp' : used === 'email' ? 'Email' : channelLabel(channel));
    await run(payload, (used) => (phase === 'offer'
      ? `Oferta de ${role ? labelForCode(role) : 'rol'} enviada a ${name} por ${via(used)}`
      : `Disponibilidad pedida a ${name} por ${via(used)}`), fingerprint);
  }, [job, canSend, technicianId, phase, channel, department, days, jobDays, needsRole, role, message, run, name, fingerprint, draft]);

  const resend = useCallback(async (request: InFlightRequest) => {
    const requestJobId = request.jobIds[0];
    if (!requestJobId || !request.requestId) return;
    await run(
      buildResendPayload({ jobId: requestJobId, technicianId, channel, department, requestId: request.requestId }),
      (used) => `Solicitud reenviada a ${name} por ${used === 'whatsapp' ? 'WhatsApp' : used === 'email' ? 'Email' : channelLabel(channel)}`,
    );
  }, [run, technicianId, channel, department, name]);

  const cancel = useCallback(async (request: InFlightRequest) => {
    setBusy(true);
    setError(null);
    try {
      await Promise.all(request.jobIds.map((id) => api.cancel({ job_id: id, profile_id: technicianId, phase: request.phase })));
      toast.success(request.phase === 'availability' ? 'Solicitud de disponibilidad cancelada' : 'Oferta cancelada');
      setConfirmingCancel(null);
      onDone();
    } catch (cause) {
      setError(getErrorMessage(cause, 'No se pudo cancelar'));
    } finally {
      setBusy(false);
    }
  }, [api, technicianId, onDone]);

  return {
    name, phase, setPhase: (value: StaffingPhase) => { clearDecision(); setPickedPhase(value); },
    jobOptions, jobId, pickJob: (value: string) => { clearDecision(); setPickedJobId(value); }, job, jobDays, days, toggleDay,
    selectAllDays: () => { clearDecision(); setPickedDays({ jobId, days: jobDays }); },
    selectThisDayOnly: () => { clearDecision(); setPickedDays({ jobId, days: [dateKey] }); },
    suggestion, role, pickRole: (value: string) => { clearDecision(); setPickedRole(value); }, needsRole,
    message, setMessage: (text: string) => { clearDecision(); setPickedMessage({ jobId, text }); }, messageOpen, setMessageOpen,
    channel, setChannel: (value: StaffingChannel) => { clearDecision(); if (draft) setPickedChannel(value); api.setChannel(value); },
    busy, error, conflict, canSend,
    inFlight, confirmingCancel, askCancel: setConfirmingCancel,
    send, resend, cancel,
  };
}

export type StaffingComposer = ReturnType<typeof useStaffingComposer>;
