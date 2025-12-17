import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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

export const generateLogisticsCalendarXLS = (
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
  const workbook = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Set column widths
  ws["!cols"] = [
    { wch: 20 }, // Fecha
    { wch: 30 }, // Trabajo/Título
    { wch: 18 }, // Tipo de Transporte
    { wch: 10 }, // Hora
    { wch: 18 }, // Tipo de Operación
    { wch: 22 }, // Proveedor de Transporte
    { wch: 18 }, // Departamento
  ];

  // Merge title cell
  if (sheetData.length > 0) {
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
  }

  // Apply styles to cells using XLSX format
  const cellRange = XLSX.utils.decode_range(ws["!ref"] || "A1");

  for (let R = cellRange.s.r; R <= cellRange.e.r; ++R) {
    for (let C = cellRange.s.c; C <= cellRange.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellAddress]) continue;

      // Initialize cell
      if (!ws[cellAddress].s) ws[cellAddress].s = {};

      // Title row (row 0) - Bold, centered, larger font, blue background
      if (R === 0) {
        ws[cellAddress].s = {
          font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } },
          fill: { patternType: "solid", fgColor: { rgb: "2980B9" } },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } },
          },
        };
      }
      // Header row (row 2) - Bold, centered, gray background
      else if (R === 2) {
        ws[cellAddress].s = {
          font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
          fill: { patternType: "solid", fgColor: { rgb: "34495E" } },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "medium", color: { rgb: "000000" } },
            bottom: { style: "medium", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } },
          },
        };
      }
      // Data rows (row 3+) - Alternating colors
      else if (R > 2) {
        const isEvenRow = (R - 3) % 2 === 0;
        const bgColor = isEvenRow ? "F8F9FA" : "FFFFFF";

        ws[cellAddress].s = {
          font: { sz: 10 },
          fill: { patternType: "solid", fgColor: { rgb: bgColor } },
          alignment: {
            horizontal: C === 0 ? "left" : C === 3 ? "center" : "left",
            vertical: "center",
            wrapText: true
          },
          border: {
            top: { style: "thin", color: { rgb: "DDDDDD" } },
            bottom: { style: "thin", color: { rgb: "DDDDDD" } },
            left: { style: "thin", color: { rgb: "DDDDDD" } },
            right: { style: "thin", color: { rgb: "DDDDDD" } },
          },
        };

        // Special styling for operation type column (Carga/Descarga)
        if (C === 4 && ws[cellAddress].v) {
          const isLoad = ws[cellAddress].v.toString().includes("Carga");
          ws[cellAddress].s.fill = { patternType: "solid", fgColor: { rgb: isLoad ? "D5E8D4" : "FFE6CC" } };
          ws[cellAddress].s.font = { bold: true, sz: 10, color: { rgb: isLoad ? "0D7C31" : "D97700" } };
        }
      }
    }
  }

  // Add worksheet to workbook
  const sheetName = range === "month" ? format(currentDate, "MMM yyyy", { locale: es }) : range === "current_week" ? "Semana Actual" : "Próxima Semana";
  XLSX.utils.book_append_sheet(workbook, ws, sheetName);

  // Generate filename
  const filename = `logistica-${range}-${format(new Date(), "yyyy-MM-dd")}.xlsx`;

  // Save file with styling support
  XLSX.writeFile(workbook, filename, {
    bookSST: true,
    cellStyles: true
  });
};

export const generateLogisticsCalendarPDF = async (
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
