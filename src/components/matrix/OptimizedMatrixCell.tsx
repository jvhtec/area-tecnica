
import React, { memo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Check, X, UserX } from 'lucide-react';
import { format, isToday, isWeekend } from 'date-fns';
import { cn } from '@/lib/utils';

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
  onClick: (action: 'select-job' | 'assign' | 'unavailable' | 'confirm' | 'decline') => void;
  onPrefetch?: () => void;
  onOptimisticUpdate?: (status: string) => void;
  onRender?: () => void;
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
  onRender
}: OptimizedMatrixCellProps) => {
  // Track cell renders for performance monitoring
  React.useEffect(() => {
    onRender?.();
  }, [onRender]);
  const isTodayCell = isToday(date);
  const isWeekendCell = isWeekend(date);
  const hasAssignment = !!assignment;
  const isUnavailable = availability?.status === 'unavailable';

  const handleMouseEnter = useCallback(() => {
    // Prefetch data when hovering over cell
    onPrefetch?.();
  }, [onPrefetch]);

  const handleCellClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (hasAssignment) {
      onClick('assign'); // Edit existing assignment
    } else if (isUnavailable) {
      onClick('unavailable'); // Edit unavailability
    } else {
      onClick('select-job'); // Create new assignment
    }
  }, [hasAssignment, isUnavailable, onClick]);

  const handleStatusClick = useCallback((e: React.MouseEvent, action: 'confirm' | 'decline') => {
    e.stopPropagation();
    
    // Optimistic update
    onOptimisticUpdate?.(action === 'confirm' ? 'confirmed' : 'declined');
    
    // Then trigger actual update
    onClick(action);
  }, [onClick, onOptimisticUpdate]);

  const getCellBackground = () => {
    if (isSelected) return 'bg-blue-100 dark:bg-blue-900/30';
    if (hasAssignment) {
      const status = assignment.status;
      if (status === 'confirmed') return 'bg-green-50 dark:bg-green-900/20';
      if (status === 'declined') return 'bg-red-50 dark:bg-red-900/20';
      return 'bg-yellow-50 dark:bg-yellow-900/20';
    }
    if (isUnavailable) return 'bg-gray-100 dark:bg-gray-800/50';
    if (isTodayCell) return 'bg-orange-50 dark:bg-orange-900/20';
    if (isWeekendCell) return 'bg-muted/30';
    return 'bg-card hover:bg-accent/50';
  };

  const getBorderColor = () => {
    if (isSelected) return 'border-blue-500';
    if (hasAssignment) {
      if (assignment.jobs?.color) return 'border-l-4';
      return 'border-yellow-300';
    }
    if (isUnavailable) return 'border-gray-300';
    if (isTodayCell) return 'border-orange-200';
    return 'border-border';
  };

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
        borderLeftColor: assignment?.jobs?.color,
        borderLeftWidth: hasAssignment && assignment?.jobs?.color ? '3px' : '1px'
      }}
      onClick={handleCellClick}
      onMouseEnter={handleMouseEnter}
    >
      {/* Assignment Content */}
      {hasAssignment && (
        <div className="flex-1 overflow-hidden">
          <div className="font-medium truncate text-xs">
            {assignment.jobs?.title || 'Assignment'}
          </div>
          <div className="text-xs text-muted-foreground truncate">
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
          
          {/* Status Badge */}
          <div className="absolute top-1 right-1">
            <Badge 
              variant={assignment.status === 'confirmed' ? 'default' : 'secondary'}
              className="text-xs px-1 py-0 h-4"
            >
              {assignment.status === 'confirmed' ? 'C' : 
               assignment.status === 'declined' ? 'D' : 'P'}
            </Badge>
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
