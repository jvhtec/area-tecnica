
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';

interface TourRow {
  date: string;
  location: string;
}

// Add type declaration for jsPDF with autotable
interface AutoTableJsPDF extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

// Function to fetch the tour logo URL
const fetchTourLogo = async (tourId: string): Promise<string | null> => {
  try {
    console.log("Fetching tour logo for:", tourId);
    
    const { data, error } = await supabase
      .from('tour_logos')
      .select('file_path')
      .eq('tour_id', tourId)
      .maybeSingle();
    
    if (error) {
      console.error("Error fetching tour logo:", error);
      return null;
    }
    
    if (!data) {
      console.log("No logo found for tour:", tourId);
      return null;
    }
    
    const { data: urlData } = supabase
      .storage
      .from('tour-logos')
      .getPublicUrl(data.file_path);
      
    console.log("Tour logo URL:", urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error("Unexpected error fetching logo:", error);
    return null;
  }
};

export const exportTourPDF = async (
  tourName: string,
  dateSpan: string,
  rows: TourRow[],
  tourId?: string,
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      console.log("Starting PDF generation with:", { tourName, dateSpan, rows, tourId });
      
      const doc = new jsPDF() as AutoTableJsPDF;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const createdDate = new Date().toLocaleDateString('en-GB');

      // Fetch tour logo if tourId is provided
      const loadLogosAndCompletePDF = async () => {
        // === HEADER SECTION ===
        doc.setFillColor(125, 1, 1);
        doc.rect(0, 0, pageWidth, 40, 'F');

        // If we have a tourId, try to fetch and add the tour logo
        let tourLogoAdded = false;
        let tourLogoHeight = 0;
        
        if (tourId) {
          const tourLogoUrl = await fetchTourLogo(tourId);
          
          if (tourLogoUrl) {
            try {
              const tourLogo = new Image();
              tourLogo.crossOrigin = 'anonymous';
              tourLogo.src = tourLogoUrl;
              
              await new Promise<void>((resolve, reject) => {
                tourLogo.onload = () => {
                  try {
                    // Calculate dimensions for tour logo (in top left of header)
                    const maxLogoHeight = 30; // Maximum height within header
                    const maxLogoWidth = 80; // Maximum width for tour logo
                    
                    let logoWidth, logoHeight;
                    
                    if (tourLogo.width > tourLogo.height) {
                      // Landscape logo
                      logoWidth = Math.min(maxLogoWidth, tourLogo.width);
                      logoHeight = logoWidth * (tourLogo.height / tourLogo.width);
                      
                      // Ensure height doesn't exceed max
                      if (logoHeight > maxLogoHeight) {
                        logoHeight = maxLogoHeight;
                        logoWidth = logoHeight * (tourLogo.width / tourLogo.height);
                      }
                    } else {
                      // Portrait or square logo
                      logoHeight = Math.min(maxLogoHeight, tourLogo.height);
                      logoWidth = logoHeight * (tourLogo.width / tourLogo.height);
                      
                      // Ensure width doesn't exceed max
                      if (logoWidth > maxLogoWidth) {
                        logoWidth = maxLogoWidth;
                        logoHeight = logoWidth * (tourLogo.height / tourLogo.width);
                      }
                    }
                    
                    // Position tour logo in top-left of header (with padding)
                    const padding = 5;
                    doc.addImage(tourLogo, 'PNG', padding, padding, logoWidth, logoHeight);
                    tourLogoAdded = true;
                    tourLogoHeight = logoHeight;
                    resolve();
                  } catch (err) {
                    console.error("Error adding tour logo:", err);
                    resolve(); // Continue without tour logo
                  }
                };
                
                tourLogo.onerror = () => {
                  console.error("Failed to load tour logo");
                  resolve(); // Continue without tour logo
                };
              });
            } catch (error) {
              console.error("Error processing tour logo:", error);
            }
          }
        }

        // Add text to header (adjusted for logo position if present)
        doc.setFontSize(24);
        doc.setTextColor(255, 255, 255);
        doc.text("Tour Schedule", pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(16);
        doc.text(tourName, pageWidth / 2, 30, { align: 'center' });
        
        doc.setFontSize(12);
        doc.text(dateSpan, pageWidth / 2, 38, { align: 'center' });

        // === TABLE SECTION ===
        const tableRows = rows.map(row => [row.date, row.location]);

        autoTable(doc, {
          head: [['Date', 'Location']],
          body: tableRows,
          startY: 50,
          theme: 'grid',
          styles: {
            fontSize: 10,
            cellPadding: 5,
            lineColor: [220, 220, 230],
            lineWidth: 0.1,
          },
          headStyles: {
            fillColor: [125, 1, 1],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
          },
          bodyStyles: { textColor: [51, 51, 51] },
          alternateRowStyles: { fillColor: [250, 250, 255] },
          // Set table margins to ensure it doesn't overlap with the bottom logo
          margin: { bottom: 30 },
        });

        // Calculate space needed at bottom for logo and page numbers
        const bottomLogoHeight = 20; // Adjust if needed
        const spaceForLogo = bottomLogoHeight + 15; // Add some padding

        // Get the final Y position of the table
        const finalY = doc.lastAutoTable?.finalY || 50;
        
        // If table would overlap with bottom area, add a new page
        if (finalY > pageHeight - spaceForLogo) {
          doc.addPage();
        }

        // === PAGE NUMBERS SECTION ===
        const totalPages = (doc.internal as any).pages.length - 1;
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFontSize(10);
          doc.setTextColor(51, 51, 51);
          doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
          
          // Add tour logo to the header of each page (if we have one)
          if (tourLogoAdded && i > 1) {
            // Copy the header background and tour logo to additional pages
            doc.setFillColor(125, 1, 1);
            doc.rect(0, 0, pageWidth, 40, 'F');
            
            // Re-add tour logo and header on each page
            const tourLogo = new Image();
            tourLogo.crossOrigin = 'anonymous';
            tourLogo.src = await fetchTourLogo(tourId || '');
            
            if (tourLogo.src) {
              try {
                // Use same dimensions calculated for first page
                const padding = 5;
                await new Promise<void>((resolve) => {
                  tourLogo.onload = () => {
                    const maxLogoHeight = 30;
                    const maxLogoWidth = 80;
                    
                    let logoWidth, logoHeight;
                    
                    if (tourLogo.width > tourLogo.height) {
                      logoWidth = Math.min(maxLogoWidth, tourLogo.width);
                      logoHeight = logoWidth * (tourLogo.height / tourLogo.width);
                      if (logoHeight > maxLogoHeight) {
                        logoHeight = maxLogoHeight;
                        logoWidth = logoHeight * (tourLogo.width / tourLogo.height);
                      }
                    } else {
                      logoHeight = Math.min(maxLogoHeight, tourLogo.height);
                      logoWidth = logoHeight * (tourLogo.width / tourLogo.height);
                      if (logoWidth > maxLogoWidth) {
                        logoWidth = maxLogoWidth;
                        logoHeight = logoWidth * (tourLogo.height / tourLogo.width);
                      }
                    }
                    
                    doc.addImage(tourLogo, 'PNG', padding, padding, logoWidth, logoHeight);
                    resolve();
                  };
                  
                  tourLogo.onerror = () => {
                    resolve(); // Continue without tour logo
                  };
                });
              } catch (error) {
                console.error(`Error adding tour logo to page ${i}:`, error);
              }
            }
            
            // Add header text
            doc.setFontSize(24);
            doc.setTextColor(255, 255, 255);
            doc.text("Tour Schedule", pageWidth / 2, 20, { align: 'center' });
            
            doc.setFontSize(16);
            doc.text(tourName, pageWidth / 2, 30, { align: 'center' });
            
            doc.setFontSize(12);
            doc.text(dateSpan, pageWidth / 2, 38, { align: 'center' });
          }
        }

        // === LOGO & CREATED DATE SECTION ===
        // Position Sector Pro logo at the bottom with adequate spacing
        const logo = new Image();
        logo.crossOrigin = 'anonymous';
        logo.src = '/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png';

        logo.onload = () => {
          const logoWidth = 50;
          const logoHeight = logoWidth * (logo.height / logo.width);
          const totalPagesAfterLogo = (doc.internal as any).pages.length - 1;

          for (let i = 1; i <= totalPagesAfterLogo; i++) {
            doc.setPage(i);
            const xPosition = (pageWidth - logoWidth) / 2;
            const yLogo = pageHeight - 20;
            try {
              doc.addImage(logo, 'PNG', xPosition, yLogo - logoHeight, logoWidth, logoHeight);
            } catch (error) {
              console.error(`Error adding logo on page ${i}:`, error);
            }
          }

          doc.setPage(totalPagesAfterLogo);
          doc.setFontSize(10);
          doc.setTextColor(51, 51, 51);
          doc.text(`Created: ${createdDate}`, pageWidth - 10, pageHeight - 10, { align: 'right' });
          const blob = doc.output('blob');
          resolve(blob);
        };

        logo.onerror = () => {
          console.error('Failed to load logo');
          const totalPagesAfterLogo = (doc.internal as any).pages.length - 1;
          doc.setPage(totalPagesAfterLogo);
          doc.setFontSize(10);
          doc.setTextColor(51, 51, 51);
          doc.text(`Created: ${createdDate}`, pageWidth - 10, pageHeight - 10, { align: 'right' });
          const blob = doc.output('blob');
          resolve(blob);
        };
      };

      // Start the process
      loadLogosAndCompletePDF();
    } catch (error) {
      console.error("Error in PDF generation:", error);
      reject(error);
    }
  });
};
