import React, { memo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Check, X, UserX, Ban, Refrigerator, Plus } from 'lucide-react';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { formatMadridDayKey, isMadridToday, isMadridWeekend } from '@/utils/timezoneUtils';
import { toast } from 'sonner';
import { labelForCode } from '@/utils/roles';
import { formatUserName } from '@/utils/userName';
import { pickTextColor, rgbaFromHex } from '@/utils/color';
import { OptimizedMatrixCellDialogs } from '@/components/matrix/optimized-matrix-cell/OptimizedMatrixCellDialogs';
import { OptimizedMatrixCellTooltip } from '@/components/matrix/optimized-matrix-cell/OptimizedMatrixCellTooltip';
import { MatrixCellStaffingActions } from '@/components/matrix/optimized-matrix-cell/MatrixCellStaffingActions';
import { MatrixCellStaffingBadges } from '@/components/matrix/optimized-matrix-cell/MatrixCellStaffingBadges';
import {
  assignmentStatusLabel,
  availabilityStatusLabel,
  EMPTY_PROFILE_NAMES_MAP,
  normalizeStatus,
  offerStatusLabel,
} from '@/components/matrix/optimized-matrix-cell/helpers';
import type { MatrixCellAction, OptimizedMatrixCellProps } from '@/components/matrix/optimized-matrix-cell/types';
import { useMatrixCellAssignmentRemoval } from '@/components/matrix/optimized-matrix-cell/useMatrixCellAssignmentRemoval';
import {
  MATRIX_CELL_CHIP,
  MATRIX_CELL_SURFACE,
  resolveMatrixCellState,
} from '@/components/matrix/matrixCellVisuals';

const EMPTY_DECLINED_JOB_IDS: Set<string> = new Set<string>();

export const OptimizedMatrixCell = memo(({
  technician,
  date,
  assignment,
  availability,
  width,
  height,
  isSelected,
  onSelect: onSelectProp,
  onClick: onClickProp,
  onPrefetch: onPrefetchProp,
  onOptimisticUpdate: onOptimisticUpdateProp,
  onRender,
  jobId,
  allowDirectAssign = false,
  allowMarkUnavailable = false,
  declinedJobIdsSet = EMPTY_DECLINED_JOB_IDS,
  staffingStatusProvided = null,
  staffingStatusByDateProvided = null,
  profileNamesMap = EMPTY_PROFILE_NAMES_MAP,
  isFridge = false,
  mobile = false,
  staffingDepartment = null,
  hideStaffingEmailButtons = false,
  hideStaffingWhatsappButtons = false,
  sendStaffingEmail,
  isSendingStaffingEmail = false,
  cancelStaffing,
  isCancellingStaffing = false,
}: OptimizedMatrixCellProps) => {
  // The parent's handlers are shared by every cell; bind this cell's identity
  // here so the rest of the component keeps its simple call signatures.
  const technicianId = technician.id;
  const onSelect = useCallback(
    (selected: boolean) => onSelectProp(technicianId, date, selected),
    [onSelectProp, technicianId, date],
  );
  const onClick = useCallback(
    (action: MatrixCellAction, selectedJobId?: string) => onClickProp(technicianId, date, action, selectedJobId),
    [onClickProp, technicianId, date],
  );
  const onPrefetch = useCallback(() => onPrefetchProp?.(technicianId), [onPrefetchProp, technicianId]);
  const onOptimisticUpdate = useCallback(
    (status: string) => {
      if (assignment?.job_id) onOptimisticUpdateProp?.(technicianId, assignment.job_id, status);
    },
    [onOptimisticUpdateProp, technicianId, assignment?.job_id],
  );

  // Track cell renders for performance monitoring
  React.useEffect(() => {
    onRender?.();
  }, [onRender]);

  const isTodayCell = isMadridToday(date);
  const isWeekendCell = isMadridWeekend(date);
  const hasAssignment = !!assignment;
  const assignmentStatus = hasAssignment ? normalizeStatus(assignment.status) : null;
  const isConfirmedAssignment = assignmentStatus === 'confirmed';
  const isDeclinedAssignment = assignmentStatus === 'declined';
  const isUnavailable = availability?.status === 'unavailable';
  const confirmedBg = isConfirmedAssignment ? (assignment?.job?.color || null) : null;
  const confirmedTextColor = confirmedBg ? pickTextColor(confirmedBg) : undefined;
  const confirmedSubTextColor = confirmedTextColor ? (rgbaFromHex(confirmedTextColor, 0.9) || confirmedTextColor) : undefined;
  const displayName = formatUserName(technician.first_name, technician.nickname, technician.last_name) || 'Técnico';

  // Staffing status: use provided batched data exclusively for performance
  const staffingStatusByJob = staffingStatusProvided;
  const staffingStatusByDate = staffingStatusByDateProvided;
  const [availabilityRetrying, setAvailabilityRetrying] = React.useState(false);
  const [pendingRetry, setPendingRetry] = React.useState<null | { jobId: string }>(null);
  const [pendingCancel, setPendingCancel] = React.useState<null | { phase: 'availability' | 'offer', jobId: string | null, allJobIds?: string[] }>(null);
  const [retryChannel, setRetryChannel] = React.useState<'email' | 'whatsapp'>('email');
  const {
    multiDateRemoval,
    setMultiDateRemoval,
    isRemovingAssignment,
    checkMultiDateAssignment,
    handleRemoveAssignment,
  } = useMatrixCellAssignmentRemoval({ assignment, technician, date });

  // Use job-specific status for assigned cells, date-based status for empty cells
  const staffingStatus = isConfirmedAssignment ? null : (hasAssignment ? staffingStatusByJob : staffingStatusByDate);

  // Handle staffing email actions
  const handleStaffingEmail = useCallback((e: React.MouseEvent, phase: 'availability' | 'offer') => {
    e.stopPropagation();

    // For requests on empty cells, we need to select a job first
    if (phase === 'availability' && !hasAssignment && !jobId) {
      // For the mail icon we want to send via email directly, without channel dialog
      onClick('availability-email');
      return;
    }

    if (phase === 'offer') {
      // Determine target job id: assignment > prop (do not auto-pick by status)
      const targetJobId = jobId || assignment?.job_id;
      if (!targetJobId) {
        onClick('offer-details-email');
        return;
      }
      // Block staffing for jobs previously declined by this technician
      if (declinedJobIdsSet.has(targetJobId)) {
        toast.error('Este trabajo ya fue rechazado; elige otro para este técnico.');
        return;
      }
      // Open offer details dialog with email channel intent
      onClick('offer-details-email', targetJobId);
      return;
    }

    // Availability path: direct email intent
    const targetJobId = jobId || assignment?.job_id || undefined;
    onClick('availability-email', targetJobId);
  }, [jobId, assignment?.job_id, hasAssignment, assignment, onClick, declinedJobIdsSet]);

  const handleMouseEnter = useCallback(() => {
    // Prefetch data when hovering over cell
    onPrefetch?.();
  }, [onPrefetch]);

  const handleCellClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();

    // Ctrl+Click or Alt+Click to toggle cell selection (for Stream Deck shortcuts)
    if (e.ctrlKey || e.altKey || e.metaKey) {
      onSelect(!isSelected);
      return;
    }

    // Mark unavailable toggle mode: left-click directly toggles unavailability (no dialog)
    if (allowMarkUnavailable && !hasAssignment) {
      onClick('toggle-unavailable');
      return;
    }

    if (hasAssignment) {
      // Without direct assign the cell is read-only; the staffing icon buttons
      // stay available either way.
      if (allowDirectAssign) onClick('assign'); // Edit existing assignment
    } else if (isUnavailable) {
      onClick('unavailable'); // Edit unavailability
    } else if (allowDirectAssign) {
      onClick('select-job'); // Create new assignment
    }
  }, [hasAssignment, isUnavailable, onClick, onSelect, isSelected, allowDirectAssign, allowMarkUnavailable]);

  const handleRightClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onClick('unavailable');
  }, [onClick]);

  const handleStatusClick = useCallback((e: React.MouseEvent, action: 'confirm' | 'decline') => {
    e.stopPropagation();

    // Optimistic update
    onOptimisticUpdate?.(action === 'confirm' ? 'confirmed' : 'declined');

    // Then trigger actual update
    onClick(action);
  }, [onClick, onOptimisticUpdate]);

  // One vocabulary for the whole grid: the state decides both the cell wash and
  // the rounded status card drawn inside it (see matrixCellVisuals).
  const cellState = resolveMatrixCellState({
    isSelected,
    hasAssignment,
    assignmentStatus,
    isUnavailable,
    availabilityStatus: staffingStatus?.availability_status ?? null,
    offerStatus: staffingStatus?.offer_status ?? null,
    isToday: isTodayCell,
    isWeekend: isWeekendCell,
  });
  const chip = MATRIX_CELL_CHIP[cellState];

  // Get staffing button states
  const canAskAvailability = !hasAssignment && !isUnavailable && (!staffingStatus?.availability_status || staffingStatus.availability_status === 'declined' || staffingStatus.availability_status === 'expired');
  // !hasAssignment matches canAskAvailability and canOfferFallback below: an
  // offer is for staffing someone who is not on the job yet. Without it, an
  // assigned cell whose availability is confirmed rendered the desktop action
  // group over the remove button — same top-right corner, and the actions carry
  // z-10 — so the assignment could not be removed.
  const canSendOffer = !hasAssignment && staffingStatus?.availability_status === 'confirmed' && (!staffingStatus?.offer_status || staffingStatus.offer_status === 'declined' || staffingStatus.offer_status === 'expired');
  // Manual progression: allow offering even if availability isn't in confirmed state
  const canOfferFallback = !hasAssignment && !isUnavailable && !canSendOffer;
  const canShowOfferAction = canSendOffer || canOfferFallback;
  const showAvailabilityEmail = canAskAvailability && !hideStaffingEmailButtons;
  const showAvailabilityWhatsapp = canAskAvailability && !hideStaffingWhatsappButtons;
  const showOfferEmail = canShowOfferAction && !hideStaffingEmailButtons;
  const showOfferWhatsapp = canShowOfferAction && !hideStaffingWhatsappButtons;
  const hasVisibleStaffingAction =
    showAvailabilityEmail || showAvailabilityWhatsapp || showOfferEmail || showOfferWhatsapp;

  // Corner budget, so nothing stacks on top of anything else:
  //   top-left     status indicators (fridge / declined), side by side
  //   top-right    remove-assignment (assigned cells) or staffing actions (desktop)
  //   bottom-left  staffing status badges — lifted one row on mobile, where the
  //                actions share the bottom edge
  //   bottom-right assignment status badge (assigned) or staffing actions (mobile)
  // The remove button and the staffing actions never coexist: the actions are
  // only offered on cells without an assignment.
  const statusBadgesPosClass = mobile ? 'absolute bottom-9 left-1.5' : 'absolute bottom-1.5 left-1.5';
  const actionButtonsPosClass = mobile ? 'absolute bottom-1.5 right-1.5' : 'absolute top-1.5 right-1.5';

  // A plain click only does something in one of the edit modes; without one the
  // cell is read-only and should not advertise itself as clickable.
  const plainClickIsActionable =
    allowDirectAssign || (allowMarkUnavailable && !hasAssignment) || isUnavailable;

  // The staffing conversation gets its own caption line so an empty-looking cell
  // says what is in flight, instead of only being tinted.
  const staffingCaption = !hasAssignment && !isUnavailable
    ? (staffingStatus?.offer_status
      ? { title: 'Oferta', detail: offerStatusLabel(staffingStatus.offer_status) }
      : staffingStatus?.availability_status
        ? { title: 'Disponibilidad', detail: availabilityStatusLabel(staffingStatus.availability_status) }
        : null)
    : null;

  const showStatusCard = hasAssignment || isUnavailable || !!staffingCaption;

  // The corner controls (confirm/decline, the P/R badge, the staffing chips) are
  // drawn over the card, so the card's own text has to step out of their way.
  const hasBottomControls = hasAssignment
    ? !isConfirmedAssignment
    : !!(staffingStatus?.availability_status || staffingStatus?.offer_status);

  // Narrowed once so the badge row can take a non-nullable status.
  const staffingStatusForBadges =
    staffingStatus && (staffingStatus.availability_status || staffingStatus.offer_status) ? staffingStatus : null;

  // A confirmed assignment is painted with the job colour; a pending or declined
  // one keeps the state tint and carries the colour as a left rail, so a
  // technician's jobs stay visually groupable either way.
  const cardStyle = isConfirmedAssignment && assignment?.job?.color
    ? { background: assignment.job.color, borderColor: assignment.job.color }
    : hasAssignment && assignment?.job?.color
      ? { borderLeftColor: assignment.job.color, borderLeftWidth: '3px' }
      : undefined;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'group/cell relative flex flex-col p-1 text-xs transition-colors duration-150',
            plainClickIsActionable ? 'cursor-pointer' : 'cursor-default',
            MATRIX_CELL_SURFACE[cellState],
            isTodayCell && !isSelected && 'shadow-[inset_2px_0_0_0_hsl(var(--primary))]',
          )}
          style={{
            width: `${width}px`,
            height: `${height}px`,
          }}
          data-matrix-cell="true"
          data-matrix-cell-state={cellState}
          onClick={handleCellClick}
          onContextMenu={handleRightClick}
          onMouseEnter={handleMouseEnter}
        >
          {/* Selection indicator */}
          {isSelected && (
            <div className="absolute top-0 right-0 z-20" title="Celda seleccionada para shortcuts">
              <div className="rounded-bl-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                ✓ SEL.
              </div>
            </div>
          )}

          {/* Status indicators — one row so they never stack on each other */}
          {(isFridge || isDeclinedAssignment) && (
            <div className="absolute top-1.5 left-1.5 z-10 flex items-center gap-0.5">
              {isFridge && (
                <span title="En la nevera: no asignable">
                  <Refrigerator className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                </span>
              )}
              {isDeclinedAssignment && (
                <span title="Rechazado: no se puede reasignar a este trabajo">
                  <Ban className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                </span>
              )}
            </div>
          )}

          {/* Status card: the cell's content, drawn as one rounded object */}
          {showStatusCard && (
            <div
              className={cn(
                'pointer-events-none flex h-full min-w-0 flex-col overflow-hidden rounded-lg border px-1.5',
                hasBottomControls
                  ? mobile
                    ? 'justify-start pt-1'
                    : 'justify-center pb-4'
                  : 'justify-center',
                chip.card,
              )}
              style={cardStyle}
            >
              {hasAssignment && (
                <div className={cn('min-w-0', mobile ? 'pr-6' : 'pr-6')}>
                  <div
                    className={cn('truncate text-xs font-semibold leading-tight', !isConfirmedAssignment && chip.caption)}
                    style={{ color: isConfirmedAssignment ? confirmedTextColor : undefined }}
                  >
                    {assignment.job?.title || 'Asignación'}
                  </div>
                  <div
                    className={cn('truncate text-[11px] leading-tight', !isConfirmedAssignment && chip.detail)}
                    style={{ color: isConfirmedAssignment ? confirmedSubTextColor : undefined }}
                  >
                    {labelForCode(assignment.sound_role || assignment.lights_role || assignment.video_role)}
                  </div>
                  {assignment.single_day && assignment.assignment_date && (
                    <div
                      className={cn('truncate text-[10px] leading-tight', !isConfirmedAssignment && 'text-muted-foreground')}
                      style={{ color: isConfirmedAssignment ? confirmedSubTextColor : undefined }}
                    >
                      Día único: {formatMadridDayKey(assignment.assignment_date, 'd MMM', { locale: es })}
                    </div>
                  )}
                </div>
              )}

              {!hasAssignment && isUnavailable && (
                <div className="flex min-w-0 items-center gap-1.5">
                  <UserX className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
                      No disp.
                    </div>
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">
                      {availability.reason || 'No disponible'}
                    </div>
                  </div>
                </div>
              )}

              {!hasAssignment && !isUnavailable && staffingCaption && (
                <div className="min-w-0">
                  <div className={cn('truncate text-xs font-bold uppercase leading-tight tracking-wide', chip.caption)}>
                    {staffingCaption.title}
                  </div>
                  {staffingCaption.detail && (
                    <div className={cn('truncate text-xs leading-tight', chip.detail)}>
                      {staffingCaption.detail}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Empty cell affordance */}
          {!showStatusCard && allowDirectAssign && (
            <div className="pointer-events-none flex h-full flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-border/70 text-muted-foreground opacity-0 transition-opacity group-hover/cell:opacity-100">
              <Plus className="h-3.5 w-3.5" />
              <span className="text-xs font-medium leading-none">Asignar</span>
            </div>
          )}

          {/* Staffing Status Badges */}
          {staffingStatusForBadges && (
            <MatrixCellStaffingBadges
              staffingStatus={staffingStatusForBadges}
              availabilityRetrying={availabilityRetrying}
              positionClass={statusBadgesPosClass}
              onRetryAvailability={() => {
                const targetJobId = jobId || assignment?.job_id || staffingStatusByDate?.availability_job_id;
                if (targetJobId) {
                  setPendingRetry({ jobId: targetJobId });
                } else {
                  onClick('select-job-for-staffing');
                }
              }}
              onCancelAvailability={() => {
                const targetJobId = jobId || assignment?.job_id || staffingStatusByDate?.availability_job_id || null;
                // Include all pending job IDs to cancel all requests for this date
                const allJobIds = staffingStatusByDate?.pending_availability_job_ids || (targetJobId ? [targetJobId] : []);
                setPendingCancel({ phase: 'availability', jobId: targetJobId, allJobIds });
              }}
              onRetryOffer={() => {
                // Determine job for offer; then open offer-details to choose role
                const targetJobId = jobId || assignment?.job_id || staffingStatusByDate?.offer_job_id;
                if (targetJobId) {
                  onClick('offer-details', targetJobId);
                } else {
                  onClick('select-job-for-staffing');
                }
              }}
              onCancelOffer={() => {
                const targetJobId = jobId || assignment?.job_id || staffingStatusByDate?.offer_job_id || null;
                // Include all pending job IDs to cancel all requests for this date
                const allJobIds = staffingStatusByDate?.pending_offer_job_ids || (targetJobId ? [targetJobId] : []);
                setPendingCancel({ phase: 'offer', jobId: targetJobId, allJobIds });
              }}
            />
          )}

          {/* Staffing Action Buttons */}
          {hasVisibleStaffingAction && (
            <MatrixCellStaffingActions
              positionClass={actionButtonsPosClass}
              mobile={mobile}
              disabled={isSendingStaffingEmail}
              canAskAvailability={canAskAvailability}
              canShowOfferAction={canShowOfferAction}
              canSendOffer={canSendOffer}
              showAvailabilityEmail={showAvailabilityEmail}
              showAvailabilityWhatsapp={showAvailabilityWhatsapp}
              showOfferEmail={showOfferEmail}
              showOfferWhatsapp={showOfferWhatsapp}
              onAvailabilityEmail={(e) => handleStaffingEmail(e, 'availability')}
              onAvailabilityWhatsapp={(e) => {
                e.stopPropagation();
                onClick('availability-wa');
              }}
              onOfferEmail={(e) => handleStaffingEmail(e, 'offer')}
              onOfferWhatsapp={(e) => {
                e.stopPropagation();
                onClick('offer-details-wa', jobId || assignment?.job_id || undefined);
              }}
            />
          )}

          {/* Assignment controls, drawn over the status card */}
          {hasAssignment && (
            <>
              {assignment.status === 'invited' && (
                <div className="absolute bottom-1.5 left-1.5 z-10 flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 rounded-full bg-background/70 p-0 shadow-sm hover:bg-emerald-500/20"
                    onClick={(e) => handleStatusClick(e, 'confirm')}
                    title="Confirmar"
                  >
                    <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 rounded-full bg-background/70 p-0 shadow-sm hover:bg-rose-500/20"
                    onClick={(e) => handleStatusClick(e, 'decline')}
                    title="Rechazar"
                  >
                    <X className="h-3 w-3 text-rose-600 dark:text-rose-400" />
                  </Button>
                </div>
              )}

              {/* Status Badge - moved to not conflict with staffing badges */}
              {!isConfirmedAssignment && (
                <div className="absolute bottom-1.5 right-1.5 z-10" title={assignmentStatusLabel(assignment.status)}>
                  <Badge variant="secondary" className="h-4 px-1 py-0 text-xs">
                    {isDeclinedAssignment ? 'R' : 'P'}
                  </Badge>
                </div>
              )}

              <div className="absolute top-1.5 right-1.5 z-10">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 rounded-full bg-background/70 p-0 shadow-sm hover:bg-rose-500/20"
                  title="Eliminar asignación"
                  onClick={(e) => { e.stopPropagation(); checkMultiDateAssignment(); }}
                >
                  <X className="h-3 w-3 text-rose-600 dark:text-rose-400" />
                </Button>
              </div>
            </>
          )}

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
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-xs p-2"
      >
        <OptimizedMatrixCellTooltip
          displayName={displayName}
          technician={technician}
          hasAssignment={hasAssignment}
          assignment={assignment}
          isUnavailable={isUnavailable}
          availability={availability}
          staffingStatusByDate={staffingStatusByDate}
          profileNamesMap={profileNamesMap}
        />
      </TooltipContent>
    </Tooltip>
  );
});

OptimizedMatrixCell.displayName = 'OptimizedMatrixCell';
