import React from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import {
  Ban,
  Check,
  CheckCircle,
  Mail,
  MessageCircle,
  RotateCcw,
  Trash2,
  UserPlus,
  UserX,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { cn } from '@/lib/utils';
import { MADRID_TIMEZONE } from '@/utils/timezoneUtils';
import { labelForCode } from '@/utils/roles';
import { formatUserName } from '@/utils/userName';
import { MATRIX_CELL_CHIP, resolveMatrixCellState } from '@/components/matrix/matrixCellVisuals';
import { OptimizedMatrixCellDialogs } from '@/components/matrix/optimized-matrix-cell/OptimizedMatrixCellDialogs';
import {
  assignmentStatusLabel,
  availabilityStatusLabel,
  normalizeStatus,
  offerStatusLabel,
} from '@/components/matrix/optimized-matrix-cell/helpers';
import type {
  CancelStaffingMutate,
  MatrixCellAction,
  MatrixStaffingStatus,
  SendStaffingEmailMutate,
} from '@/components/matrix/optimized-matrix-cell/types';
import { useMatrixCellAssignmentRemoval } from '@/components/matrix/optimized-matrix-cell/useMatrixCellAssignmentRemoval';

/**
 * The phone's replacement for the desktop cell's icon cluster.
 *
 * A 140px cell cannot hold four 44px targets, so on touch the cell became a
 * single big target and every action moved in here, where it gets a real label
 * and room to say what it will do. The sheet is only a launcher: each action
 * calls the same `MatrixCellAction` the icon buttons always called, so the
 * offer/availability/conflict dialogs downstream are untouched.
 */

export interface MatrixMobileCellTarget {
  technician: {
    id: string;
    first_name: string;
    nickname?: string | null;
    last_name: string;
    department: string;
    profile_picture_url?: string | null;
  };
  date: Date;
}

/** Only the fields this sheet reads; the grid's row type is wider. */
interface SheetAssignment {
  job_id?: string | null;
  status?: string | null;
  sound_role?: string | null;
  lights_role?: string | null;
  video_role?: string | null;
  job?: { title?: string | null; color?: string | null } | null;
}

interface SheetAvailability {
  status?: string | null;
  reason?: string | null;
}

interface MatrixMobileCellSheetProps {
  target: MatrixMobileCellTarget | null;
  onClose: () => void;
  assignment?: SheetAssignment | null;
  availability?: SheetAvailability | null;
  staffingStatus?: MatrixStaffingStatus | null;
  /** Extra days this technician has selected; the send flows fan out over them. */
  selectedDateCount: number;
  allowDirectAssign: boolean;
  canMarkUnavailable: boolean;
  isFridge: boolean;
  staffingDepartment?: string | null;
  onAction: (action: MatrixCellAction, jobId?: string) => void;
  sendStaffingEmail: SendStaffingEmailMutate;
  cancelStaffing: CancelStaffingMutate;
  isCancellingStaffing?: boolean;
}

interface SheetAction {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  tone?: 'default' | 'primary' | 'destructive';
  onSelect: () => void;
}

const ActionGroup = ({ label, actions }: { label: string; actions: SheetAction[] }) => {
  if (!actions.length) return null;
  return (
    <section aria-label={label} className="space-y-1">
      <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h3>
      <div className="overflow-hidden rounded-xl border bg-card">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={action.onSelect}
            className={cn(
              'flex min-h-12 w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent',
              action.tone === 'destructive' && 'text-destructive hover:bg-destructive/10',
              action.tone === 'primary' && 'text-primary hover:bg-primary/10',
            )}
          >
            <action.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{action.label}</span>
              {action.description && (
                <span className="block text-xs text-muted-foreground">{action.description}</span>
              )}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};

export const MatrixMobileCellSheet = ({
  target,
  onClose,
  assignment,
  availability,
  staffingStatus = null,
  selectedDateCount,
  allowDirectAssign,
  canMarkUnavailable,
  isFridge,
  staffingDepartment = null,
  onAction,
  sendStaffingEmail,
  cancelStaffing,
  isCancellingStaffing = false,
}: MatrixMobileCellSheetProps) => {
  const [pendingRetry, setPendingRetry] = React.useState<null | { jobId: string }>(null);
  const [pendingCancel, setPendingCancel] = React.useState<null | {
    phase: 'availability' | 'offer';
    jobId: string | null;
    allJobIds?: string[];
  }>(null);
  const [retryChannel, setRetryChannel] = React.useState<'email' | 'whatsapp'>('email');
  const [availabilityRetrying, setAvailabilityRetrying] = React.useState(false);
  // Set when an action hands control to a dialog this component owns: the sheet
  // has to close while staying mounted, or the dialog would unmount with it.
  const [handedOff, setHandedOff] = React.useState(false);

  const technician = target?.technician;
  const date = target?.date;

  const {
    multiDateRemoval,
    setMultiDateRemoval,
    isRemovingAssignment,
    checkMultiDateAssignment,
    handleRemoveAssignment,
  } = useMatrixCellAssignmentRemoval({
    assignment,
    technician: technician ?? { id: '', department: '' },
    date: date as Date,
  });

  const ownDialogOpen = !!pendingRetry || !!pendingCancel || multiDateRemoval.isOpen;

  React.useEffect(() => {
    if (handedOff && !ownDialogOpen) {
      setHandedOff(false);
      onClose();
    }
  }, [handedOff, ownDialogOpen, onClose]);

  React.useEffect(() => {
    if (!target) setHandedOff(false);
  }, [target]);

  if (!target || !technician || !date) return null;

  const displayName = formatUserName(technician.first_name, technician.nickname, technician.last_name) || 'Técnico';
  const initials = `${technician.first_name?.[0] ?? ''}${(technician.nickname || technician.last_name || '')[0] ?? ''}`
    .trim()
    .toUpperCase() || 'T';

  const hasAssignment = !!assignment;
  const assignmentStatus = hasAssignment ? normalizeStatus(assignment.status) : null;
  const isInvited = assignmentStatus === 'invited';
  const isDeclined = assignmentStatus === 'declined';
  const isUnavailable = availability?.status === 'unavailable';
  const jobId: string | undefined = assignment?.job_id ?? undefined;

  const cellState = resolveMatrixCellState({
    isSelected: false,
    hasAssignment,
    assignmentStatus,
    isUnavailable,
    availabilityStatus: staffingStatus?.availability_status ?? null,
    offerStatus: staffingStatus?.offer_status ?? null,
    isToday: false,
    isWeekend: false,
  });
  const chip = MATRIX_CELL_CHIP[cellState];

  // Hands the action to the matrix, which owns the offer/availability dialogs.
  const run = (action: MatrixCellAction, actionJobId?: string) => {
    onClose();
    onAction(action, actionJobId);
  };

  // Keeps this component mounted so the dialog it just opened survives.
  const handOff = (open: () => void) => {
    setHandedOff(true);
    open();
  };

  const multiDayNote = selectedDateCount > 1
    ? `Se aplicará a los ${selectedDateCount} días seleccionados`
    : undefined;

  const staffingActions: SheetAction[] = [];
  if (!hasAssignment && !isUnavailable && !isFridge) {
    const availabilitySettled = staffingStatus?.availability_status === 'confirmed';
    if (!availabilitySettled) {
      staffingActions.push({
        id: 'availability-wa',
        label: 'Pedir disponibilidad por WhatsApp',
        description: multiDayNote,
        icon: MessageCircle,
        onSelect: () => run('availability-wa'),
      });
      staffingActions.push({
        id: 'availability-email',
        label: 'Pedir disponibilidad por email',
        description: multiDayNote,
        icon: Mail,
        onSelect: () => run('availability-email'),
      });
    }
    staffingActions.push({
      id: 'offer-wa',
      label: 'Enviar oferta por WhatsApp',
      description: availabilitySettled ? 'Disponibilidad ya confirmada' : multiDayNote,
      icon: MessageCircle,
      tone: availabilitySettled ? 'primary' : 'default',
      onSelect: () => run('offer-details-wa', jobId),
    });
    staffingActions.push({
      id: 'offer-email',
      label: 'Enviar oferta por email',
      description: availabilitySettled ? 'Disponibilidad ya confirmada' : multiDayNote,
      icon: CheckCircle,
      tone: availabilitySettled ? 'primary' : 'default',
      onSelect: () => run('offer-details-email', jobId),
    });
  }

  const inFlightActions: SheetAction[] = [];
  if (staffingStatus?.availability_status) {
    inFlightActions.push({
      id: 'retry-availability',
      label: 'Reenviar solicitud de disponibilidad',
      icon: RotateCcw,
      onSelect: () => {
        const targetJobId = jobId || staffingStatus.availability_job_id;
        if (targetJobId) {
          handOff(() => setPendingRetry({ jobId: targetJobId }));
        } else {
          run('select-job-for-staffing');
        }
      },
    });
    inFlightActions.push({
      id: 'cancel-availability',
      label: 'Cancelar solicitud de disponibilidad',
      icon: X,
      tone: 'destructive',
      onSelect: () => {
        const targetJobId = jobId || staffingStatus.availability_job_id || null;
        const allJobIds = staffingStatus.pending_availability_job_ids || (targetJobId ? [targetJobId] : []);
        handOff(() => setPendingCancel({ phase: 'availability', jobId: targetJobId, allJobIds }));
      },
    });
  }
  if (staffingStatus?.offer_status) {
    inFlightActions.push({
      id: 'retry-offer',
      label: 'Reenviar oferta',
      icon: RotateCcw,
      onSelect: () => {
        const targetJobId = jobId || staffingStatus.offer_job_id;
        if (targetJobId) run('offer-details', targetJobId);
        else run('select-job-for-staffing');
      },
    });
    inFlightActions.push({
      id: 'cancel-offer',
      label: 'Cancelar oferta',
      icon: X,
      tone: 'destructive',
      onSelect: () => {
        const targetJobId = jobId || staffingStatus.offer_job_id || null;
        const allJobIds = staffingStatus.pending_offer_job_ids || (targetJobId ? [targetJobId] : []);
        handOff(() => setPendingCancel({ phase: 'offer', jobId: targetJobId, allJobIds }));
      },
    });
  }

  const assignmentActions: SheetAction[] = [];
  if (isInvited) {
    assignmentActions.push({
      id: 'confirm',
      label: 'Confirmar asignación',
      icon: Check,
      tone: 'primary',
      onSelect: () => run('confirm'),
    });
    assignmentActions.push({
      id: 'decline',
      label: 'Marcar como rechazada',
      icon: Ban,
      onSelect: () => run('decline'),
    });
  }
  if (hasAssignment && allowDirectAssign) {
    assignmentActions.push({
      id: 'edit',
      label: 'Editar asignación',
      icon: UserPlus,
      onSelect: () => run('assign'),
    });
  }
  if (!hasAssignment && allowDirectAssign && !isFridge) {
    assignmentActions.push({
      id: 'assign',
      label: 'Asignar a un trabajo',
      description: 'Sin pasar por disponibilidad ni oferta',
      icon: UserPlus,
      onSelect: () => run('select-job'),
    });
  }
  if (hasAssignment) {
    assignmentActions.push({
      id: 'remove',
      label: 'Quitar asignación',
      icon: Trash2,
      tone: 'destructive',
      onSelect: () => handOff(() => { void checkMultiDateAssignment(); }),
    });
  }
  if (canMarkUnavailable && !hasAssignment) {
    assignmentActions.push({
      id: 'unavailable',
      label: isUnavailable ? 'Editar la no disponibilidad' : 'Marcar como no disponible',
      icon: UserX,
      onSelect: () => run('unavailable'),
    });
  }

  const statusLine = hasAssignment
    ? assignmentStatusLabel(assignment.status)
    : isUnavailable
      ? (availability?.reason || 'No disponible')
      : staffingStatus?.offer_status
        ? `Oferta: ${offerStatusLabel(staffingStatus.offer_status)}`
        : staffingStatus?.availability_status
          ? `Disponibilidad: ${availabilityStatusLabel(staffingStatus.availability_status)}`
          : 'Sin actividad';

  return (
    <>
      <ResponsiveDialog open={!handedOff} onOpenChange={(open) => { if (!open) onClose(); }}>
        <ResponsiveDialogContent className="sm:max-w-md">
          <ResponsiveDialogHeader className="px-4 pt-2 text-left">
            <ResponsiveDialogTitle className="flex items-center gap-2.5 pr-8">
              <Avatar className="h-9 w-9 rounded-xl">
                <AvatarImage src={technician.profile_picture_url || undefined} alt={displayName} />
                <AvatarFallback className="rounded-xl bg-primary/10 text-xs font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 truncate text-base">{displayName}</span>
            </ResponsiveDialogTitle>
            {/* first-letter, not capitalize: "lunes 27 de julio" must not become
                "Lunes 27 De Julio". */}
            <ResponsiveDialogDescription className="first-letter:uppercase">
              {formatInTimeZone(date, MADRID_TIMEZONE, "EEEE d 'de' MMMM", { locale: es })}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="space-y-3 px-4 pb-4">
            {/* What the cell is showing, spelled out */}
            <div className={cn('rounded-xl border px-3 py-2.5', chip.card)}>
              <div className={cn('text-xs font-bold uppercase tracking-wide', chip.caption)}>{statusLine}</div>
              {hasAssignment && (
                <div className="mt-0.5 text-sm font-medium">
                  {assignment.job?.title || 'Asignación'}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {labelForCode(assignment.sound_role || assignment.lights_role || assignment.video_role) || 'Sin rol'}
                  </span>
                </div>
              )}
              {!hasAssignment && staffingStatus?.availability_job_title && (
                <div className="mt-0.5 text-sm font-medium">{staffingStatus.availability_job_title}</div>
              )}
              {!hasAssignment && !staffingStatus?.availability_job_title && staffingStatus?.offer_job_title && (
                <div className="mt-0.5 text-sm font-medium">{staffingStatus.offer_job_title}</div>
              )}
            </div>

            {isFridge && (
              <p className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-700 dark:text-sky-300">
                Este técnico está en la nevera: no se le puede asignar ni ofertar.
              </p>
            )}
            {isDeclined && (
              <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                Rechazó este trabajo; elige otro para volver a contar con él.
              </p>
            )}
            {selectedDateCount > 1 && (
              <p className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
                {selectedDateCount} días seleccionados para este técnico
              </p>
            )}

            <ActionGroup label="Staffing" actions={staffingActions} />
            <ActionGroup label="Solicitudes en curso" actions={inFlightActions} />
            <ActionGroup label="Asignación" actions={assignmentActions} />

            {!staffingActions.length && !inFlightActions.length && !assignmentActions.length && (
              <p className="rounded-lg border bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
                No hay acciones disponibles para esta celda. Activa «Directa» o «No disp.» en la barra de filtros
                para gestionar la asignación a mano.
              </p>
            )}
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <OptimizedMatrixCellDialogs
        date={date}
        technicianId={technician.id}
        displayName={displayName}
        staffingDepartment={staffingDepartment}
        pendingRetry={pendingRetry}
        setPendingRetry={setPendingRetry}
        retryChannel={retryChannel}
        setRetryChannel={setRetryChannel}
        availabilityRetrying={availabilityRetrying}
        setAvailabilityRetrying={setAvailabilityRetrying}
        sendStaffingEmail={sendStaffingEmail}
        pendingCancel={pendingCancel}
        setPendingCancel={setPendingCancel}
        cancelStaffing={cancelStaffing}
        isCancelling={isCancellingStaffing}
        multiDateRemoval={multiDateRemoval}
        setMultiDateRemoval={setMultiDateRemoval}
        handleRemoveAssignment={handleRemoveAssignment}
        isRemovingAssignment={isRemovingAssignment}
      />
    </>
  );
};
