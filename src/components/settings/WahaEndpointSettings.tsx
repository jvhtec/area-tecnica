import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, QrCode, RefreshCw, RotateCcw, Save, Smartphone, Unplug } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getWahaEndpointLabel,
  normalizeWahaEndpoint,
  NO_WAHA_ENDPOINT,
  type WahaEndpointOption,
  WAHA_ENDPOINTS,
} from "@/constants/wahaEndpoints";
import { toast } from "@/hooks/use-toast";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { queryKeys } from "@/lib/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";

type WahaSessionStatus = "NOT_CONFIGURED" | "NOT_CREATED" | "STOPPED" | "STARTING" | "SCAN_QR_CODE" | "WORKING" | "FAILED" | "UNKNOWN" | "UNREACHABLE";

type WahaEndpointStatus = WahaEndpointOption & {
  session?: string | null;
  status?: WahaSessionStatus | string | null;
  me?: { id?: string; pushName?: string } | null;
  error?: string | null;
};

type WahaSessionResponse = {
  endpoint: string | null;
  session?: string | null;
  status?: WahaSessionStatus | string | null;
  me?: { id?: string; pushName?: string } | null;
  qr?: {
    dataUrl: string;
    mimetype: string;
  };
  endpoints?: WahaEndpointStatus[];
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
    case "UNREACHABLE":
      return "Sin respuesta";
    default:
      return "Desconocido";
  }
}

function statusVariant(status: string | null | undefined): "default" | "secondary" | "destructive" | "outline" {
  if (status === "WORKING") return "default";
  if (status === "FAILED" || status === "UNREACHABLE") return "destructive";
  if (status === "SCAN_QR_CODE" || status === "STARTING") return "secondary";
  return "outline";
}

function endpointHost(endpoint: string) {
  return endpoint.replace(/^https?:\/\//, "");
}

export function WahaEndpointSettings() {
  const queryClient = useQueryClient();
  const { user } = useOptimizedAuth();
  const userId = user?.id ?? null;
  const [selectedEndpoint, setSelectedEndpoint] = useState(NO_WAHA_ENDPOINT);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const queryKey = queryKeys.scope("waha-session", userId || "anonymous");
  const endpointDirectoryQueryKey = queryKeys.scope("waha-session-endpoints", userId || "anonymous");
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey,
    enabled: Boolean(userId),
    queryFn: () => invokeWahaSession({ action: "get" }),
    staleTime: 1000 * 30,
  });
  const {
    data: endpointDirectory,
    isFetching: isFetchingEndpointDirectory,
    refetch: refetchEndpointDirectory,
  } = useQuery({
    queryKey: endpointDirectoryQueryKey,
    enabled: Boolean(userId),
    queryFn: () => invokeWahaSession({ action: "endpoints" }),
    retry: false,
    staleTime: 1000 * 60,
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

  const endpointOptions = useMemo<WahaEndpointStatus[]>(() => {
    const configuredOptions = endpointDirectory?.endpoints?.length
      ? endpointDirectory.endpoints
      : data?.endpoints?.length
        ? data.endpoints
        : WAHA_ENDPOINTS;
    const optionsByValue = new Map<string, WahaEndpointStatus>();

    for (const option of configuredOptions) {
      const normalized = normalizeWahaEndpoint(option.value);
      if (!normalized) continue;

      optionsByValue.set(normalized, {
        ...option,
        label: option.label || getWahaEndpointLabel(normalized),
        value: normalized,
      });
    }

    if (savedEndpoint && !optionsByValue.has(savedEndpoint)) {
      optionsByValue.set(savedEndpoint, {
        label: getWahaEndpointLabel(savedEndpoint),
        value: savedEndpoint,
        session: data?.session,
        status: data?.status,
        me: data?.me,
      });
    }

    return [...optionsByValue.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  }, [data?.endpoints, data?.me, data?.session, data?.status, endpointDirectory?.endpoints, savedEndpoint]);

  const endpointStatusByValue = useMemo(() => {
    return new Map(endpointOptions.map((option) => [option.value, option]));
  }, [endpointOptions]);
  const selectedEndpointStatus = selectedNormalized
    ? endpointStatusByValue.get(selectedNormalized)?.status
    : "NOT_CONFIGURED";
  const displayedStatus = savedEndpoint && selectedNormalized === savedEndpoint && data?.status && data.status !== "UNKNOWN"
    ? data.status
    : selectedEndpointStatus || data?.status;

  const updateSessionCaches = (result: WahaSessionResponse) => {
    queryClient.setQueryData<WahaSessionResponse | undefined>(queryKey, (current) => ({
      ...result,
      endpoints: result.endpoints ?? current?.endpoints,
    }));

    if (!result.endpoint) return;

    const normalizedResultEndpoint = normalizeWahaEndpoint(result.endpoint);
    if (!normalizedResultEndpoint) return;

    queryClient.setQueryData<WahaSessionResponse | undefined>(endpointDirectoryQueryKey, (current) => {
      if (!current?.endpoints?.length) return current;

      return {
        ...current,
        endpoint: result.endpoint,
        session: result.session,
        status: result.status,
        me: result.me,
        endpoints: current.endpoints.map((option) => {
          const normalizedOptionEndpoint = normalizeWahaEndpoint(option.value);
          if (normalizedOptionEndpoint !== normalizedResultEndpoint) return option;

          return {
            ...option,
            session: result.session,
            status: result.status,
            me: result.me,
            error: null,
          };
        }),
      };
    });
  };

  const saveMutation = useMutation({
    mutationFn: () => invokeWahaSession({ action: "save", endpoint: selectedNormalized }),
    onSuccess: (result) => {
      setQrDataUrl(null);
      updateSessionCaches(result);
      toast({
        title: result.endpoint ? "Endpoint WAHA guardado" : "Endpoint WAHA eliminado",
        description: result.endpoint ? getWahaEndpointLabel(result.endpoint) : "El envio por WhatsApp queda desactivado para esta cuenta.",
      });
      void refetchEndpointDirectory();
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
    onSuccess: (result) => {
      setQrDataUrl(null);
      updateSessionCaches(result);
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
    onSuccess: (result) => {
      setQrDataUrl(null);
      updateSessionCaches(result);
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

  const restartMutation = useMutation({
    mutationFn: () => invokeWahaSession({ action: "restart" }),
    onSuccess: (result) => {
      setQrDataUrl(null);
      updateSessionCaches(result);
      toast({
        title: "Sesion WAHA reiniciada",
        description: `La sesion ${result.session || "default"} esta ${statusLabel(result.status).toLowerCase()}.`,
      });
    },
    onError: (err) => {
      toast({
        title: "No se pudo reiniciar la sesion WAHA",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    },
  });

  const qrMutation = useMutation({
    mutationFn: () => invokeWahaSession({ action: "qr" }),
    onSuccess: (result) => {
      if (result.qr?.dataUrl) {
        setQrDataUrl(result.qr.dataUrl);
      } else {
        setQrDataUrl(null);
      }
      updateSessionCaches({
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
    restartMutation.isPending ||
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
            <Badge variant={statusVariant(displayedStatus)}>
              {statusLabel(displayedStatus)}
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
                  <span className="flex min-w-0 items-center justify-between gap-3">
                    <span className="truncate">
                      {option.label} - {endpointHost(option.value)}
                    </span>
                    {option.status && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {statusLabel(option.status)}
                      </span>
                    )}
                  </span>
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

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (savedEndpoint && !hasUnsavedChange) {
              statusMutation.mutate();
              void refetchEndpointDirectory();
              return;
            }

            void refetch();
            void refetchEndpointDirectory();
          }}
          disabled={isFetching || isFetchingEndpointDirectory || isBusy}
          className="w-full"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching || isFetchingEndpointDirectory || statusMutation.isPending ? "animate-spin" : ""}`} />
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
          variant="outline"
          size="sm"
          onClick={() => restartMutation.mutate()}
          disabled={!canUseSessionControls}
          className="w-full"
        >
          {restartMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="mr-2 h-4 w-4" />
          )}
          Reiniciar
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => qrMutation.mutate()}
          disabled={!canUseSessionControls}
          className="w-full"
        >
          {qrMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <QrCode className="mr-2 h-4 w-4" />
          )}
          QR
        </Button>
      </div>

      <div className="rounded-md border p-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium">Estado de endpoints</span>
          {isFetchingEndpointDirectory && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Actualizando
            </span>
          )}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {endpointOptions.map((option) => (
            <div key={option.value} className="flex min-w-0 items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate font-medium">{option.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{endpointHost(option.value)}</span>
              </span>
              <Badge variant={statusVariant(option.status)} className="shrink-0">
                {statusLabel(option.status)}
              </Badge>
            </div>
          ))}
        </div>
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
              <span className="font-medium">Servidor:</span> {endpointHost(savedEndpoint)}
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
