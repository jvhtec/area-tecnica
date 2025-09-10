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
      // Try multiple possible paths for the Sector Pro logo (match other PDFs)
      const possiblePaths = [
        '/sector pro logo.png', // Primary path with spaces (matches other PDFs)
        '/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png', // Known fallback
        '/sector%20pro%20logo.png', // URL encoded version
        '/sector-pro-logo.png'
      ];

      for (const path of possiblePaths) {
        try {
          const response = await fetch(path);
          if (response.ok) {
            const blob = await response.blob();
            return await this.blobToDataURL(blob);
          }
        } catch (error) {
          // Continue to next path
          continue;
        }
      }
      
      // If no logo found, return null (fallback text will be used)
      console.warn('Sector Pro logo not found in any of the expected paths');
    } catch (error) {
      console.error('Error loading Sector Pro logo:', error);
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