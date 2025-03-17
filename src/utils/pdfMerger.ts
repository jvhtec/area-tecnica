
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
        if (!pdfBlob || pdfBlob.size === 0) {
          console.warn(`Skipping empty PDF at index ${i}`);
          continue;
        }
        
        // Convert blob to ArrayBuffer
        const arrayBuffer = await pdfBlob.arrayBuffer();
        
        try {
          // Load the PDF document with additional options to handle problematic PDFs
          const pdfDoc = await PDFDocument.load(arrayBuffer, { 
            ignoreEncryption: true,
            throwOnInvalidObject: false,
            updateMetadata: false
          });
          
          // Get all pages from the document
          const pageIndices = pdfDoc.getPageIndices();
          console.log(`PDF ${i+1} has ${pageIndices.length} pages`);
          
          if (pageIndices.length === 0) {
            console.warn(`PDF ${i+1} has no pages, skipping`);
            continue;
          }
          
          // Copy pages with error handling for each individual page
          for (const pageIndex of pageIndices) {
            try {
              const [copiedPage] = await mergedPdf.copyPages(pdfDoc, [pageIndex]);
              mergedPdf.addPage(copiedPage);
              console.log(`Copied page ${pageIndex+1} from PDF ${i+1}`);
            } catch (pageError) {
              console.error(`Error copying page ${pageIndex+1} from PDF ${i+1}:`, pageError);
              // Continue with next page
            }
          }
        } catch (pdfError) {
          console.error(`Error processing PDF content at index ${i}:`, pdfError);
          // Log detailed info about the problematic PDF
          console.log(`Problematic PDF size: ${pdfBlob.size} bytes`);
          // Continue with other PDFs rather than failing completely
        }
      } catch (err) {
        console.error(`Error processing PDF at index ${i}:`, err);
        // Continue with other PDFs rather than failing completely
      }
    }
    
    // Check if we have any pages in the merged document
    const pageCount = mergedPdf.getPageCount();
    console.log(`Merged document has ${pageCount} pages`);
    
    if (pageCount === 0) {
      throw new Error('No valid pages found in the provided PDFs');
    }
    
    console.log(`Successfully merged ${pageCount} pages`);
    // Save the merged PDF as bytes
    const mergedPdfBytes = await mergedPdf.save();
    
    // Convert the bytes to a Blob and return
    return new Blob([mergedPdfBytes], { type: 'application/pdf' });
  } catch (error) {
    console.error('Error merging PDFs:', error);
    throw new Error(`Failed to merge PDF documents: ${error.message}`);
  }
};
