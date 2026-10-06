import { fromZonedTime } from "date-fns-tz";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";
import { formatInJobTimezone, MADRID_TIMEZONE } from "@/utils/timezoneUtils";
import { LOGISTICS_FLEET_QUERY_ROOT } from "./useLogisticsFleet";
import { workshopAppointmentSchema, validateWorkshopDraft, type WorkshopAppointment, type WorkshopDraft } from "./workshopModel";

export const WORKSHOP_QUERY_ROOT = "fleet_workshop_appointments";
type Rpc = (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (name, args) => (dataLayerClient.rpc as unknown as Rpc).call(dataLayerClient, name, args);

export async function listWorkshopAppointments(first: string, last: string): Promise<WorkshopAppointment[]> {
  const { data, error } = await rpc("list_fleet_workshop_appointments", { p_from: first, p_to: last });
  if (error) throw new Error(error.message);
  return workshopAppointmentSchema.array().parse(data);
}

export async function saveWorkshopAppointment(draft: WorkshopDraft, original: WorkshopAppointment | null) {
  const validation = validateWorkshopDraft(draft);
  if (validation) throw new Error(validation);
  // Preserve the stored offset for unchanged times during the repeated autumn hour.
  const toInstant = (local: string, previous?: string) => previous && formatInJobTimezone(previous, "yyyy-MM-dd'T'HH:mm") === local
    ? previous : fromZonedTime(local, MADRID_TIMEZONE).toISOString();
  const { error } = await rpc("save_fleet_workshop_appointment", {
    p_id: original?.id ?? null,
    p_expected_updated_at: original?.updated_at ?? null,
    p_vehicle_id: draft.vehicleId,
    p_starts_at: toInstant(draft.start, original?.starts_at),
    p_ends_at: toInstant(draft.end, original?.ends_at),
    p_workshop: draft.workshop.trim(), p_reason: draft.reason.trim(),
    p_notes: draft.notes.trim() || null, p_mileage_km: draft.mileage.trim() ? Number(draft.mileage) : null,
    p_status: draft.status,
  });
  if (error) throw new Error(error.message);
}

export function useWorkshopAppointments(first: string, last: string) {
  return useQuery({
    queryKey: [WORKSHOP_QUERY_ROOT, first, last],
    queryFn: () => listWorkshopAppointments(first, last),
    staleTime: 30_000, refetchInterval: 30_000,
  });
}

export function useInvalidateWorkshop() {
  const client = useQueryClient();
  return () => Promise.all([
    client.invalidateQueries({ queryKey: [WORKSHOP_QUERY_ROOT] }),
    client.invalidateQueries({ queryKey: [LOGISTICS_FLEET_QUERY_ROOT] }),
  ]);
}
