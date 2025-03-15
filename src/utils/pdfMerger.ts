
import { PDFDocument } from 'pdf-lib';

export const mergePDFs = async (pdfBlobs: Blob[]): Promise<Blob> => {
  try {
    console.log(`Attempting to merge ${pdfBlobs.length} PDF documents`);
    
    if (pdfBlobs.length === 0) {
      throw new Error('No PDFs provided for merging');
    }
    
    if (pdfBlobs.length === 1) {
      console.log('Only one PDF provided, returning it directly');
      return pdfBlobs[0];
    }
    
    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();
    
    // Process each PDF blob
    for (let i = 0; i < pdfBlobs.length; i++) {
      try {
        const pdfBlob = pdfBlobs[i];
        console.log(`Processing PDF ${i+1}/${pdfBlobs.length}, size: ${pdfBlob.size} bytes`);
        
        // Skip empty PDFs
        if (pdfBlob.size === 0) {
          console.warn(`Skipping empty PDF at index ${i}`);
          continue;
        }
        
        // Convert blob to ArrayBuffer
        const arrayBuffer = await pdfBlob.arrayBuffer();
        
        // Load the PDF document from bytes
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        
        // Get all pages from the document
        const pages = await pdfDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
        console.log(`Copied ${pages.length} pages from PDF ${i+1}`);
        
        // Add each page to the merged document
        for (const page of pages) {
          mergedPdf.addPage(page);
        }
      } catch (err) {
        console.error(`Error processing PDF at index ${i}:`, err);
        // Continue with other PDFs rather than failing completely
      }
    }
    
    // Check if we have any pages in the merged document
    if (mergedPdf.getPageCount() === 0) {
      throw new Error('No valid pages found in the provided PDFs');
    }
    
    console.log(`Successfully merged ${mergedPdf.getPageCount()} pages`);
    // Save the merged PDF as bytes
    const mergedPdfBytes = await mergedPdf.save();
    
    // Convert the bytes to a Blob and return
    return new Blob([mergedPdfBytes], { type: 'application/pdf' });
  } catch (error) {
    console.error('Error merging PDFs:', error);
    throw new Error(`Failed to merge PDF documents: ${error.message}`);
  }
};
