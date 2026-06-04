import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, QrCode, RefreshCw, Save, Smartphone, Unplug } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getWahaEndpointLabel,
  normalizeWahaEndpoint,
  NO_WAHA_ENDPOINT,
  WAHA_ENDPOINTS,
} from "@/constants/wahaEndpoints";
import { toast } from "@/hooks/use-toast";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { queryKeys } from "@/lib/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";

type WahaSessionStatus = "NOT_CONFIGURED" | "NOT_CREATED" | "STOPPED" | "STARTING" | "SCAN_QR_CODE" | "WORKING" | "FAILED" | "UNKNOWN";

type WahaSessionResponse = {
  endpoint: string | null;
  session?: string | null;
  status?: WahaSessionStatus | string | null;
  me?: { id?: string; pushName?: string } | null;
  qr?: {
    dataUrl: string;
    mimetype: string;
  };
};

async function invokeWahaSession(body: Record<string, unknown>) {
  const { data, error } = await dataLayerClient.functions.invoke("waha-session", { body });

  if (error) throw error;

  return data as WahaSessionResponse;
}

function statusLabel(status: string | null | undefined) {
  switch (status) {
    case "WORKING":
      return "En funcionamiento";
    case "SCAN_QR_CODE":
      return "Escanear QR";
    case "STARTING":
      return "Iniciando";
    case "STOPPED":
      return "Detenida";
    case "FAILED":
      return "Error";
    case "NOT_CREATED":
      return "Sin iniciar";
    case "NOT_CONFIGURED":
      return "Sin configurar";
    default:
      return "Desconocido";
  }
}

function statusVariant(status: string | null | undefined): "default" | "secondary" | "destructive" | "outline" {
  if (status === "WORKING") return "default";
  if (status === "FAILED") return "destructive";
  if (status === "SCAN_QR_CODE" || status === "STARTING") return "secondary";
  return "outline";
}

export function WahaEndpointSettings() {
  const queryClient = useQueryClient();
  const { user } = useOptimizedAuth();
  const userId = user?.id ?? null;
  const [selectedEndpoint, setSelectedEndpoint] = useState(NO_WAHA_ENDPOINT);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const queryKey = queryKeys.scope("waha-session", userId || "anonymous");
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey,
    enabled: Boolean(userId),
    queryFn: () => invokeWahaSession({ action: "get" }),
    staleTime: 1000 * 30,
  });

  const savedEndpoint = normalizeWahaEndpoint(data?.endpoint);
  const selectedNormalized = selectedEndpoint === NO_WAHA_ENDPOINT
    ? null
    : normalizeWahaEndpoint(selectedEndpoint);
  const hasUnsavedChange = savedEndpoint !== selectedNormalized;

  useEffect(() => {
    setSelectedEndpoint(savedEndpoint || NO_WAHA_ENDPOINT);
    setQrDataUrl(null);
  }, [savedEndpoint]);

  const endpointOptions = useMemo(() => {
    if (!savedEndpoint || WAHA_ENDPOINTS.some((option) => option.value === savedEndpoint)) {
      return WAHA_ENDPOINTS;
    }

    return [
      ...WAHA_ENDPOINTS,
      { label: "Endpoint configurado", value: savedEndpoint },
    ];
  }, [savedEndpoint]);

  const saveMutation = useMutation({
    mutationFn: () => invokeWahaSession({ action: "save", endpoint: selectedNormalized }),
    onSuccess: async (result) => {
      setQrDataUrl(null);
      await queryClient.setQueryData(queryKey, result);
      toast({
        title: result.endpoint ? "Endpoint WAHA guardado" : "Endpoint WAHA eliminado",
        description: result.endpoint ? getWahaEndpointLabel(result.endpoint) : "El envio por WhatsApp queda desactivado para esta cuenta.",
      });
    },
    onError: (err) => {
      toast({
        title: "No se pudo guardar el endpoint WAHA",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    },
  });

  const statusMutation = useMutation({
    mutationFn: () => invokeWahaSession({ action: "status" }),
    onSuccess: async (result) => {
      setQrDataUrl(null);
      await queryClient.setQueryData(queryKey, result);
    },
    onError: (err) => {
      toast({
        title: "No se pudo leer el estado WAHA",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    },
  });

  const startMutation = useMutation({
    mutationFn: () => invokeWahaSession({ action: "start" }),
    onSuccess: async (result) => {
      setQrDataUrl(null);
      await queryClient.setQueryData(queryKey, result);
      toast({
        title: "Sesion WAHA iniciada",
        description: `La sesion ${result.session || "default"} esta ${statusLabel(result.status).toLowerCase()}.`,
      });
    },
    onError: (err) => {
      toast({
        title: "No se pudo iniciar la sesion WAHA",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    },
  });

  const qrMutation = useMutation({
    mutationFn: () => invokeWahaSession({ action: "qr" }),
    onSuccess: async (result) => {
      if (result.qr?.dataUrl) {
        setQrDataUrl(result.qr.dataUrl);
      } else {
        setQrDataUrl(null);
      }
      await queryClient.setQueryData(queryKey, {
        ...result,
        qr: undefined,
      });
    },
    onError: (err) => {
      setQrDataUrl(null);
      toast({
        title: "No se pudo cargar el QR de WAHA",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    },
  });

  const isBusy =
    saveMutation.isPending ||
    statusMutation.isPending ||
    startMutation.isPending ||
    qrMutation.isPending;
  const canUseSessionControls = Boolean(savedEndpoint) && !hasUnsavedChange && !isBusy;

  if (!userId) {
    return (
      <Alert>
        <AlertDescription>Inicia sesion de nuevo para gestionar el emparejamiento de WhatsApp.</AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando configuracion WAHA...
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Configuracion WAHA no disponible</AlertTitle>
        <AlertDescription>{error instanceof Error ? error.message : "Error desconocido"}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Endpoint</span>
            <Badge variant={statusVariant(data?.status)}>
              {statusLabel(data?.status)}
            </Badge>
          </div>
          <Select value={selectedEndpoint} onValueChange={setSelectedEndpoint} disabled={saveMutation.isPending}>
            <SelectTrigger aria-label="Endpoint WAHA">
              <SelectValue placeholder="Selecciona endpoint WAHA" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_WAHA_ENDPOINT}>
                Sin endpoint WAHA
              </SelectItem>
              {endpointOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label} - {option.value.replace(/^https?:\/\//, "")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={!hasUnsavedChange || saveMutation.isPending}
          size="sm"
          className="w-full md:w-auto"
        >
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Guardar
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (savedEndpoint && !hasUnsavedChange) {
              statusMutation.mutate();
              return;
            }

            void refetch();
          }}
          disabled={isFetching || isBusy}
          className="w-full"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching || statusMutation.isPending ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => startMutation.mutate()}
          disabled={!canUseSessionControls}
          className="w-full"
        >
          {startMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Smartphone className="mr-2 h-4 w-4" />
          )}
          Iniciar
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => qrMutation.mutate()}
          disabled={!canUseSessionControls}
          className="col-span-2 w-full md:col-span-1"
        >
          {qrMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <QrCode className="mr-2 h-4 w-4" />
          )}
          QR
        </Button>
      </div>

      {hasUnsavedChange && (
        <Alert variant="info">
          <AlertDescription>Guarda el endpoint antes de iniciar o emparejar la sesion WAHA.</AlertDescription>
        </Alert>
      )}

      {!savedEndpoint && (
        <div className="flex items-start gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          <Unplug className="mt-0.5 h-4 w-4 shrink-0" />
          <span>No hay un endpoint WAHA asignado a tu cuenta.</span>
        </div>
      )}

      {savedEndpoint && (
        <div className="rounded-md border p-3 text-sm">
          <div className="grid gap-1 sm:grid-cols-2">
            <span>
              <span className="font-medium">Servidor:</span> {savedEndpoint.replace(/^https?:\/\//, "")}
            </span>
            <span>
              <span className="font-medium">Sesion:</span> {data?.session || "default"}
            </span>
            {data?.me?.pushName && (
              <span className="sm:col-span-2">
                <span className="font-medium">Cuenta vinculada:</span> {data.me.pushName}
              </span>
            )}
          </div>
        </div>
      )}

      {qrDataUrl && (
        <div className="flex flex-col items-center gap-3 rounded-md border bg-muted/20 p-4">
          <img
            src={qrDataUrl}
            alt="Codigo QR de emparejamiento WAHA"
            className="h-56 w-56 rounded bg-white p-2 shadow-sm"
          />
          <p className="text-center text-xs text-muted-foreground">
            Actualiza el QR si la sesion sigue en modo escaneo.
          </p>
        </div>
      )}
    </div>
  );
}
