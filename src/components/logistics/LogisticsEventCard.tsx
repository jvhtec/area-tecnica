
import { Badge } from "@/components/ui/badge";
import { Package, PackageCheck, Truck } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { GlassSurface } from "@/components/ui/glass";

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

  return (
    <div onClick={onClick}>
      <GlassSurface
        className={cn(
        "relative cursor-pointer overflow-hidden border border-white/10",
        variant === "calendar" ? "rounded-lg px-3 py-2" : "rounded-xl",
        className
      )}
      contentClassName={cn(
        "relative z-[1]",
        variant === "calendar" ? "flex items-center gap-2" : "flex flex-col gap-2 p-3"
      )}
      mobileOptions={{ featureFlag: "mobile_glass_ui", minimumDeviceMemory: 3 }}
      displacementScale={compact ? 0.18 : variant === "calendar" ? 0.2 : 0.32}
      blurAmount={compact ? 10 : variant === "calendar" ? 12 : 18}
      fallbackClassName={cn(
        "relative overflow-hidden border",
        variant === "calendar" ? "rounded-lg px-3 py-2" : "rounded-xl p-3"
      )}
      style={{
        backgroundImage: getBgColor() ? `linear-gradient(135deg, ${getBgColor()}, transparent)` : undefined,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-2 left-0 w-1 rounded-full"
        style={{ backgroundColor: borderColor }}
      />
      {variant === "calendar" ? (
        <span className="text-xs font-medium">{event.title || event.job?.title}</span>
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
              <span className="capitalize">{event.event_type}</span>
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Truck className="h-3 w-3" />
              <span className="capitalize">{event.transport_type}</span>
            </Badge>
          </div>

          <h3 className="mt-2 font-medium">{event.title || event.job?.title}</h3>
          <div className="mt-1 text-sm text-muted-foreground">
            {format(new Date(`2000-01-01T${event.event_time}`), 'HH:mm')}
          </div>

          {event.license_plate && (
            <div className="mt-1 text-sm text-muted-foreground">
              {event.license_plate}
            </div>
          )}

          <div className="mt-1 flex flex-wrap gap-1">
            {event.departments?.map((dept: any) => (
              <Badge key={dept.department} variant="secondary" className="text-xs">
                {dept.department}
              </Badge>
            ))}
          </div>

          {event.loading_bay && (
            <div className="mt-2 text-sm text-muted-foreground">
              Loading Bay: {event.loading_bay}
            </div>
          )}
        </>
      )}
    </GlassSurface>
    </div>
  );
};
