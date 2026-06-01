export { PDFEngine } from '@/utils/hoja-de-ruta/pdf/pdf-engine';
export {
  getHojaDeRutaPdfSectionLabel,
  getHojaDeRutaPdfSelectionLabel,
  HOJA_DE_RUTA_PDF_SECTIONS
} from '@/utils/hoja-de-ruta/pdf/section-options';
export type { DriverCertificatePDFGenerationOptions, PDFGenerationOptions } from '@/utils/hoja-de-ruta/pdf/core/pdf-types';
export type { HojaDeRutaPdfSectionId } from '@/utils/hoja-de-ruta/pdf/section-options';
import { PDFEngine } from '@/utils/hoja-de-ruta/pdf/pdf-engine';
import { DriverCertificatePDFEngine } from '@/utils/hoja-de-ruta/pdf/driver-certificate-pdf-engine';
import type { DriverCertificatePDFGenerationOptions, PDFGenerationOptions } from '@/utils/hoja-de-ruta/pdf/core/pdf-types';

// Main export function for backward compatibility
export const generatePDF = async (
  eventData: any,
  travelArrangements: any[],
  roomAssignments: any[],
  imagePreviews: any,
  venueMapPreview: string | null,
  selectedJobId: string,
  jobTitle: string,
  // Optional parameters to enhance headers without breaking callers
  jobDate?: string,
  toast?: any,
  accommodations?: any[],
  pdfOptions?: Pick<PDFGenerationOptions, 'sections'>
): Promise<void> => {
  const engine = new PDFEngine({
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
  
  return engine.generate();
};

export const generateDriverCertificatePDF = async (
  options: DriverCertificatePDFGenerationOptions
): Promise<void> => {
  const engine = new DriverCertificatePDFEngine(options);
  return engine.generate();
};
