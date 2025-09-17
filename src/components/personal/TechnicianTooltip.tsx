
import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { formatInJobTimezone } from '@/utils/timezoneUtils';
import { MapPin, Clock, User, Phone, Briefcase } from 'lucide-react';
import { labelForCode } from '@/utils/roles';

interface TechnicianTooltipProps {
  technician: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    department: string | null;
    phone: string | null;
    skills?: Array<{ name?: string; category?: string | null; proficiency?: number | null; is_primary?: boolean | null }>;
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
  availabilityStatus?: 'vacation' | 'travel' | 'sick' | null;
  children: React.ReactNode;
}

export const TechnicianTooltip: React.FC<TechnicianTooltipProps> = ({
  technician,
  assignment,
  date,
  availabilityStatus = null,
  children,
}) => {
  const getFullName = () => {
    return `${technician.first_name || ''} ${technician.last_name || ''}`.trim() || 'Unknown';
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
      default:
        return null;
    }
  };

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent 
          className="w-72 p-4 bg-white dark:bg-gray-800 border shadow-lg"
          side="top"
          align="center"
        >
          <div className="space-y-3">
            {/* Technician Header */}
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h4 className="font-semibold text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  {getFullName()}
                </h4>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Briefcase className="h-3 w-3" />
                  {getDepartmentRole()}
                </p>
                {!!(technician.skills && technician.skills.length) && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {technician.skills.slice(0,6).map((s, i) => (
                      <Badge key={(s.name || '') + i} variant={s.is_primary ? 'default' : 'secondary'} className="text-[10px]" title={`${s.name}${s.proficiency != null ? ` (lvl ${s.proficiency})` : ''}`}>
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Status indicator */}
              <div className="flex flex-col items-end gap-1">
                <Badge 
                  variant={availabilityStatus ? "destructive" : assignment ? "default" : "secondary"}
                  className="text-xs"
                >
                  {availabilityStatus ? getAvailabilityStatusText() : assignment ? "Assigned" : "Available"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {format(date, 'MMM d')}
                </span>
              </div>
            </div>

            {/* Contact Info */}
            {technician.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <span>{technician.phone}</span>
              </div>
            )}

            {/* Assignment Details or Unavailable Status */}
            {availabilityStatus ? (
              <div className="border-t pt-2">
                <p className="text-sm text-muted-foreground">
                  {getAvailabilityStatusText()} on {format(date, 'MMM d, yyyy')}
                </p>
                <p className="text-xs text-orange-600 mt-1">Not available for assignment</p>
              </div>
            ) : assignment ? (
              <div className="space-y-2 border-t pt-2">
                <h5 className="font-medium text-sm text-primary">Today's Assignment</h5>
                <div className="space-y-2">
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-sm font-medium">{assignment.job.title}</p>
                    
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
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        {formatInJobTimezone(assignment.job.start_time, "HH:mm", 'Europe/Madrid')} - {formatInJobTimezone(assignment.job.end_time, "HH:mm", 'Europe/Madrid')}
                      </span>
                    </div>
                    
                    {assignment.job.location && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>{assignment.job.location.name}</span>
                      </div>
                    )}
                    
                    {assignment.job.status && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Status: </span>
                        <span className="capitalize font-medium">{assignment.job.status}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-t pt-2">
                <p className="text-sm text-muted-foreground">
                  No assignment for {format(date, 'MMM d, yyyy')}
                </p>
                <p className="text-xs text-green-600 mt-1">Available for assignment</p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
