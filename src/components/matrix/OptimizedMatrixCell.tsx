
import React, { memo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Calendar, Clock, Check, X, UserX, Mail, CheckCircle, Ban, Refrigerator, MessageCircle } from 'lucide-react';
import { format, isToday, isWeekend } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCancelStaffingRequest, useSendStaffingEmail } from '@/features/staffing/hooks/useStaffing';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { labelForCode } from '@/utils/roles';
import { formatUserName } from '@/utils/userName';
import { pickTextColor, rgbaFromHex } from '@/utils/color';

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
  onClick: (action: 'select-job' | 'select-job-for-staffing' | 'assign' | 'unavailable' | 'confirm' | 'decline' | 'offer-details' | 'offer-details-wa' | 'offer-details-email' | 'availability-wa' | 'availability-email', selectedJobId?: string) => void;
  onPrefetch?: () => void;
  onOptimisticUpdate?: (status: string) => void;
  onRender?: () => void;
  jobId?: string;
  allowDirectAssign?: boolean;
  declinedJobIdsSet?: Set<string>;
  staffingStatusProvided?: { availability_status: any; offer_status: any } | null;
  staffingStatusByDateProvided?: { availability_status: any; offer_status: any; availability_job_id?: string | null; offer_job_id?: string | null } | null;
  isFridge?: boolean;
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
  declinedJobIdsSet = new Set<string>(),
  staffingStatusProvided = null,
  staffingStatusByDateProvided = null,
  isFridge = false
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
  const displayName = formatUserName(technician.first_name, technician.nickname, technician.last_name) || 'Technician';

  // Staffing status: use provided batched data exclusively for performance
  const staffingStatusByJob = staffingStatusProvided;
  const staffingStatusByDate = staffingStatusByDateProvided;
  const { mutate: sendStaffingEmail, isPending: isSendingEmail } = useSendStaffingEmail();
  const { mutate: cancelStaffing, isPending: isCancelling } = useCancelStaffingRequest();
  const [availabilityRetrying, setAvailabilityRetrying] = React.useState(false);
  const [pendingRetry, setPendingRetry] = React.useState<null | { jobId: string }>(null);
  const [pendingCancel, setPendingCancel] = React.useState<null | { phase: 'availability' | 'offer', jobId: string | null }>(null);
  const [pendingRemoveAssignment, setPendingRemoveAssignment] = React.useState(false);
  const [retryChannel, setRetryChannel] = React.useState<'email' | 'whatsapp'>('email');
  
  // Use job-specific status for assigned cells, date-based status for empty cells
  const staffingStatus = hasAssignment ? staffingStatusByJob : staffingStatusByDate;

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
        toast.error('This job was already declined; choose a different job.');
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
  }, [hasAssignment, isUnavailable, onClick, technician, date, assignment, allowDirectAssign]);

  const handleStatusClick = useCallback((e: React.MouseEvent, action: 'confirm' | 'decline') => {
    e.stopPropagation();
    
    // Optimistic update
    onOptimisticUpdate?.(action === 'confirm' ? 'confirmed' : 'declined');
    
    // Then trigger actual update
    onClick(action);
  }, [onClick, onOptimisticUpdate]);

  const getCellBackground = () => {
    if (isSelected) return 'bg-blue-100 dark:bg-blue-900/30';
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
    if (isSelected) return 'border-blue-500';
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
          onMouseEnter={handleMouseEnter}
        >
      {/* Fridge indicator */}
      {isFridge && (
        <div className="absolute top-1 left-1 z-10" title="En la nevera: no asignable">
          <Refrigerator className="h-3.5 w-3.5 text-sky-600" />
        </div>
      )}
      {/* Staffing Status Badges */}
      {(staffingStatus?.availability_status || staffingStatus?.offer_status) && (
        <div className="absolute bottom-1 left-1 flex gap-1 z-10">
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
                title="Retry availability request"
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
                  setPendingCancel({ phase: 'availability', jobId: targetJobId });
                }}
                title="Cancel availability request"
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
                title="Retry offer email"
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
                  setPendingCancel({ phase: 'offer', jobId: targetJobId });
                }}
                title="Cancel offer"
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
        <div className="absolute top-1 left-1 z-10" title="Declined: cannot reassign to this job">
          <Ban className="h-3.5 w-3.5 text-rose-600" />
        </div>
      )}

      {/* Staffing Action Buttons */}
      {(canAskAvailability || canSendOffer || canOfferFallback) && (
        <div className="absolute top-1 right-1 flex gap-1 z-10">
          {canAskAvailability && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 hover:bg-blue-100"
                onClick={(e) => handleStaffingEmail(e, 'availability')}
                disabled={isSendingEmail}
                title="Ask availability"
              >
                <Mail className="h-3 w-3 text-blue-600" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 hover:bg-emerald-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onClick('availability-wa');
                }}
                disabled={isSendingEmail}
                title="Ask availability via WhatsApp"
              >
                <MessageCircle className="h-3 w-3 text-emerald-600" />
              </Button>
            </>
          )}
          {(canSendOffer || canOfferFallback) && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className={`h-5 w-5 p-0 ${canSendOffer ? 'hover:bg-green-100' : 'opacity-80 hover:bg-muted'}`}
                onClick={(e) => handleStaffingEmail(e, 'offer')}
                disabled={isSendingEmail}
                title={canSendOffer ? 'Send offer' : 'Send offer (manual progress)'}
              >
                <CheckCircle className={`h-3 w-3 ${canSendOffer ? 'text-green-600' : 'text-muted-foreground'}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`h-5 w-5 p-0 ${canSendOffer ? 'hover:bg-emerald-100' : 'opacity-80 hover:bg-muted'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onClick('offer-details-wa', jobId || assignment?.job_id || undefined);
                }}
                disabled={isSendingEmail}
                title={canSendOffer ? 'Send offer via WhatsApp' : 'Send offer via WhatsApp (manual progress)'}
              >
                <MessageCircle className={`h-3 w-3 ${canSendOffer ? 'text-emerald-600' : 'text-muted-foreground'}`} />
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
            {assignment.job?.title || 'Assignment'}
          </div>
          <div 
            className={cn('text-xs truncate', assignment.status === 'confirmed' ? '' : 'text-muted-foreground')}
            style={{ color: assignment.status === 'confirmed' ? confirmedSubTextColor : undefined }}
          >
            {labelForCode(assignment.sound_role || assignment.lights_role || assignment.video_role)}
          </div>
          
          {/* Status Actions */}
          {assignment.status === 'invited' && (
            <div className="flex gap-1 mt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 hover:bg-green-100"
                onClick={(e) => handleStatusClick(e, 'confirm')}
                title="Confirm"
              >
                <Check className="h-3 w-3 text-green-600" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 hover:bg-red-100"
                onClick={(e) => handleStatusClick(e, 'decline')}
                title="Decline"
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
                 assignment.status === 'declined' ? 'D' : 'P'}
              </Badge>
            </div>
          )}
          <div className="absolute top-1 right-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 hover:bg-red-100"
              title="Remove assignment"
              onClick={(e) => { e.stopPropagation(); setPendingRemoveAssignment(true); }}
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
              {availability.reason || 'Unavailable'}
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
              <DialogTitle>Resend availability request</DialogTitle>
              <DialogDescription>Choose channel and resend the availability request.</DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <div className="space-y-3">
                <label className="font-medium text-sm text-foreground">Channel</label>
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
              <Button variant="outline" onClick={() => setPendingRetry(null)}>Cancel</Button>
              <Button onClick={() => {
                if (!pendingRetry) return;
                setAvailabilityRetrying(true);
                sendStaffingEmail(
                  ({ job_id: pendingRetry.jobId, profile_id: technician.id, phase: 'availability', channel: retryChannel, target_date: date.toISOString(), single_day: true } as any),
                  {
                    onSuccess: () => {
                      setAvailabilityRetrying(false);
                      setPendingRetry(null);
                      toast.success('Availability request resent');
                    },
                    onError: (error) => {
                      setAvailabilityRetrying(false);
                      setPendingRetry(null);
                      toast.error(`Failed to resend availability request: ${error.message}`);
                    }
                  }
                );
              }} disabled={availabilityRetrying}>
                {availabilityRetrying ? 'Resending…' : 'Resend'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {pendingCancel && (
        <Dialog open={true} onOpenChange={(v) => !v && setPendingCancel(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{pendingCancel.phase === 'availability' ? 'Cancel availability request?' : 'Cancel offer?'}</DialogTitle>
              <DialogDescription>
                This will mark the {pendingCancel.phase} as cancelled (expired) for {displayName}.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPendingCancel(null)}>Keep</Button>
              <Button onClick={() => {
                if (!pendingCancel.jobId) { setPendingCancel(null); return; }
                cancelStaffing(
                  { job_id: pendingCancel.jobId, profile_id: technician.id, phase: pendingCancel.phase },
                  {
                    onSuccess: () => {
                      setPendingCancel(null);
                      toast.success(`${pendingCancel.phase === 'availability' ? 'Availability' : 'Offer'} cancelled`)
                    },
                    onError: (e: any) => {
                      toast.error(e?.message || 'Failed to cancel')
                    }
                  }
                )
              }} disabled={isCancelling}>
                {isCancelling ? 'Cancelling…' : 'Cancel'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {pendingRemoveAssignment && (
        <Dialog open={true} onOpenChange={(v) => !v && setPendingRemoveAssignment(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove assignment?</DialogTitle>
              <DialogDescription>
                This will remove the assignment of {displayName} from this job.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPendingRemoveAssignment(false)}>Keep</Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  try {
                    if (!assignment?.job_id) { setPendingRemoveAssignment(false); return; }
                    await supabase.from('job_assignments').delete().eq('job_id', assignment.job_id).eq('technician_id', technician.id)
                    setPendingRemoveAssignment(false)
                    toast.success('Assignment removed')
                    window.dispatchEvent(new CustomEvent('assignment-updated'))
                  } catch (e: any) {
                    toast.error(e?.message || 'Failed to remove assignment')
                  }
                }}
              >
                Remove
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
              <div className={`capitalize ${assignment.status === 'confirmed' ? 'text-green-600' : assignment.status === 'declined' ? 'text-red-600' : 'text-yellow-600'}`}>
                {assignment.status}
              </div>
            </div>
          )}
          {isUnavailable && !hasAssignment && (
            <div className="text-xs text-muted-foreground">
              Unavailable{availability.notes ? `: ${availability.notes}` : ''}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
});

OptimizedMatrixCell.displayName = 'OptimizedMatrixCell';
