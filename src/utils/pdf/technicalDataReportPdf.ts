import type jsPDF from "jspdf";

import { buildPowerStagePlot } from "@/utils/powerStagePlot";
import { loadPdfLibs, type AutoTableFn } from "@/utils/pdf/lazyPdf";
import { getCompanyLogo } from "@/utils/pdf/logoUtils";
import { registerPdfUnicodeFont } from "@/utils/pdf/pdfUnicodeFont";
import { drawPowerStagePlot } from "@/utils/pdf/powerStagePlotPdf";
import {
  REPORT_COLORS,
  REPORT_PAGE,
  drawBasisGrid,
  drawMetaGrid,
  drawNotice,
  drawPowerHeadline,
  drawReportChrome,
  drawSectionHeading,
  drawTitleBlock,
  drawWeightHeadline,
  ensureReportSpace,
  type ReportMetaItem,
} from "@/utils/pdf/technicalDataReportLayout";
import {
  buildPowerReportSummary,
  buildWeightPointSummaries,
  formatTechnicalReportDate,
  formatTechnicalReportNumber,
  type PowerCircuitSummary,
  type TechnicalReportKind,
} from "@/utils/pdf/technicalDataReportModel";
import type {
  ExportTable,
  PowerPdfSummary,
  SummaryRow,
} from "@/utils/pdfExport";

type TechnicalReportInput = {
  customLogoUrl?: string;
  fohSchukoRequired?: boolean;
  jobDate: string;
  jobName: string;
  powerSummary?: PowerPdfSummary;
  projectName: string;
  safetyMargin?: number;
  summaryRows?: SummaryRow[];
  tables: ExportTable[];
  type: TechnicalReportKind;
};

type PdfWithLastTable = jsPDF & {
  lastAutoTable?: { finalY?: number };
};

const NBSP = "\u00A0";

const loadImage = (src?: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    if (!src || typeof Image === "undefined") {
      resolve(null);
      return;
    }
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });

const loadSectorProLogo = async () =>
  (await loadImage("/sector%20pro%20logo.png")) ?? getCompanyLogo();

const tableEndY = (doc: jsPDF, fallback: number) =>
  (doc as PdfWithLastTable).lastAutoTable?.finalY ?? fallback;

const formatParsedNumber = (
  value: string | number | undefined,
  digits: number,
) => {
  if (value === undefined || value === "") return "—";
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed)
    ? formatTechnicalReportNumber(parsed, digits)
    : String(value);
};

const tableStyles = (fontFamily: string) => ({
  alternateRowStyles: { fillColor: [249, 247, 243] as [number, number, number] },
  bodyStyles: { textColor: [...REPORT_COLORS.ink] as [number, number, number] },
  footStyles: {
    fillColor: [255, 255, 255] as [number, number, number],
    fontStyle: "bold" as const,
    lineColor: [...REPORT_COLORS.ink] as [number, number, number],
    lineWidth: { top: 0.35 },
    textColor: [...REPORT_COLORS.ink] as [number, number, number],
  },
  headStyles: {
    fillColor: [255, 255, 255] as [number, number, number],
    fontStyle: "bold" as const,
    lineColor: [...REPORT_COLORS.rule] as [number, number, number],
    lineWidth: { bottom: 0.35 },
    textColor: [...REPORT_COLORS.soft] as [number, number, number],
  },
  margin: {
    bottom: REPORT_PAGE.height - REPORT_PAGE.bottom + 4,
    left: REPORT_PAGE.left,
    right: REPORT_PAGE.width - REPORT_PAGE.right,
    top: REPORT_PAGE.contentTop,
  },
  showHead: "everyPage" as const,
  styles: {
    cellPadding: { bottom: 2.2, left: 1.5, right: 1.5, top: 2.2 },
    font: fontFamily,
    fontSize: 7.2,
    lineColor: [...REPORT_COLORS.rule] as [number, number, number],
    lineWidth: { bottom: 0.18 },
    overflow: "linebreak" as const,
  },
  theme: "plain" as const,
});

const drawOverviewTable = ({
  autoTable,
  doc,
  fontFamily,
  powerCircuits,
  startY,
  type,
  weightRows,
}: {
  autoTable: AutoTableFn;
  doc: jsPDF;
  fontFamily: string;
  powerCircuits: PowerCircuitSummary[];
  startY: number;
  type: TechnicalReportKind;
  weightRows: ReturnType<typeof buildWeightPointSummaries>;
}) => {
  if (type === "power") {
    const body = powerCircuits.length
      ? powerCircuits.map((circuit) => [
          circuit.name,
          circuit.pduLabel,
          circuit.positionLabel,
          `${formatTechnicalReportNumber(circuit.adjustedWatts / 1000, 2)}${NBSP}kW`,
          circuit.currentLine === null
            ? "No agregable"
            : `${formatTechnicalReportNumber(circuit.currentLine, 2)}${NBSP}A`,
        ])
      : [["Sin circuitos guardados", "—", "—", "0,00 kW", "—"]];
    autoTable(doc, {
      ...tableStyles(fontFamily),
      body,
      columnStyles: {
        3: { halign: "right" },
        4: { halign: "right" },
      },
      head: [["Circuito", "PDU", "Posición", "Potencia", "Corriente"]],
      startY,
    });
  } else {
    const body = weightRows.length
      ? weightRows.map((row) => [
          row.name,
          row.motorCount,
          `${formatTechnicalReportNumber(row.totalWeight, 1)}${NBSP}kg`,
        ])
      : [["Sin puntos guardados", "—", "0,0 kg"]];
    autoTable(doc, {
      ...tableStyles(fontFamily),
      body,
      columnStyles: {
        1: { halign: "center" },
        2: { halign: "right" },
      },
      head: [["Punto / conjunto", "Motores", "Peso total"]],
      startY,
    });
  }
  return tableEndY(doc, startY) + 8;
};

const powerFactorLabel = (circuit: ExportTable["calculation"]) => {
  if (!circuit) return "No reproducible";
  if (circuit.powerFactorSource === "per-row") return "Vectorial por componente";
  if (circuit.powerFactor === undefined) return "No disponible";
  return formatTechnicalReportNumber(circuit.powerFactor, 2);
};

const buildPowerBasis = (
  tables: ExportTable[],
  circuits: PowerCircuitSummary[],
): ReportMetaItem[] => {
  const phaseLabels = new Set(
    tables.map((table) =>
      table.calculation?.phaseMode === "three"
        ? "Trifásico equilibrado"
        : table.calculation?.phaseMode === "single"
          ? "Monofásico"
          : "No identificado"),
  );
  const voltages = new Set(
    tables
      .map((table) => table.calculation?.voltage)
      .filter((value): value is number => value !== undefined),
  );
  const margins = new Set(
    circuits
      .map((circuit) => circuit.margin)
      .filter((value): value is number => value !== null),
  );
  const powerFactors = new Set(
    tables.map((table) => powerFactorLabel(table.calculation)),
  );
  return [
    {
      label: "Tensión de referencia",
      value:
        voltages.size === 1
          ? `${formatTechnicalReportNumber([...voltages][0], 0)} V`
          : voltages.size > 1
            ? "Varias"
            : "No disponible",
    },
    {
      label: "Sistema",
      value: phaseLabels.size === 1 ? [...phaseLabels][0] : "Varios",
    },
    {
      label: "Factor de potencia",
      value: powerFactors.size === 1 ? [...powerFactors][0] : "Por circuito",
    },
    {
      label: "Margen de seguridad",
      value:
        margins.size === 1
          ? `${formatTechnicalReportNumber([...margins][0], 0)} %`
          : margins.size > 1
            ? "Por circuito"
            : "No disponible",
    },
  ];
};

const detailHeaders = (table: ExportTable, type: TechnicalReportKind) => {
  const hasLineNames =
    type === "power" && table.rows.some((row) => row.lineName?.trim());
  const hasPowerFactors =
    type === "power" && table.rows.some((row) => row.pf?.trim());
  if (type === "weight") {
    return ["Cant.", "Componente", "kg / unidad", "kg totales"];
  }
  return [
    "Cant.",
    ...(hasLineNames ? ["Línea"] : []),
    "Componente",
    "W / unidad",
    ...(hasPowerFactors ? ["FP"] : []),
    "W totales",
  ];
};

const detailRows = (table: ExportTable, type: TechnicalReportKind) => {
  const hasLineNames =
    type === "power" && table.rows.some((row) => row.lineName?.trim());
  const hasPowerFactors =
    type === "power" && table.rows.some((row) => row.pf?.trim());
  return table.rows.map((row) => {
    if (type === "weight") {
      return [
        formatParsedNumber(row.quantity, 0),
        row.componentName || "Componente sin nombre",
        formatParsedNumber(row.weight, 1),
        formatParsedNumber(row.totalWeight, 1),
      ];
    }
    return [
      formatParsedNumber(row.quantity, 0),
      ...(hasLineNames ? [row.lineName || "—"] : []),
      row.componentName || "Componente sin nombre",
      formatParsedNumber(row.watts, 0),
      ...(hasPowerFactors ? [formatParsedNumber(row.pf, 2)] : []),
      formatParsedNumber(row.totalWatts, 0),
    ];
  });
};

const drawPowerCircuitNote = (
  doc: jsPDF,
  circuit: PowerCircuitSummary,
  table: ExportTable,
  y: number,
) => {
  const calculation = table.calculation;
  if (!calculation) {
    return drawNotice(
      doc,
      "Cálculo heredado sin instantánea reproducible. Revise tensión, fases y factor de potencia antes de utilizar estos valores.",
      y,
      "danger",
    );
  }
  const pduState =
    circuit.pduStatus === "ok"
      ? "Conforme"
      : circuit.pduStatus === "over"
        ? "Supera la referencia"
        : "No verificable";
  const line =
    `Potencia base: ${formatTechnicalReportNumber(circuit.totalWatts, 0)} W  ·  ` +
    `Potencia de cálculo (${formatTechnicalReportNumber(calculation.safetyMargin, 0)} %): ` +
    `${formatTechnicalReportNumber(circuit.adjustedWatts, 0)} W  ·  ` +
    `Aparente: ${formatTechnicalReportNumber(calculation.totalVa / 1000, 2)} kVA  ·  ` +
    `Corriente: ${formatTechnicalReportNumber(calculation.currentLine, 2)} A\n` +
    `Suministro: ${calculation.phaseMode === "three" ? "trifásico equilibrado" : "monofásico"} ` +
    `${formatTechnicalReportNumber(calculation.voltage, 0)} V  ·  ` +
    `Factor de potencia: ${powerFactorLabel(calculation)}  ·  ` +
    `PDU: ${circuit.pduLabel}` +
    `${circuit.pduLimit === null ? "" : ` (referencia 80 %: ${formatTechnicalReportNumber(circuit.pduLimit, 1)} A)`}` +
    `  ·  ${pduState}`;
  return drawNotice(
    doc,
    line,
    y,
    circuit.pduStatus === "over" ? "danger" : "neutral",
  );
};

const drawDetailTables = ({
  autoTable,
  doc,
  fontFamily,
  powerCircuits,
  tables,
  type,
}: {
  autoTable: AutoTableFn;
  doc: jsPDF;
  fontFamily: string;
  powerCircuits: PowerCircuitSummary[];
  tables: ExportTable[];
  type: TechnicalReportKind;
}) => {
  const populated = tables
    .map((table, tableIndex) => ({
      circuit: powerCircuits[tableIndex],
      table,
    }))
    .filter(({ table }) => table.rows.length > 0);
  if (populated.length === 0) return;
  doc.addPage();
  let y = REPORT_PAGE.contentTop + 5;

  populated.forEach(({ circuit, table }, index) => {
    y = ensureReportSpace(doc, y, 42);
    y = drawSectionHeading(
      doc,
      index + 3,
      `${type === "power" ? "Circuito" : "Punto"} ${String(index + 1).padStart(2, "0")}  —  ${table.name}`,
      y,
    );
    autoTable(doc, {
      ...tableStyles(fontFamily),
      body: detailRows(table, type),
      foot: [[
        "",
        type === "power" ? "Total del circuito" : "Total del punto",
        ...Array(Math.max(0, detailHeaders(table, type).length - 3)).fill(""),
        type === "power"
          ? `${formatTechnicalReportNumber(table.totalWatts ?? 0, 0)} W`
          : `${formatTechnicalReportNumber(table.totalWeight ?? 0, 1)} kg`,
      ]],
      head: [detailHeaders(table, type)],
      startY: y,
    });
    y = tableEndY(doc, y) + 5;

    if (type === "power") {
      y = ensureReportSpace(doc, y, 26);
      y = drawPowerCircuitNote(doc, circuit, table, y) + 7;
      if (table.includesHoist) {
        y = drawNotice(
          doc,
          `Suministro auxiliar de motores para ${table.name}: CEE32A 3P+N+G, excluido de los totales.`,
          y,
        ) + 7;
      }
    }
  });
};

export const exportTechnicalDataReportPdf = async ({
  customLogoUrl,
  fohSchukoRequired = false,
  jobDate,
  jobName,
  powerSummary: suppliedPowerSummary,
  projectName,
  safetyMargin,
  summaryRows,
  tables,
  type,
}: TechnicalReportInput): Promise<Blob> => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const [fontFamily, clientLogo, sectorLogo] = await Promise.all([
    registerPdfUnicodeFont(doc),
    loadImage(customLogoUrl),
    loadSectorProLogo(),
  ]);
  const reportFont = fontFamily ?? "helvetica";
  const emittedDate = formatTechnicalReportDate(new Date());
  const workDate = formatTechnicalReportDate(jobDate);
  const powerSummary =
    type === "power"
      ? buildPowerReportSummary(tables, suppliedPowerSummary, safetyMargin)
      : null;
  const weightRows =
    type === "weight" ? buildWeightPointSummaries(tables, summaryRows) : [];
  const totalWeight = weightRows.reduce((sum, row) => sum + row.totalWeight, 0);
  const weightPointCount = weightRows.filter(
    (row) => row.motorCount !== "—",
  ).length;

  let y = drawTitleBlock({
    clientLogo,
    doc,
    jobName,
    kind: type,
    projectName,
  });
  const powerMargins = new Set(
    powerSummary?.circuits
      .map((circuit) => circuit.margin)
      .filter((value): value is number => value !== null) ?? [],
  );
  y = drawMetaGrid(
    doc,
    type === "power"
      ? [
          { label: "Fecha del trabajo", value: workDate },
          { label: "Emitido", value: emittedDate },
          {
            label: "Margen aplicado",
            value:
              powerMargins.size === 1
                ? `${formatTechnicalReportNumber([...powerMargins][0], 0)} %`
                : powerMargins.size > 1
                  ? "Por circuito"
                  : "No disponible",
          },
          { label: "Suministro", value: powerSummary?.pduLabel ?? "Sin asignar" },
        ]
      : [
          { label: "Fecha del trabajo", value: workDate },
          { label: "Emitido", value: emittedDate },
          { label: "Partidas resumidas", value: String(weightRows.length) },
          { label: "Capacidad del punto", value: "Sin definir" },
        ],
    y,
  );

  if (type === "power" && powerSummary) {
    y = drawPowerHeadline({
      adjustedWatts: powerSummary.adjustedWatts,
      currentLine: powerSummary.currentLine,
      currentSupportingText:
        powerSummary.currentLine === null
          ? "Revise la compatibilidad de los circuitos"
          : powerSummary.pduRating === null
            ? "Sin PDU global  ·  ver detalle por circuito"
            : "",
      doc,
      pduRating: powerSummary.pduRating,
      supportingText:
        `${powerSummary.circuits.length} circuitos  ·  ` +
        `${powerSummary.totalVa === null ? "Potencia aparente no agregable" : `${formatTechnicalReportNumber(powerSummary.totalVa / 1000, 2)} kVA`}`,
    });
  } else {
    y = drawWeightHeadline({
      componentCount: tables.reduce((sum, table) => sum + table.rows.length, 0),
      doc,
      pointCount: weightPointCount,
      totalWeight,
    });
  }

  y = drawSectionHeading(
    doc,
    1,
    type === "power" ? "Resumen de circuitos" : "Resumen por punto",
    y + 7,
  );
  y = drawOverviewTable({
    autoTable,
    doc,
    fontFamily: reportFont,
    powerCircuits: powerSummary?.circuits ?? [],
    startY: y,
    type,
    weightRows,
  });
  y = ensureReportSpace(doc, y, 42);
  y = drawSectionHeading(doc, 2, "Base de cálculo", y);
  y = drawBasisGrid(
    doc,
    type === "power"
      ? buildPowerBasis(tables, powerSummary?.circuits ?? [])
      : [
          { label: "Pesos por unidad", value: "Datos introducidos" },
          { label: "Factor dinámico", value: "No aplicado" },
          { label: "Bumper y motores", value: "Según componentes" },
          { label: "Cableado", value: "Solo si figura" },
        ],
    y,
  );
  const formula =
    type === "power"
      ? `${fontFamily ? "I = S / (√3 × U) en trifásica; I = S / U en monofásica." : "I = S / (raíz de 3 x U) en trifásica; I = S / U en monofásica."} La suma global solo se muestra con suministros compatibles.`
      : "Peso total = suma de (cantidad × peso unitario). Este informe no sustituye el cálculo de cargas del responsable de rigging.";
  y = drawNotice(doc, formula, y, "neutral", reportFont);
  if (type === "power" && powerSummary?.currentLine === null) {
    y = drawNotice(
      doc,
      `La corriente global no es agregable: ${powerSummary.aggregationReason || "faltan datos eléctricos compatibles."}`,
      y + 3,
    );
  }
  if (type === "power" && fohSchukoRequired) {
    drawNotice(
      doc,
      "Suministro auxiliar de FOH: 16 A en formato Schuko hembra, excluido de los totales.",
      y + 3,
    );
  }

  drawDetailTables({
    autoTable,
    doc,
    fontFamily: reportFont,
    powerCircuits: powerSummary?.circuits ?? [],
    tables,
    type,
  });

  if (type === "power") {
    const stagePlot = buildPowerStagePlot(tables);
    if (stagePlot.hasPositionedEntries) {
      doc.addPage();
      drawPowerStagePlot(doc, stagePlot, {
        annotationColor: REPORT_COLORS.accent,
        entryColorFor: () => REPORT_COLORS.accent,
        fohSchukoRequired,
        footerSpace: REPORT_PAGE.height - REPORT_PAGE.bottom + 4,
        pageBreakY: REPORT_PAGE.contentTop + 4,
        contentLeft: REPORT_PAGE.left,
        contentRight: REPORT_PAGE.width - REPORT_PAGE.right,
        pageHeight: REPORT_PAGE.height,
        pageWidth: REPORT_PAGE.width,
        startY: REPORT_PAGE.contentTop + 7,
        title: "Distribución en escenario",
        titleColor: REPORT_COLORS.accent,
      });
    }
  }

  const totalPages = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    drawReportChrome({
      doc,
      emittedDate,
      jobName: jobName || projectName,
      kind: type,
      pageNumber,
      sectorLogo,
      totalPages,
    });
  }
  doc.setPage(totalPages);
  return doc.output("blob");
};
