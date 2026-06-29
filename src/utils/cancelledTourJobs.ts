export type CancelledTourJobState = {
  status?: string | null;
  start_time?: string | null;
};

export type CancelledTourMeta = {
  status?: string | null;
  deleted?: boolean | null;
} | null | undefined;

const JOB_STATUS_CANCELLED = "Cancelado";
const JOB_STATUS_COMPLETED = "Completado";
const TOUR_STATUS_CANCELLED = "cancelled";

export const isJobScheduledInFuture = (
  job: CancelledTourJobState,
  nowMs: number = Date.now(),
) => {
  if (!job.start_time) {
    return true;
  }

  const startMs = Date.parse(job.start_time);
  return Number.isNaN(startMs) || startMs > nowMs;
};

export const shouldHideJobForTourState = (
  job: CancelledTourJobState,
  tourMeta: CancelledTourMeta,
  nowMs: number = Date.now(),
) => {
  if (job.status === JOB_STATUS_CANCELLED) {
    return true;
  }

  if (tourMeta?.deleted === true) {
    return true;
  }

  if (tourMeta?.status !== TOUR_STATUS_CANCELLED) {
    return false;
  }

  if (job.status === JOB_STATUS_COMPLETED) {
    return false;
  }

  return isJobScheduledInFuture(job, nowMs);
};
