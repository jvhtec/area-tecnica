import React, { memo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Calendar, Check, X, UserX, Mail, CheckCircle, Ban, Refrigerator, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatMadridDateKey, isMadridToday, isMadridWeekend } from '@/utils/timezoneUtils';
import { toast } from 'sonner';
import { labelForCode } from '@/utils/roles';
import { formatUserName } from '@/utils/userName';
import { pickTextColor, rgbaFromHex } from '@/utils/color';
import { OptimizedMatrixCellDialogs } from '@/components/matrix/optimized-matrix-cell/OptimizedMatrixCellDialogs';
import { OptimizedMatrixCellTooltip } from '@/components/matrix/optimized-matrix-cell/OptimizedMatrixCellTooltip';
import { assignmentStatusLabel, EMPTY_PROFILE_NAMES_MAP, normalizeStatus } from '@/components/matrix/optimized-matrix-cell/helpers';
import type { MatrixCellAction, OptimizedMatrixCellProps } from '@/components/matrix/optimized-matrix-cell/types';
import { useMatrixCellAssignmentRemoval } from '@/components/matrix/optimized-matrix-cell/useMatrixCellAssignmentRemoval';

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
  }, [jobId, assignment?.job_id, technician.id, technician.first_name, technician.nickname, technician.last_name, hasAssignment, assignment, date, onClick, staffingStatusByDate]);

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
  }, [hasAssignment, isUnavailable, onClick, onSelect, isSelected, technician, date, assignment, allowDirectAssign, allowMarkUnavailable]);

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

  const getCellBackground = () => {
    if (isSelected) return 'bg-blue-200 dark:bg-blue-800/50';
    // Assignment present
    if (hasAssignment) {
      const status = assignment.status;
      if (status === 'confirmed') return ''; // we will paint with job color inline
      if (status === 'declined') return 'bg-rose-50 dark:bg-rose-900/20'; // declined assignment
      return 'bg-yellow-50 dark:bg-yellow-900/20'; // invited/pending -> availability-like pending
    }
    // Explicit unavailable
    if (isUnavailable) return 'bg-gray-100 dark:bg-gray-800/50';

    // Staffing hints for empty cells
    if (!hasAssignment && staffingStatus) {
      const a = (staffingStatus as any).availability_status;
      const o = (staffingStatus as any).offer_status;
      if (o === 'sent' || o === 'pending') return 'bg-blue-50 dark:bg-blue-900/20'; // offer sent
      if (o === 'confirmed') return 'bg-indigo-50 dark:bg-indigo-900/20'; // offer confirmed (should soon auto-assign)
      if (o === 'declined') return 'bg-rose-50 dark:bg-rose-900/20'; // offer declined
      if (a === 'requested' || a === 'pending') return 'bg-yellow-50 dark:bg-yellow-900/20'; // availability request sent
      if (a === 'confirmed') return 'bg-green-50 dark:bg-green-900/20'; // availability confirmed
      if (a === 'declined') return 'bg-red-50 dark:bg-red-900/20'; // availability declined
      if (a === 'expired' || o === 'expired') return 'bg-gray-100 dark:bg-gray-800/50'; // expired
    }

    if (isTodayCell) return 'bg-orange-50 dark:bg-orange-900/20';
    if (isWeekendCell) return 'bg-muted/30';
    return 'bg-card hover:bg-accent/50';
  };

  const getBorderColor = () => {
    if (isSelected) return 'border-blue-600 border-2 ring-2 ring-blue-400 ring-offset-1';
    if (hasAssignment) {
      if (assignment.job?.color) return 'border-l-4';
      return 'border-yellow-300';
    }
    if (isUnavailable) return 'border-gray-300';
    if (isTodayCell) return 'border-orange-200';
    return 'border-border';
  };

  // Get staffing button states
  const canAskAvailability = !hasAssignment && !isUnavailable && (!staffingStatus?.availability_status || staffingStatus.availability_status === 'declined' || staffingStatus.availability_status === 'expired');
  const canSendOffer = staffingStatus?.availability_status === 'confirmed' && (!staffingStatus?.offer_status || staffingStatus.offer_status === 'declined' || staffingStatus.offer_status === 'expired');
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
  const statusBadgesPosClass = mobile ? 'absolute bottom-9 left-1' : 'absolute bottom-1 left-1';
  const actionButtonsPosClass = mobile ? 'absolute bottom-1 right-1' : 'absolute top-1 right-1';
  // Four 32px buttons plus gaps overflow a 140px mobile cell; 28px fits and
  // coarse-hit-target still grows the tap area beyond the painted box.
  const actionBtnSize = mobile ? 'h-7 w-7 coarse-hit-target' : 'h-5 w-5';

  // A plain click only does something in one of the edit modes; without one the
  // cell is read-only and should not advertise itself as clickable.
  const plainClickIsActionable =
    allowDirectAssign || (allowMarkUnavailable && !hasAssignment) || isUnavailable;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'border-r border-b transition-colors duration-150',
            plainClickIsActionable ? 'cursor-pointer' : 'cursor-default',
            'flex flex-col justify-between p-1 text-xs relative',
            getCellBackground(),
            getBorderColor()
          )}
          style={{
            width: `${width}px`,
            height: `${height}px`,
            borderLeftColor: assignment?.job?.color,
            borderLeftWidth: hasAssignment && assignment?.job?.color ? '3px' : '1px',
            // If assignment is confirmed, paint background with the job color
            background: isConfirmedAssignment && assignment?.job?.color
              ? assignment.job.color
              : undefined
          }}
          data-matrix-cell="true"
          onClick={handleCellClick}
          onContextMenu={handleRightClick}
          onMouseEnter={handleMouseEnter}
        >
          {/* Selection indicator */}
          {isSelected && (
            <div className="absolute top-0 right-0 z-20" title="Celda seleccionada para shortcuts">
              <div className="bg-blue-600 text-white px-1.5 py-0.5 text-[10px] font-bold rounded-bl">
                ✓ SEL.
              </div>
            </div>
          )}

          {/* Status indicators — one row so they never stack on each other */}
          {(isFridge || isDeclinedAssignment) && (
            <div className="absolute top-1 left-1 z-10 flex items-center gap-0.5">
              {isFridge && (
                <span title="En la nevera: no asignable">
                  <Refrigerator className="h-3.5 w-3.5 text-sky-600" />
                </span>
              )}
              {isDeclinedAssignment && (
                <span title="Rechazado: no se puede reasignar a este trabajo">
                  <Ban className="h-3.5 w-3.5 text-rose-600" />
                </span>
              )}
            </div>
          )}
          {/* Staffing Status Badges */}
          {(staffingStatus?.availability_status || staffingStatus?.offer_status) && (
            <div className={`${statusBadgesPosClass} flex gap-1 z-10`}>
              {staffingStatus.availability_status && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const targetJobId = jobId || assignment?.job_id || staffingStatusByDate?.availability_job_id;
                      if (targetJobId) {
                        setPendingRetry({ jobId: targetJobId });
                      } else {
                        onClick('select-job-for-staffing');
                      }
                    }}
                    title="Reintentar solicitud de disponibilidad"
                    className="focus:outline-none"
                  >
                    <Badge
                      variant={
                        staffingStatus.availability_status === 'confirmed' ? 'default' :
                          staffingStatus.availability_status === 'declined' ? 'destructive' :
                            'secondary'
                      }
                      className={`text-xs px-1 py-0 h-3 ${availabilityRetrying ? 'ring-1 ring-blue-400' : ''}`}
                    >
                      {availabilityRetrying ? 'A:↻' : 'A:' + (staffingStatus.availability_status === 'confirmed' ? '✓' : (staffingStatus.availability_status === 'declined' ? '✗' : '?'))}
                    </Badge>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const targetJobId = jobId || assignment?.job_id || staffingStatusByDate?.availability_job_id || null;
                      // Include all pending job IDs to cancel all requests for this date
                      const allJobIds = staffingStatusByDate?.pending_availability_job_ids || (targetJobId ? [targetJobId] : []);
                      setPendingCancel({ phase: 'availability', jobId: targetJobId, allJobIds });
                    }}
                    title="Cancelar solicitud de disponibilidad"
                    className="focus:outline-none"
                  >
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-3">×</Badge>
                  </button>
                </>
              )}
              {staffingStatus.offer_status && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Determine job for offer; then open offer-details to choose role
                      const targetJobId = jobId || assignment?.job_id || staffingStatusByDate?.offer_job_id;
                      if (targetJobId) {
                        onClick('offer-details', targetJobId);
                      } else {
                        onClick('select-job-for-staffing');
                      }
                    }}
                    title="Reintentar oferta"
                    className="focus:outline-none"
                  >
                    <Badge
                      variant={
                        staffingStatus.offer_status === 'confirmed' ? 'default' :
                          staffingStatus.offer_status === 'declined' ? 'destructive' :
                            'secondary'
                      }
                      className="text-xs px-1 py-0 h-3"
                    >
                      O:{staffingStatus.offer_status === 'confirmed' ? '✓' :
                        staffingStatus.offer_status === 'declined' ? '✗' : '?'}
                    </Badge>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const targetJobId = jobId || assignment?.job_id || staffingStatusByDate?.offer_job_id || null;
                      // Include all pending job IDs to cancel all requests for this date
                      const allJobIds = staffingStatusByDate?.pending_offer_job_ids || (targetJobId ? [targetJobId] : []);
                      setPendingCancel({ phase: 'offer', jobId: targetJobId, allJobIds });
                    }}
                    title="Cancelar oferta"
                    className="focus:outline-none"
                  >
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-3">×</Badge>
                  </button>
                </>
              )}
            </div>
          )}

          {/* Staffing Action Buttons */}
          {hasVisibleStaffingAction && (
            <div className={`${actionButtonsPosClass} flex ${mobile ? 'gap-0.5' : 'gap-1'} z-10`}>
              {canAskAvailability && (
                <>
                  {showAvailabilityEmail && (
                    <Button
                      variant="ghost"
                      size={mobile ? 'default' : 'sm'}
                      className={`${actionBtnSize} p-0 hover:bg-blue-100`}
                      onClick={(e) => handleStaffingEmail(e, 'availability')}
                      disabled={isSendingStaffingEmail}
                      title="Solicitar disponibilidad"
                    >
                      <Mail className={`${mobile ? 'h-4 w-4' : 'h-3 w-3'} text-blue-600`} />
                    </Button>
                  )}
                  {showAvailabilityWhatsapp && (
                    <Button
                      variant="ghost"
                      size={mobile ? 'default' : 'sm'}
                      className={`${actionBtnSize} p-0 hover:bg-emerald-100`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onClick('availability-wa');
                      }}
                      disabled={isSendingStaffingEmail}
                      title="Solicitar disponibilidad por WhatsApp"
                    >
                      <MessageCircle className={`${mobile ? 'h-4 w-4' : 'h-3 w-3'} text-emerald-600`} />
                    </Button>
                  )}
                </>
              )}
              {canShowOfferAction && (
                <>
                  {showOfferEmail && (
                    <Button
                      variant="ghost"
                      size={mobile ? 'default' : 'sm'}
                      className={`${actionBtnSize} p-0 ${canSendOffer ? 'hover:bg-green-100' : 'opacity-80 hover:bg-muted'}`}
                      onClick={(e) => handleStaffingEmail(e, 'offer')}
                      disabled={isSendingStaffingEmail}
                      title={canSendOffer ? 'Enviar oferta' : 'Enviar oferta (progreso manual)'}
                    >
                      <CheckCircle className={`${mobile ? 'h-4 w-4' : 'h-3 w-3'} ${canSendOffer ? 'text-green-600' : 'text-muted-foreground'}`} />
                    </Button>
                  )}
                  {showOfferWhatsapp && (
                    <Button
                      variant="ghost"
                      size={mobile ? 'default' : 'sm'}
                      className={`${actionBtnSize} p-0 ${canSendOffer ? 'hover:bg-emerald-100' : 'opacity-80 hover:bg-muted'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onClick('offer-details-wa', jobId || assignment?.job_id || undefined);
                      }}
                      disabled={isSendingStaffingEmail}
                      title={canSendOffer ? 'Enviar oferta por WhatsApp' : 'Enviar oferta por WhatsApp (progreso manual)'}
                    >
                      <MessageCircle className={`${mobile ? 'h-4 w-4' : 'h-3 w-3'} ${canSendOffer ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
          {/* Assignment Content */}
          {hasAssignment && (
            <div className="flex-1 overflow-hidden pr-7">
              <div
                className={cn('font-medium truncate text-xs', assignment.status !== 'confirmed' ? '' : '')}
                style={{ color: assignment.status === 'confirmed' ? confirmedTextColor : undefined }}
              >
                {assignment.job?.title || 'Asignación'}
              </div>
              <div
                className={cn('text-xs truncate', assignment.status === 'confirmed' ? '' : 'text-muted-foreground')}
                style={{ color: assignment.status === 'confirmed' ? confirmedSubTextColor : undefined }}
              >
                {labelForCode(assignment.sound_role || assignment.lights_role || assignment.video_role)}
              </div>
              {assignment.single_day && assignment.assignment_date && (
                <div className="text-[10px] text-muted-foreground truncate">
                  Día único: {format(new Date(`${assignment.assignment_date}T00:00:00`), 'MMM d')}
                </div>
              )}

              {/* Status Actions */}
              {assignment.status === 'invited' && (
                <div className="flex gap-1 mt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 hover:bg-green-100"
                    onClick={(e) => handleStatusClick(e, 'confirm')}
                    title="Confirmar"
                  >
                    <Check className="h-3 w-3 text-green-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 hover:bg-red-100"
                    onClick={(e) => handleStatusClick(e, 'decline')}
                    title="Rechazar"
                  >
                    <X className="h-3 w-3 text-red-600" />
                  </Button>
                </div>
              )}

              {/* Status Badge - moved to not conflict with staffing badges */}
              {!isConfirmedAssignment && (
                <div className="absolute bottom-1 right-1" title={assignmentStatusLabel(assignment.status)}>
                  <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                    {isDeclinedAssignment ? 'R' : 'P'}
                  </Badge>
                </div>
              )}
              <div className="absolute top-1 right-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 hover:bg-red-100"
                  title="Eliminar asignación"
                  onClick={(e) => { e.stopPropagation(); checkMultiDateAssignment(); }}
                >
                  <X className="h-3 w-3 text-red-600" />
                </Button>
              </div>
            </div>
          )}

          {/* Unavailable Content */}
          {isUnavailable && !hasAssignment && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <UserX className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <div className="text-xs text-muted-foreground truncate">
                  {availability.reason || 'No disponible'}
                </div>
              </div>
            </div>
          )}

          {/* Empty Cell */}
          {!hasAssignment && !isUnavailable && allowDirectAssign && (
            <div className="flex-1 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
          )}

          {/* Date indicator for today */}
          {isTodayCell && (
            <div className="absolute bottom-0 left-0 w-full h-1 bg-orange-400 dark:bg-orange-600" />
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
