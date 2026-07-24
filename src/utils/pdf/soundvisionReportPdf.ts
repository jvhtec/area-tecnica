import type jsPDF from 'jspdf';
import {
  SOUNDVISION_REPORT_BRANDS,
  validateSoundvisionReport,
  type SoundvisionPdfImage,
  type SoundvisionReportConditions,
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
const PAGE_HEIGHT = 297;
const LEFT = 25.4;
const RIGHT = 16.4;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT - RIGHT;
const FOOTER_Y = 280;

const INK: PdfRgb = [23, 20, 15];
const SOFT: PdfRgb = [122, 115, 106];
const GOLD: PdfRgb = [160, 122, 51];
const RULE: PdfRgb = [228, 223, 214];
const PLOT_BORDER: PdfRgb = [221, 217, 209];
const WATERMARK: PdfRgb = [244, 239, 226];

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
      reject(new Error('Image dimensions can only be read in a browser.'));
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

const rotatedPoint = (
  centerX: number,
  centerY: number,
  localX: number,
  localY: number,
  angle: number,
): [number, number] => {
  const radians = angle * Math.PI / 180;
  return [
    centerX + localX * Math.cos(radians) - localY * Math.sin(radians),
    centerY + localX * Math.sin(radians) + localY * Math.cos(radians),
  ];
};

const drawCabinet = (
  pdf: jsPDF,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  angle: number,
): void => {
  const corners = [
    rotatedPoint(centerX, centerY, -width / 2, -height / 2, angle),
    rotatedPoint(centerX, centerY, width / 2, -height / 2, angle),
    rotatedPoint(centerX, centerY, width / 2, height / 2, angle),
    rotatedPoint(centerX, centerY, -width / 2, height / 2, angle),
  ];
  corners.forEach((point, index) => {
    const next = corners[(index + 1) % corners.length];
    pdf.line(point[0], point[1], next[0], next[1]);
  });
  const faceStart = rotatedPoint(centerX, centerY, width * 0.28, -height * 0.18, angle);
  const faceEnd = rotatedPoint(centerX, centerY, width * 0.28, height * 0.18, angle);
  pdf.line(faceStart[0], faceStart[1], faceEnd[0], faceEnd[1]);
};

const drawArrayWatermark = (
  pdf: jsPDF,
  x: number,
  y: number,
  scale = 1,
): void => {
  pdf.setDrawColor(...WATERMARK);
  pdf.setLineWidth(0.32);

  const drawHang = (baseX: number, cabinets: number, cabinetScale: number) => {
    const width = 15 * scale * cabinetScale;
    const height = 6.2 * scale * cabinetScale;
    pdf.rect(baseX - width / 2, y - 5 * scale, width, 3.2 * scale);
    pdf.line(baseX, y - 8 * scale, baseX, y - 5 * scale);

    for (let index = 0; index < cabinets; index += 1) {
      const progress = cabinets === 1 ? 0 : index / (cabinets - 1);
      const angle = progress * progress * 24;
      const centerX = baseX + progress * progress * 7 * scale;
      const centerY = y + index * height * 0.92;
      drawCabinet(pdf, centerX, centerY, width, height, angle);
    }
  };

  drawHang(x, 12, 0.86);
  drawHang(x + 18 * scale, 9, 0.72);
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

  drawImage(pdf, assets.predictionLogo, {
    x: PAGE_WIDTH - RIGHT - 8,
    y: 13.5,
    width: 8,
    height: 8,
  });
  setMono(pdf, 'bold');
  pdf.setFontSize(5.8);
  pdf.setTextColor(...SOFT);
  pdf.text(brand.predictionLabel.toUpperCase(), PAGE_WIDTH - RIGHT - 12, 18.7, {
    align: 'right',
    charSpace: 0.75,
  });

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
  pdf.text(`SECTOR-PRO | SYSTEM DESIGN & ${predictionLabel.toUpperCase()}`, LEFT, FOOTER_Y + 5, {
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
  setMono(pdf, 'bold');
  pdf.setFontSize(6.8);
  pdf.setTextColor(...GOLD);
  pdf.text(number, LEFT, y);
  setSans(pdf, 'bold');
  pdf.setFontSize(7.8);
  pdf.setTextColor(...INK);
  pdf.text(title.toUpperCase(), LEFT + 9, y, { charSpace: 0.7 });
  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(0.25);
  const ruleStart = LEFT + 9 + Math.min(55, pdf.getTextWidth(title.toUpperCase()) + 7);
  pdf.line(ruleStart, y - 1, PAGE_WIDTH - RIGHT, y - 1);
};

const conditionValues = (conditions: SoundvisionReportConditions) => [
  ['Temperature', `${conditions.temperatureC} °C`],
  ['Relative humidity', `${conditions.humidityPercent} %`],
  ['Input level', `${conditions.inputLevelDbu} dBu`],
  ['Air absorption', 'Applied'],
  ['Audience plane', `${conditions.audiencePlaneM} m AGL`],
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

const drawTitlePage = (
  pdf: jsPDF,
  model: SoundvisionReportModel,
  assets: SoundvisionReportAssets,
): void => {
  const brand = SOUNDVISION_REPORT_BRANDS[model.system];
  drawHeader(pdf, model, assets);
  drawRail(pdf, model);
  drawArrayWatermark(pdf, 199, 43, 0.72);

  setMono(pdf, 'bold');
  pdf.setFontSize(6.5);
  pdf.setTextColor(...GOLD);
  pdf.text(`SYSTEM PREDICTION | REV ${model.revision.toUpperCase()}`, LEFT, 42, {
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
    ['Issued', model.issuedDate],
    ['System', brand.manufacturer],
    ['Prediction', brand.reportLabel.replace(/ report$/i, '')],
    ['Designed by', 'Sector-Pro'],
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
  drawSectionHeading(pdf, '01', 'System schedule', scheduleHeadingY);
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
  drawSectionHeading(pdf, '02', 'Prediction conditions', conditionsHeadingY);
  drawConditions(pdf, model.conditions, conditionsHeadingY + 5.5, false);
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
  pdf.text('PARAMETERS', x, y, { charSpace: 0.7 });
  pdf.setDrawColor(...RULE);
  pdf.line(x, y + 2.5, x + width, y + 2.5);

  const rows = [
    ['Weighting', plot.weighting],
    ['Band', plot.band],
    ['Temperature', `${conditions.temperatureC} °C`],
    ['Rel. humidity', `${conditions.humidityPercent} %`],
    ['Audience plane', `${conditions.audiencePlaneM} m`],
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
  drawArrayWatermark(pdf, 202, 174, 0.62);

  setMono(pdf, 'bold');
  pdf.setFontSize(6.5);
  pdf.setTextColor(...GOLD);
  pdf.text(`PLOT ${String(pageNumber - 1).padStart(2, '0')}`, LEFT, 42, { charSpace: 0.9 });
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
    pdf.text(`PLAN VIEW | AUDIENCE PLANE AT ${model.conditions.audiencePlaneM} M`, main.x, main.y + main.height + 5, {
      charSpace: 0.45,
    });
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
      pdf.text('ISOMETRIC | FULL SITE', support.x, support.y + support.height + 5, {
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
    subject: 'Acoustic prediction report',
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
