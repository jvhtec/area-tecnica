
import React, { useState } from 'react';
import { format, isSameDay, isToday, isWeekend } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar, User, X, Plus, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MatrixCellProps {
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
}

export const MatrixCell = ({
  technician,
  date,
  assignment,
  availability,
  width,
  height,
  isSelected,
  onSelect,
  onClick
}: MatrixCellProps) => {
  const [isHovered, setIsHovered] = useState(false);

  // Determine cell status and styling
  const isAssigned = !!assignment?.jobs; // Only consider assigned if there's actually a job
  const isUnavailable = availability?.status === 'unavailable';
  const isAvailable = !isAssigned && !isUnavailable;
  const isTodayCell = isToday(date);
  const isWeekendCell = isWeekend(date);

  // Assignment status - only valid if there's actually a job
  const assignmentStatus = assignment?.jobs ? (assignment?.status || 'invited') : null;
  const isInvited = assignmentStatus === 'invited';
  const isConfirmed = assignmentStatus === 'confirmed';
  const isDeclined = assignmentStatus === 'declined';

  const getCellClasses = () => {
    return cn(
      'border-r border-b transition-all duration-200 cursor-pointer relative group',
      'hover:border-accent-foreground/20',
      {
        // Available cells - theme-aware colors
        'bg-background hover:bg-accent/30': isAvailable && !isWeekendCell,
        'bg-muted/50 hover:bg-muted/70': isAvailable && isWeekendCell,
        
        // Assignment status colors - theme-aware
        'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-950/50': isInvited,
        'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-950/50': isConfirmed,
        'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/50': isDeclined || (isUnavailable && !isAssigned),
        
        // Selection and today highlighting
        'ring-2 ring-blue-500 ring-inset': isSelected,
        'ring-2 ring-orange-400 ring-inset': isTodayCell && !isSelected,
      }
    );
  };

  const getStatusBadge = () => {
    if (!isAssigned) return null;
    
    const statusConfig = {
      invited: { label: 'Invited', variant: 'secondary', color: 'text-yellow-700 dark:text-yellow-300' },
      confirmed: { label: 'Confirmed', variant: 'default', color: 'text-green-700 dark:text-green-300' },
      declined: { label: 'Declined', variant: 'destructive', color: 'text-red-700 dark:text-red-300' }
    };
    
    const config = statusConfig[assignmentStatus] || statusConfig.invited;
    
    return (
      <Badge variant={config.variant} className={`text-xs px-1 py-0 h-4 ${config.color}`}>
        {config.label}
      </Badge>
    );
  };

  const getStatusIcon = () => {
    if (!isAssigned) return null;
    
    switch (assignmentStatus) {
      case 'confirmed':
        return <Check className="h-3 w-3 text-green-600 dark:text-green-400" />;
      case 'declined':
        return <X className="h-3 w-3 text-red-600 dark:text-red-400" />;
      case 'invited':
        return <AlertCircle className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />;
      default:
        return null;
    }
  };

  const getRoleForDepartment = () => {
    if (!assignment) return null;
    
    switch (technician.department) {
      case 'sound':
        return assignment.sound_role;
      case 'lights':
        return assignment.lights_role;
      case 'video':
        return assignment.video_role;
      default:
        return assignment.sound_role || assignment.lights_role || assignment.video_role;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (e.ctrlKey || e.metaKey) {
      // Multi-select mode
      onSelect(!isSelected);
    } else if (isAssigned && assignment?.jobs) {
      // Handle based on assignment status - only if there's actually a job
      if (isInvited) {
        // Show confirm/decline/reassign options
        onClick('assign');
      } else if (isConfirmed) {
        // Show reassign options
        onClick('assign');
      } else if (isDeclined) {
        // Show reassign options
        onClick('assign');
      }
    } else if (isAvailable) {
      // If available, show job selection first
      onClick('select-job');
    } else {
      // For unavailable cells, show unavailable options
      onClick('unavailable');
    }
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onClick('unavailable');
  };

  const handleQuickConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick('confirm');
  };

  const handleQuickDecline = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick('decline');
  };

  const role = getRoleForDepartment();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div
          className={getCellClasses()}
          style={{ width, height }}
          onClick={handleClick}
          onContextMenu={handleRightClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="p-1.5 h-full flex flex-col justify-center items-center text-xs relative overflow-hidden">
            {isAssigned && assignment?.jobs && (
              <>
                <div className="font-medium text-center w-full mb-1 leading-tight">
                  <div className="truncate text-xs" title={assignment.jobs.title}>
                    {assignment.jobs.title}
                  </div>
                </div>
                {role && (
                  <div className="text-xs text-muted-foreground w-full mb-1 leading-tight">
                    <div className="truncate text-center" title={role}>
                      {role}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-center gap-1 w-full">
                  {getStatusIcon()}
                  {getStatusBadge()}
                </div>
              </>
            )}
            
            {isUnavailable && !isAssigned && (
              <div className="text-red-600 dark:text-red-400 font-medium text-center w-full">
                <div className="text-xs leading-tight">Unavailable</div>
                {availability?.reason && (
                  <div className="text-xs text-red-500 dark:text-red-400 mt-1 leading-tight">
                    <div className="truncate" title={availability.reason}>
                      {availability.reason}
                    </div>
                  </div>
                )}
              </div>
            )}

            {isAvailable && isHovered && (
              <div className="absolute inset-0 flex items-center justify-center bg-accent/80 rounded">
                <Plus className="h-4 w-4 text-accent-foreground" />
              </div>
            )}

            {/* Quick action buttons for invited assignments - only if there's actually a job */}
            {isInvited && assignment?.jobs && isHovered && (
              <div className="absolute inset-0 flex items-center justify-center gap-1 bg-yellow-100/90 dark:bg-yellow-950/90 rounded">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 w-6 p-0 bg-green-500 hover:bg-green-600 text-white border-green-500"
                  onClick={handleQuickConfirm}
                  title="Quick Confirm"
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 w-6 p-0 bg-red-500 hover:bg-red-600 text-white border-red-500"
                  onClick={handleQuickDecline}
                  title="Quick Decline"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </PopoverTrigger>
      
      <PopoverContent className="w-64" side="top">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="font-medium">
              {technician.first_name} {technician.last_name}
            </span>
            <Badge variant="outline" className="text-xs">
              {technician.department}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {format(date, 'EEEE, MMM d, yyyy')}
          </div>

          {isAssigned && assignment?.jobs && (
            <div className="border-t pt-2">
              <div className="font-medium text-sm">Assigned to:</div>
              <div className="text-sm">{assignment.jobs.title}</div>
              {role && (
                <div className="text-xs text-muted-foreground">Role: {role}</div>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">Status:</span>
                {getStatusIcon()}
                {getStatusBadge()}
              </div>
              {assignment.response_time && (
                <div className="text-xs text-muted-foreground mt-1">
                  Response: {format(new Date(assignment.response_time), 'MMM d, HH:mm')}
                </div>
              )}
            </div>
          )}

          {isUnavailable && !isAssigned && (
            <div className="border-t pt-2">
              <div className="font-medium text-sm text-red-600">Unavailable</div>
              {availability?.reason && (
                <div className="text-sm text-muted-foreground">
                  Reason: {availability.reason}
                </div>
              )}
            </div>
          )}

          <div className="border-t pt-2 flex gap-2 flex-wrap">
            {isAvailable && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onClick('select-job')}
                  className="flex-1"
                >
                  Select Job
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onClick('unavailable')}
                  className="flex-1"
                >
                  Mark Unavailable
                </Button>
              </>
            )}

            {isInvited && assignment?.jobs && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => onClick('confirm')}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onClick('decline')}
                  className="flex-1"
                >
                  Decline
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onClick('assign')}
                  className="w-full mt-1"
                >
                  Reassign
                </Button>
              </>
            )}

            {(isConfirmed || isDeclined) && assignment?.jobs && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onClick('assign')}
                className="flex-1"
              >
                Reassign
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
