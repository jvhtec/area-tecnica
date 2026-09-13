import { dataLayerClient } from "@/services/dataLayerClient";

export type TransportPlanningStatus =
  | "requested"
  | "reviewing"
  | "planned"
  | "confirmed"
  | "completed"
  | "cancelled";

export type TransportPriority = "low" | "normal" | "high" | "urgent";
export type TransportMovementType = "transfer" | "pickup" | "delivery" | "return" | "other";
export type TransportSourceType = "manual" | "subrental" | "tour" | "truck_planner";

export type TransportRequestItem = {
  id?: string;
  transport_type: string;
  leftover_space_meters: number | null;
};

export type TransportRequestEvent = {
  id: string;
  event_type: "load" | "unload";
  event_date: string;
  event_time: string;
  transport_provider: string | null;
  license_plate: string | null;
  loading_bay: string | null;
};

export type TransportRequestRecord = {
  id: string;
  job_id: string;
  job_title: string;
  department: string;
  status: string;
  planning_status: TransportPlanningStatus;
  description: string | null;
  note: string | null;
  needed_at: string | null;
  origin: string | null;
  destination: string | null;
  movement_type: TransportMovementType;
  priority: TransportPriority;
  source_type: TransportSourceType;
  source_ref: string | null;
  is_hoja_relevant: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  requester_name: string | null;
  items: TransportRequestItem[];
  events: TransportRequestEvent[];
};

export type SaveTransportRequestInput = {
  requestId?: string | null;
  jobId: string;
  department: string;
  description?: string | null;
  note?: string | null;
  neededAt?: string | null;
  origin?: string | null;
  destination?: string | null;
  movementType?: TransportMovementType;
  priority?: TransportPriority;
  isHojaRelevant?: boolean;
  sourceType?: TransportSourceType;
  sourceRef?: string | null;
  items: Array<{ transport_type: string; leftover_space_meters: number | null }>;
};

export type ScheduleTransportRequestInput = {
  requestId: string;
  loadDate: string;
  loadTime: string;
  unloadDate: string;
  unloadTime: string;
  provider?: string | null;
  licensePlate?: string | null;
  loadingBay?: string | null;
  notes?: string | null;
};

type RpcResult = { data: unknown; error: { message?: string } | null };
type UntypedRpc = (name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;

// `rpc` must stay bound to the client: SupabaseClient.prototype.rpc reads `this.rest`,
// so a detached reference throws "Cannot read properties of undefined (reading 'rest')".
const rpc: UntypedRpc = (name, args) =>
  (dataLayerClient.rpc as unknown as UntypedRpc).call(dataLayerClient, name, args);

const throwRpcError = (error: RpcResult["error"], fallback: string) => {
  if (error) throw new Error(error.message || fallback);
};

export const TRANSPORT_STAGE_LABELS: Record<TransportPlanningStatus, string> = {
  requested: "Solicitada",
  reviewing: "En revisión",
  planned: "Planificada",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
};

export const TRANSPORT_PRIORITY_LABELS: Record<TransportPriority, string> = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

export const TRANSPORT_SOURCE_LABELS: Record<TransportSourceType, string> = {
  manual: "Manual",
  subrental: "Subalquiler",
  tour: "Gira",
  truck_planner: "Planificador de camiones",
};

export const TRANSPORT_MOVEMENT_LABELS: Record<TransportMovementType, string> = {
  transfer: "Traslado",
  pickup: "Recogida",
  delivery: "Entrega",
  return: "Devolución",
  other: "Otro",
};

export async function listTransportRequests(options: {
  jobId?: string | null;
  department?: string | null;
  includeClosed?: boolean;
} = {}): Promise<TransportRequestRecord[]> {
  const { data, error } = await rpc("list_transport_requests", {
    p_job_id: options.jobId ?? null,
    p_department: options.department ?? null,
    p_include_closed: options.includeClosed ?? false,
  });
  throwRpcError(error, "No se pudieron cargar las solicitudes de transporte");
  return Array.isArray(data) ? (data as TransportRequestRecord[]) : [];
}

export async function saveTransportRequest(input: SaveTransportRequestInput): Promise<string> {
  const { data, error } = await rpc("save_transport_request", {
    p_request_id: input.requestId ?? null,
    p_job_id: input.jobId,
    p_department: input.department,
    p_description: input.description ?? null,
    p_note: input.note ?? null,
    p_needed_at: input.neededAt ?? null,
    p_origin: input.origin ?? null,
    p_destination: input.destination ?? null,
    p_movement_type: input.movementType ?? "transfer",
    p_priority: input.priority ?? "normal",
    p_is_hoja_relevant: input.isHojaRelevant ?? true,
    p_source_type: input.sourceType ?? "manual",
    p_source_ref: input.sourceRef ?? null,
    p_items: input.items,
  });
  throwRpcError(error, "No se pudo guardar la solicitud de transporte");
  if (typeof data !== "string") throw new Error("La solicitud no devolvió un identificador válido");
  return data;
}

export async function setTransportRequestStage(requestId: string, stage: TransportPlanningStatus): Promise<void> {
  const { error } = await rpc("set_transport_request_stage", {
    p_request_id: requestId,
    p_stage: stage,
  });
  throwRpcError(error, "No se pudo actualizar el estado de la solicitud");
}

export async function scheduleTransportRequest(input: ScheduleTransportRequestInput): Promise<void> {
  const { error } = await rpc("schedule_transport_request", {
    p_request_id: input.requestId,
    p_load_date: input.loadDate,
    p_load_time: input.loadTime,
    p_unload_date: input.unloadDate,
    p_unload_time: input.unloadTime,
    p_provider: input.provider ?? null,
    p_license_plate: input.licensePlate ?? null,
    p_loading_bay: input.loadingBay ?? null,
    p_notes: input.notes ?? null,
  });
  throwRpcError(error, "No se pudo planificar el transporte");
}
