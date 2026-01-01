import type * as XLSXTypes from "xlsx";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { EventData, TravelArrangement, Accommodation, Transport } from "@/types/hoja-de-ruta";
import { loadXlsx } from "@/utils/lazyXlsx";

let XLSX: any;

interface ExportData {
  eventData: EventData;
  travelArrangements: TravelArrangement[];
  accommodations: Accommodation[];
  jobTitle: string;
  jobDate?: string;
}

const createCellStyle = (options: {
  bold?: boolean;
  fontSize?: number;
  bgColor?: string;
  textColor?: string;
  alignment?: "left" | "center" | "right";
}) => {
  return {
    font: {
      bold: options.bold || false,
      sz: options.fontSize || 11,
      color: options.textColor ? { rgb: options.textColor } : undefined,
    },
    fill: options.bgColor
      ? { patternType: "solid", fgColor: { rgb: options.bgColor } }
      : undefined,
    alignment: {
      horizontal: options.alignment || "left",
      vertical: "center",
    },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } },
    },
  };
};

const applyCellStyle = (ws: XLSXTypes.WorkSheet, cell: string, style: any) => {
  if (!ws[cell]) ws[cell] = { t: "s", v: "" };
  ws[cell].s = style;
};

// Event Information Sheet
const createEventSheet = (data: ExportData): XLSXTypes.WorkSheet => {
  const sheetData: any[][] = [
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

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Title style
  applyCellStyle(ws, "A1", createCellStyle({ bold: true, fontSize: 14, bgColor: "2980B9", textColor: "FFFFFF", alignment: "center" }));

  // Merge title row
  if (!ws["!merges"]) ws["!merges"] = [];
  ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } });

  // Header style
  applyCellStyle(ws, "A3", createCellStyle({ bold: true, bgColor: "34495E", textColor: "FFFFFF" }));
  applyCellStyle(ws, "B3", createCellStyle({ bold: true, bgColor: "34495E", textColor: "FFFFFF" }));

  // Data rows
  for (let i = 4; i <= sheetData.length; i++) {
    applyCellStyle(ws, `A${i}`, createCellStyle({ bold: true, bgColor: "ECF0F1" }));
    applyCellStyle(ws, `B${i}`, createCellStyle({}));
  }

  // Column widths
  ws["!cols"] = [{ wch: 25 }, { wch: 50 }];

  return ws;
};

// Venue Information Sheet
const createVenueSheet = (data: ExportData): XLSXTypes.WorkSheet => {
  const sheetData: any[][] = [
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

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Title styles
  applyCellStyle(ws, "A1", createCellStyle({ bold: true, fontSize: 14, bgColor: "2980B9", textColor: "FFFFFF", alignment: "center" }));
  applyCellStyle(ws, "A9", createCellStyle({ bold: true, fontSize: 14, bgColor: "2980B9", textColor: "FFFFFF", alignment: "center" }));

  // Merge title rows
  if (!ws["!merges"]) ws["!merges"] = [];
  ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } });
  ws["!merges"].push({ s: { r: 8, c: 0 }, e: { r: 8, c: 1 } });

  // Header styles
  applyCellStyle(ws, "A3", createCellStyle({ bold: true, bgColor: "34495E", textColor: "FFFFFF" }));
  applyCellStyle(ws, "B3", createCellStyle({ bold: true, bgColor: "34495E", textColor: "FFFFFF" }));

  // Data rows
  for (let i = 4; i <= 7; i++) {
    applyCellStyle(ws, `A${i}`, createCellStyle({ bold: true, bgColor: "ECF0F1" }));
    applyCellStyle(ws, `B${i}`, createCellStyle({}));
  }
  for (let i = 11; i <= 13; i++) {
    applyCellStyle(ws, `A${i}`, createCellStyle({ bold: true, bgColor: "ECF0F1" }));
    applyCellStyle(ws, `B${i}`, createCellStyle({}));
  }

  ws["!cols"] = [{ wch: 25 }, { wch: 50 }];

  return ws;
};

// Contacts Sheet
const createContactsSheet = (data: ExportData): XLSXTypes.WorkSheet => {
  const sheetData: any[][] = [
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

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Title style
  applyCellStyle(ws, "A1", createCellStyle({ bold: true, fontSize: 14, bgColor: "2980B9", textColor: "FFFFFF", alignment: "center" }));

  if (!ws["!merges"]) ws["!merges"] = [];
  ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } });

  // Header style
  ["A3", "B3", "C3", "D3"].forEach((cell) => {
    applyCellStyle(ws, cell, createCellStyle({ bold: true, bgColor: "34495E", textColor: "FFFFFF" }));
  });

  // Data rows with alternating colors
  for (let i = 4; i <= sheetData.length; i++) {
    const bgColor = i % 2 === 0 ? "FFFFFF" : "F8F9FA";
    ["A", "B", "C", "D"].forEach((col) => {
      applyCellStyle(ws, `${col}${i}`, createCellStyle({ bgColor }));
    });
  }

  ws["!cols"] = [{ wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 30 }];

  return ws;
};

// Staff Sheet
const createStaffSheet = (data: ExportData): XLSXTypes.WorkSheet => {
  const sheetData: any[][] = [
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

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Title style
  applyCellStyle(ws, "A1", createCellStyle({ bold: true, fontSize: 14, bgColor: "2980B9", textColor: "FFFFFF", alignment: "center" }));

  if (!ws["!merges"]) ws["!merges"] = [];
  ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } });

  // Header style
  ["A3", "B3", "C3", "D3", "E3", "F3", "G3"].forEach((cell) => {
    applyCellStyle(ws, cell, createCellStyle({ bold: true, bgColor: "34495E", textColor: "FFFFFF" }));
  });

  // Data rows
  for (let i = 4; i <= sheetData.length; i++) {
    const bgColor = i % 2 === 0 ? "FFFFFF" : "F8F9FA";
    ["A", "B", "C", "D", "E", "F", "G"].forEach((col) => {
      applyCellStyle(ws, `${col}${i}`, createCellStyle({ bgColor }));
    });
  }

  ws["!cols"] = [{ wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];

  return ws;
};

// Travel Sheet
const createTravelSheet = (data: ExportData): XLSXTypes.WorkSheet => {
  const sheetData: any[][] = [
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

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Title style
  applyCellStyle(ws, "A1", createCellStyle({ bold: true, fontSize: 14, bgColor: "2980B9", textColor: "FFFFFF", alignment: "center" }));

  if (!ws["!merges"]) ws["!merges"] = [];
  ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } });

  // Header style
  ["A3", "B3", "C3", "D3", "E3", "F3", "G3", "H3"].forEach((cell) => {
    applyCellStyle(ws, cell, createCellStyle({ bold: true, bgColor: "34495E", textColor: "FFFFFF" }));
  });

  // Data rows
  for (let i = 4; i <= sheetData.length; i++) {
    const bgColor = i % 2 === 0 ? "FFFFFF" : "F8F9FA";
    ["A", "B", "C", "D", "E", "F", "G", "H"].forEach((col) => {
      applyCellStyle(ws, `${col}${i}`, createCellStyle({ bgColor }));
    });
  }

  ws["!cols"] = [{ wch: 18 }, { wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 20 }, { wch: 30 }];

  return ws;
};

// Accommodation Sheet
const createAccommodationSheet = (data: ExportData): XLSXTypes.WorkSheet => {
  const sheetData: any[][] = [
    ["ALOJAMIENTO"],
    [],
  ];

  if (data.accommodations && data.accommodations.length > 0) {
    data.accommodations.forEach((accommodation, index) => {
      if (index > 0) sheetData.push([]); // Add spacing between hotels

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

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Title style
  applyCellStyle(ws, "A1", createCellStyle({ bold: true, fontSize: 14, bgColor: "2980B9", textColor: "FFFFFF", alignment: "center" }));

  if (!ws["!merges"]) ws["!merges"] = [];
  ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } });

  // Apply styles dynamically based on content
  let rowIndex = 3;
  data.accommodations?.forEach(() => {
    // Hotel header
    applyCellStyle(ws, `A${rowIndex}`, createCellStyle({ bold: true, bgColor: "3498DB", textColor: "FFFFFF" }));
    if (!ws["!merges"]) ws["!merges"] = [];
    ws["!merges"].push({ s: { r: rowIndex - 1, c: 0 }, e: { r: rowIndex - 1, c: 1 } });
    rowIndex++;

    // Hotel details
    for (let i = 0; i < 4; i++) {
      applyCellStyle(ws, `A${rowIndex}`, createCellStyle({ bold: true, bgColor: "ECF0F1" }));
      applyCellStyle(ws, `B${rowIndex}`, createCellStyle({}));
      rowIndex++;
    }

    rowIndex++; // Empty row

    // Room header
    ["A", "B", "C", "D"].forEach((col) => {
      applyCellStyle(ws, `${col}${rowIndex}`, createCellStyle({ bold: true, bgColor: "34495E", textColor: "FFFFFF" }));
    });
    rowIndex++;

    // Room data (estimate based on typical room count)
    const roomCount = 5; // Adjust dynamically if needed
    for (let i = 0; i < roomCount; i++) {
      const bgColor = i % 2 === 0 ? "FFFFFF" : "F8F9FA";
      ["A", "B", "C", "D"].forEach((col) => {
        applyCellStyle(ws, `${col}${rowIndex}`, createCellStyle({ bgColor }));
      });
      rowIndex++;
    }

    rowIndex++; // Empty row between hotels
  });

  ws["!cols"] = [{ wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 25 }];

  return ws;
};

// Logistics/Transport Sheet
const createLogisticsSheet = (data: ExportData): XLSXTypes.WorkSheet => {
  const transports = data.eventData.logistics?.transport || [];

  const sheetData: any[][] = [
    ["LOGÍSTICA Y TRANSPORTE"],
    [],
    ["Tipo de Transporte", "Conductor", "Teléfono", "Matrícula", "Compañía", "Fecha/Hora", "¿Retorno?", "Fecha/Hora Retorno"],
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
      ]);
    });
  } else {
    sheetData.push(["No hay transporte registrado", "", "", "", "", "", "", ""]);
  }

  // Add logistics notes
  sheetData.push([]);
  sheetData.push(["DETALLES DE LOGÍSTICA"]);
  sheetData.push([]);
  sheetData.push(["Detalles de Carga", data.eventData.logistics?.loadingDetails || "No especificado"]);
  sheetData.push(["Detalles de Descarga", data.eventData.logistics?.unloadingDetails || "No especificado"]);
  sheetData.push(["Logística de Equipamiento", data.eventData.logistics?.equipmentLogistics || "No especificado"]);

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Title style
  applyCellStyle(ws, "A1", createCellStyle({ bold: true, fontSize: 14, bgColor: "2980B9", textColor: "FFFFFF", alignment: "center" }));

  if (!ws["!merges"]) ws["!merges"] = [];
  ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } });

  // Header style
  ["A3", "B3", "C3", "D3", "E3", "F3", "G3", "H3"].forEach((cell) => {
    applyCellStyle(ws, cell, createCellStyle({ bold: true, bgColor: "34495E", textColor: "FFFFFF" }));
  });

  // Data rows for transport
  const transportEndRow = 4 + transports.length;
  for (let i = 4; i <= transportEndRow; i++) {
    const bgColor = i % 2 === 0 ? "FFFFFF" : "F8F9FA";
    ["A", "B", "C", "D", "E", "F", "G", "H"].forEach((col) => {
      applyCellStyle(ws, `${col}${i}`, createCellStyle({ bgColor }));
    });
  }

  // Logistics details section
  const detailsStartRow = transportEndRow + 2;
  applyCellStyle(ws, `A${detailsStartRow}`, createCellStyle({ bold: true, fontSize: 12, bgColor: "3498DB", textColor: "FFFFFF", alignment: "center" }));
  ws["!merges"].push({ s: { r: detailsStartRow - 1, c: 0 }, e: { r: detailsStartRow - 1, c: 7 } });

  for (let i = 0; i < 3; i++) {
    const row = detailsStartRow + 2 + i;
    applyCellStyle(ws, `A${row}`, createCellStyle({ bold: true, bgColor: "ECF0F1" }));
    applyCellStyle(ws, `B${row}`, createCellStyle({}));
    ws["!merges"].push({ s: { r: row - 1, c: 1 }, e: { r: row - 1, c: 7 } });
  }

  ws["!cols"] = [{ wch: 18 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 18 }, { wch: 10 }, { wch: 18 }];

  return ws;
};

// Schedule Sheet
const createScheduleSheet = (data: ExportData): XLSXTypes.WorkSheet => {
  const sheetData: any[][] = [
    ["PROGRAMA / HORARIO"],
    [],
  ];

  // Check for multi-day schedule
  if (data.eventData.programScheduleDays && data.eventData.programScheduleDays.length > 0) {
    data.eventData.programScheduleDays.forEach((day, dayIndex) => {
      if (dayIndex > 0) sheetData.push([]); // Add spacing between days

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
    // Single-day schedule
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
    // Text-based schedule
    sheetData.push(["Programa"]);
    sheetData.push([data.eventData.schedule]);
  } else {
    sheetData.push(["No hay programa registrado"]);
  }

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Title style
  applyCellStyle(ws, "A1", createCellStyle({ bold: true, fontSize: 14, bgColor: "2980B9", textColor: "FFFFFF", alignment: "center" }));

  if (!ws["!merges"]) ws["!merges"] = [];
  ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } });

  // Apply styles based on structure
  let currentRow = 3;
  if (data.eventData.programScheduleDays && data.eventData.programScheduleDays.length > 0) {
    data.eventData.programScheduleDays.forEach((day) => {
      // Day header
      applyCellStyle(ws, `A${currentRow}`, createCellStyle({ bold: true, bgColor: "3498DB", textColor: "FFFFFF" }));
      applyCellStyle(ws, `B${currentRow}`, createCellStyle({ bold: true, bgColor: "3498DB", textColor: "FFFFFF" }));
      ws["!merges"].push({ s: { r: currentRow - 1, c: 0 }, e: { r: currentRow - 1, c: 1 } });
      currentRow++;

      // Column headers
      ["A", "B", "C", "D"].forEach((col) => {
        applyCellStyle(ws, `${col}${currentRow}`, createCellStyle({ bold: true, bgColor: "34495E", textColor: "FFFFFF" }));
      });
      currentRow++;

      // Rows
      const rowCount = day.rows?.length || 1;
      for (let i = 0; i < rowCount; i++) {
        const bgColor = i % 2 === 0 ? "FFFFFF" : "F8F9FA";
        ["A", "B", "C", "D"].forEach((col) => {
          applyCellStyle(ws, `${col}${currentRow}`, createCellStyle({ bgColor }));
        });
        currentRow++;
      }
      currentRow++; // Empty row between days
    });
  } else if (data.eventData.programSchedule) {
    // Header
    ["A3", "B3", "C3", "D3"].forEach((cell) => {
      applyCellStyle(ws, cell, createCellStyle({ bold: true, bgColor: "34495E", textColor: "FFFFFF" }));
    });

    // Data rows
    for (let i = 4; i <= 3 + data.eventData.programSchedule.length; i++) {
      const bgColor = i % 2 === 0 ? "FFFFFF" : "F8F9FA";
      ["A", "B", "C", "D"].forEach((col) => {
        applyCellStyle(ws, `${col}${i}`, createCellStyle({ bgColor }));
      });
    }
  }

  ws["!cols"] = [{ wch: 12 }, { wch: 40 }, { wch: 15 }, { wch: 30 }];

  return ws;
};

// Weather Sheet
const createWeatherSheet = (data: ExportData): XLSXTypes.WorkSheet => {
  const sheetData: any[][] = [
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

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Title style
  applyCellStyle(ws, "A1", createCellStyle({ bold: true, fontSize: 14, bgColor: "2980B9", textColor: "FFFFFF", alignment: "center" }));

  if (!ws["!merges"]) ws["!merges"] = [];
  ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } });

  // Header style
  ["A3", "B3", "C3", "D3", "E3"].forEach((cell) => {
    applyCellStyle(ws, cell, createCellStyle({ bold: true, bgColor: "34495E", textColor: "FFFFFF" }));
  });

  // Data rows
  for (let i = 4; i <= sheetData.length; i++) {
    const bgColor = i % 2 === 0 ? "FFFFFF" : "F8F9FA";
    ["A", "B", "C", "D", "E"].forEach((col) => {
      applyCellStyle(ws, `${col}${i}`, createCellStyle({ bgColor }));
    });
  }

  ws["!cols"] = [{ wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];

  return ws;
};

// Restaurants Sheet
const createRestaurantsSheet = (data: ExportData): XLSXTypes.WorkSheet => {
  const sheetData: any[][] = [
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

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Title style
  applyCellStyle(ws, "A1", createCellStyle({ bold: true, fontSize: 14, bgColor: "2980B9", textColor: "FFFFFF", alignment: "center" }));

  if (!ws["!merges"]) ws["!merges"] = [];
  ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } });

  // Header style
  ["A3", "B3", "C3", "D3", "E3", "F3"].forEach((cell) => {
    applyCellStyle(ws, cell, createCellStyle({ bold: true, bgColor: "34495E", textColor: "FFFFFF" }));
  });

  // Data rows
  for (let i = 4; i <= sheetData.length; i++) {
    const bgColor = i % 2 === 0 ? "FFFFFF" : "F8F9FA";
    ["A", "B", "C", "D", "E", "F"].forEach((col) => {
      applyCellStyle(ws, `${col}${i}`, createCellStyle({ bgColor }));
    });
  }

  ws["!cols"] = [{ wch: 30 }, { wch: 35 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 30 }];

  return ws;
};

// Main export function
export const generateHojaDeRutaXLS = async (data: ExportData) => {
  XLSX ??= await loadXlsx();
  const wb = XLSX.utils.book_new();

  // Create sheets
  const eventSheet = createEventSheet(data);
  const venueSheet = createVenueSheet(data);
  const contactsSheet = createContactsSheet(data);
  const staffSheet = createStaffSheet(data);
  const travelSheet = createTravelSheet(data);
  const accommodationSheet = createAccommodationSheet(data);
  const logisticsSheet = createLogisticsSheet(data);
  const scheduleSheet = createScheduleSheet(data);
  const weatherSheet = createWeatherSheet(data);
  const restaurantsSheet = createRestaurantsSheet(data);

  // Add sheets to workbook
  XLSX.utils.book_append_sheet(wb, eventSheet, "Evento");
  XLSX.utils.book_append_sheet(wb, venueSheet, "Recinto");
  XLSX.utils.book_append_sheet(wb, contactsSheet, "Contactos");
  XLSX.utils.book_append_sheet(wb, staffSheet, "Personal");
  XLSX.utils.book_append_sheet(wb, travelSheet, "Viajes");
  XLSX.utils.book_append_sheet(wb, accommodationSheet, "Alojamiento");
  XLSX.utils.book_append_sheet(wb, logisticsSheet, "Logística");
  XLSX.utils.book_append_sheet(wb, scheduleSheet, "Programa");
  XLSX.utils.book_append_sheet(wb, weatherSheet, "Meteorología");
  XLSX.utils.book_append_sheet(wb, restaurantsSheet, "Restaurantes");

  // Generate filename
  const timestamp = format(new Date(), "yyyy-MM-dd");
  const sanitizedTitle = data.jobTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const filename = `hoja_de_ruta_${sanitizedTitle}_${timestamp}.xlsx`;

  // Write file
  XLSX.writeFile(wb, filename, { cellStyles: true });
};
