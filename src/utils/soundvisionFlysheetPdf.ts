import type jsPDF from 'jspdf';
import { formatInTimeZone } from 'date-fns-tz';
import type {
  SoundvisionFlysheet,
  SoundvisionFlysheetArray,
} from '@/components/sound/amplifier-tool/rack-designer/nwm-import';
import {
  loadCompanyLogoDataUrl,
  safeAddPdfImage,
  SECTOR_PRO_RED,
} from '@/utils/pdf/exportHelpers';
import { loadJsPDF } from '@/utils/pdf/lazyPdf';
import { MADRID_TIMEZONE } from '@/utils/timezoneUtils';

const MAX_ARRAYS_PER_PAGE = 5;
const MAX_ENCLOSURES_PER_PAGE = 21;
const MARGIN = 8;
const LABEL_COLUMN_WIDTH = 37;
const SUMMARY_ROW_HEIGHT = 5.5;
const CABINET_ROW_HEIGHT = 4.5;

type PdfColor = [number, number, number];

const BLACK: PdfColor = [0, 0, 0];
const LIGHT_GRAY: PdfColor = [238, 238, 238];
const MEDIUM_GRAY: PdfColor = [210, 210, 210];
const YELLOW: PdfColor = [255, 235, 0];
const RED: PdfColor = [222, 30, 30];

export interface SoundvisionFlysheetPdfOptions {
  sourceFileName: string;
  generatedAt?: Date;
  createdBy?: string;
  /** Optional override used by non-browser renderers; the app loads the Sector Pro asset by default. */
  brandLogoDataUrl?: string | null;
}

const formatNumber = (value: number | null, suffix: string, digits = 1): string =>
  value === null ? '-' : `${value.toFixed(digits)}${suffix}`;

const formatCompactNumber = (value: number | null, suffix: string): string =>
  value === null ? '-' : `${value.toFixed(2).replace(/\.?0+$/, '')}${suffix}`;

/**
 * A variable-dispersion box is worth flagging on the flysheet when its Panflex
 * setting isn't the default symmetric 55/55 (110°). Fixed-directivity boxes
 * (no setting) are never flagged.
 */
export const isHighlightedDispersion = (setting: string | null | undefined): boolean =>
  !!setting && setting.trim() !== '55/55';

const deploymentLabel = (deployment: SoundvisionFlysheetArray['deployment']): string => {
  if (deployment === 'flown') return 'VOLADO';
  if (deployment === 'stacked') return 'APILADO';
  return 'SIN DEFINIR';
};

export const translateSoundvisionWarning = (warning: string): string => {
  const normalized = warning.trim();
  const exact: Record<string, string> = {
    'L-Acoustics does not allow this configuration.':
      'L-Acoustics no permite esta configuración.',
    'Safety factor is below minimum recommended by applicable standards.':
      'El factor de seguridad está por debajo del mínimo recomendado por la normativa aplicable.',
    'Change the site angle, rigging option, or number of enclosures.':
      'Cambie el ángulo de inclinación, la opción de rigging o el número de recintos.',
    'Site angle is impossible.': 'El ángulo de inclinación no es posible.',
    'Tipping hazard': 'Riesgo de vuelco.',
    'L-Acoustics recommends securing the array to the ground.':
      'L-Acoustics recomienda asegurar el array al suelo.',
  };
  if (exact[normalized]) return exact[normalized];

  const maximum = normalized.match(/^Maximum limit is (.+)\.$/i);
  if (maximum) return `El límite máximo es ${maximum[1]}.`;
  return normalized;
};

type WarningSeverity = 'danger' | 'warning' | 'caution';

export const soundvisionWarningSeverity = (warning: string): WarningSeverity => {
  const normalized = warning.trim().toLowerCase();
  if (
    normalized.includes('does not allow') ||
    normalized.includes('safety factor') ||
    normalized.includes('no permite') ||
    normalized.includes('factor de seguridad')
  ) {
    return 'danger';
  }
  if (
    normalized.includes('site angle is impossible') ||
    normalized.includes('recommends securing') ||
    normalized.includes('ángulo de inclinación no es posible') ||
    normalized.includes('recomienda asegurar')
  ) {
    return 'caution';
  }
  return 'warning';
};

function drawCell(
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    fill?: PdfColor;
    bold?: boolean;
    fontSize?: number;
    align?: 'left' | 'center' | 'right';
    textColor?: PdfColor;
  } = {},
): void {
  if (options.fill) {
    pdf.setFillColor(...options.fill);
    pdf.rect(x, y, width, height, 'FD');
  } else {
    pdf.rect(x, y, width, height);
  }
  pdf.setTextColor(...(options.textColor ?? BLACK));
  pdf.setFont('helvetica', options.bold ? 'bold' : 'normal');
  pdf.setFontSize(options.fontSize ?? 8);
  const align = options.align ?? 'center';
  const textX = align === 'left' ? x + 1.5 : align === 'right' ? x + width - 1.5 : x + width / 2;
  const lines = pdf.splitTextToSize(text || '-', Math.max(1, width - 3));
  const lineHeight = (options.fontSize ?? 8) * 0.36;
  const blockHeight = lines.length * lineHeight;
  const textY = y + Math.max(lineHeight, (height - blockHeight) / 2 + lineHeight * 0.82);
  pdf.text(lines, textX, textY, { align, maxWidth: width - 3 });
}

function drawSummaryRows(
  pdf: jsPDF,
  arrays: SoundvisionFlysheetArray[],
  startX: number,
  startY: number,
  arrayWidth: number,
): number {
  const rows: Array<{
    label: string;
    value: (array: SoundvisionFlysheetArray) => string;
    fill?: PdfColor;
  }> = [
    { label: 'Grupo', value: (array) => array.groupName },
    { label: 'Array', value: (array) => array.arrayName },
    { label: 'Configuración', value: (array) => deploymentLabel(array.deployment) },
    { label: 'Masa total', value: (array) => formatNumber(array.totalMassKg, ' kg') },
    { label: 'Carga frontal', value: (array) => formatNumber(array.frontLoadKg, ' kg') },
    { label: 'Carga trasera', value: (array) => formatNumber(array.rearLoadKg, ' kg') },
    { label: 'Altura superior', value: (array) => formatNumber(array.topHeightMeters, ' m', 2) },
    { label: 'Altura inferior', value: (array) => formatNumber(array.bottomHeightMeters, ' m', 2), fill: YELLOW },
    { label: 'Ángulo superior', value: (array) => formatNumber(array.topSiteDegrees, '°'), fill: YELLOW },
    { label: 'Ángulo inferior', value: (array) => formatNumber(array.bottomSiteDegrees, '°') },
    { label: 'Azimut', value: (array) => formatNumber(array.azimuthDegrees, '°') },
    { label: 'Rigging', value: (array) => array.riggingFrame || '-' },
    {
      label: 'Ajuste flying bar',
      value: (array) =>
        array.deployment === 'flown'
          ? array.flyingBarSetting || 'NO DISPONIBLE - VERIFICAR'
          : 'NO APLICA',
      fill: YELLOW,
    },
    { label: 'Puntos (F/R/PB)', value: (array) => array.pickupConfiguration || '-' },
  ];

  let y = startY;
  for (const row of rows) {
    drawCell(pdf, row.label, startX, y, LABEL_COLUMN_WIDTH, SUMMARY_ROW_HEIGHT, {
      bold: true,
      fill: row.fill ?? LIGHT_GRAY,
      fontSize: 7.5,
    });
    arrays.forEach((array, index) => {
      drawCell(
        pdf,
        row.value(array),
        startX + LABEL_COLUMN_WIDTH + index * arrayWidth,
        y,
        arrayWidth,
        SUMMARY_ROW_HEIGHT,
        { fill: row.fill, fontSize: 7.3 },
      );
    });
    y += SUMMARY_ROW_HEIGHT;
  }
  return y;
}

function drawCabinetRows(
  pdf: jsPDF,
  arrays: SoundvisionFlysheetArray[],
  startX: number,
  startY: number,
  arrayWidth: number,
  enclosureOffset: number,
): number {
  const rowCount = Math.max(...arrays.map((array) => array.enclosures.length));
  let y = startY;
  drawCell(pdf, 'N.º', startX, y, LABEL_COLUMN_WIDTH, CABINET_ROW_HEIGHT, {
    bold: true,
    fill: MEDIUM_GRAY,
    fontSize: 7.5,
  });
  arrays.forEach((array, index) => {
    drawCell(
      pdf,
      `${array.arrayName} · Recinto / Áng. / Disp.`,
      startX + LABEL_COLUMN_WIDTH + index * arrayWidth,
      y,
      arrayWidth,
      CABINET_ROW_HEIGHT,
      { bold: true, fill: MEDIUM_GRAY, fontSize: 7 },
    );
  });
  y += CABINET_ROW_HEIGHT;

  for (let row = 0; row < rowCount; row += 1) {
    drawCell(pdf, String(enclosureOffset + row + 1), startX, y, LABEL_COLUMN_WIDTH, CABINET_ROW_HEIGHT, {
      fontSize: 7.5,
    });
    arrays.forEach((array, index) => {
      const enclosure = array.enclosures[row];
      const value = enclosure
        ? `${enclosure.model}  |  ${formatCompactNumber(enclosure.splayAngleDegrees, '°')}${
            enclosure.dispersionSetting ? `  |  ${enclosure.dispersionSetting}` : ''
          }`
        : '';
      // Flag boxes whose Panflex setting isn't the default 55/55 so an
      // asymmetric/narrow dispersion doesn't slip by unnoticed.
      const highlight = enclosure ? isHighlightedDispersion(enclosure.dispersionSetting) : false;
      drawCell(
        pdf,
        value,
        startX + LABEL_COLUMN_WIDTH + index * arrayWidth,
        y,
        arrayWidth,
        CABINET_ROW_HEIGHT,
        { fontSize: 7.2, fill: highlight ? YELLOW : undefined, bold: highlight },
      );
    });
    y += CABINET_ROW_HEIGHT;
  }
  return y;
}

function drawWarnings(
  pdf: jsPDF,
  arrays: SoundvisionFlysheetArray[],
  startX: number,
  startY: number,
  arrayWidth: number,
  maxY: number,
  continues: boolean,
): void {
  arrays.forEach((array, index) => {
    const x = startX + LABEL_COLUMN_WIDTH + index * arrayWidth;
    const messages = array.warnings.map(translateSoundvisionWarning);
    const flyingBarReminder =
      array.deployment === 'flown'
        ? `Confirme en Soundvision el modelo, la posición y el orificio del flying bar (${array.flyingBarSetting || 'ajuste no disponible en el XMLP'}) antes del izado.`
        : '';
    const severities = array.warnings.map(soundvisionWarningSeverity);
    const severity: WarningSeverity = severities.includes('danger')
      ? 'danger'
      : severities.includes('warning')
        ? 'warning'
        : 'caution';
    const title = continues
      ? 'LISTADO CONTINÚA'
      : messages.length > 0
        ? severity === 'danger'
          ? 'PELIGRO'
          : severity === 'warning'
            ? 'ADVERTENCIA'
            : 'PRECAUCIÓN'
        : 'VERIFICACIÓN PENDIENTE';
    const body = continues
      ? 'Los recintos restantes aparecen en la página siguiente.'
      : messages.length > 0
        ? [...messages, flyingBarReminder].filter(Boolean).join('\n')
        : [
            'El XMLP no contiene resultados de carga o seguridad. Verifique la configuración en Soundvision antes del montaje.',
            flyingBarReminder,
          ].filter(Boolean).join('\n');
    const titleColor = !continues && messages.length > 0 && severity === 'danger' ? RED : YELLOW;
    const availableHeight = Math.max(20, maxY - startY);
    const titleHeight = 6;
    drawCell(pdf, title, x, startY, arrayWidth, titleHeight, {
      bold: true,
      fill: titleColor,
      fontSize: 7.5,
    });
    drawCell(pdf, body, x, startY + titleHeight, arrayWidth, availableHeight - titleHeight, {
      fontSize: 6.7,
    });
  });
}

const DISPERSION_NOTE_HEIGHT = 34;

/**
 * The four canonical Panflex settings. The two numbers are the left/right
 * half-apertures read from the enclosure's own perspective (facing the
 * audience); their sum is the nominal horizontal coverage. Recreated as an
 * original vector legend rather than embedding L-Acoustics' reference image.
 */
const PANFLEX_SETTINGS: Array<{
  code: string;
  left: number;
  right: number;
  name: string;
}> = [
  { code: '55 / 55', left: 55, right: 55, name: '110° · simétrico' },
  { code: '35 / 35', left: 35, right: 35, name: '70° · simétrico' },
  { code: '55 / 35', left: 55, right: 35, name: '90° · asimétrico' },
  { code: '35 / 55', left: 35, right: 55, name: '90° · asimétrico' },
];

/**
 * Draws a small top-view Panflex coverage fan (audience is "up") for one
 * setting: a shaded wedge bounded by the left/right half-aperture edges, with
 * the enclosure marked as a bar at the apex.
 */
function drawPanflexGlyph(
  pdf: jsPDF,
  cx: number,
  bottomY: number,
  leftDeg: number,
  rightDeg: number,
  radius: number,
): void {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const lx = cx - radius * Math.sin(toRad(leftDeg));
  const ly = bottomY - radius * Math.cos(toRad(leftDeg));
  const rx = cx + radius * Math.sin(toRad(rightDeg));
  const ry = bottomY - radius * Math.cos(toRad(rightDeg));
  // Shaded coverage wedge (chord approximation of the fan).
  pdf.setFillColor(250, 214, 214);
  pdf.triangle(cx, bottomY, lx, ly, rx, ry, 'F');
  // Coverage edges.
  pdf.setDrawColor(...RED);
  pdf.setLineWidth(0.4);
  pdf.line(cx, bottomY, lx, ly);
  pdf.line(cx, bottomY, rx, ry);
  // Forward axis reference tick.
  pdf.setDrawColor(...MEDIUM_GRAY);
  pdf.setLineWidth(0.2);
  pdf.line(cx, bottomY, cx, bottomY - radius);
  // Enclosure marker.
  pdf.setFillColor(...BLACK);
  pdf.rect(cx - 2.4, bottomY, 4.8, 1.4, 'F');
  pdf.setDrawColor(...BLACK);
}

/**
 * Draws the variable-dispersion (Panflex) legend: a top-view diagram of a
 * cabinet split into left/right halves seen from the box's own perspective, a
 * mapping of the canonical settings (55/55, 35/35, 55/35, 35/55) to their named
 * coverage patterns, and a Spanish note on how to read the "L/R" setting.
 */
function drawDispersionNote(pdf: jsPDF, x: number, y: number, width: number): void {
  const height = DISPERSION_NOTE_HEIGHT;
  pdf.setFillColor(...LIGHT_GRAY);
  pdf.setDrawColor(...BLACK);
  pdf.setLineWidth(0.35);
  pdf.rect(x, y, width, height, 'FD');

  // Title.
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.8);
  pdf.setTextColor(...BLACK);
  pdf.text('DISPERSIÓN VARIABLE (PANFLEX · K2 / K3 / KARA II)', x + 3, y + 4.5);

  // --- Left: cabinet seen from above, from the box's own perspective ---
  const diagramW = 48;
  const dx = x + 3;
  const audienceY = y + 9; // "toward audience" is up
  const cabinetY = y + 21;
  const centerX = dx + diagramW / 2;

  pdf.setLineWidth(0.4);
  // Cabinet body (a short bar) split into two halves.
  pdf.setFillColor(255, 255, 255);
  pdf.rect(dx + 6, cabinetY, diagramW - 12, 2.6, 'FD');
  pdf.line(centerX, cabinetY, centerX, cabinetY + 2.6); // centre divider
  // Coverage fans: left half wider than right to illustrate an asymmetric set.
  pdf.setDrawColor(...RED);
  pdf.line(centerX - 3, cabinetY, dx, audienceY); // left outer (wide)
  pdf.line(centerX - 3, cabinetY, centerX - 1, audienceY); // left inner
  pdf.line(centerX + 3, cabinetY, centerX + 1, audienceY); // right inner
  pdf.line(centerX + 3, cabinetY, dx + diagramW - 8, audienceY); // right outer (narrow)
  pdf.setDrawColor(...BLACK);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.2);
  pdf.text('IZQ', dx + 4, cabinetY + 2, { align: 'center' });
  pdf.text('DER', dx + diagramW - 4, cabinetY + 2, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(5.6);
  pdf.triangle(
    centerX - 1.2,
    audienceY - 0.6,
    centerX + 1.2,
    audienceY - 0.6,
    centerX,
    audienceY - 2.4,
    'F',
  );
  pdf.text('hacia el público', centerX + 3, audienceY - 1, { align: 'left' });

  // --- Middle: settings-to-pattern mapping glyphs ---
  const glyphZoneX = x + diagramW + 8;
  const glyphZoneW = width - (diagramW + 12);
  const cellW = glyphZoneW / PANFLEX_SETTINGS.length;
  PANFLEX_SETTINGS.forEach((setting, index) => {
    const cx = glyphZoneX + cellW * (index + 0.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(...BLACK);
    pdf.text(setting.code, cx, y + 8.5, { align: 'center' });
    drawPanflexGlyph(pdf, cx, y + 21, setting.left, setting.right, 10.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6);
    pdf.text(setting.name, cx, y + 25.5, { align: 'center' });
  });

  // --- Explanatory text across the bottom ---
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.4);
  pdf.setTextColor(...BLACK);
  const note =
    'Los recintos de directividad variable muestran su ajuste Panflex como IZQUIERDA/DERECHA (p. ej. 55/35), ' +
    'leído desde la perspectiva del propio recinto mirando hacia el público: cada cifra es la semiapertura (°) de ese lado ' +
    'y su suma es la cobertura horizontal total (55/55 = 110°, 35/35 = 70°, 55/35 y 35/55 = 90° asimétrico). ' +
    'Cada recinto puede llevar un ajuste distinto (configuración mixta, p. ej. 70°/110° en el mismo array). ' +
    'Se resaltan en amarillo los recintos cuyo ajuste difiere de 55/55 (110°). ' +
    'Los recintos de directividad fija (KS28, KARA, K1) no muestran ajuste. Confirme siempre en Soundvision.';
  const lines = pdf.splitTextToSize(note, Math.max(1, width - 6));
  pdf.text(lines, x + 3, y + 29);
}

function drawHeader(
  pdf: jsPDF,
  flysheet: SoundvisionFlysheet,
  sourceFileName: string,
  createdBy: string,
  pageNumber: number,
  pageCount: number,
): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const contentWidth = pageWidth - MARGIN * 2;
  pdf.setFillColor(...SECTOR_PRO_RED);
  pdf.rect(0, 0, pageWidth, 30, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.setTextColor(255, 255, 255);
  pdf.text('FLYSHEET SOUNDVISION', pageWidth / 2, 20, { align: 'center' });

  const metaY = 36;
  const columnGap = 6;
  const columnWidth = (contentWidth - columnGap) / 2;
  const leftValueX = MARGIN + 34;
  const rightX = MARGIN + columnWidth + columnGap;
  const rightValueX = rightX + 34;
  drawCell(pdf, 'Proyecto', MARGIN, metaY, 34, 7, { bold: true, fill: LIGHT_GRAY, fontSize: 7.5 });
  drawCell(pdf, flysheet.projectName || 'SIN NOMBRE', leftValueX, metaY, columnWidth - 34, 7, { bold: true, fontSize: 7.5 });
  drawCell(pdf, 'Archivo XMLP', rightX, metaY, 34, 7, { bold: true, fill: LIGHT_GRAY, fontSize: 7.5 });
  drawCell(pdf, sourceFileName, rightValueX, metaY, columnWidth - 34, 7, { fontSize: 7.5 });
  drawCell(pdf, 'Predicción creada por', MARGIN, metaY + 7, 34, 7, { bold: true, fill: LIGHT_GRAY, fontSize: 7 });
  drawCell(pdf, createdBy, leftValueX, metaY + 7, columnWidth - 34, 7, { bold: true, fontSize: 7.5 });
  drawCell(pdf, 'Página', rightX, metaY + 7, 34, 7, { bold: true, fill: LIGHT_GRAY, fontSize: 7.5 });
  drawCell(pdf, `${pageNumber} / ${pageCount}`, rightValueX, metaY + 7, columnWidth - 34, 7, { fontSize: 7.5 });
  drawCell(pdf, 'Validación', MARGIN, metaY + 14, 34, 7, { bold: true, fill: LIGHT_GRAY, fontSize: 7.5 });
  drawCell(pdf, 'Cargas, seguridad y flying bar: comprobar en Soundvision', leftValueX, metaY + 14, contentWidth - 34, 7, {
    bold: true,
    fill: YELLOW,
    fontSize: 7.2,
  });
  return metaY + 25;
}

function drawFooter(
  pdf: jsPDF,
  generatedAt: Date,
  brandLogoDataUrl: string | null,
  pageNumber: number,
  pageCount: number,
): void {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(80, 80, 80);
  pdf.text(
    `Generado: ${formatInTimeZone(generatedAt, MADRID_TIMEZONE, 'dd/MM/yyyy HH:mm')}`,
    MARGIN,
    pageHeight - 10,
  );

  pdf.setTextColor(...BLACK);
  pdf.setFontSize(8);
  pdf.text(`Página ${pageNumber} de ${pageCount}`, pageWidth / 2, pageHeight - 10, {
    align: 'center',
  });

  const logoWidth = 40;
  const logoHeight = logoWidth / 7.94;
  safeAddPdfImage(
    pdf,
    brandLogoDataUrl,
    'PNG',
    pageWidth - 50,
    pageHeight - 25,
    logoWidth,
    logoHeight,
    'No se pudo añadir el logotipo de Sector Pro al flysheet:',
  );
}

/** Generates an A3 landscape Spanish deployment flysheet from normalized XMLP data. */
export async function generateSoundvisionFlysheetPdf(
  flysheet: SoundvisionFlysheet,
  {
    sourceFileName,
    generatedAt = new Date(),
    createdBy = 'No identificado',
    brandLogoDataUrl,
  }: SoundvisionFlysheetPdfOptions,
): Promise<Blob> {
  if (flysheet.arrays.length === 0) {
    throw new Error('El proyecto no contiene arrays compatibles con el flysheet.');
  }

  const sectorProLogo = brandLogoDataUrl === undefined
    ? await loadCompanyLogoDataUrl()
    : brandLogoDataUrl;
  const jsPDF = await loadJsPDF();
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const pages: Array<{
    arrays: SoundvisionFlysheetArray[];
    enclosureOffset: number;
    continues: boolean;
  }> = [];
  for (let arrayOffset = 0; arrayOffset < flysheet.arrays.length; arrayOffset += MAX_ARRAYS_PER_PAGE) {
    const arrayGroup = flysheet.arrays.slice(arrayOffset, arrayOffset + MAX_ARRAYS_PER_PAGE);
    const enclosureCount = Math.max(...arrayGroup.map((array) => array.enclosures.length));
    const verticalPageCount = Math.max(1, Math.ceil(enclosureCount / MAX_ENCLOSURES_PER_PAGE));
    for (let verticalPage = 0; verticalPage < verticalPageCount; verticalPage += 1) {
      const enclosureOffset = verticalPage * MAX_ENCLOSURES_PER_PAGE;
      pages.push({
        arrays: arrayGroup.map((array) => ({
          ...array,
          enclosures: array.enclosures.slice(
            enclosureOffset,
            enclosureOffset + MAX_ENCLOSURES_PER_PAGE,
          ),
        })),
        enclosureOffset,
        continues: verticalPage < verticalPageCount - 1,
      });
    }
  }

  pages.forEach(({ arrays, enclosureOffset, continues }, pageIndex) => {
    if (pageIndex > 0) pdf.addPage('a3', 'landscape');
    pdf.setDrawColor(...BLACK);
    pdf.setLineWidth(0.35);
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - MARGIN * 2;
    const arrayWidth = (contentWidth - LABEL_COLUMN_WIDTH) / arrays.length;
    const tableStartY = drawHeader(
      pdf,
      flysheet,
      sourceFileName,
      createdBy.trim() || 'No identificado',
      pageIndex + 1,
      pages.length,
    );
    const cabinetsStartY = drawSummaryRows(pdf, arrays, MARGIN, tableStartY, arrayWidth) + 2;
    const warningsStartY =
      drawCabinetRows(pdf, arrays, MARGIN, cabinetsStartY, arrayWidth, enclosureOffset) + 4;
    // Reserve the legend strip only when this page actually shows a
    // variable-dispersion enclosure, so pages without one keep the full height.
    const hasDispersion = arrays.some((array) =>
      array.enclosures.some((enclosure) => enclosure.dispersionSetting),
    );
    const footerTop = pageHeight - 27;
    const warningsMaxY = hasDispersion ? footerTop - DISPERSION_NOTE_HEIGHT - 2 : footerTop;
    drawWarnings(pdf, arrays, MARGIN, warningsStartY, arrayWidth, warningsMaxY, continues);
    if (hasDispersion) {
      drawDispersionNote(pdf, MARGIN, warningsMaxY + 2, contentWidth);
    }
    drawFooter(pdf, generatedAt, sectorProLogo, pageIndex + 1, pages.length);
  });

  return pdf.output('blob') as Blob;
}
