export { PDFEngine } from './pdf-engine';
export type { PDFGenerationOptions } from './core/pdf-types';
import { PDFEngine } from './pdf-engine';

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
