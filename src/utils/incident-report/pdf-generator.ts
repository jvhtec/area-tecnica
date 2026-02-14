import { PDFDocument } from '@/utils/hoja-de-ruta/pdf/core/pdf-document';
import { LogoService } from '@/utils/hoja-de-ruta/pdf/services/logo-service';
import { uploadJobPdfWithCleanup } from '@/utils/jobDocumentsUpload';
import { getCompanyLogo } from '@/utils/pdf/logoUtils';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { es } from 'date-fns/locale';

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

// Content box styling constants
const BOX_PADDING = 10;
const LINE_HEIGHT = 5.5;

/**
 * Computes box metrics (lines and height) for text content.
 */
function computeBoxMetrics(
  pdfDoc: PDFDocument,
  text: string,
  pageWidth: number
): { lines: string[]; boxHeight: number } {
  const contentWidth = pageWidth - 40;
  const lines = pdfDoc.document.splitTextToSize(text, contentWidth - 16);
  const boxHeight = Math.max(30, lines.length * LINE_HEIGHT + BOX_PADDING * 2);
  return { lines, boxHeight };
}

/**
 * Calculates the height needed for a content box without drawing it.
 */
function calculateContentBoxHeight(
  pdfDoc: PDFDocument,
  text: string,
  pageWidth: number
): number {
  const { boxHeight } = computeBoxMetrics(pdfDoc, text, pageWidth);
  return boxHeight + 12; // +12 for spacing after
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
  const { lines, boxHeight } = computeBoxMetrics(pdfDoc, text, pageWidth);

  // Background
  pdfDoc.setFillColor(250, 250, 252);
  pdfDoc.addRect(20, yPosition, contentWidth, boxHeight, 'F');

  // Border
  pdfDoc.document.setDrawColor(220, 220, 230);
  pdfDoc.document.setLineWidth(0.3);
  pdfDoc.document.rect(20, yPosition, contentWidth, boxHeight);

  // Text
  pdfDoc.setText(10, [30, 30, 40]);
  pdfDoc.document.text(lines, 28, yPosition + BOX_PADDING + 3);

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

  const currentDate = toZonedTime(new Date(), 'Europe/Madrid');
  const dateStr = format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
  const timeStr = format(currentDate, 'HH:mm');

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
      ['Fecha de inicio', format(toZonedTime(new Date(data.jobStartDate), 'Europe/Madrid'), "EEE, d 'de' MMMM 'de' yyyy", { locale: es })],
      ['Fecha de fin', format(toZonedTime(new Date(data.jobEndDate), 'Europe/Madrid'), "EEE, d 'de' MMMM 'de' yyyy", { locale: es })]
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
  const issueBoxHeight = calculateContentBoxHeight(pdfDoc, data.issue, pageWidth);
  yPosition = pdfDoc.checkPageBreak(yPosition, 22 + issueBoxHeight); // 22 for section header
  yPosition = addSectionHeader(pdfDoc, 'DESCRIPCIÓN DE LA INCIDENCIA', yPosition, pageWidth);

  pdfDoc.setText(10, [30, 30, 40]);
  yPosition = addContentBox(pdfDoc, data.issue, yPosition, pageWidth);

  // ── ACTIONS TAKEN ───────────────────────────────────────────────
  const actionsBoxHeight = calculateContentBoxHeight(pdfDoc, data.actionsTaken, pageWidth);
  yPosition = pdfDoc.checkPageBreak(yPosition, 22 + actionsBoxHeight); // 22 for section header
  yPosition = addSectionHeader(pdfDoc, 'ACCIONES REALIZADAS', yPosition, pageWidth);

  pdfDoc.setText(10, [30, 30, 40]);
  yPosition = addContentBox(pdfDoc, data.actionsTaken, yPosition, pageWidth);

  // ── PHOTO EVIDENCE ──────────────────────────────────────────────
  if (data.photos && data.photos.length > 0) {
    const contentWidth = pageWidth - 40;
    const maxPhotosPerRow = 2;
    const photoGap = 8;
    const photoWidth = (contentWidth - photoGap * (maxPhotosPerRow - 1)) / maxPhotosPerRow;
    const photoHeight = photoWidth * 0.75; // 4:3 aspect ratio

    // Check page break for header + first photo row together so they don't split
    const sectionHeaderHeight = 22;
    const firstRowHeight = photoHeight + 10; // photo + label space
    yPosition = pdfDoc.checkPageBreak(yPosition, sectionHeaderHeight + firstRowHeight);
    yPosition = addSectionHeader(pdfDoc, 'EVIDENCIA FOTOGRÁFICA', yPosition, pageWidth);

    for (let i = 0; i < data.photos.length; i++) {
      const col = i % maxPhotosPerRow;
      const isNewRow = col === 0;

      if (isNewRow && i > 0) {
        yPosition += photoHeight + photoGap;
        // Check page break before subsequent rows
        yPosition = pdfDoc.checkPageBreak(yPosition, photoHeight + 10);
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
  // Load Sector Pro logo for footer
  let footerLogoData: string | null = null;
  let footerLogoDims = { width: 0, height: 0 };
  try {
    const companyLogoImg = await getCompanyLogo();
    if (companyLogoImg) {
      // Convert HTMLImageElement to data URL via canvas
      const canvas = document.createElement('canvas');
      canvas.width = companyLogoImg.naturalWidth || companyLogoImg.width;
      canvas.height = companyLogoImg.naturalHeight || companyLogoImg.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(companyLogoImg, 0, 0);
        footerLogoData = canvas.toDataURL('image/png');
        // Scale to fit footer: max 8px high, max 50px wide
        const maxH = 8, maxW = 50;
        const scale = Math.min(maxH / canvas.height, maxW / canvas.width);
        footerLogoDims = {
          width: Math.round(canvas.width * scale),
          height: Math.round(canvas.height * scale)
        };
      }
    }
  } catch (error) {
    console.warn('Could not load Sector Pro logo for footer:', error);
  }

  // Apply footer to every page
  const totalPages = pdfDoc.document.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    pdfDoc.document.setPage(page);
    const footerY = pageHeight - 20;
    const bottomTextY = pageHeight - 10;

    // Footer separator line
    pdfDoc.document.setDrawColor(125, 1, 1);
    pdfDoc.document.setLineWidth(0.5);
    pdfDoc.document.line(20, footerY, pageWidth - 20, footerY);

    // Sector Pro logo centered
    if (footerLogoData && footerLogoDims.width > 0) {
      const logoX = (pageWidth - footerLogoDims.width) / 2;
      const logoY = footerY + 2;
      pdfDoc.addImage(footerLogoData, 'PNG', logoX, logoY, footerLogoDims.width, footerLogoDims.height);
    } else {
      // Fallback text if logo not available
      pdfDoc.setText(8, [125, 1, 1]);
      pdfDoc.addText('Sector Pro', pageWidth / 2, bottomTextY, { align: 'center' });
    }

    // Page number on left
    pdfDoc.setText(7, [140, 140, 150]);
    pdfDoc.addText(`Pág. ${page} de ${totalPages}`, 20, bottomTextY);

    // Job name on right
    const truncatedTitle = data.jobTitle.length > 40 ? data.jobTitle.substring(0, 40) + '...' : data.jobTitle;
    pdfDoc.addText(truncatedTitle, pageWidth - 20, bottomTextY, { align: 'right' });
  }

  // ── OUTPUT ──────────────────────────────────────────────────────
  const safeJobTitle = data.jobTitle.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
  const timeStamp = format(currentDate, 'yyyy-MM-dd_HH-mm-ss');
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
