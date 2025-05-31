
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
}

export const HouseTechBadge: React.FC<HouseTechBadgeProps> = ({
  technician,
  assignment,
  date,
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

  const getContrastColor = (hex: string): string => {
    // Simple contrast calculation
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? "#000000" : "#ffffff";
  };

  const badgeColor = getBadgeColor();
  const textColor = getContrastColor(badgeColor);

  return (
    <TechnicianTooltip
      technician={technician}
      assignment={assignment}
      date={date}
    >
      <Badge
        variant="secondary"
        className={cn(
          "text-xs cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1 max-w-full",
          assignment ? "font-medium" : "font-normal"
        )}
        style={{
          backgroundColor: `${badgeColor}20`,
          borderColor: badgeColor,
          color: assignment ? badgeColor : '#6b7280',
        }}
      >
        <span className="flex-shrink-0">{getInitials()}</span>
        {assignment && getRole() && (
          <span className="truncate text-xs opacity-75">
            {getRole()}
          </span>
        )}
      </Badge>
    </TechnicianTooltip>
  );
};
