import type jsPDF from "jspdf";

import {
  formatTechnicalReportNumber,
  type TechnicalReportKind,
} from "@/utils/pdf/technicalDataReportModel";

export const REPORT_PAGE = {
  bottom: 274,
  contentTop: 40,
  footerY: 282,
  height: 297,
  left: 25.4,
  right: 193.6,
  width: 210,
} as const;

export const REPORT_COLORS = {
  accent: [125, 1, 1] as const,
  danger: [145, 46, 38] as const,
  ink: [23, 20, 15] as const,
  paperTint: [249, 247, 243] as const,
  rule: [228, 223, 214] as const,
  soft: [122, 115, 106] as const,
} as const;

export type ReportMetaItem = {
  label: string;
  value: string;
};

const setText = (
  doc: jsPDF,
  color: readonly [number, number, number],
  size: number,
  style: "bold" | "normal" = "normal",
) => {
  doc.setFont("helvetica", style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
};

const drawTypeMark = (
  doc: jsPDF,
  kind: TechnicalReportKind,
  x: number,
  y: number,
) => {
  doc.setDrawColor(...REPORT_COLORS.accent);
  doc.setLineWidth(0.55);
  if (kind === "power") {
    doc.roundedRect(x, y, 8, 8, 0.7, 0.7, "S");
    doc.circle(x + 2.4, y + 2.4, 0.55, "S");
    doc.circle(x + 5.6, y + 2.4, 0.55, "S");
    doc.line(x + 2.2, y + 5.9, x + 5.8, y + 5.9);
  } else {
    doc.circle(x + 4, y + 2.1, 1.5, "S");
    doc.line(x + 4, y + 3.6, x + 4, y + 7.7);
    doc.line(x + 1.5, y + 7.7, x + 6.5, y + 7.7);
  }
};

export const drawReportChrome = ({
  doc,
  emittedDate,
  jobName,
  kind,
  pageNumber,
  sectorLogo,
  totalPages,
}: {
  doc: jsPDF;
  emittedDate: string;
  jobName: string;
  kind: TechnicalReportKind;
  pageNumber: number;
  sectorLogo: HTMLImageElement | null;
  totalPages: number;
}) => {
  doc.setPage(pageNumber);
  if (sectorLogo) {
    const width = 34;
    const height = width * sectorLogo.height / Math.max(sectorLogo.width, 1);
    try {
      doc.addImage(sectorLogo, "PNG", REPORT_PAGE.left, 13.2, width, height);
    } catch {
      setText(doc, REPORT_COLORS.ink, 7, "bold");
      doc.text("SECTOR-PRO", REPORT_PAGE.left, 17.5);
    }
  } else {
    setText(doc, REPORT_COLORS.ink, 7, "bold");
    doc.text("SECTOR-PRO", REPORT_PAGE.left, 17.5);
  }

  const markX = 146;
  drawTypeMark(doc, kind, markX, 11);
  setText(doc, REPORT_COLORS.soft, 6.5, "bold");
  doc.text(
    kind === "power" ? "DISTRIBUCIÓN DE POTENCIA" : "DISTRIBUCIÓN DE PESOS",
    markX + 11,
    16.2,
  );

  doc.setDrawColor(...REPORT_COLORS.rule);
  doc.setLineWidth(0.35);
  doc.line(REPORT_PAGE.left, 26, REPORT_PAGE.right, 26);
  doc.line(15.5, REPORT_PAGE.contentTop, 15.5, REPORT_PAGE.bottom);

  const railText = `${jobName || "Trabajo sin título"}  ·  ${emittedDate}`;
  setText(doc, REPORT_COLORS.soft, 5.8);
  doc.text(railText, 12.3, REPORT_PAGE.bottom, { angle: 90 });

  doc.line(REPORT_PAGE.left, 278.5, REPORT_PAGE.right, 278.5);
  setText(doc, REPORT_COLORS.soft, 6);
  doc.text("Sector-Pro  ·  Documentación técnica", REPORT_PAGE.left, REPORT_PAGE.footerY);
  doc.text(
    `${String(pageNumber).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`,
    REPORT_PAGE.right,
    REPORT_PAGE.footerY,
    { align: "right" },
  );
};

export const drawTitleBlock = ({
  clientLogo,
  doc,
  jobName,
  kind,
  projectName,
}: {
  clientLogo: HTMLImageElement | null;
  doc: jsPDF;
  jobName: string;
  kind: TechnicalReportKind;
  projectName: string;
}) => {
  setText(doc, REPORT_COLORS.accent, 6.8, "bold");
  doc.text(
    `${kind === "power" ? "DISTRIBUCIÓN DE POTENCIA" : "DISTRIBUCIÓN DE PESOS"}  ·  REV. A`,
    REPORT_PAGE.left,
    43,
  );

  const title = jobName.trim() || projectName.trim() || "Trabajo sin título";
  const titleWidth = clientLogo ? 134 : REPORT_PAGE.right - REPORT_PAGE.left;
  setText(doc, REPORT_COLORS.ink, 24, "bold");
  const titleLines = doc.splitTextToSize(title, titleWidth).slice(0, 2) as string[];
  doc.text(titleLines, REPORT_PAGE.left, 56, { lineHeightFactor: 0.88 });
  const y = 56 + Math.max(1, titleLines.length) * 7.6;

  const subtitle = projectName.trim() && projectName.trim() !== title
    ? projectName.trim()
    : "Informe técnico";
  setText(doc, REPORT_COLORS.soft, 8.5);
  doc.text(subtitle, REPORT_PAGE.left, y);

  if (clientLogo) {
    const maxWidth = 25;
    const maxHeight = 11;
    const ratio = clientLogo.width / Math.max(clientLogo.height, 1);
    const width = Math.min(maxWidth, maxHeight * ratio);
    const height = width / Math.max(ratio, 0.01);
    try {
      doc.addImage(
        clientLogo,
        "PNG",
        REPORT_PAGE.right - width,
        45,
        width,
        height,
      );
    } catch {
      // The client mark is optional; the report remains complete without it.
    }
  }

  return y + 9;
};

export const drawMetaGrid = (
  doc: jsPDF,
  items: ReportMetaItem[],
  startY: number,
) => {
  const width = (REPORT_PAGE.right - REPORT_PAGE.left) / items.length;
  items.forEach((item, index) => {
    const x = REPORT_PAGE.left + width * index;
    setText(doc, REPORT_COLORS.soft, 5.8, "bold");
    doc.text(item.label.toUpperCase(), x, startY);
    setText(doc, REPORT_COLORS.ink, 8.2);
    const lines = doc.splitTextToSize(item.value, width - 4).slice(0, 2) as string[];
    doc.text(lines, x, startY + 5, { lineHeightFactor: 1.05 });
  });
  return startY + 15;
};

export const drawSectionHeading = (
  doc: jsPDF,
  number: number,
  title: string,
  y: number,
) => {
  const sectionNumber = String(number).padStart(2, "0");
  setText(doc, REPORT_COLORS.accent, 6.5, "bold");
  doc.text(sectionNumber, REPORT_PAGE.left, y);
  setText(doc, REPORT_COLORS.ink, 8.5, "bold");
  const titleX = REPORT_PAGE.left + 9;
  doc.text(title.toUpperCase(), titleX, y);
  const titleWidth = doc.getTextWidth(title.toUpperCase());
  doc.setDrawColor(...REPORT_COLORS.rule);
  doc.setLineWidth(0.35);
  doc.line(
    Math.min(titleX + titleWidth + 5, REPORT_PAGE.right - 4),
    y - 1,
    REPORT_PAGE.right,
    y - 1,
  );
  return y + 6;
};

const drawGauge = ({
  doc,
  max,
  value,
  y,
}: {
  doc: jsPDF;
  max: number;
  value: number;
  y: number;
}) => {
  const x = REPORT_PAGE.left;
  const width = 75;
  const ratio = Math.max(0, Math.min(value / max, 1));
  doc.setDrawColor(...REPORT_COLORS.rule);
  doc.setLineWidth(1.4);
  doc.line(x, y, x + width, y);
  doc.setDrawColor(...REPORT_COLORS.accent);
  doc.line(x, y, x + width * Math.min(ratio, 0.8), y);
  if (ratio > 0.8) {
    doc.setDrawColor(...REPORT_COLORS.danger);
    doc.line(x + width * 0.8, y, x + width * ratio, y);
  }
  doc.setDrawColor(...REPORT_COLORS.ink);
  doc.setLineWidth(0.35);
  doc.line(x + width * 0.8, y - 2, x + width * 0.8, y + 2);
  setText(doc, REPORT_COLORS.soft, 5.5);
  doc.text("0 A", x, y + 5);
  doc.text("Referencia 80 %", x + width * 0.8, y + 5, { align: "center" });
  doc.text(`${formatTechnicalReportNumber(max, 0)} A`, x + width, y + 5, {
    align: "right",
  });
};

export const drawPowerHeadline = ({
  adjustedWatts,
  currentLine,
  currentSupportingText,
  doc,
  pduRating,
  supportingText,
}: {
  adjustedWatts: number;
  currentLine: number | null;
  currentSupportingText: string;
  doc: jsPDF;
  pduRating: number | null;
  supportingText: string;
}) => {
  const startY = 105;
  setText(doc, REPORT_COLORS.soft, 6.4, "bold");
  doc.text("CORRIENTE RESULTANTE", REPORT_PAGE.left, startY);
  if (currentLine === null) {
    setText(doc, REPORT_COLORS.ink, 17, "bold");
    doc.text("No agregable", REPORT_PAGE.left, startY + 11);
  } else {
    setText(doc, REPORT_COLORS.ink, 24, "bold");
    doc.text(
      `${formatTechnicalReportNumber(currentLine, 2)} A`,
      REPORT_PAGE.left,
      startY + 12,
    );
  }
  if (currentLine !== null && pduRating) {
    drawGauge({ doc, max: pduRating, value: currentLine, y: startY + 19 });
  } else {
    setText(doc, REPORT_COLORS.soft, 6.5);
    doc.text(currentSupportingText, REPORT_PAGE.left, startY + 20);
  }

  const rightX = 117;
  setText(doc, REPORT_COLORS.soft, 6.4, "bold");
  doc.text("POTENCIA DE CÁLCULO", rightX, startY);
  setText(doc, REPORT_COLORS.ink, 24, "bold");
  doc.text(
    `${formatTechnicalReportNumber(adjustedWatts / 1000, 2)} kW`,
    rightX,
    startY + 12,
  );
  setText(doc, REPORT_COLORS.soft, 6.5);
  const supportLines = doc.splitTextToSize(supportingText, 72).slice(0, 3) as string[];
  doc.text(supportLines, rightX, startY + 20, { lineHeightFactor: 1.15 });
  return 142;
};

export const drawWeightHeadline = ({
  componentCount,
  doc,
  pointCount,
  totalWeight,
}: {
  componentCount: number;
  doc: jsPDF;
  pointCount: number;
  totalWeight: number;
}) => {
  const startY = 105;
  setText(doc, REPORT_COLORS.soft, 6.4, "bold");
  doc.text("PESO TOTAL SUSPENDIDO", REPORT_PAGE.left, startY);
  setText(doc, REPORT_COLORS.ink, 24, "bold");
  doc.text(
    `${formatTechnicalReportNumber(totalWeight, 1)} kg`,
    REPORT_PAGE.left,
    startY + 12,
  );
  setText(doc, REPORT_COLORS.soft, 6.5);
  doc.text(
    `${formatTechnicalReportNumber(totalWeight * 2.2046226218, 1)} lb  ·  ${pointCount} puntos  ·  ${componentCount} componentes`,
    REPORT_PAGE.left,
    startY + 20,
  );

  const rightX = 117;
  setText(doc, REPORT_COLORS.soft, 6.4, "bold");
  doc.text("CARGA SOBRE EL PUNTO", rightX, startY);
  doc.setDrawColor(...REPORT_COLORS.rule);
  doc.setLineWidth(1.4);
  doc.line(rightX, startY + 12, REPORT_PAGE.right, startY + 12);
  setText(doc, REPORT_COLORS.soft, 5.5);
  doc.text("0 kg", rightX, startY + 17);
  doc.text("Capacidad sin definir", REPORT_PAGE.right, startY + 17, {
    align: "right",
  });
  setText(doc, REPORT_COLORS.soft, 6.2);
  const note = doc.splitTextToSize(
    "La capacidad admisible del punto no se recoge actualmente; por ello no se calcula su porcentaje de utilización.",
    REPORT_PAGE.right - rightX,
  ) as string[];
  doc.text(note, rightX, startY + 23, { lineHeightFactor: 1.12 });
  return 142;
};

export const ensureReportSpace = (
  doc: jsPDF,
  y: number,
  requiredHeight: number,
) => {
  if (y + requiredHeight <= REPORT_PAGE.bottom) return y;
  doc.addPage();
  return REPORT_PAGE.contentTop + 4;
};

export const drawNotice = (
  doc: jsPDF,
  text: string,
  y: number,
  tone: "danger" | "neutral" = "neutral",
  fontFamily?: string,
) => {
  const lines = doc.splitTextToSize(text, REPORT_PAGE.right - REPORT_PAGE.left - 8) as string[];
  const height = 8 + lines.length * 3.5;
  doc.setFillColor(...REPORT_COLORS.paperTint);
  doc.rect(REPORT_PAGE.left, y, REPORT_PAGE.right - REPORT_PAGE.left, height, "F");
  setText(
    doc,
    tone === "danger" ? REPORT_COLORS.danger : REPORT_COLORS.soft,
    6.6,
  );
  if (fontFamily) doc.setFont(fontFamily, "normal");
  doc.text(lines, REPORT_PAGE.left + 4, y + 5, { lineHeightFactor: 1.1 });
  return y + height;
};

export const drawBasisGrid = (
  doc: jsPDF,
  items: ReportMetaItem[],
  y: number,
) => {
  const columnWidth = (REPORT_PAGE.right - REPORT_PAGE.left) / 2;
  items.slice(0, 4).forEach((item, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = REPORT_PAGE.left + column * columnWidth;
    const itemY = y + row * 11;
    doc.setDrawColor(...REPORT_COLORS.rule);
    doc.setLineWidth(0.25);
    doc.line(x, itemY, x + columnWidth - 4, itemY);
    setText(doc, REPORT_COLORS.soft, 5.8);
    doc.text(item.label, x, itemY + 4.5);
    setText(doc, REPORT_COLORS.ink, 7.2, "bold");
    doc.text(item.value, x + columnWidth - 6, itemY + 4.5, { align: "right" });
  });
  return y + 23;
};
