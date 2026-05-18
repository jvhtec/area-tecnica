import type jsPDF from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { loadPdfLibs, type AutoTableFn } from '@/utils/pdf/lazyPdf';

export type { AutoTableFn };
export type PdfRgb = [number, number, number];

export const SECTOR_PRO_RED: PdfRgb = [125, 1, 1];
export const DEFAULT_PDF_HEADER_HEIGHT = 30;
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

export interface CorporateHeaderOptions {
  title: string;
  subtitle?: string;
  logo?: string | null;
  logoFormat?: string;
  backgroundColor?: PdfRgb;
  height?: number;
}

export const drawCorporatePdfHeader = (
  pdf: jsPDF,
  {
    title,
    subtitle,
    logo,
    logoFormat = 'PNG',
    backgroundColor = SECTOR_PRO_RED,
    height = DEFAULT_PDF_HEADER_HEIGHT,
  }: CorporateHeaderOptions,
): void => {
  const pageWidth = pdf.internal.pageSize.width;

  pdf.setFillColor(...backgroundColor);
  pdf.rect(0, 0, pageWidth, height, 'F');

  safeAddPdfImage(pdf, logo, logoFormat, 5, 5, 25, 20, 'Error adding PDF header logo:');

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  pdf.text(title, pageWidth / 2, 15, { align: 'center' });

  if (subtitle) {
    pdf.setFontSize(12);
    pdf.text(subtitle, pageWidth / 2, 25, { align: 'center' });
  }
};

export interface GeneratedFooterOptions {
  pageNumber?: number;
  logo?: string | null;
  logoFormat?: string;
  generatedAt?: Date;
}

export const drawGeneratedPdfFooter = (
  pdf: jsPDF,
  {
    pageNumber,
    logo,
    logoFormat = 'PNG',
    generatedAt = new Date(),
  }: GeneratedFooterOptions = {},
): void => {
  const pageWidth = pdf.internal.pageSize.width;
  const pageHeight = pdf.internal.pageSize.height;

  if (logo) {
    const logoWidth = 40;
    const logoHeight = 15;
    const x = (pageWidth - logoWidth) / 2;
    const y = pageHeight - 25;
    safeAddPdfImage(pdf, logo, logoFormat, x, y, logoWidth, logoHeight, 'Error adding PDF footer logo:');
  }

  pdf.setFontSize(8);
  pdf.setTextColor(100, 100, 100);
  pdf.text(
    `Generado el ${format(generatedAt, "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}`,
    10,
    pageHeight - 10,
  );

  if (pageNumber !== undefined) {
    pdf.text(`Página ${pageNumber}`, pageWidth - 30, pageHeight - 10);
  }
};
