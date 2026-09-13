import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, MapPin, PackageCheck, Route, Truck, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/react-query";
import {
  listTransportRequests,
  setTransportRequestStage,
  TRANSPORT_MOVEMENT_LABELS,
  TRANSPORT_PRIORITY_LABELS,
  TRANSPORT_SOURCE_LABELS,
  TRANSPORT_STAGE_LABELS,
  type TransportPlanningStatus,
  type TransportRequestRecord,
} from "@/features/logistics/transportRequests";
import { getLogisticsTransportTypeLabel } from "@/components/technician/details-modal/formatters";
import { TRANSPORT_PROVIDERS } from "@/constants/transportProviders";
import { ACTIVE_DEPARTMENTS, getDepartmentLabel } from "@/types/department";
import { formatInJobTimezone } from "@/utils/timezoneUtils";
import { TransportRequestPlanningDialog } from "./TransportRequestPlanningDialog";

const ACTIVE_STAGES: TransportPlanningStatus[] = ["requested", "reviewing", "planned", "confirmed"];

const providerLabel = (value: string | null): string | null => {
  if (!value) return null;
  return (TRANSPORT_PROVIDERS as Record<string, { label: string } | undefined>)[value]?.label ?? value;
};

// Events carry plain `yyyy-MM-dd` / `HH:mm:ss` columns, already in the operating timezone.
const eventMoment = (date: string, time: string): string => {
  const [, month, day] = date.split("-");
  return day && month ? `${day}/${month} · ${time.slice(0, 5)}` : `${date} · ${time.slice(0, 5)}`;
};

const stageVariant = (stage: TransportPlanningStatus): "default" | "secondary" | "outline" | "destructive" => {
  if (stage === "cancelled") return "destructive";
  if (stage === "confirmed" || stage === "completed") return "default";
  if (stage === "planned" || stage === "reviewing") return "secondary";
  return "outline";
};

const priorityVariant = (priority: TransportRequestRecord["priority"]): "default" | "secondary" | "outline" | "destructive" => {
  if (priority === "urgent") return "destructive";
  if (priority === "high") return "default";
  return "outline";
};

interface TransportRequestsInboxProps {
  readOnly?: boolean;
}

export function TransportRequestsInbox({ readOnly = false }: TransportRequestsInboxProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [stageFilter, setStageFilter] = useState<string>("active");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [planningRequest, setPlanningRequest] = useState<TransportRequestRecord | null>(null);

  const queryKey = queryKeys.scope("logistics-transport-inbox", stageFilter);
  const { data: requests = [], isLoading, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: () => listTransportRequests({ includeClosed: stageFilter !== "active" }),
  });

  const filtered = useMemo(() => requests.filter((request) => {
    if (departmentFilter !== "all" && request.department !== departmentFilter) return false;
    if (stageFilter === "active") return ACTIVE_STAGES.includes(request.planning_status);
    return request.planning_status === stageFilter;
  }), [departmentFilter, requests, stageFilter]);

  const refresh = async () => {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("transport-requests-all") }),
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("transport-request") }),
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("logistics-events") }),
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("today-logistics") }),
    ]);
  };

  const moveTo = async (request: TransportRequestRecord, stage: TransportPlanningStatus) => {
    if (readOnly) return;
    try {
      await setTransportRequestStage(request.id, stage);
      toast({ title: `Solicitud ${TRANSPORT_STAGE_LABELS[stage].toLowerCase()}` });
      await refresh();
    } catch (stageError) {
      toast({
        title: "No se pudo actualizar la solicitud",
        description: stageError instanceof Error ? stageError.message : String(stageError),
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Cargando solicitudes de transporte…</CardContent></Card>;
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <p className="text-sm text-destructive">{error instanceof Error ? error.message : "No se pudieron cargar las solicitudes."}</p>
          <Button variant="outline" onClick={() => void refetch()}>Reintentar</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">Solicitudes de transporte</h2>
            {readOnly && <Badge variant="outline">Solo lectura</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">Demanda pendiente, planificación y confirmación en un único flujo.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los dptos.</SelectItem>
              {ACTIVE_DEPARTMENTS.map((department) => (
                <SelectItem key={department} value={department}>{getDepartmentLabel(department)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Activas</SelectItem>
              <SelectItem value="requested">Solicitadas</SelectItem>
              <SelectItem value="reviewing">En revisión</SelectItem>
              <SelectItem value="planned">Planificadas</SelectItem>
              <SelectItem value="confirmed">Confirmadas</SelectItem>
              <SelectItem value="completed">Completadas</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No hay solicitudes en este filtro.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((request) => {
            const vehicles = request.items.map((item) => getLogisticsTransportTypeLabel(item.transport_type)).join(" · ") || "Sin vehículo definido";
            const route = [request.origin, request.destination].filter(Boolean).join(" → ");
            const load = request.events.find((event) => event.event_type === "load");
            const unload = request.events.find((event) => event.event_type === "unload");
            return (
              <Card key={request.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="min-w-0 break-words text-base sm:text-lg">{request.job_title}</CardTitle>
                        <Badge variant="outline">{getDepartmentLabel(request.department)}</Badge>
                        <Badge variant={stageVariant(request.planning_status)}>{TRANSPORT_STAGE_LABELS[request.planning_status]}</Badge>
                        {request.priority !== "normal" && <Badge variant={priorityVariant(request.priority)}>{TRANSPORT_PRIORITY_LABELS[request.priority]}</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Route className="h-3.5 w-3.5" />{TRANSPORT_MOVEMENT_LABELS[request.movement_type]}</span>
                        <span className="inline-flex min-w-0 items-center gap-1"><Truck className="h-3.5 w-3.5 shrink-0" /><span className="break-words">{vehicles}</span></span>
                        {request.needed_at && <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{formatInJobTimezone(request.needed_at, "dd/MM · HH:mm")}</span>}
                      </div>
                    </div>
                    {!readOnly && (
                      <div className="flex flex-wrap gap-2">
                        {request.planning_status === "requested" && <Button size="sm" variant="secondary" onClick={() => void moveTo(request, "reviewing")}>Tomar</Button>}
                        {ACTIVE_STAGES.includes(request.planning_status) && (
                          <Button size="sm" onClick={() => setPlanningRequest(request)}>
                            {request.events.length ? "Editar planificación" : "Planificar"}
                          </Button>
                        )}
                        {(request.planning_status === "planned" || request.planning_status === "confirmed") && (
                          <Button size="sm" variant="outline" onClick={() => void moveTo(request, "completed")}>
                            <CheckCircle2 className="mr-1 h-4 w-4" />Completar
                          </Button>
                        )}
                        {ACTIVE_STAGES.includes(request.planning_status) && (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void moveTo(request, "cancelled")}>
                            <XCircle className="mr-1 h-4 w-4" />Cancelar
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {request.description && <p className="text-sm break-words">{request.description}</p>}
                  {route && <div className="flex items-start gap-2 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 break-words">{route}</span></div>}
                  {(load || unload) && (
                    <div className="rounded-md border bg-muted/30 p-3 text-xs sm:text-sm">
                      <div className="flex flex-wrap gap-x-5 gap-y-1">
                        {load && <span>Carga: {eventMoment(load.event_date, load.event_time)}</span>}
                        {unload && <span>Descarga: {eventMoment(unload.event_date, unload.event_time)}</span>}
                        {providerLabel(load?.transport_provider ?? unload?.transport_provider ?? null) && (
                          <span>Proveedor: {providerLabel(load?.transport_provider ?? unload?.transport_provider ?? null)}</span>
                        )}
                        {(load?.license_plate || unload?.license_plate) && <span>Matrícula: {load?.license_plate || unload?.license_plate}</span>}
                      </div>
                      {request.events.length > 2 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {Math.ceil(request.events.length / 2)} vehículos planificados · consulta el calendario para verlos todos.
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>Solicitó: {request.requester_name || "Usuario eliminado"}</span>
                    <span>Procedencia: {TRANSPORT_SOURCE_LABELS[request.source_type] ?? request.source_type}</span>
                    {!request.is_hoja_relevant && <span className="inline-flex items-center gap-1"><PackageCheck className="h-3.5 w-3.5" />Fuera de Hoja de Ruta</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!readOnly && (
        <TransportRequestPlanningDialog
          open={Boolean(planningRequest)}
          onOpenChange={(open) => { if (!open) setPlanningRequest(null); }}
          request={planningRequest}
          onSaved={() => void refresh()}
        />
      )}
    </div>
  );
}