
import { jsPDF } from "jspdf";

// Define the AutoTableJsPDF interface that combines jsPDF with autotable features
export interface AutoTableJsPDF extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
  internal: any;
  setFillColor: (r: number, g: number, b: number) => void;
  rect: (x: number, y: number, w: number, h: number, style: string) => void;
  setFontSize: (size: number) => void;
  setTextColor: (r: number, g: number, b: number) => void;
  text: (text: string, x: number, y: number, options?: any) => jsPDF;
  addPage: () => jsPDF;
  addImage: (imageData: string | HTMLImageElement, format: string, x: number, y: number, width: number, height: number) => jsPDF;
  setPage: (pageNumber: number) => jsPDF;
  splitTextToSize: (text: string, maxWidth: number) => string[];
  getNumberOfPages: () => number;
  output: (type: string, options?: any) => any;
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
