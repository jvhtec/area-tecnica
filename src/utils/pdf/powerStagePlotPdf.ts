import {
  STAGE_PLOT_FOH,
  STAGE_PLOT_GRID,
  type PowerStagePlotData,
  type StagePlotEntry,
} from "@/utils/powerStagePlot";

// Minimal jsPDF surface used here (the caller lazy-loads the real instance)
type PdfDoc = {
  addPage: () => void;
  setFontSize: (size: number) => void;
  setTextColor: (r: number, g: number, b: number) => void;
  setDrawColor: (r: number, g: number, b: number) => void;
  setFillColor: (r: number, g: number, b: number) => void;
  setLineWidth: (width: number) => void;
  setLineDashPattern?: (pattern: number[], phase: number) => void;
  rect: (x: number, y: number, w: number, h: number, style?: string) => void;
  text: (text: string, x: number, y: number, options?: { align?: string }) => void;
  getTextWidth: (text: string) => number;
};

const ENTRY_HEIGHT = 8;
const ZONE_HEADER_HEIGHT = 6;
const MIN_CELL_HEIGHT = 16;
const STAGE_WIDTH = 132;

const fitText = (doc: PdfDoc, text: string, maxWidth: number) => {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 1 && doc.getTextWidth(`${trimmed}…`) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
};

const zoneHeight = (entries: StagePlotEntry[]) =>
  Math.max(MIN_CELL_HEIGHT, ZONE_HEADER_HEIGHT + entries.length * ENTRY_HEIGHT + 2);

const drawZoneEntries = (
  doc: PdfDoc,
  entries: StagePlotEntry[],
  x: number,
  y: number,
  width: number,
) => {
  entries.forEach((entry, index) => {
    const entryY = y + ZONE_HEADER_HEIGHT + index * ENTRY_HEIGHT;
    doc.setFontSize(7);
    doc.setTextColor(125, 1, 1);
    doc.text(fitText(doc, entry.name, width - 6), x + width / 2, entryY + 3, {
      align: "center",
    });
    if (entry.pduLabel) {
      doc.setTextColor(90, 90, 90);
      doc.text(fitText(doc, entry.pduLabel, width - 6), x + width / 2, entryY + 6.2, {
        align: "center",
      });
    }
  });
};

const formatEntryList = (entries: StagePlotEntry[]) =>
  entries
    .map((entry) => (entry.pduLabel ? `${entry.name} (${entry.pduLabel})` : entry.name))
    .join(", ");

export const estimatePowerStagePlotHeight = (plot: PowerStagePlotData) => {
  const rowHeights = STAGE_PLOT_GRID.map((row) =>
    Math.max(...row.map((zone) => zoneHeight(plot.zones[zone]))),
  );
  const stageHeight = rowHeights.reduce((sum, height) => sum + height, 0);
  const fohHeight = zoneHeight(plot.zones[STAGE_PLOT_FOH]);
  const extraLines = plot.custom.length + (plot.unpositioned.length > 0 ? 1 : 0);
  // title + stage label + grid + gap + FOH + audience label + extra lines
  return 10 + 6 + stageHeight + 3 + fohHeight + 8 + extraLines * 6 + 4;
};

/**
 * Draws the stage plot (plan view, audience at the bottom) for a consumos
 * report and returns the new y cursor. Labels are Spanish to match the rest
 * of the summary page.
 */
export const drawPowerStagePlot = (
  doc: PdfDoc,
  plot: PowerStagePlotData,
  options: {
    startY: number;
    pageWidth: number;
    pageHeight: number;
    footerSpace: number;
  },
): number => {
  const { pageWidth, pageHeight, footerSpace } = options;
  let y = options.startY;

  const totalHeight = estimatePowerStagePlotHeight(plot);
  if (y + totalHeight > pageHeight - footerSpace) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(14);
  doc.setTextColor(125, 1, 1);
  doc.text("Distribución en Escenario", 14, y);
  y += 8;

  const stageX = (pageWidth - STAGE_WIDTH) / 2;
  const cellWidth = STAGE_WIDTH / 3;

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("ESCENARIO", pageWidth / 2, y, { align: "center" });
  y += 2;

  doc.setLineWidth(0.4);
  STAGE_PLOT_GRID.forEach((row) => {
    const rowHeight = Math.max(...row.map((zone) => zoneHeight(plot.zones[zone])));
    row.forEach((zone, columnIndex) => {
      const entries = plot.zones[zone];
      const x = stageX + columnIndex * cellWidth;
      doc.setDrawColor(120, 120, 120);
      if (entries.length === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(x, y, cellWidth, rowHeight, "FD");
      } else {
        doc.rect(x, y, cellWidth, rowHeight, "S");
      }
      doc.setFontSize(6);
      doc.setTextColor(140, 140, 140);
      doc.text(zone, x + 1.5, y + 3.5);
      drawZoneEntries(doc, entries, x, y, cellWidth);
    });
    y += rowHeight;
  });

  // FOH band in front of the stage
  y += 3;
  const fohEntries = plot.zones[STAGE_PLOT_FOH];
  const fohWidth = (STAGE_WIDTH * 2) / 3;
  const fohX = (pageWidth - fohWidth) / 2;
  const fohHeight = zoneHeight(fohEntries);
  doc.setDrawColor(120, 120, 120);
  try {
    doc.setLineDashPattern?.([1.5, 1.5], 0);
  } catch {
    /* older jsPDF without dash support */
  }
  if (fohEntries.length === 0) {
    doc.setFillColor(245, 245, 245);
    doc.rect(fohX, y, fohWidth, fohHeight, "FD");
  } else {
    doc.rect(fohX, y, fohWidth, fohHeight, "S");
  }
  try {
    doc.setLineDashPattern?.([], 0);
  } catch {
    /* older jsPDF without dash support */
  }
  doc.setFontSize(6);
  doc.setTextColor(140, 140, 140);
  doc.text(STAGE_PLOT_FOH, fohX + 1.5, y + 3.5);
  drawZoneEntries(doc, fohEntries, fohX, y, fohWidth);
  y += fohHeight;

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("PÚBLICO", pageWidth / 2, y + 5, { align: "center" });
  y += 8;

  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  plot.custom.forEach((group) => {
    doc.text(
      fitText(doc, `${group.position}: ${formatEntryList(group.entries)}`, pageWidth - 28),
      14,
      y + 4,
    );
    y += 6;
  });
  if (plot.unpositioned.length > 0) {
    doc.text(
      fitText(doc, `Sin posición: ${formatEntryList(plot.unpositioned)}`, pageWidth - 28),
      14,
      y + 4,
    );
    y += 6;
  }

  return y + 4;
};
