
import { PDFDocument } from 'pdf-lib';
import { supabase } from '@/lib/supabase';
import { exportShiftsTablePDF, ShiftsTablePdfData } from './shiftsTablePdfExport';
import { exportArtistTablePDF, ArtistTablePdfData } from './artistTablePdfExport';

// Changed the interface to accept a toast function directly
export interface FestivalDocumentCompilerOptions {
  jobId: string;
  jobTitle: string;
  selectedDate: string;
  shifts: any[];
  toast: (props: { title: string; description: string; variant?: "default" | "destructive" }) => void;
}

export const compileFestivalDocumentation = async (options: FestivalDocumentCompilerOptions): Promise<Blob> => {
  const { jobId, jobTitle, selectedDate, shifts, toast } = options;
  
  try {
    // Create a new PDF document
    const compiledPdf = await PDFDocument.create();
    
    // 1. First, generate the shifts schedule PDF
    console.log("Generating shifts schedule PDF...");
    const shiftsData: ShiftsTablePdfData = {
      jobTitle,
      date: selectedDate,
      jobId,
      shifts: shifts.map(shift => ({
        name: shift.name,
        time: {
          start: shift.start_time,
          end: shift.end_time
        },
        stage: shift.stage,
        department: shift.department || '',
        assignments: shift.assignments?.map((assignment: any) => ({
          name: `${assignment.profiles?.first_name || ''} ${assignment.profiles?.last_name || ''}`.trim(),
          role: assignment.role
        })) || []
      }))
    };
    
    try {
      const shiftsBlob = await exportShiftsTablePDF(shiftsData);
      await addPdfToCompilation(compiledPdf, shiftsBlob, "Shifts Schedule");
    } catch (error) {
      console.error("Error generating shifts schedule PDF:", error);
      toast({
        title: "Warning",
        description: "Could not add shifts schedule to compilation",
        variant: "destructive",
      });
    }
    
    // 2. Look for any artist data in the database
    console.log("Fetching artist data...");
    const { data: artistsData, error: artistsError } = await supabase
      .from("festival_artists")
      .select("*")
      .eq("job_id", jobId);
      
    if (artistsError) {
      console.error("Error fetching artists:", artistsError);
    } else if (artistsData && artistsData.length > 0) {
      // Generate artist table PDF
      console.log("Generating artist table PDF...");
      try {
        const artistsBlob = await exportArtistTablePDF({
          jobTitle,
          date: selectedDate, 
          stage: 'all',
          artists: artistsData
        });
        
        await addPdfToCompilation(compiledPdf, artistsBlob, "Artist Schedule");
      } catch (error) {
        console.error("Error adding artists PDF:", error);
        toast({
          title: "Warning",
          description: "Could not add artist schedule to compilation",
          variant: "destructive",
        });
      }
    }
    
    // 3. Fetch any artist requirement forms and add them
    console.log("Fetching artist requirement forms...");
    const { data: formData, error: formError } = await supabase
      .from("festival_artist_forms")
      .select("*")
      .eq("job_id", jobId);
      
    if (formError) {
      console.error("Error fetching artist forms:", formError);
    } else if (formData && formData.length > 0) {
      // For each form, get the PDF if it exists
      for (const form of formData) {
        if (form.pdf_url) {
          try {
            console.log("Adding artist form PDF:", form.artist_name);
            
            // Implement a retry mechanism for fetch operations
            const fetchWithRetry = async (url: string, retries = 3) => {
              for (let i = 0; i < retries; i++) {
                try {
                  const response = await fetch(url, {
                    headers: {
                      'Cache-Control': 'no-cache',
                      'Pragma': 'no-cache'
                    }
                  });
                  
                  if (!response.ok) {
                    throw new Error(`Failed with status: ${response.status}`);
                  }
                  
                  return response;
                } catch (err) {
                  console.error(`Attempt ${i+1} failed:`, err);
                  if (i === retries - 1) throw err;
                  // Wait before retrying
                  await new Promise(r => setTimeout(r, 1000));
                }
              }
            };
            
            // Fetch the PDF from the URL with retry
            const response = await fetchWithRetry(form.pdf_url);
            const pdfBlob = await response.blob();
            
            await addPdfToCompilation(
              compiledPdf, 
              pdfBlob, 
              `Artist Requirements: ${form.artist_name}`
            );
          } catch (error) {
            console.error(`Error adding form PDF for ${form.artist_name}:`, error);
            toast({
              title: "Warning",
              description: `Could not add requirements for ${form.artist_name}`,
              variant: "destructive",
            });
          }
        }
      }
    }
    
    // Generate the final PDF bytes
    const pdfBytes = await compiledPdf.save();
    
    // Convert to blob and return
    return new Blob([pdfBytes], { type: 'application/pdf' });
  } catch (error) {
    console.error("Error compiling festival documentation:", error);
    toast({
      title: "Error",
      description: "Could not compile festival documentation",
      variant: "destructive",
    });
    
    // Create an empty PDF as fallback
    const emptyPdf = await PDFDocument.create();
    const pdfBytes = await emptyPdf.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  }
};

// Helper function to add a PDF blob to the compiled document
async function addPdfToCompilation(compiledPdf: PDFDocument, pdfBlob: Blob, sectionTitle: string): Promise<void> {
  try {
    // Convert blob to array buffer with more robust error handling
    const arrayBuffer = await pdfBlob.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error("Empty PDF data received");
    }
    
    try {
      // Load the source PDF with more robust error handling
      const sourcePdf = await PDFDocument.load(new Uint8Array(arrayBuffer), {
        ignoreEncryption: true,
      });
      
      if (!sourcePdf) {
        throw new Error("Failed to load source PDF");
      }
      
      const pageIndices = sourcePdf.getPageIndices();
      if (pageIndices.length === 0) {
        console.warn(`PDF for ${sectionTitle} has no pages, skipping`);
        return;
      }
      
      // Copy all pages from the source PDF
      const copiedPages = await compiledPdf.copyPages(sourcePdf, pageIndices);
      
      // Add each copied page to the target document
      copiedPages.forEach((page) => {
        if (page) compiledPdf.addPage(page);
      });
      
      console.log(`Added ${copiedPages.length} pages from ${sectionTitle}`);
    } catch (error) {
      throw new Error(`Error processing PDF for ${sectionTitle}: ${error.message}`);
    }
  } catch (error) {
    console.error(`Error adding ${sectionTitle} to compilation:`, error);
    throw error;
  }
}
