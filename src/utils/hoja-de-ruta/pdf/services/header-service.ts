import { PDFDocument } from '../core/pdf-document';
import { HojaPageLabels } from '../hoja-report-system';

/**
 * Records which section the current page opens, for the chrome pass that runs
 * once the document is complete.
 *
 * The header used to be a 40 mm red band repeating the document title, the job
 * name and the job date on every page. The job name and date now ride the rail
 * and the folio line, so the head only has to say what the document is — which
 * leaves the band's worth of paper to the content.
 */
export class HeaderService {
  static recordSectionPage(
    pdfDoc: PDFDocument,
    pageLabels: HojaPageLabels,
    sectionLabel: string,
  ): void {
    pageLabels.record(pdfDoc.document.getCurrentPageInfo().pageNumber, sectionLabel);
  }

  static formatJobDate(raw: string): string | null {
    try {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        const day = String(parsed.getDate()).padStart(2, '0');
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}/${parsed.getFullYear()}`;
      }
      // Fallback for ISO date-only strings (YYYY-MM-DD).
      if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
        const [year, month, rest] = raw.split('-');
        return `${rest?.slice(0, 2) || '01'}/${month}/${year}`;
      }
      return raw;
    } catch {
      return null;
    }
  }
}
