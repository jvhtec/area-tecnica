
import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { formatInJobTimezone } from '@/utils/timezoneUtils';
import { MapPin, Clock, User, Phone } from 'lucide-react';

interface TechnicianTooltipProps {
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
  children: React.ReactNode;
}

export const TechnicianTooltip: React.FC<TechnicianTooltipProps> = ({
  technician,
  assignment,
  date,
  children,
}) => {
  const getFullName = () => {
    return `${technician.first_name || ''} ${technician.last_name || ''}`.trim() || 'Unknown';
  };

  const getRole = () => {
    if (!assignment) return null;
    return assignment.sound_role || assignment.lights_role || assignment.video_role;
  };

  const getDepartmentRole = () => {
    const dept = technician.department?.charAt(0).toUpperCase() + technician.department?.slice(1) || 'Unknown';
    return `${dept} House Tech`;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent className="w-64 p-3">
          <div className="space-y-3">
            {/* Technician Info */}
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                {getFullName()}
              </h4>
              <p className="text-sm text-muted-foreground">{getDepartmentRole()}</p>
              {technician.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3 w-3" />
                  <span>{technician.phone}</span>
                </div>
              )}
            </div>

            {/* Assignment Info */}
            {assignment ? (
              <div className="space-y-2 border-t pt-2">
                <h5 className="font-medium text-sm">Assignment Details</h5>
                <div className="space-y-1">
                  <p className="text-sm font-medium">{assignment.job.title}</p>
                  
                  {getRole() && (
                    <Badge variant="outline" className="text-xs">
                      {getRole()}
                    </Badge>
                  )}
                  
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
                      <span className="capitalize">{assignment.job.status}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="border-t pt-2">
                <p className="text-sm text-muted-foreground">
                  No assignment for {format(date, 'MMM d, yyyy')}
                </p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
