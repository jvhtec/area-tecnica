import { PDFDocument } from '../core/pdf-document';

/**
 * Renders a consistent header on the current page, inspired by PesosTool export
 */
export class HeaderService {
  static addHeaderToCurrentPage(
    pdfDoc: PDFDocument,
    mainTitle: string,
    jobName: string,
    jobDate?: string,
    logoData?: string,
    logoDims?: { width: number; height: number }
  ) {
    const { width: pageWidth } = pdfDoc.dimensions;

    // Header background bar
    pdfDoc.setFillColor(125, 1, 1);
    pdfDoc.addRect(0, 0, pageWidth, 40, 'F');

    // Optional small logo on left
    if (logoData) {
      try {
        const MAX_H = 28;
        const MAX_W = 160;
        let drawW = 24;
        let drawH = 8;
        if (logoDims && logoDims.width > 0 && logoDims.height > 0) {
          const scale = Math.min(MAX_H / logoDims.height, MAX_W / logoDims.width);
          drawW = Math.max(1, Math.round(logoDims.width * scale));
          drawH = Math.max(1, Math.round(logoDims.height * scale));
        } else {
          drawH = MAX_H;
          drawW = Math.min(MAX_W, Math.round(MAX_H * 3));
        }
        pdfDoc.addImage(logoData, 'PNG', 10, 5, drawW, drawH);
      } catch (e) {
        // ignore logo errors
      }
    }

    // Header text
    pdfDoc.setText(24, [255, 255, 255]);
    pdfDoc.addText(mainTitle, pageWidth / 2, 18, { align: 'center' });

    // Job name and date
    if (jobName) {
      pdfDoc.setText(12, [255, 255, 255]);
      pdfDoc.addText(jobName, pageWidth / 2, 30, { align: 'center' });
    }
    if (jobDate) {
      const displayDate = this.formatJobDate(jobDate);
      if (displayDate) {
        pdfDoc.setText(10, [255, 255, 255]);
        pdfDoc.addText(`Fecha del Trabajo: ${displayDate}`, pageWidth / 2, 38, { align: 'center' });
      }
    }
  }

  private static formatJobDate(raw: string): string | null {
    try {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        // Format as dd/mm/yyyy
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      }
      // Fallback for ISO date only strings (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
        const [y, m, rest] = raw.split('-');
        const d2 = rest?.slice(0, 2) || '01';
        return `${d2}/${m}/${y}`;
      }
      return raw;
    } catch {
      return null;
    }
  }
}
