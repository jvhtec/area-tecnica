import { drawReportSectionHeading } from '@/utils/pdf/report-system';
import { PDFDocument } from '../core/pdf-document';
import { HojaPageLabels, hojaGeometry } from '../hoja-report-system';
import { HeaderService } from '../services/header-service';

export class HeaderSection {
  constructor(
    private pdfDoc: PDFDocument,
    private jobName: string,
    private jobDate?: string,
    private headerTitle: string = 'Hoja de Ruta',
    private pageLabels: HojaPageLabels = new HojaPageLabels(),
  ) {}

  /** The section each page belongs to, for the final chrome pass. */
  get labels(): HojaPageLabels {
    return this.pageLabels;
  }

  addSectionHeader(
    title: string,
    yPosition?: number,
    options: { startOnNewPage?: boolean } = {}
  ): number {
    // New page per section unless this is the first page of a section-only PDF.
    if (options.startOnNewPage ?? true) {
      this.pdfDoc.addPage();
    }

    HeaderService.recordSectionPage(this.pdfDoc, this.pageLabels, title);

    const geo = hojaGeometry(this.pdfDoc.document);
    return drawReportSectionHeading(
      this.pdfDoc.document,
      geo,
      title,
      yPosition ?? geo.contentTop,
    );
  }
}
