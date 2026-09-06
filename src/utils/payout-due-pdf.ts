import { es } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";

import { buildPayoutDuePdfFilename } from "@/utils/pdfFileNames";
import { getLastAutoTableY } from "@/utils/pdf/exportHelpers";
import { loadPdfLibs } from "@/utils/pdf/lazyPdf";
import {
  distributeColumnWidths,
  drawReportMasthead,
  ensureReportSpace,
  loadReportIssuerMark,
  reportTableDefaults,
  stampReportChrome,
  type ReportChromeOptions,
} from "@/utils/pdf/report-system";
import { drawReportTotals } from "@/utils/pdf/report-system/blocks";

const MADRID_TIMEZONE = "Europe/Madrid";

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
  await loadReportIssuerMark();

  const period = `${formatLongDate(paymentFrom)} – ${formatLongDate(paymentTo)}`;
  const chrome: ReportChromeOptions = {
    kind: 'payout',
    kindLabel: 'Pagos previstos',
    eventTitle: 'Pagos previstos',
    contextLabel: period,
  };

  const { geo, y: contentTop } = drawReportMasthead(doc, {
    ...chrome,
    title: 'Pagos previstos',
    subtitle: `A pagar entre ${formatLongDate(paymentFrom)} y ${formatLongDate(paymentTo)}`,
    meta: [
      { label: 'Líneas', value: String(rows.length) },
      { label: 'Total del bloque', value: formatCurrency(totalEur) },
      { label: 'Generado', value: formatTimestamp(new Date()) },
    ],
  });

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
    startY: contentTop,
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
    ...reportTableDefaults(geo, { fontSize: 6.6, numericColumns: [7] }),
    columnStyles: distributeColumnWidths([22, 14, 11, 17, 18, 28, 20, 14], geo.contentWidth),
  });

  const totalsY = ensureReportSpace(doc, geo, getLastAutoTableY(doc, contentTop) + 10, 26);
  drawReportTotals(doc, geo, totalsY, {
    lines: [{ label: 'Líneas', value: String(rows.length) }],
    total: { label: 'Total del bloque', value: formatCurrency(totalEur) },
  });

  stampReportChrome(doc, chrome);

  const fileName = buildPayoutDuePdfFilename(paymentFrom, paymentTo);
  doc.save(fileName);
}
