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
  return (
    <div
      onClick={onClick}
      className={cn(
        `p-2 bg-card border rounded-md cursor-pointer hover:shadow-md transition-shadow
        ${event.event_type === 'load' ? 'border-blue-200' : 'border-green-200'}`,
        className
      )}
    >
      {variant === "calendar" ? (
        <div className="flex items-center gap-2">
          <span className="text-xs">{event.job?.title}</span>
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
              <span className="capitalize">{event.event_type}</span>
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Truck className="h-3 w-3" />
              <span className="capitalize">{event.transport_type}</span>
            </Badge>
          </div>
          
          <h3 className="font-medium mt-2">{event.job?.title}</h3>
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
              Loading Bay: {event.loading_bay}
            </div>
          )}
        </>
      )}
    </div>
  );
};