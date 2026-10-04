import { useState } from 'react';
import { Briefcase, Check, CircleSlash, Loader2, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface BatchBarJob {
  id: string;
  title: string;
  range: string;
}

interface BatchActionBarProps {
  cells: number;
  people: number;
  canEdit: boolean;
  progress: { done: number; total: number } | null;
  jobs: BatchBarJob[];
  /** What Quitar would take away, for its confirmation. */
  removal: { pairs: number; people: number; days: number };
  onAssign: (jobId: string, status: 'invited' | 'confirmed') => void;
  onConfirm: () => void;
  onRemove: () => void;
  onMarkUnavailable: () => void;
  onClear: () => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * What the selection can do, in one bar: nothing opens a dialog. Assigning asks
 * only for the job (and Invitado or Confirmado); removing asks once, right here,
 * with the count of what goes.
 */
export function BatchActionBar({ cells, people, canEdit, progress, jobs, removal, onAssign, onConfirm, onRemove, onMarkUnavailable, onClear }: BatchActionBarProps) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [status, setStatus] = useState<'invited' | 'confirmed'>('invited');
  const busy = progress !== null;

  return (
    <section
      aria-label="Acciones sobre la selección"
      data-testid="batch-bar"
      data-batch-bar="true"
      className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card/95 p-2 shadow-xl backdrop-blur"
    >
      <span className="pl-1 text-xs font-semibold" aria-live="polite">
        {busy
          ? <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Aplicando {progress.done}/{progress.total}…</span>
          : `${plural(cells, 'celda', 'celdas')} · ${plural(people, 'persona', 'personas')}`}
      </span>

      {canEdit && !confirmingRemove && (
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Popover open={assignOpen} onOpenChange={setAssignOpen}>
            <PopoverTrigger asChild>
              <Button type="button" size="sm" className="h-9" disabled={busy}>
                <Briefcase className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Asignar a…
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-80 p-2">
              <div role="radiogroup" aria-label="Estado al asignar" className="mb-2 inline-flex rounded-md border bg-background p-0.5">
                {([['invited', 'Invitado'], ['confirmed', 'Confirmado']] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={status === value}
                    onClick={() => setStatus(value)}
                    className={cn('rounded px-2.5 py-1 text-xs font-medium', status === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {jobs.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">Ningún trabajo con equipo cae en los días elegidos.</p>
              ) : (
                <ul className="max-h-56 space-y-0.5 overflow-auto">
                  {jobs.map((job) => (
                    <li key={job.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                        onClick={() => {
                          setAssignOpen(false);
                          onAssign(job.id, status);
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate">{job.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{job.range}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </PopoverContent>
          </Popover>
          <Button type="button" size="sm" variant="outline" className="h-9" disabled={busy} onClick={onConfirm}>
            <Check className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Confirmar
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-9" disabled={busy} onClick={onMarkUnavailable}>
            <CircleSlash className="mr-1.5 h-4 w-4" aria-hidden="true" />
            No disponible
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-9 text-destructive" disabled={busy} onClick={() => setConfirmingRemove(true)}>
            <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Quitar
          </Button>
        </div>
      )}

      {canEdit && confirmingRemove && (
        <div role="alertdialog" aria-label="Confirmar la retirada" className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium">
            {removal.pairs === 0
              ? 'No hay asignaciones en la selección.'
              : `¿Quitar ${plural(removal.days, 'día', 'días')} de ${plural(removal.people, 'persona', 'personas')}? No se puede deshacer.`}
          </span>
          {removal.pairs > 0 && (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="h-9"
              onClick={() => {
                setConfirmingRemove(false);
                onRemove();
              }}
            >
              Quitar
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => setConfirmingRemove(false)}>
            Cancelar
          </Button>
        </div>
      )}

      <Button type="button" size="sm" variant="ghost" className={cn('h-9 px-2', !canEdit && 'ml-auto')} onClick={onClear} disabled={busy} aria-label="Limpiar la selección">
        <X className="h-4 w-4" aria-hidden="true" />
        <span className="ml-1 text-xs">Limpiar</span>
      </Button>
    </section>
  );
}
