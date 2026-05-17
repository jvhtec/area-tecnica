import React, { memo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Calendar, Check, X, UserX, Mail, CheckCircle, Ban, Refrigerator, MessageCircle } from 'lucide-react';
import { format, isToday, isWeekend } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCancelStaffingRequest, useSendStaffingEmail } from '@/features/staffing/hooks/useStaffing';
import { toast } from 'sonner';
import { labelForCode } from '@/utils/roles';
import { formatUserName } from '@/utils/userName';
import { pickTextColor, rgbaFromHex } from '@/utils/color';
import { OptimizedMatrixCellDialogs } from '@/components/matrix/optimized-matrix-cell/OptimizedMatrixCellDialogs';
import { OptimizedMatrixCellTooltip } from '@/components/matrix/optimized-matrix-cell/OptimizedMatrixCellTooltip';
import { assignmentStatusLabel, EMPTY_PROFILE_NAMES_MAP, normalizeStatus } from '@/components/matrix/optimized-matrix-cell/helpers';
import type { OptimizedMatrixCellProps } from '@/components/matrix/optimized-matrix-cell/types';
import { useMatrixCellAssignmentRemoval } from '@/components/matrix/optimized-matrix-cell/useMatrixCellAssignmentRemoval';

export const OptimizedMatrixCell = memo(({
  technician,
  date,
  assignment,
  availability,
  width,
  height,
  isSelected,
  onSelect,
  onClick,
  onPrefetch,
  onOptimisticUpdate,
  onRender,
  jobId,
  allowDirectAssign = false,
  allowMarkUnavailable = false,
  declinedJobIdsSet = new Set<string>(),
  staffingStatusProvided = null,
  staffingStatusByDateProvided = null,
  profileNamesMap = EMPTY_PROFILE_NAMES_MAP,
  isFridge = false,
  mobile = false,
  hideStaffingEmailButtons = false,
  hideStaffingWhatsappButtons = false,
}: OptimizedMatrixCellProps) => {
  // Track cell renders for performance monitoring
  React.useEffect(() => {
    onRender?.();
  }, [onRender]);

  const isTodayCell = isToday(date);
  const isWeekendCell = isWeekend(date);
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
  const { mutate: sendStaffingEmail, isPending: isSendingEmail } = useSendStaffingEmail();
  const { mutate: cancelStaffing, isPending: isCancelling } = useCancelStaffingRequest();
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

  // Debug logging for staffing status changes
  React.useEffect(() => {
    if (staffingStatus?.availability_status || staffingStatus?.offer_status) {
      console.log('🔵 CELL STATUS:', {
        tech: technician.id,
        date: format(date, 'yyyy-MM-dd'),
        hasAssignment,
        availabilityStatus: staffingStatus?.availability_status,
        offerStatus: staffingStatus?.offer_status,
        byDateJobId: staffingStatusByDate?.availability_job_id,
        pendingJobIds: staffingStatusByDate?.pending_availability_job_ids
      });
    }
  }, [staffingStatus?.availability_status, staffingStatus?.offer_status, technician.id, date, hasAssignment, staffingStatusByDate]);

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
        console.log('📋 No resolvable job for offer; opening job selection (email-intent)');
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
      if (allowDirectAssign) {
        onClick('assign'); // Edit existing assignment
      } else {
      }
    } else if (isUnavailable) {
      onClick('unavailable'); // Edit unavailability
    } else {
      if (allowDirectAssign) {
        onClick('select-job'); // Create new assignment
      } else {
      }
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

  // Skip noisy debug logs in production

  const statusBadgesPosClass = mobile ? 'absolute top-1 right-1' : 'absolute bottom-1 left-1';
  const actionButtonsPosClass = mobile ? 'absolute bottom-1 left-1' : 'absolute top-1 right-1';
  const actionBtnSize = mobile ? 'h-8 w-8' : 'h-5 w-5';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'border-r border-b cursor-pointer transition-colors duration-150',
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
          onClick={handleCellClick}
          onContextMenu={handleRightClick}
          onMouseEnter={handleMouseEnter}
        >
          {/* Selection indicator */}
          {isSelected && (
            <div className="absolute top-0 right-0 z-20" title="Celda seleccionada para shortcuts">
              <div className="bg-blue-600 text-white px-1.5 py-0.5 text-[10px] font-bold rounded-bl">
                ✓ SELECTED
              </div>
            </div>
          )}

          {/* Fridge indicator */}
          {isFridge && (
            <div className="absolute top-1 left-1 z-10" title="En la nevera: no asignable">
              <Refrigerator className="h-3.5 w-3.5 text-sky-600" />
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

          {/* Declined lock indicator for the job to prevent re-assigning to the same job */}
          {isDeclinedAssignment && (
            <div className="absolute top-1 left-1 z-10" title="Rechazado: no se puede reasignar a este trabajo">
              <Ban className="h-3.5 w-3.5 text-rose-600" />
            </div>
          )}

          {/* Staffing Action Buttons */}
          {hasVisibleStaffingAction && (
            <div className={`${actionButtonsPosClass} flex gap-1 z-10`}>
              {canAskAvailability && (
                <>
                  {showAvailabilityEmail && (
                    <Button
                      variant="ghost"
                      size={mobile ? 'default' : 'sm'}
                      className={`${actionBtnSize} p-0 hover:bg-blue-100`}
                      onClick={(e) => handleStaffingEmail(e, 'availability')}
                      disabled={isSendingEmail}
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
                      disabled={isSendingEmail}
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
                      disabled={isSendingEmail}
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
                      disabled={isSendingEmail}
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
            isCancelling={isCancelling}
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
