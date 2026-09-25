import type { LogisticsEventType } from "@/components/logistics/logisticsEventTypes";
import type { LogisticsHojaCategory } from "@/constants/logisticsHojaCategories";
import type { TransportMovementType } from "@/constants/transportMovementTypes";
import type { TransportProvider } from "@/constants/transportProviders";
import type { Database } from "@/integrations/supabase/types";
import { dataLayerClient } from "@/services/dataLayerClient";

type LogisticsTransportType = Database["public"]["Enums"]["transport_type"];

export type LogisticsEventSavePayload = {
  event_type: LogisticsEventType;
  transport_type: LogisticsTransportType;
  transport_provider: TransportProvider | null;
  berth_count: number | null;
  notes: string | null;
  event_date: string;
  event_time: string;
  loading_bay: string | null;
  job_id: string | null;
  title: string | null;
  license_plate: string | null;
  color: string;
  is_hoja_relevant: boolean;
  hoja_categories: LogisticsHojaCategory[];
  location_id: string | null;
  end_date: string | null;
  end_time: string | null;
  origin_location_id: string | null;
  passenger_count: number | null;
  movement_type: TransportMovementType | null;
};

export type SavedLogisticsEvent = {
  id: string;
  job_id: string | null;
  event_type: LogisticsEventType;
  event_date: string;
  event_time: string;
  title: string | null;
  transport_type: string;
  loading_bay: string | null;
  license_plate: string | null;
};

type RpcResult = { data: unknown; error: { message?: string } | null };
type UntypedRpc = (name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;

// The RPC is introduced by the same pending migration as the client change, so it
// cannot exist in production-generated Supabase types until after deployment.
// Keep the temporary untyped seam here instead of casting every table write.
const rpc: UntypedRpc = (name, args) =>
  (dataLayerClient.rpc as unknown as UntypedRpc).call(dataLayerClient, name, args);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const stringOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const requiredString = (row: Record<string, unknown>, field: string): string => {
  const value = row[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Respuesta inválida al guardar logística: falta ${field}`);
  }
  return value;
};

const eventType = (value: unknown): LogisticsEventType => {
  if (value === "load" || value === "unload" || value === "crew_transfer") return value;
  throw new Error("Respuesta inválida al guardar logística: tipo de evento desconocido");
};

const toSavedEvent = (value: unknown): SavedLogisticsEvent => {
  const row = asRecord(value);
  return {
    id: requiredString(row, "id"),
    job_id: stringOrNull(row.job_id),
    event_type: eventType(row.event_type),
    event_date: requiredString(row, "event_date"),
    event_time: requiredString(row, "event_time"),
    title: stringOrNull(row.title),
    transport_type: requiredString(row, "transport_type"),
    loading_bay: stringOrNull(row.loading_bay),
    license_plate: stringOrNull(row.license_plate),
  };
};

export async function saveLogisticsEventPlan(input: {
  eventId?: string | null;
  event: LogisticsEventSavePayload;
  departments: readonly string[];
  pairedEvent?: LogisticsEventSavePayload | null;
}): Promise<{ event: SavedLogisticsEvent; pairedEvent: SavedLogisticsEvent | null }> {
  const { data, error } = await rpc("save_logistics_event_plan", {
    p_event: input.event,
    p_departments: [...input.departments],
    p_event_id: input.eventId ?? null,
    p_paired_event: input.pairedEvent ?? null,
  });
  if (error) throw new Error(error.message || "No se pudo guardar el evento de logística");

  const payload = asRecord(data);
  return {
    event: toSavedEvent(payload.event),
    pairedEvent: payload.paired_event ? toSavedEvent(payload.paired_event) : null,
  };
}
