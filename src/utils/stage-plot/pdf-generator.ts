import { PDFDocument } from '../hoja-de-ruta/pdf/core/pdf-document';
import { LogoService } from '../hoja-de-ruta/pdf/services/logo-service';
import { uploadJobPdfWithCleanup } from '../jobDocumentsUpload';

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

export const generateStagePlotPDF = async (
  data: StagePlotData,
  options: {
    saveToDatabase?: boolean;
    downloadLocal?: boolean;
    jobId?: string;
  } = { saveToDatabase: false, downloadLocal: true }
): Promise<{ filename: string }> => {
  const pdfDoc = new PDFDocument();
  const { width: pageWidth, height: pageHeight } = pdfDoc.dimensions;

  // Load company logo if job ID provided
  let logoData: string | null = null;
  if (options.jobId || data.jobId) {
    try {
      logoData = await LogoService.loadJobLogo(options.jobId || data.jobId!);
    } catch (error) {
      console.warn('Could not load logo:', error);
    }
  }

  // Header - Corporate Red Background
  pdfDoc.setFillColor(125, 1, 1);
  pdfDoc.addRect(0, 0, pageWidth, 50, 'F');

  // Logo in header
  if (logoData) {
    try {
      const logoImg = new Image();
      logoImg.src = logoData;
      await new Promise((resolve, reject) => {
        logoImg.onload = resolve;
        logoImg.onerror = reject;
      });
      const logoHeight = 30;
      const logoWidth = logoHeight * (logoImg.width / logoImg.height) || 60;
      pdfDoc.addImage(logoData, 'PNG', 15, 10, logoWidth, logoHeight);
    } catch (error) {
      console.error("Error adding logo to stage plot:", error);
    }
  }

  // Header title - White text
  pdfDoc.setText(18, [255, 255, 255]);
  pdfDoc.addText('PLANO DE ESCENARIO', pageWidth / 2, 20, { align: 'center' });

  if (data.bandName) {
    pdfDoc.setText(12, [255, 255, 255]);
    pdfDoc.addText(data.bandName, pageWidth / 2, 35, { align: 'center' });
  }

  let yPosition = 65;

  // Stage dimensions
  pdfDoc.setText(10, [0, 0, 0]);
  const currentDate = new Date();
  const dateStr = currentDate.toLocaleDateString('es-ES');
  pdfDoc.addText(`Fecha: ${dateStr}`, 20, yPosition);
  pdfDoc.addText(`Dimensiones: ${data.stage.w}m x ${data.stage.d}m`, pageWidth - 80, yPosition, { align: 'right' });
  yPosition += 20;

  // Calculate stage drawing area
  const stageMargin = 30;
  const stageDrawWidth = pageWidth - (stageMargin * 2);
  const stageDrawHeight = 140; // Fixed height for stage diagram
  const stageStartY = yPosition;

  // Draw stage boundary
  pdfDoc.document.setDrawColor(125, 1, 1);
  pdfDoc.document.setLineWidth(2);
  pdfDoc.document.rect(stageMargin, stageStartY, stageDrawWidth, stageDrawHeight);

  // Draw "AUDIENCE" label
  pdfDoc.setText(10, [100, 100, 100]);
  if (data.view === 'audience') {
    pdfDoc.addText('← PÚBLICO', stageMargin + 5, stageStartY - 5);
  } else {
    pdfDoc.addText('ESCENARIO →', stageMargin + 5, stageStartY - 5);
  }

  // Draw grid
  pdfDoc.document.setDrawColor(220, 220, 220);
  pdfDoc.document.setLineWidth(0.3);
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
    const hexColor = item.color || '#4aa3ff';
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);

    // Draw item box with color
    pdfDoc.document.setFillColor(r, g, b);
    pdfDoc.document.setDrawColor(Math.max(0, r - 30), Math.max(0, g - 30), Math.max(0, b - 30));
    pdfDoc.document.setLineWidth(1);

    // Apply rotation if needed
    if (item.rot && item.rot !== 0) {
      pdfDoc.document.saveGraphicsState();
      const centerX = itemX + itemW / 2;
      const centerY = itemY + itemH / 2;
      pdfDoc.document.translate(centerX, centerY);
      pdfDoc.document.rotate((item.rot * Math.PI) / 180);
      pdfDoc.document.rect(-itemW / 2, -itemH / 2, itemW, itemH, 'FD');
      pdfDoc.document.restoreGraphicsState();
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

  yPosition = stageStartY + stageDrawHeight + 25;

  // Input List Table
  const inputItems = data.items.filter(item => item.input);
  if (inputItems.length > 0) {
    pdfDoc.setText(12, [125, 1, 1]);
    pdfDoc.addText('LISTA DE ENTRADAS', 20, yPosition);
    yPosition += 10;

    pdfDoc.addTable({
      startY: yPosition,
      head: [['Canal', 'Fuente', 'Mezcla']],
      body: inputItems.map(item => [
        item.input || '',
        item.label || item.type,
        item.mix || ''
      ]),
      margin: { left: 20, right: pageWidth / 2 + 10 },
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [248, 249, 250]
      },
      tableWidth: (pageWidth / 2) - 30
    });
  }

  // Monitor Mixes Table (on right side)
  const mixItems = data.items.filter(item => item.mix);
  if (mixItems.length > 0) {
    const mixYPosition = inputItems.length > 0 ? yPosition : yPosition + 10;

    pdfDoc.addTable({
      startY: mixYPosition,
      head: [['Mezcla', 'Quién']],
      body: Array.from(new Set(mixItems.map(item => item.mix)))
        .filter(Boolean)
        .map(mix => [
          mix!,
          mixItems
            .filter(item => item.mix === mix)
            .map(item => item.label || item.type)
            .join(', ')
        ]),
      margin: { left: pageWidth / 2 + 10, right: 20 },
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [248, 249, 250]
      },
      tableWidth: (pageWidth / 2) - 30
    });
  }

  yPosition = Math.max(
    inputItems.length > 0 ? pdfDoc.getLastAutoTableY() + 15 : yPosition + 15,
    mixItems.length > 0 ? pdfDoc.getLastAutoTableY() + 15 : yPosition + 15
  );

  // Show Notes if present
  if (data.notes && data.notes.trim()) {
    pdfDoc.setText(12, [125, 1, 1]);
    pdfDoc.addText('NOTAS DEL EVENTO', 20, yPosition);
    yPosition += 10;

    pdfDoc.setFillColor(248, 249, 250);
    const notesBoxHeight = Math.max(30, Math.ceil(data.notes.length / 100) * 5);
    pdfDoc.addRect(20, yPosition - 5, pageWidth - 40, notesBoxHeight, 'F');

    pdfDoc.document.setDrawColor(200, 200, 200);
    pdfDoc.document.setLineWidth(0.5);
    pdfDoc.document.rect(20, yPosition - 5, pageWidth - 40, notesBoxHeight);

    pdfDoc.setText(9, [0, 0, 0]);
    const notesLines = pdfDoc.document.splitTextToSize(data.notes, pageWidth - 50);
    pdfDoc.document.text(notesLines, 25, yPosition + 3);
  }

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
