import type jsPDF from 'jspdf';
import { loadPdfLibs, type AutoTableFn } from '@/utils/pdf/lazyPdf';

export type { AutoTableFn };
export type PdfRgb = [number, number, number];

export const SECTOR_PRO_RED: PdfRgb = [125, 1, 1];
export const COMPANY_LOGO_FALLBACK_PATHS = [
  '/sector pro logo.png',
  './sector pro logo.png',
  'sector pro logo.png',
] as const;

export interface AutoTablePdfDocument extends jsPDF {
  lastAutoTable?: {
    finalY?: number;
  };
}

type PdfConstructorOptions = {
  orientation?: 'portrait' | 'landscape' | 'p' | 'l';
  unit?: 'pt' | 'mm' | 'cm' | 'in' | 'px';
  format?: string | number[];
};

export interface PdfExportDocument {
  pdf: AutoTablePdfDocument;
  autoTable: AutoTableFn;
}

export const createPdfExportDocument = async (
  options?: PdfConstructorOptions,
): Promise<PdfExportDocument> => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const pdf = options ? new jsPDF(options) : new jsPDF();
  return { pdf: pdf as AutoTablePdfDocument, autoTable };
};

export const getLastAutoTableY = (pdf: jsPDF, fallback: number): number =>
  (pdf as AutoTablePdfDocument).lastAutoTable?.finalY ?? fallback;

export const pdfToBlob = (pdf: jsPDF): Blob => pdf.output('blob') as Blob;

const encodeBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  if (typeof btoa === 'function') {
    return btoa(binary);
  }

  const buffer = (globalThis as unknown as {
    Buffer?: { from(input: Uint8Array): { toString(encoding: 'base64'): string } };
  }).Buffer;

  if (buffer) {
    return buffer.from(bytes).toString('base64');
  }

  throw new Error('No base64 encoder is available for PDF image conversion.');
};

export const blobToDataUrl = async (blob: Blob): Promise<string> => {
  if (typeof FileReader !== 'undefined') {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to convert image blob to data URL.'));
      reader.readAsDataURL(blob);
    });
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const mime = blob.type || 'application/octet-stream';
  return `data:${mime};base64,${encodeBase64(bytes)}`;
};

export const loadImageAsDataUrl = async (imagePath: string): Promise<string | null> => {
  try {
    const response = await fetch(imagePath);
    if (!response.ok) return null;
    return await blobToDataUrl(await response.blob());
  } catch (error) {
    console.warn('Error loading PDF image:', error);
    return null;
  }
};

export const loadFirstImageAsDataUrl = async (
  imagePaths: readonly string[],
): Promise<string | null> => {
  for (const path of imagePaths) {
    const dataUrl = await loadImageAsDataUrl(path);
    if (dataUrl) return dataUrl;
  }

  return null;
};

let companyLogoDataUrlPromise: Promise<string | null> | null = null;

export const loadCompanyLogoDataUrl = async (): Promise<string | null> => {
  companyLogoDataUrlPromise ??= loadFirstImageAsDataUrl(COMPANY_LOGO_FALLBACK_PATHS).then((logo) => {
    if (!logo) companyLogoDataUrlPromise = null;
    return logo;
  });
  return companyLogoDataUrlPromise;
};

export const safeAddPdfImage = (
  pdf: jsPDF,
  imageData: string | null | undefined,
  formatName: string,
  x: number,
  y: number,
  width: number,
  height: number,
  warningMessage = 'Error adding image to PDF:',
): boolean => {
  if (!imageData) return false;

  try {
    pdf.addImage(imageData, formatName, x, y, width, height);
    return true;
  } catch (error) {
    console.warn(warningMessage, error);
    return false;
  }
};

