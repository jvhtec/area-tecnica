import { loadPdfLibs } from "@/utils/pdf/lazyPdf";
import {
  REPORT_ACCENT,
  REPORT_SOFT,
  distributeColumnWidths,
  drawReportMasthead,
  drawReportRunningHead,
  loadReportIssuerMark,
  reportTableDefaults,
  stampReportFolios,
  type ReportChromeOptions,
} from "@/utils/pdf/report-system";
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
import { toZonedTime } from "date-fns-tz";

interface LogisticsEvent {
  id: string;
  event_type: "load" | "unload";
  transport_type: string;
  event_time: string;
  event_date: string;
  // Nullable to match the `logistics_events` columns.
  transport_provider?: string | null;
  job?: {
    title: string;
  } | null;
  title?: string | null;
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

const getTransportProviderLabel = (provider?: string | null): string => {
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

function prepareLogisticsCalendarData(
  range: "current_week" | "next_week" | "month",
  events: LogisticsEvent[],
  currentDate: Date
): { startDate: Date; endDate: Date; rangeLabel: string; events: LogisticsEvent[] } {
  const today = toZonedTime(new Date(), "Europe/Madrid");
  let startDate: Date, endDate: Date, rangeLabel: string;

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

  const filteredEvents = events.filter((event) => {
    if (!event.event_date) return false;
    const eventDate = new Date(event.event_date);
    return eventDate >= startDate && eventDate <= endDate;
  });

  const sortedEvents = [...filteredEvents].sort((a, b) => {
    const dateCompare = a.event_date.localeCompare(b.event_date);
    if (dateCompare !== 0) return dateCompare;
    return a.event_time.localeCompare(b.event_time);
  });

  return { startDate, endDate, rangeLabel, events: sortedEvents };
}

export const generateLogisticsCalendarXLS = async (
  range: "current_week" | "next_week" | "month",
  data: LogisticsExportData
) => {
  const { events, currentDate } = data;
  const { rangeLabel, events: sortedEvents } = prepareLogisticsCalendarData(range, events, currentDate);

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
   const filename = `logistica-${range}-${format(toZonedTime(new Date(), "Europe/Madrid"), "yyyy-MM-dd")}.xlsx`;

  await saveWorkbook(workbook, filename);
};

export const generateLogisticsCalendarPDF = async (
  range: "current_week" | "next_week" | "month",
  data: LogisticsExportData
) => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const { events, currentDate } = data;
  const { rangeLabel, events: sortedEvents } = prepareLogisticsCalendarData(range, events, currentDate);

  // Create PDF
  const doc = new jsPDF("landscape", "mm", "a4");

  await loadReportIssuerMark();

  const chrome: ReportChromeOptions = {
    kind: "tour",
    kindLabel: "Calendario de logística",
    eventTitle: "Calendario de logística",
    contextLabel: rangeLabel,
  };

  const { geo, y: contentTop } = drawReportMasthead(doc, {
    ...chrome,
    title: "Calendario de logística",
    subtitle: rangeLabel,
    meta: [
      { label: "Periodo", value: rangeLabel },
      { label: "Movimientos", value: String(sortedEvents.length) },
      { label: "Emisión", value: format(new Date(), "dd/MM/yyyy") },
    ],
  });

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
  const tableDefaults = reportTableDefaults(geo, { fontSize: 7, numericColumns: [3] });

  autoTable(doc, {
    startY: contentTop,
    head: [
      [
        "Fecha",
        "Trabajo/Título",
        "Tipo de transporte",
        "Hora",
        "Operación",
        "Proveedor",
        "Departamento",
      ],
    ],
    body: tableData.length > 0
      ? tableData
      : [["No hay eventos de logística en este período", "—", "—", "—", "—", "—", "—"]],
    ...tableDefaults,
    columnStyles: distributeColumnWidths([28, 44, 30, 14, 22, 30, 30], geo.contentWidth),
    didParseCell: (data) => {
      tableDefaults.didParseCell(data);

      // Load and unload are the two states of the column, and the reader scans
      // for one of them: they are marked in type rather than by tinting the
      // cell, which would put two more colours on the page.
      if (data.column.index === 4 && data.section === "body") {
        data.cell.styles.font = "courier";
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor =
          data.cell.raw === "Carga"
            ? (REPORT_ACCENT as [number, number, number])
            : (REPORT_SOFT as [number, number, number]);
      }
    },
    didDrawPage: (hook) => {
      if (hook.pageNumber > 1) drawReportRunningHead(doc, chrome);
    },
  });

  stampReportFolios(doc);

  // Save PDF
  const filename = `logistica-${range}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(filename);
};
