
import React from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Calendar, Plane, Stethoscope } from 'lucide-react';

interface TechContextMenuProps {
  children: React.ReactNode;
  technician: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    department: string | null;
  };
  date: Date;
  onAvailabilityChange: (techId: string, status: 'vacation' | 'travel' | 'sick', date: Date) => void;
}

export const TechContextMenu: React.FC<TechContextMenuProps> = ({
  children,
  technician,
  date,
  onAvailabilityChange,
}) => {
  const handleUnavailable = (reason: 'vacation' | 'travel' | 'sick') => {
    onAvailabilityChange(technician.id, reason, date);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Calendar className="mr-2 h-4 w-4" />
            Mark as Unavailable
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem onClick={() => handleUnavailable('vacation')}>
              <Calendar className="mr-2 h-4 w-4" />
              Vacation
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleUnavailable('travel')}>
              <Plane className="mr-2 h-4 w-4" />
              Travel
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleUnavailable('sick')}>
              <Stethoscope className="mr-2 h-4 w-4" />
              Sick Day
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  );
};
