import { formatInTimeZone } from 'date-fns-tz';
import { Check, Clock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MADRID_TIMEZONE } from '@/utils/timezoneUtils';

/**
 * The "which job?" step, shared by the direct-assign and staffing pickers.
 *
 * Rows are real buttons at a 56px minimum, not clickable divs: on touch the old
 * rows were the first step of every staffing flow and had neither a reliable tap
 * size nor a name assistive tech could read.
 */

export interface PickableJob {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  color?: string;
  status: string;
}

interface JobPickerListProps {
  jobs: PickableJob[];
  selectedJobId: string;
  onSelect: (jobId: string) => void;
  declinedJobIds?: string[];
  emptyLabel?: string;
}

export const JobPickerList = ({
  jobs,
  selectedJobId,
  onSelect,
  declinedJobIds = [],
  emptyLabel = 'No hay trabajos disponibles para esta fecha',
}: JobPickerListProps) => {
  if (!jobs.length) {
    return (
      <div className="rounded-xl border border-dashed py-8 text-center">
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2" role="radiogroup" aria-label="Trabajos de la fecha">
      {jobs.map((job) => {
        const isDeclined = declinedJobIds.includes(job.id);
        const selected = selectedJobId === job.id;
        return (
          <button
            key={job.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={isDeclined}
            onClick={() => onSelect(job.id)}
            title={isDeclined ? 'El técnico rechazó este trabajo' : undefined}
            className={cn(
              'flex min-h-14 w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors',
              selected ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent/50',
              isDeclined && 'cursor-not-allowed opacity-60',
            )}
          >
            <span
              className="h-8 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: job.color || 'hsl(var(--muted-foreground))' }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{job.title}</span>
              <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {formatInTimeZone(job.start_time, MADRID_TIMEZONE, 'HH:mm')} –{' '}
                {formatInTimeZone(job.end_time, MADRID_TIMEZONE, 'HH:mm')}
              </span>
              <span className="mt-1.5 flex flex-wrap items-center gap-1">
                {isDeclined && <Badge variant="destructive" className="text-xs">Rechazado</Badge>}
                {job.status === 'Cancelado' && (
                  <Badge variant="destructive" className="text-xs">Llamar para cancelar</Badge>
                )}
                <Badge variant="secondary" className="text-xs">{job.status}</Badge>
              </span>
            </span>
            {selected && <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
};
