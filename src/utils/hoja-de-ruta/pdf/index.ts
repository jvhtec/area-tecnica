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

const createPDFEngine = (
  eventData: PDFGenerationOptions['eventData'],
  travelArrangements: PDFGenerationOptions['travelArrangements'],
  roomAssignments: PDFGenerationOptions['roomAssignments'],
  imagePreviews: PDFGenerationOptions['imagePreviews'],
  venueMapPreview: string | null,
  selectedJobId: string,
  jobTitle: string,
  jobDate?: string,
  toast?: PDFGenerationOptions['toast'],
  accommodations?: PDFGenerationOptions['accommodations'],
  pdfOptions?: Pick<PDFGenerationOptions, 'sections' | 'excludedSections'>
) => new PDFEngine({
  eventData,
  travelArrangements,
  roomAssignments,
  imagePreviews,
  venueMapPreview,
  selectedJobId,
  jobTitle,
  jobDate,
  toast,
  accommodations,
  ...pdfOptions
});

// Main export function for backward compatibility
export const generatePDF = async (
  eventData: PDFGenerationOptions['eventData'],
  travelArrangements: PDFGenerationOptions['travelArrangements'],
  roomAssignments: PDFGenerationOptions['roomAssignments'],
  imagePreviews: PDFGenerationOptions['imagePreviews'],
  venueMapPreview: string | null,
  selectedJobId: string,
  jobTitle: string,
  // Optional parameters to enhance headers without breaking callers
  jobDate?: string,
  toast?: PDFGenerationOptions['toast'],
  accommodations?: PDFGenerationOptions['accommodations'],
  pdfOptions?: Pick<PDFGenerationOptions, 'sections' | 'excludedSections'>
): Promise<void> => {
  const engine = createPDFEngine(
    eventData,
    travelArrangements,
    roomAssignments,
    imagePreviews,
    venueMapPreview,
    selectedJobId,
    jobTitle,
    jobDate,
    toast,
    accommodations,
    pdfOptions
  );
  
  return engine.generate();
};

export const generatePDFPreview = async (
  eventData: PDFGenerationOptions['eventData'],
  travelArrangements: PDFGenerationOptions['travelArrangements'],
  roomAssignments: PDFGenerationOptions['roomAssignments'],
  imagePreviews: PDFGenerationOptions['imagePreviews'],
  venueMapPreview: string | null,
  selectedJobId: string,
  jobTitle: string,
  jobDate?: string,
  toast?: PDFGenerationOptions['toast'],
  accommodations?: PDFGenerationOptions['accommodations'],
  pdfOptions?: Pick<PDFGenerationOptions, 'sections' | 'excludedSections'>
): Promise<GeneratedHojaDeRutaPdf> => {
  const engine = createPDFEngine(
    eventData,
    travelArrangements,
    roomAssignments,
    imagePreviews,
    venueMapPreview,
    selectedJobId,
    jobTitle,
    jobDate,
    toast,
    accommodations,
    pdfOptions
  );

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
