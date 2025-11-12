export type Maybe<T> = T | null | undefined;

export interface ConfirmedAssignmentRecord {
  job_id: string | number;
  assignment_date?: Maybe<string>;
  single_day?: Maybe<boolean>;
}

export interface JobSummaryRecord {
  id: string | number;
  start_time?: Maybe<string>;
  end_time?: Maybe<string>;
  title?: Maybe<string>;
}

export interface ConflictEvaluationResult {
  jobId: string | number;
  title: string | null;
  targetDate: string | null;
  reason: "window" | "date";
}

interface ConflictEvaluatorParams {
  currentJob: JobSummaryRecord;
  confirmedAssignments: Maybe<ConfirmedAssignmentRecord[]>;
  otherJobs: Maybe<JobSummaryRecord[]>;
}

type DateRange = { start: Date; end: Date };

function toKey(id: string | number) {
  return `${id}`;
}

function toDateRange(start?: Maybe<string>, end?: Maybe<string>): DateRange | null {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  return { start: startDate, end: endDate };
}

function normalizeDateOnly(value: string): string | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function dayRange(dateValue: string): DateRange | null {
  const normalized = normalizeDateOnly(dateValue);
  if (!normalized) return null;
  const start = new Date(`${normalized}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start < b.end && a.end > b.start;
}

function jobWindowOverlapsDate(job: JobSummaryRecord, dateValue: string): boolean {
  const jobRange = toDateRange(job.start_time, job.end_time);
  const dateRange = dayRange(dateValue);
  if (!jobRange || !dateRange) return false;
  return rangesOverlap(jobRange, dateRange);
}

function jobRangesOverlap(a: JobSummaryRecord, b: JobSummaryRecord): boolean {
  const rangeA = toDateRange(a.start_time, a.end_time);
  const rangeB = toDateRange(b.start_time, b.end_time);
  if (!rangeA || !rangeB) return false;
  return rangesOverlap(rangeA, rangeB);
}

export function createConflictEvaluator({
  currentJob,
  confirmedAssignments,
  otherJobs,
}: ConflictEvaluatorParams) {
  const currentJobKey = toKey(currentJob.id);
  const otherJobMap = new Map<string, JobSummaryRecord>();
  for (const job of otherJobs ?? []) {
    otherJobMap.set(toKey(job.id), job);
  }
  const sanitizedAssignments = (confirmedAssignments ?? []).filter(
    (assignment): assignment is ConfirmedAssignmentRecord =>
      assignment !== null && assignment !== undefined && assignment.job_id !== null && assignment.job_id !== undefined,
  );

  return (targetDate: string | null): ConflictEvaluationResult | null => {
    const normalizedTargetDate = targetDate ? normalizeDateOnly(targetDate) : null;
    for (const assignment of sanitizedAssignments) {
      const assignmentKey = toKey(assignment.job_id);
      if (assignmentKey === currentJobKey) continue;
      const relatedJob = otherJobMap.get(assignmentKey) ?? null;

      if (normalizedTargetDate) {
        const assignmentDate = assignment.assignment_date ? normalizeDateOnly(assignment.assignment_date) : null;
        if (assignment.single_day && assignmentDate && assignmentDate === normalizedTargetDate) {
          return {
            jobId: assignment.job_id,
            title: relatedJob?.title ?? null,
            targetDate: normalizedTargetDate,
            reason: "date",
          };
        }
        if (!assignment.single_day && relatedJob && jobWindowOverlapsDate(relatedJob, normalizedTargetDate)) {
          return {
            jobId: assignment.job_id,
            title: relatedJob?.title ?? null,
            targetDate: normalizedTargetDate,
            reason: "window",
          };
        }
        continue;
      }

      if (assignment.single_day && assignment.assignment_date) {
        const assignmentDate = normalizeDateOnly(assignment.assignment_date);
        if (assignmentDate && jobWindowOverlapsDate(currentJob, assignmentDate)) {
          return {
            jobId: assignment.job_id,
            title: relatedJob?.title ?? null,
            targetDate: assignmentDate,
            reason: "date",
          };
        }
      } else if (!assignment.single_day && relatedJob && jobRangesOverlap(currentJob, relatedJob)) {
        return {
          jobId: assignment.job_id,
          title: relatedJob?.title ?? null,
          targetDate: null,
          reason: "window",
        };
      }
    }

    return null;
  };
}

export function partitionAssignmentsByConflict(
  evaluator: (targetDate: string | null) => ConflictEvaluationResult | null,
  dates: (string | null)[],
) {
  const conflicts: ConflictEvaluationResult[] = [];
  const allowed: (string | null)[] = [];

  for (const date of dates) {
    const conflict = evaluator(date);
    if (conflict) conflicts.push(conflict);
    else allowed.push(date);
  }

  return { conflicts, allowed };
}
