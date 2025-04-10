
import { jsPDF } from "jspdf";

// Define the AutoTableJsPDF interface that combines jsPDF with autotable features
export interface AutoTableJsPDF extends Omit<jsPDF, "output"> {
  lastAutoTable?: {
    finalY: number;
  };
  internal: any;
  setFillColor: (r: number, g: number, b: number) => AutoTableJsPDF;
  rect: (x: number, y: number, w: number, h: number, style: string) => AutoTableJsPDF;
  setFontSize: (size: number) => AutoTableJsPDF;
  setTextColor: (r: number, g: number, b: number) => AutoTableJsPDF;
  text: (text: string, x: number, y: number, options?: any) => AutoTableJsPDF;
  addPage: () => AutoTableJsPDF;
  addImage: (imageData: string | HTMLImageElement, format: string, x: number, y: number, width: number, height: number) => AutoTableJsPDF;
  setPage: (pageNumber: number) => AutoTableJsPDF;
  splitTextToSize: (text: string, maxWidth: number) => string[];
  getNumberOfPages: () => number;
  output(type: string, options?: any): any;
}

export interface RealtimePostgresChangesPayload<T = any> {
  commit_timestamp: string;
  errors: any[] | null;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: T;
  schema: string;
  table: string;
}
