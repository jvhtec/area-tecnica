import { addMonths, addWeeks } from 'date-fns';

export type JobsViewMode = 'upcoming' | 'past';

type JobTimes = { start_time?: string | null; end_time?: string | null };
type AssignmentLike = { jobs?: JobTimes | null } & JobTimes;

const shiftBySpan = (from: Date, timeSpan: string, direction: 1 | -1): Date => {
    switch (timeSpan) {
        case '1week':
            return addWeeks(from, direction);
        case '1month':
            return addMonths(from, direction);
        case '3months':
            return addMonths(from, 3 * direction);
        case '2weeks':
        default:
            return addWeeks(from, 2 * direction);
    }
};

/**
 * Splits the technician's jobs into "Próximos" and "Pasados".
 *
 * A job stays upcoming until it has *ended*, not merely started: a technician
 * mid-shift (or mid-way through a multi-day festival) still needs it in front of
 * them. A job with no end time is treated as ending when it starts.
 */
export function filterJobsForView<T extends AssignmentLike>(
    assignments: T[],
    viewMode: JobsViewMode,
    timeSpan: string,
    now: Date = new Date(),
): T[] {
    return assignments.filter((assignment) => {
        const jobData = assignment.jobs || assignment;
        if (!jobData?.start_time) return false;

        const jobStart = new Date(jobData.start_time);
        const parsedEnd = jobData.end_time ? new Date(jobData.end_time) : null;
        const jobEnd = parsedEnd && !Number.isNaN(parsedEnd.getTime()) && parsedEnd > jobStart
            ? parsedEnd
            : jobStart;

        if (viewMode === 'upcoming') {
            // Not finished yet, and starting within the selected span.
            return jobEnd >= now && jobStart <= shiftBySpan(now, timeSpan, 1);
        }
        // Finished, and it ended within the selected span.
        return jobEnd < now && jobEnd >= shiftBySpan(now, timeSpan, -1);
    });
}
