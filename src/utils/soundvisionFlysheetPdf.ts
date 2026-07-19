import type jsPDF from 'jspdf';
import { formatInTimeZone } from 'date-fns-tz';
import type {
  SoundvisionFlysheet,
  SoundvisionFlysheetArray,
} from '@/components/sound/amplifier-tool/rack-designer/nwm-import';
import { loadJsPDF } from '@/utils/pdf/lazyPdf';
import { MADRID_TIMEZONE } from '@/utils/timezoneUtils';

const MAX_ARRAYS_PER_PAGE = 5;
const MAX_ENCLOSURES_PER_PAGE = 30;
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
const SECTOR_RED: PdfColor = [125, 1, 1];

export interface SoundvisionFlysheetPdfOptions {
  sourceFileName: string;
  generatedAt?: Date;
}

const formatNumber = (value: number | null, suffix: string, digits = 1): string =>
  value === null ? '-' : `${value.toFixed(digits)}${suffix}`;

const formatCompactNumber = (value: number | null, suffix: string): string =>
  value === null ? '-' : `${value.toFixed(2).replace(/\.?0+$/, '')}${suffix}`;

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
      `${array.arrayName} · Recinto / Ángulo`,
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
        ? `${enclosure.model}  |  ${formatCompactNumber(enclosure.splayAngleDegrees, '°')}`
        : '';
      drawCell(
        pdf,
        value,
        startX + LABEL_COLUMN_WIDTH + index * arrayWidth,
        y,
        arrayWidth,
        CABINET_ROW_HEIGHT,
        { fontSize: 7.2 },
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

function drawHeader(
  pdf: jsPDF,
  flysheet: SoundvisionFlysheet,
  sourceFileName: string,
  pageNumber: number,
  pageCount: number,
): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const titleWidth = pageWidth * 0.43;
  drawCell(pdf, 'Proyecto', MARGIN, MARGIN, 30, 8, { bold: true, fontSize: 8 });
  drawCell(pdf, flysheet.projectName || 'SIN NOMBRE', MARGIN + 30, MARGIN, titleWidth - 30, 8, {
    bold: true,
    fontSize: 9,
  });
  drawCell(pdf, 'FLYSHEET', MARGIN, MARGIN + 8, titleWidth, 13, {
    bold: true,
    fill: SECTOR_RED,
    fontSize: 18,
    textColor: [255, 255, 255],
  });

  const metaX = MARGIN + titleWidth + 12;
  const metaWidth = pageWidth - MARGIN - metaX;
  drawCell(pdf, 'Archivo XMLP', metaX, MARGIN, 36, 7, { bold: true, fill: LIGHT_GRAY, fontSize: 7.5 });
  drawCell(pdf, sourceFileName, metaX + 36, MARGIN, metaWidth - 36, 7, { fontSize: 7.5 });
  drawCell(pdf, 'Página', metaX, MARGIN + 7, 36, 7, { bold: true, fill: LIGHT_GRAY, fontSize: 7.5 });
  drawCell(pdf, `${pageNumber} / ${pageCount}`, metaX + 36, MARGIN + 7, metaWidth - 36, 7, { fontSize: 7.5 });
  drawCell(pdf, 'Validación', metaX, MARGIN + 14, 36, 7, { bold: true, fill: LIGHT_GRAY, fontSize: 7.5 });
  drawCell(pdf, 'Cargas, seguridad y flying bar: comprobar en Soundvision', metaX + 36, MARGIN + 14, metaWidth - 36, 7, {
    bold: true,
    fill: YELLOW,
    fontSize: 7.2,
  });
  return MARGIN + 26;
}

function drawFooter(pdf: jsPDF, generatedAt: Date): void {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  pdf.setDrawColor(...SECTOR_RED);
  pdf.setLineWidth(0.8);
  pdf.line(MARGIN, pageHeight - 9, pageWidth - MARGIN, pageHeight - 9);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(80, 80, 80);
  pdf.text(
    `Generado el ${formatInTimeZone(generatedAt, MADRID_TIMEZONE, 'dd/MM/yyyy HH:mm')} · Confirme cargas, seguridad y ajuste del flying bar en Soundvision.`,
    MARGIN,
    pageHeight - 5,
  );
}

/** Generates an A3 landscape Spanish deployment flysheet from normalized XMLP data. */
export async function generateSoundvisionFlysheetPdf(
  flysheet: SoundvisionFlysheet,
  { sourceFileName, generatedAt = new Date() }: SoundvisionFlysheetPdfOptions,
): Promise<Blob> {
  if (flysheet.arrays.length === 0) {
    throw new Error('El proyecto no contiene arrays compatibles con el flysheet.');
  }

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
      pageIndex + 1,
      pages.length,
    );
    const cabinetsStartY = drawSummaryRows(pdf, arrays, MARGIN, tableStartY, arrayWidth) + 2;
    const warningsStartY =
      drawCabinetRows(pdf, arrays, MARGIN, cabinetsStartY, arrayWidth, enclosureOffset) + 4;
    drawWarnings(pdf, arrays, MARGIN, warningsStartY, arrayWidth, pageHeight - 14, continues);
    drawFooter(pdf, generatedAt);
  });

  return pdf.output('blob') as Blob;
}
