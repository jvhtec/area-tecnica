import type jsPDF from 'jspdf';
import {
  SOUNDVISION_REPORT_BRANDS,
  validateSoundvisionReport,
  type SoundvisionPdfImage,
  type SoundvisionReportConditions,
  type SoundvisionEquipmentRow,
  type SoundvisionReportModel,
  type SoundvisionReportPlot,
} from '@/features/technical-tools/soundvision/reportModel';
import {
  blobToDataUrl,
  safeAddPdfImage,
  type PdfRgb,
} from '@/utils/pdf/exportHelpers';
import { loadJsPDF } from '@/utils/pdf/lazyPdf';

const PAGE_WIDTH = 210;
const LEFT = 25.4;
const RIGHT = 16.4;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT - RIGHT;
const FOOTER_Y = 280;

const INK: PdfRgb = [23, 20, 15];
const SOFT: PdfRgb = [122, 115, 106];
const GOLD: PdfRgb = [160, 122, 51];
const RULE: PdfRgb = [228, 223, 214];
const PLOT_BORDER: PdfRgb = [221, 217, 209];

export interface SoundvisionReportAssets {
  companyLogo?: SoundvisionPdfImage | null;
  clientLogo?: SoundvisionPdfImage | null;
  predictionLogo?: SoundvisionPdfImage | null;
}

export interface FittedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const fitImageWithin = (
  sourceWidth: number,
  sourceHeight: number,
  boxX: number,
  boxY: number,
  boxWidth: number,
  boxHeight: number,
): FittedRect => {
  if (sourceWidth <= 0 || sourceHeight <= 0 || boxWidth <= 0 || boxHeight <= 0) {
    return { x: boxX, y: boxY, width: 0, height: 0 };
  }

  const scale = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: boxX + (boxWidth - width) / 2,
    y: boxY + (boxHeight - height) / 2,
    width,
    height,
  };
};

const readImageDimensions = (dataUrl: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new Error('Las dimensiones de imagen solo se pueden leer en un navegador.'));
      return;
    }

    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
    image.src = dataUrl;
  });

const imageFormat = (mime: string): SoundvisionPdfImage['format'] | null => {
  if (mime.includes('png')) return 'PNG';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'JPEG';
  return null;
};

export const blobToSoundvisionPdfImage = async (blob: Blob): Promise<SoundvisionPdfImage> => {
  const format = imageFormat(blob.type);
  if (!format) throw new Error('Use imágenes PNG o JPEG para el informe.');
  const dataUrl = await blobToDataUrl(blob);
  const dimensions = await readImageDimensions(dataUrl);
  return { dataUrl, format, ...dimensions };
};

export const loadSoundvisionPdfImage = async (
  path: string | null | undefined,
): Promise<SoundvisionPdfImage | null> => {
  if (!path) return null;
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    return await blobToSoundvisionPdfImage(await response.blob());
  } catch (error) {
    console.warn('No se pudo cargar una imagen del informe:', error);
    return null;
  }
};

const setSans = (pdf: jsPDF, style: 'normal' | 'bold' = 'normal'): void => {
  pdf.setFont('helvetica', style);
};

const setMono = (pdf: jsPDF, style: 'normal' | 'bold' = 'normal'): void => {
  pdf.setFont('courier', style);
};

const drawImage = (
  pdf: jsPDF,
  image: SoundvisionPdfImage | null | undefined,
  box: FittedRect,
  border = false,
): FittedRect | null => {
  if (!image) return null;
  const fitted = fitImageWithin(
    image.width,
    image.height,
    box.x,
    box.y,
    box.width,
    box.height,
  );
  if (fitted.width <= 0 || fitted.height <= 0) return null;

  safeAddPdfImage(
    pdf,
    image.dataUrl,
    image.format,
    fitted.x,
    fitted.y,
    fitted.width,
    fitted.height,
    'No se pudo añadir una imagen al informe:',
  );
  if (border) {
    pdf.setDrawColor(...PLOT_BORDER);
    pdf.setLineWidth(0.25);
    pdf.rect(fitted.x, fitted.y, fitted.width, fitted.height);
  }
  return fitted;
};

const truncateText = (pdf: jsPDF, value: string, maxWidth: number): string => {
  if (pdf.getTextWidth(value) <= maxWidth) return value;
  let text = value;
  while (text.length > 1 && pdf.getTextWidth(`${text}...`) > maxWidth) {
    text = text.slice(0, -1);
  }
  return `${text.trim()}...`;
};

const drawHeader = (
  pdf: jsPDF,
  model: SoundvisionReportModel,
  assets: SoundvisionReportAssets,
): void => {
  const brand = SOUNDVISION_REPORT_BRANDS[model.system];
  const predictionLogoX = PAGE_WIDTH - RIGHT - 8;
  const company = drawImage(pdf, assets.companyLogo, {
    x: LEFT,
    y: 14.3,
    width: 48,
    height: 6.5,
  });
  if (!company) {
    setSans(pdf, 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(...INK);
    pdf.text('SECTOR-PRO', LEFT, 20);
  }

  const hasPredictionLogo = drawImage(pdf, assets.predictionLogo, {
    x: predictionLogoX,
    y: 13.5,
    width: 8,
    height: 8,
  });
  const predictionName = brand.reportLabel.replace(/^Informe\s+/i, '').toUpperCase();
  setMono(pdf, 'bold');
  pdf.setFontSize(5.2);
  pdf.setTextColor(...SOFT);
  pdf.text(
    [predictionName, 'PREDICCIÓN'],
    hasPredictionLogo ? predictionLogoX - 6 : PAGE_WIDTH - RIGHT,
    16.3,
    {
      align: 'right',
      charSpace: 0.55,
      lineHeightFactor: 1.35,
    },
  );

  pdf.setDrawColor(...GOLD);
  pdf.setLineWidth(0.4);
  pdf.line(LEFT, 25.5, PAGE_WIDTH - RIGHT, 25.5);
};

const drawRail = (pdf: jsPDF, model: SoundvisionReportModel): void => {
  const rail = [model.eventTitle, model.stageLabel].filter(Boolean).join(' | ').toUpperCase();
  setMono(pdf, 'normal');
  pdf.setFontSize(6);
  pdf.setTextColor(170, 163, 153);
  pdf.text(truncateText(pdf, rail, 145), 13, 244, { angle: 90, charSpace: 0.85 });
};

const drawFooter = (
  pdf: jsPDF,
  pageNumber: number,
  totalPages: number,
  predictionLabel: string,
): void => {
  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(0.25);
  pdf.line(LEFT, FOOTER_Y, PAGE_WIDTH - RIGHT, FOOTER_Y);

  setMono(pdf, 'normal');
  pdf.setFontSize(5.8);
  pdf.setTextColor(...SOFT);
  pdf.text(`SECTOR-PRO | DISEÑO DE SISTEMA | ${predictionLabel.toUpperCase()}`, LEFT, FOOTER_Y + 5, {
    charSpace: 0.45,
  });
  pdf.setFontSize(8.5);
  pdf.setTextColor(...INK);
  pdf.text(String(pageNumber).padStart(2, '0'), PAGE_WIDTH - RIGHT - 8, FOOTER_Y + 5, {
    align: 'right',
  });
  pdf.setTextColor(191, 184, 173);
  pdf.text(` / ${String(totalPages).padStart(2, '0')}`, PAGE_WIDTH - RIGHT, FOOTER_Y + 5, {
    align: 'right',
  });
};

const drawSectionHeading = (
  pdf: jsPDF,
  number: string,
  title: string,
  y: number,
): void => {
  const heading = title.toUpperCase();
  const headingCharSpace = 0.55;
  setMono(pdf, 'bold');
  pdf.setFontSize(6.8);
  pdf.setTextColor(...GOLD);
  pdf.text(number, LEFT, y);
  setSans(pdf, 'bold');
  pdf.setFontSize(7.8);
  pdf.setTextColor(...INK);
  pdf.text(heading, LEFT + 9, y, { charSpace: headingCharSpace });
  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(0.25);
  const headingWidth =
    pdf.getTextWidth(heading) + Math.max(0, heading.length - 1) * headingCharSpace;
  const ruleStart = Math.min(PAGE_WIDTH - RIGHT - 12, LEFT + 9 + headingWidth + 7);
  pdf.line(ruleStart, y - 1, PAGE_WIDTH - RIGHT, y - 1);
};

const conditionValues = (conditions: SoundvisionReportConditions) => [
  ['Temperatura', `${conditions.temperatureC} °C`],
  ['Humedad relativa', `${conditions.humidityPercent} %`],
  ['Nivel de entrada', `${conditions.inputLevelDbu} dBu`],
  ['Absorción del aire', 'Aplicada'],
  ['Plano de audiencia', `${conditions.audiencePlaneM} m sobre suelo`],
];

const drawConditions = (
  pdf: jsPDF,
  conditions: SoundvisionReportConditions,
  y: number,
  boxed: boolean,
): void => {
  const values = conditionValues(conditions);
  const width = CONTENT_WIDTH / values.length;
  if (boxed) {
    pdf.setDrawColor(...RULE);
    pdf.setLineWidth(0.25);
    pdf.rect(LEFT, y, CONTENT_WIDTH, 14);
  }

  values.forEach(([label, value], index) => {
    const x = LEFT + index * width;
    if (boxed && index > 0) pdf.line(x, y, x, y + 14);
    setMono(pdf, 'normal');
    pdf.setFontSize(5.4);
    pdf.setTextColor(...SOFT);
    pdf.text(label.toUpperCase(), x + (boxed ? 2.5 : 0), y + (boxed ? 4.5 : 0), {
      charSpace: 0.25,
    });
    setMono(pdf, 'bold');
    pdf.setFontSize(7.2);
    pdf.setTextColor(...INK);
    pdf.text(value, x + (boxed ? 2.5 : 0), y + (boxed ? 10 : 4.8));
  });
};

const normalizeEquipmentText = (row: SoundvisionEquipmentRow): string =>
  `${row.model} ${row.role}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const equipmentQuantity = (row: SoundvisionEquipmentRow): number => {
  const quantity = Number.parseInt(row.quantity, 10);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
};

const splitQuantity = (quantity: number): [number, number] => [
  Math.ceil(quantity / 2),
  Math.floor(quantity / 2),
];

const drawLineArray = (
  pdf: jsPDF,
  centerX: number,
  topY: number,
  quantity: number,
  label: string,
): void => {
  const visibleModules = Math.min(quantity, 12);
  const cabinetWidth = 8.4;
  const cabinetHeight = Math.min(2.1, 22 / visibleModules);
  const arrayHeight = cabinetHeight * visibleModules;
  const left = centerX - cabinetWidth / 2;

  pdf.setDrawColor(...SOFT);
  pdf.setLineWidth(0.22);
  pdf.line(centerX, topY - 3.2, centerX, topY - 1);
  pdf.line(centerX - 5.2, topY - 1, centerX + 5.2, topY - 1);
  for (let index = 0; index < visibleModules; index += 1) {
    const y = topY + index * cabinetHeight;
    pdf.rect(left, y, cabinetWidth, cabinetHeight);
    pdf.line(centerX - 0.75, y, centerX - 0.75, y + cabinetHeight);
    pdf.line(centerX + 0.75, y, centerX + 0.75, y + cabinetHeight);
  }

  setMono(pdf, 'bold');
  pdf.setFontSize(5.2);
  pdf.setTextColor(...INK);
  pdf.text(label.toUpperCase(), centerX, topY + arrayHeight + 4, { align: 'center' });
};

const drawSubStack = (
  pdf: jsPDF,
  centerX: number,
  topY: number,
  quantity: number,
  label: string,
): void => {
  const visibleModules = Math.min(quantity, 8);
  const columns = Math.min(4, Math.max(1, Math.ceil(visibleModules / 2)));
  const rows = Math.ceil(visibleModules / columns);
  const cabinetWidth = 6.2;
  const cabinetHeight = 3.5;
  const stackWidth = columns * cabinetWidth;
  const left = centerX - stackWidth / 2;

  pdf.setDrawColor(...SOFT);
  pdf.setLineWidth(0.22);
  for (let index = 0; index < visibleModules; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = left + column * cabinetWidth;
    const y = topY + row * cabinetHeight;
    pdf.rect(x, y, cabinetWidth, cabinetHeight);
    pdf.line(x + cabinetWidth * 0.42, y + 0.7, x + cabinetWidth * 0.42, y + cabinetHeight - 0.7);
    pdf.line(x + cabinetWidth * 0.58, y + 0.7, x + cabinetWidth * 0.58, y + cabinetHeight - 0.7);
  }

  setMono(pdf, 'bold');
  pdf.setFontSize(5.2);
  pdf.setTextColor(...INK);
  pdf.text(label.toUpperCase(), centerX, topY + rows * cabinetHeight + 4, {
    align: 'center',
  });
};

const drawFrontFills = (
  pdf: jsPDF,
  centerX: number,
  y: number,
  row: SoundvisionEquipmentRow,
): void => {
  const quantity = equipmentQuantity(row);
  const visibleModules = Math.min(quantity, 12);
  const cabinetWidth = Math.min(5.4, 48 / visibleModules);
  const left = centerX - visibleModules * cabinetWidth / 2;

  pdf.setDrawColor(...SOFT);
  pdf.setLineWidth(0.22);
  for (let index = 0; index < visibleModules; index += 1) {
    const x = left + index * cabinetWidth;
    pdf.rect(x, y, cabinetWidth, 3.2);
    pdf.line(x + cabinetWidth / 2, y + 0.8, x + cabinetWidth / 2, y + 2.4);
  }

  setMono(pdf, 'bold');
  pdf.setFontSize(5.2);
  pdf.setTextColor(...INK);
  pdf.text(`${row.quantity} ${row.model} · RELLENO FRONTAL`.toUpperCase(), centerX, y + 7.1, {
    align: 'center',
  });
};

const drawSystemConfiguration = (
  pdf: jsPDF,
  equipment: SoundvisionEquipmentRow[],
  y: number,
  height: number,
): void => {
  if (height < 46 || equipment.length === 0) return;

  const subs = equipment.find((row) => /\b(sub|grave|ks28|sb)\b/.test(normalizeEquipmentText(row)));
  const fills = equipment.find((row) => /\b(fill|relleno|front|x12)\b/.test(normalizeEquipmentText(row)));
  const main = equipment.find((row) => row !== subs && row !== fills);
  if (!main) return;

  drawSectionHeading(pdf, '03', 'Esquema de configuración', y);
  setMono(pdf, 'normal');
  pdf.setFontSize(5.2);
  pdf.setTextColor(...SOFT);
  pdf.text('ELEVACIÓN CONCEPTUAL · CANTIDADES DISTRIBUIDAS ENTRE IZQUIERDA Y DERECHA', LEFT + 9, y + 5, {
    charSpace: 0.18,
  });

  const drawingTop = y + 10;
  const leftX = LEFT + 46;
  const rightX = PAGE_WIDTH - RIGHT - 46;
  const mainQuantity = equipmentQuantity(main);
  const [leftMain, rightMain] = splitQuantity(mainQuantity);
  drawLineArray(pdf, leftX, drawingTop + 3, leftMain, `${leftMain} ${main.model} · Izq.`);
  drawLineArray(pdf, rightX, drawingTop + 3, rightMain, `${rightMain} ${main.model} · Dcha.`);

  const arrayHeight = Math.min(12, leftMain) * Math.min(2.1, 22 / Math.min(12, leftMain));
  const arrayBottom = drawingTop + 3 + arrayHeight;
  const subTop = Math.min(y + height - 13, arrayBottom + 8);
  if (subs) {
    const [leftSubs, rightSubs] = splitQuantity(equipmentQuantity(subs));
    drawSubStack(pdf, leftX, subTop, leftSubs, `${leftSubs} ${subs.model} · Izq.`);
    drawSubStack(pdf, rightX, subTop, rightSubs, `${rightSubs} ${subs.model} · Dcha.`);
  }

  if (fills) {
    const centerX = (leftX + rightX) / 2;
    drawFrontFills(pdf, centerX, Math.min(y + height - 11, subTop + 1), fills);
  }
};

const drawTitlePage = (
  pdf: jsPDF,
  model: SoundvisionReportModel,
  assets: SoundvisionReportAssets,
): void => {
  const brand = SOUNDVISION_REPORT_BRANDS[model.system];
  drawHeader(pdf, model, assets);
  drawRail(pdf, model);

  setMono(pdf, 'bold');
  pdf.setFontSize(6.5);
  pdf.setTextColor(...GOLD);
  pdf.text(`PREDICCIÓN DE SISTEMA | REV ${model.revision.toUpperCase()}`, LEFT, 42, {
    charSpace: 0.85,
  });

  let titleSize = 43.5;
  let titleLines: string[] = [];
  do {
    setSans(pdf, 'bold');
    pdf.setFontSize(titleSize);
    titleLines = pdf.splitTextToSize(model.eventTitle.toUpperCase(), 126) as string[];
    if (titleLines.length > 3) titleSize -= 2;
  } while (titleLines.length > 3 && titleSize > 29);
  pdf.setTextColor(...INK);
  pdf.setLineHeightFactor(0.9);
  pdf.text(titleLines, LEFT, 61, { charSpace: -0.35 });
  const titleBottom = 61 + (titleLines.length - 1) * titleSize * 0.9 * 0.3528;

  setSans(pdf, 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(...SOFT);
  const subtitle = [model.stageLabel, model.eventDate].filter(Boolean).join(' | ');
  pdf.text(subtitle, LEFT, titleBottom + 9);

  const metaTop = Math.max(108, titleBottom + 27);
  drawImage(pdf, assets.clientLogo, {
    x: PAGE_WIDTH - RIGHT - 30,
    y: metaTop - 17,
    width: 30,
    height: 12,
  });

  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(0.25);
  pdf.line(LEFT, metaTop, PAGE_WIDTH - RIGHT, metaTop);
  pdf.line(LEFT, metaTop + 19, PAGE_WIDTH - RIGHT, metaTop + 19);

  const metadata = [
    ['Emitido', model.issuedDate],
    ['Sistema', brand.manufacturer],
    ['Predicción', brand.reportLabel.replace(/^Informe\s+/i, '')],
    ['Diseñado por', 'Sector-Pro'],
  ];
  const columnWidth = CONTENT_WIDTH / metadata.length;
  metadata.forEach(([label, value], index) => {
    const x = LEFT + index * columnWidth;
    setMono(pdf, 'bold');
    pdf.setFontSize(5.4);
    pdf.setTextColor(...SOFT);
    pdf.text(label.toUpperCase(), x, metaTop + 6.2, { charSpace: 0.6 });
    setSans(pdf, 'bold');
    pdf.setFontSize(8.2);
    pdf.setTextColor(...INK);
    pdf.text(truncateText(pdf, value, columnWidth - 3), x, metaTop + 13.7);
  });

  const scheduleHeadingY = metaTop + 34;
  drawSectionHeading(pdf, '01', 'Configuración del sistema', scheduleHeadingY);
  let rowY = scheduleHeadingY + 8;
  model.equipment.forEach((row) => {
    setMono(pdf, 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...INK);
    pdf.text(row.quantity, LEFT, rowY + 4.8);
    setSans(pdf, 'bold');
    pdf.setFontSize(8.5);
    pdf.text(truncateText(pdf, row.model, 94), LEFT + 13.5, rowY + 4.8);
    setSans(pdf, 'normal');
    pdf.setFontSize(7.4);
    pdf.setTextColor(...SOFT);
    pdf.text(truncateText(pdf, row.role, 49), PAGE_WIDTH - RIGHT, rowY + 4.8, {
      align: 'right',
    });
    pdf.setDrawColor(...RULE);
    pdf.line(LEFT, rowY + 7.5, PAGE_WIDTH - RIGHT, rowY + 7.5);
    rowY += 8.2;
  });

  const conditionsHeadingY = Math.min(258, rowY + 11);
  drawSectionHeading(pdf, '02', 'Condiciones de predicción', conditionsHeadingY);
  drawConditions(pdf, model.conditions, conditionsHeadingY + 5.5, false);
  const diagramY = conditionsHeadingY + 19;
  drawSystemConfiguration(pdf, model.equipment, diagramY, FOOTER_Y - diagramY - 6);
  drawFooter(pdf, 1, 4, brand.predictionLabel);
};

const drawParameterPanel = (
  pdf: jsPDF,
  plot: SoundvisionReportPlot,
  conditions: SoundvisionReportConditions,
  x: number,
  y: number,
  width: number,
): void => {
  setMono(pdf, 'bold');
  pdf.setFontSize(6);
  pdf.setTextColor(...GOLD);
  pdf.text('PARÁMETROS', x, y, { charSpace: 0.7 });
  pdf.setDrawColor(...RULE);
  pdf.line(x, y + 2.5, x + width, y + 2.5);

  const rows = [
    ['Ponderación', plot.weighting],
    ['Banda', plot.band],
    ['Temperatura', `${conditions.temperatureC} °C`],
    ['Humedad rel.', `${conditions.humidityPercent} %`],
    ['Plano audiencia', `${conditions.audiencePlaneM} m`],
  ];
  rows.forEach(([label, value], index) => {
    const rowY = y + 8 + index * 6.2;
    setSans(pdf, 'normal');
    pdf.setFontSize(6.8);
    pdf.setTextColor(...SOFT);
    pdf.text(label, x, rowY);
    setMono(pdf, 'bold');
    pdf.setFontSize(6.7);
    pdf.setTextColor(...INK);
    pdf.text(value, x + width, rowY, { align: 'right' });
    pdf.setDrawColor(...RULE);
    pdf.line(x, rowY + 2.2, x + width, rowY + 2.2);
  });
};

const drawPlotPage = (
  pdf: jsPDF,
  model: SoundvisionReportModel,
  plot: SoundvisionReportPlot,
  pageNumber: number,
  assets: SoundvisionReportAssets,
): void => {
  const brand = SOUNDVISION_REPORT_BRANDS[model.system];
  drawHeader(pdf, model, assets);
  drawRail(pdf, model);

  setMono(pdf, 'bold');
  pdf.setFontSize(6.5);
  pdf.setTextColor(...GOLD);
  pdf.text(`GRÁFICO ${String(pageNumber - 1).padStart(2, '0')}`, LEFT, 42, {
    charSpace: 0.9,
  });
  setSans(pdf, 'bold');
  pdf.setFontSize(22);
  pdf.setTextColor(...INK);
  pdf.text(plot.title, LEFT, 53, { charSpace: -0.2 });
  setMono(pdf, 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(...SOFT);
  pdf.text(plot.descriptor.toUpperCase(), LEFT, 61, { charSpace: 0.35 });
  drawConditions(pdf, model.conditions, 67, true);

  const hasIso = Boolean(plot.isoView);
  const main = drawImage(pdf, plot.topView, {
    x: LEFT,
    y: 88,
    width: CONTENT_WIDTH,
    height: hasIso ? 120 : 151,
  }, true);
  if (main) {
    setMono(pdf, 'normal');
    pdf.setFontSize(6);
    pdf.setTextColor(...SOFT);
    pdf.text(
      `VISTA EN PLANTA | PLANO DE AUDIENCIA A ${model.conditions.audiencePlaneM} M`,
      main.x,
      main.y + main.height + 5,
      { charSpace: 0.45 },
    );
  }

  if (hasIso) {
    const support = drawImage(pdf, plot.isoView, {
      x: LEFT,
      y: 224,
      width: 76,
      height: 38,
    }, true);
    if (support) {
      setMono(pdf, 'normal');
      pdf.setFontSize(6);
      pdf.setTextColor(...SOFT);
      pdf.text('ISOMÉTRICA | RECINTO COMPLETO', support.x, support.y + support.height + 5, {
        charSpace: 0.45,
      });
    }
    drawParameterPanel(pdf, plot, model.conditions, LEFT + 86, 226, CONTENT_WIDTH - 86);
  }

  drawFooter(pdf, pageNumber, 4, brand.predictionLabel);
};

export const createSoundvisionReportDocument = async (
  model: SoundvisionReportModel,
  assets: SoundvisionReportAssets = {},
): Promise<jsPDF> => {
  const errors = validateSoundvisionReport(model);
  if (errors.length > 0) throw new Error(errors.join(' '));

  const JsPDF = await loadJsPDF();
  const pdf = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({
    title: `${SOUNDVISION_REPORT_BRANDS[model.system].reportLabel} - ${model.eventTitle}`,
    subject: 'Informe de predicción acústica',
    author: 'Sector-Pro',
    creator: 'Sector-Pro',
  });

  drawTitlePage(pdf, model, assets);
  model.plots.forEach((plot, index) => {
    pdf.addPage();
    drawPlotPage(pdf, model, plot, index + 2, assets);
  });
  return pdf;
};

export const generateSoundvisionReportPdf = async (
  model: SoundvisionReportModel,
  assets: SoundvisionReportAssets = {},
): Promise<Blob> => {
  const pdf = await createSoundvisionReportDocument(model, assets);
  return pdf.output('blob') as Blob;
};
