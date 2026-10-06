import { fromZonedTime } from "date-fns-tz";
import { MADRID_TIMEZONE, addMadridCalendarDays, formatInJobTimezone } from "@/utils/timezoneUtils";
import { driverDisplayName, VEHICLE_TYPE_LABELS, type FleetVehicle, type MatrixDriver } from "../fleet/fleetModel";
import { PERSONNEL_STATUSES, type PersonnelOptions, type PersonnelPlan } from "./personnelModel";
import { addPersonnelReportCards } from "./personnelReportCards";

export function personnelPeriodRows(plans: PersonnelPlan[], first: string, last: string) {
  const start = fromZonedTime(`${first}T00:00`, MADRID_TIMEZONE).getTime();
  const end = fromZonedTime(`${addMadridCalendarDays(last, 1)}T00:00`, MADRID_TIMEZONE).getTime();
  return {
    transfers: plans.filter((plan) => Date.parse(plan.starts_at) < end && Date.parse(plan.ends_at) > start),
    hotels: plans.filter((plan) => plan.hotel_needed && plan.hotel_check_in && plan.hotel_check_out && plan.hotel_check_in <= last && plan.hotel_check_out > first),
  };
}
export async function createPersonnelReport(plans: PersonnelPlan[], first: string, last: string, vehicles: FleetVehicle[], drivers: MatrixDriver[], options: PersonnelOptions) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sector Pro";
  const { transfers, hotels } = personnelPeriodRows(plans, first, last);
  const cards = workbook.addWorksheet("Fichas de personal");
  const summary = workbook.addWorksheet("Resumen");
  const detail = workbook.addWorksheet("Traslados");
  const hotel = workbook.addWorksheet("Hoteles");
  const complete = workbook.addWorksheet("Datos completos");
  const active = transfers.filter((plan) => plan.status !== "cancelled");
  summary.addRows([["Logística de personal"], [`${first} a ${last} · Horario de Madrid`], ["Concepto", "Total"],
    ["Traslados (todos los estados)", transfers.length], ["Personas por traslado (sin cancelados)", active.reduce((total, plan) => total + plan.people_count, 0)],
    ...Object.entries(PERSONNEL_STATUSES).map(([key, label]) => [`Traslados ${label.toLowerCase()}`, transfers.filter((plan) => plan.status === key).length]),
    ["Estancias de hotel (sin cancelados)", hotels.filter((plan) => plan.status !== "cancelled").length],
    ["Personas contadas por movimiento; una persona puede aparecer en varios traslados."]]);
  detail.addRows([["Traslados que coinciden con el periodo"], [`${first} a ${last}`], ["Evento", "Personas", "Salida (Madrid)", "Llegada (Madrid)", "Origen", "Destino", "Vehículo", "Matrícula", "Conductor", "Estado", "Hotel necesario", "Observaciones"]]);
  hotel.addRows([["Estancias de hotel que coinciden con el periodo"], [`${first} a ${last}`], ["Evento", "Personas", "Hotel", "Dirección", "Entrada", "Salida", "Individuales", "Dobles", "Total habitaciones", "Plazas", "Reserva", "Estado del traslado"]]);
  const dateTime = (instant: string) => new Date(`${formatInJobTimezone(instant, "yyyy-MM-dd'T'HH:mm:ss")}Z`);
  const place = (id: string) => options.locations.find((item) => item.id === id)?.name ?? "Ubicación no disponible";
  const address = (id: string) => options.locations.find((item) => item.id === id)?.formatted_address ?? "";
  complete.addRows([["Todos los datos de los traslados y estancias del periodo"], [`${first} a ${last} · Horario de Madrid · Incluye traslados anteriores con hotel en este periodo`], [
    "Identificador del traslado", "Evento / nombre del traslado", "Evento vinculado", "Personas", "Salida (Madrid)", "Llegada (Madrid)",
    "Punto de encuentro", "Dirección de origen", "Destino", "Dirección de destino", "Vehículo", "Matrícula", "Tipo de vehículo", "Plazas de pasajeros",
    "Conductor", "Teléfono del conductor", "Estado del traslado", "Hotel necesario", "Hotel", "Dirección del hotel", "Entrada al hotel", "Salida del hotel",
    "Habitaciones individuales", "Habitaciones dobles", "Total habitaciones", "Plazas de alojamiento", "Estado de reserva", "Observaciones", "Última modificación (Madrid)", "Coincide en el periodo",
  ]]);
  const transferIds = new Set(transfers.map((plan) => plan.id));
  const hotelIds = new Set(hotels.map((plan) => plan.id));
  const included = new Map([...transfers, ...hotels].map((plan) => [plan.id, plan]));
  for (const plan of included.values()) {
    const vehicle = vehicles.find((item) => item.id === plan.vehicle_id);
    const driver = drivers.find((item) => item.id === plan.driver_id);
    complete.addRow([
      plan.id, plan.title, plan.job_id ? options.jobs.find((job) => job.id === plan.job_id)?.title ?? plan.job_id : "Sin vincular",
      plan.people_count, dateTime(plan.starts_at), dateTime(plan.ends_at), place(plan.origin_location_id), address(plan.origin_location_id), place(plan.destination_location_id), address(plan.destination_location_id),
      vehicle?.name ?? (plan.vehicle_id ? "Vehículo no disponible" : "Pendiente"), vehicle?.license_plate ?? "", vehicle ? VEHICLE_TYPE_LABELS[vehicle.vehicle_type] : "", vehicle?.passenger_seats ?? null,
      driver ? driverDisplayName(driver) : plan.driver_id ? "Conductor no disponible" : "Pendiente", driver?.phone ?? "", PERSONNEL_STATUSES[plan.status], plan.hotel_needed ? "Sí" : "No",
      plan.hotel_needed ? plan.hotel_name ?? "Por definir" : "", plan.hotel_needed ? plan.hotel_address : null,
      plan.hotel_needed && plan.hotel_check_in ? new Date(`${plan.hotel_check_in}T00:00Z`) : null, plan.hotel_needed && plan.hotel_check_out ? new Date(`${plan.hotel_check_out}T00:00Z`) : null,
      plan.hotel_needed ? plan.single_rooms : null, plan.hotel_needed ? plan.double_rooms : null, plan.hotel_needed ? plan.single_rooms + plan.double_rooms : null,
      plan.hotel_needed ? plan.single_rooms + 2 * plan.double_rooms : null, plan.hotel_needed ? plan.hotel_status === "confirmed" ? "Confirmada" : "Pendiente" : "No aplica",
      plan.notes, dateTime(plan.updated_at), transferIds.has(plan.id) && hotelIds.has(plan.id) ? "Traslado y hotel" : transferIds.has(plan.id) ? "Traslado" : "Hotel",
    ]);
  }
  for (const plan of transfers) {
    const vehicle = vehicles.find((item) => item.id === plan.vehicle_id);
    const driver = drivers.find((item) => item.id === plan.driver_id);
    detail.addRow([plan.title, plan.people_count, dateTime(plan.starts_at), dateTime(plan.ends_at), place(plan.origin_location_id), place(plan.destination_location_id), vehicle?.name ?? "Pendiente", vehicle?.license_plate ?? "", driver ? driverDisplayName(driver) : "Pendiente", PERSONNEL_STATUSES[plan.status], plan.hotel_needed ? "Sí" : "No", plan.notes]);
  }
  for (const plan of hotels) hotel.addRow([plan.title, plan.people_count, plan.hotel_name ?? "Por definir", plan.hotel_address, new Date(`${plan.hotel_check_in}T00:00Z`), new Date(`${plan.hotel_check_out}T00:00Z`), plan.single_rooms, plan.double_rooms, plan.single_rooms + plan.double_rooms, plan.single_rooms + 2 * plan.double_rooms, plan.hotel_status === "confirmed" ? "Confirmada" : "Pendiente", PERSONNEL_STATUSES[plan.status]]);
  for (const sheet of [summary, detail, hotel, complete]) {
    sheet.views = [{ state: "frozen", ySplit: 3 }];
    sheet.getRow(1).font = { size: 15, bold: true };
    sheet.getRow(3).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF172033" } };
    sheet.getRow(3).height = 32;
    sheet.eachRow((row) => { row.alignment = { wrapText: true, vertical: "top" }; });
    sheet.columns.forEach((column) => { column.width = 24; });
    sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  }
  summary.getColumn(1).width = 58;
  detail.getColumn(12).width = 45;
  hotel.getColumn(4).width = 40;
  for (const column of [3, 4]) detail.getColumn(column).numFmt = "dd/mm/yyyy hh:mm";
  for (const column of [5, 6]) hotel.getColumn(column).numFmt = "dd/mm/yyyy";
  for (const column of [5, 6, 29]) complete.getColumn(column).numFmt = "dd/mm/yyyy hh:mm";
  for (const column of [21, 22]) complete.getColumn(column).numFmt = "dd/mm/yyyy";
  for (const column of [8, 10, 20, 28]) complete.getColumn(column).width = 40;
  complete.views = [{ state: "frozen", ySplit: 3, xSplit: 2 }];
  complete.pageSetup = { orientation: "landscape" };
  const cardLabels = complete.getRow(3).values as string[];
  const cardRecords = Array.from({ length: complete.rowCount - 3 }, (_, index) => (complete.getRow(index + 4).values as import("exceljs").CellValue[]).slice(1));
  addPersonnelReportCards(cards, cardLabels.slice(1), cardRecords, first, last);
  for (const sheet of [detail, hotel, complete]) sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: Math.max(3, sheet.rowCount), column: sheet.columnCount } };
  return workbook;
}
