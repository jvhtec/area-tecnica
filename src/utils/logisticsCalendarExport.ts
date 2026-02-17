import { loadPdfLibs } from "@/utils/pdf/lazyPdf";
import { loadExceljs } from "@/utils/lazyExceljs";
import { applyStyle, populateSheet, saveWorkbook, toArgb } from "@/utils/excelExport";
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from "date-fns";
import { es } from "date-fns/locale";

interface LogisticsEvent {
  id: string;
  event_type: "load" | "unload";
  transport_type: string;
  event_time: string;
  event_date: string;
  transport_provider?: string;
  job?: {
    title: string;
  };
  title?: string;
  departments?: { department: string }[];
}

interface LogisticsExportData {
  events: LogisticsEvent[];
  currentDate: Date;
}

const TRANSPORT_TYPE_LABELS: Record<string, string> = {
  trailer: "Tráiler",
  van: "Furgoneta",
  truck: "Camión",
  car: "Coche",
  own_truck: "Camión Propio",
  rental_truck: "Camión Alquiler",
};

const TRANSPORT_PROVIDER_LABELS: Record<string, string> = {
  dachser: "Dachser",
  transgesa: "Transgesa",
  nacex: "Nacex",
  seur: "Seur",
  correos: "Correos",
  mrw: "MRW",
  own: "Propio",
  other: "Otro",
};

const getTransportTypeLabel = (type: string): string => {
  return TRANSPORT_TYPE_LABELS[type] || type;
};

const getTransportProviderLabel = (provider?: string): string => {
  if (!provider) return "-";
  return TRANSPORT_PROVIDER_LABELS[provider] || provider;
};

const getOperationTypeLabel = (eventType: "load" | "unload"): string => {
  return eventType === "load" ? "Carga" : "Descarga";
};

const getDepartmentsLabel = (departments?: { department: string }[]): string => {
  if (!departments || departments.length === 0) return "-";
  return departments.map((d) => d.department.charAt(0).toUpperCase() + d.department.slice(1)).join(", ");
};

const getJobTitle = (event: LogisticsEvent): string => {
  if (event.job?.title) return event.job.title;
  if (event.title) return event.title;
  return "-";
};

export const generateLogisticsCalendarXLS = async (
  range: "current_week" | "next_week" | "month",
  data: LogisticsExportData
) => {
  const { events, currentDate } = data;

  let startDate: Date, endDate: Date, rangeLabel: string;

  const today = new Date();

  switch (range) {
    case "current_week":
      startDate = startOfWeek(today, { weekStartsOn: 1 });
      endDate = endOfWeek(today, { weekStartsOn: 1 });
      rangeLabel = `Semana Actual (${format(startDate, "d MMM", { locale: es })} - ${format(endDate, "d MMM yyyy", { locale: es })})`;
      break;
    case "next_week":
      startDate = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
      endDate = endOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
      rangeLabel = `Próxima Semana (${format(startDate, "d MMM", { locale: es })} - ${format(endDate, "d MMM yyyy", { locale: es })})`;
      break;
    case "month":
      startDate = startOfMonth(currentDate);
      endDate = endOfMonth(currentDate);
      rangeLabel = `Mes Completo - ${format(currentDate, "MMMM yyyy", { locale: es })}`;
      break;
    default:
      startDate = startOfMonth(currentDate);
      endDate = endOfMonth(currentDate);
      rangeLabel = format(currentDate, "MMMM yyyy", { locale: es });
  }

  // Filter events within the date range
  const filteredEvents = events.filter((event) => {
    if (!event.event_date) return false;
    const eventDate = new Date(event.event_date);
    return eventDate >= startDate && eventDate <= endDate;
  });

  // Sort events by date and time
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    const dateCompare = a.event_date.localeCompare(b.event_date);
    if (dateCompare !== 0) return dateCompare;
    return a.event_time.localeCompare(b.event_time);
  });

  // Create sheet data
  const sheetData: (string | null)[][] = [];

  // Title row
  sheetData.push([rangeLabel, null, null, null, null, null, null]);
  sheetData.push([]); // Empty row

  // Header row
  sheetData.push([
    "Fecha",
    "Trabajo/Título",
    "Tipo de Transporte",
    "Hora",
    "Tipo de Operación",
    "Proveedor de Transporte",
    "Departamento",
  ]);

  // Data rows
  for (const event of sortedEvents) {
    const eventDate = new Date(event.event_date);
    const formattedDate = format(eventDate, "EEE, d MMM yyyy", { locale: es });
    const formattedTime = event.event_time;
    const jobTitle = getJobTitle(event);
    const transportType = getTransportTypeLabel(event.transport_type);
    const operationType = getOperationTypeLabel(event.event_type);
    const transportProvider = getTransportProviderLabel(event.transport_provider);
    const departments = getDepartmentsLabel(event.departments);

    sheetData.push([
      formattedDate,
      jobTitle,
      transportType,
      formattedTime,
      operationType,
      transportProvider,
      departments,
    ]);
  }

  // If no events, add a message
  if (sortedEvents.length === 0) {
    sheetData.push(["No hay eventos de logística en este período", null, null, null, null, null, null]);
  }

  // Create workbook and worksheet
  const ExcelJS = await loadExceljs();
  const workbook = new ExcelJS.Workbook();

  const sheetName = range === "month" ? format(currentDate, "MMM yyyy", { locale: es }) : range === "current_week" ? "Semana Actual" : "Próxima Semana";
  const ws = workbook.addWorksheet(sheetName);
  populateSheet(ws, sheetData);

  // Set column widths
  ws.getColumn(1).width = 20; // Fecha
  ws.getColumn(2).width = 30; // Trabajo/Título
  ws.getColumn(3).width = 18; // Tipo de Transporte
  ws.getColumn(4).width = 10; // Hora
  ws.getColumn(5).width = 18; // Tipo de Operación
  ws.getColumn(6).width = 22; // Proveedor de Transporte
  ws.getColumn(7).width = 18; // Departamento

  // Merge title cell
  if (sheetData.length > 0) {
    ws.mergeCells("A1:G1");
  }

  // Apply styles
  const totalRows = sheetData.length;
  for (let R = 1; R <= totalRows; R++) {
    const row = ws.getRow(R);
    for (let C = 1; C <= 7; C++) {
      const cell = row.getCell(C);

      // Title row (row 1)
      if (R === 1) {
        applyStyle(cell, { bold: true, fontSize: 14, bgColor: "2980B9", textColor: "FFFFFF", alignment: "center", borderColor: "2980B9" });
      }
      // Header row (row 3)
      else if (R === 3) {
        applyStyle(cell, { bold: true, bgColor: "34495E", textColor: "FFFFFF", alignment: "center", borderStyle: "medium" });
      }
      // Data rows (row 4+)
      else if (R > 3) {
        const isEvenRow = (R - 4) % 2 === 0;
        const bgColor = isEvenRow ? "F8F9FA" : "FFFFFF";
        const alignment = C === 1 ? "left" : C === 4 ? "center" : "left";

        applyStyle(cell, { bgColor, alignment, wrapText: true, borderColor: "DDDDDD" });
        cell.font = { size: 10 };

        // Special styling for operation type column (col 5 = Carga/Descarga)
        if (C === 5 && cell.value) {
          const isLoad = cell.value.toString().includes("Carga");
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(isLoad ? "D5E8D4" : "FFE6CC") } };
          cell.font = { bold: true, size: 10, color: { argb: toArgb(isLoad ? "0D7C31" : "D97700") } };
        }
      }
    }
  }

  // Generate filename and save
  const filename = `logistica-${range}-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
  await saveWorkbook(workbook, filename);
};

export const generateLogisticsCalendarPDF = async (
  range: "current_week" | "next_week" | "month",
  data: LogisticsExportData
) => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const { events, currentDate } = data;

  let startDate: Date, endDate: Date, rangeLabel: string;

  const today = new Date();

  switch (range) {
    case "current_week":
      startDate = startOfWeek(today, { weekStartsOn: 1 });
      endDate = endOfWeek(today, { weekStartsOn: 1 });
      rangeLabel = `Semana Actual (${format(startDate, "d MMM", { locale: es })} - ${format(endDate, "d MMM yyyy", { locale: es })})`;
      break;
    case "next_week":
      startDate = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
      endDate = endOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
      rangeLabel = `Próxima Semana (${format(startDate, "d MMM", { locale: es })} - ${format(endDate, "d MMM yyyy", { locale: es })})`;
      break;
    case "month":
      startDate = startOfMonth(currentDate);
      endDate = endOfMonth(currentDate);
      rangeLabel = `Mes Completo - ${format(currentDate, "MMMM yyyy", { locale: es })}`;
      break;
    default:
      startDate = startOfMonth(currentDate);
      endDate = endOfMonth(currentDate);
      rangeLabel = format(currentDate, "MMMM yyyy", { locale: es });
  }

  // Filter events within the date range
  const filteredEvents = events.filter((event) => {
    if (!event.event_date) return false;
    const eventDate = new Date(event.event_date);
    return eventDate >= startDate && eventDate <= endDate;
  });

  // Sort events by date and time
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    const dateCompare = a.event_date.localeCompare(b.event_date);
    if (dateCompare !== 0) return dateCompare;
    return a.event_time.localeCompare(b.event_time);
  });

  // Create PDF
  const doc = new jsPDF("landscape", "mm", "a4");

  // Add logo
  const logo = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = "/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
  }).catch(() => null);

  const pageWidth = doc.internal.pageSize.getWidth();
  const logoWidth = 50;
  const logoHeight = logo ? logoWidth * (logo.height / logo.width) : 0;
  const logoX = logo ? (pageWidth - logoWidth) / 2 : 0;

  if (logo) {
    doc.addImage(logo, "PNG", logoX, 10, logoWidth, logoHeight);
  }

  // Add title
  doc.setFontSize(16);
  doc.setTextColor(41, 128, 185);
  doc.text(`CALENDARIO DE LOGÍSTICA`, pageWidth / 2, logo ? 10 + logoHeight + 10 : 20, { align: "center" });

  doc.setFontSize(12);
  doc.setTextColor(52, 73, 94);
  doc.text(rangeLabel, pageWidth / 2, logo ? 10 + logoHeight + 18 : 28, { align: "center" });

  // Prepare table data
  const tableData = sortedEvents.map((event) => {
    const eventDate = new Date(event.event_date);
    const formattedDate = format(eventDate, "EEE, d MMM yyyy", { locale: es });
    const formattedTime = event.event_time;
    const jobTitle = getJobTitle(event);
    const transportType = getTransportTypeLabel(event.transport_type);
    const operationType = getOperationTypeLabel(event.event_type);
    const transportProvider = getTransportProviderLabel(event.transport_provider);
    const departments = getDepartmentsLabel(event.departments);

    return [
      formattedDate,
      jobTitle,
      transportType,
      formattedTime,
      operationType,
      transportProvider,
      departments,
    ];
  });

  // Add table using autoTable
  autoTable(doc, {
    startY: logo ? 10 + logoHeight + 25 : 35,
    head: [
      [
        "Fecha",
        "Trabajo/Título",
        "Tipo de Transporte",
        "Hora",
        "Tipo de Operación",
        "Proveedor de Transporte",
        "Departamento",
      ],
    ],
    body: tableData.length > 0 ? tableData : [["No hay eventos de logística en este período", "", "", "", "", "", ""]],
    theme: "striped",
    tableWidth: "auto",
    margin: { left: 10, right: 10 },
    headStyles: {
      fillColor: [52, 73, 94],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 10,
      halign: "center",
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250],
    },
    columnStyles: {
      0: { halign: "left" },      // Fecha
      1: { halign: "left" },      // Trabajo/Título
      2: { halign: "left" },      // Tipo de Transporte
      3: { halign: "center" },    // Hora
      4: { halign: "center" },    // Tipo de Operación
      5: { halign: "left" },      // Proveedor de Transporte
      6: { halign: "left" },      // Departamento
    },
    didParseCell: (data: any) => {
      // Color code operation type cells
      if (data.column.index === 4 && data.section === "body") {
        const cellValue = data.cell.raw;
        if (cellValue === "Carga") {
          data.cell.styles.fillColor = [213, 232, 212]; // Light green
          data.cell.styles.textColor = [13, 124, 49];   // Dark green
          data.cell.styles.fontStyle = "bold";
        } else if (cellValue === "Descarga") {
          data.cell.styles.fillColor = [255, 230, 204]; // Light orange
          data.cell.styles.textColor = [217, 119, 0];   // Dark orange
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  // Save PDF
  const filename = `logistica-${range}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(filename);
};
