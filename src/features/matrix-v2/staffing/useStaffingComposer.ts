import { useCallback, useMemo, useState } from 'react';
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
  const { technicianId, date, dateKey } = target;
  const staffing = env.staffingByDate(technicianId, dateKey);
  const api = env.staffing;
  const name = technicianDisplayName(technician);
  const discipline = roleDisciplineForDepartment(technician?.department);
  const declined = env.declinedJobIds(technicianId);

  const availabilityOut = staffing?.availability_status === 'requested';
  const offerOut = staffing?.offer_status === 'sent';
  const availabilityConfirmed = staffing?.availability_status === 'confirmed' && !offerOut && staffing?.offer_status !== 'confirmed';

  const [pickedPhase, setPickedPhase] = useState<StaffingPhase | null>(null);
  // Once they have said yes, the next thing to send is the offer.
  const phase = pickedPhase ?? (availabilityConfirmed ? 'offer' : 'availability');

  const jobOptions = useMemo<JobOption[]>(
    () => env.getJobsForDate(date).filter(isFocusableJob).map((job) => ({
      job,
      declined: declined?.has(job.id) ?? false,
      open: slotsForDepartment(env.roleSlotsByJob.get(job.id), discipline).filter((slot) => slot.open > 0),
    })),
    [env, date, declined, discipline],
  );
  const selectable = jobOptions.filter((option) => !option.declined);
  const [pickedJobId, setPickedJobId] = useState<string | null>(null);
  const defaultJobId = useMemo(() => {
    const confirmedFor = staffing?.availability_job_id;
    if (availabilityConfirmed && confirmedFor && selectable.some((option) => option.job.id === confirmedFor)) return confirmedFor;
    if (env.focusJobId && selectable.some((option) => option.job.id === env.focusJobId)) return env.focusJobId;
    return selectable.length === 1 ? selectable[0].job.id : '';
  }, [availabilityConfirmed, staffing?.availability_job_id, env.focusJobId, selectable]);
  const jobId = pickedJobId ?? defaultJobId;
  const job = jobOptions.find((option) => option.job.id === jobId)?.job;
  const jobDays = useMemo(() => jobDayKeys(job), [job]);

  const [pickedDays, setPickedDays] = useState<{ jobId: string; days: string[] } | null>(null);
  const days = pickedDays && pickedDays.jobId === jobId ? pickedDays.days : jobDays;
  const toggleDay = useCallback((key: string) => {
    const next = new Set(days);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setPickedDays({ jobId, days: [...next].sort() });
  }, [days, jobId]);

  const suggestion = useMemo(() => suggestRole({
    technician: technician ?? { department: null, skills: null },
    slots: slotsForDepartment(env.roleSlotsByJob.get(jobId), discipline),
    lastRoleCode: env.lastRoleByTechnician.get(technicianId) ?? null,
  }), [technician, env.roleSlotsByJob, env.lastRoleByTechnician, jobId, discipline, technicianId]);
  const [pickedRole, setPickedRole] = useState<string | null>(null);
  const role = pickedRole ?? suggestion.code;

  const [pickedMessage, setPickedMessage] = useState<{ jobId: string; text: string } | null>(null);
  const message = pickedMessage && pickedMessage.jobId === jobId ? pickedMessage.text : jobDescription(job);
  const [messageOpen, setMessageOpen] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<StaffingConflictSummary | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState<StaffingPhase | null>(null);

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
  const canSend = !busy && !!job && !!env.canAssign && days.length > 0 && (!needsRole || !!role);

  const run = useCallback(async (payload: StaffingSendPayload, success: (channel: string | null) => string) => {
    setBusy(true);
    setError(null);
    setConflict(null);
    try {
      const result = await api.send(payload);
      toast.success(success(result?.channel ?? null));
      onDone();
    } catch (cause) {
      if (cause instanceof ConflictError) setConflict(describeStaffingConflict(cause.details));
      else setError(getErrorMessage(cause, 'No se pudo enviar la solicitud'));
    } finally {
      setBusy(false);
    }
  }, [api, onDone]);

  const send = useCallback(async (overrideConflicts = false) => {
    if (!job || !canSend) return;
    const payload = buildStaffingPayload({
      jobId: job.id, technicianId, phase, channel: api.channel, department: api.department,
      days, jobDays, role: needsRole ? role : null, message: needsRole ? message : null, overrideConflicts,
    });
    const via = (used: string | null) => (used === 'whatsapp' ? 'WhatsApp' : used === 'email' ? 'Email' : channelLabel(api.channel));
    await run(payload, (used) => (phase === 'offer'
      ? `Oferta de ${role ? labelForCode(role) : 'rol'} enviada a ${name} por ${via(used)}`
      : `Disponibilidad pedida a ${name} por ${via(used)}`));
  }, [job, canSend, technicianId, phase, api.channel, api.department, days, jobDays, needsRole, role, message, run, name]);

  const resend = useCallback(async (request: InFlightRequest) => {
    const requestJobId = request.jobIds[0];
    if (!requestJobId || !request.requestId) return;
    await run(
      buildResendPayload({ jobId: requestJobId, technicianId, channel: api.channel, department: api.department, requestId: request.requestId }),
      (used) => `Solicitud reenviada a ${name} por ${used === 'whatsapp' ? 'WhatsApp' : used === 'email' ? 'Email' : channelLabel(api.channel)}`,
    );
  }, [run, technicianId, api.channel, api.department, name]);

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
    name, phase, setPhase: setPickedPhase,
    jobOptions, jobId, pickJob: setPickedJobId, job, jobDays, days, toggleDay,
    selectAllDays: () => setPickedDays({ jobId, days: jobDays }),
    selectThisDayOnly: () => setPickedDays({ jobId, days: [dateKey] }),
    suggestion, role, pickRole: setPickedRole, needsRole,
    message, setMessage: (text: string) => setPickedMessage({ jobId, text }), messageOpen, setMessageOpen,
    channel: api.channel, setChannel: api.setChannel,
    busy, error, conflict, canSend,
    inFlight, confirmingCancel, askCancel: setConfirmingCancel,
    send, resend, cancel,
  };
}

export type StaffingComposer = ReturnType<typeof useStaffingComposer>;
