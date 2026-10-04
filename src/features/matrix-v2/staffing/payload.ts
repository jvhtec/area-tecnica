import type { SendStaffingEmailMutate } from '@/components/matrix/optimized-matrix-cell/types';

export type StaffingPhase = 'availability' | 'offer';
export type StaffingChannel = 'email' | 'whatsapp';

/** What `send-staffing-email` takes; unchanged by the composer. */
export type StaffingSendPayload = Parameters<SendStaffingEmailMutate>[0];

export interface StaffingRequestInput {
  jobId: string;
  technicianId: string;
  phase: StaffingPhase;
  channel: StaffingChannel;
  department: string | null;
  /** The days being asked for. */
  days: string[];
  /** Every day of the job: asking for all of them is a request for the whole job. */
  jobDays: string[];
  /** Offers only. */
  role?: string | null;
  message?: string | null;
  /** Sends although the server found a clash (the manager chose to). */
  overrideConflicts?: boolean;
}

/**
 * The request body. All the job's days is the whole job (`single_day: false`),
 * so it follows the job if its dates change; otherwise the days are listed, and
 * one day also sets `target_date`, as the older dialogs did.
 */
export function buildStaffingPayload(input: StaffingRequestInput): StaffingSendPayload {
  const days = [...new Set(input.days)].sort();
  const all = [...new Set(input.jobDays)].sort();
  const wholeJob = days.length === 0 || (days.length === all.length && days.every((day, index) => day === all[index]));
  const payload: StaffingSendPayload = {
    job_id: input.jobId,
    profile_id: input.technicianId,
    phase: input.phase,
    channel: input.channel,
    department: input.department,
    single_day: !wholeJob,
  };
  if (!wholeJob) {
    payload.dates = days;
    if (days.length === 1) payload.target_date = days[0];
  }
  if (input.phase === 'offer') {
    payload.role = input.role ?? null;
    const message = input.message?.trim();
    if (message) payload.message = message;
  }
  if (input.overrideConflicts) payload.override_conflicts = true;
  return payload;
}

/** Sends the same availability request again, on the channel the manager has selected. */
export const buildResendPayload = (input: {
  jobId: string; technicianId: string; channel: StaffingChannel; department: string | null; requestId: string;
}): StaffingSendPayload => ({
  job_id: input.jobId,
  profile_id: input.technicianId,
  phase: 'availability',
  channel: input.channel,
  department: input.department,
  resend_request_id: input.requestId,
});
