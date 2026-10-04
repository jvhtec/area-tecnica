import React from 'react';
import { Check, Loader2, MailPlus, MoveRight, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateTimeEs, availabilityStatusLabel, normalizeStatus, offerStatusLabel } from '@/components/matrix/optimized-matrix-cell/helpers';
import { useInspectorSummary } from '@/features/matrix-v2/inspector/useInspectorSummary';
import { roleText } from '@/features/matrix-v2/inspector/labels';
import { formatUserName } from '@/utils/userName';
import { dayRangeLabel, jobRangeLabel, longDayLabel } from '@/features/matrix-v2/jobDays';
import { cn } from '@/lib/utils';
import type { InspectorEnvironment, InspectorTarget } from '@/features/matrix-v2/inspector/environment';
import {
  useAssignForm,
  useAssignedPair,
  useUnavailability,
  type AssignForm,
} from '@/features/matrix-v2/inspector/useCellInspectorModel';
import {
  ConflictNotice,
  DayStrip,
  InlineConfirm,
  JobList,
  Notice,
  RoleChips,
  SectionLabel,
  StateUnavailable,
} from '@/features/matrix-v2/inspector/parts';

interface BodyProps {
  env: InspectorEnvironment;
  target: InspectorTarget;
  onClose: () => void;
}

const firstName = (name: string) => name.split(' ')[0] ?? name;

/* ------------------------------------------------------------------------- */

function AssignFormView({
  form, mode, env, target, onCancel,
}: { form: AssignForm; mode: 'assign' | 'move'; env: InspectorEnvironment; target: InspectorTarget; onCancel?: () => void }) {
  const ids = React.useId();
  const jobLabel = `${ids}-job`;
  const roleLabel = `${ids}-role`;
  const dayLabel = `${ids}-days`;
  const technician = env.getTechnician(target.technicianId);
  const countHint = form.jobOptions.length === 1 ? 'único este día' : form.jobOptions.length > 1 ? `${form.jobOptions.length} este día` : undefined;
  const dateInJob = form.stripDays.includes(target.dateKey);
  const primaryLabel = mode === 'move'
    ? 'Mover aquí'
    : form.alreadyOnJob
      ? (form.existingDays.includes(target.dateKey) ? 'Guardar días' : 'Añadir este día')
      : 'Asignar';

  if (form.fridge) {
    return <p className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-800 dark:text-sky-200">En la nevera: este técnico no se puede asignar.</p>;
  }

  return (
    <div className="space-y-3">
      <div>
        <SectionLabel id={jobLabel} hint={countHint}>{mode === 'move' ? 'Mover a' : 'Trabajo'}</SectionLabel>
        <JobList options={form.jobOptions} value={form.jobId} onChange={form.pickJob} labelledBy={jobLabel} disabled={form.busy} />
      </div>

      {form.jobId && (form.stateLoading || form.stateFailed) && (
        <StateUnavailable message={form.stateMessage} loading={form.stateLoading} onRetry={form.retryState} />
      )}

      {form.jobId && form.stateReady && (
        <>
          <div>
            <SectionLabel id={roleLabel} hint={form.suggestion.reason === 'ambiguous' ? 'Elige el nivel' : 'se guarda con la asignación'}>Rol</SectionLabel>
            <RoleChips
              options={form.suggestion.options}
              value={form.role}
              suggested={form.suggestion.code}
              skillMatches={form.suggestion.skillMatches}
              onChange={form.pickRole}
              labelledBy={roleLabel}
              disabled={form.busy}
            />
          </div>
          <div>
            <SectionLabel id={dayLabel} hint={`${form.days.length} de ${form.stripDays.length}`}>Días</SectionLabel>
            <DayStrip
              days={form.stripDays}
              selected={form.days}
              conflictDays={form.conflict?.conflictDays}
              onToggle={form.toggleDay}
              onAll={form.selectAllDays}
              onThisDay={form.selectThisDayOnly}
              allCount={form.stripDays.length}
              thisDayAvailable={dateInJob && form.stripDays.length > 1}
              labelledBy={dayLabel}
              disabled={form.busy}
            />
            {form.alreadyOnJob && mode === 'assign' && (
              <p className="mt-1.5 text-xs text-muted-foreground">Ya está en este trabajo: {dayRangeLabel(form.existingDays)}.</p>
            )}
          </div>
        </>
      )}

      {form.conflict && <ConflictNotice conflict={form.conflict} busy={form.busy} onForce={form.force} onFreeDays={form.submitFreeDays} />}
      {form.notice && <Notice>{form.notice}</Notice>}

      {form.jobId && form.stateReady && !form.conflict && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="min-h-11 flex-1 sm:min-h-9" disabled={!form.canSubmit} onClick={() => { void form.submit('invited'); }}>
              {form.busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
              {primaryLabel}
            </Button>
            {mode === 'assign' && (
              <Button type="button" variant="outline" className="min-h-11 flex-1 sm:min-h-9" disabled={!form.canSubmit} onClick={() => { void form.submit('confirmed'); }}>
                Asignar confirmado
              </Button>
            )}
            {mode === 'move' && onCancel && (
              <Button type="button" variant="outline" className="min-h-11 sm:min-h-9" disabled={form.busy} onClick={onCancel}>Volver</Button>
            )}
          </div>
          {!form.role && <p className="text-xs text-muted-foreground">Elige un rol para continuar.</p>}
          {technician && form.suggestion.reason === 'none' && form.suggestion.options.length === 0 && (
            <p className="text-xs text-muted-foreground">El departamento de este técnico no tiene roles asignables.</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function EmptyView({ env, target, onClose }: BodyProps) {
  const technician = env.getTechnician(target.technicianId);
  const form = useAssignForm({ env, technician, target, onDone: onClose });
  const unavailability = useUnavailability({ env, target, onDone: onClose });
  const staffing = env.staffingByDate(target.technicianId, target.dateKey);
  const availabilityLabel = availabilityStatusLabel(staffing?.availability_status);
  const offerLabel = offerStatusLabel(staffing?.offer_status);

  return (
    <div className="space-y-3">
      {(availabilityLabel || offerLabel) && (
        <div className="space-y-0.5 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
          {availabilityLabel && <p><span className="font-semibold">Disponibilidad:</span> {availabilityLabel}{staffing?.availability_job_title ? ` · ${staffing.availability_job_title}` : ''}</p>}
          {offerLabel && <p><span className="font-semibold">Oferta:</span> {offerLabel}{staffing?.offer_job_title ? ` · ${staffing.offer_job_title}` : ''}</p>}
        </div>
      )}

      {env.canAssign ? (
        <AssignFormView form={form} mode="assign" env={env} target={target} />
      ) : (
        <p className="text-xs text-muted-foreground">Solo los responsables pueden asignar personal.</p>
      )}

      {unavailability.notice && <Notice>{unavailability.notice}</Notice>}

      {env.canAssign && !form.fridge && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 min-h-9"
            onClick={() => { onClose(); env.openStaffing(target.technicianId, target.date); }}
          >
            <MailPlus className="mr-1.5 h-4 w-4" aria-hidden="true" /> Pedir disponibilidad u oferta…
          </Button>
          {unavailability.canEdit && (
            <Button type="button" variant="ghost" size="sm" className="min-h-9" disabled={unavailability.busy} onClick={() => { void unavailability.mark(); }}>
              Marcar no disponible
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function MoveView({ env, target, onClose, fromJobId, role, status, onCancel }: BodyProps & {
  fromJobId: string; role: string | null; status: 'invited' | 'confirmed'; onCancel: () => void;
}) {
  const technician = env.getTechnician(target.technicianId);
  const form = useAssignForm({ env, technician, target, move: { fromJobId, role, status }, onDone: onClose });
  return <AssignFormView form={form} mode="move" env={env} target={target} onCancel={onCancel} />;
}

function AssignedView({ env, target, onClose }: BodyProps) {
  const technician = env.getTechnician(target.technicianId);
  const assignment = env.getAssignmentForCell(target.technicianId, target.date);
  const jobId = assignment?.job_id ?? '';
  const pair = useAssignedPair({ env, technician, target, jobId, onDone: onClose });
  const ids = React.useId();
  const roleLabel = `${ids}-role`;
  const dayLabel = `${ids}-days`;
  const name = technician ? formatUserName(technician.first_name, technician.nickname, technician.last_name) : 'Técnico';
  const job = pair.job ?? assignment?.job;
  const status = normalizeStatus(pair.status ?? assignment?.status);
  const invited = status !== 'confirmed' && status !== 'declined';
  const declined = status === 'declined';
  const readOnly = !env.canAssign;
  const assignedBy = assignment?.assigned_by ? env.profileNames.get(assignment.assigned_by) : null;
  const assignedAt = formatDateTimeEs(assignment?.assigned_at);

  if (pair.moving && pair.status && pair.stateReady) {
    return (
      <MoveView
        env={env}
        target={target}
        onClose={onClose}
        fromJobId={jobId}
        role={pair.role}
        status={status === 'confirmed' ? 'confirmed' : 'invited'}
        onCancel={pair.cancelMove}
      />
    );
  }

  return (
    <div className="space-y-3">
      {job && (
        <div className="flex items-center gap-2 rounded-lg border border-foreground/80 px-2.5 py-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: job.color || 'hsl(var(--muted-foreground))' }} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{job.title}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{jobRangeLabel(job)}</span>
        </div>
      )}

      {(pair.stateLoading || pair.stateFailed) && !readOnly && (
        <StateUnavailable message={pair.stateMessage} loading={pair.stateLoading} onRetry={pair.retryState} />
      )}

      {declined && <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-800 dark:text-rose-200">Rechazó este trabajo: no se puede reasignar a él.</p>}

      {!readOnly && invited && pair.stateReady && pair.pending !== 'decline' && (
        <div className="flex gap-2">
          <Button type="button" className="min-h-11 flex-1 bg-emerald-600 text-white hover:bg-emerald-700 sm:min-h-9" disabled={pair.busy} onClick={() => { void pair.confirm(); }}>
            {pair.busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="mr-1.5 h-4 w-4" aria-hidden="true" />} Confirmar
          </Button>
          <Button type="button" variant="outline" className="min-h-11 flex-1 border-destructive text-destructive hover:bg-destructive/10 sm:min-h-9" disabled={pair.busy} onClick={() => pair.ask('decline')}>
            <X className="mr-1.5 h-4 w-4" aria-hidden="true" /> Rechazar
          </Button>
        </div>
      )}

      {pair.pending === 'decline' && (
        <InlineConfirm title={`¿Rechazar en nombre de ${firstName(name)}?`} confirmLabel="Rechazar" busy={pair.busy} onConfirm={() => { void pair.decline(); }} onCancel={pair.cancelPending}>
          Se le retira del equipo de Flex y, en giras, la asignación se elimina. No se puede deshacer.
        </InlineConfirm>
      )}

      <div>
        <SectionLabel id={roleLabel} hint={readOnly ? undefined : 'se aplica al instante'}>Rol</SectionLabel>
        {readOnly || declined ? (
          <p className="text-sm font-medium">{roleText(pair.role)}</p>
        ) : (
          <RoleChips
            options={pair.roleOptions}
            value={pair.role}
            suggested={null}
            onChange={(code) => { void pair.changeRole(code); }}
            labelledBy={roleLabel}
            disabled={pair.busy || !pair.stateReady}
          />
        )}
      </div>

      {pair.stateReady && (
        <div>
          <SectionLabel id={dayLabel} hint={`${pair.days.length} de ${pair.stripDays.length}`}>Días</SectionLabel>
          <DayStrip
            days={pair.stripDays}
            selected={pair.days}
            onToggle={pair.toggleDay}
            labelledBy={dayLabel}
            disabled={readOnly || declined || pair.busy}
          />
          {pair.dirty && !readOnly && (
            <div className="mt-2 flex gap-2">
              <Button type="button" className="min-h-11 flex-1 sm:min-h-9" disabled={pair.busy || pair.days.length === 0 || !pair.role} onClick={() => { void pair.saveDays(); }}>
                {pair.busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />} Guardar días
              </Button>
              <Button type="button" variant="outline" className="min-h-11 sm:min-h-9" disabled={pair.busy} onClick={pair.resetDays}>Descartar</Button>
            </div>
          )}
          {pair.dirty && pair.days.length === 0 && <p className="mt-1.5 text-xs text-muted-foreground">Para quitar todos los días usa «Quitar del trabajo».</p>}
        </div>
      )}

      {pair.notice && <Notice>{pair.notice}</Notice>}

      {pair.pending === 'remove-day' && (
        <InlineConfirm title={`Quitar a ${firstName(name)} del ${longDayLabel(target.dateKey).toLowerCase()}`} confirmLabel="Quitar este día" busy={pair.busy} onConfirm={() => { void pair.remove(); }} onCancel={pair.cancelPending}>
          Los demás días se mantienen.
        </InlineConfirm>
      )}
      {pair.pending === 'remove-all' && (
        <InlineConfirm title={`Quitar a ${firstName(name)} de ${job?.title ?? 'este trabajo'}`} confirmLabel={pair.pairDates.length > 1 ? `Quitar ${pair.pairDates.length} días` : 'Quitar'} busy={pair.busy} onConfirm={() => { void pair.remove(); }} onCancel={pair.cancelPending}>
          Se eliminan sus días y los partes de horas en borrador. No se puede deshacer.
        </InlineConfirm>
      )}

      {!readOnly && pair.stateReady && !pair.pending && (
        <div className={cn('flex flex-wrap gap-2')}>
          <Button type="button" variant="outline" size="sm" className="min-h-9" disabled={pair.busy} onClick={pair.startMove}>
            <MoveRight className="mr-1.5 h-4 w-4" aria-hidden="true" /> Mover a…
          </Button>
          {pair.canRemoveDay && (
            <Button type="button" variant="outline" size="sm" className="min-h-9 border-destructive/60 text-destructive hover:bg-destructive/10" disabled={pair.busy} onClick={() => pair.ask('remove-day')}>
              <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" /> Quitar este día
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" className="min-h-9 border-destructive/60 text-destructive hover:bg-destructive/10" disabled={pair.busy} onClick={() => pair.ask('remove-all')}>
            <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" /> Quitar del trabajo
          </Button>
        </div>
      )}

      {(assignedBy || assignedAt) && (
        <p className="border-t border-dashed pt-2 text-xs text-muted-foreground">
          Asignado{assignedBy ? ` por ${assignedBy}` : ''}{assignedAt ? ` · ${assignedAt}` : ''}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function UnavailableView({ env, target, onClose }: BodyProps) {
  const unavailability = useUnavailability({ env, target, onDone: onClose });
  const reason = unavailability.availability?.reason ?? unavailability.availability?.notes ?? null;
  return (
    <div className="space-y-3">
      <p className="text-sm">{reason ? `No disponible · ${reason}` : 'Marcado como no disponible este día.'}</p>
      {unavailability.notice && <Notice>{unavailability.notice}</Notice>}
      {unavailability.canEdit ? (
        <Button type="button" variant="outline" className="min-h-11 w-full sm:min-h-9" disabled={unavailability.busy} onClick={() => { void unavailability.clear(); }}>
          {unavailability.busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />} Quitar no disponibilidad
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">Solo los responsables pueden cambiar la disponibilidad.</p>
      )}
    </div>
  );
}

/** The inspector's content for one cell. Keyed by cell so its state never leaks to the next. */
export function CellInspectorBody(props: BodyProps) {
  const summary = useInspectorSummary(props.env, props.target);
  if (summary.view === 'assignment') return <AssignedView {...props} />;
  if (summary.view === 'unavailable') return <UnavailableView {...props} />;
  return <EmptyView {...props} />;
}
