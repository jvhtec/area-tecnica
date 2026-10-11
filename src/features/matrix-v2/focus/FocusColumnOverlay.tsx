import type { ColumnRun } from '@/features/matrix-v2/focus/columns';

interface FocusColumnOverlayProps {
  /** Columns that are not days of the focused job. */
  runs: ColumnRun[];
  /** Columns that are, to underline in the header. */
  jobRuns: ColumnRun[];
  cellWidth: number;
  technicianWidth: number;
  headerHeight: number;
  bodyHeight: number;
  part: 'body' | 'header';
}

/**
 * Job focus drawn as a handful of rectangles: the days outside the job dimmed
 * over the grid, the job's own days underlined in the header. Nothing mounts
 * per cell, so focusing a job never re-renders the grid.
 */
export function FocusColumnOverlay({ runs, jobRuns, cellWidth, technicianWidth, headerHeight, bodyHeight, part }: FocusColumnOverlayProps) {
  if (part === 'header') {
    return (
      <>
        {jobRuns.map((run) => (
          <div
            key={run.start}
            aria-hidden="true"
            data-focus-job-days="true"
            className="pointer-events-none absolute bottom-0 border-b-4 border-primary bg-primary/10"
            style={{ left: technicianWidth + run.start * cellWidth, width: run.count * cellWidth, top: 0 }}
          />
        ))}
      </>
    );
  }
  return (
    <>
      {runs.map((run) => (
        <div
          key={run.start}
          aria-hidden="true"
          data-focus-dim="true"
          className="pointer-events-none absolute z-[20] bg-background/70"
          style={{ left: technicianWidth + run.start * cellWidth, top: headerHeight, width: run.count * cellWidth, height: bodyHeight }}
        />
      ))}
    </>
  );
}
