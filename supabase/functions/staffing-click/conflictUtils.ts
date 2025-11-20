export type DayWindow = { kind: 'day'; start: Date; end: Date };
export type RangeWindow = { kind: 'range'; start: Date; end: Date };
export type TimeWindow = DayWindow | RangeWindow;

export type AssignmentCoverageMeta = {
  job_id: string;
  job_title: string | null;
  assignment_date?: string;
  start_time?: string | null;
  end_time?: string | null;
};

export type AssignmentCoverage = {
  window: TimeWindow;
  meta: AssignmentCoverageMeta;
};

export type JobTimeInfo = {
  title: string | null;
  start: Date | null;
  end: Date | null;
  rawStart: string | null;
  rawEnd: string | null;
};

export type ConflictContext = {
  targetDate: string | null;
  existingAssignmentWindows: AssignmentCoverage[];
  jobInfo: JobTimeInfo | undefined;
  jobId: string;
  jobStartTime: string | null;
  jobEndTime: string | null;
};

export type ConflictResult =
  | { conflict: false }
  | { conflict: true; meta: Record<string, unknown> };

const DAY_MS = 24 * 60 * 60 * 1000;

export function windowsIntersect(a: TimeWindow, b: TimeWindow) {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

export function computeRequestWindow(targetDate: string | null, jobInfo: JobTimeInfo | undefined): TimeWindow | null {
  if (targetDate) {
    const dayStart = new Date(targetDate);
    if (Number.isNaN(dayStart.getTime())) return null;
    return { kind: 'day', start: dayStart, end: new Date(dayStart.getTime() + DAY_MS) };
  }
  if (!jobInfo || !jobInfo.start || !jobInfo.end) return null;
  if (jobInfo.start.getTime() >= jobInfo.end.getTime()) return null;
  return { kind: 'range', start: jobInfo.start, end: jobInfo.end };
}

export function detectConflictForAssignment(context: ConflictContext): ConflictResult {
  const { targetDate, existingAssignmentWindows, jobInfo, jobId, jobStartTime, jobEndTime } = context;
  if (existingAssignmentWindows.length === 0) {
    return { conflict: false };
  }

  const requestWindow = computeRequestWindow(targetDate, jobInfo);
  if (!requestWindow) {
    return { conflict: false };
  }

  const conflicting = existingAssignmentWindows.find((existing) => windowsIntersect(requestWindow, existing.window));
  if (!conflicting) {
    return { conflict: false };
  }

  const conflictMeta: Record<string, unknown> = {
    request_job_id: jobId,
    request_single_day: !!targetDate,
    request_window_type: requestWindow.kind,
    conflicting_job_id: conflicting.meta.job_id,
    conflicting_job_title: conflicting.meta.job_title,
    conflicting_window_type: conflicting.window.kind,
  };

  if (targetDate) {
    conflictMeta.request_assignment_date = targetDate;
  } else {
    conflictMeta.request_job_start = jobStartTime ?? null;
    conflictMeta.request_job_end = jobEndTime ?? null;
  }

  if (conflicting.meta.assignment_date) {
    conflictMeta.conflicting_assignment_date = conflicting.meta.assignment_date;
  }

  if (conflicting.meta.start_time || conflicting.meta.end_time) {
    conflictMeta.conflicting_job_start = conflicting.meta.start_time ?? null;
    conflictMeta.conflicting_job_end = conflicting.meta.end_time ?? null;
  }

  return { conflict: true, meta: conflictMeta };
}
