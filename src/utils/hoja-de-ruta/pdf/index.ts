export { PDFEngine } from './pdf-engine';
export type { DriverCertificatePDFGenerationOptions, PDFGenerationOptions } from './core/pdf-types';
import { PDFEngine } from './pdf-engine';
import { DriverCertificatePDFEngine } from './driver-certificate-pdf-engine';
import type { DriverCertificatePDFGenerationOptions } from './core/pdf-types';

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
  accommodations?: any[]
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
    accommodations
  });
  
  return engine.generate();
};

export const generateDriverCertificatePDF = async (
  options: DriverCertificatePDFGenerationOptions
): Promise<void> => {
  const engine = new DriverCertificatePDFEngine(options);
  return engine.generate();
};
