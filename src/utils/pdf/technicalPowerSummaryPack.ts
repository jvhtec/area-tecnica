import { parseISO } from 'date-fns/parseISO';
import { formatInTimeZone } from 'date-fns-tz';

import { buildReadableFilename } from '@/utils/fileName';
import { getDepartmentLabel } from '@/types/department';
import { getLastAutoTableY } from '@/utils/pdf/exportHelpers';
import { loadPdfLibs } from '@/utils/pdf/lazyPdf';
import {
  REPORT_ACCENT,
  REPORT_INK,
  distributeColumnWidths,
  drawReportMasthead,
  drawReportRunningHead,
  drawReportSectionHeading,
  loadReportIssuerMark,
  reportTableDefaults,
  stampReportFolios,
  type ReportChromeOptions,
  type ReportGeometry,
} from '@/utils/pdf/report-system';
import { drawReportHeadlineFigure, drawReportTotals } from '@/utils/pdf/report-system/blocks';
import { normalizeTechnicalPowerDepartments } from '@/utils/technicalPowerTypes';
import { aggregatePowerCalculations } from '@/features/technical-tools/power/powerAggregation';
import type {
  CombinedTechnicalPowerSummaryData,
  DepartmentPowerSummaryData,
  DepartmentPowerSummaryRow,
  TechnicalPowerDepartment,
} from '@/utils/technicalPowerTypes';
import { buildPowerStagePlot, type StagePlotTable } from '@/utils/powerStagePlot';
import {
  drawPowerStagePlot,
  type StagePlotRgb,
} from '@/utils/pdf/powerStagePlotPdf';

interface GenerateTechnicalPowerSummaryPackInput {
  jobTitle?: string | null;
  jobDate?: string | null;
  jobLocation?: string | null;
  generatedAt?: Date;
  logoUrl?: string;
  includedDepartments?: TechnicalPowerDepartment[];
  summary: CombinedTechnicalPowerSummaryData;
}

const MADRID_TIMEZONE = 'Europe/Madrid';

// Distinct color per department for the combined stage plot (legend on the PDF)
const DEPARTMENT_PLOT_COLORS: Record<TechnicalPowerDepartment, StagePlotRgb> = {
  sound: [37, 99, 235], // blue
  lights: [217, 119, 6], // amber
  video: [5, 150, 105], // green
};

const loadImage = (src?: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    if (!src || typeof Image === 'undefined') {
      resolve(null);
      return;
    }

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });

const parseDateValue = (value?: string | null, fallback = new Date()) => {
  if (!value) return fallback;

  const parsedIso = parseISO(value);
  if (!Number.isNaN(parsedIso.getTime())) {
    return parsedIso;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? fallback : parsedDate;
};

const formatMadridDate = (value: Date) =>
  formatInTimeZone(value, MADRID_TIMEZONE, 'dd/MM/yyyy');

const formatDisplayDate = (value?: string | null, fallback = new Date()) =>
  formatMadridDate(parseDateValue(value, fallback));

const formatWatts = (value: number) => `${value.toFixed(2)} W`;
const formatAmps = (value: number | null) =>
  value === null ? 'No agregable' : `${value.toFixed(2)} A`;
const formatKva = (value: number | null) =>
  value === null ? 'No agregable' : `${value.toFixed(2)} kVA`;

const buildStagePlotGroupKey = (
  stageNumber?: number | null,
  stageName?: string | null,
) => {
  if (stageNumber != null) return `stage-${stageNumber}`;

  const normalizedName = stageName?.trim().toLowerCase();
  if (!normalizedName) return 'general';

  return `stage-name-${encodeURIComponent(normalizedName)}`;
};

const departmentTableBody = (department: DepartmentPowerSummaryData) =>
  department.rows.length > 0
    ? department.rows.map((row) => [
        row.stageName || (row.stageNumber != null ? `Escenario ${row.stageNumber}` : '—'),
        row.name,
        row.pduLabel || '—',
        row.positionLabel || '—',
        formatWatts(row.totalWatts),
        formatAmps(row.currentPerPhase),
        row.notes || '',
      ])
    : [['—', 'Sin datos guardados', '—', '—', formatWatts(0), formatAmps(0), '']];

export const buildTechnicalPowerSummaryPackFilename = (
  jobTitle?: string | null
) =>
  buildReadableFilename(
    ['Resumen Potencia Tecnica', jobTitle || 'Trabajo'],
    'pdf'
  );

export const generateTechnicalPowerSummaryPack = async ({
  jobTitle,
  jobDate,
  jobLocation,
  generatedAt = new Date(),
  logoUrl,
  includedDepartments,
  summary,
}: GenerateTechnicalPowerSummaryPackInput): Promise<Blob> => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const [headerLogo] = await Promise.all([loadImage(logoUrl), loadReportIssuerMark()]);

  const doc = new jsPDF();
  const displayDate = formatDisplayDate(jobDate, generatedAt);
  const createdDate = formatMadridDate(generatedAt);
  const departmentsToInclude = (
    normalizeTechnicalPowerDepartments(includedDepartments || []).length > 0
      ? normalizeTechnicalPowerDepartments(includedDepartments || [])
      : Object.values(summary.departments)
          .filter((department) => department.rows.length > 0)
          .map((department) => department.department)
  ).map((department) => summary.departments[department]);

  const includedDepartmentLabels = departmentsToInclude.map((department) =>
    getDepartmentLabel(department.department)
  );
  const systemAggregation = aggregatePowerCalculations(
    departmentsToInclude.flatMap((department) => department.rows),
  );
  const totalSystemWatts = systemAggregation.totalWatts;
  const totalSystemAmps = systemAggregation.currentLine;
  const totalSystemKva =
    systemAggregation.totalVa === null ? null : systemAggregation.totalVa / 1000;

  const chrome: ReportChromeOptions = {
    kind: 'power',
    kindLabel: 'Resumen técnico de potencia',
    eventTitle: jobTitle || 'Trabajo sin título',
    contextLabel: displayDate,
  };

  const { geo, y: contentTop } = drawReportMasthead(doc, {
    ...chrome,
    title: jobTitle || 'Trabajo sin título',
    subtitle: `Resumen técnico de potencia · ${jobLocation || 'Sin ubicación'}`,
    clientLogo: headerLogo,
    meta: [
      { label: 'Fecha del trabajo', value: displayDate },
      { label: 'Departamentos', value: String(departmentsToInclude.length) },
      { label: 'Emisión', value: createdDate },
    ],
  });

  // The two figures the whole pack exists to state, side by side, above
  // everything the reader would otherwise have to add up themselves.
  const halfWidth = (geo.contentWidth - 8 * geo.mm) / 2;
  drawReportHeadlineFigure(doc, geo, contentTop, {
    label: 'Corriente de línea resultante',
    value: formatAmps(totalSystemAmps),
    width: halfWidth,
  });
  let y = drawReportHeadlineFigure(doc, geo, contentTop, {
    label: 'Potencia total',
    value: formatWatts(totalSystemWatts),
    support: systemAggregation.reason || undefined,
    x: geo.left + halfWidth + 8 * geo.mm,
    width: halfWidth,
  });

  y = drawReportSectionHeading(doc, geo, 'Totales del sistema', y + 6, 1);
  drawReportTotals(doc, geo, y, {
    lines: [
      { label: 'Potencia total', value: formatWatts(totalSystemWatts) },
      { label: 'Potencia aparente total', value: formatKva(totalSystemKva) },
      {
        label: 'Departamentos incluidos',
        value: includedDepartmentLabels.length > 0 ? includedDepartmentLabels.join(', ') : 'Sin datos',
      },
    ],
    total: { label: 'Corriente de línea resultante', value: formatAmps(totalSystemAmps) },
  });

  // Combined stage plot(s): every department's tables on one drawing,
  // color-coded by department, one plot per stage when the job uses stages.
  const plotTables: Array<StagePlotTable & { stageKey: string; stageLabel: string }> =
    departmentsToInclude.flatMap((department) =>
      department.rows.map((row: DepartmentPowerSummaryRow) => ({
        name: row.name,
        position:
          row.positionLabel && row.positionLabel !== 'N/A'
            ? row.positionLabel
            : undefined,
        pduType: row.pduLabel && row.pduLabel !== 'N/A' ? row.pduLabel : '',
        department: department.department,
        stageKey: buildStagePlotGroupKey(row.stageNumber, row.stageName),
        stageLabel:
          row.stageName?.trim() ||
          (row.stageNumber != null ? `Escenario ${row.stageNumber}` : ''),
      }))
    );

  const stageGroups = new Map<string, { label: string; tables: StagePlotTable[] }>();
  plotTables.forEach((table) => {
    const group = stageGroups.get(table.stageKey) || { label: table.stageLabel, tables: [] };
    group.tables.push(table);
    stageGroups.set(table.stageKey, group);
  });

  const legend = departmentsToInclude.map((department) => ({
    label: getDepartmentLabel(department.department),
    color: DEPARTMENT_PLOT_COLORS[department.department],
  }));
  const entryColorFor = (entry: { department?: string }) =>
    DEPARTMENT_PLOT_COLORS[entry.department as TechnicalPowerDepartment] ??
    (REPORT_ACCENT as StagePlotRgb);

  stageGroups.forEach((group) => {
    const plot = buildPowerStagePlot(group.tables);
    if (!plot.hasPositionedEntries) return;

    const title = group.label
      ? `Distribución en escenario · ${group.label}`
      : 'Distribución en escenario';

    doc.addPage();
    const plotGeo: ReportGeometry = drawReportRunningHead(doc, {
      ...chrome,
      contextLabel: title,
    });
    drawPowerStagePlot(doc, plot, {
      startY: plotGeo.contentTop,
      pageWidth: plotGeo.pageWidth,
      pageHeight: plotGeo.pageHeight,
      footerSpace: plotGeo.pageHeight - plotGeo.contentBottom,
      pageBreakY: plotGeo.contentTop,
      contentLeft: plotGeo.left,
      contentRight: plotGeo.pageWidth - plotGeo.right,
      titleColor: REPORT_INK,
      title,
      entryColorFor,
      legend,
    });
  });

  departmentsToInclude.forEach((department, index) => {
    const departmentName = getDepartmentLabel(department.department);
    const context = `${departmentName} · Cuadros y márgenes`;

    doc.addPage();
    const pageGeo: ReportGeometry = drawReportRunningHead(doc, { ...chrome, contextLabel: context });
    const headingY = drawReportSectionHeading(
      doc,
      pageGeo,
      departmentName,
      pageGeo.contentTop,
      index + 2,
    );

    autoTable(doc, {
      startY: headingY,
      head: [['Escenario', 'Cuadro', 'PDU', 'Posición', 'Potencia', 'Corriente', 'Notas']],
      body: departmentTableBody(department),
      ...reportTableDefaults(pageGeo, { fontSize: 7, numericColumns: [4, 5] }),
      columnStyles: distributeColumnWidths([20, 34, 20, 22, 22, 22, 34], pageGeo.contentWidth),
      didDrawPage: (hook) => {
        if (hook.pageNumber > 1) {
          drawReportRunningHead(doc, { ...chrome, contextLabel: context });
        }
      },
    });

    const totalsY = getLastAutoTableY(doc, headingY) + 12;
    drawReportTotals(doc, pageGeo, totalsY, {
      heading: `Totales · ${departmentName}`,
      lines: [
        { label: 'Potencia total', value: formatWatts(department.totalWatts) },
        { label: 'Potencia aparente total', value: formatKva(department.totalKva) },
        ...(department.aggregationReason
          ? [{ label: 'Nota', value: department.aggregationReason }]
          : []),
      ],
      total: {
        label: 'Corriente de línea resultante',
        value: formatAmps(department.totalAmps),
      },
    });
  });

  doc.addPage();
  const comparisonContext = 'Totales comparativos';
  const comparisonGeo: ReportGeometry = drawReportRunningHead(doc, {
    ...chrome,
    contextLabel: comparisonContext,
  });
  const comparisonY = drawReportSectionHeading(
    doc,
    comparisonGeo,
    'Totales comparativos',
    comparisonGeo.contentTop,
    departmentsToInclude.length + 2,
  );

  autoTable(doc, {
    startY: comparisonY,
    head: [['Departamento', 'Potencia total', 'Corriente de línea', 'Potencia aparente']],
    body: departmentsToInclude.map((department) => [
      getDepartmentLabel(department.department),
      formatWatts(department.totalWatts),
      formatAmps(department.totalAmps),
      formatKva(department.totalKva),
    ]),
    ...reportTableDefaults(comparisonGeo, { fontSize: 7.6, numericColumns: [1, 2, 3] }),
    columnStyles: distributeColumnWidths([40, 26, 26, 26], comparisonGeo.contentWidth),
    didDrawPage: (hook) => {
      if (hook.pageNumber > 1) {
        drawReportRunningHead(doc, { ...chrome, contextLabel: comparisonContext });
      }
    },
  });

  drawReportTotals(doc, comparisonGeo, getLastAutoTableY(doc, comparisonY) + 12, {
    heading: 'Total del sistema',
    lines: [
      { label: 'Potencia total', value: formatWatts(totalSystemWatts) },
      { label: 'Potencia aparente total', value: formatKva(totalSystemKva) },
      ...(systemAggregation.reason ? [{ label: 'Nota', value: systemAggregation.reason }] : []),
    ],
    total: { label: 'Corriente de línea resultante', value: formatAmps(totalSystemAmps) },
  });

  stampReportFolios(doc);

  return doc.output('blob');
};
