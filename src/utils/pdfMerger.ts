
// This file now serves as a simple re-export layer for backward compatibility
import { mergePDFs } from './pdf/pdfMerge';
import { fetchLogoUrl } from './pdf/logoUtils';
import { generateAndMergeFestivalPDFs } from './pdf/festivalPdfGenerator';

export {
  mergePDFs,
  fetchLogoUrl,
  generateAndMergeFestivalPDFs
};
