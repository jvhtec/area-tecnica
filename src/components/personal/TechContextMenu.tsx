
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
import { Calendar, Plane, Stethoscope, CalendarOff, Warehouse } from 'lucide-react';
import { GlassSurface } from '@/components/ui/glass';

interface TechContextMenuProps {
  children: React.ReactNode;
  technician: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    department: string | null;
  };
  date: Date;
  onAvailabilityChange: (techId: string, status: 'vacation' | 'travel' | 'sick' | 'day_off' | 'warehouse' | 'unavailable', date: Date) => void;
  onAvailabilityRemove?: (techId: string, date: Date) => void;
}

export const TechContextMenu: React.FC<TechContextMenuProps> = ({
  children,
  technician,
  date,
  onAvailabilityChange,
  onAvailabilityRemove,
}) => {
  const handleUnavailable = (reason: 'vacation' | 'travel' | 'sick' | 'day_off' | 'warehouse' | 'unavailable') => {
    onAvailabilityChange(technician.id, reason, date);
  };

  const handleRemoveAvailability = () => {
    onAvailabilityRemove?.(technician.id, date);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56 border-0 bg-transparent p-0 shadow-none">
        <GlassSurface
          className="overflow-hidden"
          contentClassName="flex flex-col py-2"
          mobileOptions={{ featureFlag: 'mobile_glass_ui', minimumDeviceMemory: 3 }}
          displacementScale={0.28}
          blurAmount={16}
        >
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Calendar className="mr-2 h-4 w-4" />
              Mark as Unavailable
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48 border-0 bg-transparent p-0 shadow-none">
              <GlassSurface
                className="overflow-hidden"
                contentClassName="flex flex-col py-2"
                mobileOptions={{ featureFlag: 'mobile_glass_ui', minimumDeviceMemory: 3 }}
                displacementScale={0.24}
                blurAmount={14}
              >
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
                <ContextMenuItem onClick={() => handleUnavailable('day_off')}>
                  <CalendarOff className="mr-2 h-4 w-4" />
                  Day Off
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleUnavailable('warehouse')}>
                  <Warehouse className="mr-2 h-4 w-4" />
                  Mark as In Warehouse
                </ContextMenuItem>
              </GlassSurface>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleRemoveAvailability}>
            <Calendar className="mr-2 h-4 w-4" />
            Remove Override
          </ContextMenuItem>
        </GlassSurface>
      </ContextMenuContent>
    </ContextMenu>
  );
};
