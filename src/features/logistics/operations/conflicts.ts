import type { DriverAssignment } from "@/features/logistics/fleet/fleetModel";
import type { WorkshopAppointment } from "@/features/logistics/fleet/workshopModel";
export function resourceConflicts(input: { start: string; end: string; vehicleId: string | null; driverId: string | null; excludeEventIds: string[] }, assignments: DriverAssignment[], appointments: WorkshopAppointment[]) {
  const start = Date.parse(input.start), end = Date.parse(input.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const overlaps = (a: string, b: string) => Date.parse(a) < end && Date.parse(b) > start;
  const warnings = new Set<string>();
  for (const assignment of assignments) {
    if (assignment.status === "declined" || input.excludeEventIds.includes(assignment.logistics_event_id) || !overlaps(assignment.starts_at, assignment.ends_at)) continue;
    if (input.vehicleId && assignment.vehicle_id === input.vehicleId) warnings.add("El vehículo ya tiene otro servicio en ese horario.");
    if (input.driverId && assignment.driver_id === input.driverId) warnings.add("El conductor ya tiene otro servicio en ese horario.");
  }
  for (const appointment of appointments) if (["scheduled", "in_progress"].includes(appointment.status) && input.vehicleId && appointment.vehicle_id === input.vehicleId && overlaps(appointment.starts_at, appointment.ends_at)) warnings.add(`El vehículo está reservado en el taller: ${appointment.reason}.`);
  return [...warnings];
}
