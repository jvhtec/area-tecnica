
import React, { useState } from 'react';
import { format, isSameDay, isToday, isWeekend } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar, User, X, Plus } from 'lucide-react';
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
  onClick: (action: 'assign' | 'unavailable') => void;
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
  const isAssigned = !!assignment;
  const isUnavailable = availability?.status === 'unavailable';
  const isAvailable = !isAssigned && !isUnavailable;
  const isTodayCell = isToday(date);
  const isWeekendCell = isWeekend(date);

  const getCellClasses = () => {
    return cn(
      'border-r border-b transition-all duration-200 cursor-pointer relative group',
      'hover:bg-accent/50 hover:border-accent-foreground/20',
      {
        'bg-green-50 hover:bg-green-100': isAvailable && !isWeekendCell,
        'bg-gray-50 hover:bg-gray-100': isAvailable && isWeekendCell,
        'bg-blue-50 border-blue-200 hover:bg-blue-100': isAssigned,
        'bg-red-50 border-red-200 hover:bg-red-100': isUnavailable,
        'ring-2 ring-blue-500 ring-inset': isSelected,
        'ring-2 ring-orange-400 ring-inset': isTodayCell && !isSelected,
      }
    );
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
    } else if (isAssigned) {
      // If assigned, show options to reassign or remove
      onClick('assign');
    } else {
      // If not assigned, show assign/unavailable options
      onClick('assign');
    }
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onClick('unavailable');
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
          <div className="p-1 h-full flex flex-col justify-center items-center text-xs">
            {isAssigned && assignment?.jobs && (
              <>
                <div className="font-medium text-center truncate w-full text-blue-700">
                  {assignment.jobs.title}
                </div>
                {role && (
                  <Badge variant="secondary" className="text-xs mt-1">
                    {role}
                  </Badge>
                )}
              </>
            )}
            
            {isUnavailable && (
              <div className="text-red-600 font-medium text-center">
                Unavailable
                {availability?.reason && (
                  <div className="text-xs text-red-500 truncate w-full mt-1">
                    {availability.reason}
                  </div>
                )}
              </div>
            )}

            {isAvailable && isHovered && (
              <div className="absolute inset-0 flex items-center justify-center bg-accent/80 rounded">
                <Plus className="h-4 w-4 text-accent-foreground" />
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
            </div>
          )}

          {isUnavailable && (
            <div className="border-t pt-2">
              <div className="font-medium text-sm text-red-600">Unavailable</div>
              {availability?.reason && (
                <div className="text-sm text-muted-foreground">
                  Reason: {availability.reason}
                </div>
              )}
            </div>
          )}

          <div className="border-t pt-2 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onClick('assign')}
              className="flex-1"
            >
              {isAssigned ? 'Reassign' : 'Assign Job'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onClick('unavailable')}
              className="flex-1"
            >
              Mark Unavailable
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
