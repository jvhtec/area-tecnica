import { LocateFixed, LocateOff } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { MyTransportAssignment } from "@/features/logistics/fleet/fleetModel";
import { SHARING_LEAD_MINUTES, describeLocationAge } from "@/features/logistics/fleet/tracking";
import { useDriverLocationSharing } from "@/features/logistics/fleet/useDriverLocationSharing";

type ConductorLocationSharingCardProps = {
  assignments: readonly MyTransportAssignment[];
  nowIso: string;
};

/**
 * The driver's opt-in switch for live tracking. Plain about what is shared,
 * when, and with whom: only the current position, only while a transport is
 * running or about to start, only to logistics.
 */
export function ConductorLocationSharingCard({ assignments, nowIso }: ConductorLocationSharingCardProps) {
  const sharing = useDriverLocationSharing(assignments, nowIso);
  const leadHours = Math.round(SHARING_LEAD_MINUTES / 60);

  const statusLine = (() => {
    switch (sharing.status) {
      case "off":
        return "Desactivado. Logística no ve tu posición.";
      case "unsupported":
        return "Este dispositivo no permite compartir la ubicación.";
      case "waiting":
        return `Se enviará automáticamente cuando tengas un transporte en marcha o que empiece en menos de ${leadHours} h.`;
      case "error":
        return sharing.error ?? "No se pudo obtener tu ubicación.";
      case "active":
        return sharing.lastReportedAt
          ? `Compartiendo · última posición enviada ${describeLocationAge(sharing.lastReportedAt, nowIso)}.`
          : "Compartiendo · buscando tu posición…";
    }
  })();

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="conductor-share-location" className="flex items-center gap-2 text-sm font-medium">
            {sharing.status === "active" ? (
              <LocateFixed className="h-4 w-4 text-primary" />
            ) : (
              <LocateOff className="h-4 w-4 text-muted-foreground" />
            )}
            Compartir mi ubicación con logística
          </Label>
          <Switch
            id="conductor-share-location"
            checked={sharing.enabled}
            disabled={sharing.status === "unsupported"}
            onCheckedChange={sharing.toggle}
          />
        </div>
        <p
          className={sharing.status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
          aria-live="polite"
        >
          {statusLine}
        </p>
        {sharing.status === "active" && sharing.error && (
          <p className="text-sm text-destructive">{sharing.error}</p>
        )}
        {sharing.enabled && sharing.status !== "unsupported" && (
          <p className="text-xs text-muted-foreground">
            Solo se guarda tu última posición, nunca el recorrido. Mantén la app abierta: en segundo plano el
            teléfono deja de enviarla.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
