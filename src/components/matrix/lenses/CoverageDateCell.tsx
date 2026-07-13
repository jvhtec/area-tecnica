import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { DEPARTMENT_LABELS, formatLabel } from '@/pages/job-assignment-matrix/utils';
import { coverageStatus, type CoverageByDateDept, type CoverageByDateJobDept } from '@/components/matrix/lenses/coverage';
import { LENS_HEADER_ROW_HEIGHT } from '@/components/matrix/lenses/types';

const MADRID_TIMEZONE = 'Europe/Madrid';
const MAX_VISIBLE_CHIPS = 3;

const STATUS_CLASSES: Record<string, string> = {
  complete: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  partial: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  empty: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
};

interface CoverageDateCellProps {
  date: Date;
  width: number;
  coverageByDate: CoverageByDateDept;
  coverageByDateJob: CoverageByDateJobDept;
  getJobsForDate: (date: Date) => Array<{ id: string; title: string }>;
  onOpenStaffing: (jobId: string, department: string, jobTitle: string) => void;
}

const CoverageDateCellComp = ({
  date,
  width,
  coverageByDate,
  coverageByDateJob,
  getJobsForDate,
  onOpenStaffing,
}: CoverageDateCellProps) => {
  const dateKey = formatInTimeZone(date, MADRID_TIMEZONE, 'yyyy-MM-dd');
  const deptMap = coverageByDate.get(dateKey);
  const coverageByJob = coverageByDateJob.get(dateKey);

  if (!deptMap || deptMap.size === 0) {
    return <div className="border-r flex-shrink-0" style={{ width, height: LENS_HEADER_ROW_HEIGHT }} />;
  }

  const entries = Array.from(deptMap.entries());
  const visible = entries.slice(0, MAX_VISIBLE_CHIPS);
  const overflow = entries.length - visible.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="border-r flex-shrink-0 flex items-center justify-center gap-0.5 px-0.5 hover:bg-accent/40"
          style={{ width, height: LENS_HEADER_ROW_HEIGHT }}
          aria-label={`Cobertura del ${format(date, 'd MMMM', { locale: es })}`}
        >
          {visible.map(([department, cell]) => {
            const status = coverageStatus(cell);
            return (
              <span
                key={department}
                className={cn(
                  'text-[9px] leading-none px-1 py-0.5 rounded font-medium',
                  STATUS_CLASSES[status] || 'bg-muted text-muted-foreground',
                )}
                title={`${DEPARTMENT_LABELS[department] || formatLabel(department)}: ${cell.filled}/${cell.required}`}
              >
                {cell.filled}/{cell.required}
              </span>
            );
          })}
          {overflow > 0 && <span className="text-[9px] leading-none text-muted-foreground">+{overflow}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div className="text-sm font-medium">Cobertura del {format(date, "EEEE d 'de' MMMM", { locale: es })}</div>
          {getJobsForDate(date).map((job) => {
            const jobCoverage = coverageByJob?.get(job.id);
            if (!jobCoverage || jobCoverage.size === 0) return null;
            return (
              <div key={job.id} className="border rounded-md p-2 space-y-1">
                <div className="text-sm font-medium truncate">{job.title}</div>
                {Array.from(jobCoverage.entries()).map(([department, cell]) => (
                  <div key={department} className="flex items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-medium">{DEPARTMENT_LABELS[department] || formatLabel(department)}</span>
                      <span className="text-muted-foreground ml-1">
                        {cell.filled}/{cell.required}
                      </span>
                    </div>
                    {cell.filled < cell.required && (
                      <button
                        type="button"
                        className="text-xs text-primary underline"
                        onClick={() => onOpenStaffing(job.id, department, job.title)}
                      >
                        Abrir staffing
                      </button>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const CoverageDateCell = React.memo(CoverageDateCellComp);
