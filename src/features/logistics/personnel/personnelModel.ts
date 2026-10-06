import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
import { MADRID_TIMEZONE, formatInJobTimezone } from "@/utils/timezoneUtils";
import { driverCoversLicense, type FleetVehicle, type MatrixDriver } from "../fleet/fleetModel";

export const PERSONNEL_STATUSES = { planned: "Pendiente", confirmed: "Confirmado", completed: "Realizado", cancelled: "Cancelado" } as const;
export const personnelSchema = z.object({
  id: z.string().uuid(), title: z.string(), job_id: z.string().nullable(), people_count: z.number().int().positive(),
  starts_at: z.string(), ends_at: z.string(), origin_location_id: z.string(), destination_location_id: z.string(),
  vehicle_id: z.string().nullable(), driver_id: z.string().nullable(), status: z.enum(["planned", "confirmed", "completed", "cancelled"]),
  hotel_needed: z.boolean(), hotel_name: z.string().nullable(), hotel_address: z.string().nullable(),
  hotel_check_in: z.string().nullable(), hotel_check_out: z.string().nullable(), single_rooms: z.number().int().nonnegative(), double_rooms: z.number().int().nonnegative(),
  hotel_status: z.enum(["pending", "confirmed"]), notes: z.string().nullable(), updated_at: z.string(),
  event_id: z.string().nullable().optional(), assignment_id: z.string().nullable().optional(),
});
export type PersonnelPlan = z.infer<typeof personnelSchema>;
export type PersonnelInput = Omit<PersonnelPlan, "id" | "updated_at"> & { id: string | null };
export type PersonnelOptions = { jobs: { id: string; title: string }[]; locations: { id: string; name: string; formatted_address?: string | null }[] };
export function validatePersonnelPlan(plan: PersonnelInput, vehicles: FleetVehicle[], drivers: MatrixDriver[]) {
  if (!plan.title.trim() || plan.title.length > 200) return "Indica un nombre de evento de hasta 200 caracteres.";
  if (!Number.isInteger(plan.people_count) || plan.people_count < 1 || plan.people_count > 10000) return "Indica cuántas personas se trasladan (entre 1 y 10000).";
  if (!plan.origin_location_id || !plan.destination_location_id || plan.origin_location_id === plan.destination_location_id) return "Selecciona un origen y un destino diferentes.";
  if (!Number.isFinite(Date.parse(plan.starts_at)) || !Number.isFinite(Date.parse(plan.ends_at)) || Date.parse(plan.ends_at) <= Date.parse(plan.starts_at)) return "La llegada debe ser posterior a la salida.";
  if (plan.status === "confirmed" && (!plan.vehicle_id || !plan.driver_id)) return "Para confirmar, asigna un vehículo y un conductor.";
  const vehicle = vehicles.find((item) => item.id === plan.vehicle_id);
  const driver = drivers.find((item) => item.id === plan.driver_id);
  if (plan.status === "planned" || plan.status === "confirmed") {
    if (plan.vehicle_id && (!vehicle || !vehicle.is_active || !["furgoneta", "rv", "sleeper_bus"].includes(vehicle.vehicle_type))) return "Selecciona un vehículo activo de transporte de personal.";
    if (vehicle && (vehicle.passenger_seats === null || vehicle.passenger_seats < plan.people_count)) return vehicle.passenger_seats === null ? "Registra las plazas del vehículo en Flota antes de asignarlo." : `El vehículo tiene ${vehicle.passenger_seats} plazas para ${plan.people_count} personas. Divide el traslado en varios grupos o elige otro vehículo.`;
    if (plan.driver_id && !driver) return "Selecciona un conductor disponible en la flota.";
    if (driver && vehicle && !driverCoversLicense(driver.license_categories, vehicle.required_license)) return "El conductor no tiene el permiso requerido por el vehículo.";
  }
  if (plan.hotel_needed) {
    if (!plan.hotel_check_in || !plan.hotel_check_out || plan.hotel_check_out <= plan.hotel_check_in) return "Indica la entrada y una salida de hotel posterior.";
    if (![plan.single_rooms, plan.double_rooms].every((rooms) => Number.isInteger(rooms) && rooms >= 0 && rooms <= 10000)) return "Las habitaciones deben ser números enteros positivos o cero.";
    if (plan.single_rooms + 2 * plan.double_rooms < plan.people_count) return "Las habitaciones no cubren a todas las personas del traslado.";
    if (plan.hotel_status === "confirmed" && !plan.hotel_name?.trim()) return "Indica el hotel antes de marcar la reserva como confirmada.";
  }
  if ((plan.hotel_name?.length ?? 0) > 200 || (plan.hotel_address?.length ?? 0) > 300 || (plan.notes?.length ?? 0) > 2000) return "Revisa la longitud del hotel, dirección u observaciones.";
  return null;
}
export function personnelLocalInstant(value: string) {
  const instant = fromZonedTime(value, MADRID_TIMEZONE);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !Number.isFinite(instant.getTime()) || formatInJobTimezone(instant, "yyyy-MM-dd'T'HH:mm") !== value) throw new Error("La fecha u hora no es válida en Madrid.");
  return instant.toISOString();
}
