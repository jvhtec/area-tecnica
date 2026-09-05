import {
  REPORT_ACCENT,
  REPORT_FAINT,
  REPORT_INK,
  REPORT_RULE_WEIGHT,
  REPORT_SOFT,
  loadReportIssuerMark,
  setReportMonoText,
  setReportText,
} from '@/utils/pdf/report-system';
import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';
import { hojaGeometry } from '../hoja-report-system';

/**
 * The cover of the hoja de ruta.
 *
 * It used to be a full-bleed burgundy page with two darker strips, two large
 * decorative circles and a white keyline — about 90 % ink coverage on a sheet
 * that gets printed for every driver and every crew member. It is now set in
 * type on paper: the event, the date and the client, over one accent rule.
 */
export class CoverSection {
  constructor(
    private pdfDoc: PDFDocument,
    private eventData: EventData,
    private jobTitle: string,
    private logoData?: string
  ) {}

  async generateCoverPage(): Promise<void> {
    const doc = this.pdfDoc.document;
    const geo = hojaGeometry(doc);
    const { mm } = geo;

    await loadReportIssuerMark();

    if (this.logoData) {
      try {
        const dims = await new Promise<{ width: number; height: number }>((resolve) => {
          const img = new Image();
          img.onload = () =>
            resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
          img.onerror = () => resolve({ width: 120, height: 40 });
          img.src = this.logoData!;
        });
        const scale = Math.min((28 * mm) / dims.height, (60 * mm) / dims.width);
        const drawW = Math.max(1, dims.width * scale);
        const drawH = Math.max(1, dims.height * scale);
        const format = this.logoData.includes('data:image/jpeg') ? 'JPEG' : 'PNG';
        this.pdfDoc.addImage(this.logoData, format, geo.left, 40 * mm, drawW, drawH);
      } catch (error) {
        console.error('Error adding logo to cover:', error);
      }
    }

    setReportMonoText(doc, REPORT_ACCENT, 6.6, 'bold');
    doc.text('HOJA DE RUTA', geo.left, 92 * mm, { charSpace: 0.45 * mm });

    const eventName = this.eventData.eventName || this.jobTitle || 'Evento sin título';
    setReportText(doc, REPORT_INK, 30, 'bold');
    const titleLines = (doc.splitTextToSize(eventName, geo.contentWidth) as string[]).slice(0, 4);
    doc.text(titleLines, geo.left, 106 * mm, { lineHeightFactor: 0.94, charSpace: -0.08 * mm });

    const afterTitle = 106 * mm + titleLines.length * 10.5 * mm;
    doc.setDrawColor(...REPORT_ACCENT);
    doc.setLineWidth(REPORT_RULE_WEIGHT * mm);
    doc.line(geo.left, afterTitle, geo.right, afterTitle);

    const displayDate = this.eventData.eventDates || new Date().toLocaleDateString('es-ES');
    setReportText(doc, REPORT_SOFT, 11);
    doc.text(displayDate, geo.left, afterTitle + 8 * mm);

    if (this.eventData.clientName) {
      setReportMonoText(doc, REPORT_SOFT, 5.8, 'bold');
      doc.text('CLIENTE', geo.left, geo.contentBottom - 12 * mm, { charSpace: 0.25 * mm });
      setReportText(doc, REPORT_INK, 12, 'bold');
      doc.text(this.eventData.clientName, geo.left, geo.contentBottom - 5 * mm);
    }

    setReportMonoText(doc, REPORT_FAINT, 5.8);
    doc.text('SECTOR-PRO', geo.left, geo.footerTextY, { charSpace: 0.2 * mm });
  }
}
