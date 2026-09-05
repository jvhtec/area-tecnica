import { PDFDocument } from '../hoja-de-ruta/pdf/core/pdf-document';
import { LogoService } from '../hoja-de-ruta/pdf/services/logo-service';
import { uploadJobPdfWithCleanup } from '../jobDocumentsUpload';
import {
  REPORT_ACCENT,
  REPORT_HAIRLINE,
  REPORT_INK,
  REPORT_RULE,
  REPORT_SOFT,
  distributeColumnWidths,
  drawReportMasthead,
  drawReportSectionHeading,
  loadReportIssuerMark,
  reportTableDefaults,
  setReportMonoText,
  setReportText,
  stampReportChrome,
  type ReportChromeOptions,
} from '@/utils/pdf/report-system';

interface StagePlotItem {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  color: string;
  input?: string;
  mix?: string;
  notes?: string;
  scale?: number;
}

interface StagePlotData {
  jobId?: string;
  jobTitle?: string;
  bandName: string;
  stage: {
    w: number;
    d: number;
  };
  items: StagePlotItem[];
  notes: string;
  view: 'audience' | 'stage';
}

// Simple icon representations using Unicode symbols and shapes
const ELEMENT_ICONS: Record<string, string> = {
  'Voz': '🎤',
  'Guitarra': '🎸',
  'Bajo': '🎸',
  'Teclados': '🎹',
  'Batería': '🥁',
  'Amplificador': '🔊',
  'Cuña': '📐',
  'Auricular': '🎧',
  'DI': '📦',
  'Pie de micrófono': '⚡',
  'Toma de corriente': '🔌',
  'Tarima': '⬜',
	  'Consola FOH': '🎛️'
	};

const DEFAULT_ITEM_COLOR = '#4aa3ff';

const clampByte = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(255, Math.max(0, Math.round(value)));
};

const normalizeHexColor = (color: string | undefined | null) => {
  if (!color) return DEFAULT_ITEM_COLOR;

  const trimmed = color.trim();
  const match = trimmed.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) return DEFAULT_ITEM_COLOR;

  let hex = match[1];
  if (hex.length === 3) {
    hex = hex.split('').map((ch) => ch + ch).join('');
  }

  return `#${hex}`;
};

const hexToRgb = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return {
    r: clampByte(r),
    g: clampByte(g),
    b: clampByte(b),
  };
};

export const generateStagePlotPDF = async (
  data: StagePlotData,
  options: {
    saveToDatabase?: boolean;
    downloadLocal?: boolean;
    jobId?: string;
  } = { saveToDatabase: false, downloadLocal: true }
): Promise<{ filename: string }> => {
  const pdfDoc = new PDFDocument();
  const doc = pdfDoc.document;

  // Load the job mark for the title block and the Sector-Pro mark for the head.
  let logoImage: HTMLImageElement | null = null;
  if (options.jobId || data.jobId) {
    try {
      const logoData = await LogoService.loadJobLogo(options.jobId || data.jobId!);
      if (logoData) {
        logoImage = await new Promise<HTMLImageElement | null>((resolve) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => resolve(null);
          image.src = logoData;
        });
      }
    } catch (error) {
      console.warn('Could not load logo:', error);
    }
  }
  await loadReportIssuerMark();

  const currentDate = new Date();
  const dateStr = currentDate.toLocaleDateString('es-ES');
  const title = data.bandName || data.jobTitle || 'Plano de escenario';

  const chrome: ReportChromeOptions = {
    kind: 'schedule',
    kindLabel: 'Plano de escenario',
    eventTitle: title,
    contextLabel: dateStr,
  };

  const { geo, y: contentTop } = drawReportMasthead(doc, {
    ...chrome,
    title,
    subtitle: data.jobTitle && data.jobTitle !== title
      ? `Plano de escenario · ${data.jobTitle}`
      : 'Plano de escenario',
    clientLogo: logoImage,
    meta: [
      { label: 'Dimensiones', value: `${data.stage.w} × ${data.stage.d} m` },
      { label: 'Elementos', value: String(data.items.length) },
      { label: 'Fecha', value: dateStr },
    ],
  });

  let yPosition = contentTop;

  // Calculate stage drawing area
  const stageMargin = geo.left;
  const stageDrawWidth = geo.contentWidth;
  const stageDrawHeight = 140; // Fixed height for stage diagram
  const stageStartY = yPosition + 6;

  // The stage edge is the only accent rule on the page; everything inside it is
  // the drawing's own colour coding.
  doc.setDrawColor(...REPORT_ACCENT);
  doc.setLineWidth(0.5);
  doc.rect(stageMargin, stageStartY, stageDrawWidth, stageDrawHeight);

  setReportMonoText(doc, REPORT_SOFT, 5.8, 'bold');
  doc.text(
    data.view === 'audience' ? '← PÚBLICO' : 'ESCENARIO →',
    stageMargin,
    stageStartY - 3,
    { charSpace: 0.2 },
  );

  // Draw grid
  doc.setDrawColor(...REPORT_RULE);
  doc.setLineWidth(REPORT_HAIRLINE);
  const gridStep = 20;
  for (let i = gridStep; i < stageDrawWidth; i += gridStep) {
    pdfDoc.document.line(
      stageMargin + i,
      stageStartY,
      stageMargin + i,
      stageStartY + stageDrawHeight
    );
  }
  for (let i = gridStep; i < stageDrawHeight; i += gridStep) {
    pdfDoc.document.line(
      stageMargin,
      stageStartY + i,
      stageMargin + stageDrawWidth,
      stageStartY + i
    );
  }

  // Draw items on stage
  const scaleX = stageDrawWidth / data.stage.w;
  const scaleY = stageDrawHeight / data.stage.d;

  data.items.forEach((item) => {
    const scale = item.scale || 1;
    const itemX = stageMargin + (item.x * scaleX);
    const itemY = stageStartY + (item.y * scaleY);
	    const itemW = item.w * scaleX * scale;
	    const itemH = item.h * scaleY * scale;

	    // Parse color (hex to RGB)
	    const hexColor = normalizeHexColor(item.color);
	    const { r, g, b } = hexToRgb(hexColor);

	    // Draw item box with color
	    pdfDoc.document.setFillColor(r, g, b);
	    pdfDoc.document.setDrawColor(Math.max(0, r - 30), Math.max(0, g - 30), Math.max(0, b - 30));
	    pdfDoc.document.setLineWidth(1);

    // Apply rotation if needed
    if (item.rot && item.rot !== 0) {
      const centerX = itemX + itemW / 2;
      const centerY = itemY + itemH / 2;
      const radians = (item.rot * Math.PI) / 180;
      const matrix = pdfDoc.document.Matrix(
        Math.cos(radians),
        Math.sin(radians),
        -Math.sin(radians),
        Math.cos(radians),
        centerX,
        centerY
      );
      pdfDoc.document.advancedAPI((doc) => {
        doc.saveGraphicsState();
        doc.setCurrentTransformationMatrix(matrix);
        doc.rect(-itemW / 2, -itemH / 2, itemW, itemH, 'FD');
        doc.restoreGraphicsState();
      });
    } else {
      pdfDoc.document.rect(itemX, itemY, itemW, itemH, 'FD');
    }

    // Draw icon/emoji
    const icon = ELEMENT_ICONS[item.type] || '●';
    pdfDoc.setText(Math.min(itemH * 0.6, 12), [255, 255, 255]);
    pdfDoc.addText(icon, itemX + itemW / 2, itemY + itemH / 2 - 2, { align: 'center' });

    // Draw label
    if (item.label) {
      pdfDoc.setText(Math.min(itemH * 0.4, 8), [0, 0, 0]);
      pdfDoc.addText(item.label, itemX + itemW / 2, itemY + itemH + 3, { align: 'center' });
    }

    // Draw input/mix info if present
    if (item.input || item.mix) {
      const info = [item.input, item.mix].filter(Boolean).join(' | ');
      pdfDoc.setText(6, [100, 100, 100]);
      pdfDoc.addText(info, itemX + itemW / 2, itemY + itemH + 8, { align: 'center' });
    }
  });

  yPosition = stageStartY + stageDrawHeight + 22;

  // The input list and the monitor mixes sit side by side: they are read
  // together at the desk, and neither is long enough to earn the full width.
  const columnGap = 8;
  const columnWidth = (geo.contentWidth - columnGap) / 2;
  const rightColumnX = geo.left + columnWidth + columnGap;

  const inputItems = data.items.filter((item) => item.input);
  const mixItems = data.items.filter((item) => item.mix);
  const tablesTop = drawReportSectionHeading(
    doc,
    geo,
    inputItems.length > 0 ? 'Entradas y mezclas' : 'Mezclas',
    yPosition,
    1,
  );
  let tablesBottom = tablesTop;

  if (inputItems.length > 0) {
    pdfDoc.addTable({
      startY: tablesTop,
      head: [['Canal', 'Fuente', 'Mezcla']],
      body: inputItems.map((item) => [item.input || '—', item.label || item.type, item.mix || '—']),
      ...reportTableDefaults(geo, { fontSize: 6.6, numericColumns: [0] }),
      margin: { left: geo.left, right: geo.pageWidth - geo.left - columnWidth },
      columnStyles: distributeColumnWidths([16, 40, 20], columnWidth),
      tableWidth: columnWidth,
    });
    tablesBottom = Math.max(tablesBottom, pdfDoc.getLastAutoTableY());
  }

  if (mixItems.length > 0) {
    pdfDoc.addTable({
      startY: tablesTop,
      head: [['Mezcla', 'Quién']],
      body: Array.from(new Set(mixItems.map((item) => item.mix)))
        .filter(Boolean)
        .map((mix) => [
          mix!,
          mixItems
            .filter((item) => item.mix === mix)
            .map((item) => item.label || item.type)
            .join(', '),
        ]),
      ...reportTableDefaults(geo, { fontSize: 6.6, numericColumns: [0] }),
      margin: { left: rightColumnX, right: geo.pageWidth - geo.right },
      columnStyles: distributeColumnWidths([20, 56], columnWidth),
      tableWidth: columnWidth,
    });
    tablesBottom = Math.max(tablesBottom, pdfDoc.getLastAutoTableY());
  }

  yPosition = tablesBottom + 14;

  if (data.notes && data.notes.trim()) {
    yPosition = drawReportSectionHeading(doc, geo, 'Notas del evento', yPosition, 2);
    setReportText(doc, REPORT_INK, 8);
    const notesLines = doc.splitTextToSize(data.notes, geo.contentWidth) as string[];
    doc.text(notesLines, geo.left, yPosition, { lineHeightFactor: 1.35 });
  }

  stampReportChrome(doc, chrome);

  // Generate filename
  const safeName = (data.bandName || data.jobTitle || 'plano-escenario')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const filename = `${safeName}-${dateStr.replace(/\//g, '-')}.pdf`;

  // Generate PDF blob
  const pdfBlob = pdfDoc.outputBlob();

  // Download locally if requested
  if (options.downloadLocal) {
    pdfDoc.save(filename);
  }

  // Upload to database if requested
  if (options.saveToDatabase && (options.jobId || data.jobId)) {
    try {
      await uploadJobPdfWithCleanup(
        options.jobId || data.jobId!,
        pdfBlob,
        filename,
        'stage-plots'
      );
    } catch (error) {
      console.error('Error uploading stage plot PDF:', error);
      throw error;
    }
  }

  return { filename };
};
