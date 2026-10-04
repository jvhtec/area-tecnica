export interface ColumnRun {
  /** First column and number of columns of a run. */
  start: number;
  count: number;
}

/**
 * Maximal runs of grid columns that are not days of the focused job. The focus
 * overlay dims exactly these, so a job over three days costs one or two
 * elements however wide the range is.
 */
export function dimmedColumnRuns(dateKeys: string[], jobDayKeys: Iterable<string>): ColumnRun[] {
  const jobDays = new Set(jobDayKeys);
  const runs: ColumnRun[] = [];
  let open: ColumnRun | null = null;
  dateKeys.forEach((dateKey, index) => {
    if (jobDays.has(dateKey)) {
      open = null;
      return;
    }
    if (open) {
      open.count += 1;
    } else {
      open = { start: index, count: 1 };
      runs.push(open);
    }
  });
  return runs;
}

/** Index of the first column of the job on the grid, or -1. */
export const firstJobColumn = (dateKeys: string[], jobDayKeys: Iterable<string>): number => {
  const jobDays = new Set(jobDayKeys);
  return dateKeys.findIndex((dateKey) => jobDays.has(dateKey));
};

/** Maximal runs of columns that are days of the job (what the header underlines). */
export function jobColumnRuns(dateKeys: string[], jobDayKeys: Iterable<string>): ColumnRun[] {
  const jobDays = new Set(jobDayKeys);
  const runs: ColumnRun[] = [];
  let open: ColumnRun | null = null;
  dateKeys.forEach((dateKey, index) => {
    if (!jobDays.has(dateKey)) {
      open = null;
      return;
    }
    if (open) {
      open.count += 1;
    } else {
      open = { start: index, count: 1 };
      runs.push(open);
    }
  });
  return runs;
}
