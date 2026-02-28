import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { EventData, TravelArrangement, Accommodation, Transport } from "@/types/hoja-de-ruta";
import { loadExceljs } from "@/utils/lazyExceljs";
import { applyStyle, populateSheet, saveWorkbook, toArgb } from "@/utils/excelExport";
import type ExcelJS from "exceljs";
import { formatLogisticsHojaCategories } from "@/constants/logisticsHojaCategories";

interface ExportData {
  eventData: EventData;
  travelArrangements: TravelArrangement[];
  accommodations: Accommodation[];
  jobTitle: string;
  jobDate?: string;
}

type SheetRow = (string | number | null | undefined)[];

const TITLE_STYLE ={ bold: true, fontSize: 14, bgColor: "2980B9", textColor: "FFFFFF", alignment: "center" as const, borderColor: "2980B9" };
const HEADER_STYLE = { bold: true, bgColor: "34495E", textColor: "FFFFFF", borderColor: "000000" };
const LABEL_STYLE = { bold: true, bgColor: "ECF0F1", borderColor: "000000" };
const DATA_STYLE = { borderColor: "000000" } as const;

function applyHeaderRow(ws: ExcelJS.Worksheet, rowNum: number, cols: number) {
  const row = ws.getRow(rowNum);
  for (let c = 1; c <= cols; c++) {
    applyStyle(row.getCell(c), HEADER_STYLE);
  }
}

function applyAlternatingRows(ws: ExcelJS.Worksheet, startRow: number, endRow: number, cols: number) {
  for (let r = startRow; r <= endRow; r++) {
    const bgColor = r % 2 === 0 ? "FFFFFF" : "F8F9FA";
    const row = ws.getRow(r);
    for (let c = 1; c <= cols; c++) {
      applyStyle(row.getCell(c), { bgColor, borderColor: "000000" });
    }
  }
}

function applyLabelValueRows(ws: ExcelJS.Worksheet, startRow: number, endRow: number) {
  for (let r = startRow; r <= endRow; r++) {
    applyStyle(ws.getRow(r).getCell(1), LABEL_STYLE);
    applyStyle(ws.getRow(r).getCell(2), DATA_STYLE);
  }
}

// Event Information Sheet
const createEventSheet = (wb: ExcelJS.Workbook, data: ExportData) => {
  const sheetData: SheetRow[] = [
    ["INFORMACIÓN DEL EVENTO"],
    [],
    ["Campo", "Valor"],
    ["Nombre del Trabajo", data.jobTitle],
    ["Nombre del Evento", data.eventData.eventName || ""],
    ["Código del Evento", data.eventData.eventCode || ""],
    ["Tipo de Evento", data.eventData.eventType || ""],
    ["Cliente", data.eventData.clientName || ""],
    ["Fechas", data.eventData.eventDates || ""],
    ["Hora de Inicio", data.eventData.eventStartTime || ""],
    ["Hora de Fin", data.eventData.eventEndTime || ""],
    ["Hora de Montaje", data.eventData.setupTime || ""],
    ["Hora de Desmontaje", data.eventData.dismantleTime || ""],
    ["Asistentes Estimados", data.eventData.estimatedAttendees || ""],
    ["Estado", data.eventData.eventStatus || ""],
  ];

  const ws = wb.addWorksheet("Evento");
  populateSheet(ws, sheetData);

  // Title style + merge
  applyStyle(ws.getRow(1).getCell(1), TITLE_STYLE);
  ws.mergeCells("A1:B1");

  // Header row 3
  applyHeaderRow(ws, 3, 2);

  // Data rows 4..end
  applyLabelValueRows(ws, 4, sheetData.length);

  ws.getColumn(1).width = 25;
  ws.getColumn(2).width = 50;
};

// Venue Information Sheet
const createVenueSheet = (wb: ExcelJS.Workbook, data: ExportData) => {
  const sheetData: SheetRow[] = [
    ["INFORMACIÓN DEL LUGAR"],
    [],
    ["Campo", "Valor"],
    ["Nombre del Recinto", data.eventData.venue?.name || ""],
    ["Dirección", data.eventData.venue?.address || ""],
    ["Tipo de Recinto", data.eventData.venueType || ""],
    ["Capacidad", data.eventData.venueCapacity || ""],
    [],
    ["CONTACTO DEL RECINTO"],
    [],
    ["Nombre", data.eventData.venueContact?.name || ""],
    ["Teléfono", data.eventData.venueContact?.phone || ""],
    ["Email", data.eventData.venueContact?.email || ""],
  ];

  const ws = wb.addWorksheet("Recinto");
  populateSheet(ws, sheetData);

  // Title styles + merges
  applyStyle(ws.getRow(1).getCell(1), TITLE_STYLE);
  ws.mergeCells("A1:B1");
  applyStyle(ws.getRow(9).getCell(1), TITLE_STYLE);
  ws.mergeCells("A9:B9");

  // Header row 3
  applyHeaderRow(ws, 3, 2);

  // Data rows
  applyLabelValueRows(ws, 4, 7);
  applyLabelValueRows(ws, 11, 13);

  ws.getColumn(1).width = 25;
  ws.getColumn(2).width = 50;
};

// Contacts Sheet
const createContactsSheet = (wb: ExcelJS.Workbook, data: ExportData) => {
  const sheetData: SheetRow[] = [
    ["CONTACTOS"],
    [],
    ["Nombre", "Rol", "Teléfono", "Email"],
  ];

  if (data.eventData.contacts && data.eventData.contacts.length > 0) {
    data.eventData.contacts.forEach((contact) => {
      sheetData.push([
        contact.name || "",
        contact.role || "",
        contact.phone || "",
        contact.email || "",
      ]);
    });
  } else {
    sheetData.push(["No hay contactos registrados", "", "", ""]);
  }

  const ws = wb.addWorksheet("Contactos");
  populateSheet(ws, sheetData);

  applyStyle(ws.getRow(1).getCell(1), TITLE_STYLE);
  ws.mergeCells("A1:D1");

  applyHeaderRow(ws, 3, 4);
  applyAlternatingRows(ws, 4, sheetData.length, 4);

  ws.getColumn(1).width = 25;
  ws.getColumn(2).width = 20;
  ws.getColumn(3).width = 15;
  ws.getColumn(4).width = 30;
};

// Staff Sheet
const createStaffSheet = (wb: ExcelJS.Workbook, data: ExportData) => {
  const sheetData: SheetRow[] = [
    ["PERSONAL"],
    [],
    ["Nombre", "Apellidos", "DNI", "Posición", "Departamento", "Teléfono", "Rol"],
  ];

  if (data.eventData.staff && data.eventData.staff.length > 0) {
    data.eventData.staff.forEach((member) => {
      const fullSurname = [member.surname1, member.surname2].filter(Boolean).join(" ");
      sheetData.push([
        member.name || "",
        fullSurname,
        member.dni || "",
        member.position || "",
        member.department || "",
        member.phone || "",
        member.role || "",
      ]);
    });
  } else {
    sheetData.push(["No hay personal registrado", "", "", "", "", "", ""]);
  }

  const ws = wb.addWorksheet("Personal");
  populateSheet(ws, sheetData);

  applyStyle(ws.getRow(1).getCell(1), TITLE_STYLE);
  ws.mergeCells("A1:G1");

  applyHeaderRow(ws, 3, 7);
  applyAlternatingRows(ws, 4, sheetData.length, 7);

  ws.getColumn(1).width = 15;
  ws.getColumn(2).width = 20;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 20;
  ws.getColumn(5).width = 15;
  ws.getColumn(6).width = 15;
  ws.getColumn(7).width = 15;
};

// Travel Sheet
const createTravelSheet = (wb: ExcelJS.Workbook, data: ExportData) => {
  const sheetData: SheetRow[] = [
    ["VIAJES"],
    [],
    ["Tipo de Transporte", "Dirección Recogida", "Hora Recogida", "Hora Salida", "Hora Llegada", "Núm. Vuelo/Tren", "Compañía", "Notas"],
  ];

  if (data.travelArrangements && data.travelArrangements.length > 0) {
    data.travelArrangements.forEach((travel) => {
      const formatTime = (timeStr?: string) => {
        if (!timeStr) return "";
        try {
          return format(new Date(timeStr), "dd/MM/yyyy HH:mm", { locale: es });
        } catch {
          return timeStr;
        }
      };

      sheetData.push([
        travel.transportation_type || "",
        travel.pickup_address || "",
        formatTime(travel.pickup_time),
        formatTime(travel.departure_time),
        formatTime(travel.arrival_time),
        travel.flight_train_number || "",
        travel.company || "",
        travel.notes || "",
      ]);
    });
  } else {
    sheetData.push(["No hay viajes registrados", "", "", "", "", "", "", ""]);
  }

  const ws = wb.addWorksheet("Viajes");
  populateSheet(ws, sheetData);

  applyStyle(ws.getRow(1).getCell(1), TITLE_STYLE);
  ws.mergeCells("A1:H1");

  applyHeaderRow(ws, 3, 8);
  applyAlternatingRows(ws, 4, sheetData.length, 8);

  ws.getColumn(1).width = 18;
  ws.getColumn(2).width = 25;
  ws.getColumn(3).width = 18;
  ws.getColumn(4).width = 18;
  ws.getColumn(5).width = 18;
  ws.getColumn(6).width = 15;
  ws.getColumn(7).width = 20;
  ws.getColumn(8).width = 30;
};

// Accommodation Sheet
const createAccommodationSheet = (wb: ExcelJS.Workbook, data: ExportData) => {
  const sheetData: SheetRow[] = [
    ["ALOJAMIENTO"],
    [],
  ];

  if (data.accommodations && data.accommodations.length > 0) {
    data.accommodations.forEach((accommodation, index) => {
      if (index > 0) sheetData.push([]);

      sheetData.push([`HOTEL ${index + 1}`, ""]);
      sheetData.push(["Hotel", accommodation.hotel_name || ""]);
      sheetData.push(["Dirección", accommodation.address || ""]);
      sheetData.push(["Check-in", accommodation.check_in || ""]);
      sheetData.push(["Check-out", accommodation.check_out || ""]);
      sheetData.push([]);
      sheetData.push(["Tipo de Habitación", "Número", "Persona 1", "Persona 2"]);

      if (accommodation.rooms && accommodation.rooms.length > 0) {
        accommodation.rooms.forEach((room) => {
          sheetData.push([
            room.room_type || "",
            room.room_number || "",
            room.staff_member1_id || "",
            room.staff_member2_id || "",
          ]);
        });
      } else {
        sheetData.push(["No hay habitaciones asignadas", "", "", ""]);
      }
    });
  } else {
    sheetData.push(["No hay alojamientos registrados"]);
  }

  const ws = wb.addWorksheet("Alojamiento");
  populateSheet(ws, sheetData);

  // Title style
  applyStyle(ws.getRow(1).getCell(1), TITLE_STYLE);
  ws.mergeCells("A1:D1");

  // Apply styles dynamically based on content
  let rowIndex = 3;
  data.accommodations?.forEach((accommodation) => {
    // Hotel header
    applyStyle(ws.getRow(rowIndex).getCell(1), { bold: true, bgColor: "3498DB", textColor: "FFFFFF", borderColor: "3498DB" });
    ws.mergeCells(rowIndex, 1, rowIndex, 2);
    rowIndex++;

    // Hotel details (4 rows)
    for (let i = 0; i < 4; i++) {
      applyStyle(ws.getRow(rowIndex).getCell(1), LABEL_STYLE);
      applyStyle(ws.getRow(rowIndex).getCell(2), DATA_STYLE);
      rowIndex++;
    }

    rowIndex++; // Empty row

    // Room header
    const roomHeaderRow = ws.getRow(rowIndex);
    for (let c = 1; c <= 4; c++) {
      applyStyle(roomHeaderRow.getCell(c), HEADER_STYLE);
    }
    rowIndex++;

    // Room data
    const roomCount = accommodation.rooms?.length || 1;
    for (let i = 0; i < roomCount; i++) {
      const bgColor = i % 2 === 0 ? "FFFFFF" : "F8F9FA";
      const row = ws.getRow(rowIndex);
      for (let c = 1; c <= 4; c++) {
        applyStyle(row.getCell(c), { bgColor, borderColor: "000000" });
      }
      rowIndex++;
    }

    rowIndex++; // Empty row between hotels
  });

  ws.getColumn(1).width = 20;
  ws.getColumn(2).width = 20;
  ws.getColumn(3).width = 25;
  ws.getColumn(4).width = 25;
};

// Logistics/Transport Sheet
const createLogisticsSheet = (wb: ExcelJS.Workbook, data: ExportData) => {
  const transports = data.eventData.logistics?.transport || [];

  const sheetData: SheetRow[] = [
    ["LOGÍSTICA Y TRANSPORTE"],
    [],
    ["Tipo de Transporte", "Conductor", "Teléfono", "Matrícula", "Compañía", "Fecha/Hora", "¿Retorno?", "Fecha/Hora Retorno", "Relevante Hoja de Ruta", "Categorías Hoja de Ruta"],
  ];

  if (transports.length > 0) {
    transports.forEach((transport) => {
      const transportTypeLabels: Record<string, string> = {
        "trailer": "Tráiler",
        "9m": "Camión 9m",
        "8m": "Camión 8m",
        "6m": "Camión 6m",
        "4m": "Camión 4m",
        "furgoneta": "Furgoneta",
      };

      const companyLabels: Record<string, string> = {
        "pantoja": "Pantoja",
        "transluminaria": "Transluminaria",
        "transcamarena": "Transcamarena",
        "wild tour": "Wild Tour",
        "camionaje": "Camionaje",
        "sector-pro": "Sector Pro",
        "crespo": "Crespo",
        "montabi_dorado": "Montabi Dorado",
        "grupo_sese": "Grupo Sesé",
        "nacex": "Nacex",
        "recogida_cliente": "Recogida Cliente",
        "other": "Otro",
      };

      sheetData.push([
        transportTypeLabels[transport.transport_type] || transport.transport_type,
        transport.driver_name || "",
        transport.driver_phone || "",
        transport.license_plate || "",
        transport.company ? companyLabels[transport.company] || transport.company : "",
        transport.date_time || "",
        transport.has_return ? "Sí" : "No",
        transport.return_date_time || "",
        transport.is_hoja_relevant === false ? "No" : "Sí",
        formatLogisticsHojaCategories(transport.logistics_categories),
      ]);
    });
  } else {
    sheetData.push(["No hay transporte registrado", "", "", "", "", "", "", "", "", ""]);
  }

  // Add logistics notes
  sheetData.push([]);
  sheetData.push(["DETALLES DE LOGÍSTICA"]);
  sheetData.push([]);
  sheetData.push(["Detalles de Carga", data.eventData.logistics?.loadingDetails || "No especificado"]);
  sheetData.push(["Detalles de Descarga", data.eventData.logistics?.unloadingDetails || "No especificado"]);
  sheetData.push(["Logística de Equipamiento", data.eventData.logistics?.equipmentLogistics || "No especificado"]);

  const ws = wb.addWorksheet("Logística");
  populateSheet(ws, sheetData);

  // Title style
  applyStyle(ws.getRow(1).getCell(1), TITLE_STYLE);
  ws.mergeCells("A1:J1");

  // Header row
  applyHeaderRow(ws, 3, 10);

  // Data rows for transport
  const transportEndRow = Math.max(4, 4 + transports.length - 1);
  applyAlternatingRows(ws, 4, transportEndRow, 10);

  // Logistics details section
  const detailsStartRow = transportEndRow + 2;
  applyStyle(ws.getRow(detailsStartRow).getCell(1), { bold: true, fontSize: 12, bgColor: "3498DB", textColor: "FFFFFF", alignment: "center" as const, borderColor: "3498DB" });
  ws.mergeCells(detailsStartRow, 1, detailsStartRow, 10);

  for (let i = 0; i < 3; i++) {
    const row = detailsStartRow + 2 + i;
    applyStyle(ws.getRow(row).getCell(1), LABEL_STYLE);
    applyStyle(ws.getRow(row).getCell(2), DATA_STYLE);
    ws.mergeCells(row, 2, row, 10);
  }

  ws.getColumn(1).width = 18;
  ws.getColumn(2).width = 20;
  ws.getColumn(3).width = 15;
  ws.getColumn(4).width = 12;
  ws.getColumn(5).width = 20;
  ws.getColumn(6).width = 18;
  ws.getColumn(7).width = 10;
  ws.getColumn(8).width = 18;
  ws.getColumn(9).width = 24;
  ws.getColumn(10).width = 28;
};

// Schedule Sheet
const createScheduleSheet = (wb: ExcelJS.Workbook, data: ExportData) => {
  const sheetData: SheetRow[] = [
    ["PROGRAMA / HORARIO"],
    [],
  ];

  if (data.eventData.programScheduleDays && data.eventData.programScheduleDays.length > 0) {
    data.eventData.programScheduleDays.forEach((day, dayIndex) => {
      if (dayIndex > 0) sheetData.push([]);
      sheetData.push([day.label || `Día ${dayIndex + 1}`, day.date || ""]);
      sheetData.push(["Hora", "Actividad", "Departamento", "Notas"]);

      if (day.rows && day.rows.length > 0) {
        day.rows.forEach((row) => {
          sheetData.push([
            row.time || "",
            row.item || "",
            row.dept || "",
            row.notes || "",
          ]);
        });
      } else {
        sheetData.push(["No hay actividades programadas", "", "", ""]);
      }
    });
  } else if (data.eventData.programSchedule && data.eventData.programSchedule.length > 0) {
    sheetData.push(["Hora", "Actividad", "Departamento", "Notas"]);
    data.eventData.programSchedule.forEach((row) => {
      sheetData.push([
        row.time || "",
        row.item || "",
        row.dept || "",
        row.notes || "",
      ]);
    });
  } else if (data.eventData.schedule) {
    sheetData.push(["Programa"]);
    sheetData.push([data.eventData.schedule]);
  } else {
    sheetData.push(["No hay programa registrado"]);
  }

  const ws = wb.addWorksheet("Programa");
  populateSheet(ws, sheetData);

  // Title style
  applyStyle(ws.getRow(1).getCell(1), TITLE_STYLE);
  ws.mergeCells("A1:D1");

  // Apply styles based on structure
  let currentRow = 3;
  if (data.eventData.programScheduleDays && data.eventData.programScheduleDays.length > 0) {
    data.eventData.programScheduleDays.forEach((day) => {
      // Day header
      applyStyle(ws.getRow(currentRow).getCell(1), { bold: true, bgColor: "3498DB", textColor: "FFFFFF", borderColor: "3498DB" });
      applyStyle(ws.getRow(currentRow).getCell(2), { bold: true, bgColor: "3498DB", textColor: "FFFFFF", borderColor: "3498DB" });
      ws.mergeCells(currentRow, 1, currentRow, 2);
      currentRow++;

      // Column headers
      const headerRow = ws.getRow(currentRow);
      for (let c = 1; c <= 4; c++) {
        applyStyle(headerRow.getCell(c), HEADER_STYLE);
      }
      currentRow++;

      // Rows
      const rowCount = day.rows?.length || 1;
      for (let i = 0; i < rowCount; i++) {
        const bgColor = i % 2 === 0 ? "FFFFFF" : "F8F9FA";
        const row = ws.getRow(currentRow);
        for (let c = 1; c <= 4; c++) {
          applyStyle(row.getCell(c), { bgColor, borderColor: "000000" });
        }
        currentRow++;
      }
      currentRow++; // Empty row between days
    });
  } else if (data.eventData.programSchedule) {
    // Header
    applyHeaderRow(ws, 3, 4);

    // Data rows
    for (let i = 4; i <= 3 + data.eventData.programSchedule.length; i++) {
      const bgColor = i % 2 === 0 ? "FFFFFF" : "F8F9FA";
      const row = ws.getRow(i);
      for (let c = 1; c <= 4; c++) {
        applyStyle(row.getCell(c), { bgColor, borderColor: "000000" });
      }
    }
  }

  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 40;
  ws.getColumn(3).width = 15;
  ws.getColumn(4).width = 30;
};

// Weather Sheet
const createWeatherSheet = (wb: ExcelJS.Workbook, data: ExportData) => {
  const sheetData: SheetRow[] = [
    ["PREVISIÓN METEOROLÓGICA"],
    [],
    ["Fecha", "Condición", "Temp. Máx. (°C)", "Temp. Mín. (°C)", "Prob. Precipitación (%)"],
  ];

  if (data.eventData.weather && data.eventData.weather.length > 0) {
    data.eventData.weather.forEach((day) => {
      sheetData.push([
        day.date || "",
        day.condition || "",
        day.maxTemp || "",
        day.minTemp || "",
        day.precipitationProbability || "",
      ]);
    });
  } else {
    sheetData.push(["No hay datos meteorológicos disponibles", "", "", "", ""]);
  }

  const ws = wb.addWorksheet("Meteorología");
  populateSheet(ws, sheetData);

  applyStyle(ws.getRow(1).getCell(1), TITLE_STYLE);
  ws.mergeCells("A1:E1");

  applyHeaderRow(ws, 3, 5);
  applyAlternatingRows(ws, 4, sheetData.length, 5);

  ws.getColumn(1).width = 15;
  ws.getColumn(2).width = 25;
  ws.getColumn(3).width = 15;
  ws.getColumn(4).width = 15;
  ws.getColumn(5).width = 20;
};

// Restaurants Sheet
const createRestaurantsSheet = (wb: ExcelJS.Workbook, data: ExportData) => {
  const sheetData: SheetRow[] = [
    ["RESTAURANTES"],
    [],
    ["Nombre", "Dirección", "Tipo de Cocina", "Valoración", "Teléfono", "Sitio Web"],
  ];

  if (data.eventData.restaurants && data.eventData.restaurants.length > 0) {
    const selectedRestaurants = data.eventData.restaurants.filter(
      (r) => data.eventData.selectedRestaurants?.includes(r.id)
    );

    const restaurantsToShow = selectedRestaurants.length > 0 ? selectedRestaurants : data.eventData.restaurants;

    restaurantsToShow.forEach((restaurant) => {
      sheetData.push([
        restaurant.name || "",
        restaurant.address || "",
        restaurant.cuisine?.join(", ") || "",
        restaurant.rating ? `${restaurant.rating}/5` : "",
        restaurant.phone || "",
        restaurant.website || "",
      ]);
    });
  } else {
    sheetData.push(["No hay restaurantes registrados", "", "", "", "", ""]);
  }

  const ws = wb.addWorksheet("Restaurantes");
  populateSheet(ws, sheetData);

  applyStyle(ws.getRow(1).getCell(1), TITLE_STYLE);
  ws.mergeCells("A1:F1");

  applyHeaderRow(ws, 3, 6);
  applyAlternatingRows(ws, 4, sheetData.length, 6);

  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 35;
  ws.getColumn(3).width = 20;
  ws.getColumn(4).width = 12;
  ws.getColumn(5).width = 15;
  ws.getColumn(6).width = 30;
};

// Main export function
export const generateHojaDeRutaXLS = async (data: ExportData) => {
  const ExcelJS = await loadExceljs();
  const wb = new ExcelJS.Workbook();

  // Create all sheets
  createEventSheet(wb, data);
  createVenueSheet(wb, data);
  createContactsSheet(wb, data);
  createStaffSheet(wb, data);
  createTravelSheet(wb, data);
  createAccommodationSheet(wb, data);
  createLogisticsSheet(wb, data);
  createScheduleSheet(wb, data);
  createWeatherSheet(wb, data);
  createRestaurantsSheet(wb, data);

  // Generate filename
  const timestamp = format(new Date(), "yyyy-MM-dd");
  const sanitizedTitle = data.jobTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const filename = `hoja_de_ruta_${sanitizedTitle}_${timestamp}.xlsx`;

  await saveWorkbook(wb, filename);
};
