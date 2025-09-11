import { PDFDocument } from '../core/pdf-document';

export class FooterService {
  private static readonly FOOTER_HEIGHT = 30;
  // Target maximum size for footer logo (smaller to avoid stretching)
  private static readonly LOGO_MAX_HEIGHT = 6;
  private static readonly LOGO_MAX_WIDTH = 50;
  private static cachedLogoData: string | null = null;
  private static cachedLogoDims: { width: number; height: number } | null = null;

  static async addFooterToAllPages(pdfDoc: PDFDocument): Promise<void> {
    try {
      // Load Sector Pro logo from public assets
      const logoData = await this.loadSectorProLogo();
      const totalPages = pdfDoc.document.getNumberOfPages();
      const { width: pageWidth, height: pageHeight } = pdfDoc.dimensions;
      const bottomMargin = 10;

      // Determine intrinsic logo dimensions once
      let drawWidth = 0;
      let drawHeight = 0;
      if (logoData) {
        const dims = await this.getImageDimensions(logoData);
        const scale = Math.min(
          this.LOGO_MAX_HEIGHT / dims.height,
          this.LOGO_MAX_WIDTH / dims.width,
        );
        drawWidth = Math.max(1, Math.round(dims.width * scale));
        drawHeight = Math.max(1, Math.round(dims.height * scale));
      }

      for (let i = 1; i <= totalPages; i++) {
        pdfDoc.document.setPage(i);
        
        if (logoData && drawWidth > 0 && drawHeight > 0) {
          // Calculate logo dimensions and center position
          const xPosition = (pageWidth - drawWidth) / 2;
          // Position the logo at the bottom of the page
          const yPosition = pageHeight - drawHeight - bottomMargin;
          
          pdfDoc.addImage(logoData, 'PNG', xPosition, yPosition, drawWidth, drawHeight);
        } else {
          // Fallback text if logo fails to load
          pdfDoc.setText(8, [125, 1, 1]);
          pdfDoc.addText('[LOGO MISSING]', pageWidth / 2, pageHeight - bottomMargin, { align: 'center' });
        }
      }
    } catch (error) {
      console.error('Error adding footer to pages:', error);
      // Add fallback text footer
      const totalPages = pdfDoc.document.getNumberOfPages();
      const { width: pageWidth, height: pageHeight } = pdfDoc.dimensions;
      const bottomMargin = 10;

      for (let i = 1; i <= totalPages; i++) {
        pdfDoc.document.setPage(i);
        pdfDoc.setText(8, [125, 1, 1]);
        pdfDoc.addText('[LOGO MISSING]', pageWidth / 2, pageHeight - bottomMargin, { align: 'center' });
      }
    }
  }

  private static async loadSectorProLogo(): Promise<string | null> {
    try {
      if (this.cachedLogoData) return this.cachedLogoData;
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
            const dataUrl = await this.blobToDataURL(blob);
            this.cachedLogoData = dataUrl;
            return dataUrl;
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

  private static getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
    if (this.cachedLogoDims) return Promise.resolve(this.cachedLogoDims);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const dims = { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height };
        this.cachedLogoDims = dims;
        resolve(dims);
      };
      img.onerror = () => resolve({ width: this.LOGO_MAX_WIDTH, height: this.LOGO_MAX_HEIGHT });
      img.src = dataUrl;
    });
  }
}
