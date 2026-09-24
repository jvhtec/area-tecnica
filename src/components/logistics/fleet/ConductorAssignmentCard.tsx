import { Check, Loader2, MapPin, Truck, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  DRIVER_ASSIGNMENT_STATUS_LABELS,
  TRANSPORT_EVENT_TYPE_LABELS,
  formatTransportTime,
  vehicleTypeLabel,
  type MyTransportAssignment,
} from "@/features/logistics/fleet/fleetModel";

import { assignmentStatusClass } from "./matrixStyles";

const mapsHref = (query: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

type ConductorAssignmentCardProps = {
  assignment: MyTransportAssignment;
  busy: boolean;
  onRespond: (response: "confirmed" | "declined") => void;
};

export function ConductorAssignmentCard({ assignment, busy, onRespond }: ConductorAssignmentCardProps) {
  const title = assignment.title?.trim() || assignment.job_title?.trim() || "Transporte";
  const movement = TRANSPORT_EVENT_TYPE_LABELS[assignment.event_type] ?? "Transporte";
  const place = assignment.location_address || assignment.location_name;
  const hasRoute = Boolean(assignment.origin || assignment.destination);

  return (
    <Card className={cn(assignment.status === "declined" && "opacity-70")}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-lg font-semibold leading-tight">
              {formatTransportTime(assignment.starts_at, assignment.timezone)}–{formatTransportTime(assignment.ends_at, assignment.timezone)}
            </p>
            <p className="break-words font-medium">{movement} · {title}</p>
            {assignment.title && assignment.job_title && (
              <p className="break-words text-sm text-muted-foreground">{assignment.job_title}</p>
            )}
          </div>
          <Badge variant="outline" className={assignmentStatusClass(assignment.status)}>
            {DRIVER_ASSIGNMENT_STATUS_LABELS[assignment.status]}
          </Badge>
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {hasRoute && (
            <div>
              <dt className="text-muted-foreground">Ruta</dt>
              <dd className="break-words">{assignment.origin ?? "—"} → {assignment.destination ?? "—"}</dd>
            </div>
          )}
          {place && (
            <div>
              <dt className="text-muted-foreground">Lugar</dt>
              <dd>
                <a
                  href={mapsHref(place)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 break-words text-primary underline-offset-2 hover:underline"
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {assignment.location_name && assignment.location_address
                    ? `${assignment.location_name} · ${assignment.location_address}`
                    : place}
                </a>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-muted-foreground">Vehículo</dt>
            <dd className="inline-flex items-center gap-1">
              <Truck className="h-3.5 w-3.5 shrink-0" />
              {assignment.vehicle
                ? `${assignment.vehicle.name} · ${assignment.vehicle.license_plate}`
                : `Sin vehículo propio (${vehicleTypeLabel(assignment.transport_type)})`}
            </dd>
          </div>
          {assignment.loading_bay && (
            <div>
              <dt className="text-muted-foreground">Muelle</dt>
              <dd>{assignment.loading_bay}</dd>
            </div>
          )}
        </dl>

        {(assignment.notes || assignment.event_notes) && (
          <div className="space-y-1 rounded-md bg-muted/50 p-2 text-sm">
            {assignment.notes && <p className="break-words">{assignment.notes}</p>}
            {assignment.event_notes && <p className="break-words text-muted-foreground">{assignment.event_notes}</p>}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {assignment.status !== "declined" && (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => onRespond("declined")}>
              <X className="mr-1 h-4 w-4" /> No puedo
            </Button>
          )}
          {assignment.status !== "confirmed" && (
            <Button size="sm" disabled={busy} onClick={() => onRespond("confirmed")}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
              Confirmar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
