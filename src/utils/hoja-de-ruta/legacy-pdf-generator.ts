// Legacy PDF generator - redirects to new modular system
export { generatePDF } from './pdf';

// Keep the original signature for compatibility
import { generatePDF as newGeneratePDF } from './pdf';

export const generateLegacyPDF = newGeneratePDF;
