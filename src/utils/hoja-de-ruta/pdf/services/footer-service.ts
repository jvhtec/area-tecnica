import { PDFDocument } from '../core/pdf-document';

export class FooterService {
  private static readonly FOOTER_HEIGHT = 30;
  private static readonly LOGO_HEIGHT = 20;

  static async addFooterToAllPages(pdfDoc: PDFDocument): Promise<void> {
    try {
      // Load Sector Pro logo from public assets
      const logoData = await this.loadSectorProLogo();
      const totalPages = pdfDoc.document.getNumberOfPages();
      const { width: pageWidth } = pdfDoc.dimensions;

      for (let i = 1; i <= totalPages; i++) {
        pdfDoc.document.setPage(i);
        
        if (logoData) {
          // Calculate logo dimensions and center position
          const logoWidth = this.LOGO_HEIGHT * 3; // Approximate aspect ratio
          const xPosition = (pageWidth - logoWidth) / 2;
          const yPosition = 15; // Bottom margin
          
          pdfDoc.addImage(logoData, 'PNG', xPosition, yPosition, logoWidth, this.LOGO_HEIGHT);
        } else {
          // Fallback text if logo fails to load
          pdfDoc.setText(8, [125, 1, 1]);
          pdfDoc.addText('[LOGO MISSING]', pageWidth / 2, 20, { align: 'center' });
        }
      }
    } catch (error) {
      console.error('Error adding footer to pages:', error);
      // Add fallback text footer
      const totalPages = pdfDoc.document.getNumberOfPages();
      const { width: pageWidth } = pdfDoc.dimensions;

      for (let i = 1; i <= totalPages; i++) {
        pdfDoc.document.setPage(i);
        pdfDoc.setText(8, [125, 1, 1]);
        pdfDoc.addText('[LOGO MISSING]', pageWidth / 2, 20, { align: 'center' });
      }
    }
  }

  private static async loadSectorProLogo(): Promise<string | null> {
    try {
      // Load the actual sector-pro-logo.png from public folder
      const response = await fetch('/sector-pro-logo.png');
      if (response.ok) {
        const blob = await response.blob();
        return await this.blobToDataURL(blob);
      }
    } catch (error) {
      console.error('Error loading sector-pro-logo.png:', error);
    }
    return null;
  }

  private static blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}