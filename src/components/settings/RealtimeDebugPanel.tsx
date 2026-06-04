import { useMemo } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSubscriptionContext } from "@/providers/SubscriptionProvider";

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const MADRID_TIME_ZONE = "Europe/Madrid";

const CONNECTION_LABELS = {
  connected: "conectado",
  connecting: "conectando",
  disconnected: "desconectado",
} as const;

const PRIORITY_LABELS = {
  high: "alta",
  medium: "media",
  low: "baja",
} as const;

const formatTime = (timestamp: number | null): string => {
  if (!timestamp) {
    return "Sin payloads todavía";
  }

  return formatInTimeZone(timestamp, MADRID_TIME_ZONE, "HH:mm:ss");
};

export function RealtimeDebugPanel() {
  const {
    connectionStatus,
    subscriptionCount,
    debugSubscriptions,
    forceRefresh,
  } = useSubscriptionContext();

  const diagnostics = useMemo(() => {
    const now = Date.now();
    const tableCounts = new Map<string, number>();

    debugSubscriptions.forEach((subscription) => {
      tableCounts.set(subscription.table, (tableCounts.get(subscription.table) ?? 0) + 1);
    });

    const duplicateTables = Array.from(tableCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([table]) => table);

    const staleSubscriptions = debugSubscriptions.filter((subscription) => {
      if (!subscription.lastPayloadAt) {
        return false;
      }

      return now - subscription.lastPayloadAt > FIVE_MINUTES_MS;
    });

    const lastPayloadAt = debugSubscriptions.reduce<number | null>((latest, subscription) => {
      if (!subscription.lastPayloadAt) {
        return latest;
      }

      return latest === null
        ? subscription.lastPayloadAt
        : Math.max(latest, subscription.lastPayloadAt);
    }, null);

    return {
      duplicateTables,
      staleSubscriptions,
      lastPayloadAt,
    };
  }, [debugSubscriptions]);

  const isConnected = connectionStatus === "connected";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isConnected ? "default" : "destructive"} className="gap-1">
            {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {CONNECTION_LABELS[connectionStatus]}
          </Badge>
          <Badge variant="outline">{subscriptionCount} activas</Badge>
          <Badge variant={diagnostics.duplicateTables.length > 0 ? "secondary" : "outline"}>
            {diagnostics.duplicateTables.length} tablas duplicadas
          </Badge>
          <Badge variant={diagnostics.staleSubscriptions.length > 0 ? "secondary" : "outline"}>
            {diagnostics.staleSubscriptions.length} obsoletas
          </Badge>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => forceRefresh()}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar tiempo real
        </Button>
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Último payload</p>
          <p className="font-medium">{formatTime(diagnostics.lastPayloadAt)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Rutas propietarias</p>
          <p className="font-medium">
            {new Set(debugSubscriptions.flatMap((subscription) => subscription.ownerRoutes)).size}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Invalidaciones</p>
          <p className="font-medium">
            {debugSubscriptions.reduce((total, subscription) => total + subscription.invalidationCount, 0)}
          </p>
        </div>
      </div>

      <div className="max-h-80 overflow-auto rounded-md border">
        <div className="grid grid-cols-[minmax(8rem,1fr)_minmax(8rem,1fr)_6rem_6rem] gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          <span>Tabla</span>
          <span>Ruta propietaria</span>
          <span>Prioridad</span>
          <span>Eventos</span>
        </div>
        {debugSubscriptions.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">No hay suscripciones activas.</p>
        ) : (
          debugSubscriptions.map((subscription) => (
            <div
              key={subscription.key}
              className="grid grid-cols-[minmax(8rem,1fr)_minmax(8rem,1fr)_6rem_6rem] gap-2 border-b px-3 py-2 text-xs last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{subscription.table}</p>
                <p className="truncate text-muted-foreground">
                  {JSON.stringify(subscription.queryKey)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="truncate">
                  {subscription.ownerRoutes.length > 0
                    ? subscription.ownerRoutes.join(", ")
                    : "Sin propietario"}
                </p>
                <p className="text-muted-foreground">
                  {formatTime(subscription.lastPayloadAt)}
                </p>
              </div>
              <span>{PRIORITY_LABELS[subscription.priority]}</span>
              <span>{subscription.invalidationCount}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
