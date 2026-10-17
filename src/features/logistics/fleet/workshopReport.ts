import { fromZonedTime } from "date-fns-tz";
import { addMadridCalendarDays, formatMadridDayKey, formatInJobTimezone, MADRID_TIMEZONE } from "@/utils/timezoneUtils";
import { type FleetVehicle, vehicleTypeLabel } from "./fleetModel";
import { workshopMonthBounds, WORKSHOP_STATUSES, type WorkshopAppointment } from "./workshopModel";

export function workshopReportPeriod(mode: "monthly" | "weekly", value: string) {
  if (mode === "monthly") {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new Error("Selecciona un mes válido.");
    const { first, last } = workshopMonthBounds(value);
    return { first, last };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || formatMadridDayKey(value, "yyyy-MM-dd") !== value) throw new Error("Selecciona una fecha válida.");
  const first = addMadridCalendarDays(value, 1 - Number(formatMadridDayKey(value, "i")));
  return { first, last: addMadridCalendarDays(first, 6) };
}

export function reportAppointments(appointments: WorkshopAppointment[], first: string, last: string) {
  const start = fromZonedTime(`${first}T00:00`, MADRID_TIMEZONE).getTime();
  const end = fromZonedTime(`${addMadridCalendarDays(last, 1)}T00:00`, MADRID_TIMEZONE).getTime();
  return appointments.filter((appointment) => Date.parse(appointment.starts_at) < end && Date.parse(appointment.ends_at) > start)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
}

export async function createWorkshopReport(vehicles: FleetVehicle[], appointments: WorkshopAppointment[], first: string, last: string) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sector Pro";
  const rows = reportAppointments(appointments, first, last);
  const summary = workbook.addWorksheet("Resumen de flota");
  const detail = workbook.addWorksheet("Citas");
  const period = `${first} a ${last} · Horario de Madrid`;
  const vehicleMap = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  summary.addRow(["Informe de citas de vehículos"]);
  summary.addRow([period]);
  summary.addRow(["Vehículo", "Matrícula", "Tipo", "Activo", "Total citas", ...Object.values(WORKSHOP_STATUSES)]);
  for (const vehicle of vehicles) {
    const own = rows.filter((appointment) => appointment.vehicle_id === vehicle.id);
    summary.addRow([vehicle.name, vehicle.license_plate, vehicleTypeLabel(vehicle.vehicle_type), vehicle.is_active ? "Sí" : "No", own.length,
      ...Object.keys(WORKSHOP_STATUSES).map((status) => own.filter((appointment) => appointment.status === status).length)]);
  }
  detail.addRow(["Citas que coinciden con el periodo (incluye citas iniciadas antes)"]);
  detail.addRow([period]);
  detail.addRow(["Vehículo", "Matrícula", "Entrada", "Salida prevista", "Taller", "Motivo", "Estado", "Kilometraje", "Observaciones"]);
  // Excel dates store Madrid wall-clock time so Excel displays the same schedule as the app.
  const excelDate = (instant: string) => new Date(`${formatInJobTimezone(instant, "yyyy-MM-dd'T'HH:mm:ss")}Z`);
  for (const appointment of rows) {
    const vehicle = vehicleMap.get(appointment.vehicle_id);
    detail.addRow([vehicle?.name ?? "Vehículo no disponible", vehicle?.license_plate ?? "", excelDate(appointment.starts_at), excelDate(appointment.ends_at),
      appointment.workshop, appointment.reason, WORKSHOP_STATUSES[appointment.status], appointment.mileage_km, appointment.notes]);
  }
  for (const sheet of [summary, detail]) {
    sheet.views = [{ state: "frozen", ySplit: 3 }];
    sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: Math.max(sheet.rowCount, 3), column: 9 } };
    sheet.getRow(1).font = { bold: true, size: 15 };
    sheet.getRow(3).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF172033" } };
    sheet.getRow(3).height = 30;
    sheet.columns.forEach((column, index) => { column.width = [26, 18, 24, 24, 24, 32, 20, 20, 45][index]; });
    sheet.eachRow((row) => { row.alignment = { vertical: "top", wrapText: true }; });
    sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  }
  detail.getColumn(3).numFmt = "dd/mm/yyyy hh:mm";
  detail.getColumn(4).numFmt = "dd/mm/yyyy hh:mm";
  detail.getColumn(8).numFmt = "#,##0";
  return workbook;
}
