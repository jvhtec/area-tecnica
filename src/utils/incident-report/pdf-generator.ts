import { PDFDocument } from '../hoja-de-ruta/pdf/core/pdf-document';
import { LogoService } from '../hoja-de-ruta/pdf/services/logo-service';
import { uploadJobPdfWithCleanup } from '../jobDocumentsUpload';

interface IncidentReportPDFData {
  jobId: string;
  jobTitle: string;
  jobStartDate: string;
  jobEndDate: string;
  equipmentModel: string;
  brand: string;
  issue: string;
  actionsTaken: string;
  techName: string;
  signature: string;
  photos?: string[]; // base64 data URLs of uploaded photos
}

/**
 * Converts a base64 data URL to a format suitable for jsPDF.
 * Returns { data, format } where format is 'JPEG' or 'PNG'.
 */
function parseImageDataUrl(dataUrl: string): { data: string; format: 'JPEG' | 'PNG' } {
  if (dataUrl.startsWith('data:image/png')) {
    return { data: dataUrl, format: 'PNG' };
  }
  // Default to JPEG for jpg, webp, or anything else
  return { data: dataUrl, format: 'JPEG' };
}

/**
 * Draws a section header with the red accent bar and title text.
 */
function addSectionHeader(pdfDoc: PDFDocument, title: string, yPosition: number, pageWidth: number): number {
  // Red accent bar
  pdfDoc.setFillColor(125, 1, 1);
  pdfDoc.addRect(20, yPosition - 2, 4, 16, 'F');

  pdfDoc.setText(12, [125, 1, 1]);
  pdfDoc.addText(title, 30, yPosition + 10);

  return yPosition + 22;
}

/**
 * Draws a text content box with background and border.
 */
function addContentBox(
  pdfDoc: PDFDocument,
  text: string,
  yPosition: number,
  pageWidth: number
): number {
  const contentWidth = pageWidth - 40;
  const lines = pdfDoc.document.splitTextToSize(text, contentWidth - 16);
  const lineHeight = 5.5;
  const boxPadding = 10;
  const boxHeight = Math.max(30, lines.length * lineHeight + boxPadding * 2);

  // Background
  pdfDoc.setFillColor(250, 250, 252);
  pdfDoc.addRect(20, yPosition, contentWidth, boxHeight, 'F');

  // Border
  pdfDoc.document.setDrawColor(220, 220, 230);
  pdfDoc.document.setLineWidth(0.3);
  pdfDoc.document.rect(20, yPosition, contentWidth, boxHeight);

  // Text
  pdfDoc.setText(10, [30, 30, 40]);
  pdfDoc.document.text(lines, 28, yPosition + boxPadding + 3);

  return yPosition + boxHeight + 12;
}

export const generateIncidentReportPDF = async (
  data: IncidentReportPDFData,
  options: { saveToDatabase?: boolean; downloadLocal?: boolean } = { saveToDatabase: false, downloadLocal: true }
): Promise<{ documentId?: string; filename: string }> => {
  const pdfDoc = new PDFDocument();
  const { width: pageWidth, height: pageHeight } = pdfDoc.dimensions;

  // Load company logo
  let logoData: string | null = null;
  try {
    logoData = await LogoService.loadJobLogo(data.jobId);
  } catch (error) {
    console.warn('Could not load logo:', error);
  }

  // ── HEADER ──────────────────────────────────────────────────────
  // Dark gradient-style header
  pdfDoc.setFillColor(125, 1, 1);
  pdfDoc.addRect(0, 0, pageWidth, 48, 'F');

  // Subtle darker strip at bottom of header
  pdfDoc.setFillColor(100, 0, 0);
  pdfDoc.addRect(0, 44, pageWidth, 4, 'F');

  // Logo in header (left side)
  if (logoData) {
    try {
      const logoImg = new Image();
      logoImg.src = logoData;
      const logoHeight = 26;
      const logoWidth = logoHeight * (logoImg.width / logoImg.height) || 52;
      pdfDoc.addImage(logoData, 'PNG', 15, 11, logoWidth, logoHeight);
    } catch (error) {
      console.error("Error adding logo to incident report:", error);
    }
  }

  // Header title
  pdfDoc.setText(16, [255, 255, 255]);
  pdfDoc.addText('REPORTE DE INCIDENCIA', pageWidth / 2, 22, { align: 'center' });

  pdfDoc.setText(9, [255, 200, 200]);
  pdfDoc.addText('DEPARTAMENTO DE SONIDO', pageWidth / 2, 34, { align: 'center' });

  // ── METADATA BAR ────────────────────────────────────────────────
  pdfDoc.setFillColor(245, 245, 248);
  pdfDoc.addRect(0, 48, pageWidth, 18, 'F');

  const currentDate = new Date();
  const dateStr = currentDate.toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const timeStr = currentDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  pdfDoc.setText(8, [100, 100, 110]);
  pdfDoc.addText(`Fecha: ${dateStr}  •  Hora: ${timeStr}  •  Técnico: ${data.techName}`, pageWidth / 2, 59, { align: 'center' });

  let yPosition = 78;

  // ── JOB INFORMATION ─────────────────────────────────────────────
  yPosition = addSectionHeader(pdfDoc, 'INFORMACIÓN DEL TRABAJO', yPosition, pageWidth);

  pdfDoc.addTable({
    startY: yPosition,
    head: [['Campo', 'Detalle']],
    body: [
      ['Trabajo', data.jobTitle],
      ['Fecha de inicio', new Date(data.jobStartDate).toLocaleDateString('es-ES', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })],
      ['Fecha de fin', new Date(data.jobEndDate).toLocaleDateString('es-ES', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })]
    ],
    margin: { left: 20, right: 20 },
    styles: {
      fontSize: 9,
      cellPadding: 5,
      lineColor: [220, 220, 230],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [125, 1, 1],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 45, textColor: [60, 60, 70] },
      1: { textColor: [30, 30, 40] }
    },
    alternateRowStyles: {
      fillColor: [250, 250, 252]
    }
  });

  yPosition = pdfDoc.getLastAutoTableY() + 16;

  // ── EQUIPMENT INFORMATION ───────────────────────────────────────
  yPosition = pdfDoc.checkPageBreak(yPosition, 60);
  yPosition = addSectionHeader(pdfDoc, 'INFORMACIÓN DEL EQUIPO', yPosition, pageWidth);

  pdfDoc.addTable({
    startY: yPosition,
    head: [['Campo', 'Detalle']],
    body: [
      ['Marca', data.brand],
      ['Modelo', data.equipmentModel]
    ],
    margin: { left: 20, right: 20 },
    styles: {
      fontSize: 9,
      cellPadding: 5,
      lineColor: [220, 220, 230],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [125, 1, 1],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 45, textColor: [60, 60, 70] },
      1: { textColor: [30, 30, 40] }
    },
    alternateRowStyles: {
      fillColor: [250, 250, 252]
    }
  });

  yPosition = pdfDoc.getLastAutoTableY() + 16;

  // ── INCIDENT DESCRIPTION ────────────────────────────────────────
  yPosition = pdfDoc.checkPageBreak(yPosition, 60);
  yPosition = addSectionHeader(pdfDoc, 'DESCRIPCIÓN DE LA INCIDENCIA', yPosition, pageWidth);

  pdfDoc.setText(10, [30, 30, 40]);
  yPosition = addContentBox(pdfDoc, data.issue, yPosition, pageWidth);

  // ── ACTIONS TAKEN ───────────────────────────────────────────────
  yPosition = pdfDoc.checkPageBreak(yPosition, 60);
  yPosition = addSectionHeader(pdfDoc, 'ACCIONES REALIZADAS', yPosition, pageWidth);

  pdfDoc.setText(10, [30, 30, 40]);
  yPosition = addContentBox(pdfDoc, data.actionsTaken, yPosition, pageWidth);

  // ── PHOTO EVIDENCE ──────────────────────────────────────────────
  if (data.photos && data.photos.length > 0) {
    yPosition = pdfDoc.checkPageBreak(yPosition, 80);
    yPosition = addSectionHeader(pdfDoc, 'EVIDENCIA FOTOGRÁFICA', yPosition, pageWidth);

    const contentWidth = pageWidth - 40;
    const maxPhotosPerRow = 2;
    const photoGap = 8;
    const photoWidth = (contentWidth - photoGap * (maxPhotosPerRow - 1)) / maxPhotosPerRow;
    const photoHeight = photoWidth * 0.75; // 4:3 aspect ratio

    for (let i = 0; i < data.photos.length; i++) {
      const col = i % maxPhotosPerRow;
      const isNewRow = col === 0;

      if (isNewRow && i > 0) {
        yPosition += photoHeight + photoGap;
      }

      // Check page break before each new row
      if (isNewRow) {
        yPosition = pdfDoc.checkPageBreak(yPosition, photoHeight + 20);
      }

      const xOffset = 20 + col * (photoWidth + photoGap);

      // Photo border/frame
      pdfDoc.document.setDrawColor(220, 220, 230);
      pdfDoc.document.setLineWidth(0.3);
      pdfDoc.setFillColor(250, 250, 252);
      pdfDoc.addRect(xOffset, yPosition, photoWidth, photoHeight, 'FD');

      // Add photo
      try {
        const { data: imgData, format } = parseImageDataUrl(data.photos[i]);
        pdfDoc.addImage(imgData, format, xOffset + 1, yPosition + 1, photoWidth - 2, photoHeight - 2);
      } catch (error) {
        // Fallback: show placeholder text
        console.error('Error adding photo to PDF:', error);
        pdfDoc.setText(8, [150, 150, 160]);
        pdfDoc.addText('Error al cargar imagen', xOffset + photoWidth / 2, yPosition + photoHeight / 2, { align: 'center' });
      }

      // Photo label
      pdfDoc.setText(7, [120, 120, 130]);
      pdfDoc.addText(`Foto ${i + 1}`, xOffset + photoWidth / 2, yPosition + photoHeight + 5, { align: 'center' });
    }

    // Advance past the last row of photos
    yPosition += photoHeight + 14;
  }

  // ── SIGNATURE ───────────────────────────────────────────────────
  yPosition = pdfDoc.checkPageBreak(yPosition, 90);
  yPosition = addSectionHeader(pdfDoc, 'FIRMA DEL TÉCNICO', yPosition, pageWidth);

  // Technician name
  pdfDoc.setText(10, [60, 60, 70]);
  pdfDoc.addText(`Técnico: ${data.techName}`, 20, yPosition + 4);
  yPosition += 12;

  // Signature image
  if (data.signature) {
    try {
      // Signature box
      pdfDoc.setFillColor(255, 255, 255);
      pdfDoc.addRect(20, yPosition, 150, 45, 'F');
      pdfDoc.document.setDrawColor(200, 200, 210);
      pdfDoc.document.setLineWidth(0.3);
      pdfDoc.document.rect(20, yPosition, 150, 45);

      // Signature image
      pdfDoc.addImage(data.signature, 'PNG', 25, yPosition + 2, 140, 40);

      yPosition += 50;
    } catch (error) {
      console.error("Error adding signature image:", error);
      pdfDoc.setText(10, [100, 100, 110]);
      pdfDoc.addText('Firmado digitalmente', 25, yPosition + 20);
      yPosition += 30;
    }
  }

  // Signature timestamp
  pdfDoc.setText(8, [140, 140, 150]);
  pdfDoc.addText(`Fecha y hora de firma: ${dateStr} ${timeStr}`, 20, yPosition + 5);

  // ── FOOTER ──────────────────────────────────────────────────────
  // Footer on every page
  const totalPages = pdfDoc.document.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    pdfDoc.document.setPage(page);
    const footerY = pageHeight - 22;

    // Footer line
    pdfDoc.document.setDrawColor(125, 1, 1);
    pdfDoc.document.setLineWidth(0.5);
    pdfDoc.document.line(20, footerY, pageWidth - 20, footerY);

    // Footer text
    pdfDoc.setText(7, [140, 140, 150]);
    pdfDoc.addText('Reporte generado automáticamente por Sector Pro', 20, footerY + 8);
    pdfDoc.addText(`Página ${page} de ${totalPages}`, pageWidth - 20, footerY + 8, { align: 'right' });
  }

  // ── OUTPUT ──────────────────────────────────────────────────────
  const safeJobTitle = data.jobTitle.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
  const timeStamp = currentDate.toISOString().replace(/[:.]/g, '-');
  const filename = `reporte_incidencia_${safeJobTitle}_${timeStamp}.pdf`;

  if (options.saveToDatabase) {
    const pdfOutput = pdfDoc.document.output('blob');

    try {
      await uploadJobPdfWithCleanup(
        data.jobId,
        pdfOutput,
        filename,
        'incident-reports'
      );

      if (options.downloadLocal) {
        pdfDoc.save(filename);
      }

      return { filename };
    } catch (error) {
      console.error('Error uploading incident report to database:', error);
      throw error;
    }
  } else {
    pdfDoc.save(filename);
    return { filename };
  }
};
