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
      // Try to load from public assets first
      const response = await fetch('/sector-pro-logo.png');
      if (response.ok) {
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
    } catch (error) {
      console.warn('Could not load Sector Pro logo from public assets:', error);
    }

    // Fallback: return embedded base64 logo (small version)
    return this.getEmbeddedLogo();
  }

  private static getEmbeddedLogo(): string {
    // Small embedded SVG converted to base64 as fallback
    const svgLogo = `<svg width="120" height="40" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="40" fill="#7D0101"/>
      <text x="60" y="25" text-anchor="middle" fill="white" font-family="Arial" font-size="12" font-weight="bold">SECTOR PRO</text>
    </svg>`;
    
    return `data:image/svg+xml;base64,${btoa(svgLogo)}`;
  }
}