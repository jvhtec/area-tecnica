import {
  STAGE_PLOT_BACKSTAGE_ROW,
  STAGE_PLOT_FOH,
  STAGE_PLOT_GRID,
  STAGE_PLOT_WING_LEFT_COLUMN,
  STAGE_PLOT_WING_RIGHT_COLUMN,
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
  setFont: (font: string | undefined, style?: string) => void;
  rect: (x: number, y: number, w: number, h: number, style?: string) => void;
  text: (text: string, x: number, y: number, options?: { align?: string }) => void;
  getTextWidth: (text: string) => number;
};

export type StagePlotRgb = readonly [number, number, number];

export type StagePlotLegendItem = { label: string; color: StagePlotRgb };

const DEFAULT_ENTRY_COLOR: StagePlotRgb = [125, 1, 1];
const LEGEND_HEIGHT = 7;

const ENTRY_HEIGHT = 8;
const HOIST_LINE_HEIGHT = 3.4;
const ZONE_HEADER_HEIGHT = 6;
const MIN_CELL_HEIGHT = 16;
const STAGE_WIDTH = 126;
const WING_WIDTH = 22;
const WING_GAP = 1.5;
const AUDIENCE_LABEL_HEIGHT = 6;
const SCHUKO_NOTE_HEIGHT = 5;

const fitText = (doc: PdfDoc, text: string, maxWidth: number) => {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 1 && doc.getTextWidth(`${trimmed}…`) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
};

const entryHeight = (entry: StagePlotEntry) =>
  ENTRY_HEIGHT + (entry.includesHoist ? HOIST_LINE_HEIGHT : 0);

const zoneHeight = (entries: StagePlotEntry[]) =>
  Math.max(
    MIN_CELL_HEIGHT,
    ZONE_HEADER_HEIGHT + entries.reduce((sum, entry) => sum + entryHeight(entry), 0) + 2,
  );

const drawZoneEntries = (
  doc: PdfDoc,
  entries: StagePlotEntry[],
  x: number,
  y: number,
  width: number,
  entryColorFor?: (entry: StagePlotEntry) => StagePlotRgb,
) => {
  let entryY = y + ZONE_HEADER_HEIGHT;
  entries.forEach((entry) => {
    const [red, green, blue] = entryColorFor?.(entry) ?? DEFAULT_ENTRY_COLOR;
    doc.setFontSize(7);
    doc.setTextColor(red, green, blue);
    doc.text(fitText(doc, entry.name, width - 6), x + width / 2, entryY + 3, {
      align: "center",
    });
    if (entry.pduLabel) {
      doc.setTextColor(90, 90, 90);
      doc.text(fitText(doc, entry.pduLabel, width - 6), x + width / 2, entryY + 6.2, {
        align: "center",
      });
    }
    if (entry.includesHoist) {
      doc.setFontSize(6);
      doc.setTextColor(150, 100, 0);
      doc.setFont("helvetica", "italic");
      doc.text(
        fitText(doc, "+ Motor: CEE32A 3P+N+G", width - 4),
        x + width / 2,
        entryY + 6.2 + HOIST_LINE_HEIGHT,
        { align: "center" },
      );
      doc.setFont("helvetica", "normal");
    }
    entryY += entryHeight(entry);
  });
};

const drawZoneBox = (
  doc: PdfDoc,
  zone: string,
  entries: StagePlotEntry[],
  x: number,
  y: number,
  width: number,
  height: number,
  entryColorFor?: (entry: StagePlotEntry) => StagePlotRgb,
) => {
  doc.setDrawColor(120, 120, 120);
  if (entries.length === 0) {
    doc.setFillColor(245, 245, 245);
    doc.rect(x, y, width, height, "FD");
  } else {
    doc.rect(x, y, width, height, "S");
  }
  doc.setFontSize(6);
  doc.setTextColor(140, 140, 140);
  doc.text(zone, x + 1.5, y + 3.5);
  drawZoneEntries(doc, entries, x, y, width, entryColorFor);
};

const formatEntryList = (entries: StagePlotEntry[]) =>
  entries
    .map((entry) => {
      const base = entry.pduLabel ? `${entry.name} (${entry.pduLabel})` : entry.name;
      return entry.includesHoist ? `${base} + Motor: CEE32A 3P+N+G` : base;
    })
    .join(", ");

// Wing cells align with the grid rows, so each row is as tall as its widest
// occupant (grid cells or the wing cell beside them).
const stageRowHeights = (plot: PowerStagePlotData) =>
  STAGE_PLOT_GRID.map((row, rowIndex) =>
    Math.max(
      ...row.map((zone) => zoneHeight(plot.zones[zone])),
      zoneHeight(plot.zones[STAGE_PLOT_WING_LEFT_COLUMN[rowIndex]]),
      zoneHeight(plot.zones[STAGE_PLOT_WING_RIGHT_COLUMN[rowIndex]]),
    ),
  );

const stageGridHeight = (plot: PowerStagePlotData) =>
  stageRowHeights(plot).reduce((sum, height) => sum + height, 0);

const backstageHeight = (plot: PowerStagePlotData) =>
  Math.max(...STAGE_PLOT_BACKSTAGE_ROW.map((zone) => zoneHeight(plot.zones[zone])));

const fohBoxHeight = (plot: PowerStagePlotData, fohSchukoRequired: boolean) =>
  zoneHeight(plot.zones[STAGE_PLOT_FOH]) + (fohSchukoRequired ? SCHUKO_NOTE_HEIGHT : 0);

export const estimatePowerStagePlotHeight = (
  plot: PowerStagePlotData,
  fohSchukoRequired = false,
  hasLegend = false,
) => {
  const extraLines = plot.custom.length + (plot.unpositioned.length > 0 ? 1 : 0);
  // title + backstage label/band + stage label + grid + gap + audience label
  // + FOH + audience label + extra lines
  return (
    10 +
    (hasLegend ? LEGEND_HEIGHT : 0) +
    6 +
    backstageHeight(plot) +
    2 +
    6 +
    stageGridHeight(plot) +
    3 +
    AUDIENCE_LABEL_HEIGHT +
    fohBoxHeight(plot, fohSchukoRequired) +
    AUDIENCE_LABEL_HEIGHT +
    2 +
    extraLines * 6 +
    4
  );
};

/**
 * Draws the stage plot (plan view, audience at the bottom, offstage wings
 * flanking the grid, FOH inside the audience area) for a consumos report and
 * returns the new y cursor. Labels are Spanish to match the rest of the
 * summary page.
 */
export const drawPowerStagePlot = (
  doc: PdfDoc,
  plot: PowerStagePlotData,
  options: {
    startY: number;
    pageWidth: number;
    pageHeight: number;
    footerSpace: number;
    fohSchukoRequired?: boolean;
    /** Heading drawn above the plot; defaults to the Spanish section title. */
    title?: string;
    /** Per-entry color (combined plots color-code by department). */
    entryColorFor?: (entry: StagePlotEntry) => StagePlotRgb;
    /** Color legend drawn under the title when provided. */
    legend?: StagePlotLegendItem[];
  },
): number => {
  const {
    pageWidth,
    pageHeight,
    footerSpace,
    fohSchukoRequired = false,
    title = "Distribución en Escenario",
    entryColorFor,
    legend,
  } = options;
  let y = options.startY;

  const totalHeight = estimatePowerStagePlotHeight(
    plot,
    fohSchukoRequired,
    Boolean(legend?.length),
  );
  if (y + totalHeight > pageHeight - footerSpace) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(14);
  doc.setTextColor(125, 1, 1);
  doc.text(title, 14, y);
  y += 8;

  // Color legend (one swatch + label per department)
  if (legend && legend.length > 0) {
    let legendX = 14;
    doc.setFontSize(8);
    legend.forEach(({ label, color }) => {
      const [red, green, blue] = color;
      doc.setFillColor(red, green, blue);
      doc.setDrawColor(red, green, blue);
      doc.rect(legendX, y - 2.8, 3.5, 3.5, "F");
      doc.setTextColor(60, 60, 60);
      doc.text(label, legendX + 5, y);
      legendX += 5 + doc.getTextWidth(label) + 8;
    });
    y += LEGEND_HEIGHT;
  }

  const totalWidth = STAGE_WIDTH + 2 * (WING_WIDTH + WING_GAP);
  const wingLeftX = (pageWidth - totalWidth) / 2;
  const stageX = wingLeftX + WING_WIDTH + WING_GAP;
  const wingRightX = stageX + STAGE_WIDTH + WING_GAP;
  const cellWidth = STAGE_WIDTH / 3;

  doc.setLineWidth(0.4);

  // Backstage band behind the stage
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("BACKSTAGE", pageWidth / 2, y, { align: "center" });
  y += 2;
  const backstageBandHeight = backstageHeight(plot);
  const backstageCellWidth = totalWidth / STAGE_PLOT_BACKSTAGE_ROW.length;
  STAGE_PLOT_BACKSTAGE_ROW.forEach((zone, columnIndex) => {
    drawZoneBox(
      doc,
      zone,
      plot.zones[zone],
      wingLeftX + columnIndex * backstageCellWidth,
      y,
      backstageCellWidth,
      backstageBandHeight,
      entryColorFor,
    );
  });
  y += backstageBandHeight + 2;

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("ESCENARIO", pageWidth / 2, y + 2, { align: "center" });
  y += 4;

  // Stage grid with offstage wings (split up/center/down) aligned per row
  const rowHeights = stageRowHeights(plot);
  let rowY = y;
  STAGE_PLOT_GRID.forEach((row, rowIndex) => {
    const rowHeight = rowHeights[rowIndex];
    drawZoneBox(
      doc,
      STAGE_PLOT_WING_LEFT_COLUMN[rowIndex],
      plot.zones[STAGE_PLOT_WING_LEFT_COLUMN[rowIndex]],
      wingLeftX,
      rowY,
      WING_WIDTH,
      rowHeight,
      entryColorFor,
    );
    drawZoneBox(
      doc,
      STAGE_PLOT_WING_RIGHT_COLUMN[rowIndex],
      plot.zones[STAGE_PLOT_WING_RIGHT_COLUMN[rowIndex]],
      wingRightX,
      rowY,
      WING_WIDTH,
      rowHeight,
      entryColorFor,
    );
    row.forEach((zone, columnIndex) => {
      drawZoneBox(
        doc,
        zone,
        plot.zones[zone],
        stageX + columnIndex * cellWidth,
        rowY,
        cellWidth,
        rowHeight,
        entryColorFor,
      );
    });
    rowY += rowHeight;
  });
  y = rowY;

  // Audience area with FOH inside: audience before and after the FOH box
  y += 3;
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("PÚBLICO", pageWidth / 2, y + 4, { align: "center" });
  y += AUDIENCE_LABEL_HEIGHT;

  const fohEntries = plot.zones[STAGE_PLOT_FOH];
  const fohWidth = (STAGE_WIDTH * 2) / 3;
  const fohX = (pageWidth - fohWidth) / 2;
  const fohHeight = fohBoxHeight(plot, fohSchukoRequired);
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
  drawZoneEntries(doc, fohEntries, fohX, y, fohWidth, entryColorFor);
  if (fohSchukoRequired) {
    doc.setFontSize(7);
    doc.setTextColor(150, 100, 0);
    doc.setFont("helvetica", "italic");
    doc.text(
      fitText(doc, "Se requiere schuko 16A hembra", fohWidth - 4),
      fohX + fohWidth / 2,
      y + fohHeight - 2.5,
      { align: "center" },
    );
    doc.setFont("helvetica", "normal");
  }
  y += fohHeight;

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("PÚBLICO", pageWidth / 2, y + 4, { align: "center" });
  y += AUDIENCE_LABEL_HEIGHT + 2;

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
