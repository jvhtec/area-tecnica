
import React, { memo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Check, X, UserX, Mail, CheckCircle } from 'lucide-react';
import { format, isToday, isWeekend } from 'date-fns';
import { cn } from '@/lib/utils';
import { useStaffingStatus, useSendStaffingEmail } from '@/features/staffing/hooks/useStaffing';
import { useStaffingStatusByDate } from '@/features/staffing/hooks/useStaffingStatusByDate';
import { toast } from 'sonner';

interface OptimizedMatrixCellProps {
  technician: {
    id: string;
    first_name: string;
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
  onClick: (action: 'select-job' | 'select-job-for-staffing' | 'assign' | 'unavailable' | 'confirm' | 'decline' | 'offer-details', selectedJobId?: string) => void;
  onPrefetch?: () => void;
  onOptimisticUpdate?: (status: string) => void;
  onRender?: () => void;
  jobId?: string;
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
  jobId
}: OptimizedMatrixCellProps) => {
  // Track cell renders for performance monitoring
  React.useEffect(() => {
    onRender?.();
  }, [onRender]);
  
  const isTodayCell = isToday(date);
  const isWeekendCell = isWeekend(date);
  const hasAssignment = !!assignment;
  const isUnavailable = availability?.status === 'unavailable';

  // Staffing status hooks
  const { data: staffingStatusByJob } = useStaffingStatus(
    jobId || assignment?.job_id || '', 
    technician.id
  );
  const { data: staffingStatusByDate } = useStaffingStatusByDate(technician.id, date);
  const { mutate: sendStaffingEmail, isPending: isSendingEmail } = useSendStaffingEmail();
  
  // Use job-specific status for assigned cells, date-based status for empty cells
  const staffingStatus = hasAssignment ? staffingStatusByJob : staffingStatusByDate;

  // Handle staffing email actions
  const handleStaffingEmail = useCallback((e: React.MouseEvent, phase: 'availability' | 'offer') => {
    e.stopPropagation();
    
    console.log('🔥 MAIL ICON CLICKED! handleStaffingEmail called', {
      phase,
      technician: `${technician.first_name} ${technician.last_name}`,
      technicianId: technician.id,
      date: format(date, 'yyyy-MM-dd'),
      jobId: jobId || assignment?.job_id,
      hasAssignment,
      assignment,
      clickEvent: 'MAIL_ICON_CLICKED'
    });
    
    // For requests on empty cells, we need to select a job first
    if (phase === 'availability' && !hasAssignment && !jobId) {
      console.log('📋 No job selected for request, calling onClick with select-job-for-staffing');
      onClick('select-job-for-staffing');
      return;
    }
    
    if (phase === 'offer') {
      // Determine target job id: assignment > prop > availability job from date hook
      const targetJobId = jobId || assignment?.job_id || (staffingStatusByDate as any)?.availability_job_id;
      if (!targetJobId) {
        console.log('📋 No resolvable job for offer; opening job selection');
        onClick('select-job-for-staffing');
        return;
      }
      // Open offer details dialog
      onClick('offer-details', targetJobId);
      return;
    }

    // Availability path sends immediately
    const targetJobId = jobId || assignment?.job_id;
    if (!targetJobId) {
      console.error('❌ ERROR: No job ID available for availability request');
      toast.error('No job ID available for staffing request');
      return;
    }
    console.log('📧 Sending staffing email with:', { targetJobId, profile_id: technician.id, phase });
    sendStaffingEmail(
      { job_id: targetJobId, profile_id: technician.id, phase },
      {
        onSuccess: (data) => {
          console.log('✅ EMAIL SUCCESS:', data);
          toast.success('Availability email sent');
        },
        onError: (error) => {
          console.error('❌ EMAIL ERROR:', error);
          toast.error(`Failed to send availability email: ${error.message}`);
        }
      }
    );
  }, [jobId, assignment?.job_id, technician.id, technician.first_name, technician.last_name, sendStaffingEmail, hasAssignment, assignment, date, onClick]);

  const handleMouseEnter = useCallback(() => {
    // Prefetch data when hovering over cell
    onPrefetch?.();
  }, [onPrefetch]);

  const handleCellClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    
    console.log('Cell clicked:', {
      technician: `${technician.first_name} ${technician.last_name}`,
      date: format(date, 'yyyy-MM-dd'),
      hasAssignment,
      isUnavailable,
      assignment
    });
    
    if (hasAssignment) {
      console.log('Opening assignment edit dialog');
      onClick('assign'); // Edit existing assignment
    } else if (isUnavailable) {
      console.log('Opening unavailability dialog');
      onClick('unavailable'); // Edit unavailability
    } else {
      console.log('Opening job selection dialog');
      onClick('select-job'); // Create new assignment
    }
  }, [hasAssignment, isUnavailable, onClick, technician, date, assignment]);

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

  // Debug logging for staffing button visibility
  React.useEffect(() => {
    console.log('🔍 STAFFING BUTTON DEBUG:', {
      technician: `${technician.first_name} ${technician.last_name}`,
      date: format(date, 'yyyy-MM-dd'),
      hasAssignment,
      isUnavailable,
      staffingStatus,
      jobId: jobId || assignment?.job_id || '',
      canAskAvailability,
      canSendOffer,
      conditions: {
        noAssignment: !hasAssignment,
        notUnavailable: !isUnavailable,
        staffingStatusCheck: (!staffingStatus?.availability_status || staffingStatus.availability_status === 'declined' || staffingStatus.availability_status === 'expired')
      }
    });
  }, [canAskAvailability, canSendOffer, technician, date, hasAssignment, isUnavailable, staffingStatus, jobId, assignment]);

  return (
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
      {/* Staffing Status Badges */}
      {(staffingStatus?.availability_status || staffingStatus?.offer_status) && (
        <div className="absolute top-1 left-1 flex gap-1 z-10">
          {staffingStatus.availability_status && (
            <Badge 
              variant={
                staffingStatus.availability_status === 'confirmed' ? 'default' : 
                staffingStatus.availability_status === 'declined' ? 'destructive' : 
                'secondary'
              }
              className="text-xs px-1 py-0 h-3"
            >
              A:{staffingStatus.availability_status === 'confirmed' ? '✓' : 
                 staffingStatus.availability_status === 'declined' ? '✗' : '?'}
            </Badge>
          )}
          {staffingStatus.offer_status && (
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
          )}
        </div>
      )}

      {/* Staffing Action Buttons */}
      {(canAskAvailability || canSendOffer) && (
        <div className="absolute top-1 right-1 flex gap-1 z-10">
          {canAskAvailability && (
            <>
              {console.log('🔵 Rendering ASK AVAILABILITY button for:', `${technician.first_name} ${technician.last_name}`, format(date, 'yyyy-MM-dd'))}
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 hover:bg-blue-100"
                onClick={(e) => {
                  console.log('📧 ASK AVAILABILITY CLICKED!');
                  handleStaffingEmail(e, 'availability');
                }}
                disabled={isSendingEmail}
                title="Ask availability"
              >
                <Mail className="h-3 w-3 text-blue-600" />
              </Button>
            </>
          )}
          {canSendOffer && (
            <>
              {console.log('🟢 Rendering SEND OFFER button for:', `${technician.first_name} ${technician.last_name}`, format(date, 'yyyy-MM-dd'))}
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 hover:bg-green-100"
                onClick={(e) => {
                  console.log('✅ SEND OFFER CLICKED!');
                  handleStaffingEmail(e, 'offer');
                }}
                disabled={isSendingEmail}
                title="Send offer"
              >
                <CheckCircle className="h-3 w-3 text-green-600" />
              </Button>
            </>
          )}
        </div>
      )}
      {/* Assignment Content */}
      {hasAssignment && (
        <div className="flex-1 overflow-hidden">
          <div className={cn('font-medium truncate text-xs', assignment.status === 'confirmed' ? 'text-white' : '')}>
            {assignment.job?.title || 'Assignment'}
          </div>
          <div className={cn('text-xs truncate', assignment.status === 'confirmed' ? 'text-white/90' : 'text-muted-foreground')}>
            {assignment.sound_role || assignment.lights_role || assignment.video_role}
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
      {!hasAssignment && !isUnavailable && (
        <div className="flex-1 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* Date indicator for today */}
      {isTodayCell && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-orange-400 dark:bg-orange-600" />
      )}
    </div>
  );
});

OptimizedMatrixCell.displayName = 'OptimizedMatrixCell';
