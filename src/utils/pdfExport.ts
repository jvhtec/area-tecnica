import { loadPdfLibs } from '@/utils/pdf/lazyPdf';
import {
  REPORT_ACCENT,
  REPORT_INK,
  REPORT_SOFT,
  distributeColumnWidths,
  drawReportMasthead,
  drawReportRunningHead,
  drawReportSectionHeading,
  loadReportIssuerMark,
  reportTableDefaults,
  setReportMonoText,
  stampReportFolios,
  type ReportChromeOptions,
  type ReportGeometry,
} from '@/utils/pdf/report-system';
import { drawReportEntryHeading, drawReportTotals } from '@/utils/pdf/report-system/blocks';
import { getLastAutoTableY } from '@/utils/pdf/exportHelpers';
import { loadImageWithTimeout } from '@/utils/pdf/shared/pdfExportShared';
import type {
  PowerCalculationSnapshot,
} from '@/features/technical-tools/power/types';
import { exportTechnicalDataReportPdf } from '@/utils/pdf/technicalDataReportPdf';

export interface ExportTableRow {
  quantity?: string;
  lineName?: string;
  componentName?: string;
  weight?: string;
  watts?: string;
  totalWeight?: number;
  totalWatts?: number;
  pf?: string;
  // rigging-specific
  x?: number; // position in meters
  reactionKg?: number;
  hoistName?: string;
}

export interface ExportTable {
  name: string;
  rows: ExportTableRow[];
  totalWeight?: number;
  dualMotors?: boolean;
  totalWatts?: number;
  adjustedWatts?: number;
  totalVa?: number;            // apparent power (VA)
  currentPerPhase?: number;   // line current (per-phase if 3φ, single-line if 1φ)
  phaseMode?: 'single' | 'three';
  calculation?: PowerCalculationSnapshot;
  toolType?: 'pesos' | 'consumos' | 'rigging';
  pduType?: string;
  customPduType?: string;
  position?: string;
  customPosition?: string;
  includesHoist?: boolean;
  riggingPoint?: string;
  // rigging summary fields
  maxMomentNm?: number;
  maxDeflectionMm?: number;
  okMoment?: boolean;
  okDefl?: boolean;
  cablePick?: boolean;
}

export interface PowerPdfSummary {
  totalSystemWatts: number;
  adjustedSystemWatts?: number;
  totalSystemAmps: number | null;
  totalSystemKva?: number | null;
  aggregationReason?: string;
}

export interface SummaryRow {
  clusterName: string;
  riggingPoints: string;
  clusterWeight: number;
}

export const exportToPDF = async (
  projectName: string,
  tables: ExportTable[],
  type: 'weight' | 'power' | 'rigging',
  jobName: string,
  jobDate: string,
  summaryRows?: SummaryRow[],
  powerSummary?: PowerPdfSummary,
  safetyMargin?: number,
  customLogoUrl?: string,
  fohSchukoRequired?: boolean
): Promise<Blob> => {
  if (['power', 'weight'].includes(type)) {
    return exportTechnicalDataReportPdf({
      customLogoUrl,
      fohSchukoRequired,
      jobDate,
      jobName,
      powerSummary,
      projectName,
      safetyMargin,
      summaryRows,
      tables,
      type: type as 'power' | 'weight',
    });
  }

  // Only the rigging report is rendered here; power and weight are produced by
  // the technical data report above.
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF();

  const [clientLogo] = await Promise.all([
    customLogoUrl ? loadImageWithTimeout(customLogoUrl, 'logotipo del cliente') : Promise.resolve(null),
    loadReportIssuerMark(),
  ]);

  const jobDateStr = (() => {
    const parsed = new Date(jobDate);
    if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleDateString('es-ES');
    const fallback = jobDate.includes('-') ? new Date(`${jobDate}T00:00:00`) : new Date();
    return Number.isNaN(fallback.getTime())
      ? new Date().toLocaleDateString('es-ES')
      : fallback.toLocaleDateString('es-ES');
  })();

  const riggingTables = tables.filter((table) => table.toolType === 'rigging');
  const chrome: ReportChromeOptions = {
    kind: 'rigging',
    kindLabel: 'Informe de rigging',
    eventTitle: jobName || projectName,
    contextLabel: jobDateStr,
  };

  const { geo, y: contentTop } = drawReportMasthead(doc, {
    ...chrome,
    title: jobName?.trim() || projectName?.trim() || 'Trabajo sin título',
    subtitle: `Informe de rigging · ${projectName || 'Sin proyecto'}`,
    clientLogo,
    meta: [
      { label: 'Fecha del trabajo', value: jobDateStr },
      { label: 'Trusses', value: String(riggingTables.length || tables.length) },
      { label: 'Emisión', value: new Date().toLocaleDateString('es-ES') },
    ],
  });

  const breakIfShort = (y: number, needed: number): number => {
    if (y <= geo.contentBottom - needed) return y;
    doc.addPage();
    const pageGeo: ReportGeometry = drawReportRunningHead(doc, chrome);
    return pageGeo.contentTop;
  };

  let yPosition = contentTop;

  tables.forEach((table, index) => {
    yPosition = breakIfShort(yPosition, 40);
    yPosition = drawReportEntryHeading(
      doc,
      geo,
      table.name,
      yPosition,
      table.totalWeight ? `${table.totalWeight.toFixed(0)} KG` : undefined,
    );

    const fixtureRows = table.rows
      .filter((row) => row.componentName && (row.weight !== undefined || row.x !== undefined))
      .map((row) => [
        row.quantity ?? '',
        row.componentName ?? '',
        row.weight ?? '',
        row.x !== undefined ? `${Number(row.x).toFixed(2)} m` : '—',
      ]);

    if (fixtureRows.length > 0) {
      autoTable(doc, {
        head: [['Cantidad', 'Componente', 'Peso (kg)', 'Posición']],
        body: fixtureRows,
        startY: yPosition,
        ...reportTableDefaults(geo, { fontSize: 7.2, numericColumns: [0, 2, 3] }),
        columnStyles: distributeColumnWidths([16, 60, 22, 22], geo.contentWidth),
        didDrawPage: (hook) => {
          if (hook.pageNumber > 1) drawReportRunningHead(doc, chrome);
        },
      });
      yPosition = getLastAutoTableY(doc, yPosition) + 8;
    }

    const supportRows = table.rows
      .filter((row) => row.reactionKg !== undefined)
      .map((row) => [
        row.componentName ?? '',
        row.reactionKg !== undefined ? Number(row.reactionKg).toFixed(0) : '',
        row.hoistName ?? '—',
      ]);

    if (supportRows.length > 0) {
      yPosition = breakIfShort(yPosition, 30);
      autoTable(doc, {
        head: [['Punto de montaje', 'Reacción (kg)', 'Motor sugerido']],
        body: supportRows,
        startY: yPosition,
        ...reportTableDefaults(geo, { fontSize: 7.2, numericColumns: [1] }),
        columnStyles: distributeColumnWidths([56, 26, 38], geo.contentWidth),
        didDrawPage: (hook) => {
          if (hook.pageNumber > 1) drawReportRunningHead(doc, chrome);
        },
      });
      yPosition = getLastAutoTableY(doc, yPosition) + 8;
    }

    if (table.maxMomentNm !== undefined || table.maxDeflectionMm !== undefined) {
      yPosition = breakIfShort(yPosition, 20);

      // A structural check that fails is the finding on this page, so it is the
      // one thing set in the accent.
      const drawCheck = (label: string, value: string, passed: boolean | undefined) => {
        setReportMonoText(doc, REPORT_SOFT, 5.8, 'bold');
        doc.text(label.toUpperCase(), geo.left, yPosition, { charSpace: 0.2 * geo.mm });
        setReportMonoText(doc, passed === false ? REPORT_ACCENT : REPORT_INK, 7.4, 'bold');
        doc.text(value, geo.right, yPosition, { align: 'right' });
        yPosition += 5 * geo.mm;
      };

      const verdict = (passed: boolean | undefined) =>
        passed === true ? 'OK' : passed === false ? 'FALLA' : 'NO VALIDADO';

      if (table.maxMomentNm !== undefined) {
        drawCheck(
          'Momento máximo',
          `${Number(table.maxMomentNm).toFixed(0)} N·m · ${verdict(table.okMoment)}`,
          table.okMoment,
        );
      }
      if (table.maxDeflectionMm !== undefined) {
        drawCheck(
          'Deflexión máxima',
          `${Number(table.maxDeflectionMm).toFixed(1)} mm · ${verdict(table.okDefl)}`,
          table.okDefl,
        );
      }
      yPosition += 2;
    }

    if (table.cablePick) {
      setReportMonoText(doc, REPORT_SOFT, 5.8);
      doc.text('INCLUYE CABLE PICK', geo.left, yPosition, { charSpace: 0.2 * geo.mm });
      yPosition += 6;
    }

    if (index < tables.length - 1) yPosition += 4;
  });

  const riggingSummaryRows: SummaryRow[] = riggingTables.map((table) => ({
    clusterName: table.name,
    riggingPoints: String(table.rows.filter((row) => row.reactionKg !== undefined).length),
    clusterWeight: table.totalWeight || 0,
  }));
  const finalSummaryRows =
    summaryRows && summaryRows.length > 0 ? summaryRows : riggingSummaryRows;

  if (finalSummaryRows.length > 0) {
    doc.addPage();
    const summaryGeo: ReportGeometry = drawReportRunningHead(doc, chrome);
    const summaryY = drawReportSectionHeading(
      doc,
      summaryGeo,
      'Resumen de rigging',
      summaryGeo.contentTop,
      1,
    );

    autoTable(doc, {
      head: [['Truss', 'Motores', 'Peso total (kg)']],
      body: finalSummaryRows.map((row) => [
        row.clusterName,
        row.riggingPoints,
        row.clusterWeight.toFixed(2),
      ]),
      startY: summaryY,
      ...reportTableDefaults(summaryGeo, { fontSize: 7.6, numericColumns: [1, 2] }),
      columnStyles: distributeColumnWidths([64, 24, 32], summaryGeo.contentWidth),
      didDrawPage: (hook) => {
        if (hook.pageNumber > 1) drawReportRunningHead(doc, chrome);
      },
    });

    const totalMotors = finalSummaryRows.reduce(
      (sum, row) => sum + (Number.parseInt(row.riggingPoints, 10) || 0),
      0,
    );
    const totalWeight = finalSummaryRows.reduce((sum, row) => sum + row.clusterWeight, 0);

    drawReportTotals(doc, summaryGeo, getLastAutoTableY(doc, summaryY) + 12, {
      lines: [
        { label: 'Trusses', value: String(finalSummaryRows.length) },
        { label: 'Motores', value: String(totalMotors) },
      ],
      total: { label: 'Peso total', value: `${totalWeight.toFixed(2)} kg` },
    });
  }

  stampReportFolios(doc);

  return doc.output('blob');
};
