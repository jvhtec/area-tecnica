import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TechDetailModal } from './TechDetailModal';

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
  availabilityStatus?: 'vacation' | 'travel' | 'sick' | null;
  onAvailabilityChange?: (techId: string, status: 'vacation' | 'travel' | 'sick', date: Date) => void;
}

export const HouseTechBadge: React.FC<HouseTechBadgeProps> = ({
  technician,
  assignment,
  date,
  compact = false,
  availabilityStatus = null,
  onAvailabilityChange,
}) => {
  const [modalOpen, setModalOpen] = useState(false);

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
    // Handle unavailable status first
    if (availabilityStatus) {
      switch (availabilityStatus) {
        case 'vacation':
          return '#fbbf24'; // amber
        case 'travel':
          return '#3b82f6'; // blue
        case 'sick':
          return '#ef4444'; // red
      }
    }
    
    if (assignment && assignment.job.color) {
      return assignment.job.color;
    }
    return '#6b7280'; // Gray for unassigned
  };

  const getAvailabilityIcon = () => {
    if (!availabilityStatus) return null;
    switch (availabilityStatus) {
      case 'vacation':
        return '🏖️';
      case 'travel':
        return '✈️';
      case 'sick':
        return '🤒';
      default:
        return null;
    }
  };

  const badgeColor = getBadgeColor();
  const isUnavailable = !!availabilityStatus;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setModalOpen(true);
  };

  const handleAvailabilityChange = (techId: string, status: 'vacation' | 'travel' | 'sick', date: Date) => {
    if (onAvailabilityChange) {
      onAvailabilityChange(techId, status, date);
    }
  };

  return (
    <>
      <Badge
        variant="secondary"
        className={cn(
          "cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center shrink-0 relative",
          compact 
            ? "text-xs px-1 py-0.5 h-5 w-8 text-center font-medium" 
            : "text-xs gap-0.5 w-16 font-medium px-1.5 py-0.5",
          assignment && !isUnavailable ? "font-medium" : "font-normal",
          isUnavailable && "opacity-75"
        )}
        style={{
          backgroundColor: (assignment && !isUnavailable) ? `${badgeColor}20` : isUnavailable ? `${badgeColor}20` : '#f3f4f6',
          borderColor: badgeColor,
          color: badgeColor,
        }}
        onClick={handleClick}
      >
        {compact ? (
          <>
            <span className="text-xs leading-none">{getInitials()}</span>
            {getAvailabilityIcon() && (
              <span className="absolute -top-1 -right-1 text-[8px]">
                {getAvailabilityIcon()}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="flex-shrink-0 text-xs">{getInitials()}</span>
            {assignment && getRole() && !isUnavailable && (
              <span className="truncate text-[10px] opacity-75 max-w-[24px]">
                {getRole().slice(0, 3)}
              </span>
            )}
            {getAvailabilityIcon() && (
              <span className="text-[10px]">
                {getAvailabilityIcon()}
              </span>
            )}
          </>
        )}
      </Badge>

      <TechDetailModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        technician={technician}
        assignment={assignment}
        date={date}
        availabilityStatus={availabilityStatus}
        onAvailabilityChange={handleAvailabilityChange}
      />
    </>
  );
};