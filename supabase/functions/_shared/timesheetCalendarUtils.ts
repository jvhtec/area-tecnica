export type TimesheetCalendarRow = {
  job_id: string;
  date: string;
};

export type TimesheetAssignmentBlock = {
  job_id: string;
  dates: string[];
  start_date: string;
  end_date: string;
};

function toDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function isNextDay(prev: string, current: string) {
  const prevDate = toDate(prev);
  const currDate = toDate(current);
  const diff = currDate.getTime() - prevDate.getTime();
  return diff === 24 * 3600 * 1000;
}

export function groupTimesheetAssignments(rows: TimesheetCalendarRow[]): TimesheetAssignmentBlock[] {
  const jobMap = new Map<string, Set<string>>();

  rows.forEach((row) => {
    if (!row.job_id || !row.date) return;
    const dateSet = jobMap.get(row.job_id) ?? new Set<string>();
    dateSet.add(row.date);
    jobMap.set(row.job_id, dateSet);
  });

  const blocks: TimesheetAssignmentBlock[] = [];

  jobMap.forEach((dates, jobId) => {
    const sortedDates = Array.from(dates).sort();
    let currentBlock: string[] = [];
    let prevDate: string | null = null;

    sortedDates.forEach((date) => {
      if (!currentBlock.length) {
        currentBlock.push(date);
        prevDate = date;
        return;
      }

      if (prevDate && isNextDay(prevDate, date)) {
        currentBlock.push(date);
        prevDate = date;
        return;
      }

      blocks.push({ job_id: jobId, dates: [...currentBlock], start_date: currentBlock[0]!, end_date: currentBlock[currentBlock.length - 1]! });
      currentBlock = [date];
      prevDate = date;
    });

    if (currentBlock.length) {
      blocks.push({ job_id: jobId, dates: [...currentBlock], start_date: currentBlock[0]!, end_date: currentBlock[currentBlock.length - 1]! });
    }
  });

  return blocks;
}
