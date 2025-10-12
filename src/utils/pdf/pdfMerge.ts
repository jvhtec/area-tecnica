
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
    
    const mergedPdf = await PDFDocument.create();
    
    for (let i = 0; i < pdfBlobs.length; i++) {
      try {
        const pdfBlob = pdfBlobs[i];
        console.log(`Processing PDF ${i+1}/${pdfBlobs.length}, size: ${pdfBlob.size} bytes`);
        
        if (!pdfBlob || pdfBlob.size === 0) {
          console.warn(`Skipping empty PDF at index ${i}`);
          continue;
        }
        
        const arrayBuffer = await pdfBlob.arrayBuffer();
        
        try {
          const pdfDoc = await PDFDocument.load(arrayBuffer, { 
            ignoreEncryption: true,
            throwOnInvalidObject: false,
            updateMetadata: false
          });
          
          const pageIndices = pdfDoc.getPageIndices();
          console.log(`PDF ${i+1} has ${pageIndices.length} pages`);
          
          if (pageIndices.length === 0) {
            console.warn(`PDF ${i+1} has no pages, skipping`);
            continue;
          }
          
          for (const pageIndex of pageIndices) {
            try {
              const [copiedPage] = await mergedPdf.copyPages(pdfDoc, [pageIndex]);
              mergedPdf.addPage(copiedPage);
              console.log(`Copied page ${pageIndex+1} from PDF ${i+1}`);
            } catch (pageError) {
              console.error(`Error copying page ${pageIndex+1} from PDF ${i+1}:`, pageError);
              continue;
            }
          }
        } catch (pdfError) {
          console.error(`Error processing PDF content at index ${i}:`, pdfError);
          console.log(`Problematic PDF size: ${pdfBlob.size} bytes`);
          continue;
        }
      } catch (err) {
        console.error(`Error processing PDF at index ${i}:`, err);
        continue;
      }
    }
    
    const pageCount = mergedPdf.getPageCount();
    console.log(`Merged document has ${pageCount} pages`);
    
    if (pageCount === 0) {
      throw new Error('No valid pages found in the provided PDFs');
    }
    
    console.log(`Successfully merged ${pageCount} pages`);
    const mergedPdfBytes = await mergedPdf.save();
    return new Blob([new Uint8Array(mergedPdfBytes)], { type: 'application/pdf' });
  } catch (error) {
    console.error('Error merging PDFs:', error);
    throw new Error(`Failed to merge PDF documents: ${error.message}`);
  }
};
