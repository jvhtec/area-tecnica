
import React, { useState, memo, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TechDetailModal } from './TechDetailModal';
import { labelForCode } from '@/utils/roles';
import { useAvailabilityStatus } from './hooks/useTechnicianAvailability';

interface HouseTechBadgeProps {
  technician: {
    id: string;
    first_name: string | null;
    nickname?: string | null;
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
  availabilityStatus?: 'vacation' | 'travel' | 'sick' | 'day_off' | 'warehouse' | null;
  onAvailabilityChange?: (techId: string, status: 'vacation' | 'travel' | 'sick' | 'day_off' | 'warehouse', date: Date) => void;
  onAvailabilityRemove?: (techId: string, date: Date) => void;
}

export const HouseTechBadge = memo<HouseTechBadgeProps>(({
  technician,
  assignment,
  date,
  compact = false,
  availabilityStatus: _availabilityStatusProp = null, // Keep for backwards compat but don't use
  onAvailabilityChange,
  onAvailabilityRemove,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  // Local optimistic state for instant UI feedback
  const [optimisticStatus, setOptimisticStatus] = useState<'vacation' | 'travel' | 'sick' | 'day_off' | 'warehouse' | null>(null);

  // Subscribe to this badge's status from global store - only THIS badge rerenders when its status changes
  const storeStatus = useAvailabilityStatus(technician.id, date);

  // Clear optimistic status when store confirms the update
  useEffect(() => {
    if (optimisticStatus !== null && storeStatus === optimisticStatus) {
      setOptimisticStatus(null);
    }
  }, [storeStatus, optimisticStatus]);

  // Use optimistic status if set (user just clicked), otherwise use store status
  const currentStatus = optimisticStatus ?? storeStatus;

  const getInitials = () => {
    const first = technician.first_name?.[0] || '';
    const secondSource = technician.nickname || technician.last_name || '';
    const second = secondSource?.[0] || '';
    const combined = `${first}${second}`.trim();
    return combined ? combined.toUpperCase() : 'HT';
  };

  const getRole = () => {
    if (!assignment) return null;
    const raw = assignment.sound_role || assignment.lights_role || assignment.video_role;
    return raw ? labelForCode(raw) : null;
  };

  const getBadgeColor = () => {
    // Handle unavailable status first
    if (currentStatus) {
      switch (currentStatus) {
        case 'vacation':
          return '#fbbf24'; // amber
        case 'travel':
          return '#3b82f6'; // blue
        case 'sick':
          return '#ef4444'; // red
        case 'day_off':
          return '#8b5cf6'; // violet
        case 'warehouse':
          return '#f97316'; // orange
      }
    }

    if (assignment && assignment.job.color) {
      return assignment.job.color;
    }
    return '#6b7280'; // Gray for unassigned
  };

  const getAvailabilityIcon = () => {
    if (!currentStatus) return null;
    switch (currentStatus) {
      case 'vacation':
        return '🏖️';
      case 'travel':
        return '✈️';
      case 'sick':
        return '🤒';
      case 'day_off':
        return '🏠';
      case 'warehouse':
        return '🏭';
      default:
        return null;
    }
  };

  const badgeColor = getBadgeColor();
  const isUnavailable = !!currentStatus;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setModalOpen(true);
  };

  const handleAvailabilityChange = (techId: string, status: 'vacation' | 'travel' | 'sick' | 'day_off' | 'warehouse', date: Date) => {
    // Optimistic update - only this badge rerenders
    setOptimisticStatus(status);

    if (onAvailabilityChange) {
      onAvailabilityChange(techId, status, date);
    }
  };

  const handleAvailabilityRemove = (techId: string, date: Date) => {
    // Optimistic update - only this badge rerenders
    setOptimisticStatus(null);

    if (onAvailabilityRemove) {
      onAvailabilityRemove(techId, date);
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
        availabilityStatus={currentStatus}
        onAvailabilityChange={handleAvailabilityChange}
        onAvailabilityRemove={handleAvailabilityRemove}
      />
    </>
  );
});
