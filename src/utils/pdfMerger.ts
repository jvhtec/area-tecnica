
import { PDFDocument } from 'pdf-lib';

export const mergePDFs = async (pdfBlobs: Blob[]): Promise<Blob> => {
  try {
    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();
    
    // Process each PDF blob
    for (const pdfBlob of pdfBlobs) {
      // Convert blob to ArrayBuffer
      const arrayBuffer = await pdfBlob.arrayBuffer();
      
      // Load the PDF document from bytes
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      
      // Get all pages from the document
      const pages = await pdfDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
      
      // Add each page to the merged document
      for (const page of pages) {
        mergedPdf.addPage(page);
      }
    }
    
    // Save the merged PDF as bytes
    const mergedPdfBytes = await mergedPdf.save();
    
    // Convert the bytes to a Blob and return
    return new Blob([mergedPdfBytes], { type: 'application/pdf' });
  } catch (error) {
    console.error('Error merging PDFs:', error);
    throw new Error('Failed to merge PDF documents');
  }
};
