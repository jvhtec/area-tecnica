import { Badge } from "@/components/ui/badge";
import { Package, PackageCheck, Truck, MessageSquare, UserRound, Users } from "lucide-react";
import { assignmentStatusClass } from "@/components/logistics/fleet/matrixStyles";
import {
  DRIVER_ASSIGNMENT_STATUS_LABELS,
  formatTransportSpan,
  transportOperationLabel,
  type EventDriverSummary,
} from "@/features/logistics/fleet/fleetModel";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { TRANSPORT_PROVIDERS, type TransportProvider } from "@/constants/transportProviders";
import { getLogisticsTransportTypeLabel } from "@/components/technician/details-modal/formatters";
import { getDepartmentLabel } from "@/types/department";
import { memo } from "react";
import type { LogisticsCalendarEvent } from "@/components/logistics/logisticsEventTypes";

const isTransportProvider = (value: unknown): value is TransportProvider =>
  typeof value === "string" && value in TRANSPORT_PROVIDERS;

interface LogisticsEventCardProps {
  event: LogisticsCalendarEvent;
  onClick: (e: React.MouseEvent) => void;
  variant?: "calendar" | "detailed";
  compact?: boolean;
  interactive?: boolean;
  className?: string;
  /** Drivers/vehicles assigned in the matrix; omitted when the caller does not load them. */
  drivers?: EventDriverSummary[];
}

export const LogisticsEventCard = memo(function LogisticsEventCard({
  event,
  onClick,
  variant = "detailed",
  compact = false,
  interactive = true,
  className,
  drivers,
}: LogisticsEventCardProps) {
  const isCrewTransfer = event.event_type === "crew_transfer";
  const defaultColor = event.event_type === "load"
    ? "rgb(191, 219, 254)"
    : isCrewTransfer ? "rgb(254, 215, 170)" : "rgb(187, 247, 208)";
  const EventTypeIcon = event.event_type === "load" ? Package : isCrewTransfer ? Users : PackageCheck;
  const borderColor = event.color || defaultColor;
  const transportProvider = event.transport_provider;
  const providerConfig = isTransportProvider(transportProvider)
    ? TRANSPORT_PROVIDERS[transportProvider]
    : null;

  const getBgColor = () => {
    if (!event.color) return "";
    try {
      if (event.color.startsWith("#")) {
        const r = parseInt(event.color.slice(1, 3), 16);
        const g = parseInt(event.color.slice(3, 5), 16);
        const b = parseInt(event.color.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, 0.1)`;
      }
      return event.color.replace("rgb", "rgba").replace(")", ", 0.1)");
    } catch {
      return "";
    }
  };

  const getDisplayName = () => {
    const title =
      event.title ||
      event.custom_title ||
      event.manual_title ||
      event.request_title ||
      event.job?.title;
    if (title) return title;

    const typeLabel = transportOperationLabel(event.event_type, event.movement_type);
    const transportLabel = event.transport_type ? ` - ${getLogisticsTransportTypeLabel(event.transport_type)}` : "";
    return `${typeLabel}${transportLabel}`;
  };

  return (
    <div
      onClick={interactive ? onClick : undefined}
      style={{
        borderColor,
        backgroundColor: getBgColor(),
      }}
      className={cn(
        "min-w-0 rounded-md border bg-card p-2 transition-shadow",
        interactive ? "cursor-pointer hover:shadow-md" : "cursor-default",
        className,
      )}
    >
      {variant === "calendar" ? (
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-xs">{getDisplayName()}</span>
        </div>
      ) : (
        <>
          <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Badge
                  variant={event.event_type === "load" ? "default" : "secondary"}
                  className="flex items-center gap-1"
                >
                  <EventTypeIcon className="h-3 w-3" />
                  <span>{transportOperationLabel(event.event_type, event.movement_type)}</span>
                </Badge>
                <Badge variant="outline" className="flex max-w-full items-center gap-1">
                  <Truck className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {getLogisticsTransportTypeLabel(event.transport_type)}
                    {event.transport_type === "sleeper_bus" && event.berth_count ? ` · ${event.berth_count} literas` : ""}
                  </span>
                </Badge>
              </div>
            </div>

            {providerConfig?.icon && (
              <div className="shrink-0">
                <img
                  src={providerConfig.icon}
                  alt={providerConfig.label}
                  width={96}
                  height={96}
                  loading="lazy"
                  decoding="async"
                  className="h-14 w-14 object-contain sm:h-20 sm:w-20 xl:h-16 xl:w-16 2xl:h-20 2xl:w-20"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}
          </div>

          <h3 className="mt-2 min-w-0 break-words font-medium">{getDisplayName()}</h3>
          <div className="mt-1 text-sm text-muted-foreground">
            {event.end_date && event.end_time
              ? formatTransportSpan(event)
              : format(new Date(`2000-01-01T${event.event_time}`), "HH:mm")}
            {isCrewTransfer && event.passenger_count ? ` · ${event.passenger_count} personas` : ""}
          </div>

          {event.license_plate && (
            <div className="mt-1 break-words text-sm text-muted-foreground">
              {event.license_plate}
            </div>
          )}

          <div className="mt-1 flex min-w-0 flex-wrap gap-1">
            {event.departments?.map((dept) => (
              <Badge key={dept.department} variant="secondary" className="max-w-full text-xs">
                <span className="truncate">{getDepartmentLabel(dept.department)}</span>
              </Badge>
            ))}
          </div>

          {event.loading_bay && (
            <div className="mt-2 break-words text-sm text-muted-foreground">
              Muelle: {event.loading_bay}
            </div>
          )}

          {event.notes && (
            <div className="mt-2 flex min-w-0 items-start gap-1.5 text-sm text-muted-foreground">
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0 break-words line-clamp-2">{event.notes}</span>
            </div>
          )}

          {drivers && drivers.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {drivers.map((driver) => (
                <li key={driver.assignmentId} className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 break-words">{driver.label}</span>
                  <Badge variant="outline" className={cn("text-xs", assignmentStatusClass(driver.status))}>
                    {DRIVER_ASSIGNMENT_STATUS_LABELS[driver.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
});
