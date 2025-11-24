
import { Badge } from "@/components/ui/badge";
import { Package, PackageCheck, Truck } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface LogisticsEventCardProps {
  event: any;
  onClick: (e: React.MouseEvent) => void;
  variant?: "calendar" | "detailed";
  compact?: boolean;
  className?: string;
}

export const LogisticsEventCard = ({
  event,
  onClick,
  variant = "detailed",
  compact = false,
  className
}: LogisticsEventCardProps) => {
  // Default colors based on event type
  const defaultColor = event.event_type === 'load' ? 'rgb(191, 219, 254)' : 'rgb(187, 247, 208)';
  const borderColor = event.color || defaultColor;

  // Create a slightly transparent version of the color for the background
  const getBgColor = () => {
    if (!event.color) return '';
    try {
      // If it's a hex color, convert it to RGB
      if (event.color.startsWith('#')) {
        const r = parseInt(event.color.slice(1, 3), 16);
        const g = parseInt(event.color.slice(3, 5), 16);
        const b = parseInt(event.color.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, 0.1)`;
      }
      // If it's already RGB, just add transparency
      return event.color.replace('rgb', 'rgba').replace(')', ', 0.1)');
    } catch (e) {
      return '';
    }
  };

  // Helper to get display name with fallback
  const getDisplayName = () => {
    const title = event.title || event.job?.title;
    if (title) return title;

    // Fallback: show event type + transport type
    const typeLabel = event.event_type === 'load' ? 'Carga' : 'Descarga';
    const transportLabel = event.transport_type ? ` - ${event.transport_type}` : '';
    return `${typeLabel}${transportLabel}`;
  };

  return (
    <div
      onClick={onClick}
      style={{
        borderColor: borderColor,
        backgroundColor: getBgColor(),
      }}
      className={cn(
        "p-2 bg-card border rounded-md cursor-pointer hover:shadow-md transition-shadow",
        className
      )}
    >
      {variant === "calendar" ? (
        <div className="flex items-center gap-2">
          <span className="text-xs">{getDisplayName()}</span>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <Badge
              variant={event.event_type === 'load' ? 'default' : 'secondary'}
              className="flex items-center gap-1"
            >
              {event.event_type === 'load' ? (
                <Package className="h-3 w-3" />
              ) : (
                <PackageCheck className="h-3 w-3" />
              )}
              <span className="capitalize">{event.event_type === 'load' ? 'Carga' : 'Descarga'}</span>
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Truck className="h-3 w-3" />
              <span className="capitalize">{event.transport_type}</span>
            </Badge>
          </div>

          <h3 className="font-medium mt-2">{event.title || event.job?.title}</h3>
          <div className="text-sm text-muted-foreground mt-1">
            {format(new Date(`2000-01-01T${event.event_time}`), 'HH:mm')}
          </div>

          {event.license_plate && (
            <div className="text-sm text-muted-foreground mt-1">
              {event.license_plate}
            </div>
          )}

          <div className="flex flex-wrap gap-1 mt-1">
            {event.departments?.map((dept: any) => (
              <Badge key={dept.department} variant="secondary" className="text-xs">
                {dept.department}
              </Badge>
            ))}
          </div>

          {event.loading_bay && (
            <div className="text-sm text-muted-foreground mt-2">
              Muelle: {event.loading_bay}
            </div>
          )}
        </>
      )}
    </div>
  );
};
