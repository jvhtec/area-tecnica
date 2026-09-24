import type { SupabaseClient } from "./deps.ts";
import { joinedSingle } from "../_shared/joins.ts";

/**
 * Facts about one logistics-matrix driver assignment, loaded with the service
 * client so a push never trusts recipient or message details sent by the caller.
 */
export type DriverAssignmentFacts = {
  id: string;
  driverId: string | null;
  assignedBy: string | null;
  status: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  eventType: string | null;
  eventTitle: string | null;
  vehicleName: string | null;
  vehiclePlate: string | null;
};

type JobRow = { title?: string | null };
type EventRow = {
  event_type?: string | null;
  title?: string | null;
  timezone?: string | null;
  job?: JobRow | JobRow[] | null;
};
type VehicleRow = { name?: string | null; license_plate?: string | null };
type AssignmentRow = {
  id?: string | null;
  driver_id?: string | null;
  assigned_by?: string | null;
  status?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  logistics_event?: EventRow | EventRow[] | null;
  vehicle?: VehicleRow | VehicleRow[] | null;
};

export async function loadDriverAssignmentFacts(
  client: SupabaseClient,
  assignmentId: string | null | undefined,
): Promise<DriverAssignmentFacts | null> {
  if (!assignmentId) return null;
  const { data, error } = await client
    .from("transport_driver_assignments")
    .select(
      "id, driver_id, assigned_by, status, starts_at, ends_at, " +
        "logistics_event:logistics_events(event_type, title, timezone, job:jobs(title)), " +
        "vehicle:fleet_vehicles(name, license_plate)",
    )
    .eq("id", assignmentId)
    .returns<AssignmentRow[]>()
    .maybeSingle();
  if (error || !data?.id || !data.starts_at || !data.ends_at) return null;

  const event = joinedSingle(data.logistics_event);
  const job = joinedSingle(event?.job);
  const vehicle = joinedSingle(data.vehicle);
  return {
    id: data.id,
    driverId: data.driver_id ?? null,
    assignedBy: data.assigned_by ?? null,
    status: data.status ?? "assigned",
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    timezone: event?.timezone?.trim() || "Europe/Madrid",
    eventType: event?.event_type ?? null,
    eventTitle: event?.title?.trim() || job?.title?.trim() || null,
    vehicleName: vehicle?.name ?? null,
    vehiclePlate: vehicle?.license_plate ?? null,
  };
}

/** True when `profileId` belongs to a driver; removal pushes are only sent to drivers. */
export async function isConductorProfile(
  client: SupabaseClient,
  profileId: string | null | undefined,
): Promise<boolean> {
  if (!profileId) return false;
  const { data, error } = await client
    .from("profiles")
    .select("role")
    .eq("id", profileId)
    .returns<Array<{ role?: string | null }>>()
    .maybeSingle();
  return !error && data?.role === "conductor";
}
