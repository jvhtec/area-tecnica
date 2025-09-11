import { PDFDocument } from '../core/pdf-document';
import { HeaderService } from '../services/header-service';

export class HeaderSection {
  constructor(
    private pdfDoc: PDFDocument,
    private jobName: string,
    private jobDate?: string,
    private headerTitle: string = 'Hoja de Ruta',
    private smallLogoData?: string,
    private smallLogoDims?: { width: number; height: number }
  ) {}

  addSectionHeader(title: string, yPosition: number = 55): number {
    // New page per section
    this.pdfDoc.addPage();

    // Draw a consistent header at the very top (matches PesosTool styling)
    HeaderService.addHeaderToCurrentPage(
      this.pdfDoc,
      this.headerTitle,
      this.jobName,
      this.jobDate,
      this.smallLogoData,
      this.smallLogoDims
    );

    // Section title below header
    const { width: pageWidth } = this.pdfDoc.dimensions;
    this.pdfDoc.setText(16, [125, 1, 1]);
    this.pdfDoc.addText(title, 20, yPosition);
    this.pdfDoc.setFillColor(125, 1, 1);
    this.pdfDoc.addRect(20, yPosition + 4, pageWidth - 40, 1, 'F');
    // Provide minimal spacing below the title
    return yPosition + 16;
  }
}
