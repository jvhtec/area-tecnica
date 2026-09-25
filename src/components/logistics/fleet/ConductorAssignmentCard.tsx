import { Check, Copy, Loader2, MapPin, MessageCircle, Navigation, Phone, Truck, UserCog, Users, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { JobProducerContact } from "@/features/jobs/producer-claims/producerClaims";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  DRIVER_ASSIGNMENT_STATUS_LABELS,
  TRANSPORT_EVENT_TYPE_LABELS,
  formatTransportTime,
  vehicleTypeLabel,
  type MyTransportAssignment,
} from "@/features/logistics/fleet/fleetModel";
import { buildNavigationLinks, describeTimeUntil, isAppleDevice, navigationQuery } from "@/features/logistics/fleet/navigation";
import { useStaticMap } from "@/features/logistics/fleet/useLogisticsFleet";
import { buildTelHref, buildWhatsAppHref } from "@/utils/phoneLinks";

import { assignmentStatusClass } from "./matrixStyles";

type ConductorAssignmentCardProps = {
  assignment: MyTransportAssignment;
  busy: boolean;
  /** The driver's next run: gets the map preview and a "starts in…" line. */
  highlight?: boolean;
  /** ISO instant used for the "starts in…" line; the dashboard passes one per render. */
  nowIso: string;
  producers?: JobProducerContact[];
  onRespond: (response: "confirmed" | "declined") => void;
};

/**
 * One transport as the driver sees it on the phone: when, what, where (with
 * turn-by-turn links and a map), which vehicle, who to call on site, and the
 * confirm / decline actions.
 */
export function ConductorAssignmentCard({
  assignment,
  busy,
  highlight = false,
  nowIso,
  producers = [],
  onRespond,
}: ConductorAssignmentCardProps) {
  const { toast } = useToast();
  const title = assignment.title?.trim() || assignment.job_title?.trim() || "Transporte";
  const movement = TRANSPORT_EVENT_TYPE_LABELS[assignment.event_type] ?? "Transporte";
  const target = {
    lat: assignment.location_lat,
    lng: assignment.location_lng,
    address: assignment.location_address,
    name: assignment.location_name,
  };
  const placeLabel = navigationQuery(target);
  const links = buildNavigationLinks(target, assignment.origin);
  // Crew transfers: the driver goes to the pick-up point first.
  const pickup = {
    lat: assignment.pickup_lat,
    lng: assignment.pickup_lng,
    address: assignment.pickup_address,
    name: assignment.pickup_name,
  };
  const pickupLabel = navigationQuery(pickup);
  const pickupLinks = buildNavigationLinks(pickup);
  const hasRoute = Boolean(assignment.origin || assignment.destination);
  const finished = assignment.ends_at <= nowIso;
  const timeUntil = describeTimeUntil(assignment.starts_at, assignment.ends_at, nowIso, assignment.timezone);
  // Only the highlighted (next) run pays for a map tile; the others show it on demand
  // through the navigation links.
  const map = useStaticMap(pickupLabel ? pickup : target, highlight && !finished);

  const copyAddress = async () => {
    if (!placeLabel) return;
    try {
      await navigator.clipboard.writeText(placeLabel);
      toast({ title: "Dirección copiada" });
    } catch {
      toast({ title: "No se pudo copiar la dirección", variant: "destructive" });
    }
  };

  return (
    <Card className={cn(assignment.status === "declined" && "opacity-70", highlight && "border-primary shadow-sm")}>
      {highlight && map.data && (
        <img
          src={map.data}
          alt={`Mapa de ${assignment.location_name ?? placeLabel ?? "la ubicación"}`}
          className="h-36 w-full rounded-t-lg object-cover"
          loading="lazy"
        />
      )}
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-lg font-semibold leading-tight">
              {formatTransportTime(assignment.starts_at, assignment.timezone)}–{formatTransportTime(assignment.ends_at, assignment.timezone)}
            </p>
            {highlight && !finished && (
              <p className="text-sm font-medium text-primary">{timeUntil}</p>
            )}
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
          {pickupLabel && (
            <div>
              <dt className="text-muted-foreground">Punto de encuentro</dt>
              <dd className="flex items-start gap-1 break-words">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{pickupLabel}</span>
              </dd>
            </div>
          )}
          {assignment.passenger_count !== null && (
            <div>
              <dt className="text-muted-foreground">Personas</dt>
              <dd className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5 shrink-0" />
                {assignment.passenger_count}
              </dd>
            </div>
          )}
          {placeLabel && (
            <div>
              <dt className="text-muted-foreground">{pickupLabel ? "Destino" : "Lugar"}</dt>
              <dd className="flex items-start gap-1 break-words">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{placeLabel}</span>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-muted-foreground">Vehículo</dt>
            <dd className="inline-flex items-center gap-1">
              <Truck className="h-3.5 w-3.5 shrink-0" />
              {assignment.vehicle
                ? `${assignment.vehicle.name} · ${assignment.vehicle.license_plate}${assignment.vehicle.has_tail_lift ? " · Plataforma" : ""}`
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

        {pickupLinks && !finished && (
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <a href={pickupLinks.google} target="_blank" rel="noopener noreferrer">
                <Navigation className="mr-1 h-4 w-4" /> Ir al punto de encuentro
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={pickupLinks.waze} target="_blank" rel="noopener noreferrer" aria-label="Waze al punto de encuentro">Waze</a>
            </Button>
          </div>
        )}

        {links && !finished && (
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <a href={links.google} target="_blank" rel="noopener noreferrer">
                <Navigation className="mr-1 h-4 w-4" /> {pickupLabel ? "Cómo llegar al destino" : "Cómo llegar"}
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={links.waze} target="_blank" rel="noopener noreferrer">Waze</a>
            </Button>
            {isAppleDevice() && (
              <Button asChild size="sm" variant="outline">
                <a href={links.apple} target="_blank" rel="noopener noreferrer">Apple Maps</a>
              </Button>
            )}
            {links.route && (
              <Button asChild size="sm" variant="outline">
                <a href={links.route} target="_blank" rel="noopener noreferrer">Ruta completa</a>
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => void copyAddress()} aria-label="Copiar dirección">
              <Copy className="mr-1 h-4 w-4" /> Copiar
            </Button>
          </div>
        )}

        {(assignment.notes || assignment.event_notes) && (
          <div className="space-y-1 rounded-md bg-muted/50 p-2 text-sm">
            {assignment.notes && <p className="break-words">{assignment.notes}</p>}
            {assignment.event_notes && <p className="break-words text-muted-foreground">{assignment.event_notes}</p>}
          </div>
        )}

        {assignment.status === "declined" && assignment.decline_reason && (
          <p className="text-sm text-muted-foreground">Motivo: {assignment.decline_reason}</p>
        )}

        {producers.length > 0 && (
          <div className="space-y-2 rounded-md border p-2 text-sm">
            <p className="flex items-center gap-1 text-muted-foreground">
              <UserCog className="h-3.5 w-3.5" />
              {producers.length > 1 ? "Responsables de producción" : "Responsable de producción"}
            </p>
            {producers.map((producer) => {
              const whatsApp = buildWhatsAppHref(producer.phone, `Hola ${producer.display_name}, soy el conductor de «${title}».`);
              const tel = buildTelHref(producer.phone);
              return (
                <div key={producer.producer_id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{producer.display_name}</span>
                  <span className="flex gap-1">
                    {whatsApp && (
                      <Button asChild size="sm" variant="outline">
                        <a href={whatsApp} target="_blank" rel="noopener noreferrer" aria-label={`Escribir por WhatsApp a ${producer.display_name}`}>
                          <MessageCircle className="mr-1 h-4 w-4" /> WhatsApp
                        </a>
                      </Button>
                    )}
                    {tel && (
                      <Button asChild size="sm" variant="outline">
                        <a href={tel} aria-label={`Llamar a ${producer.display_name}`}>
                          <Phone className="mr-1 h-4 w-4" /> Llamar
                        </a>
                      </Button>
                    )}
                    {!whatsApp && !tel && <span className="text-muted-foreground">Sin teléfono</span>}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {!finished && (
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
        )}
      </CardContent>
    </Card>
  );
}
