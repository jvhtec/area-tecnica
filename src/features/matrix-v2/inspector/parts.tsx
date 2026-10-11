import React from 'react';
import { AlertTriangle, Ban, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { dayParts, dayRangeLabel } from '@/features/matrix-v2/jobDays';
import type { RoleOption } from '@/types/roles';
import { slotLabel } from '@/features/matrix-v2/inspector/labels';
import type { InspectorConflict, JobOption } from '@/features/matrix-v2/inspector/useCellInspectorModel';

/** Small building blocks of the inspector; the views compose them. */

export const SectionLabel = ({ children, hint, id }: { children: React.ReactNode; hint?: React.ReactNode; id?: string }) => (
  <div className="mb-1.5 flex items-baseline justify-between gap-2">
    <span id={id} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</span>
    {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
  </div>
);

export type PillTone = 'free' | 'invited' | 'confirmed' | 'declined' | 'unavailable';
const PILL_TONES: Record<PillTone, string> = {
  free: 'bg-muted text-muted-foreground',
  invited: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300',
  confirmed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  declined: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300',
  unavailable: 'bg-muted text-muted-foreground',
};
export const StatusPill = ({ tone, children }: { tone: PillTone; children: React.ReactNode }) => (
  <span className={cn('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-bold', PILL_TONES[tone])}>{children}</span>
);

export const Notice = ({ children }: { children: React.ReactNode }) => (
  <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{children}</p>
);

/** The state could not be loaded: nothing may be sent blind, so only a retry is offered. */
export const StateUnavailable = ({ message, loading, onRetry }: { message: string; loading: boolean; onRetry: () => void }) => (
  loading ? (
    <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Cargando el estado de la asignación…
    </p>
  ) : (
    <div className="space-y-2">
      <Notice>{message}</Notice>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>Reintentar</Button>
    </div>
  )
);

export const JobList = ({
  options, value, onChange, labelledBy, disabled,
}: { options: JobOption[]; value: string; onChange: (jobId: string) => void; labelledBy: string; disabled?: boolean }) => {
  if (options.length === 0) {
    return <p className="text-xs text-muted-foreground">No hay trabajos este día.</p>;
  }
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-col gap-1.5">
      {options.map(({ job, declined, open }) => {
        const selected = job.id === value;
        return (
          <button
            key={job.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={declined || disabled}
            onClick={() => onChange(job.id)}
            className={cn(
              'flex min-h-11 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors sm:min-h-9',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
              selected ? 'border-foreground shadow-[inset_0_0_0_1px_hsl(var(--foreground))]' : 'border-border hover:bg-accent/50',
              (declined || disabled) && 'cursor-not-allowed opacity-60 hover:bg-transparent',
            )}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: job.color || 'hsl(var(--muted-foreground))' }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{job.title}</span>
            {declined ? (
              <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-destructive">
                <Ban className="h-3 w-3" aria-hidden="true" /> Rechazó este trabajo
              </span>
            ) : open.length > 0 ? (
              <span className="shrink-0 text-xs font-medium text-amber-700 dark:text-amber-300">Faltan {open.slice(0, 3).map(slotLabel).join(', ')}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};

const VISIBLE_ROLES = 6;

export const RoleChips = ({
  options, value, suggested, skillMatches, onChange, labelledBy, disabled,
}: {
  options: RoleOption[]; value: string | null; suggested: string | null; skillMatches?: ReadonlySet<string>;
  onChange: (code: string) => void; labelledBy: string; disabled?: boolean;
}) => {
  const [expanded, setExpanded] = React.useState(false);
  if (options.length === 0) {
    return <p className="text-xs text-muted-foreground">Este departamento no tiene roles asignables.</p>;
  }
  const selectedIndex = options.findIndex((option) => option.code === value);
  const showAll = expanded || options.length <= VISIBLE_ROLES || selectedIndex >= VISIBLE_ROLES;
  const visible = showAll ? options : options.slice(0, VISIBLE_ROLES);
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap gap-1.5">
      {visible.map((option) => {
        const selected = option.code === value;
        return (
          <button
            key={option.code}
            type="button"
            role="radio"
            aria-checked={selected}
            // Spelled out: browsers join the chip's pieces with different spacing.
            aria-label={`${option.label}${option.code === suggested ? ', sugerido' : ''}${option.code !== suggested && skillMatches?.has(option.code) ? ', coincide con sus habilidades' : ''}`}
            disabled={disabled}
            onClick={() => onChange(option.code)}
            className={cn(
              'inline-flex min-h-9 items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-colors sm:min-h-7',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
              selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-accent',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            {option.label}
            {option.code === suggested && (
              <span aria-hidden="true" className={cn('text-xs font-bold', selected ? 'opacity-80' : 'text-amber-700 dark:text-amber-300')}>✦ sugerido</span>
            )}
          </button>
        );
      })}
      {!showAll && (
        <button type="button" className="min-h-9 rounded-full px-2 text-xs font-medium text-muted-foreground underline underline-offset-2 sm:min-h-7" onClick={() => setExpanded(true)}>
          Ver los {options.length} roles
        </button>
      )}
    </div>
  );
};

export const DayStrip = ({
  days, selected, conflictDays, onToggle, onAll, onThisDay, allCount, thisDayAvailable, labelledBy, disabled,
}: {
  days: string[]; selected: string[]; conflictDays?: string[]; onToggle: (day: string) => void;
  onAll?: () => void; onThisDay?: () => void; allCount?: number; thisDayAvailable?: boolean; labelledBy: string; disabled?: boolean;
}) => {
  const selectedSet = new Set(selected);
  const conflicts = new Set(conflictDays ?? []);
  return (
    <div>
      <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-1.5">
        {days.map((day) => {
          const { weekday, day: number } = dayParts(day);
          const on = selectedSet.has(day);
          const clash = conflicts.has(day);
          return (
            <button
              key={day}
              type="button"
              aria-pressed={on}
              disabled={disabled}
              onClick={() => onToggle(day)}
              title={clash ? 'Este día choca con otro trabajo' : undefined}
              className={cn(
                'flex min-h-11 w-[3.25rem] flex-col items-center justify-center rounded-lg border py-1 leading-none transition-colors sm:min-h-10',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
                on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-accent',
                clash && (on ? 'border-destructive bg-destructive text-destructive-foreground' : 'border-destructive text-destructive'),
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <span className="text-xs font-semibold uppercase opacity-80">{weekday}</span>
              <span className="mt-0.5 text-sm font-extrabold tabular-nums">{number}</span>
            </button>
          );
        })}
      </div>
      {(onAll || onThisDay) && (
        <div className="mt-1.5 flex gap-3 text-xs">
          {onAll && (
            <button type="button" className="min-h-6 text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={onAll} disabled={disabled}>
              Todo el trabajo{allCount ? ` (${allCount})` : ''}
            </button>
          )}
          {onThisDay && thisDayAvailable && (
            <button type="button" className="min-h-6 text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={onThisDay} disabled={disabled}>
              Solo este día
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const ConflictNotice = ({
  conflict, busy, onForce, onFreeDays,
}: { conflict: InspectorConflict; busy: boolean; onForce: () => void; onFreeDays: () => void }) => {
  const { hardConflicts, softConflicts, unavailabilityConflicts } = conflict.details.conflicts;
  return (
    <div role="alert" className="space-y-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
      <p className="flex items-center gap-1.5 text-sm font-bold">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" /> No se ha asignado: hay un choque
      </p>
      <ul className="list-disc space-y-0.5 pl-4">
        {hardConflicts.map((job) => <li key={`h-${job.id}`}>Ya tiene confirmado <strong>{job.title}</strong></li>)}
        {softConflicts.map((job) => <li key={`s-${job.id}`}>Invitación pendiente en <strong>{job.title}</strong></li>)}
        {unavailabilityConflicts.map((item) => (
          <li key={`u-${item.date}`}>No disponible el {item.date}{item.reason ? ` (${item.reason})` : ''}</li>
        ))}
      </ul>
      <p className="text-muted-foreground">Lo comprobó el servidor al guardar. No se ha escrito nada.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={onForce}>Forzar asignación</Button>
        {conflict.freeDays.length > 0 && conflict.conflictDays.length > 0 && (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onFreeDays}>
            Solo días libres ({dayRangeLabel(conflict.freeDays)})
          </Button>
        )}
      </div>
    </div>
  );
};

/** A destructive step confirmed inside the inspector, never in a modal. */
export const InlineConfirm = ({
  title, children, confirmLabel, busy, onConfirm, onCancel,
}: { title: string; children?: React.ReactNode; confirmLabel: string; busy: boolean; onConfirm: () => void; onCancel: () => void }) => (
  <div role="alertdialog" aria-label={title} className="space-y-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
    <p className="text-sm font-bold">{title}</p>
    {children && <p className="text-muted-foreground">{children}</p>}
    <div className="flex gap-2">
      <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={onConfirm}>
        {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
        {confirmLabel}
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onCancel}>Volver</Button>
    </div>
  </div>
);

