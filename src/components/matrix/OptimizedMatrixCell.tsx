
import React, { memo, useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, Check, X, UserX, Mail, CheckCircle, Ban, Refrigerator, MessageCircle, Loader2 } from 'lucide-react';
import { format, isToday, isWeekend } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
import { cn } from '@/lib/utils';
import { useCancelStaffingRequest, useSendStaffingEmail } from '@/features/staffing/hooks/useStaffing';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { labelForCode } from '@/utils/roles';
import { formatUserName } from '@/utils/userName';
import { pickTextColor, rgbaFromHex } from '@/utils/color';
import { determineFlexDepartmentsForAssignment } from '@/utils/flexCrewAssignments';

interface TimesheetDateRow {
  date: string;
}

interface MultiDateRemovalState {
  isOpen: boolean;
  isLoading: boolean;
  otherDates: string[];  // Other timesheet dates for this job/tech (excluding current)
  otherDatesCount: number;
  currentDate: string | null;  // The date of the cell being removed
  removeOption: 'single' | 'all';
}

interface OptimizedMatrixCellProps {
  technician: {
    id: string;
    first_name: string;
    nickname?: string | null;
    last_name: string;
    department: string;
  };
  date: Date;
  assignment?: any;
  availability?: any;
  width: number;
  height: number;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onClick: (action: 'select-job' | 'select-job-for-staffing' | 'assign' | 'unavailable' | 'confirm' | 'decline' | 'offer-details' | 'offer-details-wa' | 'offer-details-email' | 'availability-wa' | 'availability-email' | 'toggle-unavailable', selectedJobId?: string) => void;
  onPrefetch?: () => void;
  onOptimisticUpdate?: (status: string) => void;
  onRender?: () => void;
  jobId?: string;
  allowDirectAssign?: boolean;
  allowMarkUnavailable?: boolean;
  declinedJobIdsSet?: Set<string>;
  staffingStatusProvided?: { availability_status: any; offer_status: any } | null;
  staffingStatusByDateProvided?: {
    availability_status: any;
    offer_status: any;
    availability_job_id?: string | null;
    offer_job_id?: string | null;
    availability_requested_by?: string | null;
    availability_created_at?: string | null;
    offer_requested_by?: string | null;
    offer_created_at?: string | null;
    pending_availability_job_ids?: string[];
    pending_offer_job_ids?: string[];
  } | null;
  profileNamesMap?: Map<string, string>;
  isFridge?: boolean;
  mobile?: boolean;
}

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
  profileNamesMap = new Map<string, string>(),
  isFridge = false,
  mobile = false
}: OptimizedMatrixCellProps) => {
  // Track cell renders for performance monitoring
  React.useEffect(() => {
    onRender?.();
  }, [onRender]);

  const isTodayCell = isToday(date);
  const isWeekendCell = isWeekend(date);
  const hasAssignment = !!assignment;
  const isDeclinedAssignment = hasAssignment && assignment.status === 'declined';
  const isUnavailable = availability?.status === 'unavailable';
  const confirmedBg = hasAssignment && assignment.status === 'confirmed' ? (assignment?.job?.color || null) : null;
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
  const [multiDateRemoval, setMultiDateRemoval] = React.useState<MultiDateRemovalState>({
    isOpen: false,
    isLoading: false,
    otherDates: [],
    otherDatesCount: 0,
    currentDate: null,
    removeOption: 'single'
  });
  const [isRemovingAssignment, setIsRemovingAssignment] = React.useState(false);
  const [retryChannel, setRetryChannel] = React.useState<'email' | 'whatsapp'>('email');

  // Check if tech has timesheets on other dates for this same job
  const checkMultiDateAssignment = useCallback(async () => {
    if (!assignment?.job_id) return;

    const currentDateStr = format(date, 'yyyy-MM-dd');
    setMultiDateRemoval(prev => ({ ...prev, isOpen: true, isLoading: true, currentDate: currentDateStr }));

    try {
      // Get all timesheets for this job/technician combination
      const { data: timesheets, error: timesheetError } = await supabase
        .from('timesheets')
        .select('date')
        .eq('job_id', assignment.job_id)
        .eq('technician_id', technician.id)
        .eq('is_active', true)
        .neq('date', currentDateStr);

      if (timesheetError) throw timesheetError;

      const otherDates = ((timesheets || []) as TimesheetDateRow[]).map((t) => t.date);

      setMultiDateRemoval({
        isOpen: true,
        isLoading: false,
        otherDates,
        otherDatesCount: otherDates.length,
        currentDate: currentDateStr,
        removeOption: 'single'
      });
    } catch (error) {
      console.error('Error checking multi-date assignment:', error);
      // On error, show simple removal dialog
      setMultiDateRemoval({
        isOpen: true,
        isLoading: false,
        otherDates: [],
        otherDatesCount: 0,
        currentDate: currentDateStr,
        removeOption: 'single'
      });
    }
  }, [assignment?.job_id, technician.id, date]);

  // Remove assignment based on user selection
  const handleRemoveAssignment = useCallback(async (removeAll: boolean) => {
    if (!assignment?.job_id) return;

    setIsRemovingAssignment(true);

    try {
      if (removeAll || multiDateRemoval.otherDatesCount === 0) {
        // Remove entire assignment + all timesheets
        const { data, error } = await supabase.rpc('manage_assignment_lifecycle', {
          p_job_id: assignment.job_id,
          p_technician_id: technician.id,
          p_action: 'cancel',
          p_delete_mode: 'hard'
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        // Remove Flex crew assignment if applicable
        const flexDepartments = determineFlexDepartmentsForAssignment(assignment, technician.department);
        if (flexDepartments.length > 0) {
          await Promise.allSettled(flexDepartments.map(async (department) => {
            try {
              await supabase.functions.invoke('manage-flex-crew-assignments', {
                body: {
                  job_id: assignment.job_id,
                  technician_id: technician.id,
                  department,
                  action: 'remove'
                }
              });
            } catch (flexError) {
              console.error('Failed to remove Flex crew assignment:', flexError);
            }
          }));
        }

        // Send push notification
        try {
          void supabase.functions.invoke('push', {
            body: {
              action: 'broadcast',
              type: 'assignment.removed',
              job_id: assignment.job_id,
              recipient_id: technician.id,
              technician_id: technician.id
            }
          });
        } catch (pushErr) {
          console.warn('Failed to send assignment removal notification:', pushErr);
        }

        const message = multiDateRemoval.otherDatesCount > 0
          ? `${multiDateRemoval.otherDatesCount + 1} días eliminados de la asignación`
          : 'Asignación eliminada';
        toast.success(message);
      } else {
        // Remove only the current date's timesheet, keep assignment active
        const { error } = await supabase
          .from('timesheets')
          .delete()
          .eq('job_id', assignment.job_id)
          .eq('technician_id', technician.id)
          .eq('date', multiDateRemoval.currentDate);

        if (error) throw error;

        toast.success('Día eliminado de la asignación');
      }

      setMultiDateRemoval(prev => ({ ...prev, isOpen: false }));
      window.dispatchEvent(new CustomEvent('assignment-updated'));
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error(String(error) || 'No se pudo eliminar la asignación');
      }
    } finally {
      setIsRemovingAssignment(false);
    }
  }, [assignment, technician.id, technician.department, multiDateRemoval.otherDatesCount, multiDateRemoval.currentDate]);

  // Use job-specific status for assigned cells, date-based status for empty cells
  const staffingStatus = hasAssignment ? staffingStatusByJob : staffingStatusByDate;

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

  // Skip noisy debug logs in production

  const statusBadgesPosClass = mobile ? 'absolute top-1 right-1' : 'absolute bottom-1 left-1';
  const actionButtonsPosClass = mobile ? 'absolute bottom-1 left-1' : 'absolute top-1 right-1';
  const actionBtnSize = mobile ? 'h-8 w-8' : 'h-5 w-5';
  const formatDateTimeEs = (iso?: string | null) => {
    if (!iso) return null;
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return null;
    return formatInTimeZone(parsed, 'Europe/Madrid', 'd MMM yyyy, HH:mm', { locale: es });
  };
  const assignmentStatusLabel = (status?: string | null) => {
    const normalizedStatus = status?.trim().toLowerCase();
    if (normalizedStatus === 'confirmed') return 'Confirmado';
    if (normalizedStatus === 'declined') return 'Rechazado';
    if (normalizedStatus === 'invited') return 'Invitado';
    return 'Pendiente';
  };
  const availabilityStatusLabel = (status?: string | null) => {
    if (status === 'requested' || status === 'pending') return 'Solicitada';
    if (status === 'confirmed') return 'Confirmada';
    if (status === 'declined') return 'Rechazada';
    return null;
  };
  const offerStatusLabel = (status?: string | null) => {
    if (status === 'sent' || status === 'pending') return 'Enviada';
    if (status === 'confirmed') return 'Confirmada';
    if (status === 'declined') return 'Rechazada';
    return null;
  };
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
            background: hasAssignment && assignment.status === 'confirmed' && assignment?.job?.color
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
                      const targetJobId = jobId || assignment?.job_id || (staffingStatusByDate as any)?.availability_job_id;
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
                      const targetJobId = jobId || assignment?.job_id || (staffingStatusByDate as any)?.availability_job_id || null;
                      // Include all pending job IDs to cancel all requests for this date
                      const allJobIds = (staffingStatusByDate as any)?.pending_availability_job_ids || (targetJobId ? [targetJobId] : []);
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
                      const targetJobId = jobId || assignment?.job_id || (staffingStatusByDate as any)?.offer_job_id;
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
                      const targetJobId = jobId || assignment?.job_id || (staffingStatusByDate as any)?.offer_job_id || null;
                      // Include all pending job IDs to cancel all requests for this date
                      const allJobIds = (staffingStatusByDate as any)?.pending_offer_job_ids || (targetJobId ? [targetJobId] : []);
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
          {(canAskAvailability || canSendOffer || canOfferFallback) && (
            <div className={`${actionButtonsPosClass} flex gap-1 z-10`}>
              {canAskAvailability && (
                <>
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
                </>
              )}
              {(canSendOffer || canOfferFallback) && (
                <>
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
                </>
              )}
            </div>
          )}
          {/* Assignment Content */}
          {hasAssignment && (
            <div className="flex-1 overflow-hidden">
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
              {hasAssignment && (
                <div className="absolute bottom-1 right-1">
                  <Badge
                    variant={assignment.status === 'confirmed' ? 'default' : 'secondary'}
                    className="text-xs px-1 py-0 h-4"
                  >
                    {assignment.status === 'confirmed' ? 'C' :
                      assignment.status === 'declined' ? 'R' : 'P'}
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

          {pendingRetry && (
            <Dialog open={true} onOpenChange={(v) => !v && setPendingRetry(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reenviar solicitud de disponibilidad</DialogTitle>
                  <DialogDescription>Elige el canal y reenvía la solicitud de disponibilidad.</DialogDescription>
                </DialogHeader>
                <div className="py-2">
                  <div className="space-y-3">
                    <label className="font-medium text-sm text-foreground">Canal</label>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="availability-retry-channel"
                          checked={retryChannel === 'email'}
                          onChange={() => setRetryChannel('email')}
                        />
                        <span>Email</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="availability-retry-channel"
                          checked={retryChannel === 'whatsapp'}
                          onChange={() => setRetryChannel('whatsapp')}
                        />
                        <span>WhatsApp</span>
                      </label>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPendingRetry(null)}>Cancelar</Button>
                  <Button onClick={() => {
                    if (!pendingRetry) return;
                    setAvailabilityRetrying(true);
                    sendStaffingEmail(
                      ({ job_id: pendingRetry.jobId, profile_id: technician.id, phase: 'availability', channel: retryChannel, target_date: format(date, 'yyyy-MM-dd'), single_day: true } as any),
                      {
                        onSuccess: () => {
                          setAvailabilityRetrying(false);
                          setPendingRetry(null);
                          toast.success('Solicitud de disponibilidad reenviada');
                        },
                        onError: (error) => {
                          setAvailabilityRetrying(false);
                          setPendingRetry(null);
                          toast.error(`No se pudo reenviar la solicitud de disponibilidad: ${error.message}`);
                        }
                      }
                    );
                  }} disabled={availabilityRetrying}>
                    {availabilityRetrying ? 'Reenviando…' : 'Reenviar'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {pendingCancel && (
            <Dialog open={true} onOpenChange={(v) => !v && setPendingCancel(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{pendingCancel.phase === 'availability' ? '¿Cancelar solicitud de disponibilidad?' : '¿Cancelar oferta?'}</DialogTitle>
                  <DialogDescription>
                    Esto marcará la fase de {pendingCancel.phase === 'availability' ? 'disponibilidad' : 'oferta'} como cancelada para {displayName}.
                    {pendingCancel.allJobIds && pendingCancel.allJobIds.length > 1 && (
                      <span className="block mt-1 text-xs text-muted-foreground">
                        Se cancelarán {pendingCancel.allJobIds.length} solicitudes pendientes en esta fecha.
                      </span>
                    )}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPendingCancel(null)}>Mantener</Button>
                  <Button onClick={async () => {
                    // Cancel ALL pending job IDs for this date to fully clear the cell
                    const jobIdsToCancel = pendingCancel.allJobIds?.length
                      ? pendingCancel.allJobIds
                      : (pendingCancel.jobId ? [pendingCancel.jobId] : []);

                    if (!jobIdsToCancel.length) {
                      setPendingCancel(null);
                      return;
                    }

                    try {
                      // Cancel all job IDs in parallel
                      await Promise.all(
                        jobIdsToCancel.map(jid =>
                          new Promise<void>((resolve, reject) => {
                            cancelStaffing(
                              { job_id: jid, profile_id: technician.id, phase: pendingCancel.phase },
                              {
                                onSuccess: () => resolve(),
                                onError: (e: any) => reject(e)
                              }
                            );
                          })
                        )
                      );
                      setPendingCancel(null);
                      toast.success(`${pendingCancel.phase === 'availability' ? 'Disponibilidad' : 'Oferta'} cancelada`);
                    } catch (e: any) {
                      toast.error(e?.message || 'No se pudo cancelar');
                    }
                  }} disabled={isCancelling}>
                    {isCancelling ? 'Cancelando…' : 'Cancelar'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {multiDateRemoval.isOpen && (
            <Dialog open={true} onOpenChange={(v) => !v && setMultiDateRemoval(prev => ({ ...prev, isOpen: false }))}>
              <DialogContent
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <DialogHeader>
                  <DialogTitle>¿Eliminar asignación?</DialogTitle>
                  <DialogDescription>
                    {multiDateRemoval.isLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Comprobando otras fechas asignadas...
                      </span>
                    ) : multiDateRemoval.otherDatesCount > 0 ? (
                      <>
                        {displayName} está asignado a este trabajo durante <strong>{multiDateRemoval.otherDatesCount + 1} días</strong>.
                        ¿Qué deseas eliminar?
                      </>
                    ) : (
                      <>Se eliminará la asignación de {displayName} de este trabajo.</>
                    )}
                  </DialogDescription>
                </DialogHeader>

                {!multiDateRemoval.isLoading && multiDateRemoval.otherDatesCount > 0 && (
                  <div className="py-4">
                    <RadioGroup
                      value={multiDateRemoval.removeOption}
                      onValueChange={(value: 'single' | 'all') =>
                        setMultiDateRemoval(prev => ({ ...prev, removeOption: value }))
                      }
                      className="space-y-3"
                    >
                      <div className="flex items-center space-x-3">
                        <RadioGroupItem value="single" id="remove-single" />
                        <Label htmlFor="remove-single" className="cursor-pointer">
                          Solo este día ({multiDateRemoval.currentDate})
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3">
                        <RadioGroupItem value="all" id="remove-all" />
                        <Label htmlFor="remove-all" className="cursor-pointer">
                          Todos los días ({multiDateRemoval.otherDatesCount + 1} días - elimina la asignación completa)
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={(event) => {
                      event.stopPropagation();
                      setMultiDateRemoval(prev => ({ ...prev, isOpen: false }));
                    }}
                    disabled={isRemovingAssignment}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleRemoveAssignment(multiDateRemoval.removeOption === 'all');
                    }}
                    disabled={multiDateRemoval.isLoading || isRemovingAssignment}
                  >
                    {isRemovingAssignment ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Eliminando...
                      </span>
                    ) : multiDateRemoval.removeOption === 'all' && multiDateRemoval.otherDatesCount > 0 ? (
                      `Eliminar ${multiDateRemoval.otherDatesCount + 1} días`
                    ) : (
                      'Eliminar'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-xs p-2"
      >
        <div className="space-y-1 text-sm">
          <div className="font-semibold">
            {displayName}
          </div>
          <div className="text-muted-foreground">
            {technician.department}
          </div>
          {hasAssignment && (
            <div className="text-xs">
              <div>{assignment.job?.title}</div>
              <div className="text-muted-foreground">
                {labelForCode(assignment.sound_role || assignment.lights_role || assignment.video_role)}
              </div>
              {assignment.single_day && assignment.assignment_date && (
                <div className="text-muted-foreground">
                  Día único: {format(new Date(`${assignment.assignment_date}T00:00:00`), 'MMM d')}
                </div>
              )}
              <div className={`capitalize ${assignment.status === 'confirmed' ? 'text-green-600' : assignment.status === 'declined' ? 'text-red-600' : 'text-yellow-600'}`}>
                Estado: {assignmentStatusLabel(assignment.status)}
              </div>
              {assignment.assigned_by && profileNamesMap.has(assignment.assigned_by) && (
                <div className="text-muted-foreground">
                  Asignado por: {profileNamesMap.get(assignment.assigned_by)}
                </div>
              )}
              {assignment.assigned_at && formatDateTimeEs(assignment.assigned_at) && (
                <div className="text-muted-foreground">
                  Fecha: {formatDateTimeEs(assignment.assigned_at)}
                </div>
              )}
            </div>
          )}
          {!hasAssignment && !isUnavailable && staffingStatusByDate && (
            <div className="text-xs space-y-2 pt-1">
              {availabilityStatusLabel((staffingStatusByDate as any).availability_status) && (
                <div>
                  <div className="text-yellow-700">
                    Disponibilidad: {availabilityStatusLabel((staffingStatusByDate as any).availability_status)}
                  </div>
                  {(staffingStatusByDate as any).availability_requested_by && profileNamesMap.has((staffingStatusByDate as any).availability_requested_by) && (
                    <div className="text-muted-foreground">
                      Enviado por: {profileNamesMap.get((staffingStatusByDate as any).availability_requested_by)}
                    </div>
                  )}
                  {(staffingStatusByDate as any).availability_created_at && formatDateTimeEs((staffingStatusByDate as any).availability_created_at) && (
                    <div className="text-muted-foreground">
                      Fecha: {formatDateTimeEs((staffingStatusByDate as any).availability_created_at)}
                    </div>
                  )}
                </div>
              )}
              {offerStatusLabel((staffingStatusByDate as any).offer_status) && (
                <div>
                  <div className="text-blue-700">
                    Oferta: {offerStatusLabel((staffingStatusByDate as any).offer_status)}
                  </div>
                  {(staffingStatusByDate as any).offer_requested_by && profileNamesMap.has((staffingStatusByDate as any).offer_requested_by) && (
                    <div className="text-muted-foreground">
                      Enviado por: {profileNamesMap.get((staffingStatusByDate as any).offer_requested_by)}
                    </div>
                  )}
                  {(staffingStatusByDate as any).offer_created_at && formatDateTimeEs((staffingStatusByDate as any).offer_created_at) && (
                    <div className="text-muted-foreground">
                      Fecha: {formatDateTimeEs((staffingStatusByDate as any).offer_created_at)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {isUnavailable && !hasAssignment && (
            <div className="text-xs text-muted-foreground">
              No disponible{availability.notes ? `: ${availability.notes}` : ''}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
});

OptimizedMatrixCell.displayName = 'OptimizedMatrixCell';
