import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { jobRangeLabel } from '@/features/matrix-v2/jobDays';
import { slotLabel } from '@/features/matrix-v2/inspector/labels';
import type { FocusStatus } from '@/features/matrix-v2/focus/useJobFocusSelection';
import { nextOpenSlot, type RoleSlot } from '@/features/matrix-v2/roleSlots';
import type { MatrixJob } from '@/hooks/useOptimizedMatrixData';
import { cn } from '@/lib/utils';
import { labelForCode } from '@/utils/roles';

const STATUS_OPTIONS: Array<{ value: FocusStatus; label: string }> = [
  { value: 'invited', label: 'Invitado' },
  { value: 'confirmed', label: 'Confirmado' },
];

const slotSummary = (slot: RoleSlot) => {
  const parts = [`${slot.filled} de ${slot.required} cubiertos`];
  if (slot.invited > 0) parts.push(`${slot.invited} sin confirmar`);
  parts.push(slot.open > 0 ? `${slot.open} libres` : 'completo');
  return `${labelForCode(slot.code)}: ${parts.join(', ')}`;
};

interface JobFocusBarProps {
  job: MatrixJob;
  slots: RoleSlot[] | undefined;
  status: FocusStatus;
  onStatusChange: (status: FocusStatus) => void;
  onExit: () => void;
}

/**
 * The job the matrix is focused on: what it still needs, and the status the
 * next assignments get. Sits above the grid, so it never covers a cell.
 */
export function JobFocusBar({ job, slots, status, onStatusChange, onExit }: JobFocusBarProps) {
  const next = nextOpenSlot(slots);
  return (
    <section
      aria-label={`Enfocado en ${job.title}`}
      data-testid="job-focus-bar"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-primary/5 px-3 py-2"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: job.color ?? 'hsl(var(--primary))' }} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{job.title}</p>
          <p className="text-xs text-muted-foreground">{jobRangeLabel(job)}</p>
        </div>
      </div>

      {slots && slots.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-1.5" aria-label="Huecos del trabajo">
          {slots.map((slot) => (
            <li
              key={`${slot.department}-${slot.code}`}
              aria-label={slotSummary(slot)}
              aria-current={next === slot ? 'true' : undefined}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium',
                slot.open === 0 ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-background',
                next === slot && 'ring-2 ring-primary',
              )}
            >
              <span>{slotLabel({ ...slot, open: 0 })}</span>
              <span className="tabular-nums">{slot.filled}/{slot.required}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Sin huecos definidos: se pedirá el rol al asignar.</p>
      )}
      {next && (
        <p className="hidden text-xs text-muted-foreground md:block">
          Siguiente hueco: <span className="font-medium text-foreground">{labelForCode(next.code)}</span>
        </p>
      )}

      <div className="ml-auto flex items-center gap-2">
        <div role="radiogroup" aria-label="Estado al asignar" className="inline-flex rounded-md border bg-background p-0.5">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={status === option.value}
              onClick={() => onStatusChange(option.value)}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                status === option.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onExit} title="Salir del enfoque (Esc)">
          <X className="mr-1 h-4 w-4" aria-hidden="true" />
          Salir
        </Button>
      </div>
    </section>
  );
}
