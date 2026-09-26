export { PDFEngine } from '@/utils/hoja-de-ruta/pdf/pdf-engine';
export {
  getHojaDeRutaPdfSectionLabel,
  getHojaDeRutaPdfSelectionLabel,
  HOJA_DE_RUTA_PDF_SECTIONS,
  HOJA_DE_RUTA_PRINT_SECTIONS,
  getHojaDeRutaPrintSectionLabel,
  normalizeHojaDeRutaPrintSections,
} from '@/utils/hoja-de-ruta/pdf/section-options';
export type {
  DriverCertificatePDFGenerationOptions,
  GeneratedHojaDeRutaPdf,
  PDFGenerationOptions,
} from '@/utils/hoja-de-ruta/pdf/core/pdf-types';
export type { HojaDeRutaPdfSectionId } from '@/utils/hoja-de-ruta/pdf/section-options';
export type { HojaDeRutaPrintSectionId } from '@/utils/hoja-de-ruta/pdf/section-options';
import { PDFEngine } from '@/utils/hoja-de-ruta/pdf/pdf-engine';
import { DriverCertificatePDFEngine } from '@/utils/hoja-de-ruta/pdf/driver-certificate-pdf-engine';
import type {
  DriverCertificatePDFGenerationOptions,
  GeneratedHojaDeRutaPdf,
  PDFGenerationOptions,
} from '@/utils/hoja-de-ruta/pdf/core/pdf-types';

export const generatePDF = async (
  options: PDFGenerationOptions,
): Promise<void> => {
  const engine = new PDFEngine(options);
  return engine.generate();
};

export const generatePDFPreview = async (
  options: PDFGenerationOptions,
): Promise<GeneratedHojaDeRutaPdf> => {
  const engine = new PDFEngine(options);
  return engine.generatePreview();
};

export const generateDriverCertificatePDF = async (
  options: DriverCertificatePDFGenerationOptions
): Promise<void> => {
  const engine = new DriverCertificatePDFEngine(options);
  return engine.generate();
};

export const generateDriverCertificatePDFPreview = async (
  options: DriverCertificatePDFGenerationOptions
): Promise<GeneratedHojaDeRutaPdf> => {
  const engine = new DriverCertificatePDFEngine(options);
  return engine.generatePreview();
};
