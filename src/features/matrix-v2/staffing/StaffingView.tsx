import React from 'react';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { InlineConfirm, JobList, Notice, RoleChips, SectionLabel, DayStrip } from '@/features/matrix-v2/inspector/parts';
import { channelLabel, type InFlightRequest, type StaffingComposer } from '@/features/matrix-v2/staffing/useStaffingComposer';
import type { StaffingConflictSummary } from '@/features/matrix-v2/staffing/conflicts';
import type { StaffingChannel, StaffingPhase } from '@/features/matrix-v2/staffing/payload';

const PHASES: Array<{ value: StaffingPhase; label: string }> = [
  { value: 'availability', label: 'Disponibilidad' },
  { value: 'offer', label: 'Oferta' },
];
const CHANNELS: StaffingChannel[] = ['email', 'whatsapp'];

const Segmented = <T extends string>({ label, options, value, onChange, disabled }: {
  label: string; options: Array<{ value: T; label: string }>; value: T; onChange: (value: T) => void; disabled?: boolean;
}) => (
  <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border bg-background p-0.5">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        role="radio"
        aria-checked={value === option.value}
        disabled={disabled}
        onClick={() => onChange(option.value)}
        className={cn(
          'min-h-9 rounded px-3 py-1 text-xs font-medium transition-colors sm:min-h-7',
          value === option.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
);

function InFlight({ request, composer }: { request: InFlightRequest; composer: StaffingComposer }) {
  const offer = request.phase === 'offer';
  const asking = composer.confirmingCancel === request.phase;
  const title = offer ? 'Oferta enviada' : 'Disponibilidad pedida';
  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
      <p className="text-xs"><span className="font-semibold">{title}</span>{request.jobTitle ? ` · ${request.jobTitle}` : ''}. Esperando respuesta.</p>
      {asking ? (
        <InlineConfirm
          title={offer ? '¿Cancelar la oferta?' : '¿Cancelar la solicitud?'}
          confirmLabel="Cancelar"
          busy={composer.busy}
          onConfirm={() => { void composer.cancel(request); }}
          onCancel={() => composer.askCancel(null)}
        >
          {request.jobIds.length > 1 ? `Se cancelarán ${request.jobIds.length} solicitudes pendientes en esta fecha.` : `Se avisará a ${composer.name}.`}
        </InlineConfirm>
      ) : (
        <div className="flex flex-wrap gap-2">
          {!offer && request.requestId && (
            <Button type="button" size="sm" variant="outline" className="min-h-9" disabled={composer.busy} onClick={() => { void composer.resend(request); }}>
              {composer.busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
              Reenviar por {channelLabel(composer.channel)}
            </Button>
          )}
          <Button type="button" size="sm" variant="ghost" className="min-h-9 text-destructive" disabled={composer.busy} onClick={() => composer.askCancel(request.phase)}>
            {offer ? 'Cancelar oferta' : 'Cancelar solicitud'}
          </Button>
        </div>
      )}
    </div>
  );
}

function ConflictInline({ conflict, busy, onSendAnyway }: { conflict: StaffingConflictSummary; busy: boolean; onSendAnyway: () => void }) {
  return (
    <div role="alert" className="space-y-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
      <p className="text-sm font-bold">No se ha enviado: hay un choque de agenda</p>
      <ul className="list-disc space-y-0.5 pl-4">
        {conflict.jobs.map((item, index) => (
          <li key={`j-${index}`}>Ya tiene <strong>{item.title}</strong>{item.range ? ` (${item.range})` : ''}{item.role ? ` · ${item.role}` : ''}</li>
        ))}
        {conflict.off.map((item, index) => (
          <li key={`o-${index}`}>No disponible: {item.label}{item.reason ? ` (${item.reason})` : ''}</li>
        ))}
      </ul>
      <p className="text-muted-foreground">Lo comprobó el servidor al enviar.</p>
      <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={onSendAnyway}>Enviar igualmente</Button>
    </div>
  );
}

/**
 * Availability requests and offers, composed where the cell is: intent first,
 * the job and its days prefilled, the person's usual channel. Nothing opens on
 * top of it and nothing is chained after it.
 */
export function StaffingView({ composer, onBack }: { composer: StaffingComposer; onBack: () => void }) {
  const ids = React.useId();
  const jobLabel = `${ids}-job`;
  const dayLabel = `${ids}-days`;
  const roleLabel = `${ids}-role`;
  const offer = composer.phase === 'offer';
  const dayCount = composer.days.length;
  const sendLabel = offer
    ? (dayCount === composer.jobDays.length ? 'Enviar oferta' : `Enviar oferta (${dayCount} ${dayCount === 1 ? 'día' : 'días'})`)
    : (dayCount === composer.jobDays.length ? 'Pedir disponibilidad' : `Pedir disponibilidad (${dayCount} ${dayCount === 1 ? 'día' : 'días'})`);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" className="-ml-2 min-h-9" onClick={onBack} disabled={composer.busy}>
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" /> Volver
        </Button>
        <Segmented label="Qué enviar" options={PHASES} value={composer.phase} onChange={composer.setPhase} disabled={composer.busy} />
      </div>

      {composer.inFlight.map((request) => <InFlight key={request.phase} request={request} composer={composer} />)}

      <div>
        <SectionLabel id={jobLabel}>Trabajo</SectionLabel>
        <JobList options={composer.jobOptions} value={composer.jobId} onChange={composer.pickJob} labelledBy={jobLabel} disabled={composer.busy} />
      </div>

      {composer.job && (
        <>
          <div>
            <SectionLabel id={dayLabel} hint={`${dayCount} de ${composer.jobDays.length}`}>Días</SectionLabel>
            <DayStrip
              days={composer.jobDays}
              selected={composer.days}
              onToggle={composer.toggleDay}
              onAll={composer.selectAllDays}
              onThisDay={composer.selectThisDayOnly}
              allCount={composer.jobDays.length}
              thisDayAvailable={composer.jobDays.length > 1}
              labelledBy={dayLabel}
              disabled={composer.busy}
            />
          </div>

          {offer && (
            <>
              <div>
                <SectionLabel id={roleLabel} hint={composer.suggestion.reason === 'ambiguous' ? 'Elige el nivel' : undefined}>Rol</SectionLabel>
                <RoleChips
                  options={composer.suggestion.options}
                  value={composer.role}
                  suggested={composer.suggestion.code}
                  skillMatches={composer.suggestion.skillMatches}
                  onChange={composer.pickRole}
                  labelledBy={roleLabel}
                  disabled={composer.busy}
                />
              </div>
              <div>
                {composer.messageOpen ? (
                  <>
                    <SectionLabel id={`${ids}-message`}>Mensaje</SectionLabel>
                    <Textarea
                      aria-labelledby={`${ids}-message`}
                      rows={3}
                      value={composer.message}
                      onChange={(event) => composer.setMessage(event.target.value)}
                      placeholder="Detalles adicionales para incluir en el mensaje"
                      disabled={composer.busy}
                    />
                  </>
                ) : (
                  <button type="button" className="min-h-9 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => composer.setMessageOpen(true)}>
                    {composer.message ? 'Incluye la descripción del trabajo · Editar mensaje' : 'Añadir un mensaje'}
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Por</span>
        <Segmented
          label="Canal"
          options={CHANNELS.map((channel) => ({ value: channel, label: channelLabel(channel) }))}
          value={composer.channel}
          onChange={composer.setChannel}
          disabled={composer.busy}
        />
      </div>

      {composer.conflict && <ConflictInline conflict={composer.conflict} busy={composer.busy} onSendAnyway={() => { void composer.send(true); }} />}
      {composer.error && <Notice>{composer.error}</Notice>}

      {!composer.conflict && (
        <Button type="button" className="min-h-11 w-full sm:min-h-9" disabled={!composer.canSend} onClick={() => { void composer.send(); }}>
          {composer.busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />}
          {sendLabel}
        </Button>
      )}
      {offer && !composer.role && composer.job && <p className="text-xs text-muted-foreground">Elige un rol para enviar la oferta.</p>}
    </div>
  );
}
