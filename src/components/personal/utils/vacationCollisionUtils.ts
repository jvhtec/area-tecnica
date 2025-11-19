import { addDays, isSameDay, parseISO } from 'date-fns';

export interface TimesheetCollisionRow {
  id: string;
  date: string;
  jobs: {
    id: string;
    title: string | null;
    start_time: string | null;
    end_time: string | null;
    locations?: Array<{ name?: string | null }> | { name?: string | null } | null;
  } | Array<{
    id: string;
    title: string | null;
    start_time: string | null;
    end_time: string | null;
    locations?: Array<{ name?: string | null }> | { name?: string | null } | null;
  }> | null;
}

export interface GroupedVacationCollision {
  jobId: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  locationName?: string;
  rawDates: string[];
  dateRanges: Array<{ start: string; end: string }>;
}

const normalizeLocations = (
  locations?: Array<{ name?: string | null }> | { name?: string | null } | null
): string | undefined => {
  if (!locations) return undefined;
  if (Array.isArray(locations)) {
    return locations[0]?.name ?? undefined;
  }
  return locations.name ?? undefined;
};

const normalizeJob = (
  job: TimesheetCollisionRow['jobs']
): Exclude<TimesheetCollisionRow['jobs'], Array<any>> | null => {
  if (!job) return null;
  return Array.isArray(job) ? job[0] ?? null : job;
};

export const buildDateRanges = (dates: string[]): Array<{ start: string; end: string }> => {
  if (!dates.length) return [];
  const sortedUnique = Array.from(new Set(dates)).sort();
  const ranges: Array<{ start: string; end: string }> = [];
  let rangeStart = sortedUnique[0];
  let previous = sortedUnique[0];

  for (let i = 1; i < sortedUnique.length; i += 1) {
    const current = sortedUnique[i];
    const previousDate = parseISO(previous);
    const currentDate = parseISO(current);
    if (isSameDay(addDays(previousDate, 1), currentDate)) {
      previous = current;
      continue;
    }
    ranges.push({ start: rangeStart, end: previous });
    rangeStart = current;
    previous = current;
  }

  ranges.push({ start: rangeStart, end: previous });
  return ranges;
};

export const groupTimesheetCollisions = (
  rows: TimesheetCollisionRow[]
): GroupedVacationCollision[] => {
  const grouped = new Map<
    string,
    {
      jobId: string;
      title: string;
      startTime: string | null;
      endTime: string | null;
      locationName?: string;
      dates: string[];
    }
  >();

  rows.forEach(row => {
    const job = normalizeJob(row.jobs);
    if (!job?.id) return;
    const locationName = normalizeLocations(job.locations);
    if (!grouped.has(job.id)) {
      grouped.set(job.id, {
        jobId: job.id,
        title: job.title ?? 'Job',
        startTime: job.start_time,
        endTime: job.end_time,
        locationName,
        dates: [],
      });
    }
    grouped.get(job.id)!.dates.push(row.date);
  });

  const collisions: GroupedVacationCollision[] = [];
  grouped.forEach(value => {
    const rawDates = Array.from(new Set(value.dates)).sort();
    collisions.push({
      jobId: value.jobId,
      title: value.title,
      startTime: value.startTime,
      endTime: value.endTime,
      locationName: value.locationName,
      rawDates,
      dateRanges: buildDateRanges(rawDates),
    });
  });

  return collisions.sort((a, b) => {
    const aDate = a.rawDates[0] ?? '';
    const bDate = b.rawDates[0] ?? '';
    return aDate.localeCompare(bDate);
  });
};

