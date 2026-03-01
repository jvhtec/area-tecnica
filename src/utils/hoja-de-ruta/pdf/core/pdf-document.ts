import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface AutoTableJsPDF extends jsPDF {
  lastAutoTable: { finalY: number };
}

export class PDFDocument {
  private doc: AutoTableJsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private footerSpace: number = 40;

  constructor() {
    this.doc = new jsPDF() as AutoTableJsPDF;
    this.pageWidth = this.doc.internal.pageSize.width;
    this.pageHeight = this.doc.internal.pageSize.height;
  }

  get document(): AutoTableJsPDF {
    return this.doc;
  }

  get dimensions() {
    return {
      width: this.pageWidth,
      height: this.pageHeight,
      footerSpace: this.footerSpace
    };
  }

  addPage(): void {
    this.doc.addPage();
  }

  checkPageBreak(currentY: number, requiredHeight: number = 25): number {
    if (currentY + requiredHeight > this.pageHeight - this.footerSpace) {
      this.addPage();
      // Minimal top margin on continued pages within a section
      return 30;
    }
    return currentY;
  }

  addImage(imageData: string, format: string, x: number, y: number, width: number, height: number): void {
    try {
      this.doc.addImage(imageData, format, x, y, width, height);
    } catch (error) {
      console.error('Error adding image to PDF:', error);
    }
  }

  setText(fontSize: number, color: [number, number, number]): void {
    this.doc.setFontSize(fontSize);
    this.doc.setTextColor(color[0], color[1], color[2]);
  }

  addText(text: string, x: number, y: number, options?: any): void {
    this.doc.text(text, x, y, options);
  }

  // Split a long text into multiple lines that fit within maxWidth
  splitText(text: string, maxWidth: number): string[] {
    try {
      return this.doc.splitTextToSize(text, maxWidth) as unknown as string[];
    } catch {
      return [text];
    }
  }

  // Draw wrapped text centered (or aligned) with custom line height
  addWrappedText(text: string, centerX: number, startY: number, maxWidth: number, lineHeight = 10, align: 'center' | 'left' | 'right' = 'center'): number {
    const lines = this.splitText(text, maxWidth);
    lines.forEach((line, idx) => {
      const y = startY + idx * lineHeight;
      this.doc.text(line, centerX, y, { align });
    });
    return lines.length;
  }

  addTable(options: any): void {
    autoTable(this.doc, options);
  }

  setFillColor(r: number, g: number, b: number): void {
    this.doc.setFillColor(r, g, b);
  }

  addRect(x: number, y: number, width: number, height: number, style?: string): void {
    this.doc.rect(x, y, width, height, style);
  }

  save(filename: string): void {
    try {
      // Use the blob output method for more reliable downloads
      const blob = this.outputBlob();
      this.downloadBlob(blob, filename);
    } catch (error) {
      console.error('Error with blob download, falling back to direct save:', error);
      // Fallback to direct save method
      this.doc.save(filename);
    }
  }

  private downloadBlob(blob: Blob, filename: string): void {
    try {
      // Check for browser compatibility
      if (!window.URL || !document.createElement) {
        throw new Error('Browser not supported for blob downloads');
      }

      // Check if user initiated the action (this should be called from a user action)
      if (typeof document.hasFocus === 'function' && !document.hasFocus()) {
        console.warn('Document not focused, download might be blocked');
      }
      
      // Create a temporary URL for the blob
      const url = URL.createObjectURL(blob);
      
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      
      // Force the browser to recognize the download attribute
      link.setAttribute('download', filename);
      
      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      setTimeout(() => {
        try {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } catch (cleanupError) {
          console.warn('Error during cleanup:', cleanupError);
        }
      }, 100);
      
      console.log('✅ PDF download triggered successfully');
    } catch (error) {
      console.error('❌ Error with blob download method:', error);
      throw error;
    }
  }

  output(type: 'dataurl' | 'datauri'): any {
    return this.doc.output(type);
  }

  outputBlob(): Blob {
    return this.doc.output('blob') as Blob;
  }

  getLastAutoTableY(): number {
    return this.doc.lastAutoTable?.finalY || 0;
  }

  // Add clickable link to PDF
  addLink(url: string, x: number, y: number, width: number, height: number): void {
    try {
      this.doc.link(x, y, width, height, { url });
    } catch (error) {
      console.error('Error adding link to PDF:', error);
    }
  }
}
