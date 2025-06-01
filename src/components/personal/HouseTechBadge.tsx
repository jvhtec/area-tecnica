
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TechnicianTooltip } from './TechnicianTooltip';

interface HouseTechBadgeProps {
  technician: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    department: string | null;
    phone: string | null;
  };
  assignment?: {
    sound_role: string | null;
    lights_role: string | null;
    video_role: string | null;
    job: {
      id: string;
      title: string;
      color: string | null;
      start_time: string;
      end_time: string;
      status: string | null;
      location?: {
        name: string;
      } | null;
    };
  };
  date: Date;
  compact?: boolean;
}

export const HouseTechBadge: React.FC<HouseTechBadgeProps> = ({
  technician,
  assignment,
  date,
  compact = false,
}) => {
  const getInitials = () => {
    const first = technician.first_name?.[0] || '';
    const last = technician.last_name?.[0] || '';
    return (first + last).toUpperCase() || 'HT';
  };

  const getRole = () => {
    if (!assignment) return null;
    return assignment.sound_role || assignment.lights_role || assignment.video_role;
  };

  const getBadgeColor = () => {
    if (assignment && assignment.job.color) {
      return assignment.job.color;
    }
    return '#6b7280'; // Gray for unassigned
  };

  const badgeColor = getBadgeColor();

  return (
    <TechnicianTooltip
      technician={technician}
      assignment={assignment}
      date={date}
    >
      <Badge
        variant="secondary"
        className={cn(
          "cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center shrink-0",
          compact 
            ? "text-xs px-1 py-0.5 h-5 min-w-[20px] text-center font-medium" 
            : "text-xs gap-1 max-w-full font-medium",
          assignment ? "font-medium" : "font-normal"
        )}
        style={{
          backgroundColor: assignment ? `${badgeColor}20` : '#f3f4f6',
          borderColor: assignment ? badgeColor : '#d1d5db',
          color: assignment ? badgeColor : '#6b7280',
        }}
      >
        {compact ? (
          <span className="text-xs leading-none">{getInitials()}</span>
        ) : (
          <>
            <span className="flex-shrink-0">{getInitials()}</span>
            {assignment && getRole() && (
              <span className="truncate text-xs opacity-75">
                {getRole()}
              </span>
            )}
          </>
        )}
      </Badge>
    </TechnicianTooltip>
  );
};
