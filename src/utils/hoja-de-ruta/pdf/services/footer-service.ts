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
    // Always use the embedded logo for reliability
    return this.getEmbeddedLogo();
  }

  private static getEmbeddedLogo(): string {
    // Create a simple red rectangle with "SECTOR PRO" text as base64
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Fill background with Sector Pro red
      ctx.fillStyle = '#7D0101';
      ctx.fillRect(0, 0, 120, 40);
      
      // Add white text
      ctx.fillStyle = 'white';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SECTOR PRO', 60, 20);
      
      return canvas.toDataURL('image/png');
    }
    
    // Fallback: minimal base64 PNG
    return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAAoCAYAAAA16j4lAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAmhJREFUeNrsmE9IFEEYhmdG3R1nZtddnZmdmZ3ZXXfN/LO6a6Zmapmapf2xsiyzpMwis8r+UBZFlFB/yIyioA6dOgRBPx566BBBlB06dOjQoUOHDh06dOhQh6BOUYcOHTp0qE5Rh6BOHWprzAwzs7M7M7uzM7Ozs7M7f2Z+v3m/9z0zm5+AEELIXyOEEELIP8+ePdt/Vb5t24o///zztm3b9u3bt23btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm3btm2+f7a3btm3btm3btm3bWUAAAAAAElFTkSuQmCC`;
  }
}