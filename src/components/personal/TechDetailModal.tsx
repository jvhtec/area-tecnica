
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { formatInJobTimezone } from '@/utils/timezoneUtils';
import { MapPin, Clock, User, Phone, Briefcase, Calendar, Plane, Stethoscope, Home, X, Warehouse } from 'lucide-react';
import { labelForCode } from '@/utils/roles';
import { formatUserName } from '@/utils/userName';
import { useTechnicianTheme } from '@/hooks/useTechnicianTheme';

interface TechDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  availabilityStatus?: 'vacation' | 'travel' | 'sick' | 'day_off' | 'warehouse' | 'unavailable' | null;
  onAvailabilityChange?: (techId: string, status: 'vacation' | 'travel' | 'sick' | 'day_off' | 'warehouse' | 'unavailable', date: Date) => void;
  onAvailabilityRemove?: (techId: string, date: Date) => void;
}

export const TechDetailModal: React.FC<TechDetailModalProps> = ({
  open,
  onOpenChange,
  technician,
  assignment,
  date,
  availabilityStatus = null,
  onAvailabilityChange,
  onAvailabilityRemove,
}) => {
  const { theme, isDark } = useTechnicianTheme();

  const getFullName = () => {
    const name = formatUserName(technician.first_name, technician.nickname, technician.last_name);
    return name || 'Unknown';
  };

  const getRole = () => {
    if (!assignment) return null;
    const raw = assignment.sound_role || assignment.lights_role || assignment.video_role;
    return raw ? labelForCode(raw) : null;
  };

  const getDepartmentRole = () => {
    const dept = technician.department?.charAt(0).toUpperCase() + technician.department?.slice(1) || 'Unknown';
    return `${dept} House Tech`;
  };

  const getAvailabilityStatusText = () => {
    if (!availabilityStatus) return null;
    switch (availabilityStatus) {
      case 'vacation':
        return 'On Vacation';
      case 'travel':
        return 'Traveling';
      case 'sick':
        return 'Sick Day';
      case 'day_off':
        return 'Day Off';
      case 'unavailable':
        return 'Unavailable';
      case 'warehouse':
        return 'In Warehouse';
      default:
        return null;
    }
  };

  const handleUnavailableClick = (status: 'vacation' | 'travel' | 'sick' | 'day_off' | 'warehouse' | 'unavailable') => {
    if (onAvailabilityChange) {
      onAvailabilityChange(technician.id, status, date);
      onOpenChange(false);
    }
  };

  const handleRemoveAvailability = () => {
    if (onAvailabilityRemove) {
      onAvailabilityRemove(technician.id, date);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-sm ${theme.card} border-none shadow-xl`}>
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${theme.textMain}`}>
            <User className="h-4 w-4 text-blue-500" />
            {getFullName()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className={`text-sm flex items-center gap-2 ${theme.textMuted}`}>
              <Briefcase className="h-3 w-3" />
              {getDepartmentRole()}
            </p>
            <Badge
              variant={availabilityStatus ? "destructive" : assignment ? "default" : "secondary"}
              className="text-xs"
            >
              {availabilityStatus ? getAvailabilityStatusText() : assignment ? "Assigned" : "Available"}
            </Badge>
          </div>

          <div className={`text-xs ${theme.textMuted}`}>
            {format(date, 'MMM d, yyyy')}
          </div>

          {technician.phone && (
            <div className={`flex items-center gap-2 text-sm ${theme.textMain}`}>
              <Phone className={`h-3 w-3 ${theme.textMuted}`} />
              <span>{technician.phone}</span>
            </div>
          )}

          {availabilityStatus ? (
            <div className={`border-t pt-2 ${theme.divider}`}>
              <div className="flex items-center justify-between mb-2">
                <p className={`text-sm ${theme.textMuted}`}>
                  {getAvailabilityStatusText()} on {format(date, 'MMM d, yyyy')}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveAvailability}
                  className={`h-6 w-6 p-0 ${theme.textMuted} hover:text-red-500`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-orange-600">Not available for assignment</p>
            </div>
          ) : assignment ? (
            <div className={`space-y-2 border-t pt-2 ${theme.divider}`}>
              <h5 className={`font-medium text-sm ${theme.textMain}`}>Assignment Details</h5>
              <div className="space-y-2">
                <div className={`rounded-lg p-2 ${isDark ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
                  <p className={`text-sm font-medium ${theme.textMain}`}>{assignment.job.title}</p>

                  {getRole() && (
                    <div className="mt-1">
                      <Badge
                        variant="outline"
                        className="text-xs"
                        style={{
                          borderColor: assignment.job.color || '#d1d5db',
                          color: assignment.job.color || '#6b7280',
                        }}
                      >
                        {getRole()}
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className={`flex items-center gap-2 text-xs ${theme.textMuted}`}>
                    <Clock className="h-3 w-3" />
                    <span>
                      {formatInJobTimezone(assignment.job.start_time, "HH:mm", 'Europe/Madrid')} - {formatInJobTimezone(assignment.job.end_time, "HH:mm", 'Europe/Madrid')}
                    </span>
                  </div>

                  {assignment.job.location && (
                    <div className={`flex items-center gap-2 text-xs ${theme.textMuted}`}>
                      <MapPin className="h-3 w-3" />
                      <span>{assignment.job.location.name}</span>
                    </div>
                  )}

                  {assignment.job.status && (
                    <div className="text-xs">
                      <span className={theme.textMuted}>Status: </span>
                      <span className={`capitalize font-medium ${theme.textMain}`}>{assignment.job.status}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className={`border-t pt-2 ${theme.divider}`}>
              <p className={`text-sm ${theme.textMuted}`}>
                No assignment for {format(date, 'MMM d, yyyy')}
              </p>
              <p className="text-xs text-green-600 mt-1">Available for assignment</p>
            </div>
          )}

          {/* Mark as Unavailable Section - only show if not already unavailable and no assignment */}
          {!availabilityStatus && !assignment && (
            <div className={`border-t pt-3 ${theme.divider}`}>
              <h5 className={`font-medium text-sm mb-2 ${theme.textMain}`}>Mark as Unavailable</h5>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: 'vacation', label: 'Vacation', icon: Calendar },
                  { id: 'travel', label: 'Travel', icon: Plane },
                  { id: 'sick', label: 'Sick Day', icon: Stethoscope },
                  { id: 'day_off', label: 'Day Off', icon: Home },
                  { id: 'warehouse', label: 'Mark as In Warehouse', icon: Warehouse }
                ].map((item) => (
                  <Button
                    key={item.id}
                    variant="outline"
                    size="sm"
                    onClick={() => handleUnavailableClick(item.id as any)}
                    className={`justify-start ${theme.card} ${theme.textMain} hover:bg-slate-100 dark:hover:bg-slate-800`}
                  >
                    <item.icon className="mr-2 h-3 w-3" />
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
