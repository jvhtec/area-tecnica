import { es } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";

import { loadPdfLibs } from "@/utils/pdf/lazyPdf";
import { getCompanyLogo } from "@/utils/pdf/logoUtils";

const MADRID_TIMEZONE = "Europe/Madrid";
const CORPORATE_RED: [number, number, number] = [125, 1, 1];
const TEXT_MUTED: [number, number, number] = [100, 116, 139];

export interface PayoutDuePdfRow {
  jobId: string;
  technicianName: string;
  department: string | null;
  isHouseTech: boolean;
  isAutonomo: boolean | null;
  invoiceReceivedAt: string | null;
  jobDate: Date | null;
  jobTitle: string;
  estimateText: string;
  totalEur: number;
}

export interface DownloadPayoutDueGroupPdfOptions {
  paymentFrom: Date;
  paymentTo: Date;
  totalEur: number;
  rows: PayoutDuePdfRow[];
}

const formatLongDate = (date: Date): string =>
  formatInTimeZone(date, MADRID_TIMEZONE, "d 'de' MMMM 'de' yyyy", { locale: es });

const formatTimestamp = (date: Date): string =>
  formatInTimeZone(date, MADRID_TIMEZONE, "dd/MM/yyyy HH:mm");

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const sanitizeFileName = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

const formatAutonomoForPdf = (isHouseTech: boolean, isAutonomo: boolean | null): string => {
  if (isHouseTech) return "Empleado";
  if (isAutonomo === null) return "—";
  return isAutonomo ? "Sí" : "No";
};

const isInvoiceApplicableForPdf = (isHouseTech: boolean, isAutonomo: boolean | null): boolean =>
  !isHouseTech && isAutonomo === true;

export async function downloadPayoutDueGroupPdf({
  paymentFrom,
  paymentTo,
  totalEur,
  rows,
}: DownloadPayoutDueGroupPdfOptions): Promise<void> {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const companyLogo = await getCompanyLogo();

  doc.setFillColor(...CORPORATE_RED);
  doc.rect(0, 0, pageWidth, 40, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Pagos previstos", pageWidth / 2, 18, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(
    `A pagar entre ${formatLongDate(paymentFrom)} y ${formatLongDate(paymentTo)}`,
    pageWidth / 2,
    28,
    { align: "center" }
  );
  doc.setFontSize(9);
  doc.text(`Generado: ${formatTimestamp(new Date())}`, pageWidth - 14, 36, { align: "right" });

  doc.setTextColor(31, 41, 55);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Total del bloque: ${formatCurrency(totalEur)}`, 14, 52);
  doc.setFont("helvetica", "normal");
  doc.text(`Filas: ${rows.length}`, pageWidth - 14, 52, { align: "right" });

  const tableBody = rows.map((row) => [
    row.technicianName,
    row.department || "—",
    formatAutonomoForPdf(row.isHouseTech, row.isAutonomo),
    !isInvoiceApplicableForPdf(row.isHouseTech, row.isAutonomo)
      ? "No aplica"
      : row.invoiceReceivedAt
      ? `Sí (${formatInTimeZone(row.invoiceReceivedAt, MADRID_TIMEZONE, "dd/MM/yyyy")})`
      : "No",
    row.jobDate ? formatLongDate(row.jobDate) : "Fecha desconocida",
    row.jobTitle,
    row.estimateText,
    formatCurrency(row.totalEur),
  ]);

  autoTable(doc, {
    startY: 58,
    head: [[
      "Técnico",
      "Departamento",
      "Autónomo",
      "Factura",
      "Fecha del evento",
      "Evento",
      "Estimación",
      "Total",
    ]],
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: CORPORATE_RED,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: [51, 51, 51],
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 16 },
      2: { cellWidth: 14 },
      3: { cellWidth: 20 },
      4: { cellWidth: 20 },
      5: { cellWidth: 32 },
      6: { cellWidth: 22 },
      7: { cellWidth: 16, halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber);
    const footerY = pageHeight - 12;

    if (companyLogo) {
      try {
        const ratio = companyLogo.width && companyLogo.height ? companyLogo.width / companyLogo.height : 1;
        const logoHeight = 10;
        const logoWidth = logoHeight * ratio;
        const logoX = (pageWidth - logoWidth) / 2;
        doc.addImage(companyLogo, "PNG", logoX, footerY - logoHeight - 2, logoWidth, logoHeight);
      } catch {
        // Ignore footer logo errors.
      }
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text("Sector-Pro", 14, footerY);
    doc.text(`Página ${pageNumber} de ${pageCount}`, pageWidth - 14, footerY, { align: "right" });
  }

  const fromSlug = formatInTimeZone(paymentFrom, MADRID_TIMEZONE, "yyyyMMdd");
  const toSlug = formatInTimeZone(paymentTo, MADRID_TIMEZONE, "yyyyMMdd");
  const fileName = sanitizeFileName(`pagos_previstos_${fromSlug}_${toSlug}.pdf`) || "pagos_previstos.pdf";
  doc.save(fileName);
}
