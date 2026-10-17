import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
import { addMadridCalendarDays, formatInJobTimezone, MADRID_TIMEZONE } from "@/utils/timezoneUtils";

export const WORKSHOP_STATUSES = {
  scheduled: "Programada",
  in_progress: "En taller",
  completed: "Finalizada",
  cancelled: "Cancelada",
} as const;

export const workshopAppointmentSchema = z.object({
  id: z.string().uuid(), vehicle_id: z.string().uuid(),
  starts_at: z.string(), ends_at: z.string(),
  workshop: z.string(), reason: z.string(), notes: z.string().nullable(),
  mileage_km: z.number().nullable(),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]),
  updated_at: z.string(),
});
export type WorkshopAppointment = z.infer<typeof workshopAppointmentSchema>;
export type WorkshopStatus = WorkshopAppointment["status"];
export type WorkshopDraft = {
  vehicleId: string; start: string; end: string; workshop: string;
  reason: string; notes: string; mileage: string; status: WorkshopStatus;
};

export const workshopBlocks = (appointment: Pick<WorkshopAppointment, "status">) =>
  appointment.status === "scheduled" || appointment.status === "in_progress";

export const workshopOnDay = (appointment: Pick<WorkshopAppointment, "starts_at" | "ends_at">, day: string) => {
  const start = fromZonedTime(`${day}T00:00`, MADRID_TIMEZONE).getTime();
  const end = fromZonedTime(`${addMadridCalendarDays(day, 1)}T00:00`, MADRID_TIMEZONE).getTime();
  return Date.parse(appointment.starts_at) < end && Date.parse(appointment.ends_at) > start;
};

export function workshopMonthBounds(month: string) {
  const [year, number] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return { first: `${month}-01`, last: `${month}-${lastDay}`, days: Array.from({ length: lastDay }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`) };
}

export function validateWorkshopDraft(draft: WorkshopDraft): string | null {
  if (!draft.vehicleId) return "Selecciona un vehículo.";
  if (!draft.workshop.trim() || !draft.reason.trim()) return "Indica el taller y el motivo de la cita.";
  if (draft.workshop.trim().length > 160 || draft.reason.trim().length > 200 || draft.notes.length > 2000) return "Revisa la longitud del taller, motivo u observaciones.";
  for (const local of [draft.start, draft.end]) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return "Indica fecha y hora de entrada y salida prevista.";
    const instant = fromZonedTime(local, MADRID_TIMEZONE);
    if (!Number.isFinite(instant.getTime()) || formatInJobTimezone(instant, "yyyy-MM-dd'T'HH:mm") !== local) return "La fecha u hora no es válida en Madrid. Revisa el cambio de hora.";
  }
  if (fromZonedTime(draft.end, MADRID_TIMEZONE) <= fromZonedTime(draft.start, MADRID_TIMEZONE)) return "La salida prevista debe ser posterior a la entrada.";
  if (draft.mileage.trim() && (!/^\d+$/.test(draft.mileage.trim()) || Number(draft.mileage) > 2147483647)) return "El kilometraje debe ser un número entero positivo o cero.";
  return null;
}

export const workshopStatusClass: Record<WorkshopStatus, string> = {
  scheduled: "border-blue-300 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100",
  in_progress: "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  completed: "border-green-300 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100",
  cancelled: "border-muted bg-muted text-muted-foreground line-through",
};
