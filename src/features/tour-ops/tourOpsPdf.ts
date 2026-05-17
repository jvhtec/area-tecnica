import { es } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import type jsPDF from "jspdf";
import { loadPdfLibs } from "@/utils/pdf/lazyPdf";
import { buildReadableFilename } from "@/utils/fileName";
import { MADRID_TIMEZONE } from "@/utils/timezoneUtils";
import type { TourOpsDate, TourOpsModel, TourOpsProjection } from "@/features/tour-ops/types";

const RED: [number, number, number] = [125, 1, 1];
const INK: [number, number, number] = [32, 36, 42];
const MUTED: [number, number, number] = [104, 112, 124];

interface AutoTableDoc extends jsPDF {
  lastAutoTable?: { finalY?: number };
}

const lastY = (pdf: jsPDF, fallback: number) => (pdf as AutoTableDoc).lastAutoTable?.finalY ?? fallback;
const dateOnlyAsMadridNoon = (value: string) => (value.includes("T") ? value : `${value}T12:00:00`);

const formatDate = (value: string | null | undefined) => {
  if (!value) return "Sin fecha";
  try {
    return formatInTimeZone(dateOnlyAsMadridNoon(value), MADRID_TIMEZONE, "EEE d MMM yyyy", { locale: es });
  } catch {
    return value;
  }
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "";
  if (value.includes("T")) {
    try {
      return formatInTimeZone(value, MADRID_TIMEZONE, "d MMM HH:mm", { locale: es });
    } catch {
      return value;
    }
  }
  return value;
};

const header = (pdf: jsPDF, title: string, subtitle: string) => {
  const width = pdf.internal.pageSize.width;
  pdf.setFillColor(...RED);
  pdf.rect(0, 0, width, 26, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(title, 12, 12);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(subtitle, 12, 20);
};

const footer = (pdf: jsPDF, page: number) => {
  const width = pdf.internal.pageSize.width;
  const height = pdf.internal.pageSize.height;
  pdf.setTextColor(...MUTED);
  pdf.setFontSize(8);
  pdf.text(`Generado ${formatInTimeZone(new Date(), MADRID_TIMEZONE, "d MMM yyyy HH:mm", { locale: es })}`, 12, height - 10);
  pdf.text(`Pagina ${page}`, width - 28, height - 10);
};

const ensurePage = (pdf: jsPDF, y: number, pageRef: { value: number }, title: string, subtitle: string) => {
  if (y < 260) return y;
  footer(pdf, pageRef.value);
  pdf.addPage();
  pageRef.value += 1;
  header(pdf, title, subtitle);
  return 38;
};

const sectionTitle = (pdf: jsPDF, title: string, y: number) => {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...RED);
  pdf.text(title, 12, y);
  pdf.setTextColor(...INK);
  return y + 6;
};

const runAutoTable = (
  pdf: jsPDF,
  autoTable: any,
  pageRef: { value: number },
  title: string,
  subtitle: string,
  options: Record<string, any>,
) => {
  const userDidDrawPage = options.didDrawPage;
  autoTable(pdf, {
    ...options,
    margin: { top: 34, left: 12, right: 12, ...(options.margin ?? {}) },
    didDrawPage: (data: any) => {
      const currentPage = (pdf.internal as any).getCurrentPageInfo?.().pageNumber ?? pdf.internal.getNumberOfPages();
      pageRef.value = Math.max(pageRef.value, pdf.internal.getNumberOfPages());
      header(pdf, title, subtitle);
      footer(pdf, currentPage);
      userDidDrawPage?.(data);
    },
  });
  pageRef.value = Math.max(pageRef.value, pdf.internal.getNumberOfPages());
};

const addDatePage = (
  pdf: jsPDF,
  autoTable: any,
  model: TourOpsModel,
  tourDate: TourOpsDate,
  pageRef: { value: number },
  projection: TourOpsProjection,
) => {
  pdf.addPage();
  pageRef.value += 1;
  header(pdf, model.tour.name, `${formatDate(tourDate.date)} - ${tourDate.venueName || "Fecha de gira"}`);
  let y = 40;

  runAutoTable(pdf, autoTable, pageRef, model.tour.name, `${formatDate(tourDate.date)} - ${tourDate.venueName || "Fecha de gira"}`, {
    startY: y,
    theme: "plain",
    body: [
      ["Fecha", formatDate(tourDate.date)],
      ["Tipo", tourDate.type || "show"],
      ["Venue", tourDate.venueName || tourDate.location?.name || "Por confirmar"],
      ["Direccion", tourDate.venueAddress || tourDate.location?.formattedAddress || "Por confirmar"],
      ["Job", tourDate.jobTitle || tourDate.jobId || "Sin job vinculado"],
    ],
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 34 }, 1: { cellWidth: 150 } },
  });
  y = lastY(pdf, y) + 10;

  y = sectionTitle(pdf, "Programa", y);
  const programRows = tourDate.program.flatMap((day) =>
    day.rows.map((row) => [day.label || "", row.time || "", row.item || "", row.dept || "", row.notes || ""]),
  );
  runAutoTable(pdf, autoTable, pageRef, model.tour.name, `${formatDate(tourDate.date)} - ${tourDate.venueName || "Fecha de gira"}`, {
    startY: y,
    head: [["Dia", "Hora", "Actividad", "Dpto", "Notas"]],
    body: programRows.length ? programRows : [["", "", "Programa pendiente", "", ""]],
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: RED, textColor: [255, 255, 255] },
    columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 20 }, 2: { cellWidth: 58 }, 3: { cellWidth: 22 }, 4: { cellWidth: 60 } },
  });
  y = lastY(pdf, y) + 10;

  if (model.allowedSections.travel) {
    y = ensurePage(pdf, y, pageRef, model.tour.name, "Continuacion");
    y = sectionTitle(pdf, "Viajes", y);
    const travelRows = [...tourDate.travelIn, ...tourDate.travelOut].map((segment) => [
      segment.fromLabel,
      segment.toLabel,
      segment.transportationType,
      formatDateTime(segment.departureTime),
      formatDateTime(segment.arrivalTime),
      segment.routeNotes || "",
    ]);
    runAutoTable(pdf, autoTable, pageRef, model.tour.name, "Continuacion", {
      startY: y,
      head: [["Origen", "Destino", "Tipo", "Salida", "Llegada", "Notas"]],
      body: travelRows.length ? travelRows : [["", "", "", "", "", "Sin viajes definidos"]],
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [70, 82, 96], textColor: [255, 255, 255] },
    });
    y = lastY(pdf, y) + 10;
  }

  if (projection !== "guest") {
    y = ensurePage(pdf, y, pageRef, model.tour.name, "Continuacion");
    y = sectionTitle(pdf, "Equipo", y);
    runAutoTable(pdf, autoTable, pageRef, model.tour.name, "Continuacion", {
      startY: y,
      head: [["Nombre", "Dpto", "Rol", "Telefono"]],
      body: tourDate.crew.length
        ? tourDate.crew.map((member) => [member.name, member.department || "", member.role || "", member.phone || ""])
        : [["", "", "Sin equipo confirmado", ""]],
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [70, 82, 96], textColor: [255, 255, 255] },
    });
    y = lastY(pdf, y) + 10;
  }

  if (model.allowedSections.accommodations) {
    y = ensurePage(pdf, y, pageRef, model.tour.name, "Continuacion");
    y = sectionTitle(pdf, "Alojamiento", y);
    runAutoTable(pdf, autoTable, pageRef, model.tour.name, "Continuacion", {
      startY: y,
      head: [["Hotel", "Check-in", "Check-out", "Confirmacion"]],
      body: tourDate.accommodations.length
        ? tourDate.accommodations.map((hotel) => [
            hotel.hotelName,
            hotel.checkInDate || "",
            hotel.checkOutDate || "",
            hotel.confirmationNumber || "",
          ])
        : [["Sin alojamiento definido", "", "", ""]],
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [70, 82, 96], textColor: [255, 255, 255] },
    });
  }

  footer(pdf, pageRef.value);
};

export async function generateTourOpsPdf(
  model: TourOpsModel,
  projection: TourOpsProjection,
  options: { dateId?: string; filenameSuffix?: string } = {},
) {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const pdf = new jsPDF();
  const pageRef = { value: 1 };
  const dates = options.dateId ? model.dates.filter((date) => date.id === options.dateId) : model.dates;

  pdf.setFillColor(...RED);
  pdf.rect(0, 0, pdf.internal.pageSize.width, pdf.internal.pageSize.height, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(28);
  pdf.text(model.tour.name, 18, 92);
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "normal");
  pdf.text(
    projection === "guest" ? "Itinerario externo" : projection === "technician" ? "Itinerario de equipo" : "Libro de operaciones",
    18,
    108,
  );
  pdf.setFontSize(10);
  pdf.text(`${model.stats.totalDates} fechas - ${model.stats.travelSegments} viajes`, 18, 122);
  footer(pdf, pageRef.value);

  pdf.addPage();
  pageRef.value += 1;
  header(pdf, model.tour.name, "Resumen");

  runAutoTable(pdf, autoTable, pageRef, model.tour.name, "Resumen", {
    startY: 40,
    body: [
      ["Fechas", String(model.stats.totalDates)],
      ["Venues", String(model.stats.venueCount)],
      ["Viajes", String(model.stats.travelSegments)],
      ["Documentos", String(model.documents.length)],
      ["Estado", model.tour.status || ""],
    ],
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 38, fontStyle: "bold" } },
  });

  let y = lastY(pdf, 40) + 12;
  y = sectionTitle(pdf, "Cronograma", y);
  runAutoTable(pdf, autoTable, pageRef, model.tour.name, "Resumen", {
    startY: y,
    head: [["Fecha", "Tipo", "Venue / Evento", "Estado"]],
    body: model.dates.map((date, index) => [
      formatDate(date.date),
      date.type || "show",
      date.venueName || date.location?.name || `Dia ${index + 1}`,
      date.health.length ? `${date.health.length} avisos` : "Correcto",
    ]),
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: RED, textColor: [255, 255, 255] },
  });
  footer(pdf, pageRef.value);

  dates.forEach((date) => addDatePage(pdf, autoTable, model, date, pageRef, projection));

  const filename = buildReadableFilename([
    model.tour.name,
    options.dateId ? "day-sheet" : projection === "guest" ? "external-itinerary" : "tour-ops-book",
    options.filenameSuffix,
  ]);
  pdf.save(filename);
}
