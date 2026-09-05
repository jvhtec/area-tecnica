import type { TourOpsDate, TourOpsModel, TourOpsProjection } from "@/features/tour-ops/types";
import { buildReadableFilename } from "@/utils/fileName";
import { loadPdfLibs, type AutoTableFn } from "@/utils/pdf/lazyPdf";
import { fetchTourLogo } from "@/utils/pdf/logoUtils";
import {
  REPORT_ACCENT,
  REPORT_FAINT,
  REPORT_INK,
  REPORT_RULE_WEIGHT,
  REPORT_SOFT,
  distributeColumnWidths,
  drawReportRunningHead,
  drawReportSectionHeading,
  loadReportIssuerMark,
  reportGeometry,
  reportTableDefaults,
  setReportMonoText,
  setReportText,
  stampReportFolios,
  truncateToWidth,
  type ReportChromeOptions,
  type ReportGeometry,
} from "@/utils/pdf/report-system";
import { MADRID_TIMEZONE } from "@/utils/timezoneUtils";
import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";
import type jsPDF from "jspdf";
import type { HookData, UserOptions } from "jspdf-autotable";
import { drawReportFactRows } from "@/utils/pdf/report-system/blocks";

interface AutoTableDoc extends jsPDF {
  lastAutoTable?: { finalY?: number };
}

interface PdfBranding {
  tourLogo?: { dataUrl: string; format: "PNG" | "JPEG" };
}

const lastY = (pdf: jsPDF, fallback: number) => (pdf as AutoTableDoc).lastAutoTable?.finalY ?? fallback;

const PROJECTION_LABELS: Record<TourOpsProjection, string> = {
  guest: "Itinerario externo",
  technician: "Itinerario de equipo",
  management: "Libro de operaciones",
};
const dateOnlyAsMadridNoon = (value: string) => (value.includes("T") ? value : `${value}T12:00:00`);

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(blob);
  });

const loadDataUrl = async (url: string | undefined): Promise<string | null> => {
  if (!url || typeof fetch === "undefined") return null;
  try {
    if (url.startsWith("data:")) return url;
    const response = await fetch(url);
    if (!response.ok) return null;
    return await blobToDataUrl(await response.blob());
  } catch {
    return null;
  }
};

const loadBranding = async (tourId: string): Promise<PdfBranding> => {
  const [tourLogoUrl] = await Promise.all([fetchTourLogo(tourId), loadReportIssuerMark()]);
  const tourLogoData = await loadDataUrl(tourLogoUrl);
  return {
    tourLogo: tourLogoData
      ? { dataUrl: tourLogoData, format: tourLogoData.includes("image/jpeg") || tourLogoData.includes("image/jpg") ? "JPEG" : "PNG" }
      : undefined,
  };
};

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

const roomOccupants = (room: TourOpsDate["accommodations"][number]["roomAllocation"][number]) =>
  [room.staffMember1Name || room.staffMember1Id, room.staffMember2Name || room.staffMember2Id]
    .filter(Boolean)
    .join(" / ");

/**
 * The running head for a page of the book. Every page names the tour and what
 * that page is about, so a sheet handed to one driver still identifies itself.
 */
const chromeFor = (
  model: TourOpsModel,
  projection: TourOpsProjection,
  contextLabel: string,
): ReportChromeOptions => ({
  kind: "tour",
  kindLabel: PROJECTION_LABELS[projection],
  eventTitle: model.tour.name,
  contextLabel,
});

const drawPageChrome = (
  pdf: jsPDF,
  model: TourOpsModel,
  projection: TourOpsProjection,
  contextLabel: string,
): ReportGeometry => drawReportRunningHead(pdf, chromeFor(model, projection, contextLabel));

/**
 * Breaks to a new page when `y` has run past the content area, redrawing the
 * running head so the continuation still says which date it belongs to.
 */
const ensurePage = (
  pdf: jsPDF,
  geo: ReportGeometry,
  y: number,
  model: TourOpsModel,
  projection: TourOpsProjection,
  contextLabel: string,
) => {
  if (y < geo.contentBottom - 24) return y;
  pdf.addPage();
  const pageGeo = drawPageChrome(pdf, model, projection, contextLabel);
  return pageGeo.contentTop;
};

/**
 * Runs a ledger table, drawing the running head on any page the table spills
 * onto. Folios are stamped once at the end, when the length is known.
 */
const runAutoTable = (
  pdf: jsPDF,
  autoTable: AutoTableFn,
  model: TourOpsModel,
  projection: TourOpsProjection,
  contextLabel: string,
  options: UserOptions,
) => {
  const userDidDrawPage = options.didDrawPage;
  let firstPage = true;

  autoTable(pdf, {
    ...options,
    didDrawPage: (data: HookData) => {
      // The page the table starts on already carries its chrome.
      if (firstPage) firstPage = false;
      else drawPageChrome(pdf, model, projection, contextLabel);
      userDidDrawPage?.(data);
    },
  });
};

const addDatePage = (
  pdf: jsPDF,
  autoTable: AutoTableFn,
  model: TourOpsModel,
  tourDate: TourOpsDate,
  projection: TourOpsProjection,
  startOnNewPage = true,
) => {
  if (startOnNewPage) pdf.addPage();

  const dateLabel = formatDate(tourDate.date);
  const venueLabel = tourDate.venueName || tourDate.location?.name || "Fecha de gira";
  const context = `${dateLabel}  ·  ${venueLabel}`;
  const geo = drawPageChrome(pdf, model, projection, context);

  // The date leads the page: whoever is holding it needs to know which day it
  // is before anything else on the sheet means anything.
  setReportMonoText(pdf, REPORT_ACCENT, 6.2, "bold");
  pdf.text(dateLabel.toUpperCase(), geo.left, geo.contentTop, { charSpace: 0.3 * geo.mm });
  setReportText(pdf, REPORT_INK, 17, "bold");
  pdf.text(
    truncateToWidth(pdf, venueLabel, geo.contentWidth),
    geo.left,
    geo.contentTop + 9 * geo.mm,
  );

  let y = drawReportFactRows(pdf, geo, [
    ["Tipo", tourDate.type || "show"],
    ["Recinto", tourDate.venueName || tourDate.location?.name || "Por confirmar"],
    ["Dirección", tourDate.venueAddress || tourDate.location?.formattedAddress || "Por confirmar"],
    ["Trabajo", tourDate.jobTitle || tourDate.jobId || "Sin trabajo vinculado"],
  ], geo.contentTop + 17 * geo.mm);

  y = drawReportSectionHeading(pdf, geo, "Programa", y + 4, 1);
  const programRows = tourDate.program.flatMap((day) =>
    day.rows.map((row) => [day.label || "", row.time || "", row.item || "", row.dept || "", row.notes || ""]),
  );
  runAutoTable(pdf, autoTable, model, projection, context, {
    startY: y,
    head: [["Día", "Hora", "Actividad", "Dpto.", "Notas"]],
    body: programRows.length ? programRows : [["—", "—", "Programa pendiente", "—", ""]],
    ...reportTableDefaults(geo, { fontSize: 6.8, numericColumns: [1] }),
    columnStyles: distributeColumnWidths([20, 16, 52, 18, 54], geo.contentWidth),
  });
  y = lastY(pdf, y) + 10;

  let section = 1;

  if (model.allowedSections.travel) {
    y = ensurePage(pdf, geo, y, model, projection, context);
    section += 1;
    y = drawReportSectionHeading(pdf, geo, "Viajes", y, section);
    const travelRows = [...tourDate.travelIn, ...tourDate.travelOut].map((segment) => [
      segment.fromLabel,
      segment.toLabel,
      segment.transportationType,
      formatDateTime(segment.departureTime),
      formatDateTime(segment.arrivalTime),
      segment.routeNotes || "",
    ]);
    runAutoTable(pdf, autoTable, model, projection, context, {
      startY: y,
      head: [["Origen", "Destino", "Tipo", "Salida", "Llegada", "Notas"]],
      body: travelRows.length ? travelRows : [["—", "—", "—", "—", "—", "Sin viajes definidos"]],
      ...reportTableDefaults(geo, { fontSize: 6.8, numericColumns: [3, 4] }),
      columnStyles: distributeColumnWidths([26, 26, 20, 22, 22, 44], geo.contentWidth),
    });
    y = lastY(pdf, y) + 10;
  }

  if (projection !== "guest") {
    y = ensurePage(pdf, geo, y, model, projection, context);
    section += 1;
    y = drawReportSectionHeading(pdf, geo, "Equipo", y, section);
    runAutoTable(pdf, autoTable, model, projection, context, {
      startY: y,
      head: [["Nombre", "Dpto.", "Rol", "Teléfono"]],
      body: tourDate.crew.length
        ? tourDate.crew.map((member) => [member.name, member.department || "—", member.role || "—", member.phone || "—"])
        : [["—", "—", "Sin equipo confirmado", "—"]],
      ...reportTableDefaults(geo, { fontSize: 7, numericColumns: [3] }),
      columnStyles: distributeColumnWidths([50, 24, 40, 30], geo.contentWidth),
    });
    y = lastY(pdf, y) + 10;
  }

  if (model.allowedSections.accommodations) {
    y = ensurePage(pdf, geo, y, model, projection, context);
    section += 1;
    y = drawReportSectionHeading(pdf, geo, "Alojamiento", y, section);
    runAutoTable(pdf, autoTable, model, projection, context, {
      startY: y,
      head: [["Hotel", "Entrada", "Salida", "Confirmación"]],
      body: tourDate.accommodations.length
        ? tourDate.accommodations.map((hotel) => [
            hotel.hotelName,
            hotel.checkInDate || "—",
            hotel.checkOutDate || "—",
            hotel.confirmationNumber || "—",
          ])
        : [["Sin alojamiento definido", "—", "—", "—"]],
      ...reportTableDefaults(geo, { fontSize: 7, numericColumns: [1, 2, 3] }),
      columnStyles: distributeColumnWidths([56, 24, 24, 36], geo.contentWidth),
    });
    y = lastY(pdf, y) + 10;

    const roomRows = tourDate.accommodations.flatMap((hotel) =>
      hotel.roomAllocation.map((room) => [
        hotel.hotelName,
        room.roomType || "—",
        room.roomNumber || "—",
        roomOccupants(room) || "—",
      ]),
    );
    if (roomRows.length > 0) {
      y = ensurePage(pdf, geo, y, model, projection, context);
      section += 1;
      y = drawReportSectionHeading(pdf, geo, "Rooming", y, section);
      runAutoTable(pdf, autoTable, model, projection, context, {
        startY: y,
        head: [["Hotel", "Tipo", "Hab.", "Ocupantes"]],
        body: roomRows,
        ...reportTableDefaults(geo, { fontSize: 7, numericColumns: [2] }),
        columnStyles: distributeColumnWidths([50, 26, 18, 46], geo.contentWidth),
      });
    }
  }
};

/**
 * The book's cover. No chrome, no folio: the tour's name, what the book is,
 * and the two figures that say how big it is, over paper rather than a slab of
 * ink — this document is printed and carried, often on an office printer.
 */
const drawCover = (
  pdf: jsPDF,
  model: TourOpsModel,
  projection: TourOpsProjection,
  branding: PdfBranding,
) => {
  const geo = reportGeometry(pdf);
  const { mm } = geo;

  if (branding.tourLogo) {
    try {
      pdf.addImage(branding.tourLogo.dataUrl, branding.tourLogo.format, geo.left, 38 * mm, 30 * mm, 24 * mm);
    } catch {
      // Keep the cover readable if logo rendering fails.
    }
  }

  setReportMonoText(pdf, REPORT_ACCENT, 6.4, "bold");
  pdf.text(PROJECTION_LABELS[projection].toUpperCase(), geo.left, 78 * mm, { charSpace: 0.4 * mm });

  setReportText(pdf, REPORT_INK, 30, "bold");
  const titleLines = (pdf.splitTextToSize(model.tour.name, geo.contentWidth) as string[]).slice(0, 3);
  pdf.text(titleLines, geo.left, 92 * mm, { lineHeightFactor: 0.94, charSpace: -0.08 * mm });

  const afterTitle = 92 * mm + titleLines.length * 10.5 * mm;
  pdf.setDrawColor(...REPORT_ACCENT);
  pdf.setLineWidth(REPORT_RULE_WEIGHT * mm);
  pdf.line(geo.left, afterTitle, geo.right, afterTitle);

  setReportMonoText(pdf, REPORT_SOFT, 7, "bold");
  pdf.text(
    `${model.stats.totalDates} FECHAS   ·   ${model.stats.venueCount} RECINTOS   ·   ${model.stats.travelSegments} VIAJES`,
    geo.left,
    afterTitle + 8 * mm,
    { charSpace: 0.25 * mm },
  );

  setReportMonoText(pdf, REPORT_FAINT, 5.8);
  pdf.text(
    `SECTOR-PRO  ·  ${formatInTimeZone(new Date(), MADRID_TIMEZONE, "dd/MM/yyyy")}`,
    geo.left,
    geo.footerTextY,
    { charSpace: 0.2 * mm },
  );
};

export async function generateTourOpsPdf(
  model: TourOpsModel,
  projection: TourOpsProjection,
  options: { dateId?: string; filenameSuffix?: string; action?: "download" | "print" } = {},
) {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const pdf = new jsPDF();
  const dates = options.dateId ? model.dates.filter((date) => date.id === options.dateId) : model.dates;
  const isDaySheet = Boolean(options.dateId);
  const branding = await loadBranding(model.tour.id);

  if (isDaySheet) {
    dates.forEach((date, index) => addDatePage(pdf, autoTable, model, date, projection, index > 0));
    stampReportFolios(pdf);
    const date = dates[0];
    const filename = buildReadableFilename([
      model.tour.name,
      "day-sheet",
      date ? formatDate(date.date) : null,
      date?.venueName,
      options.filenameSuffix,
    ]);
    pdf.save(filename);
    return;
  }

  drawCover(pdf, model, projection, branding);

  pdf.addPage();
  const summaryGeo = drawPageChrome(pdf, model, projection, "Resumen");

  let y = drawReportFactRows(pdf, summaryGeo, [
    ["Fechas", String(model.stats.totalDates)],
    ["Recintos", String(model.stats.venueCount)],
    ["Viajes", String(model.stats.travelSegments)],
    ["Documentos", String(model.documents.length)],
    ["Estado", model.tour.status || "Sin estado"],
  ], summaryGeo.contentTop);

  y = drawReportSectionHeading(pdf, summaryGeo, "Cronograma", y + 4, 1);
  runAutoTable(pdf, autoTable, model, projection, "Resumen", {
    startY: y,
    head: [["Fecha", "Tipo", "Recinto / Evento", "Estado"]],
    body: model.dates.map((date, index) => [
      formatDate(date.date),
      date.type || "show",
      date.venueName || date.location?.name || `Día ${index + 1}`,
      date.health.length ? `${date.health.length} avisos` : "Correcto",
    ]),
    ...reportTableDefaults(summaryGeo, { fontSize: 7 }),
    columnStyles: distributeColumnWidths([34, 20, 62, 26], summaryGeo.contentWidth),
  });

  dates.forEach((date) => addDatePage(pdf, autoTable, model, date, projection));

  // The cover is counted but carries no folio, so every printed number still
  // matches the number anyone counts to.
  stampReportFolios(pdf, { skipPages: [1] });

  const filename = buildReadableFilename([
    model.tour.name,
    options.dateId ? "day-sheet" : projection === "guest" ? "external-itinerary" : "tour-ops-book",
    options.filenameSuffix,
  ]);

  if (options.action === "print" && typeof document !== "undefined") {
    const blob = pdf.output("blob");
    const url = URL.createObjectURL(blob);

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-100vw";
    iframe.style.top = "0";
    iframe.style.width = "100vw";
    iframe.style.height = "100vh";
    iframe.style.border = "0";
    iframe.src = url;
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(() => {
        iframe.remove();
        URL.revokeObjectURL(url);
      }, 60_000);
    };
    document.body.appendChild(iframe);
    return;
  }

  pdf.save(filename);
}
