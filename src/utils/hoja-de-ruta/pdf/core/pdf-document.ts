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
      return 75; // Account for header space
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
    this.doc.save(filename);
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
}