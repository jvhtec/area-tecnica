import { z } from "zod";
import type { PersonnelPlan } from "@/features/logistics/personnel/personnelModel";
import { PERSONNEL_STATUSES } from "@/features/logistics/personnel/personnelModel";
import { TRANSPORT_STAGE_LABELS, type TransportRequestRecord } from "@/features/logistics/transportRequests";
import type { LogisticsMatrixData } from "@/features/logistics/fleet/fleetModel";
import { formatMadridDateKey } from "@/utils/timezoneUtils";

export const operationSchema = z.object({
  entity_kind: z.enum(["material", "personnel"]), entity_id: z.string().uuid(),
  responsible_id: z.string().uuid().nullable(), responsible_name: z.string().nullable(),
  transport_cost: z.number().nonnegative().nullable(), hotel_cost: z.number().nonnegative().nullable(),
  other_cost: z.number().nonnegative().nullable(), cost_notes: z.string(),
  transport_company: z.string().trim().max(200).optional().default(""),
  in_progress: z.boolean(), updated_at: z.string(),
});
export type Operation = z.infer<typeof operationSchema>;
export type OperationInput = Omit<Operation, "responsible_name" | "updated_at" | "transport_company"> & { transport_company?: string };
export type WorkItem = { id: string; kind: "material" | "personnel"; title: string; date: string | null; status: string; closed: boolean; missing: string[]; vehicleIds: string[]; driverIds: string[]; source: PersonnelPlan | TransportRequestRecord };
export const operationKey = (kind: string, id: string) => `${kind}:${id}`;
export function workItems(requests: TransportRequestRecord[], plans: PersonnelPlan[], matrix: LogisticsMatrixData): WorkItem[] {
  return [
    ...requests.map((request): WorkItem => {
      const assignments = matrix.assignments.filter((a) => request.events.some((e) => e.id === a.logistics_event_id) && a.status !== "declined");
      const closed = ["completed", "cancelled"].includes(request.planning_status);
      const missing: string[] = [];
      if (!closed) {
        if (!request.origin?.trim()) missing.push("Origen");
        if (!request.destination?.trim()) missing.push("Destino");
        if (!request.needed_at) missing.push("Fecha necesaria");
        if (!request.description?.trim()) missing.push("Material solicitado");
        if (!request.events.length) missing.push("Planificación");
        if (request.events.some((e) => !assignments.some((a) => a.logistics_event_id === e.id && a.vehicle_id))) missing.push("Vehículo");
        if (request.events.some((e) => !assignments.some((a) => a.logistics_event_id === e.id && a.driver_id))) missing.push("Conductor");
      }
      return { id: request.id, kind: "material", title: request.job_title, date: request.needed_at ? formatMadridDateKey(new Date(request.needed_at)) : null, status: TRANSPORT_STAGE_LABELS[request.planning_status], closed, missing, vehicleIds: assignments.flatMap((a) => a.vehicle_id ? [a.vehicle_id] : []), driverIds: assignments.flatMap((a) => a.driver_id ? [a.driver_id] : []), source: request };
    }),
    ...plans.map((plan): WorkItem => {
      const closed = ["completed", "cancelled"].includes(plan.status);
      const missing = closed ? [] : [!plan.vehicle_id && "Vehículo", !plan.driver_id && "Conductor", plan.hotel_needed && (!plan.hotel_name || plan.hotel_status !== "confirmed") && "Reserva de hotel"].filter((v): v is string => Boolean(v));
      return { id: plan.id, kind: "personnel", title: plan.title, date: formatMadridDateKey(new Date(plan.starts_at)), status: PERSONNEL_STATUSES[plan.status], closed, missing, vehicleIds: plan.vehicle_id ? [plan.vehicle_id] : [], driverIds: plan.driver_id ? [plan.driver_id] : [], source: plan };
    }),
  ];
}
export function operationTotal(operation?: Pick<Operation, "transport_cost" | "hotel_cost" | "other_cost">) {
  return [operation?.transport_cost, operation?.hotel_cost, operation?.other_cost].reduce<number>((total, value) => total + Math.round((value ?? 0) * 100), 0) / 100;
}
export function parseCost(value: string) {
  if (!value.trim()) return null;
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) throw new Error("Indica un importe positivo con un máximo de dos decimales.");
  const amount = Number(value.replace(",", "."));
  if (amount > 10000000) throw new Error("El importe supera el máximo permitido.");
  return amount;
}
export function itemOverlapsPeriod(item: WorkItem, first: string, last: string) {
  if (item.kind === "personnel" && "starts_at" in item.source) {
    const plan = item.source;
    const end = formatMadridDateKey(new Date(plan.ends_at));
    const transfer = Boolean(item.date && item.date <= last && end >= first);
    const hotel = Boolean(plan.hotel_needed && plan.hotel_check_in && plan.hotel_check_out && plan.hotel_check_in <= last && plan.hotel_check_out > first);
    return transfer || hotel;
  }
  if (item.kind === "material" && "events" in item.source && item.source.events.length) return item.source.events.some((event) => event.event_date >= first && event.event_date <= last);
  return Boolean(item.date && item.date >= first && item.date <= last);
}
