import { stampReportFolios } from '@/utils/pdf/report-system';
import { PDFDocument } from '../core/pdf-document';
import { HojaPageLabels, drawHojaChrome } from '../hoja-report-system';

/**
 * Final pass over the document: the running head, the footer band and the folio
 * on every content page.
 *
 * The chrome is drawn here rather than as each section opens, for two reasons.
 * A section that runs past the bottom continues on a page nothing has drawn on,
 * and those pages used to come out bare; and a PDF page only accumulates, so
 * chrome drawn twice prints twice. The cover carries neither head nor folio.
 */
export class FooterService {
  static async addFooterToAllPages(
    pdfDoc: PDFDocument,
    jobName?: string,
    options: {
      hasCoverPage?: boolean;
      headerTitle?: string;
      pageLabels?: HojaPageLabels;
    } = {}
  ): Promise<void> {
    try {
      const hasCoverPage = options.hasCoverPage ?? true;
      const totalPages = pdfDoc.document.getNumberOfPages();

      for (let page = hasCoverPage ? 2 : 1; page <= totalPages; page += 1) {
        pdfDoc.document.setPage(page);
        drawHojaChrome(pdfDoc.document, {
          title: options.headerTitle ?? 'Hoja de Ruta',
          jobName: jobName ?? '',
          contextLabel: options.pageLabels?.resolve(page),
        });
      }

      stampReportFolios(pdfDoc.document, { skipPages: hasCoverPage ? [1] : [] });
    } catch (error) {
      console.error('Error adding footer to pages:', error);
    }
  }
}
