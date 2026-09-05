import { PDFDocument } from '@/utils/hoja-de-ruta/pdf/core/pdf-document';
import { LogoService } from '@/utils/hoja-de-ruta/pdf/services/logo-service';
import { uploadJobPdfWithCleanup } from '@/utils/jobDocumentsUpload';
import { buildIncidentReportPdfFilename } from '@/utils/pdfFileNames';
import {
  REPORT_HAIRLINE,
  REPORT_RULE,
  REPORT_SOFT,
  drawReportMasthead,
  drawReportRunningHead,
  drawReportSectionHeading,
  loadReportIssuerMark,
  setReportMonoText,
  stampReportChrome,
  type ReportChromeOptions,
  type ReportGeometry,
} from '@/utils/pdf/report-system';
import { drawReportFactRows, drawReportProse } from '@/utils/pdf/report-system/blocks';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import type jsPDF from 'jspdf';

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

export const generateIncidentReportPDF = async (
  data: IncidentReportPDFData,
  options: { saveToDatabase?: boolean; downloadLocal?: boolean } = { saveToDatabase: false, downloadLocal: true }
): Promise<{ documentId?: string; filename: string }> => {
  const pdfDoc = new PDFDocument();
  const doc: jsPDF = pdfDoc.document;

  // Load the job mark for the title block and the Sector-Pro mark for the head.
  let logoImage: HTMLImageElement | null = null;
  try {
    const logoData = await LogoService.loadJobLogo(data.jobId);
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
  await loadReportIssuerMark();

  const currentDate = toZonedTime(new Date(), 'Europe/Madrid');
  const dateStr = format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
  const timeStr = format(currentDate, 'HH:mm');

  const chrome: ReportChromeOptions = {
    kind: 'incident',
    kindLabel: 'Reporte de incidencia',
    eventTitle: data.jobTitle,
    contextLabel: data.techName,
  };

  const { geo, y: mastheadBottom } = drawReportMasthead(doc, {
    ...chrome,
    title: data.jobTitle?.trim() || 'Trabajo sin título',
    subtitle: `Reporte de incidencia · Departamento de sonido`,
    clientLogo: logoImage,
    meta: [
      { label: 'Técnico', value: data.techName },
      { label: 'Fecha', value: format(currentDate, "d 'de' MMMM 'de' yyyy", { locale: es }) },
      { label: 'Hora', value: timeStr },
    ],
  });

  /**
   * Breaks to a new page when `needed` millimetres do not remain, redrawing the
   * running head so the continuation still names the incident it belongs to.
   */
  const breakIfShort = (y: number, needed: number): number => {
    if (y <= geo.contentBottom - needed) return y;
    doc.addPage();
    const pageGeo: ReportGeometry = drawReportRunningHead(doc, chrome);
    return pageGeo.contentTop;
  };

  let yPosition = drawReportSectionHeading(doc, geo, 'Información del trabajo', mastheadBottom, 1);
  yPosition = drawReportFactRows(doc, geo, [
    ['Trabajo', data.jobTitle],
    [
      'Fecha de inicio',
      format(toZonedTime(new Date(data.jobStartDate), 'Europe/Madrid'), "EEE, d 'de' MMMM 'de' yyyy", { locale: es }),
    ],
    [
      'Fecha de fin',
      format(toZonedTime(new Date(data.jobEndDate), 'Europe/Madrid'), "EEE, d 'de' MMMM 'de' yyyy", { locale: es }),
    ],
  ], yPosition);

  yPosition = breakIfShort(yPosition + 4, 40);
  yPosition = drawReportSectionHeading(doc, geo, 'Información del equipo', yPosition, 2);
  yPosition = drawReportFactRows(doc, geo, [
    ['Marca', data.brand],
    ['Modelo', data.equipmentModel],
  ], yPosition);
  yPosition += 4;

  // ── INCIDENT DESCRIPTION ────────────────────────────────────────
  yPosition = breakIfShort(yPosition, 46);
  yPosition = drawReportSectionHeading(doc, geo, 'Descripción de la incidencia', yPosition, 3);
  yPosition = drawReportProse(doc, geo, data.issue, yPosition) + 4;

  // ── ACTIONS TAKEN ───────────────────────────────────────────────
  yPosition = breakIfShort(yPosition, 46);
  yPosition = drawReportSectionHeading(doc, geo, 'Acciones realizadas', yPosition, 4);
  yPosition = drawReportProse(doc, geo, data.actionsTaken, yPosition) + 4;

  // ── PHOTO EVIDENCE ──────────────────────────────────────────────
  if (data.photos && data.photos.length > 0) {
    const maxPhotosPerRow = 2;
    const photoGap = 8;
    const photoWidth = (geo.contentWidth - photoGap * (maxPhotosPerRow - 1)) / maxPhotosPerRow;
    const photoHeight = photoWidth * 0.75; // 4:3 aspect ratio
    const rowHeight = photoHeight + 10;

    // The heading travels with the first row so a section never opens on the
    // last line of a page.
    yPosition = breakIfShort(yPosition, 14 + rowHeight);
    yPosition = drawReportSectionHeading(doc, geo, 'Evidencia fotográfica', yPosition, 5);

    for (let i = 0; i < data.photos.length; i++) {
      const col = i % maxPhotosPerRow;

      if (col === 0 && i > 0) {
        yPosition += rowHeight;
        yPosition = breakIfShort(yPosition, rowHeight);
      }

      const xOffset = geo.left + col * (photoWidth + photoGap);

      try {
        const { data: imgData, format } = parseImageDataUrl(data.photos[i]);
        pdfDoc.addImage(imgData, format, xOffset, yPosition, photoWidth, photoHeight);
      } catch (error) {
        console.error('Error adding photo to PDF:', error);
        setReportMonoText(doc, REPORT_SOFT, 6);
        doc.text('Error al cargar imagen', xOffset + photoWidth / 2, yPosition + photoHeight / 2, {
          align: 'center',
        });
      }

      // A hairline frame, drawn over the photo, keeps a light image from
      // bleeding into the page without putting a slab of grey behind it.
      doc.setDrawColor(...REPORT_RULE);
      doc.setLineWidth(REPORT_HAIRLINE * geo.mm);
      doc.rect(xOffset, yPosition, photoWidth, photoHeight, 'S');

      setReportMonoText(doc, REPORT_SOFT, 5.4, 'bold');
      doc.text(`FOTO ${i + 1}`, xOffset, yPosition + photoHeight + 4, { charSpace: 0.2 * geo.mm });
    }

    yPosition += photoHeight + 14;
  }

  // ── SIGNATURE ───────────────────────────────────────────────────
  yPosition = breakIfShort(yPosition, 70);
  yPosition = drawReportSectionHeading(doc, geo, 'Firma del técnico', yPosition, 6);
  yPosition = drawReportFactRows(doc, geo, [['Técnico', data.techName]], yPosition);

  if (data.signature) {
    const boxWidth = Math.min(150, geo.contentWidth);
    try {
      doc.addImage(data.signature, 'PNG', geo.left + 5, yPosition + 2, boxWidth - 10, 40);
    } catch (error) {
      console.error('Error adding signature image:', error);
      setReportMonoText(doc, REPORT_SOFT, 7);
      doc.text('Firmado digitalmente', geo.left + 5, yPosition + 22);
    }

    // The signature sits on a rule rather than inside a box: a signature line
    // is what people are used to signing, and it needs no border to read as one.
    doc.setDrawColor(...REPORT_RULE);
    doc.setLineWidth(REPORT_HAIRLINE * geo.mm);
    doc.line(geo.left, yPosition + 44, geo.left + boxWidth, yPosition + 44);
    yPosition += 50;
  }

  setReportMonoText(doc, REPORT_SOFT, 5.8);
  doc.text(`FIRMADO EL ${dateStr.toUpperCase()} A LAS ${timeStr}`, geo.left, yPosition + 4, {
    charSpace: 0.2 * geo.mm,
  });

  stampReportChrome(doc, chrome);

  // ── OUTPUT ──────────────────────────────────────────────────────
  const filename = buildIncidentReportPdfFilename(data.jobTitle, currentDate);

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
