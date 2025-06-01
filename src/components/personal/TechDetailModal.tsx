
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { formatInJobTimezone } from '@/utils/timezoneUtils';
import { MapPin, Clock, User, Phone, Briefcase, Calendar, Plane, Stethoscope } from 'lucide-react';

interface TechDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  availabilityStatus?: 'vacation' | 'travel' | 'sick' | null;
  onAvailabilityChange?: (techId: string, status: 'vacation' | 'travel' | 'sick', date: Date) => void;
}

export const TechDetailModal: React.FC<TechDetailModalProps> = ({
  open,
  onOpenChange,
  technician,
  assignment,
  date,
  availabilityStatus = null,
  onAvailabilityChange,
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

  const handleUnavailableClick = (status: 'vacation' | 'travel' | 'sick') => {
    if (onAvailabilityChange) {
      onAvailabilityChange(technician.id, status, date);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            {getFullName()}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
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

          <div className="text-xs text-muted-foreground">
            {format(date, 'MMM d, yyyy')}
          </div>

          {technician.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-3 w-3 text-muted-foreground" />
              <span>{technician.phone}</span>
            </div>
          )}

          {availabilityStatus ? (
            <div className="border-t pt-2">
              <p className="text-sm text-muted-foreground">
                {getAvailabilityStatusText()} on {format(date, 'MMM d, yyyy')}
              </p>
              <p className="text-xs text-orange-600 mt-1">Not available for assignment</p>
            </div>
          ) : assignment ? (
            <div className="space-y-2 border-t pt-2">
              <h5 className="font-medium text-sm text-primary">Assignment Details</h5>
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

          {/* Mark as Unavailable Section - only show if not already unavailable and no assignment */}
          {!availabilityStatus && !assignment && (
            <div className="border-t pt-3">
              <h5 className="font-medium text-sm mb-2">Mark as Unavailable</h5>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUnavailableClick('vacation')}
                  className="justify-start"
                >
                  <Calendar className="mr-2 h-3 w-3" />
                  Vacation
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUnavailableClick('travel')}
                  className="justify-start"
                >
                  <Plane className="mr-2 h-3 w-3" />
                  Travel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUnavailableClick('sick')}
                  className="justify-start"
                >
                  <Stethoscope className="mr-2 h-3 w-3" />
                  Sick Day
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
